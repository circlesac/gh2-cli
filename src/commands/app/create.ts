import { execSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { defineCommand } from "citty";
import { buildGitHubAppManifest } from "../../lib/app-manifest.ts";
import { exchangeManifestCode } from "../../lib/github-api.ts";
import {
	defaultConfigPath,
	encodePrivateKey,
	type Stage,
	writeGitHubAppConfig,
} from "../../lib/integrations.ts";

const PORT = 8337;

function buildAutoSubmitHtml(
	manifest: Record<string, unknown>,
	org?: string,
): string {
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

export function startCallbackServer(
	manifest: Record<string, unknown>,
	org?: string,
	timeoutSeconds = 120,
): Promise<{ code: string; server: Server }> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			server.close();
			reject(
				new Error(`Timed out waiting for GitHub callback (${timeoutSeconds}s)`),
			);
		}, timeoutSeconds * 1000);

		const server = createServer((req, res) => {
			const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
			if (url.pathname === "/") {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(buildAutoSubmitHtml(manifest, org));
				return;
			}
			if (url.pathname === "/callback") {
				const code = url.searchParams.get("code");
				if (!code) {
					res.writeHead(400);
					res.end("Missing code");
					return;
				}
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(
					"<html><body><h2>Success!</h2><p>You can close this window.</p></body></html>",
				);
				clearTimeout(timeout);
				resolve({ code, server });
				return;
			}
			res.writeHead(404);
			res.end("Not found");
		});

		server.listen(PORT);
		server.on("error", (err) => {
			clearTimeout(timeout);
			if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
				reject(new Error(`Port ${PORT} is already in use`));
			} else {
				reject(err);
			}
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
			description:
				"Org slug to create the app under (omit for personal account)",
		},
		stage: {
			type: "string",
			description: "Stage: local | prod (default: prod)",
			default: "prod",
		},
		output: {
			type: "string",
			description:
				"Output path for the resulting JSON. Use '-' for stdout. Default: github.<stage>.json in cwd.",
		},
		homepage: {
			type: "string",
			description: "App homepage URL",
			default: "https://github.com/circlesac/gh2-cli",
		},
		permissions: {
			type: "string",
			description:
				"Exact permission assignments, e.g. metadata=read; replaces default permissions",
		},
		events: {
			type: "string",
			description:
				"Comma-separated webhook events; custom permissions default to no events",
		},
		webhook: {
			type: "boolean",
			description:
				"Enable webhook delivery; use --no-webhook for a polling-only App",
			default: true,
		},
		"webhook-url": {
			type: "string",
			description: "HTTPS webhook URL (default: example.com placeholder)",
		},
		open: {
			type: "boolean",
			description:
				"Open registration and installation in a browser; use --no-open to print URLs",
			default: true,
		},
		"dry-run": {
			type: "boolean",
			description:
				"Print the exact GitHub manifest without opening a browser or creating an App",
			default: false,
		},
		timeout: {
			type: "string",
			description: "Seconds to wait for the GitHub callback",
			default: "120",
		},
		public: {
			type: "boolean",
			description: "Make the app public (default: private)",
			default: false,
		},
	},
	async run({ args, cmd }) {
		const definitions = cmd.args;
		if (
			!definitions ||
			typeof definitions !== "object" ||
			definitions instanceof Promise
		)
			throw new Error("Command argument definitions unavailable");
		const known = new Set(
			Object.keys(definitions).flatMap((key) => [
				key,
				key.replace(/-([a-z])/g, (_match, letter: string) =>
					letter.toUpperCase(),
				),
			]),
		);
		const unknown = Object.keys(args).filter(
			(key) => key !== "_" && !known.has(key),
		);
		if (unknown.length) throw new Error(`Unknown option: --${unknown[0]}`);
		const stage = args.stage as Stage;
		const outputPath = args.output ?? defaultConfigPath(stage);
		const callbackUrl = `http://localhost:${PORT}/callback`;
		const manifest = buildGitHubAppManifest(
			args.name,
			callbackUrl,
			args.homepage,
			args.public,
			{
				permissions: args.permissions,
				events: args.events,
				webhook: args.webhook,
				webhookUrl: args["webhook-url"],
			},
		);
		const timeoutSeconds = Number(args.timeout);
		if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)
			throw new Error("--timeout must be a positive number of seconds");
		if (args["dry-run"]) {
			console.log(JSON.stringify(manifest, null, 2));
			return;
		}

		console.log(`Starting local callback server on :${PORT}...`);
		const serverPromise = startCallbackServer(
			manifest,
			args.org,
			timeoutSeconds,
		);

		console.log(`Registration URL: http://localhost:${PORT}/`);
		if (args.open)
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
		console.log(`\nInstall URL: ${installUrl}`);
		if (args.open)
			try {
				execSync(`open "${installUrl}"`);
			} catch {
				console.log(`(Open manually if browser did not launch.)`);
			}
	},
});
