import { describe, expect, it } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { createGitHubJwt } from "../src/lib/github-api.ts";

describe("createGitHubJwt", () => {
  it("produces a three-part RS256 token signed by the provided PEM", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
    const pub = publicKey.export({ type: "spki", format: "pem" }).toString();

    const token = createGitHubJwt(123456, pem);
    const parts = token.split(".");
    expect(parts.length).toBe(3);

    const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8"));
    expect(header.alg).toBe("RS256");
    expect(header.typ).toBe("JWT");

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    expect(payload.iss).toBe(123456);
    const now = Math.floor(Date.now() / 1000);
    expect(payload.iat).toBeLessThanOrEqual(now);
    expect(payload.exp).toBeGreaterThan(now);
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(660 + 60);

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const ok = verifier.verify(pub, Buffer.from(sigB64, "base64url"));
    expect(ok).toBe(true);
  });
});
