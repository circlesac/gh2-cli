import { defineCommand } from "citty";
import { loadAuth } from "../../lib/auth.ts";
import {
  SupportSession,
  type SupportTicketDetails,
} from "../../lib/support.ts";
import {
  getOutputFormat,
  printOutput,
  type OutputFormat,
} from "../../lib/output.ts";

function ticketOutput(ticket: SupportTicketDetails, account: string | undefined) {
  return {
    ticket: ticket.ticketId,
    subject: ticket.subject,
    status: ticket.status,
    account: account ?? ticket.author,
    scope: ticket.scope,
    created_at: ticket.createdAt,
    author: ticket.author,
    body: ticket.body,
    comments: ticket.comments.map((comment) => ({
      id: comment.id,
      author: comment.author,
      created_at: comment.createdAt,
      body: comment.body,
    })),
  };
}

function printTicket(
  ticket: SupportTicketDetails,
  account: string | undefined,
  format: OutputFormat,
): void {
  const output = ticketOutput(ticket, account);
  if (format === "json") {
    printOutput(output, format);
    return;
  }

  printOutput(
    {
      ticket: output.ticket,
      subject: output.subject,
      status: output.status,
      account: output.account,
      scope: output.scope,
      created_at: output.created_at,
      comments: output.comments.length,
    },
    format,
  );
  console.log(`\nBody — ${output.author}\n\n${output.body}`);
  if (output.comments.length === 0) return;

  console.log("\nComments");
  for (const [index, comment] of output.comments.entries()) {
    console.log(
      `\n${index + 1}. ${comment.author} · ${comment.created_at} · ${comment.id}\n\n${comment.body}`,
    );
  }
}

export const supportViewCommand = defineCommand({
  meta: {
    name: "view",
    description: "Show a GitHub Support ticket and its comments",
  },
  args: {
    ticket: {
      type: "positional",
      description: "Ticket number, for example 4608817",
      required: true,
    },
    scope: {
      type: "string",
      description:
        "Ticket scope such as 'personal/0'; defaults to searching every accessible scope",
    },
    output: {
      type: "string",
      description: "Output format: json | table (default: table)",
      default: "table",
    },
  },
  async run({ args }) {
    const ticket = String(args.ticket).replace(/^#/, "");
    if (!/^\d+$/.test(ticket)) {
      throw new Error(`"${args.ticket}" is not a ticket number.`);
    }

    const auth = await loadAuth();
    const session = new SupportSession(auth);
    await session.login();
    const scopes = args.scope
      ? [args.scope.replace(/^\/?(tickets\/)?/, "")]
      : ["personal/0", ...(await session.ticketScopes())];
    const details = await session.viewTicket(ticket, [...new Set(scopes)]);
    printTicket(details, auth.account, getOutputFormat(args.output));
  },
});
