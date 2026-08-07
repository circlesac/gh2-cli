import { spawnSync } from "node:child_process";
import { defineCommand } from "citty";
import { getOutputFormat, printOutput } from "../lib/output.ts";

type ProbeStatus = "ok" | "reauth_required" | "contract_changed" | "failed";

interface DoctorProbe {
  name: string;
  args: string[];
  validate?: (data: unknown) => string | undefined;
}

interface ProbeResult {
  name: string;
  status: ProbeStatus;
  message?: string;
}

interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

type ProbeRunner = (args: string[]) => CommandResult;

interface DoctorOptions {
  org: string;
  app?: string;
  installation?: string;
  support: boolean;
  supportAccount?: string;
  patAccount?: string;
  patOwner?: string;
  patRepo?: string;
}

function selfInvocation(): string[] {
  const script = process.argv[1];
  if (script && /\.(?:[cm]?js|ts)$/.test(script)) return [process.execPath, script];
  return [process.execPath];
}

function runSelf(args: string[]): CommandResult {
  const invocation = selfInvocation();
  const result = spawnSync(invocation[0]!, [...invocation.slice(1), ...args], {
    encoding: "utf8",
    env: { ...process.env, GH2_NO_UPDATE_CHECK: "1" },
    timeout: 30_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message,
  };
}

function messageForFailure(result: CommandResult): string {
  const output = `${result.error ?? ""}\n${result.stderr}\n${result.stdout}`;
  if (/sudo authentication|sudo_required|confirm access/i.test(output)) {
    return "GitHub sudo authentication is required.";
  }
  if (/session cookie is likely stale|session_expired|session expired|capture .*session|run `gh2 .* login`/i.test(output)) {
    return "The captured GitHub browser session must be refreshed.";
  }
  if (/form_schema_changed|form_ambiguous|markup changes|could not be parsed|unknown permission|missing required field|unexpected writable field/i.test(output)) {
    return "GitHub's live settings contract no longer matches the parser.";
  }
  const errorLine = output
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^error:|Error:|WebSettingsError:/.test(line));
  return errorLine?.slice(0, 300) ?? `Probe exited with status ${result.status ?? "unknown"}.`;
}

export function classifyProbeResult(result: CommandResult): Omit<ProbeResult, "name"> {
  if (result.status === 0) {
    try {
      JSON.parse(result.stdout);
      return { status: "ok" };
    } catch {
      return { status: "failed", message: "Probe returned invalid JSON output." };
    }
  }
  const message = messageForFailure(result);
  if (message.includes("sudo authentication") || message.includes("browser session")) {
    return { status: "reauth_required", message };
  }
  if (message.includes("live settings contract")) {
    return { status: "contract_changed", message };
  }
  return { status: "failed", message };
}

