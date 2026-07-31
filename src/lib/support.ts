import { loadAuth, type AuthFile, type StoredCookie } from "./auth.ts";

const SUPPORT_ORIGIN = "https://support.github.com";
const ALLOWED_HOSTS = new Set(["github.com", "support.github.com"]);

export interface SupportProduct {
  id: string;
  name: string;
  priorityLevels?: { value: string; name: string }[];
}

export interface SupportAccount {
  id: string;
  identifier: string;
  type: string;
  canCreateTickets: boolean;
  supportedProducts: SupportProduct[];
  verifiedEmails?: string[];
}

export interface SupportBootstrap {
  formAuthToken: string;
  accounts: SupportAccount[];
  emails: string[];
  userLogin?: string;
}

export interface SupportTicketInput {
  account: SupportAccount;
  email: string;
  product: SupportProduct;
  priority: string;
  subject: string;
  body: string;
  tags?: string[];
  formTags?: string[];
  userLogin?: string;
}

type Fetcher = typeof fetch;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function parseSupportBootstrap(html: string): SupportBootstrap {
  const appTag = html.match(/<[^>]+data-react-class="App"[^>]*>/i)?.[0];
  const rawProps = appTag?.match(/data-react-props="([^"]+)"/i)?.[1];
  if (!rawProps) {
    throw new Error(
      "GitHub Support contact data was not found. The portal markup may have changed.",
    );
  }

  const props = JSON.parse(decodeHtmlEntities(rawProps)) as {
    formAuthToken?: unknown;
    contactSelectAccounts?: unknown;
    contactSelectEmails?: unknown;
  };
  if (
    typeof props.formAuthToken !== "string" ||
    !Array.isArray(props.contactSelectAccounts) ||
    !Array.isArray(props.contactSelectEmails)
  ) {
    throw new Error(
      "GitHub Support returned an unexpected contact-data shape.",
    );
  }

  const accounts = props.contactSelectAccounts.filter(
    (account): account is SupportAccount =>
      typeof account === "object" &&
      account !== null &&
      typeof (account as SupportAccount).id === "string" &&
      typeof (account as SupportAccount).identifier === "string" &&
      Array.isArray((account as SupportAccount).supportedProducts),
  );
  const emails = props.contactSelectEmails.filter(
    (email): email is string => typeof email === "string",
  );
  const userLogin = html.match(
    /<meta name="user-login" content="([^"]+)">/i,
  )?.[1];

  return {
    formAuthToken: props.formAuthToken,
    accounts,
    emails,
    userLogin: userLogin ? decodeHtmlEntities(userLogin) : undefined,
  };
}

export function selectSupportAccount(
  accounts: SupportAccount[],
  requested?: string,
): SupportAccount {
  const account = requested
    ? accounts.find(
        (candidate) =>
          candidate.identifier.toLowerCase() === requested.toLowerCase(),
      )
    : accounts.find((candidate) => candidate.type === "Personal");
  if (!account) {
    const available = accounts
      .map((candidate) => candidate.identifier)
      .join(", ");
    throw new Error(
      requested
        ? `Support account "${requested}" was not found. Available: ${available}`
        : `No personal support account was found. Pass --account. Available: ${available}`,
    );
  }
  if (!account.canCreateTickets) {
    throw new Error(
      `Support account "${account.identifier}" cannot create tickets.`,
    );
  }
  return account;
}

export function selectSupportEmail(
  bootstrap: SupportBootstrap,
  account: SupportAccount,
  requested?: string,
): string {
  const allowed = new Set([
    ...bootstrap.emails,
    ...(account.verifiedEmails ?? []),
  ]);
  if (requested && !allowed.has(requested)) {
    throw new Error(
      `Email "${requested}" is not available for this GitHub Support session.`,
    );
  }
  const selected =
    requested ??
    account.verifiedEmails?.find((email) => allowed.has(email)) ??
    bootstrap.emails[0];
  if (!selected)
    throw new Error("GitHub Support returned no contact email address.");
  return selected;
}

export function selectSupportProduct(
  account: SupportAccount,
  requestedPriority: string,
): SupportProduct {
  const product = account.supportedProducts.find((candidate) =>
    candidate.priorityLevels?.some(
      (priority) => priority.value === requestedPriority,
    ),
  );
  if (!product) {
    const available = account.supportedProducts
      .flatMap((candidate) => candidate.priorityLevels ?? [])
      .map((priority) => priority.value)
      .filter((priority, index, values) => values.indexOf(priority) === index)
      .join(", ");
    throw new Error(
      `Priority "${requestedPriority}" is unavailable for "${account.identifier}". Available: ${available}`,
    );
  }
  return product;
}

