import { describe, expect, it, vi } from "vitest";
import {
  listDeletedRepositories,
  parseDeletedRepositories,
  restoreRepository,
} from "../src/commands/repo/deleted.ts";
import { WebSettingsClient } from "../src/lib/web-settings.ts";

const auth = {
  host: "github.com",
  cookies: [{ name: "user_session", value: "secret" }],
  capturedAt: "2026-08-03T00:00:00Z",
  account: "example-user",
};
const personalUrl = "https://github.com/settings/deleted_repositories";
const orgUrl = "https://github.com/organizations/example-org/settings/deleted_repositories";

function restoreEntry(owner: string, repository: string, id: string, details = "Deleted 2 days ago") {
  return `
    <li data-repository-nwo="${owner}/${repository}">
      <a href="/${owner}/${repository}">${owner}/${repository}</a>
      <span>${details}</span>
      <form action="/settings/restore_repo/${id}" method="post">
        <input type="hidden" name="authenticity_token" value="token-${id}">
        <button type="submit">Restore</button>
      </form>
    </li>
  `;
}

function queuedFetch(responses: Response[]) {
  return vi.fn(async () => {
    const response = responses.shift();
    if (!response) throw new Error("unexpected fetch");
    return response;
  }) as typeof fetch;
}

describe("deleted repository parsing", () => {
  it("associates each restore form with its repository and metadata", () => {
    const rows = parseDeletedRepositories(
      {
        url: orgUrl,
        status: 200,
        html: `<ul>${restoreEntry("example-org", "one", "10")}${restoreEntry("example-org", "two", "11", "Restorable for 30 days")}</ul>`,
      },
      "example-org",
    );
    expect(rows.map(({ form: _form, ...row }) => row)).toEqual([
      { id: "10", name: "example-org/one", details: "Deleted 2 days ago" },
      { id: "11", name: "example-org/two", details: "Restorable for 30 days" },
    ]);
  });

  it("fails closed when a restore form has no repository identity", () => {
    let error: unknown;
    try {
      parseDeletedRepositories(
        {
          url: personalUrl,
          status: 200,
          html: `<form action="/settings/restore_repo/10" method="post"><input name="authenticity_token" value="x"></form>`,
        },
        "example-user",
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: "form_schema_changed" });
  });
});

describe("deleted repository commands", () => {
  it("lists personal deleted repositories using the captured account", async () => {
    const result = await listDeletedRepositories(
      new WebSettingsClient(
        auth,
        queuedFetch([new Response(restoreEntry("example-user", "sample", "10"), { status: 200 })]),
      ),
    );
    expect(result).toMatchObject({ scope: "personal", target: "example-user", verified: true });
    expect(result.repositories[0]).toMatchObject({ name: "example-user/sample", id: "10" });
  });

  it("restores one exact organization repository and verifies disappearance", async () => {
    const before = restoreEntry("example-org", "sample", "10");
    const fetchImpl = queuedFetch([
      new Response(before, { status: 200 }),
      new Response(null, { status: 302, headers: { location: orgUrl } }),
      new Response("<p>No deleted repositories</p>", { status: 200 }),
    ]);
    const result = await restoreRepository(
      new WebSettingsClient(auth, fetchImpl),
      "example-org/sample",
      true,
    );
    expect(result).toMatchObject({ repository: "example-org/sample", verified: true });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://github.com/settings/restore_repo/10",
      expect.objectContaining({ body: "authenticity_token=token-10" }),
    );
  });

  it("retries while the deleted repository list is eventually consistent", async () => {
    const before = restoreEntry("example-org", "sample", "10");
    const result = await restoreRepository(
      new WebSettingsClient(
        auth,
        queuedFetch([
          new Response(before, { status: 200 }),
          new Response(null, { status: 302, headers: { location: orgUrl } }),
          new Response(before, { status: 200 }),
          new Response("<p>No deleted repositories</p>", { status: 200 }),
        ]),
      ),
      "example-org/sample",
      true,
      { attempts: 2, delayMs: 0 },
    );

    expect(result).toMatchObject({ repository: "example-org/sample", verified: true });
  });

  it("verifies a restore job when GitHub returns HTTP 404 after accepting it", async () => {
    const before = restoreEntry("example-org", "sample", "10");
    const result = await restoreRepository(
      new WebSettingsClient(
        auth,
        queuedFetch([
          new Response(before, { status: 200 }),
          new Response("Queued", { status: 404 }),
          new Response("<p>No deleted repositories</p>", { status: 200 }),
        ]),
      ),
      "example-org/sample",
      true,
      { attempts: 1, delayMs: 0 },
    );

    expect(result).toMatchObject({ repository: "example-org/sample", verified: true });
  });

  it("keeps restore dry-run read-only and does not expose the authenticity token", async () => {
    const fetchImpl = queuedFetch([
      new Response(restoreEntry("example-org", "sample", "10"), { status: 200 }),
    ]);
    const result = await restoreRepository(
      new WebSettingsClient(auth, fetchImpl),
      "example-org/sample",
      false,
    );
    expect(result.mode).toBe("dry-run");
    expect(JSON.stringify(result)).not.toContain("token-10");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects ambiguous duplicate restore entries", async () => {
    const html = `${restoreEntry("example-org", "sample", "10")}${restoreEntry("example-org", "sample", "11")}`;
    await expect(
      restoreRepository(
        new WebSettingsClient(auth, queuedFetch([new Response(html, { status: 200 })])),
        "example-org/sample",
        true,
      ),
    ).rejects.toMatchObject({ code: "form_ambiguous" });
  });

  it("does not trust a redirect when the restore form remains", async () => {
    const before = restoreEntry("example-org", "sample", "10");
    await expect(
      restoreRepository(
        new WebSettingsClient(
          auth,
          queuedFetch([
            new Response(before, { status: 200 }),
            new Response(null, { status: 302, headers: { location: orgUrl } }),
            new Response(before, { status: 200 }),
          ]),
        ),
        "example-org/sample",
        true,
        { attempts: 1, delayMs: 0 },
      ),
    ).rejects.toMatchObject({ code: "verification_failed" });
  });
});
