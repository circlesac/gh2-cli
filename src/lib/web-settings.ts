import type { AuthFile } from "./auth.ts";
import { GitHubCookieJar, loadAuth } from "./auth.ts";

export type WebSettingsErrorCode =
  | "session_missing"
  | "session_expired"
  | "account_target_mismatch"
  | "sudo_required"
  | "capability_unavailable"
  | "upgrade_required"
  | "form_not_found"
  | "form_ambiguous"
  | "form_schema_changed"
  | "submission_rejected"
  | "verification_failed"
  | "no_pending_approval";

export class WebSettingsError extends Error {
  constructor(
    public readonly code: WebSettingsErrorCode,
    message: string,
    public readonly pageUrl?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WebSettingsError";
  }
}

export interface HtmlControl {
  tag: "input" | "select" | "textarea" | "button";
  name: string;
  type: string;
  value: string;
  values: string[];
  checked: boolean;
  disabled: boolean;
  successful: boolean;
  attributes: Record<string, string>;
  options?: {
    value: string;
    text: string;
    selected: boolean;
    disabled: boolean;
  }[];
}

export interface HtmlForm {
  action: string;
  actionUrl: string;
  htmlMethod: "GET" | "POST";
  method: string;
  fields: [string, string][];
  controls: HtmlControl[];
  bodyHtml: string;
  startIndex: number;
}

export interface SettingsPage {
  url: string;
  html: string;
  status: number;
}

export interface FindFormOptions {
  action: string;
  method: string;
  requiredFields?: string[];
  expectedWritableFields?: string[];
  allowEquivalentMatches?: boolean;
}

