import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, writeFile } from "node:fs/promises";
import { defineCommand } from "citty";
import { getOutputFormat, printOutput } from "../../lib/output.ts";
import {
  WebSettingsClient,
  WebSettingsError,
  findHtmlForm,
  formBody,
  loadWebSettingsClient,
  parseHtmlForms,
  type HtmlForm,
  type SettingsPage,
} from "../../lib/web-settings.ts";

export interface AppKeyEntry {
  id: string;
  fingerprint?: string;
}

interface AppKeyPage {
  page: SettingsPage;
  settingsPath: string;
  generationForm?: HtmlForm;
  deletionForms: Map<string, HtmlForm>;
  keys: AppKeyEntry[];
}

interface AppTarget {
  slug: string;
  org?: string;
}

interface KeyFingerprint {
  base64: string;
  display: string;
  hex: string;
}

interface GeneratedKey {
  id: string;
  fingerprint: KeyFingerprint;
  outputPath: string;
}

function requireNumericId(value: string, label: string): string {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a numeric GitHub identifier.`);
  return value;
}

function settingsPath(target: AppTarget): string {
  return target.org
    ? `/organizations/${target.org}/settings/apps/${target.slug}`
    : `/settings/apps/${target.slug}`;
}

function normalizedFingerprint(value: string): string {
  return value.replace(/^SHA256:/i, "").replace(/=+$/g, "").toLowerCase();
}

function pageFingerprints(html: string): string[] {
  const matches = [
    ...html.matchAll(/SHA256:([A-Za-z0-9+/]{32,}={0,2})/g),
    ...html.matchAll(/\b([a-f0-9]{64})\b/gi),
  ].map((match) => match[0]!);
  return [...new Set(matches)];
}

export function parseAppKeyPage(page: SettingsPage, target: AppTarget): AppKeyPage {
  const path = settingsPath(target);
  const forms = parseHtmlForms(page.html, page.url);
  const generationForm = forms.find(
    (form) => form.action === `${path}/key` && form.method === "POST",
  );
  const deletionForms = new Map<string, HtmlForm>();
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const deletePattern = new RegExp(`^${escaped}/key/(\\d+)$`);
  for (const form of forms) {
    const id = form.action.match(deletePattern)?.[1];
    if (!id || form.method !== "DELETE") continue;
    if (deletionForms.has(id)) {
      throw new WebSettingsError(
        "form_ambiguous",
        `Found duplicate delete forms for App key ${id} at ${page.url}.`,
        page.url,
      );
    }
    deletionForms.set(id, form);
  }
  const fingerprints = pageFingerprints(page.html);
  const ids = [...deletionForms.keys()];
  const keys = ids.map((id, index) => ({
    id,
    fingerprint: fingerprints.length === ids.length ? fingerprints[index] : undefined,
  }));
  return { page, settingsPath: path, generationForm, deletionForms, keys };
}

async function readAppKeyPage(
  client: WebSettingsClient,
  target: AppTarget,
): Promise<AppKeyPage> {
  const path = settingsPath(target);
  return parseAppKeyPage(await client.get(`https://github.com${path}`), target);
}

export function privateKeyFingerprint(pem: string): KeyFingerprint {
  if (!/^-----BEGIN RSA PRIVATE KEY-----\r?\n/.test(pem.trimStart())) {
    throw new WebSettingsError(
      "submission_rejected",
      "GitHub did not return a PKCS#1 RSA private key. The response was not written.",
    );
  }
  let publicDer: Buffer;
  try {
    const privateKey = createPrivateKey(pem);
    if (privateKey.asymmetricKeyType !== "rsa") throw new Error("not RSA");
    publicDer = createPublicKey(privateKey).export({ format: "der", type: "spki" }) as Buffer;
  } catch {
    throw new WebSettingsError(
      "submission_rejected",
      "GitHub returned an invalid RSA private key. The response was not written.",
    );
  }
  const digest = createHash("sha256").update(publicDer).digest();
  const base64 = digest.toString("base64");
  return {
    base64,
    display: `SHA256:${base64.replace(/=+$/g, "")}`,
    hex: digest.toString("hex"),
  };
}

