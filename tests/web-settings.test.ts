import { describe, expect, it, vi } from "vitest";
import {
  WebSettingsClient,
  WebSettingsError,
  findHtmlForm,
  formBody,
  parseHtmlForms,
  replaceFormField,
} from "../src/lib/web-settings.ts";

const PAGE_URL = "https://github.com/organizations/example/settings/policy";

describe("parseHtmlForms", () => {
  it("preserves duplicate successful fields and effective Rails methods", () => {
    const forms = parseHtmlForms(
      `
        <form action="/organizations/example/settings/policy" method="post">
          <input type="hidden" name="_method" value="patch">
          <input type="hidden" name="authenticity_token" value="a&amp;b">
          <input type="hidden" name="flag" value="0">
          <input type="checkbox" name="flag" value="1" checked>
          <input type="checkbox" name="ignored" value="1">
          <input type="text" name="disabled_value" value="x" disabled>
          <select name="mode"><option value="a">A</option><option value="b" selected>B</option></select>
          <select name="items[]" multiple><option value="1" selected>One</option><option value="2" selected>Two</option></select>
          <textarea name="note">hello &amp; goodbye</textarea>
          <template><input type="hidden" name="template_only" value="ignored"></template>
          <button type="submit" name="commit" value="Save">Save</button>
        </form>
      `,
      PAGE_URL,
    );
    expect(forms).toHaveLength(1);
    expect(forms[0]?.method).toBe("PATCH");
    expect(forms[0]?.htmlMethod).toBe("POST");
    expect(forms[0]?.fields).toEqual([
      ["_method", "patch"],
      ["authenticity_token", "a&b"],
      ["flag", "0"],
      ["flag", "1"],
      ["mode", "b"],
      ["items[]", "1"],
      ["items[]", "2"],
      ["note", "hello & goodbye"],
    ]);
    expect(forms[0]?.controls.find((item) => item.name === "disabled_value")?.disabled).toBe(true);
  });

  it("decodes an absolute action but refuses a cross-origin action", () => {
    expect(
      parseHtmlForms(
        `<form action="https://github.com/settings/apps/x/key" method="post"></form>`,
        PAGE_URL,
      )[0]?.action,
    ).toBe("/settings/apps/x/key");
    expect(() =>
      parseHtmlForms(
        `<form action="https://example.com/steal" method="post"></form>`,
        PAGE_URL,
      ),
    ).toThrow(WebSettingsError);
  });
});

describe("findHtmlForm", () => {
  const page = {
    url: PAGE_URL,
    status: 200,
    html: `
      <form action="/organizations/example/settings/policy" method="post">
        <input type="hidden" name="_method" value="patch">
        <input type="hidden" name="authenticity_token" value="token">
        <input type="radio" name="organization[policy]" value="disable">
        <input type="radio" name="organization[policy]" value="enable" checked>
      </form>
    `,
  };

  it("matches exact action/method and validates required fields", () => {
    const form = findHtmlForm(page, {
      action: "/organizations/example/settings/policy",
      method: "PATCH",
      requiredFields: ["authenticity_token", "organization[policy]"],
      expectedWritableFields: ["organization[policy]"],
    });
    expect(form.method).toBe("PATCH");
  });

  it("fails closed for a new writable field", () => {
    let error: unknown;
    try {
      findHtmlForm(
        { ...page, html: page.html.replace("</form>", '<input name="new_setting"></form>') },
        {
          action: "/organizations/example/settings/policy",
          method: "PATCH",
          expectedWritableFields: ["organization[policy]"],
        },
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: "form_schema_changed" });
  });

  it("accepts equivalent duplicate forms only when explicitly allowed", () => {
    const duplicatePage = {
      ...page,
      html: `${page.html}${page.html.replace('value="token"', 'value="new-token"')}`,
    };
    expect(
      findHtmlForm(duplicatePage, {
        action: "/organizations/example/settings/policy",
        method: "PATCH",
        requiredFields: ["authenticity_token"],
        expectedWritableFields: ["organization[policy]"],
        allowEquivalentMatches: true,
      }),
    ).toBeDefined();
  });

  it("keeps divergent duplicate forms ambiguous", () => {
    const divergentPage = {
      ...page,
      html: `${page.html}${page.html.replace('value="enable" checked', 'value="other" checked')}`,
    };
    expect(() =>
      findHtmlForm(divergentPage, {
        action: "/organizations/example/settings/policy",
        method: "PATCH",
        allowEquivalentMatches: true,
      }),
    ).toThrow(WebSettingsError);
  });

  it("classifies an upgrade shell instead of claiming the form is absent", () => {
    let error: unknown;
    try {
      findHtmlForm(
        { ...page, html: "<h1>Upgrade your organization to use this feature</h1>" },
        { action: "/missing", method: "POST" },
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: "upgrade_required" });
  });

  it("classifies a disabled capability separately", () => {
    let error: unknown;
    try {
      findHtmlForm(
        { ...page, html: "<p>This feature is disabled for this organization.</p>" },
        { action: "/missing", method: "POST" },
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: "capability_unavailable" });
  });
});

