import { defineCommand } from "citty";
import { open, unlink } from "node:fs/promises";
import { loadAuth, serializeCookies } from "../../lib/auth.ts";
import { getOutputFormat, printOutput } from "../../lib/output.ts";

type PermissionLevel = "read" | "write" | "admin";
type Fetch = typeof fetch;

interface HtmlForm {
  action: string;
  fields: [string, string][];
}

interface PatForm extends HtmlForm {
  account: string;
  bodyHtml: string;
  accessPath?: string;
}

interface OwnerOption {
  login: string;
  organization: boolean;
  expirationExempt: boolean;
  maxExpirationDays?: number;
  maxExpirationLabel?: string;
}

interface RepositoryOption {
  id: string;
  owner: string;
  name: string;
}

interface PermissionDefinition {
  scope: string;
  levels: PermissionLevel[];
}

interface RepositorySelection {
  mode: "none" | "all" | "selected";
  names: string[];
}

interface TokenSink {
  write(token: string): Promise<void>;
  cleanup(): Promise<void>;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributeRe =
    /([^\s=<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attributeRe.exec(tag)) !== null) {
    const name = match[1]!.toLowerCase();
    if (["button", "form", "input", "textarea"].includes(name)) continue;
    attributes[name] = decodeHtmlEntities(
      match[2] ?? match[3] ?? match[4] ?? "",
    );
  }
  return attributes;
}

function withoutTemplates(html: string): string {
  return html.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, "");
}

function parseSuccessfulControls(html: string): [string, string][] {
  const fields: [string, string][] = [];
  const body = withoutTemplates(html);

  for (const match of body.matchAll(/<input\b([^>]*)>/gi)) {
    const attributes = parseAttributes(match[1] ?? "");
    const name = attributes.name;
    if (!name || "disabled" in attributes) continue;
    const type = (attributes.type ?? "text").toLowerCase();
    if (
      ["button", "file", "image", "reset", "search", "submit"].includes(type)
    ) {
      continue;
    }
    if (
      (type === "checkbox" || type === "radio") &&
      !("checked" in attributes)
    ) {
      continue;
    }
    fields.push([
      name,
      attributes.value ??
        (type === "checkbox" || type === "radio" ? "on" : ""),
    ]);
  }

  for (const match of body.matchAll(
    /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi,
  )) {
    const attributes = parseAttributes(match[1] ?? "");
    if (!attributes.name || "disabled" in attributes) continue;
    fields.push([attributes.name, decodeHtmlEntities(match[2] ?? "")]);
  }

  return fields;
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parseForm(html: string, id?: string): HtmlForm | null {
  for (const match of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const attributes = parseAttributes(match[1] ?? "");
    if (id && attributes.id !== id) continue;
    if (!attributes.action) continue;
    const fields = parseSuccessfulControls(match[2] ?? "");
    if (!fields.some(([name]) => name === "authenticity_token")) continue;
    return { action: attributes.action, fields };
  }
  return null;
}

export function parsePatForm(html: string): PatForm | null {
  const formMatch = html.match(
    /<form\b([^>]*\bid="new_user_programmatic_access"[^>]*)>([\s\S]*?)<\/form>/i,
  );
  if (!formMatch) return null;
  const attributes = parseAttributes(formMatch[1] ?? "");
  if (!attributes.action) return null;
  const bodyHtml = formMatch[2] ?? "";
  const fields = parseSuccessfulControls(bodyHtml);
  if (!fields.some(([name]) => name === "authenticity_token")) return null;

  const account =
    html.match(/<meta\s+name="user-login"\s+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta\s+content="([^"]+)"\s+name="user-login"/i)?.[1];
  if (!account) return null;

  const accessPath = bodyHtml.match(
    /<include-fragment\b[^>]*\bsrc="([^"]*\/settings\/personal-access-tokens\/select-access[^"]*)"/i,
  )?.[1];

  return {
    action: attributes.action,
    fields,
    account: decodeHtmlEntities(account),
    bodyHtml,
    accessPath: accessPath ? decodeHtmlEntities(accessPath) : undefined,
  };
}

export function assertAccountMatches(captured: string, requested: string): void {
  if (captured.toLowerCase() === requested.toLowerCase()) return;
  throw new Error(
    `Captured GitHub session belongs to ${captured}, not ${requested}. Sign into ${requested} in the selected browser profile and run \`gh2 pat login\` again.`,
  );
}