function pageHasFingerprint(html: string, fingerprint: KeyFingerprint): boolean {
  const candidates = pageFingerprints(html).map(normalizedFingerprint);
  return [fingerprint.base64, fingerprint.display, fingerprint.hex]
    .map(normalizedFingerprint)
    .some((candidate) => candidates.includes(candidate));
}

async function writePrivateKey(path: string, pem: string): Promise<void> {
  if (existsSync(path)) throw new Error(`Refusing to overwrite existing key file: ${path}`);
  await writeFile(path, pem.endsWith("\n") ? pem : `${pem}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  await chmod(path, 0o600);
}

async function generateKey(
  client: WebSettingsClient,
  target: AppTarget,
  before: AppKeyPage,
  outputPath: string,
): Promise<GeneratedKey> {
  if (existsSync(outputPath)) throw new Error(`Refusing to overwrite existing key file: ${outputPath}`);
  if (!before.generationForm) {
    throw new WebSettingsError(
      "capability_unavailable",
      before.keys.length >= 25
        ? "The App already has 25 private keys. No key was deleted automatically."
        : `Couldn't find the private-key generation form at ${before.page.url}.`,
      before.page.url,
    );
  }
  const form = findHtmlForm(before.page, {
    action: `${before.settingsPath}/key`,
    method: "POST",
    requiredFields: ["authenticity_token"],
    expectedWritableFields: [],
    allowEquivalentMatches: true,
  });
  let response = await client.submit(before.page, form, formBody(form));
  response = await client.followSameOriginRedirect(response, before.page.url);
  if (!response.ok) {
    throw new WebSettingsError(
      "submission_rejected",
      `GitHub did not return a private key (HTTP ${response.status}).`,
      before.page.url,
    );
  }
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (
    contentType &&
    ![
      "application/octet-stream",
      "application/x-pem-file",
      "application/x-download",
      "text/plain",
    ].includes(contentType)
  ) {
    throw new WebSettingsError(
      "submission_rejected",
      `GitHub returned an unexpected private-key content type: ${contentType}. The response was not written.`,
      before.page.url,
    );
  }
  const pem = await response.text();
  const fingerprint = privateKeyFingerprint(pem);
  await writePrivateKey(outputPath, pem);

  const after = await readAppKeyPage(client, target);
  const previousIds = new Set(before.keys.map((key) => key.id));
  const newIds = after.keys.map((key) => key.id).filter((id) => !previousIds.has(id));
  if (newIds.length !== 1 || !pageHasFingerprint(after.page.html, fingerprint)) {
    throw new WebSettingsError(
      "verification_failed",
      `The private key was saved to ${outputPath}, but GitHub readback did not prove exactly one matching new key. No existing key was deleted.`,
      after.page.url,
      { newKeyCount: newIds.length, outputPath },
    );
  }
  return { id: newIds[0]!, fingerprint, outputPath };
}

async function deleteKey(
  client: WebSettingsClient,
  target: AppTarget,
  before: AppKeyPage,
  keyId: string,
): Promise<void> {
  const form = before.deletionForms.get(keyId);
  if (!form) {
    throw new WebSettingsError(
      "form_not_found",
      `App key ${keyId} is not present at ${before.page.url}.`,
      before.page.url,
    );
  }
  if (before.keys.length <= 1) {
    throw new WebSettingsError(
      "capability_unavailable",
      "Refusing to delete the App's only private key. Generate and verify a replacement first.",
      before.page.url,
    );
  }
  await client.submit(before.page, form, formBody(form));
  const after = await readAppKeyPage(client, target);
  if (after.deletionForms.has(keyId)) {
    throw new WebSettingsError(
      "verification_failed",
      `GitHub returned from the delete request, but App key ${keyId} is still present.`,
      after.page.url,
    );
  }
}

