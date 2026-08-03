#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { appCommand } from "./commands/app/index.ts";
import { patCommand } from "./commands/pat/index.ts";
import { supportCommand } from "./commands/support/index.ts";
import { installCommand } from "./commands/install/index.ts";
import { repoCommand } from "./commands/repo/index.ts";
import { orgCommand } from "./commands/org/index.ts";
import { checkForUpdate } from "./lib/update-check.ts";
import pkg from "../package.json";

const main = defineCommand({
  meta: {
    name: "gh2",
    version: pkg.version,
    description: "GitHub App, PAT, Support, and administration-gap operations CLI",
  },
  subCommands: {
    app: appCommand,
    pat: patCommand,
    support: supportCommand,
    install: installCommand,
    repo: repoCommand,
    org: orgCommand,
  },
});

await checkForUpdate();
runMain(main);
