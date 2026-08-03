import { describe, expect, it, vi } from "vitest";
import {
  acceptInstallationApproval,
  extractApprovalChanges,
  parseApprovalState,
  showInstallationApproval,
} from "../src/commands/install/approval.ts";
import { WebSettingsClient } from "../src/lib/web-settings.ts";

const approvalUrl = "https://github.com/organizations/example/settings/installations/42/permissions/update";
const detailUrl = "https://github.com/organizations/example/settings/installations/42";
const auth = {
  host: "github.com",
  cookies: [{ name: "user_session", value: "secret" }],
  capturedAt: "2026-08-03T00:00:00Z",
  account: "example-user",
};
const pendingHtml = `
  <ul><li>Contents: Read-only access</li><li>Issues: Read and write access</li></ul>
  <form action="/organizations/example/settings/installations/42/permissions/update" method="post">
    <input type="hidden" name="_method" value="put">
    <input type="hidden" name="authenticity_token" value="token">
    <input type="hidden" name="integration_fingerprint" value="opaque-fingerprint">
    <input type="hidden" name="version_id" value="9001">
  </form>
`;

function queuedFetch(responses: Response[]) {
  return vi.fn(async () => {
    const response = responses.shift();
    if (!response) throw new Error("unexpected fetch");
    return response;
  }) as typeof fetch;
}

describe("installation approval parsing", () => {
  it("extracts a pending form and readable permission changes", () => {
    const state = parseApprovalState(
      { url: approvalUrl, status: 200, html: pendingHtml },
      { id: "42", org: "example" },
    );
    expect(state.form?.method).toBe("PUT");
    expect(state.changes).toEqual([
      "Contents: Read-only access",
      "Issues: Read and write access",
    ]);
  });

  it("deduplicates structured and visible permission descriptions", () => {
    expect(
      extractApprovalChanges(`
        <div data-permission-name="contents" data-permission-level="read"></div>
        <div data-permission-name="contents" data-permission-level="read"></div>
      `),
    ).toEqual(["contents: read"]);
  });
});

describe("installation approval commands", () => {
  it("shows when no approval is pending", async () => {
    const client = new WebSettingsClient(auth, queuedFetch([new Response("<p>No changes</p>", { status: 200 })]));
    const result = await showInstallationApproval(client, { id: "42", org: "example" });
    expect(result.pending).toBe(false);
    expect(result.verified).toBe(true);
  });

  it("treats an approval-page 404 as no pending change when the detail page is healthy", async () => {
    const client = new WebSettingsClient(
      auth,
      queuedFetch([
        new Response("not found", { status: 404 }),
        new Response("<p>Installation active</p>", { status: 200 }),
      ]),
    );
    const result = await showInstallationApproval(client, { id: "42", org: "example" });
    expect(result).toMatchObject({ pending: false, verified: true });
  });

  it("submits live opaque fields and verifies both pages", async () => {
    const fetchImpl = queuedFetch([
      new Response(pendingHtml, { status: 200 }),
      new Response(null, { status: 302, headers: { location: detailUrl } }),
      new Response("<p>Approved</p>", { status: 200 }),
      new Response("<p>Installation active</p>", { status: 200 }),
    ]);
    const result = await acceptInstallationApproval(
      new WebSettingsClient(auth, fetchImpl),
      { id: "42", org: "example" },
      true,
    );
    expect(result).toMatchObject({ pending: false, verified: true });
    expect(JSON.stringify(result)).not.toContain("opaque-fingerprint");
    expect(JSON.stringify(result)).not.toContain("9001");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      approvalUrl,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("integration_fingerprint=opaque-fingerprint"),
      }),
    );
  });

  it("keeps accept dry-run read-only and hides opaque form values", async () => {
    const fetchImpl = queuedFetch([new Response(pendingHtml, { status: 200 })]);
    const result = await acceptInstallationApproval(
      new WebSettingsClient(auth, fetchImpl),
      { id: "42", org: "example" },
      false,
    );
    expect(result.mode).toBe("dry-run");
    expect(JSON.stringify(result)).not.toContain("opaque-fingerprint");
    expect(JSON.stringify(result)).not.toContain("9001");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("distinguishes no pending approval", async () => {
    const client = new WebSettingsClient(auth, queuedFetch([new Response("<p>No changes</p>", { status: 200 })]));
    await expect(
      acceptInstallationApproval(client, { id: "42", org: "example" }, true),
    ).rejects.toMatchObject({ code: "no_pending_approval" });
  });

  it("does not trust a redirect when readback still shows approval", async () => {
    const fetchImpl = queuedFetch([
      new Response(pendingHtml, { status: 200 }),
      new Response(null, { status: 302, headers: { location: detailUrl } }),
      new Response(pendingHtml, { status: 200 }),
      new Response(`<a href="${approvalUrl}">Review</a>`, { status: 200 }),
    ]);
    await expect(
      acceptInstallationApproval(
        new WebSettingsClient(auth, fetchImpl),
        { id: "42", org: "example" },
        true,
      ),
    ).rejects.toMatchObject({ code: "verification_failed" });
  });
});
