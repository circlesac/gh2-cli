# gh2-cli

## Release

Releases go through GitHub Actions. Do NOT manually bump versions or publish.

```bash
# 1. Run tests
bun run test

# 2. Push changes to main
git push origin main

# 3. Trigger release workflow
gh workflow run release.yml

# 4. Monitor until completion
RUN_ID=$(gh run list --workflow=release.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status

# 5. After success, update local binary
brew update && brew upgrade circlesac/tap/gh2
```

The workflow bumps CalVer via `@circlesac/oneup`, builds multi-platform binaries (darwin/linux, x64+arm64), creates a GitHub release, publishes to npm, and updates the Homebrew tap.

## JSON output contract

`gh2 app create` / `gh2 app register` write `github.<stage>.json` consumed by padawan:

```ts
interface GitHubAppConfig {
  appId: number;
  name: string;
  webhookSecret: string;
  privateKey: string; // base64-encoded PEM
}
```

`stage ∈ {"local", "prod"}`. Default location: cwd. Override with `--output <path>` or `-` for stdout.
