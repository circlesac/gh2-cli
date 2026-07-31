import { defineCommand } from "citty";
import { loginCommand } from "../app/login.ts";
import { supportCreateCommand } from "./create.ts";
import { supportReplyCommand } from "./reply.ts";

export const supportCommand = defineCommand({
  meta: {
    name: "support",
    description: "Manage GitHub Support tickets without opening the browser",
  },
  subCommands: {
    login: loginCommand,
    create: supportCreateCommand,
    reply: supportReplyCommand,
  },
});
