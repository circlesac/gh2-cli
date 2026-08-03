import { defineCommand } from "citty";
import { patPolicyCommand } from "./pat-policy.ts";

export const orgCommand = defineCommand({
  meta: { name: "org", description: "Manage organization settings missing from the public API" },
  subCommands: { "pat-policy": patPolicyCommand },
});
