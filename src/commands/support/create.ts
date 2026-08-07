import { defineCommand } from "citty";
import { readFile } from "node:fs/promises";
import {
  buildSupportTicketPayload,
  maskEmail,
  openSupportSession,
  selectSupportAccount,
  selectSupportEmail,
  selectSupportProduct,
} from "../../lib/support.ts";
import { getOutputFormat, printOutput } from "../../lib/output.ts";

function commaSeparated(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

async function readBody(
  body: string | undefined,
  bodyFile: string | undefined,
): Promise<string> {
  if (body && bodyFile)
    throw new Error("Pass either --body or --body-file, not both.");
  if (body) return body;
  if (!bodyFile) throw new Error("Pass --body or --body-file.");
  return bodyFile === "-" ? Bun.stdin.text() : readFile(bodyFile, "utf8");
}

export const supportCreateCommand = defineCommand({
  meta: {
    name: "create",
    description: "Create a GitHub Support ticket without opening the browser",
  },
  args: {
    subject: {
      type: "string",
      description: "Ticket subject",
      required: true,
    },
    body: {
      type: "string",
      description: "Ticket body",
    },
    "body-file": {
      type: "string",
      description: "Read the ticket body from a file, or '-' for stdin",
    },
    account: {
      type: "string",
      description:
        "Support account identifier; defaults to the personal account",
    },
    email: {
      type: "string",
      description:
        "Contact email available in the Support portal; defaults to the first verified email",
    },
    priority: {
      type: "string",
      description:
        "Support priority available to the account (default: normal)",
      default: "normal",
    },
    tags: {
      type: "string",
      description: "Comma-separated routing tags",
    },
    "form-tags": {
      type: "string",
      description: "Comma-separated form tags",
    },
    yes: {
      type: "boolean",
      description:
        "Actually create the ticket; omit for a live-authenticated dry run",
      default: false,
    },
    output: {
      type: "string",
      description: "Output format: json | table (default: table)",
      default: "table",
    },
  },
  async run({ args }) {
    const body = (await readBody(args.body, args["body-file"])).trim();
    if (!body) throw new Error("Ticket body cannot be empty.");

    const { bootstrap, session } = await openSupportSession();
    const account = selectSupportAccount(bootstrap.accounts, args.account);
    const email = selectSupportEmail(bootstrap, account, args.email);
    const product = selectSupportProduct(account, args.priority);
    const tags = commaSeparated(args.tags);
    const formTags = commaSeparated(args["form-tags"]);
    const captchaRequired = await session.captchaRequired();
    const preview = {
      mode: args.yes ? "submit" : "dry-run",
      account: account.identifier,
      email: maskEmail(email),
      product: product.name,
      priority: args.priority,
      subject: args.subject,
      body,
      tags,
      form_tags: formTags,
      captcha_required: captchaRequired,
    };

    const outputFormat = getOutputFormat(args.output);
    if (!args.yes) {
      printOutput(preview, outputFormat);
      if (outputFormat !== "json") {
        console.log("\nDry run only. Re-run with --yes to create the ticket.");
      }
      return;
    }

    if (captchaRequired) {
      throw new Error(
        "GitHub Support requires a captcha for this session. Use the Support portal for this ticket.",
      );
    }

    const result = await session.createTicket(
      buildSupportTicketPayload(bootstrap, {
        account,
        email,
        product,
        priority: args.priority,
        subject: args.subject,
        body,
        tags,
        formTags,
        userLogin: bootstrap.userLogin,
      }),
    );
    if (outputFormat !== "json") console.log("GitHub Support ticket created.");
    printOutput(result ?? { ...preview, mode: "created" }, outputFormat);
  },
});
