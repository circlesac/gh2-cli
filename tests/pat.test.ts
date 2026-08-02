import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __testing } from "../src/commands/pat/create.ts";

const {
  assertAccountMatches,
  buildPatBody,
  extractPatToken,
  parseConfirmationForm,
  parseOwnerOptions,
  parsePatForm,
  parsePermissionAssignments,
  parsePermissionDefinitions,
  parseRepositoryOptions,
  parseRepositorySelection,
  prepareTokenSink,
  submitPatForm,
  validateExpiration,
} = __testing;

const PAT_FORM_HTML = `
  <html>
    <head><meta name="user-login" content="melten-admin"></head>
    <body>
      <form id="new_user_programmatic_access" action="/settings/personal-access-tokens" method="post">
        <input type="hidden" name="authenticity_token" value="a&amp;b">
        <input type="text" name="user_programmatic_access[name]" value="Priority reconciler">
        <input type="hidden" name="target_name" value="melten-ai">
        <template>
          <input type="hidden" name="user_programmatic_access[default_expires_at]" value="30">
        </template>
        <input type="hidden" name="user_programmatic_access[default_expires_at]" value="custom">
        <input type="date" name="user_programmatic_access[custom_expires_at]" value="2026-09-01">
        <textarea name="user_programmatic_access[description]">Policy automation</textarea>
        <include-fragment src="/settings/personal-access-tokens/select-access?target_name=melten-ai&amp;issues=write"></include-fragment>
      </form>
    </body>
  </html>`;

const ACCESS_HTML = `
  <textarea name="reason">Needed for issue reconciliation</textarea>
  <input type="radio" name="install_target" value="none" checked>
  <input type="radio" name="install_target" value="all">
  <input type="radio" name="install_target" value="selected">
  <input type="hidden" name="integration[default_permissions][issues]" value="write">
  <input type="hidden" name="integration[default_permissions][metadata]" value="read">
  <input type="hidden" name="integration[default_permissions][contents]" value="none">
  <remote-input src="/settings/personal-access-tokens/suggestions?target_name=melten-ai&amp;experimental=1"></remote-input>
  <script type="application/json" data-target="react-partial.embeddedData">${JSON.stringify(
    {
      props: {
        resources: {
          repository: [
            { name: "issues", metadata: { fgp: ["Read-only", "Read and write"] } },
            { name: "metadata", metadata: { fgp: ["Read-only"] } },
            { name: "contents", metadata: { fgp: ["Read-only", "Read and write"] } },
          ],
          organization: [
            { name: "organization_projects", metadata: { fgp: ["Read-only", "Read and write", "Admin"] } },
          ],
        },
      },
    },
  )}</script>`;

const OWNER_HTML = `
  <li data-actor-is-organization="false" data-fg-limit-exempt="true">
    <button data-value="melten-admin">melten-admin</button>
  </li>
  <li data-actor-is-organization="true" data-fg-limit="366" data-fg-limit-label="366 days" data-fg-limit-exempt="false">
    <button data-value="melten-ai">melten-ai</button>
  </li>`;

const REPOSITORY_HTML = `
  <li>
    <button data-value="1245612113">melten-ai/silicon-workbench</button>
    <input type="hidden" name="repository_ids[]" value="1245612113">
    <span class="owner css-truncate-target">melten-ai</span>/<span class="repo">silicon-workbench</span>
  </li>
  <li>
    <button data-value="1263434240">melten-ai/pcie_gen4_pipe_axis_tl</button>
    <input type="hidden" name="repository_ids[]" value="1263434240">
    <span class="owner">melten-ai</span>/<span class="repo css-truncate-target">pcie_gen4_pipe_axis_tl</span>
  </li>`;