export type Fetch = typeof fetch;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function stripHtml(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(value: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    const name = match[1]!.toLowerCase();
    if (["form", "input", "select", "option", "textarea", "button"].includes(name)) {
      continue;
    }
    attributes[name] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function absoluteGitHubUrl(value: string, base = "https://github.com"): string {
  const url = new URL(decodeHtmlEntities(value), base);
  if (url.origin !== "https://github.com") {
    throw new WebSettingsError(
      "form_schema_changed",
      `Refusing a non-GitHub URL: ${url.href}`,
      base,
    );
  }
  return url.href;
}

function normalizedAction(value: string, base = "https://github.com"): string {
  const url = new URL(decodeHtmlEntities(value), base);
  return `${url.pathname}${url.search}`;
}

function successfulInput(
  attributes: Record<string, string>,
): { successful: boolean; value: string; type: string } {
  const type = (attributes.type ?? "text").toLowerCase();
  const disabled = "disabled" in attributes;
  if (disabled || ["button", "file", "image", "reset", "submit"].includes(type)) {
    return { successful: false, value: attributes.value ?? "", type };
  }
  if ((type === "checkbox" || type === "radio") && !("checked" in attributes)) {
    return { successful: false, value: attributes.value ?? "on", type };
  }
  return {
    successful: true,
    value:
      attributes.value ??
      (type === "checkbox" || type === "radio" ? "on" : ""),
    type,
  };
}

function removeTemplateContents(html: string): string {
  return html.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, "");
}

export function parseHtmlForms(html: string, sourceUrl: string): HtmlForm[] {
  const forms: HtmlForm[] = [];
  for (const match of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const formAttributes = parseAttributes(match[1] ?? "");
    const action = formAttributes.action;
    if (!action) continue;
    const bodyHtml = removeTemplateContents(match[2] ?? "");
    const controls: HtmlControl[] = [];
    const fields: [string, string][] = [];

    for (const inputMatch of bodyHtml.matchAll(/<input\b([^>]*)>/gi)) {
      const attributes = parseAttributes(inputMatch[1] ?? "");
      const name = attributes.name ?? "";
      if (!name) continue;
      const input = successfulInput(attributes);
      const control: HtmlControl = {
        tag: "input",
        name,
        type: input.type,
        value: input.value,
        values: [input.value],
        checked: "checked" in attributes,
        disabled: "disabled" in attributes,
        successful: input.successful,
        attributes,
      };
      controls.push(control);
      if (control.successful) fields.push([name, control.value]);
    }

    for (const selectMatch of bodyHtml.matchAll(
      /<select\b([^>]*)>([\s\S]*?)<\/select>/gi,
    )) {
      const attributes = parseAttributes(selectMatch[1] ?? "");
      const name = attributes.name ?? "";
      if (!name) continue;
      const options = [...(selectMatch[2] ?? "").matchAll(
        /<option\b([^>]*)>([\s\S]*?)<\/option>/gi,
      )].map((optionMatch) => {
        const optionAttributes = parseAttributes(optionMatch[1] ?? "");
        return {
          value: optionAttributes.value ?? stripHtml(optionMatch[2] ?? ""),
          text: stripHtml(optionMatch[2] ?? ""),
          selected: "selected" in optionAttributes,
          disabled: "disabled" in optionAttributes,
        };
      });
      let selected = options.filter((option) => option.selected && !option.disabled);
      if (!selected.length && !("multiple" in attributes)) {
        const first = options.find((option) => !option.disabled);
        if (first) selected = [first];
      }
      const disabled = "disabled" in attributes;
      const values = selected.map((option) => option.value);
      const control: HtmlControl = {
        tag: "select",
        name,
        type: "select",
        value: values[0] ?? "",
        values,
        checked: false,
        disabled,
        successful: !disabled,
        attributes,
        options,
      };
      controls.push(control);
      if (!disabled) {
        for (const value of values) fields.push([name, value]);
      }
    }

    for (const textareaMatch of bodyHtml.matchAll(
      /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi,
    )) {
      const attributes = parseAttributes(textareaMatch[1] ?? "");
      const name = attributes.name ?? "";
      if (!name) continue;
      const value = decodeHtmlEntities(textareaMatch[2] ?? "");
      const disabled = "disabled" in attributes;
      const control: HtmlControl = {
        tag: "textarea",
        name,
        type: "textarea",
        value,
        values: [value],
        checked: false,
        disabled,
        successful: !disabled,
        attributes,
      };
      controls.push(control);
      if (!disabled) fields.push([name, value]);
    }

    for (const buttonMatch of bodyHtml.matchAll(
      /<button\b([^>]*)>([\s\S]*?)<\/button>/gi,
    )) {
      const attributes = parseAttributes(buttonMatch[1] ?? "");
      const name = attributes.name ?? "";
      if (!name) continue;
      const value = attributes.value ?? stripHtml(buttonMatch[2] ?? "");
      controls.push({
        tag: "button",
        name,
        type: (attributes.type ?? "submit").toLowerCase(),
        value,
        values: [value],
        checked: false,
        disabled: "disabled" in attributes,
        successful: false,
        attributes,
      });
    }

    const override = fields.find(([name]) => name === "_method")?.[1];
    const rawMethod = (formAttributes.method ?? "GET").toUpperCase();
    const htmlMethod = rawMethod === "POST" ? "POST" : "GET";
    forms.push({
      action: normalizedAction(action, sourceUrl),
      actionUrl: absoluteGitHubUrl(action, sourceUrl),
      htmlMethod,
      method: (override ?? rawMethod).toUpperCase(),
      fields,
      controls,
      bodyHtml,
      startIndex: match.index ?? 0,
    });
  }
  return forms;
}

function pageErrorForMissingForm(page: SettingsPage, targetAction: string): WebSettingsError {
  const text = stripHtml(page.html);
  if (/upgrade (?:your|to github|this organization)|available (?:only )?(?:with|on) github|contact sales to/i.test(text)) {
    return new WebSettingsError(
      "upgrade_required",
      `The required setting is not writable on the current plan at ${page.url}.`,
      page.url,
    );
  }
  if (/feature is disabled|not available for|does not have access|not enabled for/i.test(text)) {
    return new WebSettingsError(
      "capability_unavailable",
      `The required setting is unavailable at ${page.url}.`,
      page.url,
    );
  }
  return new WebSettingsError(
    "form_not_found",
    `Couldn't find ${targetAction} at ${page.url}. GitHub may have changed the page or the captured account may lack access.`,
    page.url,
  );
}

function writableFieldNames(form: HtmlForm): string[] {
  return [...new Set(
    form.controls
      .filter((control) => {
        if (control.disabled || !control.name) return false;
        if (control.tag === "button") return false;
        if (control.tag === "input") {
          return !["hidden", "submit", "button", "reset", "image", "file"].includes(
            control.type,
          );
        }
        return true;
      })
      .map((control) => control.name),
  )].sort();
}

export function findHtmlForm(page: SettingsPage, options: FindFormOptions): HtmlForm {
  const targetAction = normalizedAction(options.action, page.url);
  const matches = parseHtmlForms(page.html, page.url).filter(
    (form) => form.action === targetAction && form.method === options.method.toUpperCase(),
  );
  if (!matches.length) throw pageErrorForMissingForm(page, `${options.method} ${targetAction}`);
  if (matches.length > 1) {
    const signatures = new Set(
      matches.map((form) =>
        JSON.stringify({
          htmlMethod: form.htmlMethod,
          fields: form.fields.map(([name, value]) => [
            name,
            name === "authenticity_token" ? "<token>" : value,
          ]),
          writableFields: writableFieldNames(form),
        }),
      ),
    );
    if (!options.allowEquivalentMatches || signatures.size !== 1) {
      throw new WebSettingsError(
        "form_ambiguous",
        `Found ${matches.length} matching forms for ${options.method} ${targetAction} at ${page.url}.`,
        page.url,
      );
    }
  }
  const form = matches[0]!;
  const present = new Set(form.controls.map((control) => control.name));
  const missing = (options.requiredFields ?? []).filter((field) => !present.has(field));
  if (missing.length) {
    throw new WebSettingsError(
      "form_schema_changed",
      `The form at ${page.url} is missing required field(s): ${missing.join(", ")}.`,
      page.url,
      { missing },
    );
  }
  if (options.expectedWritableFields) {
    const expected = [...options.expectedWritableFields].sort();
    const actual = writableFieldNames(form);
    const unexpected = actual.filter((field) => !expected.includes(field));
    if (unexpected.length) {
      throw new WebSettingsError(
        "form_schema_changed",
        `The form at ${page.url} has unexpected writable field(s): ${unexpected.join(", ")}.`,
        page.url,
        { expected, actual, unexpected },
      );
    }
  }
  return form;
}

function detectAuthenticationChallenge(html: string, pageUrl: string): void {
  if (
    /<title[^>]*>\s*Confirm access\s*<\/title>/i.test(html) ||
    /action=["'](?:https:\/\/github\.com)?\/sessions\/sudo/i.test(html)
  ) {
    throw new WebSettingsError(
      "sudo_required",
      `GitHub requires sudo authentication for ${pageUrl}. Complete it in the browser, capture that browser session again, and retry.`,
      pageUrl,
    );
  }
  if (
    /<form\b[^>]*action=["'](?:https:\/\/github\.com)?\/session["']/i.test(html) ||
    /name=["']login["']|Sign in to GitHub/i.test(html)
  ) {
    throw new WebSettingsError(
      "session_expired",
      `The GitHub session is not authenticated for ${pageUrl}. Capture the browser session again.`,
      pageUrl,
    );
  }
}

function redirectLocation(response: Response, pageUrl: string): string | undefined {
  const location = response.headers.get("location");
  if (!location) return undefined;
  return absoluteGitHubUrl(location, pageUrl);
}

export class WebSettingsClient {
  readonly account?: string;
  private readonly cookies: GitHubCookieJar;

  constructor(
    auth: AuthFile,
    private readonly fetchImpl: Fetch = fetch,
  ) {
    this.account = auth.account;
    this.cookies = new GitHubCookieJar(auth.cookies);
  }

  private headers(): Record<string, string> {
    return { Cookie: this.cookies.header(), "User-Agent": "gh2-cli" };
  }

  async get(value: string): Promise<SettingsPage> {
    let pageUrl = absoluteGitHubUrl(value);
    for (let redirects = 0; redirects <= 5; redirects++) {
      const response = await this.fetchImpl(pageUrl, {
        headers: { ...this.headers(), Accept: "text/html,application/xhtml+xml" },
        redirect: "manual",
      });
      this.cookies.capture(response.headers);
      if (REDIRECT_STATUSES.has(response.status)) {
        const location = redirectLocation(response, pageUrl);
        if (!location) {
          throw new WebSettingsError(
            "session_expired",
            `GitHub redirected without a destination from ${pageUrl}.`,
            pageUrl,
          );
        }
        const path = new URL(location).pathname;
        if (path.startsWith("/sessions/sudo")) {
          throw new WebSettingsError(
            "sudo_required",
            `GitHub requires sudo authentication for ${pageUrl}. Complete it in the browser, capture that browser session again, and retry.`,
            pageUrl,
          );
        }
        if (path === "/login" || path === "/session") {
          throw new WebSettingsError(
            "session_expired",
            `The GitHub session expired while opening ${pageUrl}.`,
            pageUrl,
          );
        }
        pageUrl = location;
        continue;
      }
      if (response.status === 401) {
        throw new WebSettingsError(
          "session_expired",
          `GitHub returned HTTP 401 for ${pageUrl}.`,
          pageUrl,
        );
      }
      if (response.status === 404) {
        throw new WebSettingsError(
          "account_target_mismatch",
          `GitHub returned HTTP 404 for ${pageUrl}. Check the captured account and target.`,
          pageUrl,
          { account: this.account },
        );
      }
      if (response.status === 403) {
        throw new WebSettingsError(
          "capability_unavailable",
          `GitHub returned HTTP 403 for ${pageUrl}.`,
          pageUrl,
        );
      }
      if (!response.ok) {
        throw new WebSettingsError(
          "capability_unavailable",
          `GitHub returned HTTP ${response.status} for ${pageUrl}.`,
          pageUrl,
        );
      }
      const html = await response.text();
      detectAuthenticationChallenge(html, pageUrl);
      return { url: pageUrl, html, status: response.status };
    }
    throw new WebSettingsError(
      "session_expired",
      `GitHub redirected too many times while opening ${value}.`,
      value,
    );
  }

  async submit(page: SettingsPage, form: HtmlForm, body: URLSearchParams): Promise<Response> {
    const response = await this.fetchImpl(form.actionUrl, {
      method: form.htmlMethod,
      headers: {
        ...this.headers(),
        Accept: "text/html,application/xhtml+xml,application/octet-stream",
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://github.com",
        Referer: page.url,
      },
      body: form.htmlMethod === "POST" ? body.toString() : undefined,
      redirect: "manual",
    });
    this.cookies.capture(response.headers);
    if (response.headers.get("content-type")?.includes("text/html")) {
      detectAuthenticationChallenge(await response.clone().text(), page.url);
    }
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = redirectLocation(response, page.url);
      if (location) {
        const path = new URL(location).pathname;
        if (path.startsWith("/sessions/sudo")) {
          throw new WebSettingsError(
            "sudo_required",
            `GitHub requires sudo authentication for ${page.url}.`,
            page.url,
          );
        }
        if (path === "/login" || path === "/session") {
          throw new WebSettingsError(
            "session_expired",
            `The GitHub session expired while submitting ${form.action}.`,
            page.url,
          );
        }
      }
    }
    if (response.status >= 400) {
      throw new WebSettingsError(
        "submission_rejected",
        `GitHub rejected ${form.method} ${form.action} with HTTP ${response.status}.`,
        page.url,
        { status: response.status, method: form.method, action: form.action },
      );
    }
    return response;
  }

  async followSameOriginRedirect(response: Response, referer: string): Promise<Response> {
    let current = response;
    let currentReferer = referer;
    for (let redirects = 0; redirects <= 5 && REDIRECT_STATUSES.has(current.status); redirects++) {
      const location = redirectLocation(current, currentReferer);
      if (!location) {
        throw new WebSettingsError(
          "submission_rejected",
          "GitHub redirected without a destination.",
          currentReferer,
        );
      }
      current = await this.fetchImpl(location, {
        headers: {
          ...this.headers(),
          Accept: "text/html,application/xhtml+xml,application/octet-stream",
          Referer: currentReferer,
        },
        redirect: "manual",
      });
      this.cookies.capture(current.headers);
      currentReferer = location;
    }
    return current;
  }
}

export async function loadWebSettingsClient(fetchImpl: Fetch = fetch): Promise<WebSettingsClient> {
  try {
    return new WebSettingsClient(await loadAuth(), fetchImpl);
  } catch (error) {
    if (error instanceof Error && /auth\.json not found/.test(error.message)) {
      throw new WebSettingsError("session_missing", error.message);
    }
    throw error;
  }
}

export function formBody(form: HtmlForm): URLSearchParams {
  return new URLSearchParams(form.fields);
}

export function replaceFormField(
  body: URLSearchParams,
  name: string,
  values: string | string[] | undefined,
): void {
  body.delete(name);
  if (values === undefined) return;
  for (const value of Array.isArray(values) ? values : [values]) body.append(name, value);
}

export function control(form: HtmlForm, name: string, type?: string): HtmlControl | undefined {
  return form.controls.find(
    (candidate) => candidate.name === name && (!type || candidate.type === type),
  );
}

export function controls(form: HtmlForm, name: string): HtmlControl[] {
  return form.controls.filter((candidate) => candidate.name === name);
}
