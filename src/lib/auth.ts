import { existsSync, mkdirSync } from "node:fs";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const AUTH_DIR = join(homedir(), ".gh2");
export const AUTH_FILE = join(AUTH_DIR, "auth.json");

export interface StoredCookie {
  name: string;
  value: string;
  expires?: number;
}

export interface AuthFile {
  host: string;
  cookies: StoredCookie[];
  capturedAt: string;
  source?: string;
  /** GitHub login the cookies belong to, so a stale capture is visible. */
  account?: string;
}

export async function saveAuth(auth: AuthFile): Promise<void> {
  mkdirSync(dirname(AUTH_FILE), { recursive: true, mode: 0o700 });
  await chmod(dirname(AUTH_FILE), 0o700);
  await writeFile(AUTH_FILE, JSON.stringify(auth, null, 2) + "\n", {
    mode: 0o600,
  });
  await chmod(AUTH_FILE, 0o600);
}

export async function loadAuth(): Promise<AuthFile> {
  if (!existsSync(AUTH_FILE)) {
    throw new Error(
      `${AUTH_FILE} not found. Run "gh2 support login" or "gh2 app login" first to capture your GitHub session.`,
    );
  }
  const raw = await readFile(AUTH_FILE, "utf-8");
  return JSON.parse(raw) as AuthFile;
}

export function serializeCookies(cookies: StoredCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

export class GitHubCookieJar {
  private readonly cookies: Map<string, string>;

  constructor(cookies: StoredCookie[]) {
    this.cookies = new Map(cookies.map((cookie) => [cookie.name, cookie.value]));
  }

  header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  capture(headers: Headers): void {
    for (const value of headers.getSetCookie()) {
      const pair = value.split(";", 1)[0] ?? "";
      const separator = pair.indexOf("=");
      if (separator <= 0) continue;
      const name = pair.slice(0, separator);
      const cookieValue = pair.slice(separator + 1);
      if (cookieValue) this.cookies.set(name, cookieValue);
      else this.cookies.delete(name);
    }
  }
}
