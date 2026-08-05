import { defineCommand } from "citty";
import { readFile } from "node:fs/promises";
import { loadAuth } from "../../lib/auth.ts";
import { SupportSession } from "../../lib/support.ts";
import { getOutputFormat, printOutput } from "../../lib/output.ts";

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

export const supportReplyCommand = defineCommand({
  meta: {
    name: "reply",
    description: "Reply to a GitHub Support ticket without opening the browser",
  },
  args: {
    ticket: {
      type: "positional",
      description: "Ticket number, for example 4608817",
      required: true,
    },
    body: {
      type: "string",
      description: "Reply body (Markdown)",
    },
    "body-file": {
      type: "string",
      description: "Read the reply body from a file, or '-' for stdin",
    },
    scope: {
      type: "string",
      description:
        "Ticket scope such as 'personal/0'; defaults to searching every accessible scope",
    },
    close: {
      type: "boolean",
      description: "Close the ticket after commenting",
      default: false,
    },
    yes: {
      type: "boolean",
      description:
        "Actually post the reply; omit for a live-authenticated dry run",
      default: false,
    },
    output: {
      type: "string",
      description: "Output format: json | table (default: table)",
      default: "table",
    },
  },
  async run({ args }) {
    const ticket = String(args.ticket).replace(/^#/, "");
    if (!/^\d+$/.test(ticket))
      throw new Error(`"${args.ticket}" is not a ticket number.`);

    const body = (await readBody(args.body, args["body-file"])).trim();
    if (!body) throw new Error("Reply body cannot be empty.");

    const auth = await loadAuth();
    const session = new SupportSession(auth);
    await session.login();

    const scopes = args.scope
      ? [args.scope.replace(/^\/?(tickets\/)?/, "")]
      : ["personal/0", ...(await session.ticketScopes())];
    const page = await session.openTicket(ticket, scopes);

    const outputFormat = getOutputFormat(args.output);
    const preview = {
      mode: args.yes ? "submit" : "dry-run",
      as: auth.account ? `@${auth.account}` : "(re-run `gh2 support login`)",
      ticket: page.ticketId,
      scope: page.scope,
      subject: page.subject,
      close: args.close,
      body,
    };

    if (!args.yes) {
      printOutput(preview, outputFormat);
      if (outputFormat !== "json") {
        console.log("\nDry run only. Re-run with --yes to post the reply.");
      }
      return;
    }

    await session.commentOnTicket(page, body, args.close);
    if (outputFormat !== "json") {
      console.log(`Replied to GitHub Support ticket #${page.ticketId}${args.close ? " and closed it" : ""}.`);
    }
    printOutput({ ...preview, mode: "created" }, outputFormat);
  },
});
