import { describe, expect, it } from "vitest";
import {
  hasUsableSessionCookie,
  selectCookieSource,
  type GitHubCookieSource,
} from "../src/lib/cookie-source.ts";

function source(
  account: string | undefined,
  browser: string,
  profile: string,
): GitHubCookieSource {
  return {
    cookies: [{ name: "user_session", value: "s" }],
    browser,
    profile,
    source: `${browser} (${profile})`,
    account,
  };
}

const CHROME_DEFAULT = source("example-user", "Chrome", "Default");
const CHROME_WORK = source("work-admin", "Chrome", "Profile 1");
const ARC_DEFAULT = source("example-user", "Arc", "Default");

describe("browser session eligibility", () => {
  it("accepts session cookies without an explicit expiration", () => {
    expect(hasUsableSessionCookie(CHROME_DEFAULT.cookies, 100)).toBe(true);
  });

  it("rejects an expired session cookie", () => {
    expect(
      hasUsableSessionCookie(
        [{ name: "user_session", value: "expired", expires: 99 }],
        100,
      ),
    ).toBe(false);
  });

  it("accepts another unexpired GitHub session cookie", () => {
    expect(
      hasUsableSessionCookie(
        [
          { name: "user_session", value: "expired", expires: 99 },
          {
            name: "__Host-user_session_same_site",
            value: "valid",
            expires: 101,
          },
        ],
        100,
      ),
    ).toBe(true);
  });
});

describe("browser session selection", () => {
  it("uses the only signed-in profile without asking", () => {
    expect(selectCookieSource([CHROME_DEFAULT])).toBe(CHROME_DEFAULT);
  });

  it("refuses to guess between two GitHub accounts", () => {
    expect(() => selectCookieSource([CHROME_DEFAULT, CHROME_WORK])).toThrow(
      /Several browser profiles/,
    );
  });

  it("names each candidate account in the ambiguity error", () => {
    let message = "";
    try {
      selectCookieSource([CHROME_DEFAULT, CHROME_WORK]);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("@example-user");
    expect(message).toContain("@work-admin");
    expect(message).toContain('--source "Chrome (Profile 1)"');
  });

  it("resolves an ambiguous set by account", () => {
    expect(
      selectCookieSource([CHROME_DEFAULT, CHROME_WORK], {
        account: "work-admin",
      }),
    ).toBe(CHROME_WORK);
  });

  it("matches the account case-insensitively", () => {
    expect(
      selectCookieSource([CHROME_DEFAULT, CHROME_WORK], {
        account: "Work-Admin",
      }),
    ).toBe(CHROME_WORK);
  });

  it("resolves by browser profile", () => {
    expect(
      selectCookieSource([CHROME_DEFAULT, ARC_DEFAULT], {
        source: "Arc (Default)",
      }),
    ).toBe(ARC_DEFAULT);
  });

  it("still asks when one account is signed in on two browsers", () => {
    expect(() =>
      selectCookieSource([CHROME_DEFAULT, ARC_DEFAULT], {
        account: "example-user",
      }),
    ).toThrow(/Narrow it with --source/);
  });

  it("reports a filter that matches nothing", () => {
    expect(() =>
      selectCookieSource([CHROME_DEFAULT], { account: "nobody" }),
    ).toThrow(/No browser profile matched/);
  });

  it("explains an empty keystore", () => {
    expect(() => selectCookieSource([])).toThrow(/Could not find a GitHub session/);
  });
});
