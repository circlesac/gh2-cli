import { defineCommand } from "citty";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getAppInfo } from "../../lib/github-api.ts";
import {
  defaultConfigPath,
  encodePrivateKey,
  writeGitHubAppConfig,
  type Stage,
} from "../../lib/integrations.ts";

export const registerCommand = defineCommand({
  meta: {
    name: "register",
    description: "Register an existing GitHub App locally (writes github.<stage>.json)",
  },
  args: {
    "app-id": {
      type: "positional",
      description: "App ID (numeric)",
      required: true,
    },
    pem: {
      type: "string",
      description: "Path to the .pem private key file",
      required: true,
    },
    "webhook-secret": {
      type: "string",
      description: "Webhook signing secret",
      required: true,
    },
    stage: {
      type: "string",
      description: "Stage: local | prod (default: prod)",
      default: "prod",
    },
    output: {
      type: "string",
      description: "Output path for the resulting JSON. Default: github.<stage>.json in cwd.",
    },
  },
  async run({ args }) {
    const appId = Number(args["app-id"]);
    if (Number.isNaN(appId)) throw new Error(`Invalid app-id: ${args["app-id"]}`);

    const pemPath = resolve(args.pem);
    const pem = await readFile(pemPath, "utf-8");

    console.log("Verifying PEM matches app ID via GET /app...");
    const info = await getAppInfo(appId, pem);

    const stage = args.stage as Stage;
    const outputPath = args.output ?? defaultConfigPath(stage);
    await writeGitHubAppConfig(
      {
        appId,
        name: info.name,
        webhookSecret: args["webhook-secret"],
        privateKey: encodePrivateKey(pem),
      },
      outputPath,
    );
    if (outputPath !== "-") {
      console.log(`Registered ${info.name} (id: ${appId}) → ${outputPath}`);
    }
  },
});
