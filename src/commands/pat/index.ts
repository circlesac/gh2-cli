import { defineCommand } from "citty";
import { loginCommand } from "../app/login.ts";
import { patCreateCommand } from "./create.ts";

export const patCommand = defineCommand({
  meta: {
    name: "pat",
    description: "Manage fine-grained personal access tokens",
  },
  subCommands: {
    login: loginCommand,
    create: patCreateCommand,
  },
});
