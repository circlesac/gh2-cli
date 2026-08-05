import { describe, expect, it } from "vitest";
import {
  buildDoctorProbes,
  classifyProbeResult,
  runDoctorProbes,
} from "../src/commands/doctor.ts";

describe("doctor probe planning", () => {
  it("builds only read-only and dry-run commands", () => {
    const probes = buildDoctorProbes({
      org: "example-org",
      app: "example-app",
      installation: "42",
      support: true,
      supportAccount: "Example",
      patAccount: "monalisa",
      patOwner: "example-org",
      patRepo: "example-repo",
    });

    expect(probes.map((probe) => probe.name)).toEqual([
      "app-list",
      "deleted-repositories",
      "organization-pat-policy",
      "app-permissions",
      "app-private-keys",
      "installation-approval",
      "support-ticket-dry-run",
      "fine-grained-pat-dry-run",
    ]);
    expect(probes.flatMap((probe) => probe.args)).not.toContain("--yes");
    expect(probes.every((probe) => probe.args.includes("--output") || probe.args.includes("--format"))).toBe(true);
    expect(probes.find((probe) => probe.name === "fine-grained-pat-dry-run")?.args).toContain("--format");
  });

  it("requires a complete PAT probe target", () => {
    expect(() =>
      buildDoctorProbes({
        org: "example-org",
        support: false,
        patAccount: "monalisa",
      }),
    ).toThrow(/must be provided together/);
  });
});

describe("doctor result classification", () => {
  it("accepts successful JSON output", () => {
    expect(classifyProbeResult({ status: 0, stdout: "{}", stderr: "" })).toEqual({
      status: "ok",
    });
  });

  it("distinguishes authentication gates from contract drift", () => {
    expect(
      classifyProbeResult({
        status: 1,
        stdout: "",
        stderr: "WebSettingsError: GitHub requires sudo authentication",
      }),
    ).toEqual({
      status: "reauth_required",
      message: "GitHub sudo authentication is required.",
    });
    expect(
      classifyProbeResult({
        status: 1,
        stdout: "",
        stderr: "WebSettingsError: form_schema_changed: unexpected writable field",
      }),
    ).toEqual({
      status: "contract_changed",
      message: "GitHub's live settings contract no longer matches the parser.",
    });
  });

  it("returns exit 2 when only reauthentication is needed", () => {
    const probes = buildDoctorProbes({ org: "example-org", support: false });
    const results = [
      { status: 0, stdout: "[]", stderr: "" },
      { status: 1, stdout: "", stderr: "session cookie is likely stale" },
      { status: 0, stdout: '{"policies":{}}', stderr: "" },
    ];
    const result = runDoctorProbes(probes, () => results.shift()!);

    expect(result.report.status).toBe("reauth_required");
    expect(result.exitCode).toBe(2);
  });

  it("rejects a successful permission response with an empty permission map", () => {
    const probes = buildDoctorProbes({
      org: "example-org",
      app: "example-app",
      support: false,
    });
    const outputs = new Map([
      ["app-list", [{ slug: "example-app" }]],
      ["deleted-repositories", { repositories: [] }],
      ["organization-pat-policy", { policies: {} }],
      ["app-permissions", { app: "example-app", current: {} }],
      ["app-private-keys", { app: "example-app", keys: [] }],
    ]);
    const result = runDoctorProbes(probes, (args) => {
      const probe = probes.find((candidate) => candidate.args === args)!;
      return { status: 0, stdout: JSON.stringify(outputs.get(probe.name)), stderr: "" };
    });

    expect(result.report.status).toBe("contract_changed");
    expect(result.report.probes.find((probe) => probe.name === "app-permissions")).toEqual({
      name: "app-permissions",
      status: "contract_changed",
      message: "App permission output contained no selected permissions.",
    });
    expect(result.exitCode).toBe(1);
  });
});