export function parseOwnerOptions(html: string): OwnerOption[] {
  const owners: OwnerOption[] = [];
  for (const match of html.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)) {
    const attributes = parseAttributes(match[1] ?? "");
    const button = (match[2] ?? "").match(/<button\b([^>]*)>/i);
    if (!button) continue;
    const login = parseAttributes(button[1] ?? "")["data-value"];
    if (!login) continue;
    const maxExpirationDays = attributes["data-fg-limit"];
    owners.push({
      login,
      organization: attributes["data-actor-is-organization"] === "true",
      expirationExempt: attributes["data-fg-limit-exempt"] === "true",
      maxExpirationDays: maxExpirationDays
        ? Number.parseInt(maxExpirationDays, 10)
        : undefined,
      maxExpirationLabel: attributes["data-fg-limit-label"],
    });
  }
  return owners;
}

export function parseRepositoryOptions(html: string): RepositoryOption[] {
  const repositories: RepositoryOption[] = [];
  for (const match of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const body = match[1] ?? "";
    const id = body.match(
      /<input\b[^>]*\bname="repository_ids\[\]"[^>]*\bvalue="([^"]+)"[^>]*>/i,
    )?.[1];
    const owner = body.match(
      /<span\b[^>]*class="(?:[^"]+\s)?owner(?:\s[^"]+)?"[^>]*>([\s\S]*?)<\/span>/i,
    )?.[1];
    const name = body.match(
      /<span\b[^>]*class="(?:[^"]+\s)?repo(?:\s[^"]+)?"[^>]*>([\s\S]*?)<\/span>/i,
    )?.[1];
    if (!id || !owner || !name) continue;
    repositories.push({ id, owner: stripHtml(owner), name: stripHtml(name) });
  }
  return repositories;
}

export function parsePermissionDefinitions(
  html: string,
): Record<string, PermissionDefinition> {
  const definitions: Record<string, PermissionDefinition> = {};
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/react-partial\.embeddedData/.test(match[1] ?? "")) continue;
    try {
      const data = JSON.parse(match[2] ?? "") as {
        props?: {
          resources?: Record<
            string,
            { name?: string; metadata?: { fgp?: string[] } }[]
          >;
        };
      };
      for (const [scope, entries] of Object.entries(
        data.props?.resources ?? {},
      )) {
        for (const entry of entries) {
          if (!entry.name) continue;
          const levels: PermissionLevel[] = [];
          if (entry.metadata?.fgp?.includes("Read-only")) levels.push("read");
          if (entry.metadata?.fgp?.includes("Read and write")) levels.push("write");
          if (entry.metadata?.fgp?.includes("Admin")) levels.push("admin");
          definitions[entry.name] = { scope, levels };
        }
      }
    } catch {
      continue;
    }
  }
  return definitions;
}

export function parsePermissionAssignments(
  value: string | undefined,
): Record<string, PermissionLevel> {
  if (!value?.trim()) {
    throw new Error(
      "Pass --permissions with comma-separated assignments such as issues=write.",
    );
  }
  const assignments: Record<string, PermissionLevel> = {};
  for (const rawAssignment of value.split(",")) {
    const assignment = rawAssignment.trim();
    const equals = assignment.indexOf("=");
    if (equals <= 0 || equals === assignment.length - 1) {
      throw new Error(
        `Invalid permission assignment: ${assignment}. Use <permission>=read|write|admin.`,
      );
    }
    const permission = assignment.slice(0, equals).trim();
    const level = assignment.slice(equals + 1).trim();
    if (!/^[a-z0-9_]+$/.test(permission)) {
      throw new Error(`Invalid permission name: ${permission}`);
    }
    if (level !== "read" && level !== "write" && level !== "admin") {
      throw new Error(
        `Invalid level for ${permission}: ${level}. Expected read, write, or admin.`,
      );
    }
    if (permission in assignments) {
      throw new Error(`Permission assigned more than once: ${permission}`);
    }
    assignments[permission] = level;
  }
  if (assignments.metadata === "write") {
    throw new Error("The metadata permission only supports read access.");
  }
  assignments.metadata = "read";
  return assignments;
}

