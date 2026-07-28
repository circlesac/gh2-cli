import { describe, expect, it } from "vitest";
import {
  buildSupportTicketPayload,
  maskEmail,
  parseSupportBootstrap,
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
