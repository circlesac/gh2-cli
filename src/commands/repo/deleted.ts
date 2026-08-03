import { defineCommand } from "citty";
import { getOutputFormat, printOutput } from "../../lib/output.ts";
import {
  WebSettingsClient,
  WebSettingsError,
  formBody,
  loadWebSettingsClient,
  parseHtmlForms,
  stripHtml,
  type HtmlForm,
  type SettingsPage,
} from "../../lib/web-settings.ts";

export interface DeletedRepository {
  id: string;
  name: string;
  details?: string;
  form: HtmlForm;
}

interface DeletedRepositoryState {
  page: SettingsPage;
  repositories: DeletedRepository[];
}

function deletedRepositoriesPath(org?: string): string {
  return org
    ? `/organizations/${org}/settings/deleted_repositories`
    : "/settings/deleted_repositories";
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nearbyContainer(html: string, index: number): string {
  const prefix = html.slice(0, index);
  for (const tag of ["li", "tr", "article", "details"]) {
    const matches = [...prefix.matchAll(new RegExp(`<${tag}\\b`, "gi"))];
    const start = matches.at(-1)?.index;
    if (start === undefined) continue;
    const close = html.indexOf(`</${tag}>`, index);
    if (close !== -1 && close - start < 20_000) return html.slice(start, close + tag.length + 3);
  }
  return html.slice(Math.max(0, index - 1_500), Math.min(html.length, index + 1_500));
}

function repositoryName(block: string, owner: string): string | undefined {
  const dataName = block.match(/\bdata-repository-(?:name|nwo)=["']([^"']+)["']/i)?.[1];
  if (dataName) return dataName.includes("/") ? dataName : `${owner}/${dataName}`;
  const ownerPattern = escapePattern(owner);
  for (const match of block.matchAll(/href=["']([^"']+)["']/gi)) {
    const path = new URL(match[1]!, "https://github.com").pathname;
    const repository = path.match(new RegExp(`^/${ownerPattern}/([^/]+)(?:/|$)`, "i"))?.[1];
    if (repository && repository !== "settings") return `${owner}/${repository}`;
  }
  const text = stripHtml(block);
  const fullName = text.match(new RegExp(`\\b${ownerPattern}/([A-Za-z0-9_.-]+)\\b`, "i"));
  if (fullName) return `${owner}/${fullName[1]}`;
  const labelled = text.match(/(?:repository|repo)\s*[:：]\s*([A-Za-z0-9_.-]+)/i)?.[1];
  return labelled ? `${owner}/${labelled}` : undefined;
}

export function parseDeletedRepositories(
  page: SettingsPage,
  owner: string,
): DeletedRepository[] {
  const repositories: DeletedRepository[] = [];
  const seenIds = new Set<string>();
  for (const form of parseHtmlForms(page.html, page.url)) {
    const id = form.action.match(/^\/settings\/restore_repo\/(\d+)$/)?.[1];
    if (!id || form.method !== "POST") continue;
    if (seenIds.has(id)) {
      throw new WebSettingsError(
        "form_ambiguous",
        `Found duplicate restore forms for deleted repository ${id}.`,
        page.url,
      );
    }
    const block = nearbyContainer(page.html, form.startIndex);
    const name = repositoryName(block, owner);
    if (!name) {
      throw new WebSettingsError(
        "form_schema_changed",
        `Couldn't associate restore form ${id} with a repository name at ${page.url}.`,
        page.url,
      );
    }
    const text = stripHtml(block);
    const details = text
      .replace(new RegExp(escapePattern(name), "ig"), "")
      .replace(/\bRestore\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    repositories.push({ id, name, details: details || undefined, form });
    seenIds.add(id);
  }
  return repositories;
}

async function readDeletedRepositories(
  client: WebSettingsClient,
  owner: string,
  org?: string,
): Promise<DeletedRepositoryState> {
  const path = deletedRepositoriesPath(org);
  const page = await client.get(`https://github.com${path}`);
  return { page, repositories: parseDeletedRepositories(page, owner) };
}

export async function listDeletedRepositories(
  client: WebSettingsClient,
  org?: string,
) {
  const owner = org ?? client.account;
  if (!owner) {
    throw new WebSettingsError(
      "account_target_mismatch",
      "The captured session has no account name. Pass --org or capture the browser session again.",
    );
  }
  const state = await readDeletedRepositories(client, owner, org);
  return {
    account: client.account ?? "unknown",
    scope: org ? "organization" : "personal",
    target: owner,
    operation: "repo-deleted.list",
    mode: "read",
    sourcePage: new URL(state.page.url).pathname,
    method: "GET",
    changes: [],
    verified: true,
    repositories: state.repositories.map(({ form: _form, ...repository }) => repository),
  };
}

function splitRepository(value: string): { owner: string; repository: string; fullName: string } {
  const match = value.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) throw new Error("Repository must be written as owner/repository.");
  return { owner: match[1]!, repository: match[2]!, fullName: `${match[1]}/${match[2]}` };
}

export async function restoreRepository(
  client: WebSettingsClient,
  value: string,
  submit: boolean,
  verification: { attempts?: number; delayMs?: number } = {},
) {
  const target = splitRepository(value);
  const personal = client.account?.toLowerCase() === target.owner.toLowerCase();
  const state = await readDeletedRepositories(
    client,
    target.owner,
    personal ? undefined : target.owner,
  );
  const matches = state.repositories.filter(
    (repository) => repository.name.toLowerCase() === target.fullName.toLowerCase(),
  );
  if (!matches.length) {
    throw new WebSettingsError(
      "form_not_found",
      `No restorable deleted repository named ${target.fullName} was found.`,
      state.page.url,
    );
  }
  if (matches.length > 1) {
    throw new WebSettingsError(
      "form_ambiguous",
      `Found multiple restore entries named ${target.fullName}; no request was submitted.`,
      state.page.url,
    );
  }
  const repository = matches[0]!;
  const base = {
    account: client.account ?? "unknown",
    scope: personal ? "personal" : "organization",
    target: target.owner,
    operation: "repo.restore",
    mode: submit ? "submit" : "dry-run",
    sourcePage: new URL(state.page.url).pathname,
    method: "POST",
    changes: [{ field: "repository", current: "deleted", desired: "restored" }],
    verified: false,
    repository: repository.name,
    restoreId: repository.id,
    details: repository.details,
  };
  if (!submit) return base;

  try {
    await client.submit(state.page, repository.form, formBody(repository.form));
  } catch (error) {
    if (
      !(error instanceof WebSettingsError) ||
      error.code !== "submission_rejected" ||
      error.details?.status !== 404
    ) {
      throw error;
    }
  }
  const attempts = verification.attempts ?? 30;
  const delayMs = verification.delayMs ?? 1_000;
  let after: DeletedRepositoryState | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    after = await readDeletedRepositories(
      client,
      target.owner,
      personal ? undefined : target.owner,
    );
    if (!after.repositories.some((entry) => entry.id === repository.id)) {
      return { ...base, verified: true };
    }
    if (attempt + 1 < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new WebSettingsError(
    "verification_failed",
    `GitHub returned from the restore request, but ${repository.name} is still listed as deleted after ${attempts} readback attempts.`,
    after?.page.url,
  );
}

const listCommand = defineCommand({
  meta: { name: "list", description: "List restorable deleted repositories" },
  args: {
    org: { type: "string", description: "Organization whose deleted repositories to list" },
    output: { type: "string", description: "Output format: json | table", default: "table" },
  },
  async run({ args }) {
    printOutput(
      await listDeletedRepositories(
        await loadWebSettingsClient(),
        args.org === undefined ? undefined : String(args.org),
      ),
      getOutputFormat(args.output),
    );
  },
});

export const deletedCommand = defineCommand({
  meta: { name: "deleted", description: "Inspect deleted repositories" },
  subCommands: { list: listCommand },
});

export const restoreCommand = defineCommand({
  meta: { name: "restore", description: "Restore a deleted repository" },
  args: {
    repository: { type: "positional", description: "Repository as owner/name", required: true },
    yes: { type: "boolean", description: "Restore the repository; omit for a dry run", default: false },
    output: { type: "string", description: "Output format: json | table", default: "table" },
  },
  async run({ args }) {
    const result = await restoreRepository(
      await loadWebSettingsClient(),
      String(args.repository),
      Boolean(args.yes),
    );
    printOutput(result, getOutputFormat(args.output));
    if (!args.yes && getOutputFormat(args.output) !== "json") {
      console.log("Dry run only. Re-run with --yes to restore the repository.");
    }
  },
});
