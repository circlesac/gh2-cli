import { describe, expect, it } from "vitest";
import { __testing } from "../src/commands/app/permissions.ts";

const { buildPermissionBody, parsePermissionAssignments, parsePermissionForm } =
  __testing;

describe("parsePermissionForm", () => {
  const html = `
    <form action="/organizations/acme/settings/apps/my-bot/permissions" method="post">
      <input type="hidden" name="_method" value="put">
      <input type="hidden" name="authenticity_token" value="a&amp;b&#43;c">
      <input type="hidden" name="integration[default_permissions][metadata]" value="read">
      <input type="hidden" name="integration[default_permissions][actions]" value="none">
      <input type="hidden" name="integration[default_permissions][contents]" value="read">
      <input type="checkbox" name="integration[default_events][]" value="issues" checked>
      <input type="checkbox" name="integration[default_events][]" value="push">
      <textarea name="integration[note]">Existing &amp; preserved</textarea>
      <input type="submit" name="commit" value="Save changes">
    </form>`;

  it("captures permission values and every successful form field", () => {
    const form = parsePermissionForm(
      html,
      "/organizations/acme/settings/apps/my-bot",
    );
    expect(form).not.toBeNull();
    expect(form!.permissions).toEqual({
      metadata: "read",
      actions: "none",
      contents: "read",
    });
    expect(form!.fields).toContainEqual(["authenticity_token", "a&b+c"]);
    expect(form!.fields).toContainEqual([
      "integration[default_events][]",
      "issues",
    ]);
    expect(form!.fields).not.toContainEqual([
      "integration[default_events][]",
      "push",
    ]);
    expect(form!.fields).toContainEqual([
      "integration[note]",
      "Existing & preserved",
    ]);
  });

  it("changes only requested permissions and preserves selected events", () => {
    const form = parsePermissionForm(
      html,
      "/organizations/acme/settings/apps/my-bot",
    )!;
    const body = buildPermissionBody(form, { actions: "read" }, "Why this is needed");

    expect(body.get("integration[default_permissions][actions]")).toBe("read");
    expect(body.get("integration[default_permissions][contents]")).toBe("read");
    expect(body.getAll("integration[default_events][]")).toEqual(["issues"]);
    expect(body.get("integration[note]")).toBe("Why this is needed");
    expect(body.get("authenticity_token")).toBe("a&b+c");
  });

  it("reads action-menu permissions and materializes their hidden values", () => {
    const form = parsePermissionForm(
      `
        <form action="/organizations/acme/settings/apps/my-bot/permissions" method="post">
          <input type="hidden" name="authenticity_token" value="token">
          <input type="hidden" name="integration[default_permissions][actions]">
          <button type="button" role="menuitemradio" aria-checked="true" data-resource="actions" data-permission="none"></button>
          <button type="button" role="menuitemradio" aria-checked="false" data-resource="actions" data-permission="read"></button>
          <input type="hidden" name="integration[default_permissions][contents]">
          <button type="button" role="menuitemradio" aria-checked="false" data-resource="contents" data-permission="none"></button>
          <button type="button" role="menuitemradio" aria-checked="true" data-resource="contents" data-permission="read"></button>
          <template><input type="hidden" name="integration[single_file_paths][]"></template>
          <input type="submit" name="commit" value="Save changes" disabled>
        </form>
      `,
      "/organizations/acme/settings/apps/my-bot",
    )!;

    expect(form.permissions).toEqual({ actions: "none", contents: "read" });
    const body = buildPermissionBody(form, { actions: "read" });
    expect(body.get("integration[default_permissions][actions]")).toBe("read");
    expect(body.get("integration[default_permissions][contents]")).toBe("read");
    expect(body.has("integration[single_file_paths][]")).toBe(false);
    expect(body.get("commit")).toBe("Save changes");
  });

  it("ignores forms belonging to another app", () => {
    expect(
      parsePermissionForm(html, "/organizations/acme/settings/apps/other-bot"),
    ).toBeNull();
  });

  it("requires GitHub's authenticity token", () => {
    expect(
      parsePermissionForm(
        html.replace(/<input type="hidden" name="authenticity_token"[^>]+>/, ""),
        "/organizations/acme/settings/apps/my-bot",
      ),
    ).toBeNull();
  });
});

describe("parsePermissionAssignments", () => {
  it("parses comma-separated assignments", () => {
    expect(parsePermissionAssignments("actions=read, contents=write")).toEqual({
      actions: "read",
      contents: "write",
    });
  });

  it("accepts an empty request for inspection", () => {
    expect(parsePermissionAssignments(undefined)).toEqual({});
  });

  it("rejects invalid levels", () => {
    expect(() => parsePermissionAssignments("actions=admin")).toThrow(
      /Expected none, read, or write/,
    );
  });

  it("rejects duplicate permission assignments", () => {
    expect(() => parsePermissionAssignments("actions=read,actions=write")).toThrow(
      /assigned more than once/,
    );
  });
});
