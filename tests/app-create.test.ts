import { describe, expect, it } from "vitest";
import { buildGitHubAppManifest } from "../src/lib/app-manifest.ts";

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
	const { runCommand } = await import("citty");
	const { createCommand } = await import("../src/commands/app/create.ts");
	await expect(
		runCommand(createCommand, {
			rawArgs: ["example-app", "--permissons", "metadata=read", "--dry-run"],
		}),
	).rejects.toThrow("Unknown option");
});
