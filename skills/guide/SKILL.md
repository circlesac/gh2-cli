---
name: gh2
description: Guide for creating and managing GitHub Apps and creating GitHub Support tickets via the gh2 CLI — manifest-based app creation, JWT-signed API operations, installation token minting, and browserless Support requests
user-invocable: false
---

# gh2 CLI

GitHub App lifecycle and Support operations from the terminal. Uses the GitHub App Manifest flow for creation, JWT-signed REST calls for supported App operations, and a cookie-authenticated Support portal session where GitHub exposes no public API.

## JSON contract

All config files are `github.<stage>.json` where `stage ∈ {local, prod}`:

```json
{
  "appId": 2864083,
  "name": "circlesac-yg2",
  "webhookSecret": "...",
  "privateKey": "<base64-encoded PEM>"
}
```

Padawan and other consumers read this file directly.

## Workflow

```bash
# Create a new GitHub App (opens browser to manifest flow, captures callback)
gh2 app create "my-bot" --stage local
gh2 app create "my-org-bot" --org my-org --stage prod

# Register an existing app from its PEM
gh2 app register 2864083 --pem ./private-key.pem --webhook-secret "xyz" --stage prod

# Show live app info via API (GET /app, JWT-signed)
gh2 app info                          # reads github.prod.json from cwd
gh2 app info --stage local
gh2 app info --output json

# Update the webhook URL (PATCH /app/hook/config)
gh2 app update --webhook-url https://my-host.com/github/webhooks

# Mint a short-lived installation access token
gh2 app token --installation 12345

# Dump local config to stdout or file
gh2 app export
gh2 app export --output -
```

## Browser-cookie commands

For ops that require a logged-in github.com session (e.g. listing apps you own — no API exists):

```bash
gh2 app login   # reads cookies from Chrome/Arc/Edge/Brave keystore on macOS
gh2 app list                    # personal apps
gh2 app list --org circlesac    # org apps
```

Session stored at `~/.gh2/auth.json`.

## GitHub Support

Create a ticket without opening the Support portal in a browser:

```bash
gh2 support login

# Dry run: authenticates and prints the exact ticket without creating it
gh2 support create \
  --account "Circles Inc." \
  --subject "Remove sensitive data from repository history" \
  --body-file ./ticket.md

# Submit only after reviewing the dry run
gh2 support create \
  --account "Circles Inc." \
  --subject "Remove sensitive data from repository history" \
  --body-file ./ticket.md \
  --yes
```

Use `--body -` to read the body from stdin. The command refuses submission if GitHub requires a captcha. Treat this as a web integration that may need updating when the Support portal changes.

## Default config path

By default, `gh2 app <verb>` reads/writes `github.<stage>.json` in the current working directory. Override with `--config <path>` or `--output <path>`.
