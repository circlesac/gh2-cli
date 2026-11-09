#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import pkg from "../package.json";
import { appCommand } from "./commands/app/index.ts";
import { doctorCommand } from "./commands/doctor.ts";
import { installCommand } from "./commands/install/index.ts";
import { orgCommand } from "./commands/org/index.ts";
import { patCommand } from "./commands/pat/index.ts";
import { repoCommand } from "./commands/repo/index.ts";
import { supportCommand } from "./commands/support/index.ts";
import { checkForUpdate } from "./lib/update-check.ts";

const main = defineCommand({
	meta: {
		name: "gh2",
		version: pkg.version,
		description:
			"GitHub App, PAT, Support, and administration-gap operations CLI",
	},
	subCommands: {
		app: appCommand,
		pat: patCommand,
		support: supportCommand,
		install: installCommand,
		repo: repoCommand,
		org: orgCommand,
		doctor: doctorCommand,
	},
});

await checkForUpdate();
runMain(main);
