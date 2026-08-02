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
