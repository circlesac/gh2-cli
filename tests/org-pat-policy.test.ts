import { describe, expect, it, vi } from "vitest";
import {
  __testing,
  parsePatPolicyPage,
  showPatPolicy,
  updatePatPolicy,
} from "../src/commands/org/pat-policy.ts";
import { WebSettingsClient } from "../src/lib/web-settings.ts";

const pageUrl = "https://github.com/organizations/example/settings/personal-access-tokens";
const auth = {
  host: "github.com",
  cookies: [{ name: "user_session", value: "secret" }],
  capturedAt: "2026-08-03T00:00:00Z",
  account: "example-user",
};

interface FixturePolicy {
  access?: "enable" | "disable";
  requests?: "enable" | "disable";
  required?: boolean;
  lifetime?: string;
  custom?: string;
  inheritedExpiration?: boolean;
}

function policyPage({
  access = "disable",
  requests = "disable",
  required = false,
  lifetime = "7",
  custom = "",
  inheritedExpiration = false,
}: FixturePolicy = {}) {
  const option = (value: string) => `<option value="${value}"${lifetime === value ? " selected" : ""}>${value}</option>`;
  return `
    <form action="/organizations/example/settings/personal-access-tokens/restrict-access" method="post">
      <input type="hidden" name="_method" value="patch"><input type="hidden" name="authenticity_token" value="SECRET_AUTH_A">
      <input type="radio" name="organization[restrict_access]" value="disable"${access === "disable" ? " checked" : ""}>
      <input type="radio" name="organization[restrict_access]" value="enable"${access === "enable" ? " checked" : ""}>
      <input type="submit" name="commit" value="Save access">
    </form>
    <form action="/organizations/example/settings/personal-access-token-requests/auto-approve" method="post">
      <input type="hidden" name="_method" value="patch"><input type="hidden" name="authenticity_token" value="SECRET_AUTH_B">
      <input type="radio" name="organization[auto_approve]" value="disable"${requests === "disable" ? " checked" : ""}>
      <input type="radio" name="organization[auto_approve]" value="enable"${requests === "enable" ? " checked" : ""}>
      <input type="submit" name="commit" value="Save requests">
    </form>
    <form action="/organizations/example/settings/personal-access-tokens/maximum-lifetime" method="post">
      <input type="hidden" name="_method" value="patch"><input type="hidden" name="authenticity_token" value="SECRET_AUTH_C">
      <input type="hidden" name="organization[pat_type]" value="fine_grained">
      <input type="hidden" name="organization[require_pat_to_expire]" value="0"${inheritedExpiration ? " disabled" : ""}>
      <input type="checkbox" name="organization[require_pat_to_expire]" value="1"${required ? " checked" : ""}${inheritedExpiration ? " disabled" : ""}>
      <select name="organization[fine_grained_personal_access_token_expiration_limit]">
        ${option("7")}${option("30")}${option("60")}${option("90")}${option("366")}${option("custom")}
      </select>
      <input type="number" name="organization[custom_fine_grained_personal_access_token_expiration_limit]" value="${custom}" min="1" max="366">
      <input type="submit" name="commit" value="Save lifetime">
    </form>
  `;
}

function queuedFetch(responses: Response[]) {
  return vi.fn(async () => {
    const response = responses.shift();
    if (!response) throw new Error("unexpected fetch");
    return response;
  }) as typeof fetch;
}

describe("organization PAT policy parsing", () => {
  it("reads free-organization defaults", () => {
    const state = parsePatPolicyPage({ url: pageUrl, status: 200, html: policyPage() }, "example");
    expect(state.policies).toMatchObject({
      access: { value: "unrestricted", writable: true, source: "organization" },
      requests: { value: "manual", writable: true, source: "organization" },
      maximumLifetime: { value: "none", expirationRequirementWritable: true },
    });
  });

  it("marks an inherited expiration requirement but keeps lifetime selection writable", () => {
    const state = parsePatPolicyPage(
      { url: pageUrl, status: 200, html: policyPage({ required: true, lifetime: "366", inheritedExpiration: true }) },
      "example",
    );
    expect(state.policies.maximumLifetime).toMatchObject({
      value: 366,
      writable: true,
      source: "inherited",
      expirationRequirementWritable: false,
    });
  });

  it("reads a custom lifetime and live constraints", () => {
    const state = parsePatPolicyPage(
      { url: pageUrl, status: 200, html: policyPage({ required: true, lifetime: "custom", custom: "120" }) },
      "example",
    );
    expect(state.policies.maximumLifetime).toMatchObject({
      value: 120,
      customConstraints: { min: 1, max: 366, step: 1 },
    });
  });

  it("builds the required hidden+checkbox pair for expiration", () => {
    const state = parsePatPolicyPage({ url: pageUrl, status: 200, html: policyPage() }, "example");
    expect([
      ...__testing.lifetimeBody(state.forms.lifetime, 90).getAll(
        "organization[require_pat_to_expire]",
      ),
    ]).toEqual(["0", "1"]);
    expect(__testing.lifetimeBody(state.forms.lifetime, 90).get("commit")).toBe(
      "Save lifetime",
    );
  });
});

