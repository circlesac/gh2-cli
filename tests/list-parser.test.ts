import { describe, expect, it } from "vitest";
import { __testing } from "../src/commands/app/list.ts";

const { parseAppsListHtml } = __testing;

describe("parseAppsListHtml", () => {
  it("extracts personal apps from anchors pointing at /settings/apps/<slug>", () => {
    const html = `
      <html><body>
        <a href="/settings/apps/my-bot">my-bot</a>
        <a href="/settings/apps/another">Another Bot</a>
        <a href="/settings/apps/new">Create app</a>
      </body></html>
    `;
    const rows = parseAppsListHtml(html, undefined);
    expect(rows.map((r) => r.slug)).toEqual(["my-bot", "another"]);
    expect(rows[0]?.settings_url).toBe("https://github.com/settings/apps/my-bot");
  });

  it("extracts org apps from /organizations/<org>/settings/apps/<slug>", () => {
    const html = `
      <a href="/organizations/foo/settings/apps/bar">bar</a>
      <a href="/organizations/foo/settings/apps/baz"><span>Baz</span></a>
    `;
    const rows = parseAppsListHtml(html, "foo");
    expect(rows).toHaveLength(2);
    expect(rows[1]?.settings_url).toBe(
      "https://github.com/organizations/foo/settings/apps/baz",
    );
  });

  it("dedupes repeated anchors for the same slug", () => {
    const html = `
      <a href="/settings/apps/dup">dup</a>
      <a href="/settings/apps/dup">dup again</a>
    `;
    expect(parseAppsListHtml(html, undefined)).toHaveLength(1);
  });
});
