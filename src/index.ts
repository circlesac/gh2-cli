#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { appCommand } from "./commands/app/index.ts";
import { patCommand } from "./commands/pat/index.ts";
import { supportCommand } from "./commands/support/index.ts";
import { checkForUpdate } from "./lib/update-check.ts";
import pkg from "../package.json";

const main = defineCommand({
  meta: {
    name: "gh2",
    version: pkg.version,
    description: "GitHub App, PAT, and Support operations CLI",
  },
  subCommands: {
    app: appCommand,
    pat: patCommand,
    support: supportCommand,
  },
});

await checkForUpdate();
runMain(main);
