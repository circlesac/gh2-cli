import { defineCommand } from "citty";
import { deletedCommand, restoreCommand } from "./deleted.ts";

export const repoCommand = defineCommand({
  meta: { name: "repo", description: "Manage repository operations missing from the public API" },
  subCommands: { deleted: deletedCommand, restore: restoreCommand },
});
