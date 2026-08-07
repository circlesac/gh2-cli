import { defineCommand } from "citty";
import { GitHubCookieJar, loadAuth } from "../../lib/auth.ts";
import { getOutputFormat, printOutput } from "../../lib/output.ts";

type PermissionLevel = "none" | "read" | "write";

interface PermissionForm {
  action: string;
  fields: [string, string][];
  permissions: Record<string, PermissionLevel>;
  submit?: [string, string];
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
  const attributeRe = /([^\s=<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attributeRe.exec(tag)) !== null) {
    const name = match[1]!.toLowerCase();
    if (name === "input" || name === "textarea" || name === "form") continue;
    attributes[name] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function removeTemplateContents(html: string): string {
  return html.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, "");
}

export function parsePermissionForm(html: string, settingsPath: string): PermissionForm | null {
  const targetPath = `${settingsPath}/permissions`;
  for (const match of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const formAttributes = parseAttributes(match[1] ?? "");
    const action = formAttributes.action;
    if (!action || !action.includes(targetPath)) continue;

    const fields: [string, string][] = [];
    const permissions: Record<string, PermissionLevel> = {};
    let submit: [string, string] | undefined;
    const body = removeTemplateContents(match[2] ?? "");

    for (const inputMatch of body.matchAll(/<input\b([^>]*)>/gi)) {
      const attributes = parseAttributes(inputMatch[1] ?? "");
      const name = attributes.name;
      if (!name) continue;

      const type = (attributes.type ?? "text").toLowerCase();
      const value = attributes.value ?? (type === "checkbox" || type === "radio" ? "on" : "");
      if (type === "submit") submit = [name, value];
      if ("disabled" in attributes) continue;
      if (["button", "file", "image", "reset"].includes(type)) continue;
      if ((type === "checkbox" || type === "radio") && !("checked" in attributes)) continue;

      fields.push([name, value]);

      const permissionMatch = name.match(
        /^integration\[default_permissions\]\[([^\]]+)\]$/,
      );
      if (
        permissionMatch &&
        (value === "none" || value === "read" || value === "write")
      ) {
        permissions[permissionMatch[1]!] = value;
      }
    }

    for (const textareaMatch of body.matchAll(
      /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi,
    )) {
      const attributes = parseAttributes(textareaMatch[1] ?? "");
      if (!attributes.name || "disabled" in attributes) continue;
      fields.push([attributes.name, decodeHtmlEntities(textareaMatch[2] ?? "")]);
    }

    for (const buttonMatch of body.matchAll(/<button\b([^>]*)>/gi)) {
      const attributes = parseAttributes(buttonMatch[1] ?? "");
      const permission = attributes["data-permission"];
      const resource = attributes["data-resource"];
      if (
        attributes.role !== "menuitemradio" ||
        attributes["aria-checked"] !== "true" ||
        !resource ||
        (permission !== "none" && permission !== "read" && permission !== "write")
      ) {
        continue;
      }
      if (permissions[resource] && permissions[resource] !== permission) {
        throw new Error(`Multiple selected permission levels found for ${resource}.`);
      }
      permissions[resource] = permission;
    }

    if (!fields.some(([name]) => name === "authenticity_token")) return null;
    return { action: decodeHtmlEntities(action), fields, permissions, submit };
  }
  return null;
}

export function parsePermissionAssignments(value: string | undefined): Record<string, PermissionLevel> {
  if (!value?.trim()) return {};
  const assignments: Record<string, PermissionLevel> = {};
  for (const rawAssignment of value.split(",")) {
    const assignment = rawAssignment.trim();
    const equals = assignment.indexOf("=");
    if (equals <= 0 || equals === assignment.length - 1) {
      throw new Error(
        `Invalid permission assignment: ${assignment}. Use --set <permission>=none|read|write.`,
      );
    }
    const permission = assignment.slice(0, equals).trim();
    const level = assignment.slice(equals + 1).trim();
    if (!/^[a-z0-9_]+$/.test(permission)) {
      throw new Error(`Invalid permission name: ${permission}`);
    }
    if (level !== "none" && level !== "read" && level !== "write") {
      throw new Error(
        `Invalid level for ${permission}: ${level}. Expected none, read, or write.`,
      );
    }
    if (permission in assignments) {
      throw new Error(`Permission assigned more than once: ${permission}`);
    }
    assignments[permission] = level;
  }
  return assignments;
}

export function buildPermissionBody(
  form: PermissionForm,
  requested: Record<string, PermissionLevel>,
  note?: string,
): URLSearchParams {
  const body = new URLSearchParams(form.fields);
  for (const [permission, level] of Object.entries(form.permissions)) {
    body.set(`integration[default_permissions][${permission}]`, level);
  }
  for (const [permission, level] of Object.entries(requested)) {
    body.set(`integration[default_permissions][${permission}]`, level);
  }
  if (note !== undefined) body.set("integration[note]", note);
  if (form.submit && !body.has(form.submit[0])) body.set(...form.submit);
  return body;
}

