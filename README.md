# gh2-cli

GitHub App lifecycle CLI — create, register, and manage GitHub Apps from the terminal.

Mirror of [`circlesac/slack2-cli`](https://github.com/circlesac/slack2-cli) for the GitHub side.

## Install

```bash
# macOS / Linux (Homebrew)
brew install circlesac/tap/gh2

# Standalone (downloads platform binary)
curl -fsSL https://github.com/circlesac/gh2-cli/releases/latest/download/install.sh | sh

# npm
npm install -g @circlesac/gh2
```

## Usage

```
gh2 app create <name> [--org <org>] [--stage <s>]
gh2 app register <app-id> --pem <path> --webhook-secret <s> [--stage <s>]
gh2 app info  [<app-id>] [--stage <s>] [--output json]
gh2 app update [--webhook-url <url>] [--stage <s>]
gh2 app token --installation <id> [--stage <s>]
gh2 app export [--stage <s>] [--output <path>|-]
gh2 app login
gh2 app list  [--org <org>]
```

## Output contract

`gh2 app create` and `gh2 app register` write `github.<stage>.json` (`stage ∈ {local, prod}`) with this shape:

```ts
interface GitHubAppConfig {
  appId: number;
  name: string;
  webhookSecret: string;
  privateKey: string; // base64-encoded PEM
}
```

## Auth

| Channel | Mechanism | Used by |
|---|---|---|
| Web session (cookies) | OS keystore extract → `~/.gh2/auth.json` | `login`, `list` |
| API (JWT) | RS256 sign with app PEM | `info`, `update`, `token`, `register` |

## License

MIT
