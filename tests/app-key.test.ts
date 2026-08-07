import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  deleteAppKey,
  generateAppKey,
  parseAppKeyPage,
  privateKeyFingerprint,
  rotateAppKey,
} from "../src/commands/app/key.ts";
import { WebSettingsClient } from "../src/lib/web-settings.ts";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { format: "pem", type: "pkcs1" },
  publicKeyEncoding: { format: "pem", type: "spki" },
});
const fingerprint = privateKeyFingerprint(privateKey).display;
const pageUrl = "https://github.com/organizations/example/settings/apps/sample";
const auth = {
  host: "github.com",
  cookies: [{ name: "user_session", value: "secret" }],
  capturedAt: "2026-08-03T00:00:00Z",
  account: "example-user",
};

function appPage(keys: { id: string; fingerprint: string }[], generation = true): string {
  return `
    ${generation ? `<form action="/organizations/example/settings/apps/sample/key" method="post"><input type="hidden" name="authenticity_token" value="generate-token"></form>` : ""}
    ${keys.map((key) => `
      <div class="key"><code>${key.fingerprint}</code>
        <form action="/organizations/example/settings/apps/sample/key/${key.id}" method="post">
          <input type="hidden" name="_method" value="delete">
          <input type="hidden" name="authenticity_token" value="delete-${key.id}">
        </form>
      </div>`).join("\n")}
  `;
}

function queuedFetch(responses: Response[]) {
  return vi.fn(async () => {
    const response = responses.shift();
    if (!response) throw new Error("unexpected fetch");
    return response;
  }) as typeof fetch;
}

