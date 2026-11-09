import { defineCommand } from "citty";
import { createCommand } from "./create.ts";
import { deleteCommand } from "./delete.ts";
import { exportCommand } from "./export.ts";
import { infoCommand } from "./info.ts";
import { keyCommand } from "./key.ts";
import { listCommand } from "./list.ts";
import { loginCommand } from "./login.ts";
import { permissionsCommand } from "./permissions.ts";
import { registerCommand } from "./register.ts";
import { tokenCommand } from "./token.ts";
import { updateCommand } from "./update.ts";

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
		permissions: permissionsCommand,
		key: keyCommand,
	},
});
