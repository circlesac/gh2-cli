import { createSign } from "node:crypto";
import { GitHubApiError } from "./errors.ts";

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

export function createGitHubJwt(appId: number, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({ iss: appId, iat: now - 60, exp: now + 600 }),
  );
  const signingInput = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  sign.end();
  const signature = sign.sign(privateKeyPem, "base64url");
  return `${signingInput}.${signature}`;
}

export async function githubApi(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
): Promise<unknown> {
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { message?: string }).message ?? `HTTP ${res.status}`;
    throw new GitHubApiError(`GitHub API error: ${msg}`, res.status);
  }
  return data;
}

export interface GitHubAppInfo {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  permissions: Record<string, string>;
  events: string[];
  installations_count: number;
}

export async function getAppInfo(appId: number, privateKeyPem: string): Promise<GitHubAppInfo> {
  const jwt = createGitHubJwt(appId, privateKeyPem);
  return (await githubApi("https://api.github.com/app", {
    headers: { Authorization: `Bearer ${jwt}` },
  })) as GitHubAppInfo;
}

export interface ManifestConversionResult {
  id: number;
  slug: string;
  name: string;
  pem: string;
  webhook_secret: string;
  client_id: string;
  client_secret: string;
  html_url: string;
  owner: { login: string };
}

export async function exchangeManifestCode(code: string): Promise<ManifestConversionResult> {
  return (await githubApi(
    `https://api.github.com/app-manifests/${code}/conversions`,
    { method: "POST" },
  )) as ManifestConversionResult;
}

export async function configureWebhook(
  appId: number,
  privateKeyPem: string,
  webhookUrl: string,
  webhookSecret: string,
): Promise<void> {
  const jwt = createGitHubJwt(appId, privateKeyPem);
  // NOTE: `/app/hook/config` does NOT accept `active` (422 "not a permitted
  // key"). A webhook's active state can only be set in the create manifest, so
  // `app create` must register it `active: true` — see create.ts.
  await githubApi("https://api.github.com/app/hook/config", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: { url: webhookUrl, content_type: "json", secret: webhookSecret },
  });
}

export interface InstallationToken {
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
  repository_selection: string;
}

export async function createInstallationToken(
  appId: number,
  privateKeyPem: string,
  installationId: number,
): Promise<InstallationToken> {
  const jwt = createGitHubJwt(appId, privateKeyPem);
  return (await githubApi(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    { method: "POST", headers: { Authorization: `Bearer ${jwt}` } },
  )) as InstallationToken;
}