export function buildDoctorProbes(options: DoctorOptions): DoctorProbe[] {
  const probes: DoctorProbe[] = [
    {
      name: "app-list",
      args: ["app", "list", "--org", options.org, "--output", "json"],
      validate: (data) => {
        if (!Array.isArray(data)) return "App listing did not return an array.";
        if (options.app && !data.some((item) => item && typeof item === "object" && Reflect.get(item, "slug") === options.app)) {
          return `App ${options.app} was not present in the live App listing.`;
        }
      },
    },
    {
      name: "deleted-repositories",
      args: ["repo", "deleted", "list", "--org", options.org, "--output", "json"],
      validate: (data) =>
        data && typeof data === "object" && Array.isArray(Reflect.get(data, "repositories"))
          ? undefined
          : "Deleted-repository output did not contain a repository list.",
    },
    {
      name: "organization-pat-policy",
      args: ["org", "pat-policy", "show", options.org, "--output", "json"],
      validate: (data) =>
        data && typeof data === "object" && Reflect.get(data, "policies")
          ? undefined
          : "Organization PAT policy output did not contain policies.",
    },
  ];

  if (options.app) {
    probes.push(
      {
        name: "app-permissions",
        args: ["app", "permissions", options.app, "--org", options.org, "--output", "json"],
        validate: (data) => {
          if (!data || typeof data !== "object" || Reflect.get(data, "app") !== options.app) {
            return "App permission output did not identify the requested App.";
          }
          const current = Reflect.get(data, "current");
          if (!current || typeof current !== "object" || Object.keys(current).length === 0) {
            return "App permission output contained no selected permissions.";
          }
        },
      },
      {
        name: "app-private-keys",
        args: ["app", "key", "list", options.app, "--org", options.org, "--output", "json"],
        validate: (data) =>
          data && typeof data === "object" && Reflect.get(data, "app") === options.app && Array.isArray(Reflect.get(data, "keys"))
            ? undefined
            : "App key output did not contain the requested App and key list.",
      },
    );
  }

  if (options.installation) {
    probes.push({
      name: "installation-approval",
      args: ["install", "approval", "show", options.installation, "--org", options.org, "--output", "json"],
      validate: (data) =>
        data && typeof data === "object" && typeof Reflect.get(data, "pending") === "boolean"
          ? undefined
          : "Installation approval output did not contain pending state.",
    });
  }

  if (options.support) {
    const args = [
      "support",
      "create",
      "--subject",
      "gh2 live contract probe - do not submit",
      "--body",
      "Read-only parser validation. This request must not be submitted.",
      "--output",
      "json",
    ];
    if (options.supportAccount) args.push("--account", options.supportAccount);
    probes.push({
      name: "support-ticket-dry-run",
      args,
      validate: (data) =>
        data && typeof data === "object" && Reflect.get(data, "mode") === "dry-run"
          ? undefined
          : "Support probe did not return a dry-run preview.",
    });
  }

  const patValues = [options.patAccount, options.patOwner, options.patRepo];
  if (patValues.some(Boolean) && !patValues.every(Boolean)) {
    throw new Error("--pat-account, --pat-owner, and --pat-repo must be provided together.");
  }
  if (options.patAccount && options.patOwner && options.patRepo) {
    probes.push({
      name: "fine-grained-pat-dry-run",
      args: [
        "pat",
        "create",
        "--account",
        options.patAccount,
        "--name",
        "gh2 live contract probe",
        "--owner",
        options.patOwner,
        "--repos",
        options.patRepo,
        "--permissions",
        "issues=read",
        "--expires-in",
        "7",
        "--format",
        "json",
      ],
      validate: (data) =>
        data && typeof data === "object" && Reflect.get(data, "mode") === "dry-run"
          ? undefined
          : "Fine-grained PAT probe did not return a dry-run preview.",
    });
  }

  return probes;
}

export function runDoctorProbes(probes: DoctorProbe[], runner: ProbeRunner = runSelf) {
  const results: ProbeResult[] = probes.map((probe) => {
    const commandResult = runner(probe.args);
    const classification = classifyProbeResult(commandResult);
    if (classification.status !== "ok" || !probe.validate) {
      return { name: probe.name, ...classification };
    }
    const validationError = probe.validate(JSON.parse(commandResult.stdout));
    return validationError
      ? { name: probe.name, status: "contract_changed", message: validationError }
      : { name: probe.name, status: "ok" };
  });
  const status = results.some((result) => result.status === "contract_changed")
    ? "contract_changed"
    : results.some((result) => result.status === "failed")
      ? "failed"
      : results.some((result) => result.status === "reauth_required")
        ? "reauth_required"
        : "healthy";
  return {
    report: {
      mode: "read-only",
      status,
      probes: results,
    },
    exitCode: status === "healthy" ? 0 : status === "reauth_required" ? 2 : 1,
  };
}

export const doctorCommand = defineCommand({
  meta: {
    name: "doctor",
    description: "Run read-only live contract probes against GitHub's administration pages",
  },
  args: {
    org: { type: "string", description: "Organization slug", required: true },
    app: { type: "string", description: "GitHub App slug to inspect" },
    installation: { type: "string", description: "Installation ID to inspect for pending approval" },
    support: { type: "boolean", description: "Include a Support ticket dry run", default: false },
    "support-account": { type: "string", description: "Support account identifier" },
    "pat-account": { type: "string", description: "GitHub login captured for the PAT dry run" },
    "pat-owner": { type: "string", description: "PAT resource owner" },
    "pat-repo": { type: "string", description: "Repository selected for the PAT dry run" },
    output: { type: "string", description: "Output format: json | table", default: "table" },
  },
  async run({ args }) {
    const result = runDoctorProbes(
      buildDoctorProbes({
        org: args.org,
        app: args.app,
        installation: args.installation,
        support: args.support,
        supportAccount: args["support-account"],
        patAccount: args["pat-account"],
        patOwner: args["pat-owner"],
        patRepo: args["pat-repo"],
      }),
    );
    printOutput(result.report, getOutputFormat(args.output));
    process.exitCode = result.exitCode;
  },
});
