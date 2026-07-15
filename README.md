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

## Webhook lifecycle

`app create` registers the webhook **active**, with a placeholder URL; `app update --webhook-url <url>` points it at your real endpoint. A webhook's *active* flag can only be set in the create manifest — GitHub's `/app/hook/config` API rejects `active` — so an app created inactive is permanently undeliverable via the CLI (only manual "Redeliver" in the UI works). That's why `create` sets it active up front.

Consequences to expect:

- The **create-time verification ping** goes to the placeholder (or to your endpoint before it knows the app's webhook secret), so it will show as a **failed delivery** in the app's *Advanced → Recent Deliveries*. This is expected and harmless — GitHub only auto-disables after *sustained* failures, not one. Set the real URL with `app update`, deploy your endpoint, and real events flow.
- If you *did* create an app inactive (older versions), you can't fix it via the API — reactivate the webhook in the app's *Advanced* settings, or delete and recreate the app.

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
