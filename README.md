# gh2-cli

GitHub App lifecycle, fine-grained PAT, Support, and web-only administration operations from the terminal.

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
gh2 app key list <app> [--org <org>]
gh2 app key generate <app> [--org <org>] --key-output <new-file> [--yes]
gh2 app key delete <app> <key-id> [--org <org>] [--yes]
gh2 app key rotate <app> --delete-key <key-id> --key-output <new-file> [--org <org>] [--yes]
gh2 install approval show <installation-id> [--org <org>]
gh2 install approval accept <installation-id> [--org <org>] [--yes]
gh2 repo deleted list [--org <org>]
gh2 repo restore <owner/repository> [--yes]
gh2 org pat-policy show <org>
gh2 org pat-policy update <org> [--access restricted|unrestricted] \
  [--requests auto|manual] [--max-lifetime none|<days>] [--yes]
gh2 doctor --org <org> [--app <slug>] [--installation <id>] [--support]
gh2 pat login --account <login>
gh2 pat create --account <login> --name <name> --owner <login> \
  --repos <all|none|repo,...> --permissions <permission=read|write|admin,...> \
  --expires-in <days|none> [--yes --token-output <new-file|->]
gh2 support login
gh2 support create --subject <subject> --body <body> [--account <identifier>] [--yes]
gh2 support view <ticket> [--scope personal/0] [--output json]
gh2 support reply <ticket> --body <body> [--scope personal/0] [--yes]
```

### Administration boundary

`gh2` adds commands only for operations that have no complete first-class `gh`,
REST, or GraphQL mutation. When the public API fully covers an operation, use
`gh api` instead. Browser-cookie commands default to a live dry run, preserve
unmodified form controls, require `--yes` for submission, and re-read GitHub's
settings page before reporting success.

The full personal, organization, repository, and enterprise settings census is
in [`docs/github-admin-gap-census.md`](docs/github-admin-gap-census.md).

### Continuous live verification

`gh2 doctor` runs selected browser-cookie integrations in read-only or dry-run mode and classifies authentication gates separately from parser drift. Use it from a trusted local scheduler because GitHub's sensitive settings pages periodically require sudo authentication and browser cookies must not be stored in GitHub Actions secrets.

```bash
gh2 doctor --org example-org --app example-app --support --output json
```

See [`docs/live-canary.md`](docs/live-canary.md) for the full probe set, exit-code contract, and macOS scheduling guidance.

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

### GitHub App private keys

Private keys are managed through the App owner's authenticated settings page.
Generated PEM bytes are never printed and must go to a new `--key-output` file,
created with mode `0600`.

```bash
gh2 app key list my-bot --org example-org
gh2 app key generate my-bot --org example-org --key-output ./my-bot.pem
gh2 app key generate my-bot --org example-org --key-output ./my-bot.pem --yes
gh2 app key rotate my-bot --org example-org \
  --delete-key 12345 \
  --key-output ./my-bot-next.pem \
  --yes
```

Rotation generates and saves the replacement, verifies its public-key
fingerprint on GitHub, and only then deletes the exact ID passed to
`--delete-key`. The command never chooses an old key by position, age, or label.

### Installation permission approval

When an App registration requests new permissions, the installation owner can
inspect and accept the pending change without copying GitHub's opaque fingerprint
or version fields.

```bash
gh2 install approval show 12345 --org example-org
gh2 install approval accept 12345 --org example-org
gh2 install approval accept 12345 --org example-org --yes
```

Success requires the approval form to disappear and the installation detail
page to stop presenting the permission-update action.

### Deleted repository restoration

```bash
gh2 repo deleted list --org example-org
gh2 repo restore example-org/temporary-repository
gh2 repo restore example-org/temporary-repository --yes
```

The CLI resolves `owner/repository` against the live deleted-repository list,
submits only the matching restore form, and verifies that the restore entry is
gone. Repository deletion is not part of this command family.

### Organization fine-grained PAT policy

```bash
gh2 org pat-policy show example-org
gh2 org pat-policy update example-org \
  --access restricted \
  --requests manual \
  --max-lifetime 90
gh2 org pat-policy update example-org \
  --access restricted \
  --requests manual \
  --max-lifetime 90 \
  --yes
```

Access, request handling, and maximum lifetime are separate GitHub forms. `gh2`
submits and verifies them one at a time and reports any earlier verified changes
if a later form fails. Disabled controls are treated as inherited policy and are
not overridden.

### Fine-grained personal access tokens

`gh2 pat create` uses GitHub's authenticated fine-grained PAT form because GitHub
does not expose a public API that returns a newly created PAT. It verifies the
captured account, resource owner, repository IDs, permission names and levels,
and expiration policy against the live form before offering submission. The
command adds the mandatory `metadata=read` permission automatically.

```bash
gh2 pat login --account example-user

# Live-authenticated dry run. No token is created.
gh2 pat create \
  --account example-user \
  --name "Issue Sync" \
  --description "Synchronize approved issue metadata." \
  --reason "Run the repository's approved issue synchronization." \
  --owner example-org \
  --repos project-one,project-two \
  --permissions issues=write \
  --expires-in 30

# Create after reviewing the dry run and send only the token to gh.
gh2 pat create \
  --account example-user \
  --name "Issue Sync" \
  --description "Synchronize approved issue metadata." \
  --reason "Run the repository's approved issue synchronization." \
  --owner example-org \
  --repos project-one,project-two \
  --permissions issues=write \
  --expires-in 30 \
  --yes \
  --token-output - | gh secret set GH_TOKEN --repo example-org/project-one
```

Submission requires both `--yes` and `--token-output`. `--token-output -` reserves
stdout for the token so it can be piped without mixing in status output. A file
destination must not already exist and is created with mode `0600`. The token is
never included in table or JSON metadata output. GitHub can still place an
organization-owned token into pending approval after creation.

### GitHub Support tickets

The Support commands sign in to `support.github.com` through GitHub OAuth using the session captured by `gh2 support login`. They do not open a browser. Ticket creation and replies default to a live-authenticated dry run; add `--yes` only after reviewing the exact write.

```bash
gh2 support login

# Read the original body and every reply in chronological order
gh2 support view 1234567
gh2 support view 1234567 --scope personal/0 --output json

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

# Preview a reply; omit --yes unless posting was explicitly requested
gh2 support reply 1234567 --body-file ./reply.md
gh2 support reply 1234567 --body-file ./reply.md --yes
```

`support view --output json` returns `ticket`, `subject`, `status`, `account`, `scope`, `created_at`, `author`, `body`, and chronological `comments` containing `id`, `author`, `created_at`, and `body`. Authentication cookies and form tokens are never part of the output.

The commands use GitHub Support's authenticated web pages because GitHub does not publish a Support ticket REST or GraphQL API. Portal changes can therefore require a `gh2` update. If GitHub requires a captcha, ticket creation refuses to submit and directs the operator to the portal.

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
| Web session (cookies) | OS keystore extract → `~/.gh2/auth.json` | App `login`/`list`/`permissions`/`delete`/`key`, installation approval, repository restoration, organization PAT policy, PAT creation, Support |
| API (JWT) | RS256 sign with app PEM | `info`, `update`, `token`, `register` |

## License

MIT
