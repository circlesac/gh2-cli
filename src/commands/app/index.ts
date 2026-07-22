import { defineCommand } from "citty";
import { createCommand } from "./create.ts";
import { infoCommand } from "./info.ts";
import { registerCommand } from "./register.ts";
import { updateCommand } from "./update.ts";
import { tokenCommand } from "./token.ts";
import { exportCommand } from "./export.ts";
import { loginCommand } from "./login.ts";
import { listCommand } from "./list.ts";
import { deleteCommand } from "./delete.ts";

export const appCommand = defineCommand({
  meta: {
    name: "app",
    description: "Manage GitHub Apps",
  },
  subCommands: {
    create: createCommand,
    info: infoCommand,
    register: registerCommand,
    update: updateCommand,
    token: tokenCommand,
    export: exportCommand,
    login: loginCommand,
    list: listCommand,
    delete: deleteCommand,
  },
});
