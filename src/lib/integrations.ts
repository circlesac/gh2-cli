import { chmod, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface GitHubAppConfig {
  appId: number;
  name: string;
  webhookSecret: string;
  /** base64-encoded PEM */
  privateKey: string;
}

export type Stage = "local" | "prod";

export function defaultConfigPath(stage: Stage, cwd: string = process.cwd()): string {
  return resolve(cwd, `github.${stage}.json`);
}

export async function writeGitHubAppConfig(
  config: GitHubAppConfig,
  outputPath: string,
): Promise<void> {
  const json = JSON.stringify(config, null, 2) + "\n";
  if (outputPath === "-") {
    process.stdout.write(json);
    return;
  }
  await writeFile(outputPath, json, { mode: 0o600 });
  await chmod(outputPath, 0o600);
}

export async function readGitHubAppConfig(path: string): Promise<GitHubAppConfig> {
  if (!existsSync(path)) {
    throw new Error(`Config file not found: ${path}`);
  }
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as GitHubAppConfig;
}

export function decodePrivateKey(config: GitHubAppConfig): string {
  return Buffer.from(config.privateKey, "base64").toString("utf-8");
}

export function encodePrivateKey(pem: string): string {
  return Buffer.from(pem).toString("base64");
}
