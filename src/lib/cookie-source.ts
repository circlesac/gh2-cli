/**
 * Choosing between signed-in browser profiles. Kept free of `bun:sqlite` so it
 * stays importable from the node-based test runner.
 */

export interface ExtractedCookie {
  name: string;
  value: string;
  expires?: number;
}

export interface GitHubCookieSource {
  cookies: ExtractedCookie[];
  browser: string;
  profile: string;
  /** Display label, for example `Chrome (Default)`. */
  source: string;
  /** GitHub login from the `dotcom_user` cookie, when present. */
  account?: string;
}

export function hasUsableSessionCookie(
  cookies: ExtractedCookie[],
  now = Math.floor(Date.now() / 1000),
): boolean {
  return cookies.some(
    (cookie) =>
      (cookie.name === "user_session" ||
        cookie.name === "__Host-user_session_same_site") &&
      (cookie.expires === undefined || cookie.expires > now),
  );
}

function describe(sources: GitHubCookieSource[]): string {
  return sources
    .map(
      (candidate) =>
        `  ${candidate.account ? `@${candidate.account}` : "(unknown account)"} — --source "${candidate.source}"`,
    )
    .join("\n");
}

/**
 * Pick one session. With several signed-in profiles the first match is a coin
 * flip between GitHub accounts, and picking the wrong one silently acts as the
 * wrong identity — so an ambiguous capture is an error, not a default.
 */
export function selectCookieSource(
  sources: GitHubCookieSource[],
  filter: { account?: string; source?: string } = {},
): GitHubCookieSource {
  if (!sources.length) {
    throw new Error(
      "Could not find a GitHub session cookie.\n" +
        "  Make sure you are logged in to github.com in a Chromium-based browser (Chrome/Arc/Edge/Brave).",
    );
  }

  const matches = sources.filter(
    (candidate) =>
      (!filter.account ||
        candidate.account?.toLowerCase() === filter.account.toLowerCase()) &&
      (!filter.source ||
        candidate.source.toLowerCase() === filter.source.toLowerCase()),
  );

  if (matches.length === 1) return matches[0]!;
  if (!matches.length) {
    throw new Error(
      `No browser profile matched${filter.account ? ` --account ${filter.account}` : ""}${filter.source ? ` --source "${filter.source}"` : ""}.\n${describe(sources)}`,
    );
  }
  if (!filter.account && !filter.source) {
    throw new Error(
      `Several browser profiles are signed in to GitHub. Choose one with --account or --source.\n${describe(matches)}`,
    );
  }
  throw new Error(
    `That filter matched ${matches.length} browser profiles. Narrow it with --source.\n${describe(matches)}`,
  );
}