function targetResult(client: WebSettingsClient, target: AppTarget) {
  return {
    account: client.account ?? "unknown",
    scope: target.org ? "organization" : "personal",
    target: target.org ?? target.slug,
  };
}

export async function listAppKeys(client: WebSettingsClient, target: AppTarget) {
  const state = await readAppKeyPage(client, target);
  return {
    ...targetResult(client, target),
    operation: "app-key.list",
    mode: "read",
    sourcePage: new URL(state.page.url).pathname,
    method: "GET",
    changes: [],
    verified: true,
    app: target.slug,
    keys: state.keys,
    canGenerate: Boolean(state.generationForm),
  };
}

export async function generateAppKey(
  client: WebSettingsClient,
  target: AppTarget,
  outputPath: string,
  submit: boolean,
) {
  const before = await readAppKeyPage(client, target);
  if (existsSync(outputPath)) throw new Error(`Refusing to overwrite existing key file: ${outputPath}`);
  if (!before.generationForm) {
    throw new WebSettingsError(
      "capability_unavailable",
      `Couldn't find the private-key generation form at ${before.page.url}.`,
      before.page.url,
    );
  }
  const base = {
    ...targetResult(client, target),
    operation: "app-key.generate",
    mode: submit ? "submit" : "dry-run",
    sourcePage: new URL(before.page.url).pathname,
    method: "POST",
    changes: [{ field: "privateKey", current: "absent", desired: "generate" }],
    verified: false,
    app: target.slug,
    outputPath,
  };
  if (!submit) return base;
  const generated = await generateKey(client, target, before, outputPath);
  return {
    ...base,
    verified: true,
    key: { id: generated.id, fingerprint: generated.fingerprint.display },
  };
}

export async function deleteAppKey(
  client: WebSettingsClient,
  target: AppTarget,
  keyId: string,
  submit: boolean,
) {
  requireNumericId(keyId, "key-id");
  const before = await readAppKeyPage(client, target);
  if (!before.deletionForms.has(keyId)) {
    throw new WebSettingsError(
      "form_not_found",
      `App key ${keyId} is not present at ${before.page.url}.`,
      before.page.url,
    );
  }
  if (before.keys.length <= 1) {
    throw new WebSettingsError(
      "capability_unavailable",
      "Refusing to delete the App's only private key. Use `gh2 app key rotate`.",
      before.page.url,
    );
  }
  const base = {
    ...targetResult(client, target),
    operation: "app-key.delete",
    mode: submit ? "submit" : "dry-run",
    sourcePage: new URL(before.page.url).pathname,
    method: "DELETE",
    changes: [{ field: "key", current: keyId, desired: "absent" }],
    verified: false,
    app: target.slug,
    keyId,
  };
  if (!submit) return base;
  await deleteKey(client, target, before, keyId);
  return { ...base, verified: true };
}

export async function rotateAppKey(
  client: WebSettingsClient,
  target: AppTarget,
  oldKeyId: string,
  outputPath: string,
  submit: boolean,
) {
  requireNumericId(oldKeyId, "--delete-key");
  const before = await readAppKeyPage(client, target);
  if (!before.deletionForms.has(oldKeyId)) {
    throw new WebSettingsError(
      "form_not_found",
      `App key ${oldKeyId} is not present at ${before.page.url}.`,
      before.page.url,
    );
  }
  if (!before.generationForm) {
    throw new WebSettingsError(
      "capability_unavailable",
      `Couldn't find the private-key generation form at ${before.page.url}. No key was deleted.`,
      before.page.url,
    );
  }
  if (existsSync(outputPath)) throw new Error(`Refusing to overwrite existing key file: ${outputPath}`);
  const base = {
    ...targetResult(client, target),
    operation: "app-key.rotate",
    mode: submit ? "submit" : "dry-run",
    sourcePage: new URL(before.page.url).pathname,
    method: "POST+DELETE",
    changes: [
      { field: "privateKey", current: "absent", desired: "generate" },
      { field: "oldKey", current: oldKeyId, desired: "absent" },
    ],
    verified: false,
    app: target.slug,
    oldKeyId,
    outputPath,
  };
  if (!submit) return base;
  const generated = await generateKey(client, target, before, outputPath);
  const withNewKey = await readAppKeyPage(client, target);
  await deleteKey(client, target, withNewKey, oldKeyId);
  return {
    ...base,
    verified: true,
    newKey: { id: generated.id, fingerprint: generated.fingerprint.display },
  };
}