export function parseRepositorySelection(
  value: string | undefined,
  owner: string,
): RepositorySelection {
  if (!value?.trim()) {
    throw new Error(
      "Pass --repos all, --repos none, or a comma-separated repository list.",
    );
  }
  const normalized = value.trim();
  if (normalized === "all" || normalized === "none") {
    return { mode: normalized, names: [] };
  }
  const names: string[] = [];
  const seen = new Set<string>();
  for (const rawRepository of normalized.split(",")) {
    const repository = rawRepository.trim();
    if (!repository) continue;
    const parts = repository.split("/");
    if (parts.length > 2) throw new Error(`Invalid repository: ${repository}`);
    if (parts.length === 2 && parts[0]!.toLowerCase() !== owner.toLowerCase()) {
      throw new Error(
        `Repository ${repository} does not belong to resource owner ${owner}.`,
      );
    }
    const name = parts.at(-1)!;
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) {
      throw new Error(`Invalid repository: ${repository}`);
    }
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error(`Repository listed more than once: ${name}`);
    seen.add(key);
    names.push(name);
  }
  if (!names.length) throw new Error("No repositories were selected.");
  if (names.length > 50) {
    throw new Error("Fine-grained PATs support at most 50 selected repositories.");
  }
  return { mode: "selected", names };
}

export function validateExpiration(
  value: string | undefined,
  owner: OwnerOption,
): string {
  if (!value?.trim()) throw new Error("Pass --expires-in <days|none>.");
  const normalized = value.trim().toLowerCase();
  if (normalized === "none") {
    if (owner.maxExpirationDays !== undefined && !owner.expirationExempt) {
      throw new Error(
        `${owner.login} requires an expiration no later than ${owner.maxExpirationLabel ?? `${owner.maxExpirationDays} days`}.`,
      );
    }
    return normalized;
  }
  if (!/^\d+$/.test(normalized)) {
    throw new Error("--expires-in must be a number of days or none.");
  }
  const days = Number.parseInt(normalized, 10);
  if (days < 1 || days > 366) {
    throw new Error("--expires-in must be between 1 and 366 days, or none.");
  }
  if (
    owner.maxExpirationDays !== undefined &&
    !owner.expirationExempt &&
    days > owner.maxExpirationDays
  ) {
    throw new Error(
      `${owner.login} requires an expiration no later than ${owner.maxExpirationLabel ?? `${owner.maxExpirationDays} days`}.`,
    );
  }
  return String(days);
}

function selectedPermissions(fields: [string, string][]): Record<string, string> {
  const permissions: Record<string, string> = {};
  for (const [name, value] of fields) {
    const match = name.match(
      /^integration\[default_permissions\]\[([^\]]+)\]$/,
    );
    if (match) permissions[match[1]!] = value;
  }
  return permissions;
}

function fieldValue(fields: [string, string][], name: string): string | undefined {
  return fields.findLast(([fieldName]) => fieldName === name)?.[1];
}

export function buildPatBody(
  form: PatForm,
  accessHtml: string,
  input: {
    name: string;
    description?: string;
    reason?: string;
    owner: string;
    repositories: RepositorySelection;
    repositoryOptions: RepositoryOption[];
    permissions: Record<string, PermissionLevel>;
  },
): URLSearchParams {
  const accessFields = parseSuccessfulControls(accessHtml);
  const body = new URLSearchParams([...form.fields, ...accessFields]);
  body.delete("filter");
  body.set("user_programmatic_access[name]", input.name);
  body.set("user_programmatic_access[description]", input.description ?? "");
  body.set("target_name", input.owner);
  body.set("reason", input.reason ?? "");
  body.set("install_target", input.repositories.mode);
  body.delete("repository_ids[]");
  for (const name of input.repositories.names) {
    const repository = input.repositoryOptions.find(
      (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
    );
    if (!repository) throw new Error(`Repository was not validated: ${name}`);
    body.append("repository_ids[]", repository.id);
  }
  for (const [permission, level] of Object.entries(input.permissions)) {
    body.set(`integration[default_permissions][${permission}]`, level);
  }
  return body;
}

function parseRepositorySuggestionsPath(html: string): string | undefined {
  const match = html.match(
    /<remote-input\b[^>]*\bsrc="([^"]*\/settings\/personal-access-tokens\/suggestions[^"]*)"/i,
  );
  return match?.[1] ? decodeHtmlEntities(match[1]) : undefined;
}

function parseSubmissionError(html: string): string | undefined {
  if (/captcha|octocaptcha|hcaptcha|recaptcha/i.test(html)) {
    return "GitHub requires a captcha for this PAT request. Use the GitHub web form.";
  }
  const messages = [
    ...html.matchAll(
      /<(?:div|p|span)[^>]*class="[^"]*(?:flash-error|Banner--error|error-message)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p|span)>/gi,
    ),
  ]
    .map((match) => stripHtml(match[1] ?? ""))
    .filter((message) => message && message !== "Sorry, something went wrong.");
  return messages[0];
}

