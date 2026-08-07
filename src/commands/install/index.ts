import { defineCommand } from "citty";
import { approvalCommand } from "./approval.ts";

export const installCommand = defineCommand({
  meta: { name: "install", description: "Manage GitHub App installations" },
  subCommands: { approval: approvalCommand },
});
