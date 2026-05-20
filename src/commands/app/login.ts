import { defineCommand } from "citty";
import { readGitHubCookies } from "../../lib/browser-cookies.ts";
import { AUTH_FILE, saveAuth } from "../../lib/auth.ts";

export const loginCommand = defineCommand({
  meta: {
    name: "login",
    description: "Capture GitHub session cookies from your browser",
  },
  args: {},
  async run() {
    console.log("Reading GitHub cookies from browser keystore...");
    const result = await readGitHubCookies();
    if (!result) {
      throw new Error(
        "Could not find a GitHub session cookie.\n" +
        "  Make sure you are logged in to github.com in a Chromium-based browser (Chrome/Arc/Edge/Brave).",
      );
    }
    console.log(`Found ${result.cookies.length} cookie(s) from ${result.source}`);
    await saveAuth({
      host: "github.com",
      cookies: result.cookies,
      capturedAt: new Date().toISOString(),
      source: result.source,
    });
    console.log(`Session saved to ${AUTH_FILE}`);
  },
});
