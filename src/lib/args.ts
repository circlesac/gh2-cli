import type { ArgsDef } from "citty";

export const commonArgs = {
  output: {
    type: "string",
    description: "Output format: json | table (default: table)",
    default: "table",
  },
  stage: {
    type: "string",
    description: "Stage: local | prod (default: prod)",
    default: "prod",
  },
} as const satisfies ArgsDef;
