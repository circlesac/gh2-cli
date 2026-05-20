import { defineCommand } from "citty";
import { loadAuth, serializeCookies } from "../../lib/auth.ts";
import { getOutputFormat, printOutput } from "../../lib/output.ts";

interface AppRow {
  name: string;
  slug: string;
  settings_url: string;
}

function parseAppsListHtml(html: string, orgOrUser: string | undefined): AppRow[] {
  const rows: AppRow[] = [];
  const seen = new Set<string>();
  const base = orgOrUser
    ? `/organizations/${orgOrUser}/settings/apps/`
    : "/settings/apps/";
  // Anchors like: <a href="/settings/apps/my-app">My App</a>
  // or            <a href="/organizations/foo/settings/apps/my-app">My App</a>
  const escaped = base.replace(/[/]/g, "\\/");
  const re = new RegExp(
    `<a[^>]+href="(${escaped}([^"\\/]+))"[^>]*>([\\s\\S]*?)<\\/a>`,
    "gi",
  );
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const settingsPath = match[1]!;
    const slug = match[2]!;
    const rawName = match[3]!.replace(/<[^>]+>/g, "").trim();
    if (!slug || seen.has(slug)) continue;
    if (slug === "new" || slug === "advanced") continue;
    seen.add(slug);
    rows.push({
      name: rawName || slug,
      slug,
      settings_url: `https://github.com${settingsPath}`,
    });
  }
  return rows;
}

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List GitHub Apps you own (scrapes settings/apps via session cookies)",
  },
  args: {
    org: {
      type: "string",
      description: "Org slug. Omit to list personal apps.",
    },
    output: {
      type: "string",
      description: "Output format: json | table (default: table)",
      default: "table",
    },
  },
  async run({ args }) {
    const auth = await loadAuth();
    const url = args.org
      ? `https://github.com/organizations/${args.org}/settings/apps`
      : `https://github.com/settings/apps`;

    const res = await fetch(url, {
      headers: {
        Cookie: serializeCookies(auth.cookies),
        "User-Agent": "gh2-cli",
        Accept: "text/html",
      },
      redirect: "manual",
    });
    if (res.status === 302 || res.status === 301) {
      throw new Error(
        "Got redirect from GitHub — session cookie is likely stale. Run `gh2 app login` again.",
      );
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${url}`);
    }
    const html = await res.text();
    const rows = parseAppsListHtml(html, args.org);
    printOutput(rows, getOutputFormat(args.output));
  },
});

// Exported for testing
export const __testing = { parseAppsListHtml };