export function extractPatToken(html: string): string | null {
  return html.match(/github_pat_[A-Za-z0-9_]{40,}/)?.[0] ?? null;
}

export function parseConfirmationForm(html: string): HtmlForm | null {
  const frame = html.match(
    /<turbo-frame\b[^>]*\bid="fg_pat_confirmation_dialog"[^>]*>([\s\S]*?)<\/turbo-frame>/i,
  )?.[1];
  if (frame) return parseForm(frame);
  if (!/fg_pat_confirmation_dialog/i.test(html)) return null;
  return parseForm(html);
}

function absoluteGitHubUrl(path: string): string {
  const url = new URL(path, "https://github.com");
  if (url.origin !== "https://github.com") {
    throw new Error(`Refusing an unexpected GitHub form URL: ${url.href}`);
  }
  return url.href;
}

function detectAuthenticationChallenge(html: string, pageUrl: string): void {
  if (/<title[^>]*>\s*Confirm access\s*<\/title>/i.test(html)) {
    throw new Error(
      `GitHub requires sudo authentication. Complete it at ${pageUrl}, then run \`gh2 pat login\` again.`,
    );
  }
  if (/<form[^>]+action="\/session"|name="login"|Sign in to GitHub/i.test(html)) {
    throw new Error("GitHub session is not authenticated. Run `gh2 pat login` again.");
  }
}

