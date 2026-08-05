# Live contract canary

`gh2 doctor` runs the browser-cookie integrations without submitting any change. It executes only read operations and commands whose default behavior is a dry run, captures their output instead of printing settings data, and reports one status per GitHub surface.

```bash
gh2 app login

gh2 doctor \
  --org example-org \
  --app example-app \
  --installation 12345 \
  --support \
  --pat-account example-user \
  --pat-owner example-org \
  --pat-repo example-repo \
  --output json
```

Exit `0` means every requested parser reached and understood the live page. Exit `2` means GitHub requires a refreshed browser session or sudo authentication; this is not reported as parser drift. Exit `1` means a form contract changed or another probe failed.

GitHub Actions cannot safely keep a browser session with periodic sudo authentication, so schedule this command on a trusted local machine rather than storing GitHub cookies in repository secrets. Run `gh2 app login` again when the canary reports `reauth_required`, then rerun the same doctor command to distinguish an authentication gate from markup drift.

On macOS, use `launchd` with the absolute Homebrew `gh2` path and write stdout and stderr to a local state directory. Keep the job read-only and point it at a dedicated test App when App settings are included.
