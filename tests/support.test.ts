import { describe, expect, it } from "vitest";
import {
  buildSupportTicketPayload,
  maskEmail,
  parseSupportBootstrap,
  parseSupportTicketPage,
  parseTicketScopes,
  selectSupportAccount,
  selectSupportEmail,
  selectSupportProduct,
  type SupportAccount,
  type SupportBootstrap,
} from "../src/lib/support.ts";

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

const TICKET_HTML = `<!DOCTYPE html><html><head><title>Remove sensitive data from circlesac/entropy history #4608817 - GitHub Support</title></head>
<body>
<div id="ticket" data-ticket-id="4608817" data-org-type="personal" data-org-id="0" class="timeline-comment-group"></div>
<form id="js-ticket-refresh" action="/ticket/personal/0/4608817/refresh" method="post"><input type="hidden" name="authenticity_token" value="refresh-token" /></form>
<form id="js-ticket-comment-form" data-action="change:restorable-form#saveValue" data-target="restorable-form.form" action="/ticket/personal/0/4608817/comment" method="post"><input type="hidden" name="authenticity_token" value="comment-token" />
<textarea name="message" required="required"></textarea>
<button name="close" type="submit" value="1">Comment and close</button></form>
</body></html>`;

describe("support ticket replies", () => {
  it("parses the ticket scope and comment form", () => {
    expect(parseSupportTicketPage(TICKET_HTML)).toEqual({
      ticketId: "4608817",
      scope: "personal/0",
      commentAction: "/ticket/personal/0/4608817/comment",
      authenticityToken: "comment-token",
      subject: "Remove sensitive data from circlesac/entropy history #4608817",
    });
  });

  it("takes the comment form token, not the refresh form token", () => {
    expect(parseSupportTicketPage(TICKET_HTML).authenticityToken).not.toBe(
      "refresh-token",
    );
  });

  it("ignores data-action when reading the form action", () => {
    expect(parseSupportTicketPage(TICKET_HTML).commentAction).toBe(
      "/ticket/personal/0/4608817/comment",
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
