import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decodePrivateKey,
  encodePrivateKey,
  readGitHubAppConfig,
  writeGitHubAppConfig,
} from "../src/lib/integrations.ts";

describe("integrations", () => {
  it("round-trips a config file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gh2-test-"));
    try {
      const path = join(dir, "github.local.json");
      const pem = "-----BEGIN RSA PRIVATE KEY-----\nABC\n-----END RSA PRIVATE KEY-----\n";
      await writeGitHubAppConfig(
        {
          appId: 42,
          name: "test-app",
          webhookSecret: "secret",
          privateKey: encodePrivateKey(pem),
        },
        path,
      );
      const text = readFileSync(path, "utf-8");
      expect(text.endsWith("\n")).toBe(true);
      const parsed = JSON.parse(text);
      expect(parsed.appId).toBe(42);

      const config = await readGitHubAppConfig(path);
      expect(config.name).toBe("test-app");
      expect(decodePrivateKey(config)).toBe(pem);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