function appTarget(args: Record<string, unknown>): AppTarget {
  return {
    slug: String(args.app),
    org: args.org === undefined ? undefined : String(args.org),
  };
}

const listCommand = defineCommand({
  meta: { name: "list", description: "List GitHub App private keys" },
  args: {
    app: { type: "positional", description: "GitHub App slug", required: true },
    org: { type: "string", description: "Organization that owns the App" },
    output: { type: "string", description: "Output format: json | table", default: "table" },
  },
  async run({ args }) {
    printOutput(await listAppKeys(await loadWebSettingsClient(), appTarget(args)), getOutputFormat(args.output));
  },
});

const generateCommand = defineCommand({
  meta: { name: "generate", description: "Generate and save a GitHub App private key" },
  args: {
    app: { type: "positional", description: "GitHub App slug", required: true },
    org: { type: "string", description: "Organization that owns the App" },
    "key-output": { type: "string", description: "New file for the one-time private key", required: true },
    yes: { type: "boolean", description: "Generate the key; omit for a dry run", default: false },
    output: { type: "string", description: "Output format: json | table", default: "table" },
  },
  async run({ args }) {
    const result = await generateAppKey(
      await loadWebSettingsClient(),
      appTarget(args),
      String(args["key-output"]),
      Boolean(args.yes),
    );
    printOutput(result, getOutputFormat(args.output));
    if (!args.yes && getOutputFormat(args.output) !== "json") {
      console.log("Dry run only. Re-run with --yes to generate the key.");
    }
  },
});

const deleteCommand = defineCommand({
  meta: { name: "delete", description: "Delete one GitHub App private key" },
  args: {
    app: { type: "positional", description: "GitHub App slug", required: true },
    "key-id": { type: "positional", description: "Private-key ID", required: true },
    org: { type: "string", description: "Organization that owns the App" },
    yes: { type: "boolean", description: "Delete the key; omit for a dry run", default: false },
    output: { type: "string", description: "Output format: json | table", default: "table" },
  },
  async run({ args }) {
    const result = await deleteAppKey(
      await loadWebSettingsClient(),
      appTarget(args),
      String(args["key-id"]),
      Boolean(args.yes),
    );
    printOutput(result, getOutputFormat(args.output));
    if (!args.yes && getOutputFormat(args.output) !== "json") {
      console.log("Dry run only. Re-run with --yes to delete the key.");
    }
  },
});

const rotateCommand = defineCommand({
  meta: { name: "rotate", description: "Generate a verified key before deleting one specified old key" },
  args: {
    app: { type: "positional", description: "GitHub App slug", required: true },
    org: { type: "string", description: "Organization that owns the App" },
    "delete-key": { type: "string", description: "Exact old private-key ID to delete", required: true },
    "key-output": { type: "string", description: "New file for the one-time private key", required: true },
    yes: { type: "boolean", description: "Rotate the key; omit for a dry run", default: false },
    output: { type: "string", description: "Output format: json | table", default: "table" },
  },
  async run({ args }) {
    const result = await rotateAppKey(
      await loadWebSettingsClient(),
      appTarget(args),
      String(args["delete-key"]),
      String(args["key-output"]),
      Boolean(args.yes),
    );
    printOutput(result, getOutputFormat(args.output));
    if (!args.yes && getOutputFormat(args.output) !== "json") {
      console.log("Dry run only. Re-run with --yes to rotate the key.");
    }
  },
});

export const keyCommand = defineCommand({
  meta: { name: "key", description: "Manage GitHub App private keys" },
  subCommands: {
    list: listCommand,
    generate: generateCommand,
    delete: deleteCommand,
    rotate: rotateCommand,
  },
});