describe("organization PAT policy commands", () => {
  it("shows all policies without mutation", async () => {
    const result = await showPatPolicy(
      new WebSettingsClient(auth, queuedFetch([new Response(policyPage(), { status: 200 })])),
      "example",
    );
    expect(result).toMatchObject({ operation: "pat-policy.show", verified: true });
  });

  it("updates dependent policies before restricting access", async () => {
    const fetchImpl = queuedFetch([
      new Response(policyPage(), { status: 200 }),
      new Response(null, { status: 302, headers: { location: pageUrl } }),
      new Response(policyPage({ requests: "enable" }), { status: 200 }),
      new Response(null, { status: 302, headers: { location: pageUrl } }),
      new Response(policyPage({ requests: "enable", required: true, lifetime: "90" }), { status: 200 }),
      new Response(null, { status: 302, headers: { location: pageUrl } }),
      new Response(policyPage({ access: "enable", requests: "enable", required: true, lifetime: "90" }), { status: 200 }),
    ]);
    const result = await updatePatPolicy(
      new WebSettingsClient(auth, fetchImpl),
      "example",
      { access: "restricted", requests: "auto", maximumLifetime: 90 },
      true,
    );
    expect(result).toMatchObject({
      verified: true,
      applied: ["requests", "maximumLifetime", "access"],
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://github.com/organizations/example/settings/personal-access-token-requests/auto-approve",
      expect.objectContaining({ body: expect.stringContaining("organization%5Bauto_approve%5D=enable") }),
    );
  });

  it("keeps update dry-run read-only and omits authenticity tokens", async () => {
    const fetchImpl = queuedFetch([new Response(policyPage(), { status: 200 })]);
    const result = await updatePatPolicy(
      new WebSettingsClient(auth, fetchImpl),
      "example",
      { access: "restricted", requests: "auto", maximumLifetime: 30 },
      false,
    );
    expect(result).toMatchObject({ mode: "dry-run", verified: false });
    expect(JSON.stringify(result)).not.toContain("SECRET_AUTH_A");
    expect(JSON.stringify(result)).not.toContain("SECRET_AUTH_B");
    expect(JSON.stringify(result)).not.toContain("SECRET_AUTH_C");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports already-verified changes when access restriction fails last", async () => {
    const fetchImpl = queuedFetch([
      new Response(policyPage(), { status: 200 }),
      new Response(null, { status: 302, headers: { location: pageUrl } }),
      new Response(policyPage({ requests: "enable" }), { status: 200 }),
      new Response("rejected", { status: 500 }),
    ]);
    await expect(
      updatePatPolicy(
        new WebSettingsClient(auth, fetchImpl),
        "example",
        { access: "restricted", requests: "auto" },
        true,
      ),
    ).rejects.toMatchObject({
      code: "submission_rejected",
      details: { applied: ["requests"] },
    });
  });

  it("refuses to disable an inherited expiration requirement", async () => {
    await expect(
      updatePatPolicy(
        new WebSettingsClient(
          auth,
          queuedFetch([
            new Response(policyPage({ required: true, lifetime: "366", inheritedExpiration: true }), { status: 200 }),
          ]),
        ),
        "example",
        { maximumLifetime: "none" },
        false,
      ),
    ).rejects.toMatchObject({ code: "capability_unavailable" });
  });

  it("rejects custom values outside live constraints", async () => {
    await expect(
      updatePatPolicy(
        new WebSettingsClient(auth, queuedFetch([new Response(policyPage(), { status: 200 })])),
        "example",
        { maximumLifetime: 400 },
        false,
      ),
    ).rejects.toThrow(/live constraints/);
  });

  it("does not trust a redirect when readback disagrees", async () => {
    await expect(
      updatePatPolicy(
        new WebSettingsClient(
          auth,
          queuedFetch([
            new Response(policyPage(), { status: 200 }),
            new Response(null, { status: 302, headers: { location: pageUrl } }),
            new Response(policyPage(), { status: 200 }),
          ]),
        ),
        "example",
        { access: "restricted" },
        true,
      ),
    ).rejects.toMatchObject({ code: "verification_failed" });
  });
});
