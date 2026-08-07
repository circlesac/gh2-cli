import { defineCommand } from "citty";
import { writeFile } from "node:fs/promises";
import {
  defaultConfigPath,
  readGitHubAppConfig,
  type Stage,
} from "../../lib/integrations.ts";

export const exportCommand = defineCommand({
  meta: {
    name: "export",
    description: "Dump local github.<stage>.json to stdout or another file",
  },
  args: {
    "app-id": {
      type: "positional",
      description: "App ID (numeric). Optional; if omitted, reads from local config.",
      required: false,
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
      description: "Output file path. Use '-' or omit for stdout.",
    },
  },
  async run({ args }) {
    const stage = args.stage as Stage;
    const configPath = args.config ?? defaultConfigPath(stage);
    const config = await readGitHubAppConfig(configPath);

    if (args["app-id"]) {
      const requestedId = Number(args["app-id"]);
      if (Number.isNaN(requestedId) || requestedId !== config.appId) {
        throw new Error(
          `app-id ${args["app-id"]} does not match the appId in ${configPath} (${config.appId})`,
        );
      }
    }

    const json = JSON.stringify(config, null, 2) + "\n";
    if (!args.output || args.output === "-") {
      process.stdout.write(json);
      return;
    }
    await writeFile(args.output, json);
    console.log(`Wrote ${args.output}`);
  },
});