describe("form bodies", () => {
  it("replaces all duplicate values without losing unrelated fields", () => {
    const form = parseHtmlForms(
      `<form action="/x" method="post"><input name="a" value="1"><input name="a" value="2"><input name="b" value="3"></form>`,
      PAGE_URL,
    )[0]!;
    const body = formBody(form);
    replaceFormField(body, "a", ["4", "5"]);
    expect([...body.entries()]).toEqual([
      ["b", "3"],
      ["a", "4"],
      ["a", "5"],
    ]);
  });
});

describe("WebSettingsClient", () => {
  const auth = {
    host: "github.com",
    cookies: [{ name: "user_session", value: "secret" }],
    capturedAt: "2026-08-03T00:00:00Z",
    account: "example-user",
  };

  it("detects a sudo redirect", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: "/sessions/sudo" },
      }),
    ) as typeof fetch;
    await expect(new WebSettingsClient(auth, fetchImpl).get(PAGE_URL)).rejects.toMatchObject({
      code: "sudo_required",
    });
  });

  it("detects a sign-in page returned with HTTP 200", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('<form action="/session"><input name="login"></form>', { status: 200 }),
    ) as typeof fetch;
    await expect(new WebSettingsClient(auth, fetchImpl).get(PAGE_URL)).rejects.toMatchObject({
      code: "session_expired",
    });
  });

  it("submits the browser method and preserves the Rails override", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: PAGE_URL } })) as typeof fetch;
    const client = new WebSettingsClient(auth, fetchImpl);
    const page = {
      url: PAGE_URL,
      status: 200,
      html: `<form action="/organizations/example/settings/policy" method="post"><input type="hidden" name="_method" value="patch"><input type="hidden" name="authenticity_token" value="token"></form>`,
    };
    const form = findHtmlForm(page, {
      action: "/organizations/example/settings/policy",
      method: "PATCH",
    });
    await client.submit(page, form, formBody(form));
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://github.com/organizations/example/settings/policy",
      expect.objectContaining({ method: "POST", body: "_method=patch&authenticity_token=token" }),
    );
  });

  it("uses a rotated GitHub session cookie on the next request", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          `<form action="/organizations/example/settings/policy" method="post"><input type="hidden" name="_method" value="patch"></form>`,
          { status: 200, headers: { "set-cookie": "_gh_sess=rotated; Path=/; HttpOnly" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: PAGE_URL } }),
      ) as typeof fetch;
    const client = new WebSettingsClient(auth, fetchImpl);
    const page = await client.get(PAGE_URL);
    const form = findHtmlForm(page, {
      action: "/organizations/example/settings/policy",
      method: "PATCH",
    });

    await client.submit(page, form, formBody(form));

    expect(fetchImpl.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: expect.stringContaining("_gh_sess=rotated"),
        }),
      }),
    );
  });

  it("detects a sudo page returned with HTTP 200 after submission", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("<title>Confirm access</title>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    ) as typeof fetch;
    const client = new WebSettingsClient(auth, fetchImpl);
    const page = {
      url: PAGE_URL,
      status: 200,
      html: `<form action="/organizations/example/settings/policy" method="post"><input type="hidden" name="_method" value="patch"></form>`,
    };
    const form = findHtmlForm(page, {
      action: "/organizations/example/settings/policy",
      method: "PATCH",
    });

    await expect(client.submit(page, form, formBody(form))).rejects.toMatchObject({
      code: "sudo_required",
    });
  });
});