describe("App key parsing", () => {
  it("extracts key IDs from exact delete forms", () => {
    const state = parseAppKeyPage(
      { url: pageUrl, status: 200, html: appPage([{ id: "10", fingerprint }]) },
      { slug: "sample", org: "example" },
    );
    expect(state.keys).toEqual([{ id: "10", fingerprint }]);
    expect(state.generationForm?.action).toBe("/organizations/example/settings/apps/sample/key");
  });

  it("rejects a non-PKCS#1 response", () => {
    expect(() => privateKeyFingerprint("<html>error</html>")).toThrow(/PKCS#1/);
  });
});

describe("App key mutations", () => {
  it("keeps generate, delete, and rotate dry runs read-only", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gh2-key-"));
    const keys = appPage([
      { id: "10", fingerprint: "SHA256:old-a" },
      { id: "11", fingerprint: "SHA256:old-b" },
    ]);
    const generateFetch = queuedFetch([new Response(keys, { status: 200 })]);
    const generateResult = await generateAppKey(
      new WebSettingsClient(auth, generateFetch),
      { slug: "sample", org: "example" },
      join(directory, "generate.pem"),
      false,
    );
    expect(generateResult.mode).toBe("dry-run");
    expect(generateFetch).toHaveBeenCalledTimes(1);

    const deleteFetch = queuedFetch([new Response(keys, { status: 200 })]);
    expect((await deleteAppKey(
      new WebSettingsClient(auth, deleteFetch),
      { slug: "sample", org: "example" },
      "10",
      false,
    )).mode).toBe("dry-run");
    expect(deleteFetch).toHaveBeenCalledTimes(1);

    const rotateFetch = queuedFetch([new Response(keys, { status: 200 })]);
    expect((await rotateAppKey(
      new WebSettingsClient(auth, rotateFetch),
      { slug: "sample", org: "example" },
      "10",
      join(directory, "rotate.pem"),
      false,
    )).mode).toBe("dry-run");
    expect(rotateFetch).toHaveBeenCalledTimes(1);
  });

  it("writes a generated key with mode 0600 and verifies readback", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gh2-key-"));
    const output = join(directory, "app.pem");
    const fetchImpl = queuedFetch([
      new Response(appPage([{ id: "10", fingerprint: "SHA256:old" }]), { status: 200 }),
      new Response(privateKey, { status: 200, headers: { "content-type": "application/x-pem-file" } }),
      new Response(appPage([{ id: "10", fingerprint: "SHA256:old" }, { id: "11", fingerprint }]), { status: 200 }),
    ]);
    const result = await generateAppKey(
      new WebSettingsClient(auth, fetchImpl),
      { slug: "sample", org: "example" },
      output,
      true,
    );
    expect(result.verified).toBe(true);
    expect(await readFile(output, "utf8")).toContain("BEGIN RSA PRIVATE KEY");
    expect((await stat(output)).mode & 0o777).toBe(0o600);
    expect(JSON.stringify(result)).not.toContain("BEGIN RSA PRIVATE KEY");
  });

  it("does not write an invalid generation response", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gh2-key-"));
    const output = join(directory, "app.pem");
    const fetchImpl = queuedFetch([
      new Response(appPage([{ id: "10", fingerprint: "SHA256:old" }]), { status: 200 }),
      new Response("<html>rejected</html>", { status: 200 }),
    ]);
    await expect(
      generateAppKey(
        new WebSettingsClient(auth, fetchImpl),
        { slug: "sample", org: "example" },
        output,
        true,
      ),
    ).rejects.toMatchObject({ code: "submission_rejected" });
    await expect(readFile(output)).rejects.toThrow();
  });

  it("rejects an empty generation response", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gh2-key-"));
    const output = join(directory, "app.pem");
    const fetchImpl = queuedFetch([
      new Response(appPage([{ id: "10", fingerprint: "SHA256:old" }]), { status: 200 }),
      new Response("", { status: 200, headers: { "content-type": "application/x-pem-file" } }),
    ]);
    await expect(
      generateAppKey(
        new WebSettingsClient(auth, fetchImpl),
        { slug: "sample", org: "example" },
        output,
        true,
      ),
    ).rejects.toMatchObject({ code: "submission_rejected" });
  });

  it("rejects an unexpected content type even when the body resembles a key", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gh2-key-"));
    const output = join(directory, "app.pem");
    const fetchImpl = queuedFetch([
      new Response(appPage([{ id: "10", fingerprint: "SHA256:old" }]), { status: 200 }),
      new Response(privateKey, { status: 200, headers: { "content-type": "application/json" } }),
    ]);
    await expect(
      generateAppKey(
        new WebSettingsClient(auth, fetchImpl),
        { slug: "sample", org: "example" },
        output,
        true,
      ),
    ).rejects.toThrow(/unexpected private-key content type/);
    await expect(readFile(output)).rejects.toThrow();
  });

  it("refuses an existing key output before submitting", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gh2-key-"));
    const output = join(directory, "app.pem");
    await writeFile(output, "existing");
    const fetchImpl = queuedFetch([
      new Response(appPage([{ id: "10", fingerprint: "SHA256:old" }]), { status: 200 }),
    ]);
    await expect(
      generateAppKey(
        new WebSettingsClient(auth, fetchImpl),
        { slug: "sample", org: "example" },
        output,
        true,
      ),
    ).rejects.toThrow(/Refusing to overwrite/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses to delete the only key", async () => {
    const fetchImpl = queuedFetch([
      new Response(appPage([{ id: "10", fingerprint }]), { status: 200 }),
    ]);
    await expect(
      deleteAppKey(
        new WebSettingsClient(auth, fetchImpl),
        { slug: "sample", org: "example" },
        "10",
        true,
      ),
    ).rejects.toMatchObject({ code: "capability_unavailable" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports a failed delete readback", async () => {
    const before = appPage([
      { id: "10", fingerprint: "SHA256:old-a" },
      { id: "11", fingerprint: "SHA256:old-b" },
    ]);
    const fetchImpl = queuedFetch([
      new Response(before, { status: 200 }),
      new Response(null, { status: 302, headers: { location: pageUrl } }),
      new Response(before, { status: 200 }),
    ]);
    await expect(
      deleteAppKey(
        new WebSettingsClient(auth, fetchImpl),
        { slug: "sample", org: "example" },
        "10",
        true,
      ),
    ).rejects.toMatchObject({ code: "verification_failed" });
  });

  it("deletes one exact key and verifies it is absent", async () => {
    const before = appPage([
      { id: "10", fingerprint: "SHA256:old-a" },
      { id: "11", fingerprint: "SHA256:old-b" },
    ]);
    const after = appPage([{ id: "11", fingerprint: "SHA256:old-b" }]);
    const fetchImpl = queuedFetch([
      new Response(before, { status: 200 }),
      new Response(null, { status: 302, headers: { location: pageUrl } }),
      new Response(after, { status: 200 }),
    ]);
    const result = await deleteAppKey(
      new WebSettingsClient(auth, fetchImpl),
      { slug: "sample", org: "example" },
      "10",
      true,
    );
    expect(result.verified).toBe(true);
  });

  it("never deletes the old key when new-key verification fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gh2-key-"));
    const output = join(directory, "app.pem");
    const before = appPage([
      { id: "10", fingerprint: "SHA256:old-a" },
      { id: "11", fingerprint: "SHA256:old-b" },
    ]);
    const fetchImpl = queuedFetch([
      new Response(before, { status: 200 }),
      new Response(privateKey, { status: 200 }),
      new Response(before, { status: 200 }),
    ]);
    await expect(
      rotateAppKey(
        new WebSettingsClient(auth, fetchImpl),
        { slug: "sample", org: "example" },
        "10",
        output,
        true,
      ),
    ).rejects.toMatchObject({ code: "verification_failed" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(await readFile(output, "utf8")).toContain("BEGIN RSA PRIVATE KEY");
  });

  it("rotates by verifying the new key before deleting the exact old key", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gh2-key-"));
    const output = join(directory, "app.pem");
    const before = appPage([
      { id: "10", fingerprint: "SHA256:old-a" },
      { id: "11", fingerprint: "SHA256:old-b" },
    ]);
    const generated = appPage([
      { id: "10", fingerprint: "SHA256:old-a" },
      { id: "11", fingerprint: "SHA256:old-b" },
      { id: "12", fingerprint },
    ]);
    const after = appPage([
      { id: "11", fingerprint: "SHA256:old-b" },
      { id: "12", fingerprint },
    ]);
    const fetchImpl = queuedFetch([
      new Response(before, { status: 200 }),
      new Response(privateKey, { status: 200, headers: { "content-type": "application/x-pem-file" } }),
      new Response(generated, { status: 200 }),
      new Response(generated, { status: 200 }),
      new Response(null, { status: 302, headers: { location: pageUrl } }),
      new Response(after, { status: 200 }),
    ]);
    const result = await rotateAppKey(
      new WebSettingsClient(auth, fetchImpl),
      { slug: "sample", org: "example" },
      "10",
      output,
      true,
    );
    expect(result).toMatchObject({ verified: true, newKey: { id: "12" } });
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });
});