export function buildSupportTicketPayload(
  bootstrap: SupportBootstrap,
  input: SupportTicketInput,
): Record<string, unknown> {
  return {
    contact: {
      name: input.userLogin,
      account: input.account.id,
      authenticity_token: bootstrap.formAuthToken,
      tags: input.tags ?? [],
      form_tags: input.formTags ?? [],
      subject: input.subject,
      comments: input.body,
      email: input.email,
      email_ccs: [],
      product: input.product.id,
      priority: input.priority,
      uploads: [],
      captcha_token: "",
    },
  };
}

export interface SupportTicketPage {
  ticketId: string;
  scope: string;
  commentAction: string;
  authenticityToken: string;
  subject?: string;
}

function attribute(tag: string, name: string): string | undefined {
  // The leading boundary matters: the comment form carries both `action` and
  // `data-action`, and an unanchored match returns the Catalyst binding.
  const value = tag.match(new RegExp(`[\\s<]${name}="([^"]*)"`, "i"))?.[1];
  return value === undefined ? undefined : decodeHtmlEntities(value);
}

/**
 * The ticket page is server-rendered: the comment box is a plain form posting
 * to `/ticket/<scope>/<id>/comment`. The bundled JS only drives websocket
 * refresh hints, so parsing the markup is the whole contract.
 */
export function parseSupportTicketPage(html: string): SupportTicketPage {
  const ticketTag = html.match(/<[^>]*id="ticket"[^>]*>/i)?.[0];
  if (!ticketTag) {
    if (/Ticket not found/i.test(html)) {
      throw new Error(
        "GitHub Support says the ticket does not exist or is not accessible to this session. Re-run `gh2 support login` if your browser is signed in as a different account.",
      );
    }
    throw new Error(
      "GitHub Support ticket data was not found. The portal markup may have changed.",
    );
  }

  const ticketId = attribute(ticketTag, "data-ticket-id");
  const orgType = attribute(ticketTag, "data-org-type");
  const orgId = attribute(ticketTag, "data-org-id");
  if (!ticketId || !orgType || orgId === undefined) {
    throw new Error("GitHub Support returned an unexpected ticket-data shape.");
  }

  const formIndex = html.search(/<form[^>]*id="js-ticket-comment-form"[^>]*>/i);
  if (formIndex < 0) {
    throw new Error(
      `Ticket #${ticketId} has no comment form. It is probably closed or archived.`,
    );
  }
  const rest = html.slice(formIndex);
  const formTag = rest.match(/<form[^>]*>/i)?.[0] ?? "";
  const commentAction = attribute(formTag, "action");
  const tokenTag = rest.match(
    /<input[^>]*name="authenticity_token"[^>]*>/i,
  )?.[0];
  const authenticityToken = tokenTag ? attribute(tokenTag, "value") : undefined;
  if (!commentAction || !authenticityToken) {
    throw new Error(
      "GitHub Support did not return a usable ticket comment form.",
    );
  }

  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1];
  const subject = title
    ? decodeHtmlEntities(title).replace(/\s*-\s*GitHub Support\s*$/i, "").trim()
    : undefined;

  return {
    ticketId,
    scope: `${orgType}/${orgId}`,
    commentAction,
    authenticityToken,
    subject: subject || undefined,
  };
}

