import { defineCommand } from "citty";
import { loadAuth, serializeCookies } from "../../lib/auth.ts";

export interface DeleteForm {
  /** Absolute or root-relative form action URL. */
  action: string;
  /** Hidden inputs (name → value), replayed verbatim (e.g. `_method`, `authenticity_token`). */
  fields: Record<string, string>;
  /**
   * Text inputs the operator must fill to confirm — GitHub's delete form has a
   * `verify` box that must equal the app name (server-enforced via `pattern`).
   */
  confirm: { name: string; pattern?: string }[];
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Reconstruct the exact string GitHub's `verify` box expects from its
 * case-insensitive `pattern` attribute (e.g. `[cC][iI][rR]…-[yY][gG]2` →
 * `cir…-yg2`). Deriving it from the pattern is more reliable than guessing
 * between the slug and the display name.
 */
export function confirmValueFromPattern(pattern: string): string {
  let out = "";
  for (let i = 0; i < pattern.length; ) {
    if (pattern[i] === "[") {
      const end = pattern.indexOf("]", i);
      if (end === -1) {
        out += pattern.slice(i);
        break;
      }
      out += pattern.slice(i + 1, end)[0] ?? "";
      i = end + 1;
    } else {
      out += pattern[i];
      i++;
    }
  }
  return out;
}

/**
 * Find the "Delete GitHub App" form on the app's advanced settings page.
 *
 * GitHub has no REST endpoint to delete an App, so — like creation — this goes
 * through the cookie-authenticated web form. The page carries several forms; the
 * delete one is identified by its Rails method override (`_method=delete`) and an
 * action that targets this app's settings path. We split its hidden inputs
 * (replayed verbatim) from its text inputs (the `verify` confirmation the caller
 * must fill), without hard-coding GitHub's exact field names.
 */
export function parseDeleteForm(html: string, settingsPath: string): DeleteForm | null {
  const formRe = /<form\b[^>]*>[\s\S]*?<\/form>/gi;
  let m: RegExpExecArray | null;
  while ((m = formRe.exec(html)) !== null) {
    const form = m[0];
    const action = form.match(/\baction="([^"]+)"/i)?.[1];
    if (!action) continue;

    const fields: Record<string, string> = {};
    const confirm: { name: string; pattern?: string }[] = [];
    for (const tag of form.match(/<input\b[^>]*>/gi) ?? []) {
      const name = tag.match(/\bname="([^"]*)"/i)?.[1];
      if (!name) continue;
      const type = (tag.match(/\btype="([^"]*)"/i)?.[1] ?? "").toLowerCase();
      if (type === "text" || type === "") {
        confirm.push({ name, pattern: tag.match(/\bpattern="([^"]*)"/i)?.[1] });
      } else {
        fields[name] = decodeHtmlEntities(tag.match(/\bvalue="([^"]*)"/i)?.[1] ?? "");
      }
    }

    if ((fields["_method"] ?? "").toLowerCase() !== "delete") continue;
    if (!decodeHtmlEntities(action).includes(settingsPath)) continue;
    return { action: decodeHtmlEntities(action), fields, confirm };
  }
  return null;
}

export const deleteCommand = defineCommand({
  meta: {
    name: "delete",
    description:
      "Delete a GitHub App (no REST API exists — scrapes the advanced settings page for the delete form and submits it via your session cookies)",
  },
  args: {
    slug: {
      type: "positional",
      description: "App slug (as shown by `gh2 app list`)",
      required: true,
    },
    org: {
      type: "string",
      description: "Org slug that owns the app. Omit for a personal app.",
    },
    yes: {
      type: "boolean",
      description: "Confirm the irreversible delete (required — no prompt in non-interactive use).",
      default: false,
    },
  },
  async run({ args }) {
    const slug = String(args.slug);
    const settingsPath = args.org
      ? `/organizations/${args.org}/settings/apps/${slug}`
      : `/settings/apps/${slug}`;
    const advancedUrl = `https://github.com${settingsPath}/advanced`;

    const auth = await loadAuth();
    const headers = {
      Cookie: serializeCookies(auth.cookies),
      "User-Agent": "gh2-cli",
    };

    const page = await fetch(advancedUrl, {
      headers: { ...headers, Accept: "text/html" },
      redirect: "manual",
    });
    if (page.status === 301 || page.status === 302) {
      throw new Error(
        "Got a redirect from GitHub — session cookie is likely stale. Run `gh2 app login` again.",
      );
    }
    if (!page.ok) {
      throw new Error(`HTTP ${page.status} fetching ${advancedUrl}`);
    }

    const form = parseDeleteForm(await page.text(), settingsPath);
    if (!form) {
      throw new Error(
        `Couldn't find the delete form for "${slug}" at ${advancedUrl}. ` +
          "Check the slug/--org, and that your session can manage this app.",
      );
    }

    if (!args.yes) {
      throw new Error(
        `This permanently deletes GitHub App "${slug}" and cannot be undone. Re-run with --yes to confirm.`,
      );
    }

    // Fill the confirmation box(es). GitHub derives the required value from the
    // app name and enforces it via the input's `pattern`, so reconstruct it from
    // the pattern; fall back to the slug if there's no pattern.
    const body = { ...form.fields };
    for (const c of form.confirm) {
      body[c.name] = c.pattern ? confirmValueFromPattern(c.pattern) : slug;
    }

    const actionUrl = form.action.startsWith("http")
      ? form.action
      : `https://github.com${form.action}`;
    const res = await fetch(actionUrl, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://github.com",
        Referer: advancedUrl,
      },
      body: new URLSearchParams(body).toString(),
      redirect: "manual",
    });
    // A successful destructive form 302-redirects back to the apps list. Anything
    // else — including a 200 that just re-renders the page — means it did NOT
    // delete (stale confirmation, changed field, permissions, …).
    if (res.status === 302 || res.status === 303) {
      console.log(`Deleted GitHub App: ${slug}`);
      return;
    }
    throw new Error(
      `Delete did not go through (HTTP ${res.status}, expected a 302 redirect). ` +
        "The app still exists — check the slug/--org and that your session can manage it.",
    );
  },
});

// Exported for testing
export const __testing = { parseDeleteForm, confirmValueFromPattern };
