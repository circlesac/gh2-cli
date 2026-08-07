import { defineCommand } from "citty";
import { execSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { exchangeManifestCode } from "../../lib/github-api.ts";
import {
  defaultConfigPath,
  encodePrivateKey,
  writeGitHubAppConfig,
  type Stage,
} from "../../lib/integrations.ts";

const PORT = 8337;

function buildGitHubAppManifest(
  name: string,
  callbackUrl: string,
  homepage: string,
  isPublic: boolean,
): Record<string, unknown> {
  return {
    name,
    url: homepage,
    // Register the webhook ACTIVE. A webhook's active flag can only be set here
    // (the manifest) — `/app/hook/config` rejects `active` — so creating it
    // inactive leaves it permanently undeliverable via the CLI. The placeholder
    // URL is replaced later by `app update --webhook-url`; the one create-time
    // verification ping to this placeholder failing is expected and harmless
    // (GitHub only auto-disables after sustained failures, not a single one).
    hook_attributes: { url: "https://example.com/webhook", active: true },
    redirect_url: callbackUrl,
    callback_urls: [callbackUrl],
    public: isPublic,
    default_permissions: {
      issues: "write",
      pull_requests: "write",
      contents: "read",
      metadata: "read",
    },
    default_events: ["issues", "issue_comment", "pull_request", "push"],
  };
}

function buildAutoSubmitHtml(manifest: Record<string, unknown>, org?: string): string {
  const action = org
    ? `https://github.com/organizations/${org}/settings/apps/new`
    : "https://github.com/settings/apps/new";
  const json = JSON.stringify(manifest);
  const escaped = json.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html><head><title>gh2 — Creating GitHub App</title></head>
<body>
  <h2>Redirecting to GitHub...</h2>
  <p>If not redirected automatically, click the button below.</p>
  <form method="post" action="${action}">
    <input type="hidden" name="manifest" value="${escaped}">
    <button type="submit">Create GitHub App</button>
  </form>
  <script>document.forms[0].submit();</script>
</body></html>`;
}

function startCallbackServer(
  manifest: Record<string, unknown>,
  org?: string,
): Promise<{ code: string; server: Server }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for GitHub callback (120s)"));
    }, 120_000);

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
      if (url.pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(buildAutoSubmitHtml(manifest, org));
        return;
      }
      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        if (!code) { res.writeHead(400); res.end("Missing code"); return; }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h2>Success!</h2><p>You can close this window.</p></body></html>");
        clearTimeout(timeout);
        resolve({ code, server });
        return;
      }
      res.writeHead(404); res.end("Not found");
    });

    server.listen(PORT);
    server.on("error", (err) => {
      clearTimeout(timeout);
      if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
        reject(new Error(`Port ${PORT} is already in use`));
      } else { reject(err); }
    });
  });
}

export const createCommand = defineCommand({
  meta: {
    name: "create",
    description: "Create a GitHub App via the manifest flow",
  },
  args: {
    name: {
      type: "positional",
      description: "App display name",
      required: true,
    },
    org: {
      type: "string",
      description: "Org slug to create the app under (omit for personal account)",
    },
    stage: {
      type: "string",
      description: "Stage: local | prod (default: prod)",
      default: "prod",
    },
    output: {
      type: "string",
      description: "Output path for the resulting JSON. Use '-' for stdout. Default: github.<stage>.json in cwd.",
    },
    homepage: {
      type: "string",
      description: "App homepage URL",
      default: "https://github.com/circlesac/gh2-cli",
    },
    public: {
      type: "boolean",
      description: "Make the app public (default: private)",
      default: false,
    },
  },
  async run({ args }) {
    const stage = args.stage as Stage;
    const outputPath = args.output ?? defaultConfigPath(stage);
    const callbackUrl = `http://localhost:${PORT}/callback`;
    const manifest = buildGitHubAppManifest(args.name, callbackUrl, args.homepage, args.public);

    console.log(`Starting local callback server on :${PORT}...`);
    const serverPromise = startCallbackServer(manifest, args.org);

    console.log("Opening browser to create the app...");
    try {
      execSync(`open "http://localhost:${PORT}/"`);
    } catch {
      console.log(`Open this URL manually: http://localhost:${PORT}/`);
    }

    const { code, server } = await serverPromise;
    console.log("Received callback. Exchanging code for credentials...");
    const result = await exchangeManifestCode(code);
    server.close();

    await writeGitHubAppConfig(
      {
        appId: result.id,
        name: result.name,
        webhookSecret: result.webhook_secret,
        privateKey: encodePrivateKey(result.pem),
      },
      outputPath,
    );

    if (outputPath !== "-") {
      console.log(`\nApp created: ${result.name} (id: ${result.id})`);
      console.log(`  Credentials written to: ${outputPath}`);
      console.log(`  Settings: ${result.html_url}`);
    }

    const installUrl = `${result.html_url}/installations/new`;
    console.log(`\nOpening install URL: ${installUrl}`);
    try {
      execSync(`open "${installUrl}"`);
    } catch {
      console.log(`(Open manually if browser did not launch.)`);
    }
  },
});