/** Scope segments (`personal/0`, `organization/258657334`) from the ticket list. */
export function parseTicketScopes(html: string): string[] {
  const tag = html.match(
    /<[^>]+data-react-class="wrapped-account-selector-ticket"[^>]*>/i,
  )?.[0];
  const raw = tag ? attribute(tag, "data-react-props") : undefined;
  if (!raw) return [];
  const props = JSON.parse(raw) as { accounts?: { link?: unknown }[] };
  const scopes = (props.accounts ?? [])
    .map((account) =>
      typeof account.link === "string"
        ? account.link.replace(/^\/tickets\//, "")
        : undefined,
    )
    .filter((scope): scope is string => Boolean(scope));
  return [...new Set(scopes)];
}

export function maskEmail(email: string): string {
  const separator = email.lastIndexOf("@");
  if (separator <= 1) return email;
  return `${email[0]}***${email.slice(separator)}`;
}

class CookieJar {
  private readonly cookies = new Map<string, Map<string, string>>();

  constructor(auth: AuthFile) {
    this.cookies.set(
      "github.com",
      new Map(
        auth.cookies.map((cookie: StoredCookie) => [cookie.name, cookie.value]),
      ),
    );
  }

  header(hostname: string): string {
    return [...(this.cookies.get(hostname) ?? [])]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  capture(hostname: string, headers: Headers): void {
    const values = headers.getSetCookie();
    const jar = this.cookies.get(hostname) ?? new Map<string, string>();
    for (const value of values) {
      const pair = value.split(";", 1)[0] ?? "";
      const separator = pair.indexOf("=");
      if (separator <= 0) continue;
      const name = pair.slice(0, separator);
      const cookieValue = pair.slice(separator + 1);
      if (cookieValue) jar.set(name, cookieValue);
      else jar.delete(name);
    }
    this.cookies.set(hostname, jar);
  }
}

export class SupportSession {
  private readonly jar: CookieJar;

  constructor(
    auth: AuthFile,
    private readonly fetcher: Fetcher = fetch,
  ) {
    this.jar = new CookieJar(auth);
  }

  private async request(
    url: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const target = new URL(url, SUPPORT_ORIGIN);
    if (!ALLOWED_HOSTS.has(target.hostname)) {
      throw new Error(
        `Refusing unexpected GitHub Support redirect to ${target.hostname}.`,
      );
    }

    const headers = new Headers(init.headers);
    headers.set("Accept", headers.get("Accept") ?? "text/html");
    headers.set("Cookie", this.jar.header(target.hostname));
    headers.set("User-Agent", "gh2-cli");
    if (init.method === "POST") {
      headers.set("Origin", SUPPORT_ORIGIN);
      if (!headers.has("Referer"))
        headers.set("Referer", `${SUPPORT_ORIGIN}/contact-next`);
    }

    const response = await this.fetcher(target, {
      ...init,
      headers,
      redirect: "manual",
    });
    this.jar.capture(target.hostname, response.headers);
    return response;
  }

  async login(): Promise<string> {
    let url = `${SUPPORT_ORIGIN}/session/login?return_to=%2Fcontact`;
    for (let redirects = 0; redirects <= 10; redirects++) {
      const response = await this.request(url);
      const location = response.headers.get("location");
      if (!location) {
        if (!response.ok)
          throw new Error(
            `GitHub Support login failed with HTTP ${response.status}.`,
          );
        const finalUrl = new URL(response.url || url);
        if (finalUrl.hostname !== "support.github.com") {
          throw new Error(
            `GitHub Support login ended at unexpected host ${finalUrl.hostname}.`,
          );
        }
        return response.text();
      }
      url = new URL(location, url).toString();
    }
    throw new Error("GitHub Support login exceeded the redirect limit.");
  }

  async captchaRequired(): Promise<boolean> {
    const response = await this.request(
      `${SUPPORT_ORIGIN}/internal_api/contact/captcha_required`,
      {
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Could not check GitHub Support captcha status (HTTP ${response.status}).`,
      );
    }
    const result = (await response.json()) as { required?: unknown };
    if (typeof result.required !== "boolean") {
      throw new Error(
        "GitHub Support returned an unexpected captcha response.",
      );
    }
    return result.required;
  }

  async ticketScopes(): Promise<string[]> {
    const response = await this.request(
      `${SUPPORT_ORIGIN}/tickets/personal/0`,
    );
    if (!response.ok) return [];
    return parseTicketScopes(await response.text());
  }

  /**
   * Load a ticket, trying each scope until one renders it. The portal answers
   * HTTP 200 with a "Ticket not found" body for the wrong scope, so the status
   * code alone cannot decide this.
   */
  async openTicket(
    ticketId: string,
    scopes: string[],
  ): Promise<SupportTicketPage> {
    let lastError: Error | undefined;
    for (const scope of scopes) {
      const response = await this.request(
        `${SUPPORT_ORIGIN}/ticket/${scope}/${ticketId}`,
      );
      if (!response.ok) continue;
      try {
        return parseSupportTicketPage(await response.text());
      } catch (error) {
        lastError = error as Error;
      }
    }
    throw (
      lastError ??
      new Error(
        `Ticket #${ticketId} was not found in any accessible support scope.`,
      )
    );
  }

  async commentOnTicket(
    page: SupportTicketPage,
    message: string,
    close = false,
  ): Promise<void> {
    const form = new URLSearchParams({
      authenticity_token: page.authenticityToken,
      message,
    });
    if (close) form.set("close", "1");

    const response = await this.request(page.commentAction, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
        Referer: `${SUPPORT_ORIGIN}/ticket/${page.scope}/${page.ticketId}`,
      },
      body: form.toString(),
    });

    // A successful comment redirects back to the ticket.
    if (response.status >= 300 && response.status < 400) return;
    if (response.ok) return;
    throw new Error(
      `GitHub Support rejected the comment (HTTP ${response.status}).`,
    );
  }

  async createTicket(payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request(
      `${SUPPORT_ORIGIN}/internal_api/contact`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    const text = await response.text();
    let result: unknown = undefined;
    if (text) {
      try {
        result = JSON.parse(text);
      } catch {
        result = text;
      }
    }
    if (!response.ok) {
      const detail =
        typeof result === "string" ? result : JSON.stringify(result);
      throw new Error(
        `GitHub Support rejected the ticket (HTTP ${response.status})${detail ? `: ${detail}` : "."}`,
      );
    }
    return result;
  }
}

export async function openSupportSession(): Promise<{
  bootstrap: SupportBootstrap;
  session: SupportSession;
}> {
  const session = new SupportSession(await loadAuth());
  const html = await session.login();
  return { bootstrap: parseSupportBootstrap(html), session };
}
