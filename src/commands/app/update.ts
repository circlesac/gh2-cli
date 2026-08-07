import { defineCommand } from "citty";
import { configureWebhook } from "../../lib/github-api.ts";
import {
  decodePrivateKey,
  defaultConfigPath,
  readGitHubAppConfig,
  type Stage,
} from "../../lib/integrations.ts";

export const updateCommand = defineCommand({
  meta: {
    name: "update",
    description: "Update GitHub App configuration (currently: --webhook-url)",
  },
  args: {
    "app-id": {
      type: "positional",
      description: "App ID (numeric). Optional; if omitted, reads from local config.",
      required: false,
    },
    "webhook-url": {
      type: "string",
      description: "New webhook URL (PATCH /app/hook/config)",
    },
    stage: {
      type: "string",
      description: "Stage: local | prod (default: prod)",
      default: "prod",
    },
    config: {
      type: "string",
      description: "Path to a github.*.json config file (overrides --stage)",
    },
  },
  async run({ args }) {
    if (!args["webhook-url"]) {
      throw new Error("Nothing to update. Pass --webhook-url <url>.");
    }
    const stage = args.stage as Stage;
    const configPath = args.config ?? defaultConfigPath(stage);
    const config = await readGitHubAppConfig(configPath);

    const requestedId = args["app-id"] ? Number(args["app-id"]) : config.appId;
    if (Number.isNaN(requestedId)) {
      throw new Error(`Invalid app-id: ${args["app-id"]}`);
    }
    if (requestedId !== config.appId) {
      throw new Error(
        `app-id ${requestedId} does not match the appId in ${configPath} (${config.appId})`,
      );
    }

    const pem = decodePrivateKey(config);
    await configureWebhook(config.appId, pem, args["webhook-url"], config.webhookSecret);
    console.log(`Updated webhook URL → ${args["webhook-url"]}`);
  },
});
