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
