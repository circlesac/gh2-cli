import { describe, expect, it } from "vitest";
import { __testing } from "../src/commands/app/delete.ts";

const { parseDeleteForm, confirmValueFromPattern } = __testing;

describe("parseDeleteForm", () => {
  it("splits hidden inputs from the text confirmation box", () => {
    const html = `
      <form action="/organizations/acme/settings/apps/my-bot/reset_token" method="post">
        <input type="hidden" name="authenticity_token" value="RESET_TOK">
      </form>
      <form action="/organizations/acme/settings/apps/my-bot" method="post">
        <input type="hidden" name="_method" value="delete">
        <input type="hidden" name="authenticity_token" value="DELETE_TOK">
        <input type="text" name="verify" pattern="[mM][yY]-[bB][oO][tT]">
      </form>
    `;
    const form = parseDeleteForm(html, "/organizations/acme/settings/apps/my-bot");
    expect(form).not.toBeNull();
    expect(form!.action).toBe("/organizations/acme/settings/apps/my-bot");
    expect(form!.fields).toEqual({ _method: "delete", authenticity_token: "DELETE_TOK" });
    expect(form!.confirm).toEqual([{ name: "verify", pattern: "[mM][yY]-[bB][oO][tT]" }]);
  });

  it("handles personal-app paths", () => {
    const html = `
      <form action="/settings/apps/solo" method="post">
        <input type="hidden" name="_method" value="delete" />
        <input type="hidden" name="authenticity_token" value="TOK" />
        <input type="text" name="verify" pattern="[sS][oO][lL][oO]" />
      </form>`;
    const form = parseDeleteForm(html, "/settings/apps/solo");
    expect(form!.fields.authenticity_token).toBe("TOK");
    expect(form!.confirm[0]?.name).toBe("verify");
  });

  it("decodes HTML entities in the token and action", () => {
    const html = `
      <form action="/settings/apps/x&amp;y" method="post">
        <input type="hidden" name="_method" value="delete">
        <input type="hidden" name="authenticity_token" value="a&amp;b&#43;c">
      </form>`;
    const form = parseDeleteForm(html, "/settings/apps/x&y");
    expect(form!.action).toBe("/settings/apps/x&y");
    expect(form!.fields.authenticity_token).toBe("a&b+c");
  });

  it("ignores a non-delete form on the same page", () => {
    const html = `
      <form action="/settings/apps/z/suspend" method="post">
        <input type="hidden" name="authenticity_token" value="S">
      </form>`;
    expect(parseDeleteForm(html, "/settings/apps/z")).toBeNull();
  });

  it("returns null when no delete form is present", () => {
    expect(parseDeleteForm("<html><body>nothing</body></html>", "/settings/apps/z")).toBeNull();
  });
});

describe("confirmValueFromPattern", () => {
  it("reconstructs the app name from a case-insensitive char-class pattern", () => {
    expect(
      confirmValueFromPattern("[cC][iI][rR][cC][lL][eE][sS][aA][cC]-[yY][gG]2"),
    ).toBe("circlesac-yg2");
  });

  it("keeps literal characters (digits, hyphens) as-is", () => {
    expect(confirmValueFromPattern("[aA]-1")).toBe("a-1");
  });
});
