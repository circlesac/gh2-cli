import { defineCommand } from "citty";
import { readGitHubCookies } from "../../lib/browser-cookies.ts";
import { AUTH_FILE, saveAuth } from "../../lib/auth.ts";

export const loginCommand = defineCommand({
  meta: {
    name: "login",
    description: "Capture GitHub session cookies from your browser",
  },
  args: {
    account: {
      type: "string",
      description:
        "GitHub login to capture, when several profiles are signed in",
    },
    source: {
      type: "string",
      description: 'Browser profile to capture, for example "Chrome (Default)"',
    },
  },
  async run({ args }) {
    console.log("Reading GitHub cookies from browser keystore...");
    const result = await readGitHubCookies({
      account: args.account,
      source: args.source,
    });
    console.log(
      `Found ${result.cookies.length} cookie(s) from ${result.source}` +
        (result.account ? ` as @${result.account}` : ""),
    );
    await saveAuth({
      host: "github.com",
      cookies: result.cookies,
      capturedAt: new Date().toISOString(),
      source: result.source,
      account: result.account,
    });
    console.log(`Session saved to ${AUTH_FILE}`);
  },
});