function changedPermissions(
  current: Record<string, PermissionLevel>,
  requested: Record<string, PermissionLevel>,
): { permission: string; before: PermissionLevel; after: PermissionLevel }[] {
  return Object.entries(requested)
    .map(([permission, after]) => ({
      permission,
      before: current[permission]!,
      after,
    }))
    .filter(({ before, after }) => before !== after);
}

async function fetchPermissionForm(
  pageUrl: string,
  settingsPath: string,
  cookies: GitHubCookieJar,
): Promise<PermissionForm> {
  const response = await fetch(pageUrl, {
    headers: {
      Cookie: cookies.header(),
      "User-Agent": "gh2-cli",
      Accept: "text/html",
    },
    redirect: "manual",
  });
  cookies.capture(response.headers);
  if (response.status === 301 || response.status === 302 || response.status === 303) {
    throw new Error(
      "Got a redirect from GitHub — session cookie is likely stale. Run `gh2 app login` again.",
    );
  }
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} fetching ${pageUrl}. Check the slug/--org and that the captured account owns the app.`,
    );
  }
  const html = await response.text();
  if (/<title[^>]*>\s*Confirm access\s*<\/title>/i.test(html)) {
    throw new Error(
      `GitHub requires sudo authentication for ${pageUrl}. Complete it in the same Chromium browser profile, then run \`gh2 app login\` again.`,
    );
  }
  const form = parsePermissionForm(html, settingsPath);
  if (!form) {
    throw new Error(
      `Couldn't find the permissions form at ${pageUrl}. The captured account may need owner or sudo access.`,
    );
  }
  return form;
}

export const permissionsCommand = defineCommand({
  meta: {
    name: "permissions",
    description:
      "Inspect or update GitHub App permissions through the owner settings form (dry-run unless --yes)",
  },
  args: {
    slug: {
      type: "positional",
      description: "App slug (as shown by `gh2 app list`)",
      required: true,
    },
    org: {
      type: "string",
      description: "Org slug that owns the app. Omit for a personal app.",
    },
    set: {
      type: "string",
      description:
        "Permission assignments, comma-separated: actions=read,contents=read",
    },
    note: {
      type: "string",
      description: "Note shown to installations when they approve the permission change",
    },
    yes: {
      type: "boolean",
      description: "Submit the permission change. Without this flag, print a dry run.",
      default: false,
    },
    output: {
      type: "string",
      description: "Output format: json | table (default: table)",
      default: "table",
    },
  },
  async run({ args }) {
    const slug = String(args.slug);
    const settingsPath = args.org
      ? `/organizations/${args.org}/settings/apps/${slug}`
      : `/settings/apps/${slug}`;
    const pageUrl = `https://github.com${settingsPath}/permissions`;
    const auth = await loadAuth();
    const cookies = new GitHubCookieJar(auth.cookies);
    const requested = parsePermissionAssignments(args.set);
    const form = await fetchPermissionForm(pageUrl, settingsPath, cookies);

    for (const permission of Object.keys(requested)) {
      if (!(permission in form.permissions)) {
        throw new Error(
          `Unknown permission: ${permission}. It was not present in GitHub's live permissions form.`,
        );
      }
    }

    const changes = changedPermissions(form.permissions, requested);
    const selected = Object.fromEntries(
      Object.entries(form.permissions).filter(([, level]) => level !== "none"),
    );
    const result = {
      app: slug,
      owner: args.org ?? "personal",
      current: selected,
      changes,
      submitted: false,
    };

    if (!changes.length) {
      printOutput(result, getOutputFormat(args.output));
      return;
    }
    if (!args.yes) {
      printOutput(result, getOutputFormat(args.output));
      if (getOutputFormat(args.output) !== "json") {
        console.log("Dry run only. Re-run with --yes to submit these changes.");
      }
      return;
    }

    const body = buildPermissionBody(
      form,
      requested,
      args.note === undefined ? undefined : String(args.note),
    );

    const actionUrl = form.action.startsWith("http")
      ? form.action
      : `https://github.com${form.action}`;
    const response = await fetch(actionUrl, {
      method: "POST",
      headers: {
        Cookie: cookies.header(),
        "User-Agent": "gh2-cli",
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://github.com",
        Referer: pageUrl,
      },
      body: body.toString(),
      redirect: "manual",
    });
    cookies.capture(response.headers);
    if (response.status !== 302 && response.status !== 303) {
      throw new Error(
        `Permission update did not go through (HTTP ${response.status}, expected a redirect). No success was assumed.`,
      );
    }
    const location = response.headers.get("location") ?? "";
    if (location.includes("/sessions/sudo")) {
      throw new Error(
        `GitHub requires sudo authentication. Complete it at ${pageUrl}, capture the browser session again, and retry.`,
      );
    }

    const verified = await fetchPermissionForm(pageUrl, settingsPath, cookies);
    for (const [permission, level] of Object.entries(requested)) {
      if (verified.permissions[permission] !== level) {
        throw new Error(
          `GitHub returned a redirect, but verification failed: ${permission} is ${verified.permissions[permission]}, expected ${level}.`,
        );
      }
    }

    printOutput({ ...result, submitted: true }, getOutputFormat(args.output));
  },
});

export const __testing = {
  buildPermissionBody,
  parsePermissionForm,
  parsePermissionAssignments,
};