describe("fine-grained PAT form parsing", () => {
  it("reads the authenticated account and active form fields", () => {
    const form = parsePatForm(PAT_FORM_HTML);
    expect(form).not.toBeNull();
    expect(form!.account).toBe("melten-admin");
    expect(form!.action).toBe("/settings/personal-access-tokens");
    expect(form!.accessPath).toBe(
      "/settings/personal-access-tokens/select-access?target_name=melten-ai&issues=write",
    );
    expect(form!.fields).toContainEqual(["authenticity_token", "a&b"]);
    expect(
      form!.fields.filter(
        ([name]) => name === "user_programmatic_access[default_expires_at]",
      ),
    ).toEqual([["user_programmatic_access[default_expires_at]", "custom"]]);
  });

  it("fails safely when the captured account differs", () => {
    expect(() => assertAccountMatches("ygpark80", "melten-admin")).toThrow(
      /belongs to ygpark80, not melten-admin/,
    );
    expect(() => assertAccountMatches("Melten-Admin", "melten-admin")).not.toThrow();
  });

  it("reads owner expiration policy from the live selector", () => {
    expect(parseOwnerOptions(OWNER_HTML)).toEqual([
      {
        login: "melten-admin",
        organization: false,
        expirationExempt: true,
        maxExpirationDays: undefined,
        maxExpirationLabel: undefined,
      },
      {
        login: "melten-ai",
        organization: true,
        expirationExempt: false,
        maxExpirationDays: 366,
        maxExpirationLabel: "366 days",
      },
    ]);
  });

  it("reads live repository IDs without accepting other owners", () => {
    expect(parseRepositoryOptions(REPOSITORY_HTML)).toEqual([
      { id: "1245612113", owner: "melten-ai", name: "silicon-workbench" },
      {
        id: "1263434240",
        owner: "melten-ai",
        name: "pcie_gen4_pipe_axis_tl",
      },
    ]);
  });

  it("reads the allowed levels for each live permission", () => {
    expect(parsePermissionDefinitions(ACCESS_HTML)).toEqual({
      issues: { scope: "repository", levels: ["read", "write"] },
      metadata: { scope: "repository", levels: ["read"] },
      contents: { scope: "repository", levels: ["read", "write"] },
      organization_projects: {
        scope: "organization",
        levels: ["read", "write", "admin"],
      },
    });
  });
});

describe("fine-grained PAT request validation", () => {
  const organization = parseOwnerOptions(OWNER_HTML)[1]!;

  it("adds mandatory metadata read permission", () => {
    expect(parsePermissionAssignments("issues=write")).toEqual({
      issues: "write",
      metadata: "read",
    });
  });

  it("rejects unsupported levels and metadata write", () => {
    expect(parsePermissionAssignments("organization_projects=admin")).toEqual({
      organization_projects: "admin",
      metadata: "read",
    });
    expect(() => parsePermissionAssignments("issues=owner")).toThrow(
      /Expected read, write, or admin/,
    );
    expect(() => parsePermissionAssignments("metadata=write")).toThrow(
      /only supports read/,
    );
  });

  it("normalizes selected repositories and validates their owner", () => {
    expect(
      parseRepositorySelection(
        "silicon-workbench,melten-ai/pcie_gen4_pipe_axis_tl",
        "melten-ai",
      ),
    ).toEqual({
      mode: "selected",
      names: ["silicon-workbench", "pcie_gen4_pipe_axis_tl"],
    });
    expect(() =>
      parseRepositorySelection("other/repo", "melten-ai"),
    ).toThrow(/does not belong/);
  });

  it("enforces the live owner expiration limit", () => {
    expect(validateExpiration("30", organization)).toBe("30");
    expect(() => validateExpiration("none", organization)).toThrow(
      /requires an expiration/,
    );
    expect(() => validateExpiration("367", organization)).toThrow(/1 and 366/);
  });

  it("builds a selected-repository body from validated live IDs", () => {
    const form = parsePatForm(PAT_FORM_HTML)!;
    const body = buildPatBody(form, ACCESS_HTML, {
      name: "Priority reconciler",
      description: "Policy automation",
      reason: "Needed for issue reconciliation",
      owner: "melten-ai",
      repositories: {
        mode: "selected",
        names: ["silicon-workbench", "pcie_gen4_pipe_axis_tl"],
      },
      repositoryOptions: parseRepositoryOptions(REPOSITORY_HTML),
      permissions: { issues: "write", metadata: "read" },
    });
    expect(body.get("install_target")).toBe("selected");
    expect(body.getAll("repository_ids[]")).toEqual([
      "1245612113",
      "1263434240",
    ]);
    expect(body.get("integration[default_permissions][issues]")).toBe("write");
    expect(body.get("integration[default_permissions][metadata]")).toBe("read");
    expect(body.get("integration[default_permissions][contents]")).toBe("none");
  });
});

