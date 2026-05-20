#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { appCommand } from "./commands/app/index.ts";
import { checkForUpdate } from "./lib/update-check.ts";
import pkg from "../package.json";

const main = defineCommand({
  meta: {
    name: "gh2",
    version: pkg.version,
    description: "GitHub App lifecycle CLI",
  },
  subCommands: {
    app: appCommand,
  },
});

await checkForUpdate();
runMain(main);
