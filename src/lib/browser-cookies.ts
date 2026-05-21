/**
 * Read GitHub session cookies (user_session, _gh_sess, dotcom_user) from any
 * Chromium-based browser's cookie database. macOS only — uses Keychain to
 * decrypt the encrypted_value blob.
 *
 * Supported: Chrome, Arc, Edge, Brave, Chromium, Comet
 */

import { Database } from "bun:sqlite";
import { existsSync, copyFileSync, unlinkSync, readdirSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createDecipheriv, pbkdf2Sync } from "node:crypto";

interface BrowserConfig {
  name: string;
  keychainService: string;
  userDataDir: string;
}

const BROWSERS: BrowserConfig[] = [
  {
    name: "Chrome",
    keychainService: "Chrome Safe Storage",
    userDataDir: join(homedir(), "Library", "Application Support", "Google", "Chrome"),
  },
  {
    name: "Arc",
    keychainService: "Arc Safe Storage",
    userDataDir: join(homedir(), "Library", "Application Support", "Arc", "User Data"),
  },
  {
    name: "Edge",
    keychainService: "Microsoft Edge Safe Storage",
    userDataDir: join(homedir(), "Library", "Application Support", "Microsoft Edge"),
  },
  {
    name: "Brave",
    keychainService: "Brave Safe Storage",
    userDataDir: join(homedir(), "Library", "Application Support", "BraveSoftware", "Brave-Browser"),
  },
  {
    name: "Chromium",
    keychainService: "Chromium Safe Storage",
    userDataDir: join(homedir(), "Library", "Application Support", "Chromium"),
  },
  {
    name: "Comet",
    keychainService: "Comet Safe Storage",
    userDataDir: join(homedir(), "Library", "Application Support", "Comet"),
  },
];

const COOKIE_NAMES = ["user_session", "__Host-user_session_same_site", "_gh_sess", "dotcom_user", "logged_in"];

function findCookieDbs(userDataDir: string): string[] {
  if (!existsSync(userDataDir)) return [];
  const dbs: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(userDataDir);
  } catch {
    return [];
  }
  for (const entry of entries) {
    if (entry !== "Default" && !entry.startsWith("Profile ")) continue;
    const dir = join(userDataDir, entry);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const rel of [["Cookies"], ["Network", "Cookies"]]) {
      const path = join(dir, ...rel);
      if (existsSync(path)) {
        dbs.push(path);
        break;
      }
    }
  }
  return dbs;
}

function getKeychainKey(browser: BrowserConfig): Buffer {
  const output = execSync(
    `security find-generic-password -s "${browser.keychainService}" -g 2>&1`,
    { encoding: "utf-8" },
  );
  const match = output.match(/password:\s*"([^"]+)"/);
  if (!match?.[1]) {
    throw new Error(`Could not parse ${browser.keychainService} keychain password`);
  }
  return pbkdf2Sync(match[1], "saltysalt", 1003, 16, "sha1");
}

function decryptCookie(encrypted: Buffer, key: Buffer): string {
  if (!encrypted || encrypted.length === 0) return "";
  const prefix = encrypted.subarray(0, 3).toString("utf-8");
  if (prefix !== "v10") return encrypted.toString("utf-8");
  const payload = encrypted.subarray(3);
  const iv = Buffer.from(" ".repeat(16), "utf-8");
  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  const padByte = decrypted[decrypted.length - 1]!;
  let unpadded =
    padByte > 0 && padByte <= 16
      ? decrypted.subarray(0, decrypted.length - padByte)
      : decrypted;
  // Chrome 118+ prepends SHA-256(host_key) (32 bytes) before the plaintext value.
  // Detect heuristically: if the leading 32 bytes contain non-UTF8/non-printable
  // bytes but the remainder is valid printable text, strip the prefix.
  if (unpadded.length >= 32) {
    const head = unpadded.subarray(0, 32);
    const tail = unpadded.subarray(32);
    const headLooksBinary = head.some((b) => b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d);
    const tailLooksPrintable = tail.every((b) => b >= 0x20 && b < 0x7f);
    if (headLooksBinary && tailLooksPrintable && tail.length > 0) {
      unpadded = tail;
    }
  }
  return unpadded.toString("utf-8");
}

interface CookieRow {
  name: string;
  encrypted_value: Buffer;
  expires_utc: number;
}

interface ExtractedCookie {
  name: string;
  value: string;
  expires?: number;
}

function readGitHubCookiesFromDb(
  cookiesPath: string,
  browser: BrowserConfig,
): ExtractedCookie[] | null {
  const tmpDb = join(tmpdir(), `gh2-cookies-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  copyFileSync(cookiesPath, tmpDb);
  try {
    const db = new Database(tmpDb, { readonly: true });
    const placeholders = COOKIE_NAMES.map(() => "?").join(",");
    const rows = db
      .query<CookieRow, string[]>(
        `SELECT name, encrypted_value, expires_utc FROM cookies
         WHERE host_key IN ('.github.com', 'github.com') AND name IN (${placeholders})`,
      )
      .all(...COOKIE_NAMES);
    db.close();
    if (!rows.length) return null;
    const key = getKeychainKey(browser);
    const cookies: ExtractedCookie[] = [];
    for (const row of rows) {
      const value = decryptCookie(Buffer.from(row.encrypted_value), key);
      if (!value) continue;
      // Chromium expires_utc is microseconds since 1601-01-01; convert to unix seconds
      const expires =
        row.expires_utc > 0
          ? Math.floor(row.expires_utc / 1_000_000 - 11_644_473_600)
          : undefined;
      cookies.push({ name: row.name, value, expires });
    }
    return cookies.length ? cookies : null;
  } catch {
    return null;
  } finally {
    try { unlinkSync(tmpDb); } catch {}
  }
}

export async function readGitHubCookies(): Promise<{
  cookies: ExtractedCookie[];
  source: string;
} | null> {
  if (process.platform !== "darwin") return null;
  for (const browser of BROWSERS) {
    const dbs = findCookieDbs(browser.userDataDir);
    for (const db of dbs) {
      const cookies = readGitHubCookiesFromDb(db, browser);
      if (cookies && cookies.some((c) => c.name === "user_session" || c.name === "__Host-user_session_same_site")) {
        const parts = db.split("/");
        const profile = parts.slice(-3, -1).join("/").includes("Network")
          ? parts.slice(-3, -2)[0]
          : parts.slice(-2, -1)[0];
        return { cookies, source: `${browser.name} (${profile})` };
      }
    }
  }
  return null;
}