describe("fine-grained PAT submission", () => {
  const token = `github_pat_${"a".repeat(60)}`;

  it("extracts only a full fine-grained PAT value", () => {
    expect(extractPatToken(`<input value="${token}">`)).toBe(token);
    expect(extractPatToken("github_pat_short")).toBeNull();
  });

  it("parses the confirmation form but not a validation form", () => {
    const confirmation = parseConfirmationForm(`
      <turbo-frame id="fg_pat_confirmation_dialog">
        <form action="/settings/personal-access-tokens/confirm" method="post">
          <input type="hidden" name="authenticity_token" value="confirm-token">
          <input type="hidden" name="request_id" value="42">
        </form>
      </turbo-frame>`);
    expect(confirmation).toEqual({
      action: "/settings/personal-access-tokens/confirm",
      fields: [
        ["authenticity_token", "confirm-token"],
        ["request_id", "42"],
      ],
    });
    expect(
      parseConfirmationForm(`
        <form id="new_user_programmatic_access" action="/settings/personal-access-tokens">
          <input name="authenticity_token" value="retry-token">
        </form>`),
    ).toBeNull();
  });

  it("submits the confirmation step and returns the one-time token", async () => {
    const calls: { url: string; body: string }[] = [];
    const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: String(init?.body ?? ""),
      });
      if (calls.length === 1) {
        return new Response(
          `<turbo-frame id="fg_pat_confirmation_dialog">
            <form action="/settings/personal-access-tokens/confirm">
              <input name="authenticity_token" value="confirm-token">
              <input name="request_id" value="42">
            </form>
          </turbo-frame>`,
          { status: 200 },
        );
      }
      return new Response(`<input id="new-access-token" value="${token}">`, {
        status: 200,
      });
    }) as typeof fetch;

    await expect(
      submitPatForm(
        {
          action: "/settings/personal-access-tokens",
          fields: [["authenticity_token", "initial-token"]],
        },
        new URLSearchParams({ authenticity_token: "initial-token" }),
        { Cookie: "session=secret", "User-Agent": "gh2-cli" },
        fakeFetch,
      ),
    ).resolves.toBe(token);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.body).toContain("request_id=42");
  });

  it("refuses captcha and sudo responses", async () => {
    const captchaFetch = (async () =>
      new Response('<div class="flash-error">Captcha required</div>', {
        status: 422,
      })) as typeof fetch;
    await expect(
      submitPatForm(
        { action: "/settings/personal-access-tokens", fields: [] },
        new URLSearchParams(),
        {},
        captchaFetch,
      ),
    ).rejects.toThrow(/captcha/i);

    const sudoFetch = (async () =>
      new Response(null, {
        status: 302,
        headers: { location: "/sessions/sudo" },
      })) as typeof fetch;
    await expect(
      submitPatForm(
        { action: "/settings/personal-access-tokens", fields: [] },
        new URLSearchParams(),
        {},
        sudoFetch,
      ),
    ).rejects.toThrow(/sudo authentication/i);
  });

  it("writes a token only to a new mode-0600 file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gh2-pat-test-"));
    const path = join(directory, "token.txt");
    try {
      const sink = await prepareTokenSink(path);
      await sink.write(token);
      expect(await readFile(path, "utf8")).toBe(`${token}\n`);
      expect((await stat(path)).mode & 0o777).toBe(0o600);

      const existing = join(directory, "existing.txt");
      await writeFile(existing, "keep");
      await expect(prepareTokenSink(existing)).rejects.toThrow();
      expect(await readFile(existing, "utf8")).toBe("keep");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
