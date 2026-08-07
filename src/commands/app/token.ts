import { defineCommand } from "citty";
import { createInstallationToken } from "../../lib/github-api.ts";
import {
  decodePrivateKey,
  defaultConfigPath,
  readGitHubAppConfig,
  type Stage,
} from "../../lib/integrations.ts";
import { getOutputFormat, printOutput } from "../../lib/output.ts";

export const tokenCommand = defineCommand({
  meta: {
    name: "token",
    description: "Mint a short-lived installation access token",
  },
  args: {
    "app-id": {
      type: "positional",
      description: "App ID (numeric). Optional; if omitted, reads from local config.",
      required: false,
    },
    installation: {
      type: "string",
      description: "Installation ID (numeric)",
      required: true,
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
    output: {
      type: "string",
      description: "Output format: json | table (default: table)",
      default: "table",
    },
  },
  async run({ args }) {
    const installationId = Number(args.installation);
    if (Number.isNaN(installationId)) {
      throw new Error(`Invalid installation: ${args.installation}`);
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
    const token = await createInstallationToken(config.appId, pem, installationId);
    printOutput(token, getOutputFormat(args.output));
  },
});
