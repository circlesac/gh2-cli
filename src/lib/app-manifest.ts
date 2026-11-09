import { parsePermissionAssignments } from "../commands/app/permissions.ts";
export function buildGitHubAppManifest(
	name: string,
	callbackUrl: string,
	homepage: string,
	isPublic: boolean,
	options: {
		permissions?: string;
		events?: string;
		webhook?: boolean;
		webhookUrl?: string;
	} = {},
) {
	const permissions =
		options.permissions === undefined
			? {
					issues: "write",
					pull_requests: "write",
					contents: "read",
					metadata: "read",
				}
			: parsePermissionAssignments(options.permissions);
	if ("metadata" in permissions && permissions.metadata !== "read")
		throw new Error("GitHub App metadata permission must be read");
	const selected = Object.fromEntries(
		Object.entries(permissions).filter(([, level]) => level !== "none"),
	);
	const webhook = options.webhook ?? true;
	const events =
		options.events === undefined
			? options.permissions === undefined && webhook
				? ["issues", "issue_comment", "pull_request", "push"]
				: []
			: options.events
					.split(",")
					.map((value) => value.trim())
					.filter(Boolean);
	if (!webhook && events.length)
		throw new Error(
			'Webhook events require --webhook; use --events="" with --no-webhook',
		);
	const hookUrl = options.webhookUrl ?? "https://example.com/webhook";
	const parsed = new URL(hookUrl);
	if (parsed.protocol !== "https:")
		throw new Error("Webhook URL must use https");
	return {
		name,
		url: homepage,
		hook_attributes: { url: hookUrl, active: webhook },
		redirect_url: callbackUrl,
		callback_urls: [callbackUrl],
		public: isPublic,
		default_permissions: { ...selected, metadata: "read" },
		default_events: events,
	};
}