async function fetchHtml(
  url: string,
  headers: Record<string, string>,
  accept = "text/html",
  fetchImpl: Fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(url, {
    headers: { ...headers, Accept: accept },
    redirect: "manual",
  });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location") ?? "";
    if (location.includes("/sessions/sudo")) {
      throw new Error(
        `GitHub requires sudo authentication. Complete it at ${url}, then run \`gh2 pat login\` again.`,
      );
    }
    throw new Error(
      "Got a redirect from GitHub. The captured session is likely stale; run `gh2 pat login` again.",
    );
  }
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status} for ${url}.`);
  const html = await response.text();
  detectAuthenticationChallenge(html, url);
  return html;
}

async function readSubmission(
  response: Response,
  headers: Record<string, string>,
  fetchImpl: Fetch,
): Promise<{ token?: string; confirmation?: HtmlForm }> {
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location") ?? "";
    if (location.includes("/sessions/sudo")) {
      throw new Error(
        "GitHub requires sudo authentication. Complete it in the browser, run `gh2 pat login`, and retry.",
      );
    }
    if (!location) {
      throw new Error("GitHub redirected without a destination. No PAT was assumed.");
    }
    const html = await fetchHtml(
      absoluteGitHubUrl(location),
      headers,
      "text/html",
      fetchImpl,
    );
    const token = extractPatToken(html);
    if (token) return { token };
    throw new Error(
      "GitHub completed a redirect, but the one-time PAT value was not found. No token was printed.",
    );
  }

  const html = await response.text();
  detectAuthenticationChallenge(html, "https://github.com/settings/personal-access-tokens/new");
  const token = extractPatToken(html);
  if (token) return { token };
  const confirmation = parseConfirmationForm(html);
  if (confirmation) return { confirmation };
  throw new Error(
    parseSubmissionError(html) ??
      `GitHub did not return a PAT or confirmation form (HTTP ${response.status}). No success was assumed.`,
  );
}

export async function submitPatForm(
  form: HtmlForm,
  body: URLSearchParams,
  headers: Record<string, string>,
  fetchImpl: Fetch = fetch,
): Promise<string> {
  const pageUrl = "https://github.com/settings/personal-access-tokens/new";
  const actionUrl = absoluteGitHubUrl(form.action);
  const response = await fetchImpl(actionUrl, {
    method: "POST",
    headers: {
      ...headers,
      Accept: "text/vnd.turbo-stream.html, text/html",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://github.com",
      Referer: pageUrl,
    },
    body: body.toString(),
    redirect: "manual",
  });
  const first = await readSubmission(response, headers, fetchImpl);
  if (first.token) return first.token;
  if (!first.confirmation) {
    throw new Error("GitHub did not return a PAT confirmation form.");
  }

  const confirmationResponse = await fetchImpl(
    absoluteGitHubUrl(first.confirmation.action),
    {
      method: "POST",
      headers: {
        ...headers,
        Accept: "text/vnd.turbo-stream.html, text/html",
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://github.com",
        Referer: pageUrl,
      },
      body: new URLSearchParams(first.confirmation.fields).toString(),
      redirect: "manual",
    },
  );
  const second = await readSubmission(confirmationResponse, headers, fetchImpl);
  if (!second.token) {
    throw new Error(
      "GitHub accepted the confirmation request but did not return the one-time PAT value.",
    );
  }
  return second.token;
}

async function prepareTokenSink(destination: string): Promise<TokenSink> {
  if (destination === "-") {
    return {
      async write(token) {
        process.stdout.write(`${token}\n`);
      },
      async cleanup() {},
    };
  }
  const handle = await open(destination, "wx", 0o600);
  await handle.chmod(0o600);
  let complete = false;
  return {
    async write(token) {
      await handle.writeFile(`${token}\n`);
      await handle.close();
      complete = true;
    },
    async cleanup() {
      if (complete) return;
      try {
        await handle.close();
      } catch {}
      try {
        await unlink(destination);
      } catch {}
    },
  };
}

export const patCreateCommand = defineCommand({
  meta: {
    name: "create",
    description:
      "Create a fine-grained PAT through GitHub's authenticated form (dry-run unless --yes)",
  },
  args: {
    account: {
      type: "string",
      description: "GitHub login that must match the captured browser session",
      required: true,
    },
    name: {
      type: "string",
      description: "Token name",
      required: true,
    },
    description: {
      type: "string",
      description: "Token description",
    },
    reason: {
      type: "string",
      description: "Request message sent to the resource-owner organization",
    },
    owner: {
      type: "string",
      description: "Resource owner login",
      required: true,
    },
    repos: {
      type: "string",
      description: "all, none, or comma-separated owner/repository names",
      required: true,
    },
    permissions: {
      type: "string",
      description: "Comma-separated permissions such as issues=write",
      required: true,
    },
    "expires-in": {
      type: "string",
      description: "Expiration in days (1-366) or none",
      required: true,
    },
    yes: {
      type: "boolean",
      description: "Create the PAT. Without this flag, print a live dry run.",
      default: false,
    },
    "token-output": {
      type: "string",
      description: "Required with --yes: write the one-time token to a new file or -",
    },
    format: {
      type: "string",
      description: "Metadata output format: json | table (default: table)",
      default: "table",
    },
  },
  async run({ args }) {
    if (args.yes && !args["token-output"]) {
      throw new Error(
        "--yes requires --token-output <new-file|-> so the one-time token is not lost.",
      );
    }

    const account = String(args.account);
    const requestedOwner = String(args.owner);
    const repositories = parseRepositorySelection(args.repos, requestedOwner);
    const permissions = parsePermissionAssignments(args.permissions);
    const auth = await loadAuth();
    const headers = {
      Cookie: serializeCookies(auth.cookies),
      "User-Agent": "gh2-cli",
    };

    const ownersHtml = await fetchHtml(
      `https://github.com/settings/personal-access-tokens/resource_owners?menu_id=resource-owner-select-panel&target_name=${encodeURIComponent(account)}&experimental=1`,
      headers,
    );
    const owner = parseOwnerOptions(ownersHtml).find(
      (candidate) =>
        candidate.login.toLowerCase() === requestedOwner.toLowerCase(),
    );
    if (!owner) {
      throw new Error(
        `Resource owner ${requestedOwner} is not available to the captured GitHub account.`,
      );
    }
    const expiration = validateExpiration(args["expires-in"], owner);

    const prefillUrl = new URL(
      "https://github.com/settings/personal-access-tokens/new",
    );
    prefillUrl.searchParams.set("name", String(args.name));
    if (args.description !== undefined) {
      prefillUrl.searchParams.set("description", String(args.description));
    }
    prefillUrl.searchParams.set("target_name", owner.login);
    prefillUrl.searchParams.set("expires_in", expiration);
    for (const [permission, level] of Object.entries(permissions)) {
      prefillUrl.searchParams.set(permission, level);
    }

    const pageHtml = await fetchHtml(prefillUrl.href, headers);
    const form = parsePatForm(pageHtml);
    if (!form) {
      throw new Error(
        "Couldn't find GitHub's fine-grained PAT form. The web form may have changed.",
      );
    }
    assertAccountMatches(form.account, account);

    const accessHtml = form.accessPath
      ? await fetchHtml(absoluteGitHubUrl(form.accessPath), headers)
      : form.bodyHtml;
    const definitions = parsePermissionDefinitions(accessHtml);
    const livePermissions = selectedPermissions(
      parseSuccessfulControls(accessHtml),
    );
    for (const [permission, level] of Object.entries(permissions)) {
      const definition = definitions[permission];
      if (!definition) {
        throw new Error(
          `Unknown permission: ${permission}. It was not present in GitHub's live PAT form.`,
        );
      }
      if (!definition.levels.includes(level)) {
        throw new Error(
          `${permission} does not support ${level} access in GitHub's live PAT form.`,
        );
      }
      if (livePermissions[permission] !== level) {
        throw new Error(
          `GitHub did not accept ${permission}=${level} in the live prefilled form.`,
        );
      }
    }

    let repositoryOptions: RepositoryOption[] = [];
    if (repositories.mode === "selected") {
      const suggestionsPath = parseRepositorySuggestionsPath(accessHtml);
      if (!suggestionsPath) {
        throw new Error(
          "Couldn't find GitHub's repository picker endpoint in the live PAT form.",
        );
      }
      const suggestionsHtml = await fetchHtml(
        absoluteGitHubUrl(suggestionsPath),
        headers,
        "text/fragment+html, text/html",
      );
      repositoryOptions = parseRepositoryOptions(suggestionsHtml).filter(
        (repository) =>
          repository.owner.toLowerCase() === owner.login.toLowerCase(),
      );
      for (const name of repositories.names) {
        if (
          !repositoryOptions.some(
            (repository) => repository.name.toLowerCase() === name.toLowerCase(),
          )
        ) {
          throw new Error(
            `Repository ${owner.login}/${name} was not present in GitHub's live repository picker.`,
          );
        }
      }
    }

    const formFields = [
      ...form.fields,
      ...parseSuccessfulControls(accessHtml),
    ];
    const defaultExpiration = fieldValue(
      formFields,
      "user_programmatic_access[default_expires_at]",
    );
    const customExpiration = fieldValue(
      formFields,
      "user_programmatic_access[custom_expires_at]",
    );
    const preview = {
      mode: args.yes ? "submit" : "dry-run",
      account: form.account,
      resource_owner: owner.login,
      repositories:
        repositories.mode === "selected"
          ? repositories.names.map((name) => `${owner.login}/${name}`)
          : repositories.mode,
      permissions,
      expiration:
        defaultExpiration === "custom"
          ? customExpiration
          : defaultExpiration ?? expiration,
      name: String(args.name),
      description: args.description ?? "",
      reason: args.reason ?? "",
      token_output: args["token-output"] ?? "not requested",
    };

    if (!args.yes) {
      const outputFormat = getOutputFormat(args.format);
      printOutput(preview, outputFormat);
      if (outputFormat !== "json") {
        console.log("Dry run only. Re-run with --yes and --token-output to create the PAT.");
      }
      return;
    }

    const body = buildPatBody(form, accessHtml, {
      name: String(args.name),
      description:
        args.description === undefined ? undefined : String(args.description),
      reason: args.reason === undefined ? undefined : String(args.reason),
      owner: owner.login,
      repositories,
      repositoryOptions,
      permissions,
    });
    const destination = String(args["token-output"]);
    const sink = await prepareTokenSink(destination);
    try {
      console.error(
        `Creating fine-grained PAT as ${form.account} for ${owner.login}; token destination: ${destination}`,
      );
      const token = await submitPatForm(form, body, headers);
      await sink.write(token);
      if (destination === "-") {
        console.error("Fine-grained PAT created and written to stdout.");
      } else {
        printOutput(
          { ...preview, mode: "created", token_output: destination },
          getOutputFormat(args.format),
        );
      }
    } catch (error) {
      await sink.cleanup();
      throw error;
    }
  },
});

export const __testing = {
  assertAccountMatches,
  buildPatBody,
  extractPatToken,
  parseConfirmationForm,
  parseOwnerOptions,
  parsePatForm,
  parsePermissionAssignments,
  parsePermissionDefinitions,
  parseRepositoryOptions,
  parseRepositorySelection,
  prepareTokenSink,
  submitPatForm,
  validateExpiration,
};
