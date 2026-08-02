# gh2-cli

GitHub App lifecycle, fine-grained PAT, and Support operations from the terminal.

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
gh2 app permissions <slug> [--org <org>] [--set <permission>=none|read|write] [--yes]
gh2 app token --installation <id> [--stage <s>]
gh2 app export [--stage <s>] [--output <path>|-]
gh2 app login
gh2 app list  [--org <org>]
gh2 pat login
gh2 pat create --account <login> --name <name> --owner <login> \
  --repos <all|none|repo,...> --permissions <permission=read|write|admin,...> \
  --expires-in <days|none> [--yes --token-output <new-file|->]
gh2 support login
gh2 support create --subject <subject> --body <body> [--account <identifier>] [--yes]
```

### GitHub App permissions

Permission changes are a live-authenticated dry run unless `--yes` is present.
The command preserves every permission and subscribed event not named in
`--set`, then reads the live form again before reporting success.

```bash
# Inspect currently selected permissions
gh2 app permissions my-bot --org my-org

# Preview a change
gh2 app permissions my-bot --org my-org --set actions=read

# Submit the reviewed change
gh2 app permissions my-bot --org my-org \
  --set actions=read \
  --note "Read workflow activity for the weekly repository policy review." \
  --yes
```

GitHub does not expose a public REST endpoint for changing a GitHub App
registration's permissions, so this command replays the owner settings form with
the session captured by `gh2 app login`. Existing installations may still require
their owners to accept newly requested permissions in GitHub.

### Fine-grained personal access tokens

`gh2 pat create` uses GitHub's authenticated fine-grained PAT form because GitHub
does not expose a public API that returns a newly created PAT. It verifies the
captured account, resource owner, repository IDs, permission names and levels,
and expiration policy against the live form before offering submission. The
command adds the mandatory `metadata=read` permission automatically.

```bash
gh2 pat login

# Live-authenticated dry run. No token is created.
gh2 pat create \
  --account melten-admin \
  --name "Melten Priority Reconciler" \
  --description "Reconcile repository priorities from melten-policies." \
  --reason "Automate the approved organization-wide priority policy." \
  --owner melten-ai \
  --repos pcie_gen4_pipe_axis_tl,silicon-workbench \
  --permissions issues=write \
  --expires-in 30

# Create after reviewing the dry run and send only the token to gh.
gh2 pat create \
  --account melten-admin \
  --name "Melten Priority Reconciler" \
  --description "Reconcile repository priorities from melten-policies." \
  --reason "Automate the approved organization-wide priority policy." \
  --owner melten-ai \
  --repos pcie_gen4_pipe_axis_tl,silicon-workbench \
  --permissions issues=write \
  --expires-in 30 \
  --yes \
  --token-output - | gh secret set GH_TOKEN --repo melten-ai/docs
```

Submission requires both `--yes` and `--token-output`. `--token-output -` reserves
stdout for the token so it can be piped without mixing in status output. A file
destination must not already exist and is created with mode `0600`. The token is
never included in table or JSON metadata output. GitHub can still place an
organization-owned token into pending approval after creation.

### GitHub Support tickets

`gh2 support create` signs in to `support.github.com` through GitHub OAuth using the session captured by `gh2 support login`. It does not open a browser. The default is a live-authenticated dry run; add `--yes` only after reviewing the exact ticket.

```bash
gh2 support login

gh2 support create \
  --account "Circles Inc." \
  --subject "Remove sensitive data from repository history" \
  --body-file ./ticket.md

# Submit the reviewed ticket
gh2 support create \
  --account "Circles Inc." \
  --subject "Remove sensitive data from repository history" \
  --body-file ./ticket.md \
  --yes
```

The command uses GitHub Support's authenticated web endpoint because GitHub does not publish a Support ticket REST or GraphQL API. Portal changes can therefore require a `gh2` update. If GitHub requires a captcha, the command refuses to submit and directs the operator to the portal.

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
| Web session (cookies) | OS keystore extract → `~/.gh2/auth.json` | App `login`/`list`/`permissions`/`delete`, Support `login`/`create` |
| API (JWT) | RS256 sign with app PEM | `info`, `update`, `token`, `register` |

## License

MIT
