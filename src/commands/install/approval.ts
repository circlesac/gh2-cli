import { defineCommand } from "citty";
import { getOutputFormat, printOutput } from "../../lib/output.ts";
import {
  WebSettingsClient,
  WebSettingsError,
  findHtmlForm,
  formBody,
  loadWebSettingsClient,
  parseHtmlForms,
  stripHtml,
  type HtmlForm,
  type SettingsPage,
} from "../../lib/web-settings.ts";

interface InstallationTarget {
  id: string;
  org?: string;
}

interface ApprovalState {
  page: SettingsPage;
  detailUrl: string;
  form?: HtmlForm;
  changes: string[];
}

function requireInstallationId(value: string): string {
  if (!/^\d+$/.test(value)) throw new Error("installation-id must be a numeric GitHub identifier.");
  return value;
}

function installationPath(target: InstallationTarget): string {
  return target.org
    ? `/organizations/${target.org}/settings/installations/${target.id}`
    : `/settings/installations/${target.id}`;
}

function approvalPath(target: InstallationTarget): string {
  return `${installationPath(target)}/permissions/update`;
}

export function extractApprovalChanges(html: string): string[] {
  const changes: string[] = [];
  for (const match of html.matchAll(
    /<[^>]+\bdata-permission-name=["']([^"']+)["'][^>]*\bdata-permission-level=["']([^"']+)["'][^>]*>/gi,
  )) {
    changes.push(`${match[1]}: ${match[2]}`);
  }
  for (const match of html.matchAll(/<(?:li|tr)\b[^>]*>([\s\S]*?)<\/(?:li|tr)>/gi)) {
    const text = stripHtml(match[1] ?? "");
    if (
      text.length >= 3 &&
      text.length <= 300 &&
      /\b(?:read|write|permission|access|metadata|administration|contents|issues|pull requests)\b/i.test(text)
    ) {
      changes.push(text);
    }
  }
  return [...new Set(changes)];
}

export function parseApprovalState(
  page: SettingsPage,
  target: InstallationTarget,
): ApprovalState {
  const path = approvalPath(target);
  const candidates = parseHtmlForms(page.html, page.url).filter(
    (form) => form.action === path && form.method === "PUT",
  );
  if (candidates.length > 1) {
    throw new WebSettingsError(
      "form_ambiguous",
      `Found multiple permission approval forms at ${page.url}.`,
      page.url,
    );
  }
  const form = candidates[0];
  if (form) {
    findHtmlForm(page, {
      action: path,
      method: "PUT",
      requiredFields: ["authenticity_token", "integration_fingerprint", "version_id"],
      expectedWritableFields: [],
    });
  }
  return {
    page,
    detailUrl: `https://github.com${installationPath(target)}`,
    form,
    changes: extractApprovalChanges(page.html),
  };
}

async function readApprovalState(
  client: WebSettingsClient,
  target: InstallationTarget,
): Promise<ApprovalState> {
  try {
    return parseApprovalState(
      await client.get(`https://github.com${approvalPath(target)}`),
      target,
    );
  } catch (error) {
    if (!(error instanceof WebSettingsError) || error.code !== "account_target_mismatch") {
      throw error;
    }
    const detailUrl = `https://github.com${installationPath(target)}`;
    const detail = await client.get(detailUrl);
    if (detail.html.includes(approvalPath(target))) throw error;
    return { page: detail, detailUrl, changes: [] };
  }
}

function baseResult(
  client: WebSettingsClient,
  target: InstallationTarget,
  state: ApprovalState,
) {
  return {
    account: client.account ?? "unknown",
    scope: target.org ? "organization" : "personal",
    target: target.org ?? client.account ?? "personal",
    sourcePage: new URL(state.page.url).pathname,
    installation: target.id,
  };
}

export async function showInstallationApproval(
  client: WebSettingsClient,
  target: InstallationTarget,
) {
  const state = await readApprovalState(client, target);
  return {
    ...baseResult(client, target, state),
    operation: "installation-approval.show",
    mode: "read",
    method: "GET",
    changes: state.changes,
    pending: Boolean(state.form),
    verified: true,
  };
}

export async function acceptInstallationApproval(
  client: WebSettingsClient,
  target: InstallationTarget,
  submit: boolean,
) {
  const before = await readApprovalState(client, target);
  if (!before.form) {
    throw new WebSettingsError(
      "no_pending_approval",
      `No pending permission approval was found for installation ${target.id}.`,
      before.page.url,
    );
  }
  const base = {
    ...baseResult(client, target, before),
    operation: "installation-approval.accept",
    mode: submit ? "submit" : "dry-run",
    method: "PUT",
    changes: before.changes,
    pending: true,
    verified: false,
  };
  if (!submit) return base;

  await client.submit(before.page, before.form, formBody(before.form));
  const after = await readApprovalState(client, target);
  const detail = await client.get(before.detailUrl);
  const stillLinked = parseHtmlForms(detail.html, detail.url).some(
    (form) => form.action === approvalPath(target),
  ) || detail.html.includes(approvalPath(target));
  if (after.form || stillLinked) {
    throw new WebSettingsError(
      "verification_failed",
      `GitHub returned from the approval request, but installation ${target.id} still requires permission approval.`,
      after.page.url,
    );
  }
  return { ...base, pending: false, verified: true };
}

function targetFromArgs(args: Record<string, unknown>): InstallationTarget {
  return {
    id: requireInstallationId(String(args.installation)),
    org: args.org === undefined ? undefined : String(args.org),
  };
}

const showCommand = defineCommand({
  meta: { name: "show", description: "Show a pending GitHub App permission approval" },
  args: {
    installation: { type: "positional", description: "Installation ID", required: true },
    org: { type: "string", description: "Organization that owns the installation" },
    output: { type: "string", description: "Output format: json | table", default: "table" },
  },
  async run({ args }) {
    printOutput(
      await showInstallationApproval(await loadWebSettingsClient(), targetFromArgs(args)),
      getOutputFormat(args.output),
    );
  },
});

const acceptCommand = defineCommand({
  meta: { name: "accept", description: "Accept a pending GitHub App permission change" },
  args: {
    installation: { type: "positional", description: "Installation ID", required: true },
    org: { type: "string", description: "Organization that owns the installation" },
    yes: { type: "boolean", description: "Accept the change; omit for a dry run", default: false },
    output: { type: "string", description: "Output format: json | table", default: "table" },
  },
  async run({ args }) {
    const result = await acceptInstallationApproval(
      await loadWebSettingsClient(),
      targetFromArgs(args),
      Boolean(args.yes),
    );
    printOutput(result, getOutputFormat(args.output));
    if (!args.yes && getOutputFormat(args.output) !== "json") {
      console.log("Dry run only. Re-run with --yes to accept the permission change.");
    }
  },
});

export const approvalCommand = defineCommand({
  meta: { name: "approval", description: "Review GitHub App installation permission changes" },
  subCommands: { show: showCommand, accept: acceptCommand },
});
