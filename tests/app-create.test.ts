import { runCommand } from "citty";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCommand } from "../src/commands/app/create.ts";
import { buildGitHubAppManifest } from "../src/lib/app-manifest.ts";

const sideEffects = vi.hoisted(() => ({
	execSync: vi.fn(() => {
		throw new Error("dry-run must not open a browser");
	}),
	createServer: vi.fn(() => {
		throw new Error("dry-run must not start the callback server");
	}),
	exchangeManifestCode: vi.fn(async () => {
		throw new Error("dry-run must not register an App");
	}),
	writeGitHubAppConfig: vi.fn(() => {
		throw new Error("dry-run must not write App config");
	}),
}));
vi.mock("node:child_process", () => ({ execSync: sideEffects.execSync }));
vi.mock("node:http", () => ({ createServer: sideEffects.createServer }));
vi.mock("../src/lib/github-api.ts", () => ({
	exchangeManifestCode: sideEffects.exchangeManifestCode,
}));
vi.mock("../src/lib/integrations.ts", async (importOriginal) => ({
	...(await importOriginal<typeof import("../src/lib/integrations.ts")>()),
	writeGitHubAppConfig: sideEffects.writeGitHubAppConfig,
}));

describe("GitHub App manifest selection", () => {
	it("preserves the existing default permissions and events", () => {
		const manifest = buildGitHubAppManifest(
			"example-app",
			"http://localhost:8337/callback",
			"https://example.com",
			false,
		);
		expect(manifest.default_permissions).toEqual({
			issues: "write",
			pull_requests: "write",
			contents: "read",
			metadata: "read",
		});
		expect(manifest.default_events).toEqual([
			"issues",
			"issue_comment",
			"pull_request",
			"push",
		]);
		expect(manifest.hook_attributes.active).toBe(true);
	});
	it("uses default permissions with no events when only --no-webhook is set", () => {
		const manifest = buildGitHubAppManifest(
			"example-app",
			"http://localhost:8337/callback",
			"https://example.com",
			false,
			{ webhook: false },
		);
		expect(manifest.default_permissions).toEqual({
			issues: "write",
			pull_requests: "write",
			contents: "read",
			metadata: "read",
		});
		expect(manifest.default_events).toEqual([]);
		expect(manifest.hook_attributes.active).toBe(false);
	});
	it("creates a polling-only metadata-read App without unrelated grants or event subscriptions", () => {
		const manifest = buildGitHubAppManifest(
			"example-app",
			"http://localhost:8337/callback",
			"https://example.com",
			false,
			{ permissions: "metadata=read", webhook: false },
		);
		expect(manifest.default_permissions).toEqual({ metadata: "read" });
		expect(manifest.default_events).toEqual([]);
		expect(manifest.hook_attributes.active).toBe(false);
	});
	it("supports explicit permissions and events for webhook Apps", () => {
		const manifest = buildGitHubAppManifest(
			"example-app",
			"http://localhost:8337/callback",
			"https://example.com",
			false,
			{
				permissions: "issues=read,contents=none",
				events: "issues, issue_comment",
				webhookUrl: "https://example.com/events",
			},
		);
		expect(manifest.default_permissions).toEqual({
			issues: "read",
			metadata: "read",
		});
		expect(manifest.default_events).toEqual(["issues", "issue_comment"]);
		expect(manifest.hook_attributes.url).toBe("https://example.com/events");
	});
	it("rejects an impossible webhook contract and invalid permission levels", () => {
		expect(() =>
			buildGitHubAppManifest(
				"example",
				"http://localhost/callback",
				"https://example.com",
				false,
				{ webhook: false, events: "push" },
			),
		).toThrow("Webhook events");
		expect(() =>
			buildGitHubAppManifest(
				"example",
				"http://localhost/callback",
				"https://example.com",
				false,
				{ permissions: "metadata=write" },
			),
		).toThrow("metadata");
		expect(() =>
			buildGitHubAppManifest(
				"example",
				"http://localhost/callback",
				"https://example.com",
				false,
				{ permissions: "issues=admin" },
			),
		).toThrow();
	});
});

it("rejects unknown permission flags instead of falling back to broad defaults", async () => {
	await expect(
		runCommand(createCommand, {
			rawArgs: ["example-app", "--permissons", "metadata=read", "--dry-run"],
		}),
	).rejects.toThrow("Unknown option");
});

describe("gh2 app create --dry-run", () => {
	const logs: unknown[] = [];
	beforeEach(() => {
		logs.length = 0;
		vi.spyOn(console, "log").mockImplementation((...args) => {
			logs.push(...args);
		});
	});
	afterEach(() => {
		vi.restoreAllMocks();
		for (const effect of Object.values(sideEffects)) effect.mockClear();
	});
	async function dryRun(...flags: string[]) {
		await runCommand(createCommand, {
			rawArgs: ["example-app", ...flags, "--dry-run"],
		});
		for (const effect of Object.values(sideEffects))
			expect(effect).not.toHaveBeenCalled();
		expect(logs).toHaveLength(1);
		return JSON.parse(String(logs[0]));
	}
	const defaultPermissions = {
		issues: "write",
		pull_requests: "write",
		contents: "read",
		metadata: "read",
	};

	it("prints a webhook-free manifest with default permissions for --no-webhook alone", async () => {
		const manifest = await dryRun("--no-webhook");
		expect(manifest.default_permissions).toEqual(defaultPermissions);
		expect(manifest.default_events).toEqual([]);
		expect(manifest.hook_attributes.active).toBe(false);
	});
	it("keeps the default permissions and events when no selection flags are given", async () => {
		const manifest = await dryRun();
		expect(manifest.default_permissions).toEqual(defaultPermissions);
		expect(manifest.default_events).toEqual([
			"issues",
			"issue_comment",
			"pull_request",
			"push",
		]);
		expect(manifest.hook_attributes.active).toBe(true);
	});
	it("keeps the metadata-only polling App manifest", async () => {
		const manifest = await dryRun(
			"--permissions",
			"metadata=read",
			"--no-webhook",
		);
		expect(manifest.default_permissions).toEqual({ metadata: "read" });
		expect(manifest.default_events).toEqual([]);
		expect(manifest.hook_attributes.active).toBe(false);
	});
	it("rejects explicitly requested events with --no-webhook before any side effect", async () => {
		await expect(
			runCommand(createCommand, {
				rawArgs: [
					"example-app",
					"--no-webhook",
					"--events",
					"push",
					"--dry-run",
				],
			}),
		).rejects.toThrow("Webhook events require --webhook");
		for (const effect of Object.values(sideEffects))
			expect(effect).not.toHaveBeenCalled();
		expect(logs).toEqual([]);
	});
});
