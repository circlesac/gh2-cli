import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildSupportTicketPayload,
  maskEmail,
  parseSupportBootstrap,
  parseSupportTicketPage,
  parseSupportTicketDetails,
  parseTicketScopes,
  selectSupportAccount,
  selectSupportEmail,
  selectSupportProduct,
  type SupportAccount,
  type SupportBootstrap,
} from "../src/lib/support.ts";

const TICKET_DETAILS_HTML = readFileSync(
  new URL("./fixtures/support-ticket.html", import.meta.url),
  "utf8",
);

const personal: SupportAccount = {
  id: "personal-id",
  identifier: "monalisa",
  type: "Personal",
  canCreateTickets: true,
  verifiedEmails: ["mona@example.com"],
  supportedProducts: [
    {
      id: "github-product",
      name: "GitHub.com",
      priorityLevels: [
        { value: "low", name: "General question" },
        { value: "normal", name: "Problem" },
      ],
    },
  ],
};

const organization: SupportAccount = {
  ...personal,
  id: "org-id",
  identifier: "Circles Inc.",
  type: "Organization",
};

const bootstrap: SupportBootstrap = {
  formAuthToken: "csrf-token",
  accounts: [organization, personal],
  emails: ["mona@example.com"],
  userLogin: "monalisa",
};

describe("parseSupportBootstrap", () => {
  it("decodes the Support portal React props", () => {
    const props = JSON.stringify({
      formAuthToken: "a&b",
      contactSelectAccounts: [organization],
      contactSelectEmails: ["mona@example.com"],
    })
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
    const html = `<html><head><meta name="user-login" content="monalisa"></head><body><div data-react-class="App" data-react-props="${props}"></div></body></html>`;

    expect(parseSupportBootstrap(html)).toEqual({
      formAuthToken: "a&b",
      accounts: [organization],
      emails: ["mona@example.com"],
      userLogin: "monalisa",
    });
  });

  it("fails clearly when the portal markup changes", () => {
    expect(() => parseSupportBootstrap("<html></html>")).toThrow(
      "contact data was not found",
    );
  });
});

describe("Support ticket selection", () => {
  it("defaults to the personal account", () => {
    expect(selectSupportAccount(bootstrap.accounts)).toBe(personal);
  });

  it("matches an explicit account case-insensitively", () => {
    expect(selectSupportAccount(bootstrap.accounts, "circles inc.")).toBe(
      organization,
    );
  });

  it("selects a verified email and product priority", () => {
    expect(selectSupportEmail(bootstrap, personal)).toBe("mona@example.com");
    expect(selectSupportProduct(personal, "normal").id).toBe("github-product");
  });
});

describe("buildSupportTicketPayload", () => {
  it("matches the Support portal contact payload", () => {
    expect(
      buildSupportTicketPayload(bootstrap, {
        account: organization,
        email: "mona@example.com",
        product: organization.supportedProducts[0]!,
        priority: "normal",
        subject: "Remove sensitive data",
        body: "Repository and commit details",
        tags: ["repository"],
        formTags: ["sensitive-data"],
        userLogin: "monalisa",
      }),
    ).toEqual({
      contact: {
        name: "monalisa",
        account: "org-id",
        authenticity_token: "csrf-token",
        tags: ["repository"],
        form_tags: ["sensitive-data"],
        subject: "Remove sensitive data",
        comments: "Repository and commit details",
        email: "mona@example.com",
        email_ccs: [],
        product: "github-product",
        priority: "normal",
        uploads: [],
        captcha_token: "",
      },
    });
  });

  it("masks the contact email in previews", () => {
    expect(maskEmail("mona@example.com")).toBe("m***@example.com");
  });
});

const TICKET_HTML = `<!DOCTYPE html><html><head><title>Remove sensitive data from example-org/example-repo history #1234567 - GitHub Support</title></head>
<body>
<div id="ticket" data-ticket-id="1234567" data-org-type="personal" data-org-id="0" class="timeline-comment-group"></div>
<form id="js-ticket-refresh" action="/ticket/personal/0/1234567/refresh" method="post"><input type="hidden" name="authenticity_token" value="refresh-token" /></form>
<form id="js-ticket-comment-form" data-action="change:restorable-form#saveValue" data-target="restorable-form.form" action="/ticket/personal/0/1234567/comment" method="post"><input type="hidden" name="authenticity_token" value="comment-token" />
<textarea name="message" required="required"></textarea>
<button name="close" type="submit" value="1">Comment and close</button></form>
</body></html>`;

describe("support ticket replies", () => {
  it("parses the ticket scope and comment form", () => {
    expect(parseSupportTicketPage(TICKET_HTML)).toEqual({
      ticketId: "1234567",
      scope: "personal/0",
      commentAction: "/ticket/personal/0/1234567/comment",
      authenticityToken: "comment-token",
      subject: "Remove sensitive data from example-org/example-repo history #1234567",
    });
  });

  it("takes the comment form token, not the refresh form token", () => {
    expect(parseSupportTicketPage(TICKET_HTML).authenticityToken).not.toBe(
      "refresh-token",
    );
  });

  it("ignores data-action when reading the form action", () => {
    expect(parseSupportTicketPage(TICKET_HTML).commentAction).toBe(
      "/ticket/personal/0/1234567/comment",
    );
  });

  it("explains an inaccessible ticket instead of a markup error", () => {
    expect(() =>
      parseSupportTicketPage("<html><body><h1>Ticket not found</h1></body></html>"),
    ).toThrow(/not accessible|does not exist/i);
  });

  it("reports a ticket that has no comment form", () => {
    const closed = TICKET_HTML.replace(/id="js-ticket-comment-form"/, 'id="other"');
    expect(() => parseSupportTicketPage(closed)).toThrow(/no comment form/i);
  });

  it("reads selectable ticket scopes from the list page", () => {
    const props = JSON.stringify({
      accounts: [
        { id: "0", name: "monalisa", type: "personal", link: "/tickets/personal/0" },
        { id: "42", name: "acme", type: "organization", link: "/tickets/organization/42" },
      ],
    }).replace(/"/g, "&quot;");
    const html = `<div data-react-class="wrapped-account-selector-ticket" data-react-props="${props}"></div>`;
    expect(parseTicketScopes(html)).toEqual(["personal/0", "organization/42"]);
  });
});

describe("support ticket view", () => {
  it("parses the body and every comment in chronological order", () => {
    expect(parseSupportTicketDetails(TICKET_DETAILS_HTML)).toEqual({
      ticketId: "1234567",
      scope: "personal/0",
      subject: "Remove old references & confirm cleanup",
      status: "open",
      author: "monalisa",
      createdAt: "2026-08-04T15:36:01Z",
      body: [
        "Please remove the internal references.",
        "",
        "- Repository A",
        "- Repository B & C",
      ].join("\n"),
      comments: [
        {
          id: "200",
          author: "GitHub",
          createdAt: "2026-08-06T09:29:33Z",
          body: "We are checking with our internal team.\nWe will follow up.",
        },
        {
          id: "300",
          author: "monalisa",
          createdAt: "2026-08-07T02:35:52Z",
          body: "Can you confirm the final cleanup?",
        },
      ],
    });
  });

  it("reads a closed ticket without requiring a comment form", () => {
    const closed = TICKET_DETAILS_HTML
      .replace("State--open", "State--closed")
      .replace(/<form id="js-ticket-comment-form"[\s\S]*?<\/form>/, "");
    expect(parseSupportTicketDetails(closed).status).toBe("closed");
  });
});
