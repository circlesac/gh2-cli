# gh2 GitHub administration gap census

## Conclusion

- The current issue is not exhaustive. It names 28 of 131 observed feature groups, including partial group coverage.
- The authenticated crawl closed on 627 page instances and 437 unique surface-route templates.
- The normalized inventory contains 453 unique static modifying form signatures and 106 route/React-App pairs.
- 49 candidate, mixed, read-only, or partially implemented feature groups are absent from issue #6.

## Scope and evidence

- Web: GET-only recursive crawl of personal settings under two authenticated accounts, organization settings under GitHub Free and Enterprise, one repository under each organization, and the full Enterprise administration tree.
- REST: GitHub's official `rest-api-description` `descriptions-next/api.github.com` at commit `5e28810649ba41b5483753ba74f976f83856a504` (808 paths, 1,219 operations).
- GraphQL: live schema introspection (258 mutations, 415 input object types).
- CLI: installed `gh 2.96.0` command reference (216 command/group headings). Because `gh api` can call public REST and GraphQL, API-backed operations are excluded even when no dedicated `gh` subcommand exists.
- The crawl records capability evidence, not entitlement guarantees. HTTP 200 pages containing upgrade or unavailable shells remain capability-dependent until their writable payload is verified.

## Free and Enterprise comparison

- Organization navigation exposed 65 Enterprise routes and 59 GitHub Free routes; 54 were shared.
- 37 of 40 normalized organization feature groups were observed on both plans.
- Enterprise navigation-only additions: `/rules/bypass_requests`, `/codespaces/policies`, `/copilot/seat_management`, `/copilot/coding_agent`, `/copilot/code_review`, `/copilot/internet_access`, `/copilot/runner_type`, `/actions/custom-images`, `/network_configurations`, `/org-custom-properties`, `/announcement`.
- Free navigation-only additions: `/billing/ai_usage`, `/licensing`, `/billing/payment_information`, `/billing/subscriptions`, `/secrets/agents`.
- Detail-route differences caused by owned Apps, tokens, rules, secrets, and existing objects are account-state differences, not plan evidence. The route TSV preserves them without labeling them as entitlements.
- A shared HTTP 200 route can still be an upgrade shell. Commands must probe the writable form or React payload instead of checking only the URL or status code.

## Disposition counts

| Disposition | Groups |
|---|---:|
| API | 32 |
| CANDIDATE | 32 |
| EXCLUDED | 4 |
| EXISTING | 3 |
| LOW | 6 |
| MIXED | 36 |
| NAV | 7 |
| READ | 5 |
| RISKY | 6 |

- `API`: use `gh api`, GraphQL, or an existing first-class `gh` command.
- `CANDIDATE`: web-only and suitable for gh2.
- `MIXED`: keep API-backed operations out; add only the enumerated web-only remainder.
- `EXISTING`: gh2 already covers part of the group and has verified gaps to add.
- `READ`: web-only report/list/export candidate.
- `LOW`: real web-only gap with low operational value.
- `RISKY`: security-critical or destructive; requires a separate explicit design.
- `EXCLUDED`: billing, purchases, or account recovery.
- `NAV`: no distinct administration mutation observed.

## Full feature matrix

| Surface | Feature group | Observed plans | Routes | Forms | React | Disposition | Public/API surface | `gh` | In #6 | Finding |
|---|---|---|---:|---:|---:|---|---|---|---|---|
| enterprise | Enterprise Actions policies | enterprise | 12 | 15 | 5 | MIXED | REST covers cache limits and OIDC; general allowed-actions, runner, retention, fork-PR, and workflow permission policies remain incomplete | gh api is partial | yes | The non-API policy remainder belongs in gh2. |
| enterprise | Enterprise administrators | enterprise | 3 | 1 | 0 | API | GraphQL administrator invitation, cancellation, role, and removal mutations | gh api graphql | no | Public GraphQL-backed. |
| enterprise | Enterprise advanced-security policy | enterprise | 3 | 4 | 2 | MIXED | REST covers code-security configurations; license policy and some custom-pattern UI remain incomplete | gh api is partial | no | Only web-only policy controls are gh2 candidates. |
| enterprise | Enterprise AI controls | enterprise | 3 | 2 | 1 | MIXED | REST covers coding-agent policy; broader Copilot and MCP controls are incomplete | gh api is partial | no | Capability-probed web commands are candidates. |
| enterprise | Enterprise announcement | enterprise | 1 | 2 | 0 | CANDIDATE | No public mutation found | none | no | Show/update/clear is a straightforward web-only policy. |
| enterprise | Enterprise audit-log settings | enterprise | 4 | 4 | 0 | MIXED | Official REST supports audit-log reads; event settings, streaming configuration, and export controls are incomplete | gh api for reads | no | Only missing configuration/export operations belong in gh2. |
| enterprise | Enterprise billing and licensing | enterprise | 18 | 10 | 6 | EXCLUDED | Billing and Copilot usage APIs are partial | none | no | Purchases, payment, budgets, cost centers, and cycle changes remain out of scope. |
| enterprise | Enterprise code-quality policy | enterprise | 1 | 0 | 1 | CANDIDATE | No complete enterprise policy mutation found | none | no | Entitlement-dependent React setting. |
| enterprise | Enterprise Codespaces | enterprise | 1 | 0 | 0 | NAV | No distinct mutation observed on the page | gh api | no | Navigation/read surface in the captured account. |
| enterprise | Enterprise compliance and dormant-user reports | enterprise | 20 | 1 | 0 | READ | No public report-generation/download API found | none | yes | Compliance downloads and dormant-user exports are high-value read-only gh2 workflows. |
| enterprise | Enterprise Copilot settings | enterprise | 1 | 0 | 0 | MIXED | REST covers selected policies and metrics; full settings surface is incomplete | gh api is partial | no | Missing policy controls require capability probes. |
| enterprise | Enterprise custom properties | enterprise | 2 | 0 | 2 | API | GraphQL repository custom-property mutations accept owner/source IDs | gh api graphql | no | Public GraphQL-backed where the owner type is supported. |
| enterprise | Enterprise verified domains | enterprise | 2 | 1 | 0 | API | GraphQL verifiable-domain mutations | gh api graphql | no | Public API-backed. |
| enterprise | Failed enterprise invitations | enterprise | 1 | 2 | 0 | CANDIDATE | No equivalent recovery mutation found | none | yes | Retry/cancel recovery is a web-only operational workflow. |
| enterprise | Enterprise onboarding | enterprise | 1 | 1 | 0 | NAV | Dismissal only | none | no | No reusable administration gap. |
| enterprise | Enterprise Apps, installations, and hooks | enterprise | 5 | 2 | 0 | MIXED | Webhook APIs exist; App registration and installation approval remain partial | gh api is partial | yes | Apply the same gh2 App lifecycle model at enterprise scope. |
| enterprise | Enterprise Copilot and Actions insights | enterprise | 3 | 0 | 3 | API | REST metrics/report endpoints cover the principal data | gh api | no | Use public report APIs; only UI-specific exports may remain. |
| enterprise | Enterprise member privileges | enterprise | 1 | 11 | 0 | MIXED | GraphQL exposes many enterprise setting mutations; some web form fields remain unmatched | gh api graphql is partial | no | Use GraphQL first and add only unmatched policies to gh2. |
| enterprise | Enterprise people and membership exports | enterprise | 17 | 2 | 0 | MIXED | GraphQL covers invitations and membership changes; CSV export is web-only | gh api graphql | yes | Only export/report workflows belong in gh2. |
| enterprise | Enterprise hosted-compute networking | enterprise | 2 | 0 | 2 | CANDIDATE | Public REST exposes organization-level, not complete enterprise-level configuration | gh api is partial | no | React endpoints require entitlement and schema probes. |
| enterprise | Enterprise organizations and transfers | enterprise | 22 | 4 | 0 | MIXED | GraphQL covers creation and membership; transfer and some settings flows remain web-only | gh api graphql | no | Transfers are risky; ordinary organization operations should use GraphQL. |
| enterprise | Enterprise overview | enterprise | 1 | 1 | 0 | LOW | Profile description has GraphQL coverage | gh api graphql | no | Long-description editing is a low-priority web remainder. |
| enterprise | Enterprise PAT policies | enterprise | 2 | 4 | 0 | CANDIDATE | No complete public policy mutation found | none | no | Fine-grained and classic PAT policy settings are web-only candidates. |
| enterprise | Enterprise repository and code policies | enterprise | 6 | 0 | 5 | API | GraphQL repository-ruleset mutations support owner/source IDs; REST covers lower scopes | gh api graphql | no | Public API-backed where enterprise ownership is accepted. |
| enterprise | Enterprise profile and slug | enterprise | 1 | 4 | 0 | MIXED | GraphQL updateEnterpriseProfile covers core fields; slug and footer links are web-only | gh api graphql | no | Slug changes are risky; footer links are a lower-priority gap. |
| enterprise | Enterprise Projects policy | enterprise | 1 | 2 | 0 | API | GraphQL enterprise project-setting mutations | gh api graphql | no | Public API-backed. |
| enterprise | Enterprise and organization roles | enterprise | 5 | 0 | 3 | MIXED | GraphQL covers administrator/owner roles; custom role definitions and some assignments remain incomplete | gh api graphql | no | Only unmatched custom-role CRUD belongs in gh2. |
| enterprise | Enterprise SAML | enterprise | 1 | 0 | 0 | RISKY | No complete public SAML-provider configuration mutation found | none | no | Authentication-critical workflow requiring separate safeguards. |
| enterprise | Enterprise Sandboxes | enterprise | 1 | 1 | 0 | CANDIDATE | No public toggle found | none | no | Entitlement-dependent web-only setting. |
| enterprise | Enterprise authentication security | enterprise | 1 | 6 | 0 | MIXED | GraphQL covers 2FA and IP allow-list settings; SAML provider and several controls remain web-only | gh api graphql is partial | no | Web-only remainder is high risk and should be isolated. |
| enterprise | Enterprise code-security settings | enterprise | 6 | 9 | 4 | MIXED | REST covers code-security configurations; some policies, custom-pattern controls, and delegated reviewer settings remain incomplete | gh api is partial | no | Add only verified web-only controls. |
| enterprise | Enterprise security center and review requests | enterprise | 18 | 0 | 9 | MIXED | Alert APIs cover major alert types; dismissal, bypass, and license-compliance request review remains incomplete | gh api is partial | no | Read/report via APIs; web-only request review is a gh2 candidate. |
| enterprise | Enterprise sponsorship policy | enterprise | 1 | 2 | 0 | LOW | No complete enterprise setting API | none | no | Low-priority and financially adjacent. |
| enterprise | Enterprise SSH certificate authorities | enterprise | 1 | 1 | 0 | RISKY | No public mutation found | none | no | Security-critical CA management. |
| enterprise | Enterprise support settings | enterprise | 1 | 1 | 0 | MIXED | GraphQL supports support entitlements; Support portal operations are web-only | none | no | gh2 already supports Support tickets; entitlement operations should use GraphQL. |
| enterprise | Enterprise teams | enterprise | 1 | 0 | 1 | API | REST enterprise-team endpoints | gh api | no | Public API-backed. |
| organization | Actions policies and runners | enterprise+free | 11 | 14 | 4 | API | REST Actions permissions, runner groups, hosted runners, caches, and OIDC | gh api | no | Organization Actions administration is broadly public API-backed. |
| organization | Organization announcement | enterprise | 1 | 2 | 0 | CANDIDATE | No public mutation found | none | yes | Enterprise-plan capability; show/update/clear fits gh2. |
| organization | Organization audit log | enterprise+free | 2 | 2 | 0 | MIXED | Official REST supports audit-log reads; observed export forms and some presentation settings are web endpoints | gh api for reads | no | Only missing export/configuration operations belong in gh2. |
| organization | Organization billing and licensing | enterprise+free | 9 | 9 | 6 | EXCLUDED | Billing data APIs are partial | none | no | Purchase, payment, plan, and license mutations remain out of scope. |
| organization | Organization blocked users | enterprise+free | 1 | 1 | 0 | API | REST organization blocking endpoints | gh api | no | Public API-backed. |
| organization | Organization code-review limits | enterprise+free | 1 | 1 | 0 | CANDIDATE | No public write operation found | none | no | Web-only organization policy. |
| organization | Organization code quality | enterprise+free | 1 | 0 | 1 | API | REST code-quality setup and findings | gh api | no | Use public API where available. |
| organization | Organization Codespaces | enterprise+free | 3 | 3 | 0 | MIXED | REST covers access and secrets; user limit, trusted repositories, and some policy defaults are web-only | gh api | no | Expose only the settings absent from REST. |
| organization | Organization compliance reports | enterprise+free | 2 | 0 | 0 | READ | No public report-download API found | none | yes | List/download is a read-only gh2 candidate. |
| organization | Organization Copilot settings | enterprise+free | 6 | 5 | 5 | MIXED | REST covers seats and selected policies; code review, internet access, runner type, and other policy UIs remain incomplete | gh api | no | Capability-probed web commands are candidates for missing policy controls. |
| organization | Organization custom properties | enterprise+free | 3 | 0 | 3 | API | REST custom-property schema and value endpoints | gh api | no | Public API-backed. |
| organization | Organization deleted repositories | enterprise+free | 1 | 1 | 0 | CANDIDATE | No public restore endpoint found | none | yes | High-value restore workflow. |
| organization | Organization Dependabot rules | enterprise+free | 3 | 2 | 0 | CANDIDATE | No public rule CRUD operation found | none | no | Default and custom Dependabot rules are web forms. |
| organization | Organization deploy-key policy | enterprise+free | 1 | 1 | 0 | MIXED | REST manages repository deploy keys, not the observed organization-wide policy | gh api | no | Only the organization policy is a gh2 gap. |
| organization | Organization Discussions toggle | enterprise+free | 1 | 1 | 0 | CANDIDATE | No public organization toggle found | gh discussion manages content, not the organization setting | no | Small web-only organization setting. |
| organization | Organization domains and Pages | enterprise+free | 3 | 2 | 0 | API | GraphQL verifiable domains and REST Pages APIs | gh api | no | Public API-backed. |
| organization | Organization-owned GitHub Apps and managers | enterprise+free | 9 | 15 | 0 | EXISTING | Registration permissions, keys, secrets, managers, transfer, and approval remain web-only | no first-class App administration | yes | gh2 covers part of this and should expand. |
| organization | Organization webhooks | enterprise+free | 2 | 1 | 0 | API | REST organization webhook endpoints | gh api | no | Public API-backed. |
| organization | Organization import/export and attribution | enterprise+free | 2 | 0 | 0 | MIXED | GraphQL supports attribution invitations and migration APIs exist; account export UI remains separate | gh api | no | Only the web-only archive/export remainder is a later gh2 candidate. |
| organization | Organization App installations | enterprise+free | 3 | 5 | 0 | MIXED | REST covers installation data and repository access; permission approval remains web-only | gh api | yes | Approval/configuration orchestration belongs in gh2. |
| organization | Organization interaction limits | enterprise+free | 1 | 1 | 0 | API | REST interactions endpoints | gh api | no | Public API-backed. |
| organization | Organization issue types and fields | enterprise+free | 6 | 0 | 6 | API | REST issue-type and issue-field endpoints plus GraphQL | gh api | no | Public API-backed. |
| organization | Organization member privileges | enterprise+free | 1 | 17 | 0 | MIXED | PATCH organization and GraphQL cover a subset; numerous writable web fields have no public mutation | gh api is partial | no | Prime gh2 gap: outside-collaborator invites, discussion creation, project base role, App request/install policy, visibility/delete permissions, team creation, dependency insights, and rename relaxation. |
| organization | Organization hosted-compute networking | enterprise | 1 | 0 | 1 | API | REST hosted-compute network-configuration endpoints | gh api | no | Enterprise entitlement, but API-backed. |
| organization | Organization OAuth App policy | enterprise+free | 1 | 1 | 0 | CANDIDATE | No public policy mutation found | none | yes | Restrict/unrestrict access is a repeatable web setting. |
| organization | Organization OAuth Apps | enterprise+free | 6 | 8 | 0 | CANDIDATE | No public registration lifecycle API | none | no | Create, settings, secrets, transfer, and delete are web-only. |
| organization | Organization package defaults | enterprise+free | 1 | 2 | 0 | CANDIDATE | Package object APIs do not expose default visibility and inheritance policy | gh api for package objects | no | Web-only default policy. |
| organization | Organization PAT controls | enterprise+free | 6 | 4 | 0 | MIXED | REST covers requests and grants; restriction, auto-approval, and lifetime policies are web-only | gh api for requests/grants | yes | Policy show/update belongs in gh2; request review should remain API-backed. |
| organization | Organization profile and lifecycle | enterprise+free | 1 | 7 | 0 | MIXED | REST updates core profile fields; rename, terms, archive, and deletion are web-only | gh api | no | Profile fields stay on API; destructive lifecycle needs separate guarded commands. |
| organization | Organization Projects policy | enterprise+free | 1 | 1 | 0 | MIXED | REST can enable organization projects; member visibility policy is web-only | gh project manages projects, not this policy | no | Only the missing policy field is a gh2 candidate. |
| organization | Verified publisher | enterprise+free | 1 | 2 | 0 | CANDIDATE | No public verification workflow found | none | yes | Status and verification request are web-only. |
| organization | Organization scheduled reminders | enterprise+free | 1 | 1 | 0 | CANDIDATE | No public settings API | none | yes | Repeatable web-only workflow. |
| organization | Organization repository defaults | enterprise+free | 1 | 7 | 0 | MIXED | Some settings have REST/GraphQL equivalents; default branch, commit comments, release defaults, and default labels are incomplete | gh api is partial | yes | Expose only the non-API defaults. |
| organization | Organization roles | enterprise+free | 5 | 0 | 2 | MIXED | REST supports organization-role assignments; role definition and some custom-role management remain web-only | gh api | no | Custom role CRUD is a gh2 candidate; assignments should use the API. |
| organization | Organization rulesets | enterprise+free | 7 | 2 | 6 | API | REST organization ruleset endpoints | gh ruleset + gh api | no | Public API and first-class gh support exist. |
| organization | Organization Sandboxes | enterprise+free | 1 | 1 | 0 | CANDIDATE | No public toggle found | none | no | Entitlement-dependent web-only setting. |
| organization | Organization secrets and variables | enterprise+free | 16 | 8 | 0 | API | REST Actions, Codespaces, Dependabot, private registry, and variable endpoints | gh secret; gh variable; gh api | no | Public API-backed. |
| organization | Organization authentication and code security | enterprise+free | 10 | 18 | 5 | MIXED | GraphQL covers IP allow lists; REST covers code-security configurations and custom patterns; SAML configuration, 2FA enforcement, and several defaults remain web-only | gh api is partial | no | Web-only security mutations are high risk and require a separate command family. |
| organization | Organization sponsorship log | enterprise+free | 1 | 0 | 0 | READ | GraphQL is partial | gh api graphql | no | Low-priority read/export surface. |
| organization | Organization SSH certificate authorities | enterprise | 1 | 1 | 0 | RISKY | No public mutation found | none | no | Security-critical certificate authority management needs explicit safeguards. |
| personal | Accessibility preferences | enterprise+free | 1 | 6 | 0 | LOW | No public mutation found | none | no | Keyboard, motion, link underline, hovercard, and paste behavior are web-only but low operational value. |
| personal | Account lifecycle | enterprise+free | 1 | 4 | 0 | RISKY | No complete public lifecycle API | none | no | Rename, account export, and successor changes need dedicated destructive workflows. |
| personal | Appearance preferences | enterprise+free | 1 | 5 | 0 | LOW | No public mutation found | none | no | Theme, skin tone, tab width, and font preferences are web-only. |
| personal | Personal billing | enterprise+free | 9 | 6 | 5 | EXCLUDED | Billing APIs are not a general mutation surface | none | no | Payment, budgets, licensing, and purchase changes remain out of scope. |
| personal | Blocked users | enterprise+free | 1 | 2 | 0 | API | REST user-blocking endpoints | gh api | no | Public REST already supports list, block, and unblock. |
| personal | Code review limits | enterprise+free | 1 | 1 | 0 | CANDIDATE | No public write operation found | none | no | A repeatable web-only account preference. |
| personal | Codespaces settings | enterprise+free | 2 | 14 | 0 | MIXED | REST covers user secrets; web-only preferences remain | gh codespace + gh api | yes | Dotfiles, GPG, sync, editor, timeout, retention, host image, location, and trusted repository defaults are gaps. |
| personal | Personal Copilot settings | enterprise+free | 4 | 5 | 1 | CANDIDATE | No complete public preference API | gh copilot does not manage account policy | no | Feature, coding-agent, and memory preferences are entitlement-dependent web settings. |
| personal | SSH/GPG and credential preferences | enterprise+free | 4 | 4 | 0 | MIXED | REST covers SSH/GPG keys; commit-verification preference is web-only | gh ssh-key; gh gpg-key | no | Do not duplicate key management; only the remaining preference is a gap. |
| personal | Deleted repository restoration | enterprise+free | 1 | 1 | 0 | CANDIDATE | No public restore endpoint found | none | yes | Restore is a high-value, verifiable web workflow. |
| personal | Developer settings navigation | enterprise+free | 1 | 0 | 0 | NAV | Navigation only | none | no | No distinct mutation beyond OAuth Apps, GitHub Apps, and tokens. |
| personal | Verified domains | enterprise+free | 2 | 1 | 0 | API | GraphQL verifiable-domain mutations | gh api graphql | no | Add, verify, approve, regenerate, and delete are public GraphQL operations. |
| personal | Education benefits | enterprise+free | 1 | 0 | 0 | NAV | External eligibility workflow | none | no | Not an administration automation target. |
| personal | Email addresses and roles | enterprise+free | 2 | 6 | 0 | MIXED | REST covers list/add/delete; primary, backup, visibility, and identity unlink are web-only | gh api | yes | Only web-only email-role operations belong in gh2. |
| personal | Enterprise memberships | enterprise+free | 1 | 0 | 0 | NAV | Membership data is queryable | gh api | no | The observed page is primarily navigation. |
| personal | Owned and authorized GitHub Apps | enterprise+free | 9 | 14 | 0 | EXISTING | App JWT API is partial; registration keys, secrets, permissions, managers, transfer, and beta settings are web-only | no first-class App administration | yes | gh2 already covers create/list/info/update/permissions/delete/token; substantial lifecycle gaps remain. |
| personal | Installed GitHub Apps | enterprise+free | 3 | 4 | 0 | MIXED | REST covers installation data and repository selection for an App; approval/configuration UI is incomplete | gh api | yes | Permission approval and browser-session configuration remain gh2 candidates. |
| personal | Interaction limits | enterprise+free | 1 | 1 | 0 | API | REST interactions endpoints | gh api | no | Public REST supports get, set, and remove. |
| personal | Notification routing | enterprise+free | 2 | 0 | 2 | CANDIDATE | No complete public settings API | none | yes | Default channels and custom routing are React-backed web settings. |
| personal | OAuth grants and OAuth Apps | enterprise+free | 3 | 6 | 0 | CANDIDATE | No general user-facing API for listing and revoking all authorized grants | none | no | Grant inspection/revocation and OAuth App registration lifecycle are web-only gaps. |
| personal | ORCID connection | enterprise+free | 1 | 0 | 0 | LOW | No public mutation found | none | no | Low-frequency identity-linking workflow. |
| personal | Organization memberships | enterprise+free | 1 | 1 | 0 | RISKY | Membership APIs are partial | gh api | no | Leaving organizations is destructive and should not be a generic settings command. |
| personal | Package defaults | enterprise+free | 1 | 1 | 0 | CANDIDATE | Package CRUD APIs do not expose this account default | gh api for package objects | no | Container permission inheritance default is web-only. |
| personal | Personal access tokens | enterprise+free | 7 | 6 | 0 | EXISTING | No API returns a newly created fine-grained PAT; own-token lifecycle remains web-only | gh auth manages gh credentials, not PAT inventory | no | gh2 already creates fine-grained PATs; list, regenerate, expiration, and revoke are additional sensitive gaps. |
| personal | Profile and privacy | enterprise+free | 2 | 12 | 0 | MIXED | REST updates core profile fields; private contributions, badges, language, pronouns, and related preferences remain web-only | gh api | no | Only non-API preference fields are gh2 candidates, with low priority. |
| personal | Scheduled reminders | enterprise+free | 2 | 2 | 0 | CANDIDATE | No public settings mutation found | none | yes | Authorization and schedule settings are repeatable web workflows. |
| personal | Saved replies | enterprise+free | 1 | 1 | 0 | CANDIDATE | No public CRUD endpoint found | none | yes | Straightforward web-only CRUD. |
| personal | Personal repository defaults and memberships | enterprise+free | 1 | 3 | 0 | MIXED | Repository object APIs exist; account-wide default branch and commit-comment defaults do not | gh repo + gh api | no | Defaults are candidates; leaving repositories is a risky separate workflow. |
| personal | Password and authentication | enterprise+free | 1 | 9 | 0 | EXCLUDED | Account-recovery and authentication mutations intentionally lack general APIs | gh auth does not manage GitHub account factors | no | Password, 2FA, passkeys, recovery codes, and factor removal remain explicit non-goals. |
| personal | Personal code-security defaults | enterprise+free | 1 | 17 | 0 | CANDIDATE | Repository and organization APIs do not expose the complete user-level defaults | gh api is partial | no | Dependency graph, Dependabot, private reporting, and push-protection defaults are web-only at account scope. |
| personal | Personal security log | enterprise+free | 2 | 1 | 0 | READ | No public personal security-log endpoint found | none | no | Read/export could be useful, but it is not a settings mutation. |
| personal | Web sessions | enterprise+free | 2 | 1 | 0 | RISKY | No complete public session-revocation API | none | yes | List and revoke are useful but security-sensitive and require exact-device confirmation. |
| personal | Sponsorship log | enterprise+free | 1 | 0 | 0 | READ | GraphQL covers sponsorship objects but not the complete account log | gh api graphql | no | Low-priority read/export surface. |
| personal | Team memberships | enterprise+free | 1 | 0 | 0 | NAV | REST/GraphQL team APIs | gh api | no | No distinct personal settings mutation observed. |
| repository | Repository access | enterprise+free | 1 | 5 | 0 | API | REST collaborators, teams, invitations, and permissions | gh api | no | Public API-backed. |
| repository | Repository Actions settings | enterprise+free | 5 | 8 | 2 | API | REST Actions permissions, workflow policy, retention, cache, runners, and OIDC | gh api | no | Public API-backed. |
| repository | Repository code-review limits | free | 1 | 1 | 0 | CANDIDATE | No public mutation found | none | no | Web-only repository setting. |
| repository | Repository code security | enterprise+free | 4 | 16 | 2 | API | REST repository settings, code scanning, code quality, secret scanning, and Dependabot endpoints | gh api | no | Public API-backed except separately listed web-only products. |
| repository | Repository Copilot and agent settings | enterprise+free | 6 | 0 | 6 | CANDIDATE | No complete public settings API | gh copilot does not manage repository policy | yes | Code review, coding agent, internet access, allowlist, MCP, and memory are web-only or incomplete. |
| repository | Repository custom-property values | enterprise+free | 1 | 0 | 1 | API | REST repository custom-property values | gh api | no | Public API-backed. |
| repository | Repository Dependabot rules | free | 4 | 3 | 0 | CANDIDATE | No public rule CRUD operation found | none | no | Preset and custom Dependabot rules are web-only. |
| repository | Repository deploy keys and links | enterprise+free | 4 | 2 | 0 | API | REST deploy-key endpoints | gh api | no | Public API-backed; key-link presentation is not a separate lifecycle gap. |
| repository | Repository environments | enterprise+free | 2 | 1 | 0 | API | REST environments, protection rules, secrets, and variables | gh secret; gh variable; gh api | no | Public API-backed. |
| repository | Repository general settings | enterprise+free | 1 | 28 | 0 | MIXED | REST/GraphQL cover most repository fields; commit comments, funding-link toggle, wiki write policy, archive LFS behavior, auto-close, max pushes, release immutability, and some presentation settings remain absent | gh repo edit + gh api | no | Only the enumerated non-API fields are gh2 candidates; delete/visibility/transfer are risky or API-backed. |
| repository | Repository webhooks | enterprise+free | 2 | 1 | 0 | API | REST repository webhook endpoints | gh api | no | Public API-backed. |
| repository | Repository App installations | enterprise+free | 2 | 0 | 0 | MIXED | Installation APIs are App-scoped; repository-owner configuration and permission approval remain web-only | gh api is partial | yes | Configuration orchestration is a gh2 candidate. |
| repository | Repository interaction limits | free | 1 | 4 | 0 | API | REST interactions endpoints | gh api | no | Public API-backed. |
| repository | Repository license policy | enterprise | 1 | 0 | 1 | CANDIDATE | No public policy mutation found | none | yes | React-backed web-only policy. |
| repository | Repository email notifications | enterprise+free | 1 | 1 | 0 | CANDIDATE | No public repository notification-service setting found | none | no | Web-only repository notification routing. |
| repository | Repository social preview | free | 1 | 0 | 0 | LOW | No public image-setting mutation found | none | no | Low-priority web-only presentation setting. |
| repository | Repository Pages | enterprise+free | 1 | 2 | 0 | API | REST Pages endpoints | gh api | no | Public API-backed. |
| repository | Repository role details | enterprise | 1 | 0 | 0 | NAV | Permission data is queryable | gh api | no | Read-only role description page. |
| repository | Repository branch protection and rulesets | enterprise+free | 5 | 1 | 2 | API | REST branch protection and ruleset endpoints | gh ruleset + gh api | no | Public API-backed. |
| repository | Repository secrets and variables | enterprise+free | 14 | 7 | 0 | API | REST Actions, Codespaces, Dependabot, environment, and agent secret/variable endpoints | gh secret; gh variable; gh api | no | Public API-backed. |
| repository | Issue triage suggestions | enterprise+free | 1 | 0 | 1 | CANDIDATE | No public settings mutation found | none | yes | React-backed web-only setting. |

## Web-gap operation inventory

### enterprise: Enterprise Actions policies

- Disposition: `MIXED`; issue #6: `yes`; observed plans: `enterprise`.
- Finding: The non-API policy remainder belongs in gh2.
- Routes: `/enterprises/{enterprise}/actions/metrics/performance`, `/enterprises/{enterprise}/actions/metrics/usage`, `/enterprises/{enterprise}/settings/actions`, `/enterprises/{enterprise}/settings/actions/custom-images`, `/enterprises/{enterprise}/settings/actions/github-hosted-runners/new`, `/enterprises/{enterprise}/settings/actions/hosted-runners`, `/enterprises/{enterprise}/settings/actions/oidc-configuration`, `/enterprises/{enterprise}/settings/actions/runner-groups`, `/enterprises/{enterprise}/settings/actions/runner-groups/1`, `/enterprises/{enterprise}/settings/actions/runner-groups/new`, `/enterprises/{enterprise}/settings/actions/runners`, `/enterprises/{enterprise}/settings/actions/runners/new`.
- React apps: `actions-metrics`, `actions-oidc-configuration`, `custom-images`, `github-hosted-runners-settings`.
- Capability markers: `Upgrade`.
- Static modifying forms:
  - `DELETE /enterprises/{enterprise}/notices/larger_runners_setup_default_dialog_available :: `
  - `POST /enterprises/{enterprise}/settings/actions/github-hosted-runners/setup-default-runners :: `
  - `POST /enterprises/{enterprise}/settings/actions/runner-groups :: allow_public,name,restricted_to_workflows,selected_workflow_refs,visibility`
  - `PUT /enterprises/{enterprise}/settings/actions/cache_retention :: limit`
  - `PUT /enterprises/{enterprise}/settings/actions/cache_size_limit :: limit`
  - `PUT /enterprises/{enterprise}/settings/actions/policies/actions_access :: `
  - `PUT /enterprises/{enterprise}/settings/actions/policies/allowed_actions :: allowedactions,firstparty,marketplace,patterns,sha_pinning`
  - `PUT /enterprises/{enterprise}/settings/actions/policies/default_workflow_permissions :: actions_default_workflow_permissions,actions_workflow_permission_can_approve_pr`
  - `PUT /enterprises/{enterprise}/settings/actions/policies/fork_pr_approvals_policy :: actions_fork_pr_approvals`
  - `PUT /enterprises/{enterprise}/settings/actions/policies/fork_pr_workflows_policy :: fork_pr_workflows_policy[require_approvals],fork_pr_workflows_policy[run_workflows],fork_pr_workflows_policy[send_secrets],fork_pr_workflows_policy[write_tokens]`
  - `PUT /enterprises/{enterprise}/settings/actions/policies/repo_self_hosted_runners :: repo_self_hosted_runners_is_disabled`
  - `PUT /enterprises/{enterprise}/settings/actions/policies/standard_hosted_runners :: disable_standard_hosted_runners_for_business`
  - `PUT /enterprises/{enterprise}/settings/actions/retention :: limit`
  - `PUT /enterprises/{enterprise}/settings/actions/runner-groups/1 :: allow_public,name,restricted_to_workflows,selected_workflow_refs,visibility`
  - `PUT /{name}/managed-eda/suites/{id}/cancel :: `

### enterprise: Enterprise advanced-security policy

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Only web-only policy controls are gh2 candidates.
- Routes: `/enterprises/{enterprise}/settings/advanced_security/custom_patterns/new`, `/enterprises/{enterprise}/settings/advanced_security/license_policy`, `/enterprises/{enterprise}/settings/advanced_security/license_policy/default`.
- React apps: `license-policy`.
- Static modifying forms:
  - `POST /enterprises/{enterprise}/settings/advanced_security/custom_patterns/dry_run_update_selected_repositories :: repo_id`
  - `POST /enterprises/{enterprise}/settings/advanced_security/custom_patterns/get_generated_expressions :: `
  - `POST /enterprises/{enterprise}/settings/advanced_security/test_custom_secret_scanning_pattern :: test_code`
  - `POST /replace :: after_secret,before_secret,display_name,post_processing_0,post_processing_1,post_processing_2,post_processing_3,post_processing_4,post_processing_5,post_processing_6,post_processing_7,post_processing_8,post_processing_9,post_processing_rule_0,post_processing_rule_1,post_processing_rule_2,post_processing_rule_3,post_processing_rule_4,post_processing_rule_5,post_processing_rule_6,post_processing_rule_7,post_processing_rule_8,post_processing_rule_9,row_version,secret_format,selected_repo_ids`

### enterprise: Enterprise AI controls

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Capability-probed web commands are candidates.
- Routes: `/enterprises/{enterprise}/ai-controls/agents`, `/enterprises/{enterprise}/ai-controls/copilot`, `/enterprises/{enterprise}/ai-controls/mcp`.
- React apps: `copilot-agent-plane`.
- Capability markers: `Enterprise account`.
- Static modifying forms:
  - `POST /enterprises/{enterprise}/settings/copilot/mcp_registries :: commit,copilot_mcp_registry[registry_access],copilot_mcp_registry[registry_url]`
  - `PUT /enterprises/{enterprise}/settings/update_copilot_policy :: mcp,tab`

### enterprise: Enterprise announcement

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Show/update/clear is a straightforward web-only policy.
- Routes: `/enterprises/{enterprise}/settings/announcement`.
- Static modifying forms:
  - `PATCH /enterprises/{enterprise}/settings/announcement :: base_commit_oid,comment_id,custom_messages[announcement],custom_messages[announcement_expires_at],custom_messages[user_dismissible],end_commit_oid,line,path,preview_side,preview_start_side,saved_reply_id,start_commit_oid,start_line`
  - `PUT /enterprises/{enterprise}/settings/preview_announcement :: announcement_preview_user_dismissible,announcement_preview_value`

### enterprise: Enterprise audit-log settings

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Only missing configuration/export operations belong in gh2.
- Routes: `/enterprises/{enterprise}/settings/audit-log`, `/enterprises/{enterprise}/settings/audit-log/event_settings`, `/enterprises/{enterprise}/settings/audit-log/results`, `/enterprises/{enterprise}/settings/audit-log/streams`.
- Capability markers: `Enterprise account`, `Upgrade`.
- Static modifying forms:
  - `POST /enterprises/{enterprise}/settings/audit-log/export-git.json :: end,start`
  - `POST /enterprises/{enterprise}/settings/audit-log/export.json :: q`
  - `PUT /enterprises/{enterprise}/settings/update_event_settings :: business[api_request_events_enabled]`
  - `PUT /enterprises/{enterprise}/settings/update_event_settings :: business[source_ip_disclosure_enabled]`

### enterprise: Enterprise billing and licensing

- Disposition: `EXCLUDED`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Purchases, payment, budgets, cost centers, and cycle changes remain out of scope.
- Routes: `/enterprises/{enterprise}/available_licenses`, `/enterprises/{enterprise}/billing`, `/enterprises/{enterprise}/billing/ai_usage`, `/enterprises/{enterprise}/billing/budgets`, `/enterprises/{enterprise}/billing/budgets/new`, `/enterprises/{enterprise}/billing/contacts`, `/enterprises/{enterprise}/billing/cost_centers`, `/enterprises/{enterprise}/billing/marketplace_apps`, `/enterprises/{enterprise}/billing/payment_history`, `/enterprises/{enterprise}/billing/payment_information`, `/enterprises/{enterprise}/billing/sponsorships`, `/enterprises/{enterprise}/billing/usage`, `/enterprises/{enterprise}/license_counts/enterprise_licenses`, `/enterprises/{enterprise}/license_counts/pending_invitation_licenses_used`, `/enterprises/{enterprise}/license_counts/users_access_licenses_used`, `/enterprises/{enterprise}/licensing`, `/enterprises/{enterprise}/settings/billing/cycle_duration_change`, `/enterprises/{enterprise}/settings/billing/edit_multi_checkout`.
- React apps: `billing-app`.
- Capability markers: `Contact sales`, `Enterprise account`.
- Static modifying forms:
  - `POST /billing/sales_tax_exemptions :: account_id,account_type,file`
  - `POST /enterprises/{enterprise}/enterprise_installations/user_accounts_sync :: enterprise_installation_id,enterprise_installation_user_accounts_upload_id`
  - `POST /enterprises/{enterprise}/licensing/dismiss_metered_licensing_discovery_banner :: `
  - `POST /enterprises/{enterprise}/settings/billing/cycle_duration_change.month :: plan_duration`
  - `POST /enterprises/{enterprise}/settings/billing/redeeem_coupon :: code,id,return_to`
  - `POST /enterprises/{enterprise}/settings/billing/update_payment_method :: billing[billing_address][address1],billing[billing_address][address2],billing[billing_address][city],billing[billing_address][country_code_alpha3],billing[billing_address][postal_code],billing[billing_address][region],billing[zuora_payment_method_id]`
  - `POST /enterprises/{enterprise}/settings/billing/update_payment_method :: billing[paypal_nonce]`
  - `POST /enterprises/{enterprise}/settings/billing_email :: billing_external_email`
  - `PUT /enterprises/{enterprise}/settings/billing/update_payment_information :: billing_contact[address1],billing_contact[address2],billing_contact[city],billing_contact[country_code],billing_contact[entity_name],billing_contact[postal_code],billing_contact[region],form_loaded_from,return_to,slug,target,vat_code`
  - `PUT /enterprises/{enterprise}/settings/billing_email/update_primary :: business[billing_email]`

### enterprise: Enterprise code-quality policy

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Entitlement-dependent React setting.
- Routes: `/enterprises/{enterprise}/settings/code_quality_policies`.
- React apps: `code-quality`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### enterprise: Enterprise compliance and dormant-user reports

- Disposition: `READ`; issue #6: `yes`; observed plans: `enterprise`.
- Finding: Compliance downloads and dormant-user exports are high-value read-only gh2 workflows.
- Routes: `/enterprises/{enterprise}/settings/compliance`, `/enterprises/{enterprise}/settings/compliance_reports/bug-bounty-april-june-{id}`, `/enterprises/{enterprise}/settings/compliance_reports/bug-bounty-january-march-{id}`, `/enterprises/{enterprise}/settings/compliance_reports/bug-bounty-july-september-{id}`, `/enterprises/{enterprise}/settings/compliance_reports/bug-bounty-october-december-{id}`, `/enterprises/{enterprise}/settings/compliance_reports/copilot-pentest-{id}`, `/enterprises/{enterprise}/settings/compliance_reports/csa-star`, `/enterprises/{enterprise}/settings/compliance_reports/external-pentest-{id}`, `/enterprises/{enterprise}/settings/compliance_reports/ghec-proxima-pentest-{id}`, `/enterprises/{enterprise}/settings/compliance_reports/iso-{id}`, `/enterprises/{enterprise}/settings/compliance_reports/pci-aoc`, `/enterprises/{enterprise}/settings/compliance_reports/service-continuity-plan`, `/enterprises/{enterprise}/settings/compliance_reports/soc1-{id}-q1`, `/enterprises/{enterprise}/settings/compliance_reports/soc1-{id}-q2`, `/enterprises/{enterprise}/settings/compliance_reports/soc1-{id}-q3`, `/enterprises/{enterprise}/settings/compliance_reports/soc2-{id}-h1`, `/enterprises/{enterprise}/settings/compliance_reports/soc2-{id}-q1`, `/enterprises/{enterprise}/settings/compliance_reports/soc2-{id}-q3`, `/enterprises/{enterprise}/settings/compliance_reports/soc3-{id}-q1`, `/enterprises/{enterprise}/settings/compliance_reports/soc3-{id}-q33`.
- Static modifying forms:
  - `POST /enterprises/{enterprise}/settings/dormant-users/exports :: `

### enterprise: Enterprise Copilot settings

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Missing policy controls require capability probes.
- Routes: `/enterprises/{enterprise}/settings/copilot`.
- Capability markers: `Enterprise account`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### enterprise: Failed enterprise invitations

- Disposition: `CANDIDATE`; issue #6: `yes`; observed plans: `enterprise`.
- Finding: Retry/cancel recovery is a web-only operational workflow.
- Routes: `/enterprises/{enterprise}/failed_invitations`.
- Static modifying forms:
  - `DELETE /enterprises/{enterprise}/failed_invitations :: email_or_login,invitation_ids`
  - `PATCH /enterprises/{enterprise}/failed_invitations :: email_or_login,invitation_ids`

### enterprise: Enterprise Apps, installations, and hooks

- Disposition: `MIXED`; issue #6: `yes`; observed plans: `enterprise`.
- Finding: Apply the same gh2 App lifecycle model at enterprise scope.
- Routes: `/enterprises/{enterprise}/settings/apps`, `/enterprises/{enterprise}/settings/apps/new`, `/enterprises/{enterprise}/settings/hooks`, `/enterprises/{enterprise}/settings/hooks/new`, `/enterprises/{enterprise}/settings/installations`.
- Capability markers: `Enterprise account`.
- Static modifying forms:
  - `POST /enterprises/{enterprise}/settings/apps :: commit,integration[application_callback_urls_attributes][0][_destroy],integration[application_callback_urls_attributes][0][url],integration[application_callback_urls_attributes][TEMPLATE_INDEX][_destroy],integration[application_callback_urls_attributes][TEMPLATE_INDEX][url],integration[default_events][],integration[default_permissions][actions],integration[default_permissions][actions_variables],integration[default_permissions][administration],integration[default_permissions][agent_secrets],integration[default_permissions][agent_tasks],integration[default_permissions][agent_variables],integration[default_permissions][artifact_metadata],integration[default_permissions][attestations],integration[default_permissions][blocking],integration[default_permissions][checks],integration[default_permissions][code_quality],integration[default_permissions][codespaces],integration[default_permissions][codespaces_lifecycle_admin],integration[default_permissions][codespaces_metadata],integration[default_permissions][codespaces_secrets],integration[default_permissions][codespaces_user_secrets],integration[default_permissions][contents],integration[default_permissions][copilot_agent_settings],integration[default_permissions][copilot_editor_context],integration[default_permissions][copilot_messages],integration[default_permissions][custom_properties_for_organizations],integration[default_permissions][dependabot_secrets],integration[default_permissions][deployments],integration[default_permissions][discussions],integration[default_permissions][emails],integration[default_permissions][enterprise_ai_controls],integration[default_permissions][enterprise_copilot_metrics],integration[default_permissions][enterprise_copilot_usage],integration[default_permissions][enterprise_credentials],integration[default_permissions][enterprise_custom_enterprise_roles],integration[default_permissions][enterprise_custom_org_roles],integration[default_permissions][enterprise_custom_properties],integration[default_permissions][enterprise_custom_properties_for_organizations],integration[default_permissions][enterprise_innersource_vulnerabilities],integration[default_permissions][enterprise_organization_installation_repositories],integration[default_permissions][enterprise_organization_installations],integration[default_permissions][enterprise_organizations],integration[default_permissions][enterprise_people],integration[default_permissions][enterprise_sso],integration[default_permissions][enterprise_teams],integration[default_permissions][environments],integration[default_permissions][followers],integration[default_permissions][gists],integration[default_permissions][git_signing_ssh_public_keys],integration[default_permissions][gpg_keys],integration[default_permissions][interaction_limits],integration[default_permissions][issue_fields],integration[default_permissions][issue_types],integration[default_permissions][issues],integration[default_permissions][keys],integration[default_permissions][license_compliance_alerts],integration[default_permissions][members],integration[default_permissions][merge_queues],integration[default_permissions][metadata],integration[default_permissions][org_copilot_content_exclusion],integration[default_permissions][organization_actions_variables],integration[default_permissions][organization_administration],integration[default_permissions][organization_agent_secrets],integration[default_permissions][organization_agent_variables],integration[default_permissions][organization_announcement_banners],integration[default_permissions][organization_api_insights],integration[default_permissions][organization_campaigns],integration[default_permissions][organization_code_scanning_dismissal_requests],integration[default_permissions][organization_codespaces],integration[default_permissions][organization_codespaces_secrets],integration[default_permissions][organization_codespaces_settings],integration[default_permissions][organization_copilot_agent_settings],integration[default_permissions][organization_copilot_metrics],integration[default_permissions][organization_copilot_seat_management],integration[default_permissions][organization_copilot_spaces],integration[default_permissions][organization_credentials],integration[default_permissions][organization_custom_org_roles],integration[default_permissions][organization_custom_properties],integration[default_permissions][organization_custom_roles],integration[default_permissions][organization_dependabot_dismissal_requests],integration[default_permissions][organization_dependabot_secrets],integration[default_permissions][organization_events],integration[default_permissions][organization_hooks],integration[default_permissions][organization_innersource_vulnerabilities],integration[default_permissions][organization_models],integration[default_permissions][organization_network_configurations],integration[default_permissions][organization_personal_access_token_requests],integration[default_permissions][organization_personal_access_tokens],integration[default_permissions][organization_plan],integration[default_permissions][organization_private_registries],integration[default_permissions][organization_projects],integration[default_permissions][organization_runner_custom_images],integration[default_permissions][organization_secret_scanning_bypass_requests],integration[default_permissions][organization_secrets],integration[default_permissions][organization_self_hosted_runners],integration[default_permissions][organization_user_blocking],integration[default_permissions][packages],integration[default_permissions][pages],integration[default_permissions][plan],integration[default_permissions][profile],integration[default_permissions][pull_requests],integration[default_permissions][repo_secret_scanning_dismissal_requests],integration[default_permissions][repository_advisories],integration[default_permissions][repository_custom_properties],integration[default_permissions][repository_hooks],integration[default_permissions][repository_projects],integration[default_permissions][secret_scanning_alerts],integration[default_permissions][secret_scanning_bypass_requests],integration[default_permissions][secret_scanning_dismissal_requests],integration[default_permissions][secrets],integration[default_permissions][security_events],integration[default_permissions][single_file],integration[default_permissions][starring],integration[default_permissions][statuses],integration[default_permissions][user_events],integration[default_permissions][user_models],integration[default_permissions][vulnerability_alerts],integration[default_permissions][watching],integration[default_permissions][workflows],integration[description],integration[device_flow_enabled],integration[hook_attributes][_destroy],integration[hook_attributes][active],integration[hook_attributes][insecure_ssl],integration[hook_attributes][secret],integration[hook_attributes][url],integration[integrator_events][],integration[name],integration[request_oauth_on_install],integration[setup_on_update],integration[setup_url],integration[single_file_paths][],integration[url],integration[user_token_expiration_enabled],integration[visibility]`
  - `POST /enterprises/{enterprise}/settings/hooks :: hook[active],hook[content_type],hook[events][],hook[insecure_ssl],hook[secret],hook[url],subscription-choice`

### enterprise: Enterprise member privileges

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Use GraphQL first and add only unmatched policies to gh2.
- Routes: `/enterprises/{enterprise}/settings/member_privileges`.
- Static modifying forms:
  - `PUT /enterprises/{enterprise}/settings/business_rules_relaxed_rename :: business[business_rules_relaxed_rename]`
  - `PUT /enterprises/{enterprise}/settings/default_repository_permission :: default_repository_permission`
  - `PUT /enterprises/{enterprise}/settings/members_can_create_repositories :: business[internal],business[members_can_create_repositories],business[private],business[public]`
  - `PUT /enterprises/{enterprise}/settings/members_can_delete_issues :: business[members_can_delete_issues]`
  - `PUT /enterprises/{enterprise}/settings/members_can_delete_repositories :: business[members_can_delete_repositories]`
  - `PUT /enterprises/{enterprise}/settings/members_can_invite_outside_collaborators :: business[members_can_invite_outside_collaborators]`
  - `PUT /enterprises/{enterprise}/settings/remove_user_accounts_when_removing_last_org_membership :: remove_user_accounts_when_removing_last_org_membership`
  - `PUT /enterprises/{enterprise}/settings/update_allow_private_repository_forking :: allow_private_repository_forking`
  - `PUT /enterprises/{enterprise}/settings/update_default_branch_setting :: default_branch_enforce,default_branch_name`
  - `PUT /enterprises/{enterprise}/settings/update_deploy_key_policy :: business[deploy_key_policy]`
  - `PUT /enterprises/{enterprise}/settings/update_members_can_change_repo_visibility :: members_can_change_repo_visibility`

### enterprise: Enterprise people and membership exports

- Disposition: `MIXED`; issue #6: `yes`; observed plans: `enterprise`.
- Finding: Only export/report workflows belong in gh2.
- Routes: `/enterprises/{enterprise}/outside_collaborators`, `/enterprises/{enterprise}/outside_collaborators/{user}`, `/enterprises/{enterprise}/pending_collaborators`, `/enterprises/{enterprise}/pending_collaborators/daebong`, `/enterprises/{enterprise}/pending_members`, `/enterprises/{enterprise}/pending_members/{user}`, `/enterprises/{enterprise}/pending_unaffiliated_members`, `/enterprises/{enterprise}/people`, `/enterprises/{enterprise}/people_counts/enterprise_billing_manager_count`, `/enterprises/{enterprise}/people_counts/enterprise_org_members_count`, `/enterprises/{enterprise}/people_counts/enterprise_org_owners_count`, `/enterprises/{enterprise}/people_counts/enterprise_owner_count`, `/enterprises/{enterprise}/people_counts/outside_collaborators_count`, `/enterprises/{enterprise}/people_counts/unaffiliated_users_count`, `/enterprises/{enterprise}/people/{user}/enterprise_installations`, `/enterprises/{enterprise}/people/{user}/organizations`, `/enterprises/{enterprise}/people/{user}/teams`.
- Capability markers: `Enterprise account`.
- Static modifying forms:
  - `POST /enterprises/{enterprise}/member_invitation :: identifier`
  - `POST /enterprises/{enterprise}/people/{user} :: `

### enterprise: Enterprise hosted-compute networking

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise`.
- Finding: React endpoints require entitlement and schema probes.
- Routes: `/enterprises/{enterprise}/settings/hosted_compute_networking`, `/enterprises/{enterprise}/settings/network_configurations`.
- React apps: `network-configurations`.
- Capability markers: `Enterprise account`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### enterprise: Enterprise organizations and transfers

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Transfers are risky; ordinary organization operations should use GraphQL.
- Routes: `/enterprises/{enterprise}/org_filter_menu_content/admins`, `/enterprises/{enterprise}/org_filter_menu_content/collaborators`, `/enterprises/{enterprise}/org_filter_menu_content/members`, `/enterprises/{enterprise}/org_filter_menu_content/pending`, `/enterprises/{enterprise}/organization_invitations/new`, `/enterprises/{enterprise}/organization_settings_menu/{name}`, `/enterprises/{enterprise}/organization_settings_menu/{name}-business`, `/enterprises/{enterprise}/organization_transfers/new`, `/enterprises/{enterprise}/organizations`, `/enterprises/{enterprise}/organizations/{organization}/allow_private_repository_forking`, `/enterprises/{enterprise}/organizations/{organization}/default_repository_permission`, `/enterprises/{enterprise}/organizations/{organization}/dependabot_default_repository_access`, `/enterprises/{enterprise}/organizations/{organization}/members_can_change_project_visibility`, `/enterprises/{enterprise}/organizations/{organization}/members_can_change_repository_visibility`, `/enterprises/{enterprise}/organizations/{organization}/members_can_delete_issues`, `/enterprises/{enterprise}/organizations/{organization}/members_can_delete_repositories`, `/enterprises/{enterprise}/organizations/{organization}/members_can_invite_collaborators`, `/enterprises/{enterprise}/organizations/{organization}/members_can_view_dependency_insights`, `/enterprises/{enterprise}/organizations/{organization}/organization_projects`, `/enterprises/{enterprise}/organizations/{organization}/repository_creation`, `/enterprises/{enterprise}/organizations/{organization}/saml_identity_provider`, `/enterprises/{enterprise}/organizations/new`.
- Static modifying forms:
  - `DELETE /enterprises/{enterprise}/organizations/{organization} :: i_agree,remove_unaffiliated_users`
  - `PATCH /orgs/{org}/people/{user} :: role`
  - `POST /enterprises/{enterprise}/organization_invitations :: organization_login`
  - `POST /enterprises/{enterprise}/organizations :: organization[display_name]`

### enterprise: Enterprise overview

- Disposition: `LOW`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Long-description editing is a low-priority web remainder.
- Routes: `/enterprises/{enterprise}`.
- Static modifying forms:
  - `PATCH /enterprises/{enterprise}/long_description :: base_commit_oid,business[long_description],comment_id,end_commit_oid,line,path,preview_side,preview_start_side,saved_reply_id,start_commit_oid,start_line`

### enterprise: Enterprise PAT policies

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Fine-grained and classic PAT policy settings are web-only candidates.
- Routes: `/enterprises/{enterprise}/settings/personal-access-tokens`, `/enterprises/{enterprise}/settings/personal-access-tokens/classic`.
- Static modifying forms:
  - `PATCH /enterprises/{enterprise}/settings/personal-access-token-requests/auto-approvals :: business[pat_auto_approvals]`
  - `PATCH /enterprises/{enterprise}/settings/personal-access-tokens/maximum-lifetime :: business[custom_fine_grained_personal_access_token_expiration_limit],business[exempt_administrators],business[fine_grained_personal_access_token_expiration_limit],business[pat_type],business[require_pat_to_expire]`
  - `PATCH /enterprises/{enterprise}/settings/personal-access-tokens/restrict-access :: business[restrict_access]`
  - `PATCH /enterprises/{enterprise}/settings/personal-access-tokens/restrict-legacy-access :: business[restrict_legacy_access]`

### enterprise: Enterprise profile and slug

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Slug changes are risky; footer links are a lower-priority gap.
- Routes: `/enterprises/{enterprise}/settings/profile`.
- Static modifying forms:
  - `PATCH /enterprises/{enterprise}/slug :: accept_conditions,new_slug,verify`
  - `PUT /enterprises/{enterprise}/settings/profile :: business[description],business[location],business[name],business[security_contact_email],business[website_url]`
  - `PUT /enterprises/{enterprise}/settings/profile :: business[footer_links_attributes][0][title],business[footer_links_attributes][0][url],business[footer_links_attributes][1][title],business[footer_links_attributes][1][url],business[footer_links_attributes][2][title],business[footer_links_attributes][2][url],business[footer_links_attributes][3][title],business[footer_links_attributes][3][url],business[footer_links_attributes][4][title],business[footer_links_attributes][4][url]`
  - `PUT /enterprises/{enterprise}/settings/user_name_display :: user_name_display[policy],user_name_display[value]`

### enterprise: Enterprise and organization roles

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Only unmatched custom-role CRUD belongs in gh2.
- Routes: `/enterprises/{enterprise}/enterprise_role_assignments`, `/enterprises/{enterprise}/enterprise_roles`, `/enterprises/{enterprise}/enterprise_roles/new`, `/enterprises/{enterprise}/org_roles`, `/enterprises/{enterprise}/org_roles/new`.
- React apps: `custom-roles`, `enterprise-role-assignments`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### enterprise: Enterprise SAML

- Disposition: `RISKY`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Authentication-critical workflow requiring separate safeguards.
- Routes: `/enterprises/{enterprise}/saml/consume`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### enterprise: Enterprise Sandboxes

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Entitlement-dependent web-only setting.
- Routes: `/enterprises/{enterprise}/settings/sandboxes`.
- Capability markers: `not available`.
- Static modifying forms:
  - `PUT /enterprises/{enterprise}/settings/sandboxes :: github_sandbox_enabled`

### enterprise: Enterprise authentication security

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Web-only remainder is high risk and should be isolated.
- Routes: `/enterprises/{enterprise}/settings/security`.
- Capability markers: `Enterprise account`.
- Static modifying forms:
  - `DELETE /enterprises/{enterprise}/settings/saml_provider :: verify`
  - `PATCH /enterprises/{enterprise}/settings/ip_allowlist_app_access_enabled :: enable_ip_allowlist_app_access`
  - `PATCH /enterprises/{enterprise}/settings/ip_allowlist_enabled :: enable_ip_allowlist`
  - `PATCH /enterprises/{enterprise}/settings/two_factor_requirement :: business_name,two_factor_required,two_factor_secure_methods_required`
  - `POST /enterprises/{enterprise}/settings/ip_allowlist_entries :: ip_allowlist_entry[allow_list_value],ip_allowlist_entry[name]`
  - `PUT /enterprises/{enterprise}/settings/saml_provider :: enable-saml-checkbox,saml-currently-enabled,saml[digest_method],saml[idp_certificate],saml[issuer],saml[signature_method],saml[sso_url]`

### enterprise: Enterprise code-security settings

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Add only verified web-only controls.
- Routes: `/enterprises/{enterprise}/settings/security_analysis`, `/enterprises/{enterprise}/settings/security_analysis_policies`, `/enterprises/{enterprise}/settings/security_analysis_policies/security_features`, `/enterprises/{enterprise}/settings/security_analysis/configurations/17/view`, `/enterprises/{enterprise}/settings/security_analysis/configurations/new`, `/enterprises/{enterprise}/settings/security_analysis/pattern_configurations`.
- React apps: `push-protection-pattern-configurations`, `security-products-enablement`.
- Capability markers: `not available`.
- Static modifying forms:
  - `PUT /enterprises/{enterprise}/settings/security_analysis_policies/code_scanning_ai_findings/ai_findings :: value`
  - `PUT /enterprises/{enterprise}/settings/security_analysis_policies/code_scanning_autofix/codeql :: value`
  - `PUT /enterprises/{enterprise}/settings/security_analysis_policies/update_dependabot_alerts_enablement :: all_orgs_repo_admins`
  - `PUT /enterprises/{enterprise}/settings/security_analysis_policies/update_dependabot_repository_access :: default_level`
  - `PUT /enterprises/{enterprise}/settings/security_analysis_policies/update_dependency_insights_settings :: members_can_view_dependency_insights`
  - `PUT /enterprises/{enterprise}/settings/security_analysis_policies/update_generic_secrets_settings :: `
  - `PUT /enterprises/{enterprise}/settings/security_analysis_policies/update_ghas_availability :: ghas_availability`
  - `PUT /enterprises/{enterprise}/settings/security_analysis_policies/update_ghas_code_security_enablement :: all_repo_admins`
  - `PUT /enterprises/{enterprise}/settings/security_analysis_policies/update_secret_scanning_settings :: `

### enterprise: Enterprise security center and review requests

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Read/report via APIs; web-only request review is a gh2 candidate.
- Routes: `/enterprises/{enterprise}/security/alerts/code-scanning`, `/enterprises/{enterprise}/security/alerts/dependabot`, `/enterprises/{enterprise}/security/alerts/dependabot/menu-content`, `/enterprises/{enterprise}/security/alerts/malware`, `/enterprises/{enterprise}/security/alerts/secret-scanning`, `/enterprises/{enterprise}/security/bypass-requests/license-compliance`, `/enterprises/{enterprise}/security/bypass-requests/secret-scanning`, `/enterprises/{enterprise}/security/coverage`, `/enterprises/{enterprise}/security/coverage/stats`, `/enterprises/{enterprise}/security/dismissal-requests/code-scanning`, `/enterprises/{enterprise}/security/dismissal-requests/dependabot`, `/enterprises/{enterprise}/security/dismissal-requests/secret-scanning`, `/enterprises/{enterprise}/security/metrics/codeql`, `/enterprises/{enterprise}/security/metrics/enablement`, `/enterprises/{enterprise}/security/metrics/secret-scanning`, `/enterprises/{enterprise}/security/overview`, `/enterprises/{enterprise}/security/risk`, `/enterprises/{enterprise}/security/risk/stats`.
- React apps: `delegated-bypass`, `security-center`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### enterprise: Enterprise sponsorship policy

- Disposition: `LOW`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Low-priority and financially adjacent.
- Routes: `/enterprises/{enterprise}/settings/sponsors`.
- Static modifying forms:
  - `PUT /enterprises/{enterprise}/settings/sponsors :: `
  - `PUT /enterprises/{enterprise}/settings/sponsors :: org_to_enable`

### enterprise: Enterprise SSH certificate authorities

- Disposition: `RISKY`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Security-critical CA management.
- Routes: `/enterprises/{enterprise}/settings/ssh_certificate_authorities/new`.
- Static modifying forms:
  - `POST /enterprises/{enterprise}/settings/ssh_certificate_authorities :: ssh_certificate_authority[openssh_public_key]`

### enterprise: Enterprise support settings

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise`.
- Finding: gh2 already supports Support tickets; entitlement operations should use GraphQL.
- Routes: `/enterprises/{enterprise}/settings/support`.
- Static modifying forms:
  - `POST /enterprises/{enterprise}/settings/support_entitlees :: user`

### organization: Organization announcement

- Disposition: `CANDIDATE`; issue #6: `yes`; observed plans: `enterprise`.
- Finding: Enterprise-plan capability; show/update/clear fits gh2.
- Routes: `/organizations/{org}/settings/announcement`.
- Static modifying forms:
  - `PATCH /organizations/{org}/settings/announcement :: base_commit_oid,comment_id,custom_messages[announcement],custom_messages[announcement_expires_at],custom_messages[user_dismissible],end_commit_oid,line,path,preview_side,preview_start_side,saved_reply_id,start_commit_oid,start_line`
  - `PUT /organizations/{org}/settings/preview_announcement :: announcement_preview_user_dismissible,announcement_preview_value`

### organization: Organization audit log

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Only missing export/configuration operations belong in gh2.
- Routes: `/organizations/{org}/settings/audit-log`, `/organizations/{org}/settings/audit-log/results`.
- Capability markers: `Upgrade`.
- Static modifying forms:
  - `POST /orgs/{org}/audit-log/export-git.json :: end,start`
  - `POST /orgs/{org}/audit-log/export.json :: q`

### organization: Organization billing and licensing

- Disposition: `EXCLUDED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Purchase, payment, plan, and license mutations remain out of scope.
- Routes: `/organizations/{org}/settings/billing/summary`, `/organizations/{org}/settings/billing`, `/organizations/{org}/settings/billing/ai_usage`, `/organizations/{org}/settings/billing/budgets`, `/organizations/{org}/settings/billing/budgets/new`, `/organizations/{org}/settings/billing/payment_information`, `/organizations/{org}/settings/billing/subscriptions`, `/organizations/{org}/settings/billing/usage`, `/organizations/{org}/settings/licensing`.
- React apps: `billing-app`.
- Capability markers: `Enterprise account`, `GitHub Free`, `Upgrade`.
- Static modifying forms:
  - `DELETE /account/contact :: organization_id,return_to,target`
  - `DELETE /organizations/{org}/settings/billing/payment_information :: return_to`
  - `POST /account/contact.{name} :: billing_contact[address1],billing_contact[address2],billing_contact[city],billing_contact[country_code],billing_contact[entity_name],billing_contact[postal_code],billing_contact[region],billing_info_submit_btn,contact_type,form_loaded_from,organization[billing_email],organization_id,return_to,target,vat_code`
  - `POST /organizations/{org}/billing/extra :: billing_extra`
  - `POST /organizations/{org}/billing/update_credit_card :: billing[billing_address][address1],billing[billing_address][address2],billing[billing_address][city],billing[billing_address][country_code_alpha3],billing[billing_address][postal_code],billing[billing_address][region],billing[zuora_payment_method_id],return_to`
  - `POST /organizations/{org}/billing/update_credit_card :: billing[paypal_nonce],return_to`
  - `POST /organizations/{org}/billing_external_emails/create :: billing_external_email`
  - `PUT /organizations/{org}/billing_external_emails/update_primary :: organization[billing_email]`
  - `PUT /organizations/{org}/self_serve_invoicing :: send_invoice_with_receipt`

### organization: Organization code-review limits

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Web-only organization policy.
- Routes: `/organizations/{org}/settings/code_review_limits`.
- Static modifying forms:
  - `PUT /organizations/{org}/settings/code_review_limits :: `

### organization: Organization Codespaces

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Expose only the settings absent from REST.
- Routes: `/organizations/{org}/settings/codespaces`, `/organizations/{org}/settings/codespaces/policies`, `/organizations/{org}/settings/codespaces/policies/new`.
- Capability markers: `Upgrade`.
- Static modifying forms:
  - `PUT /no_reference :: `
  - `PUT /organizations/{org}/settings/codespaces/update_codespaces_user_limit :: organization[organization_codespaces_user_limit]`
  - `PUT /organizations/{org}/settings/codespaces/update_trusted_repositories_access :: organization[codespace_trusted_repositories_access]`

### organization: Organization compliance reports

- Disposition: `READ`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: List/download is a read-only gh2 candidate.
- Routes: `/organizations/{org}/settings/compliance`, `/organizations/{org}/settings/compliance_reports/{report}`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### organization: Organization Copilot settings

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Capability-probed web commands are candidates for missing policy controls.
- Routes: `/organizations/{org}/settings/copilot/code_review`, `/organizations/{org}/settings/copilot/coding_agent`, `/organizations/{org}/settings/copilot/internet_access`, `/organizations/{org}/settings/copilot/runner_type`, `/organizations/{org}/settings/copilot/seat_management`, `/organizations/{org}/settings/copilot`.
- React apps: `copilot-code-review-org-settings`, `copilot-for-business`, `copilot-internet-access-settings`.
- Static modifying forms:
  - `PATCH /organizations/{org}/tos :: billing_contact[address1],billing_contact[address2],billing_contact[city],billing_contact[country_code],billing_contact[entity_name],billing_contact[postal_code],billing_contact[region],billing_info_form,business_owned,contact_type,form_loaded_from,organization[billing_email],organization[terms_of_service_type],organization_id,target,vat_code`
  - `POST /organizations/{org}/settings/soft_deletion :: dangerzone`
  - `POST /orgs/{org}/archive :: verify-name`
  - `PUT /organizations/{org} :: organization[billing_email],organization[display_name],organization[gravatar_email],organization[organization_profile_attributes][sponsors_update_email],organization[profile_bio],organization[profile_blog],organization[profile_email],organization[profile_location],organization[profile_social_accounts][][key],organization[profile_social_accounts][][url],required_field_f816,timestamp,timestamp_secret`
  - `PUT /organizations/{org}/rename :: login,required_field_1a97,timestamp,timestamp_secret`

### organization: Organization deleted repositories

- Disposition: `CANDIDATE`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: High-value restore workflow.
- Routes: `/organizations/{org}/settings/deleted_repositories`.
- Static modifying forms:
  - `POST /settings/restore_repo/{id} :: `

### organization: Organization Dependabot rules

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Default and custom Dependabot rules are web forms.
- Routes: `/organizations/{org}/settings/dependabot_rules`, `/organizations/{org}/settings/dependabot_rules/edit_default/{id}`, `/organizations/{org}/settings/dependabot_rules/new`.
- Static modifying forms:
  - `POST /organizations/{org}/settings/dependabot_rules :: dependabot_updates_enabled,rule_criteria,vulnerability_alert_rule[auto_dismiss],vulnerability_alert_rule[auto_dismiss_option],vulnerability_alert_rule[create_pr],vulnerability_alert_rule[name],vulnerability_alert_rule[rule_behavior]`
  - `PUT /organizations/{org}/settings/dependabot_rules/update_default/1 :: Preset Rule Name,rule_behavior`

### organization: Organization deploy-key policy

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Only the organization policy is a gh2 gap.
- Routes: `/organizations/{org}/settings/deploy_keys`.
- Static modifying forms:
  - `PUT /organizations/{org}/settings/deploy_keys :: organization[deploy_key_policy]`

### organization: Organization Discussions toggle

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Small web-only organization setting.
- Routes: `/organizations/{org}/settings/discussions`.
- Static modifying forms:
  - `PUT /organizations/{org}/settings/discussions :: discussions_enabled`

### organization: Organization-owned GitHub Apps and managers

- Disposition: `EXISTING`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: gh2 covers part of this and should expand.
- Routes: `/organizations/{org}/settings/apps`, `/organizations/{org}/settings/apps/{app}`, `/organizations/{org}/settings/apps/{app}/advanced`, `/organizations/{org}/settings/apps/{app}/beta`, `/organizations/{org}/settings/apps/{app}/installations`, `/organizations/{org}/settings/apps/{app}/permissions`, `/organizations/{org}/settings/apps/new`, `/organizations/{org}/settings/permissions/integrations/{app}/managers`, `/organizations/{org}/settings/apps/{app}/hooks/{id}/deliveries`.
- Capability markers: `Enterprise account`.
- Static modifying forms:
  - `DELETE /organizations/{org}/settings/apps/{app} :: verify`
  - `DELETE /organizations/{org}/settings/apps/{app}/key/{id} :: `
  - `POST /organizations/{org}/settings/apps :: commit,integration[application_callback_urls_attributes][0][_destroy],integration[application_callback_urls_attributes][0][url],integration[application_callback_urls_attributes][TEMPLATE_INDEX][_destroy],integration[application_callback_urls_attributes][TEMPLATE_INDEX][url],integration[default_events][],integration[default_permissions][actions],integration[default_permissions][actions_variables],integration[default_permissions][administration],integration[default_permissions][agent_secrets],integration[default_permissions][agent_tasks],integration[default_permissions][agent_variables],integration[default_permissions][artifact_metadata],integration[default_permissions][attestations],integration[default_permissions][blocking],integration[default_permissions][checks],integration[default_permissions][code_quality],integration[default_permissions][codespaces],integration[default_permissions][codespaces_lifecycle_admin],integration[default_permissions][codespaces_metadata],integration[default_permissions][codespaces_secrets],integration[default_permissions][codespaces_user_secrets],integration[default_permissions][contents],integration[default_permissions][copilot_agent_settings],integration[default_permissions][copilot_editor_context],integration[default_permissions][copilot_messages],integration[default_permissions][custom_properties_for_organizations],integration[default_permissions][dependabot_secrets],integration[default_permissions][deployments],integration[default_permissions][discussions],integration[default_permissions][emails],integration[default_permissions][enterprise_ai_controls],integration[default_permissions][enterprise_copilot_metrics],integration[default_permissions][enterprise_copilot_usage],integration[default_permissions][enterprise_credentials],integration[default_permissions][enterprise_custom_enterprise_roles],integration[default_permissions][enterprise_custom_org_roles],integration[default_permissions][enterprise_custom_properties],integration[default_permissions][enterprise_custom_properties_for_organizations],integration[default_permissions][enterprise_innersource_vulnerabilities],integration[default_permissions][enterprise_organization_installation_repositories],integration[default_permissions][enterprise_organization_installations],integration[default_permissions][enterprise_organizations],integration[default_permissions][enterprise_people],integration[default_permissions][enterprise_sso],integration[default_permissions][enterprise_teams],integration[default_permissions][environments],integration[default_permissions][followers],integration[default_permissions][gists],integration[default_permissions][git_signing_ssh_public_keys],integration[default_permissions][gpg_keys],integration[default_permissions][interaction_limits],integration[default_permissions][issue_fields],integration[default_permissions][issue_types],integration[default_permissions][issues],integration[default_permissions][keys],integration[default_permissions][license_compliance_alerts],integration[default_permissions][members],integration[default_permissions][merge_queues],integration[default_permissions][metadata],integration[default_permissions][org_copilot_content_exclusion],integration[default_permissions][organization_actions_variables],integration[default_permissions][organization_administration],integration[default_permissions][organization_agent_secrets],integration[default_permissions][organization_agent_variables],integration[default_permissions][organization_announcement_banners],integration[default_permissions][organization_api_insights],integration[default_permissions][organization_campaigns],integration[default_permissions][organization_code_scanning_dismissal_requests],integration[default_permissions][organization_codespaces],integration[default_permissions][organization_codespaces_secrets],integration[default_permissions][organization_codespaces_settings],integration[default_permissions][organization_copilot_agent_settings],integration[default_permissions][organization_copilot_metrics],integration[default_permissions][organization_copilot_seat_management],integration[default_permissions][organization_copilot_spaces],integration[default_permissions][organization_credentials],integration[default_permissions][organization_custom_org_roles],integration[default_permissions][organization_custom_properties],integration[default_permissions][organization_custom_roles],integration[default_permissions][organization_dependabot_dismissal_requests],integration[default_permissions][organization_dependabot_secrets],integration[default_permissions][organization_events],integration[default_permissions][organization_hooks],integration[default_permissions][organization_innersource_vulnerabilities],integration[default_permissions][organization_models],integration[default_permissions][organization_network_configurations],integration[default_permissions][organization_personal_access_token_requests],integration[default_permissions][organization_personal_access_tokens],integration[default_permissions][organization_plan],integration[default_permissions][organization_private_registries],integration[default_permissions][organization_projects],integration[default_permissions][organization_runner_custom_images],integration[default_permissions][organization_secret_scanning_bypass_requests],integration[default_permissions][organization_secrets],integration[default_permissions][organization_self_hosted_runners],integration[default_permissions][organization_user_blocking],integration[default_permissions][packages],integration[default_permissions][pages],integration[default_permissions][plan],integration[default_permissions][profile],integration[default_permissions][pull_requests],integration[default_permissions][repo_secret_scanning_dismissal_requests],integration[default_permissions][repository_advisories],integration[default_permissions][repository_custom_properties],integration[default_permissions][repository_hooks],integration[default_permissions][repository_projects],integration[default_permissions][secret_scanning_alerts],integration[default_permissions][secret_scanning_bypass_requests],integration[default_permissions][secret_scanning_dismissal_requests],integration[default_permissions][secrets],integration[default_permissions][security_events],integration[default_permissions][single_file],integration[default_permissions][starring],integration[default_permissions][statuses],integration[default_permissions][user_events],integration[default_permissions][user_models],integration[default_permissions][vulnerability_alerts],integration[default_permissions][watching],integration[default_permissions][workflows],integration[description],integration[device_flow_enabled],integration[hook_attributes][_destroy],integration[hook_attributes][active],integration[hook_attributes][insecure_ssl],integration[hook_attributes][secret],integration[hook_attributes][url],integration[integrator_events][],integration[name],integration[request_oauth_on_install],integration[setup_on_update],integration[setup_url],integration[single_file_paths][],integration[url],integration[user_token_expiration_enabled],integration[visibility]`
  - `POST /organizations/{org}/settings/apps/{app}/client_secret :: `
  - `POST /organizations/{org}/settings/apps/{app}/key :: `
  - `POST /organizations/{org}/settings/apps/{app}/revoke_all_tokens :: `
  - `POST /organizations/{org}/settings/permissions/integrations/{app}/grant :: manager_id,manager_type,user_login`
  - `POST /settings/apps/{app}/ip_allowlist_entries :: ip_allowlist_entry[allow_list_value],ip_allowlist_entry[name]`
  - `POST /settings/dismiss-notice/stateless_s2s_token_format_change :: `
  - `PUT /organizations/{org}/settings/apps/{app} :: commit,integration[application_callback_urls_attributes][0][_destroy],integration[application_callback_urls_attributes][0][id],integration[application_callback_urls_attributes][0][url],integration[application_callback_urls_attributes][TEMPLATE_INDEX][_destroy],integration[application_callback_urls_attributes][TEMPLATE_INDEX][url],integration[description],integration[device_flow_enabled],integration[hook_attributes][_destroy],integration[hook_attributes][active],integration[hook_attributes][insecure_ssl],integration[hook_attributes][secret],integration[hook_attributes][url],integration[name],integration[request_oauth_on_install],integration[setup_on_update],integration[setup_url],integration[url]`
  - `PUT /organizations/{org}/settings/apps/{app} :: commit,integration[application_callback_urls_attributes][0][_destroy],integration[application_callback_urls_attributes][0][url],integration[application_callback_urls_attributes][TEMPLATE_INDEX][_destroy],integration[application_callback_urls_attributes][TEMPLATE_INDEX][url],integration[description],integration[device_flow_enabled],integration[hook_attributes][_destroy],integration[hook_attributes][active],integration[hook_attributes][insecure_ssl],integration[hook_attributes][secret],integration[hook_attributes][url],integration[name],integration[request_oauth_on_install],integration[setup_on_update],integration[setup_url],integration[url]`
  - `PUT /organizations/{org}/settings/apps/{app}/beta-toggle :: beta_feature,beta_feature_toggle`
  - `PUT /organizations/{org}/settings/apps/{app}/permissions :: commit,integration[default_events][],integration[default_permissions][actions],integration[default_permissions][actions_variables],integration[default_permissions][administration],integration[default_permissions][agent_secrets],integration[default_permissions][agent_tasks],integration[default_permissions][agent_variables],integration[default_permissions][artifact_metadata],integration[default_permissions][attestations],integration[default_permissions][blocking],integration[default_permissions][checks],integration[default_permissions][code_quality],integration[default_permissions][codespaces],integration[default_permissions][codespaces_lifecycle_admin],integration[default_permissions][codespaces_metadata],integration[default_permissions][codespaces_secrets],integration[default_permissions][codespaces_user_secrets],integration[default_permissions][contents],integration[default_permissions][copilot_agent_settings],integration[default_permissions][copilot_editor_context],integration[default_permissions][copilot_messages],integration[default_permissions][custom_properties_for_organizations],integration[default_permissions][dependabot_secrets],integration[default_permissions][deployments],integration[default_permissions][discussions],integration[default_permissions][emails],integration[default_permissions][enterprise_ai_controls],integration[default_permissions][enterprise_copilot_metrics],integration[default_permissions][enterprise_copilot_usage],integration[default_permissions][enterprise_credentials],integration[default_permissions][enterprise_custom_enterprise_roles],integration[default_permissions][enterprise_custom_org_roles],integration[default_permissions][enterprise_custom_properties],integration[default_permissions][enterprise_custom_properties_for_organizations],integration[default_permissions][enterprise_innersource_vulnerabilities],integration[default_permissions][enterprise_organization_installation_repositories],integration[default_permissions][enterprise_organization_installations],integration[default_permissions][enterprise_organizations],integration[default_permissions][enterprise_people],integration[default_permissions][enterprise_sso],integration[default_permissions][enterprise_teams],integration[default_permissions][environments],integration[default_permissions][followers],integration[default_permissions][gists],integration[default_permissions][git_signing_ssh_public_keys],integration[default_permissions][gpg_keys],integration[default_permissions][interaction_limits],integration[default_permissions][issue_fields],integration[default_permissions][issue_types],integration[default_permissions][issues],integration[default_permissions][keys],integration[default_permissions][license_compliance_alerts],integration[default_permissions][members],integration[default_permissions][merge_queues],integration[default_permissions][metadata],integration[default_permissions][org_copilot_content_exclusion],integration[default_permissions][organization_actions_variables],integration[default_permissions][organization_administration],integration[default_permissions][organization_agent_secrets],integration[default_permissions][organization_agent_variables],integration[default_permissions][organization_announcement_banners],integration[default_permissions][organization_api_insights],integration[default_permissions][organization_campaigns],integration[default_permissions][organization_code_scanning_dismissal_requests],integration[default_permissions][organization_codespaces],integration[default_permissions][organization_codespaces_secrets],integration[default_permissions][organization_codespaces_settings],integration[default_permissions][organization_copilot_agent_settings],integration[default_permissions][organization_copilot_metrics],integration[default_permissions][organization_copilot_seat_management],integration[default_permissions][organization_copilot_spaces],integration[default_permissions][organization_credentials],integration[default_permissions][organization_custom_org_roles],integration[default_permissions][organization_custom_properties],integration[default_permissions][organization_custom_roles],integration[default_permissions][organization_dependabot_dismissal_requests],integration[default_permissions][organization_dependabot_secrets],integration[default_permissions][organization_events],integration[default_permissions][organization_hooks],integration[default_permissions][organization_innersource_vulnerabilities],integration[default_permissions][organization_models],integration[default_permissions][organization_network_configurations],integration[default_permissions][organization_personal_access_token_requests],integration[default_permissions][organization_personal_access_tokens],integration[default_permissions][organization_plan],integration[default_permissions][organization_private_registries],integration[default_permissions][organization_projects],integration[default_permissions][organization_runner_custom_images],integration[default_permissions][organization_secret_scanning_bypass_requests],integration[default_permissions][organization_secrets],integration[default_permissions][organization_self_hosted_runners],integration[default_permissions][organization_user_blocking],integration[default_permissions][packages],integration[default_permissions][pages],integration[default_permissions][plan],integration[default_permissions][profile],integration[default_permissions][pull_requests],integration[default_permissions][repo_secret_scanning_dismissal_requests],integration[default_permissions][repository_advisories],integration[default_permissions][repository_custom_properties],integration[default_permissions][repository_hooks],integration[default_permissions][repository_projects],integration[default_permissions][secret_scanning_alerts],integration[default_permissions][secret_scanning_bypass_requests],integration[default_permissions][secret_scanning_dismissal_requests],integration[default_permissions][secrets],integration[default_permissions][security_events],integration[default_permissions][single_file],integration[default_permissions][starring],integration[default_permissions][statuses],integration[default_permissions][user_events],integration[default_permissions][user_models],integration[default_permissions][vulnerability_alerts],integration[default_permissions][watching],integration[default_permissions][workflows],integration[integrator_events][],integration[note],integration[single_file_paths][]`
  - `PUT /organizations/{org}/settings/apps/{app}/public :: `
  - `PUT /organizations/{org}/settings/apps/{app}/transfer :: transfer_to`

### organization: Organization import/export and attribution

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Only the web-only archive/export remainder is a later gh2 candidate.
- Routes: `/organizations/{org}/settings/import-export`, `/organizations/{org}/settings/import-export/attribution-invitations`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### organization: Organization App installations

- Disposition: `MIXED`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Approval/configuration orchestration belongs in gh2.
- Routes: `/organizations/{org}/settings/installations`, `/organizations/{org}/settings/installations/{installation}`, `/organizations/{org}/settings/installations/{installation}/permissions/update`.
- Static modifying forms:
  - `DELETE /organizations/{org}/settings/installations/{installation} :: `
  - `POST /organizations/{org}/settings/installations/{installation}/suspended :: `
  - `PUT /organizations/{org}/settings/installations/{installation}/permissions/update :: integration_fingerprint,version_id`
  - `PUT /organizations/{org}/settings/installations/{installation}/update :: install_target,integration_fingerprint,repository_ids[],target_id`
  - `PUT /organizations/{org}/settings/installations/{installation}/update :: install_target,integration_fingerprint,target_id`

### organization: Organization member privileges

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Prime gh2 gap: outside-collaborator invites, discussion creation, project base role, App request/install policy, visibility/delete permissions, team creation, dependency insights, and rename relaxation.
- Routes: `/organizations/{org}/settings/member_privileges`.
- Static modifying forms:
  - `PATCH /organizations/{org}/repository_creation :: organization[granular_repo_creation_permissions_changing],organization[members_can_create_internal_repositories],organization[members_can_create_private_repositories],organization[members_can_create_public_repositories]`
  - `PATCH /organizations/{org}/repository_creation :: organization[granular_repo_creation_permissions_changing],organization[members_can_create_private_repositories],organization[members_can_create_public_repositories]`
  - `PUT /organizations/{org}/default_repository_permission :: default_repository_permission,enable_tip,settings_context`
  - `PUT /organizations/{org}/members_can_change_repo_visibility :: members_can_change_repo_visibility`
  - `PUT /organizations/{org}/members_can_create_teams :: members_can_create_teams`
  - `PUT /organizations/{org}/members_can_delete_issues :: members_can_delete_issues`
  - `PUT /organizations/{org}/members_can_delete_repositories :: members_can_delete_repositories`
  - `PUT /organizations/{org}/members_can_invite_outside_collaborators :: members_can_invite_outside_collaborators`
  - `PUT /organizations/{org}/members_can_view_dependency_insights :: members_can_view_dependency_insights`
  - `PUT /organizations/{org}/private_repository_forking :: allow_private_repository_forking`
  - `PUT /organizations/{org}/private_repository_forking :: allow_private_repository_forking,allow_private_repository_forking_policy`
  - `PUT /organizations/{org}/readers_can_create_discussions :: readers_can_create_discussions`
  - `PUT /organizations/{org}/settings/member_privileges/github_app_installation :: allow_github_app_installation_by_repo_admins`
  - `PUT /organizations/{org}/settings/member_privileges/integration_access_requests :: app_access_scope`
  - `PUT /organizations/{org}/settings/member_privileges/projects/base_permissions :: org_projects_permission_role`
  - `PUT /organizations/{org}/settings/org_rules_relaxed_rename :: org_rules_relaxed_rename`
  - `PUT /organizations/{org}/update_pages_creation_permission :: create_private_pages_enabled,create_public_pages_enabled`

### organization: Organization OAuth App policy

- Disposition: `CANDIDATE`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Restrict/unrestrict access is a repeatable web setting.
- Routes: `/organizations/{org}/settings/oauth_application_policy`.
- Static modifying forms:
  - `PUT /orgs/{org}/application_access :: restrict_access`

### organization: Organization OAuth Apps

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Create, settings, secrets, transfer, and delete are web-only.
- Routes: `/organizations/{org}/settings/applications`, `/organizations/{org}/settings/applications/new`, `/organizations/{org}/settings/applications/{id}`, `/organizations/{org}/settings/applications/{id}/advanced`, `/organizations/{org}/settings/applications/{id}/beta`, `/organizations/{org}/settings/applications/{id}/oauth_authorizations`.
- Static modifying forms:
  - `DELETE /organizations/{org}/settings/applications/{id} :: `
  - `POST /organizations/{org}/settings/applications :: oauth_application[callback_url],oauth_application[description],oauth_application[device_flow_enabled],oauth_application[name],oauth_application[url]`
  - `POST /organizations/{org}/settings/applications/{id} :: `
  - `POST /organizations/{org}/settings/applications/{id}/client_secret :: `
  - `POST /organizations/{org}/settings/applications/{id}/revoke_all_tokens :: `
  - `PUT /organizations/{org}/settings/applications/{id} :: oauth_application[callback_url],oauth_application[description],oauth_application[device_flow_enabled],oauth_application[name],oauth_application[url]`
  - `PUT /organizations/{org}/settings/applications/{id} :: oauth_application[logo_id]`
  - `PUT /organizations/{org}/settings/applications/{id}/transfer :: transfer_to`

### organization: Organization package defaults

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Web-only default policy.
- Routes: `/organizations/{org}/settings/packages`.
- Static modifying forms:
  - `PUT /organizations/{org}/settings/packages :: packages[containers][inherit_access]`
  - `PUT /organizations/{org}/settings/packages :: packages[containers][internal],packages[containers][private],packages[containers][public]`

### organization: Organization PAT controls

- Disposition: `MIXED`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Policy show/update belongs in gh2; request review should remain API-backed.
- Routes: `/organizations/{org}/settings/personal-access-token-requests`, `/organizations/{org}/settings/personal-access-tokens`, `/organizations/{org}/settings/personal-access-tokens/active`, `/organizations/{org}/settings/personal-access-tokens/{id}`, `/organizations/{org}/settings/personal-access-tokens/{id}/credential-expiration`, `/organizations/{org}/settings/personal-access-tokens/{id}/repositories`.
- Static modifying forms:
  - `DELETE /organizations/{org}/settings/personal-access-tokens/{id} :: `
  - `PATCH /organizations/{org}/settings/personal-access-token-requests/auto-approve :: commit,organization[auto_approve]`
  - `PATCH /organizations/{org}/settings/personal-access-tokens/maximum-lifetime :: commit,organization[custom_fine_grained_personal_access_token_expiration_limit],organization[fine_grained_personal_access_token_expiration_limit],organization[pat_type],organization[require_pat_to_expire]`
  - `PATCH /organizations/{org}/settings/personal-access-tokens/restrict-access :: commit,organization[restrict_access]`

### organization: Organization profile and lifecycle

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Profile fields stay on API; destructive lifecycle needs separate guarded commands.
- Routes: `/organizations/{org}/settings/profile`.
- Static modifying forms:
  - `PATCH /organizations/{org}/tos :: billing_contact[address1],billing_contact[address2],billing_contact[city],billing_contact[country_code],billing_contact[entity_name],billing_contact[postal_code],billing_contact[region],billing_info_form,business_owned,contact_type,form_loaded_from,organization[billing_email],organization[terms_of_service_type],organization_id,target,vat_code`
  - `POST /organizations/{org}/settings/soft_deletion :: dangerzone`
  - `POST /orgs/{org}/archive :: verify-name`
  - `PUT /organizations/{org} :: organization[billing_email],organization[display_name],organization[gravatar_email],organization[organization_profile_attributes][sponsors_update_email],organization[profile_bio],organization[profile_blog],organization[profile_email],organization[profile_location],organization[profile_social_accounts][][key],organization[profile_social_accounts][][url],required_field_1b70,timestamp,timestamp_secret`
  - `PUT /organizations/{org} :: organization[billing_email],organization[display_name],organization[gravatar_email],organization[organization_profile_attributes][sponsors_update_email],organization[profile_bio],organization[profile_blog],organization[profile_email],organization[profile_location],organization[profile_social_accounts][][key],organization[profile_social_accounts][][url],required_field_dabb,timestamp,timestamp_secret`
  - `PUT /organizations/{org}/rename :: login,required_field_2df1,timestamp,timestamp_secret`
  - `PUT /organizations/{org}/rename :: login,required_field_e1c5,timestamp,timestamp_secret`

### organization: Organization Projects policy

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Only the missing policy field is a gh2 candidate.
- Routes: `/organizations/{org}/settings/projects`.
- Static modifying forms:
  - `PUT /organizations/{org}/projects_enabled :: organization[members_can_change_project_visibility],organization[organization_projects_enabled]`

### organization: Verified publisher

- Disposition: `CANDIDATE`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Status and verification request are web-only.
- Routes: `/organizations/{org}/settings/publisher`.
- Static modifying forms:
  - `POST /organizations/{org}/profile_emails :: `
  - `POST /organizations/{org}/settings/publisher/request_verification :: `

### organization: Organization scheduled reminders

- Disposition: `CANDIDATE`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Repeatable web-only workflow.
- Routes: `/organizations/{org}/settings/reminders`.
- Static modifying forms:
  - `POST /reminder_slack_workspaces/{organization}/authorize :: `

### organization: Organization repository defaults

- Disposition: `MIXED`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Expose only the non-API defaults.
- Routes: `/organizations/{org}/settings/repository-defaults`.
- Static modifying forms:
  - `DELETE /organizations/{org}/settings/labels/{id} :: `
  - `POST /organizations/{org}/settings/labels :: context,label[color],label[description],label[name]`
  - `PUT /organizations/{org}/settings/commit-comments :: policy`
  - `PUT /organizations/{org}/settings/commit-signoff :: `
  - `PUT /organizations/{org}/settings/default-branch :: default_branch_name`
  - `PUT /organizations/{org}/settings/labels/{id} :: label[color],label[description],label[name]`
  - `PUT /organizations/{org}/settings/releases :: policy`

### organization: Organization roles

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Custom role CRUD is a gh2 candidate; assignments should use the API.
- Routes: `/organizations/{org}/settings/moderators`, `/organizations/{org}/settings/org_role_assignments`, `/organizations/{org}/settings/org_roles`, `/organizations/{org}/settings/org_roles/new`, `/organizations/{org}/settings/roles`.
- React apps: `custom-roles`, `enterprise-role-assignments`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### organization: Organization Sandboxes

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Entitlement-dependent web-only setting.
- Routes: `/organizations/{org}/settings/sandboxes`.
- Capability markers: `not available`.
- Static modifying forms:
  - `PUT /organizations/{org}/settings/sandboxes :: github_sandbox_enabled`

### organization: Organization authentication and code security

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Web-only security mutations are high risk and require a separate command family.
- Routes: `/organizations/{org}/settings/code_scanning/model_packs`, `/organizations/{org}/settings/security`, `/organizations/{org}/settings/security_analysis`, `/organizations/{org}/settings/security_analysis/custom_patterns/new`, `/organizations/{org}/settings/security_analysis/ghas_header`, `/organizations/{org}/settings/security_analysis/ghas_settings`, `/organizations/{org}/settings/security_analysis/pattern_configurations`, `/organizations/{org}/settings/security_products`, `/organizations/{org}/settings/security_products/configurations/new`, `/organizations/{org}/settings/security_products/configurations/setup/new`.
- React apps: `code-scanning-organization-model-pack-settings`, `push-protection-pattern-configurations`, `security-products-enablement`.
- Capability markers: `Contact sales`, `Enterprise account`, `Upgrade`.
- Static modifying forms:
  - `DELETE /organizations/{org}/settings/saml_provider :: verify`
  - `PATCH /organizations/{org}/settings/ip_allowlist_app_access_enabled :: enable_ip_allowlist_app_access`
  - `PATCH /organizations/{org}/settings/ip_allowlist_enabled :: enable_ip_allowlist`
  - `POST /organizations/{org}/settings/ip_allowlist_entries :: ip_allowlist_entry[allow_list_value],ip_allowlist_entry[name]`
  - `POST /organizations/{org}/settings/security_analysis/custom_patterns/dry_run_update_selected_repositories :: repo_id`
  - `POST /organizations/{org}/settings/security_analysis/custom_patterns/get_generated_expressions :: `
  - `POST /organizations/{org}/settings/security_analysis/test_custom_secret_scanning_pattern :: test_code`
  - `POST /replace :: after_secret,before_secret,display_name,post_processing_0,post_processing_1,post_processing_2,post_processing_3,post_processing_4,post_processing_5,post_processing_6,post_processing_7,post_processing_8,post_processing_9,post_processing_rule_0,post_processing_rule_1,post_processing_rule_2,post_processing_rule_3,post_processing_rule_4,post_processing_rule_5,post_processing_rule_6,post_processing_rule_7,post_processing_rule_8,post_processing_rule_9,row_version,secret_format,selected_repo_ids`
  - `PUT /organizations/{org}/settings/saml_provider :: confirm-saml-enforcement,enable-saml-checkbox,org-has-unlinked-saml-members,saml-already-enforced,saml-currently-enabled,saml[digest_method],saml[enforced],saml[idp_certificate],saml[issuer],saml[signature_method],saml[sso_url],show_onboarding_guide_tip`
  - `PUT /organizations/{org}/settings/security_analysis/update :: code_scanning_ai_findings`
  - `PUT /organizations/{org}/settings/security_analysis/update :: code_scanning_autofix`
  - `PUT /organizations/{org}/settings/security_analysis/update :: code_scanning_recommend_extended_query_suite`
  - `PUT /organizations/{org}/settings/security_analysis/update :: code_scanning_scan_inactive_repos`
  - `PUT /organizations/{org}/settings/security_analysis/update :: dependabot_runner_group,dependabot_runner_labels,dependabot_runner_type`
  - `PUT /organizations/{org}/settings/security_analysis/update :: push_protection_custom_message`
  - `PUT /organizations/{org}/settings/security_analysis/update :: push_protection_custom_message_status`
  - `PUT /organizations/{org}/settings/security_analysis/update :: vulnerability_updates_grouping_new_repos`
  - `PUT /organizations/{org}/settings/two_factor_enforcement :: org_name,two_factor_required,two_factor_requirement,two_factor_secure_methods_required`

### organization: Organization sponsorship log

- Disposition: `READ`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Low-priority read/export surface.
- Routes: `/organizations/{org}/settings/sponsors-log`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### organization: Organization SSH certificate authorities

- Disposition: `RISKY`; issue #6: `no`; observed plans: `enterprise`.
- Finding: Security-critical certificate authority management needs explicit safeguards.
- Routes: `/organizations/{org}/settings/ssh_certificate_authorities/new`.
- Static modifying forms:
  - `POST /organizations/{org}/settings/ssh_certificate_authorities :: ssh_certificate_authority[openssh_public_key]`

### personal: Accessibility preferences

- Disposition: `LOW`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Keyboard, motion, link underline, hovercard, and paste behavior are web-only but low operational value.
- Routes: `/settings/accessibility`.
- Static modifying forms:
  - `PUT /settings/accessibility/announcement_preference_hovercard :: user[announcement_preference_hovercard]`
  - `PUT /settings/accessibility/hovercards_enabled :: user[hovercards_enabled]`
  - `PUT /settings/accessibility/keyboard :: user[keyboard_shortcuts_preference]`
  - `PUT /settings/accessibility/link_underlines :: user[link_underlines]`
  - `PUT /settings/accessibility/motion :: user[animated_images]`
  - `PUT /settings/accessibility/paste_url_markdown :: user[paste_url_markdown]`

### personal: Account lifecycle

- Disposition: `RISKY`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Rename, account export, and successor changes need dedicated destructive workflows.
- Routes: `/settings/admin`.
- Static modifying forms:
  - `POST /settings/migration :: `
  - `POST /succession/set_successor :: login`
  - `POST /users/{user}/rename :: login,required_field_1123,timestamp,timestamp_secret`
  - `POST /users/{user}/rename :: login,required_field_8411,timestamp,timestamp_secret`

### personal: Appearance preferences

- Disposition: `LOW`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Theme, skin tone, tab width, and font preferences are web-only.
- Routes: `/settings/appearance`.
- Static modifying forms:
  - `PUT /settings/appearance/fixed_width_font :: use_fixed_width_font_preference`
  - `PUT /settings/appearance/skin_tone :: emoji_skin_tone_preference`
  - `PUT /settings/appearance/tab_size :: tab_size_rendering_preference`
  - `PUT appearance-form :: color_mode,dark_theme,light_theme`
  - `PUT appearance-form :: user_theme`

### personal: Personal billing

- Disposition: `EXCLUDED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Payment, budgets, licensing, and purchase changes remain out of scope.
- Routes: `/settings/billing`, `/settings/billing/budgets`, `/settings/billing/budgets/new`, `/settings/billing/licensing`, `/settings/billing/payment_information`, `/settings/billing/plans`, `/settings/billing/subscriptions`, `/settings/billing/usage`, `/settings/billing/premium_requests_usage`.
- React apps: `billing-app`.
- Capability markers: `GitHub Free`, `Upgrade`.
- Static modifying forms:
  - `DELETE /settings/billing/payment_information :: return_to`
  - `DELETE /subscription_items/MDE2OlN1YnNjcmlwdGlvbkl0ZW0yNjA2MjA0 :: answers[1179][choice_id],answers[1179][question_id],answers[1180][choice_id],answers[1180][question_id],answers[1181][choice_id],answers[1181][question_id],answers[1182][choice_id],answers[1182][question_id],answers[1183][choice_id],answers[1183][question_id],answers[1184][choice_id],answers[1184][other_text],answers[1184][question_id],answers[1185][choice_id],answers[1185][question_id],answers[1186][choice_id],answers[1186][question_id],answers[1187][choice_id],answers[1187][question_id],answers[1188][choice_id],answers[1188][question_id],answers[1189][choice_id],answers[1189][question_id],answers[1190][choice_id],answers[1190][question_id],answers[1191][choice_id],answers[1191][question_id],answers[1192][choice_id],answers[1192][question_id],answers[1193][choice_id],answers[1193][question_id],answers[1194][choice_id],answers[1194][question_id],answers[1195][choice_id],answers[1195][question_id],answers[1196][choice_id],answers[1196][question_id],answers[1197][choice_id],answers[1197][question_id],answers[1198][choice_id],answers[1198][question_id],answers[1199][choice_id],answers[1199][question_id],answers[1200][choice_id],answers[1200][question_id],answers[1201][choice_id],answers[1201][question_id],answers[1202][choice_id],answers[1202][question_id],answers[1203][choice_id],answers[1203][question_id],answers[1204][choice_id],answers[1204][question_id],answers[1205][choice_id],answers[1205][other_text],answers[1205][question_id],answers[1206][choice_id],answers[1206][question_id],answers[1207][choice_id],answers[1207][other_text],answers[1207][question_id],cancel_and_refund,survey_id`
  - `POST /account/billing/update_credit_card :: billing[billing_address][address1],billing[billing_address][address2],billing[billing_address][city],billing[billing_address][country_code_alpha3],billing[billing_address][postal_code],billing[billing_address][region],billing[zuora_payment_method_id],return_to`
  - `POST /account/billing/update_credit_card :: billing[paypal_nonce],return_to`
  - `POST /account/contact :: billing_contact[address1],billing_contact[address2],billing_contact[city],billing_contact[country_code],billing_contact[first_name],billing_contact[last_name],billing_contact[postal_code],billing_contact[region],contact_type,form_loaded_from,return_to,target,user_id,vat_code`
  - `POST /billing/extra :: billing_extra`

### personal: Code review limits

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: A repeatable web-only account preference.
- Routes: `/settings/code_review_limits`.
- Static modifying forms:
  - `PUT /settings/code_review_limits :: `

### personal: Codespaces settings

- Disposition: `MIXED`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Dotfiles, GPG, sync, editor, timeout, retention, host image, location, and trusted repository defaults are gaps.
- Routes: `/settings/codespaces`, `/settings/codespaces/secrets/new`.
- Capability markers: `Upgrade`.
- Static modifying forms:
  - `POST /settings/codespaces/secrets :: codespaces_user_secret[key_id],codespaces_user_secret[name],encrypted_value,filter,secret_value`
  - `PUT /settings/codespaces/dotfiles_enabled :: codespace_dotfiles_enabled`
  - `PUT /settings/codespaces/expiry_notification :: codespaces_expiry_notification`
  - `PUT /settings/codespaces/gpg_authorization :: gpg_authorization`
  - `PUT /settings/codespaces/preferred_editor :: codespace_preferred_editor`
  - `PUT /settings/codespaces/preferred_host_image :: codespace_preferred_host_image`
  - `PUT /settings/codespaces/repository_authorizations :: `
  - `PUT /settings/codespaces/repository_authorizations :: delete`
  - `PUT /settings/codespaces/repository_authorizations :: repository_authorization`
  - `PUT /settings/codespaces/settings_sync_authorization :: codespaces_settings_sync_authorization`
  - `PUT /settings/codespaces/update_default_idle_timeout :: codespace_default_idle_timeout`
  - `PUT /settings/codespaces/update_default_location :: default_location,regions`
  - `PUT /settings/codespaces/update_default_retention_period :: codespace_default_retention_period`
  - `PUT /settings/codespaces/update_trusted_repositories_access :: trusted_repositories_access`

### personal: Personal Copilot settings

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Feature, coding-agent, and memory preferences are entitlement-dependent web settings.
- Routes: `/settings/copilot/coding_agent`, `/settings/copilot/features`, `/settings/copilot`, `/settings/copilot/memory`.
- React apps: `copilot-memory`.
- Capability markers: `Upgrade`.
- Static modifying forms:
  - `POST /settings/copilot/show_copilot :: show_copilot`
  - `PUT /enterprises/{enterprise}/settings/{name}-business/copilot_permission_to_assign_seats :: `
  - `PUT /enterprises/{enterprise}/settings/{name}/copilot_permission_to_assign_seats :: `
  - `PUT /settings/copilot :: automatic_code_review,bing_github_chat,blackbird_external_indexing,chat_enabled,cli,code_review,copilot_app,dashboard_entry_point,desktop,dotcom_chat,editor_preview_features,experimental_auto_models,generated_commit_message,mcp,memory,mobile_chat,model_native_search,public_code_suggestions,spaces,spaces_individual_access,spaces_individual_sharing,swe_agent,telemetry`
  - `PUT /settings/copilot :: telemetry`

### personal: SSH/GPG and credential preferences

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Do not duplicate key management; only the remaining preference is a gap.
- Routes: `/settings/credentials`, `/settings/gpg/new`, `/settings/keys`, `/settings/ssh/new`.
- Static modifying forms:
  - `DELETE /account/public_keys/{id} :: `
  - `POST /account/gpg_keys :: gpg_key[name],gpg_key[public_key]`
  - `POST /settings/ssh :: ssh_key[key],ssh_key[key_type],ssh_key[title]`
  - `PUT /settings/keys/commit_verification_status :: toggle_commit_verification_status`

### personal: Deleted repository restoration

- Disposition: `CANDIDATE`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Restore is a high-value, verifiable web workflow.
- Routes: `/settings/deleted_repositories`.
- Static modifying forms:
  - `POST /settings/restore_repo/{id} :: `

### personal: Email addresses and roles

- Disposition: `MIXED`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Only web-only email-role operations belong in gh2.
- Routes: `/settings/emails`, `/settings/emails/subscriptions`.
- Static modifying forms:
  - `DELETE /users/{user}/emails/{id} :: `
  - `POST /settings/emails/{id}/link-request :: email`
  - `POST /users/{user}/emails :: user_email[email]`
  - `PUT /users/{user}/emails/{id} :: `
  - `PUT /users/{user}/emails/{id} :: id`
  - `PUT /users/{user}/emails/{id}/unlink_social_identity :: `

### personal: Owned and authorized GitHub Apps

- Disposition: `EXISTING`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: gh2 already covers create/list/info/update/permissions/delete/token; substantial lifecycle gaps remain.
- Routes: `/settings/apps`, `/settings/apps/authorizations`, `/settings/apps/new`, `/settings/apps/{app}`, `/settings/apps/{app}/advanced`, `/settings/apps/{app}/beta`, `/settings/apps/{app}/hooks/{id}/deliveries`, `/settings/apps/{app}/installations`, `/settings/apps/{app}/permissions`.
- Capability markers: `Enterprise account`.
- Static modifying forms:
  - `DELETE /settings/apps/{app} :: verify`
  - `DELETE /settings/apps/{app}/key/{id} :: `
  - `DELETE /settings/connections/applications/{application} :: `
  - `POST /settings/apps :: commit,integration[application_callback_urls_attributes][0][_destroy],integration[application_callback_urls_attributes][0][url],integration[application_callback_urls_attributes][TEMPLATE_INDEX][_destroy],integration[application_callback_urls_attributes][TEMPLATE_INDEX][url],integration[default_events][],integration[default_permissions][actions],integration[default_permissions][actions_variables],integration[default_permissions][administration],integration[default_permissions][agent_secrets],integration[default_permissions][agent_tasks],integration[default_permissions][agent_variables],integration[default_permissions][artifact_metadata],integration[default_permissions][attestations],integration[default_permissions][blocking],integration[default_permissions][checks],integration[default_permissions][code_quality],integration[default_permissions][codespaces],integration[default_permissions][codespaces_lifecycle_admin],integration[default_permissions][codespaces_metadata],integration[default_permissions][codespaces_secrets],integration[default_permissions][codespaces_user_secrets],integration[default_permissions][contents],integration[default_permissions][copilot_agent_settings],integration[default_permissions][copilot_editor_context],integration[default_permissions][copilot_messages],integration[default_permissions][custom_properties_for_organizations],integration[default_permissions][dependabot_secrets],integration[default_permissions][deployments],integration[default_permissions][discussions],integration[default_permissions][emails],integration[default_permissions][enterprise_ai_controls],integration[default_permissions][enterprise_copilot_metrics],integration[default_permissions][enterprise_copilot_usage],integration[default_permissions][enterprise_credentials],integration[default_permissions][enterprise_custom_enterprise_roles],integration[default_permissions][enterprise_custom_org_roles],integration[default_permissions][enterprise_custom_properties],integration[default_permissions][enterprise_custom_properties_for_organizations],integration[default_permissions][enterprise_innersource_vulnerabilities],integration[default_permissions][enterprise_organization_installation_repositories],integration[default_permissions][enterprise_organization_installations],integration[default_permissions][enterprise_organizations],integration[default_permissions][enterprise_people],integration[default_permissions][enterprise_sso],integration[default_permissions][enterprise_teams],integration[default_permissions][environments],integration[default_permissions][followers],integration[default_permissions][gists],integration[default_permissions][git_signing_ssh_public_keys],integration[default_permissions][gpg_keys],integration[default_permissions][interaction_limits],integration[default_permissions][issue_fields],integration[default_permissions][issue_types],integration[default_permissions][issues],integration[default_permissions][keys],integration[default_permissions][license_compliance_alerts],integration[default_permissions][members],integration[default_permissions][merge_queues],integration[default_permissions][metadata],integration[default_permissions][org_copilot_content_exclusion],integration[default_permissions][organization_actions_variables],integration[default_permissions][organization_administration],integration[default_permissions][organization_agent_secrets],integration[default_permissions][organization_agent_variables],integration[default_permissions][organization_announcement_banners],integration[default_permissions][organization_api_insights],integration[default_permissions][organization_campaigns],integration[default_permissions][organization_code_scanning_dismissal_requests],integration[default_permissions][organization_codespaces],integration[default_permissions][organization_codespaces_secrets],integration[default_permissions][organization_codespaces_settings],integration[default_permissions][organization_copilot_agent_settings],integration[default_permissions][organization_copilot_metrics],integration[default_permissions][organization_copilot_seat_management],integration[default_permissions][organization_copilot_spaces],integration[default_permissions][organization_credentials],integration[default_permissions][organization_custom_org_roles],integration[default_permissions][organization_custom_properties],integration[default_permissions][organization_custom_roles],integration[default_permissions][organization_dependabot_dismissal_requests],integration[default_permissions][organization_dependabot_secrets],integration[default_permissions][organization_events],integration[default_permissions][organization_hooks],integration[default_permissions][organization_innersource_vulnerabilities],integration[default_permissions][organization_models],integration[default_permissions][organization_network_configurations],integration[default_permissions][organization_personal_access_token_requests],integration[default_permissions][organization_personal_access_tokens],integration[default_permissions][organization_plan],integration[default_permissions][organization_private_registries],integration[default_permissions][organization_projects],integration[default_permissions][organization_runner_custom_images],integration[default_permissions][organization_secret_scanning_bypass_requests],integration[default_permissions][organization_secrets],integration[default_permissions][organization_self_hosted_runners],integration[default_permissions][organization_user_blocking],integration[default_permissions][packages],integration[default_permissions][pages],integration[default_permissions][plan],integration[default_permissions][profile],integration[default_permissions][pull_requests],integration[default_permissions][repo_secret_scanning_dismissal_requests],integration[default_permissions][repository_advisories],integration[default_permissions][repository_custom_properties],integration[default_permissions][repository_hooks],integration[default_permissions][repository_projects],integration[default_permissions][secret_scanning_alerts],integration[default_permissions][secret_scanning_bypass_requests],integration[default_permissions][secret_scanning_dismissal_requests],integration[default_permissions][secrets],integration[default_permissions][security_events],integration[default_permissions][single_file],integration[default_permissions][starring],integration[default_permissions][statuses],integration[default_permissions][user_events],integration[default_permissions][user_models],integration[default_permissions][vulnerability_alerts],integration[default_permissions][watching],integration[default_permissions][workflows],integration[description],integration[device_flow_enabled],integration[hook_attributes][_destroy],integration[hook_attributes][active],integration[hook_attributes][insecure_ssl],integration[hook_attributes][secret],integration[hook_attributes][url],integration[integrator_events][],integration[name],integration[request_oauth_on_install],integration[setup_on_update],integration[setup_url],integration[single_file_paths][],integration[url],integration[user_token_expiration_enabled],integration[visibility]`
  - `POST /settings/apps/{app}/client_secret :: `
  - `POST /settings/apps/{app}/ip_allowlist_entries :: ip_allowlist_entry[allow_list_value],ip_allowlist_entry[name]`
  - `POST /settings/apps/{app}/key :: `
  - `POST /settings/apps/{app}/revoke_all_tokens :: `
  - `POST /settings/connections/applications/{application} :: `
  - `PUT /settings/apps/{app} :: commit,integration[application_callback_urls_attributes][0][_destroy],integration[application_callback_urls_attributes][0][id],integration[application_callback_urls_attributes][0][url],integration[application_callback_urls_attributes][TEMPLATE_INDEX][_destroy],integration[application_callback_urls_attributes][TEMPLATE_INDEX][url],integration[description],integration[device_flow_enabled],integration[hook_attributes][_destroy],integration[hook_attributes][active],integration[hook_attributes][insecure_ssl],integration[hook_attributes][secret],integration[hook_attributes][url],integration[name],integration[request_oauth_on_install],integration[setup_on_update],integration[setup_url],integration[url]`
  - `PUT /settings/apps/{app}/beta-toggle :: beta_feature,beta_feature_toggle`
  - `PUT /settings/apps/{app}/permissions :: commit,integration[default_events][],integration[default_permissions][actions],integration[default_permissions][actions_variables],integration[default_permissions][administration],integration[default_permissions][agent_secrets],integration[default_permissions][agent_tasks],integration[default_permissions][agent_variables],integration[default_permissions][artifact_metadata],integration[default_permissions][attestations],integration[default_permissions][blocking],integration[default_permissions][checks],integration[default_permissions][code_quality],integration[default_permissions][codespaces],integration[default_permissions][codespaces_lifecycle_admin],integration[default_permissions][codespaces_metadata],integration[default_permissions][codespaces_secrets],integration[default_permissions][codespaces_user_secrets],integration[default_permissions][contents],integration[default_permissions][copilot_agent_settings],integration[default_permissions][copilot_editor_context],integration[default_permissions][copilot_messages],integration[default_permissions][custom_properties_for_organizations],integration[default_permissions][dependabot_secrets],integration[default_permissions][deployments],integration[default_permissions][discussions],integration[default_permissions][emails],integration[default_permissions][enterprise_ai_controls],integration[default_permissions][enterprise_copilot_metrics],integration[default_permissions][enterprise_copilot_usage],integration[default_permissions][enterprise_credentials],integration[default_permissions][enterprise_custom_enterprise_roles],integration[default_permissions][enterprise_custom_org_roles],integration[default_permissions][enterprise_custom_properties],integration[default_permissions][enterprise_custom_properties_for_organizations],integration[default_permissions][enterprise_innersource_vulnerabilities],integration[default_permissions][enterprise_organization_installation_repositories],integration[default_permissions][enterprise_organization_installations],integration[default_permissions][enterprise_organizations],integration[default_permissions][enterprise_people],integration[default_permissions][enterprise_sso],integration[default_permissions][enterprise_teams],integration[default_permissions][environments],integration[default_permissions][followers],integration[default_permissions][gists],integration[default_permissions][git_signing_ssh_public_keys],integration[default_permissions][gpg_keys],integration[default_permissions][interaction_limits],integration[default_permissions][issue_fields],integration[default_permissions][issue_types],integration[default_permissions][issues],integration[default_permissions][keys],integration[default_permissions][license_compliance_alerts],integration[default_permissions][members],integration[default_permissions][merge_queues],integration[default_permissions][metadata],integration[default_permissions][org_copilot_content_exclusion],integration[default_permissions][organization_actions_variables],integration[default_permissions][organization_administration],integration[default_permissions][organization_agent_secrets],integration[default_permissions][organization_agent_variables],integration[default_permissions][organization_announcement_banners],integration[default_permissions][organization_api_insights],integration[default_permissions][organization_campaigns],integration[default_permissions][organization_code_scanning_dismissal_requests],integration[default_permissions][organization_codespaces],integration[default_permissions][organization_codespaces_secrets],integration[default_permissions][organization_codespaces_settings],integration[default_permissions][organization_copilot_agent_settings],integration[default_permissions][organization_copilot_metrics],integration[default_permissions][organization_copilot_seat_management],integration[default_permissions][organization_copilot_spaces],integration[default_permissions][organization_credentials],integration[default_permissions][organization_custom_org_roles],integration[default_permissions][organization_custom_properties],integration[default_permissions][organization_custom_roles],integration[default_permissions][organization_dependabot_dismissal_requests],integration[default_permissions][organization_dependabot_secrets],integration[default_permissions][organization_events],integration[default_permissions][organization_hooks],integration[default_permissions][organization_innersource_vulnerabilities],integration[default_permissions][organization_models],integration[default_permissions][organization_network_configurations],integration[default_permissions][organization_personal_access_token_requests],integration[default_permissions][organization_personal_access_tokens],integration[default_permissions][organization_plan],integration[default_permissions][organization_private_registries],integration[default_permissions][organization_projects],integration[default_permissions][organization_runner_custom_images],integration[default_permissions][organization_secret_scanning_bypass_requests],integration[default_permissions][organization_secrets],integration[default_permissions][organization_self_hosted_runners],integration[default_permissions][organization_user_blocking],integration[default_permissions][packages],integration[default_permissions][pages],integration[default_permissions][plan],integration[default_permissions][profile],integration[default_permissions][pull_requests],integration[default_permissions][repo_secret_scanning_dismissal_requests],integration[default_permissions][repository_advisories],integration[default_permissions][repository_custom_properties],integration[default_permissions][repository_hooks],integration[default_permissions][repository_projects],integration[default_permissions][secret_scanning_alerts],integration[default_permissions][secret_scanning_bypass_requests],integration[default_permissions][secret_scanning_dismissal_requests],integration[default_permissions][secrets],integration[default_permissions][security_events],integration[default_permissions][single_file],integration[default_permissions][starring],integration[default_permissions][statuses],integration[default_permissions][user_events],integration[default_permissions][user_models],integration[default_permissions][vulnerability_alerts],integration[default_permissions][watching],integration[default_permissions][workflows],integration[integrator_events][],integration[note],integration[single_file_paths][]`
  - `PUT /settings/apps/{app}/public :: `
  - `PUT /settings/apps/{app}/transfer :: transfer_to`

### personal: Installed GitHub Apps

- Disposition: `MIXED`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Permission approval and browser-session configuration remain gh2 candidates.
- Routes: `/settings/installations`, `/settings/installations/{id}`, `/settings/installations/{id}/permissions/update`.
- Static modifying forms:
  - `DELETE /settings/installations/{id} :: `
  - `POST /settings/installations/{id}/suspended :: `
  - `PUT /settings/installations/{id}/permissions/update :: integration_fingerprint,version_id`
  - `PUT /settings/installations/{id}/update :: install_target,integration_fingerprint,target_id`

### personal: Notification routing

- Disposition: `CANDIDATE`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Default channels and custom routing are React-backed web settings.
- Routes: `/settings/notifications`, `/settings/notifications/custom_routing`.
- React apps: `notification-settings`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### personal: OAuth grants and OAuth Apps

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Grant inspection/revocation and OAuth App registration lifecycle are web-only gaps.
- Routes: `/settings/applications`, `/settings/applications/new`, `/settings/connections/applications/{application}`.
- Static modifying forms:
  - `DELETE /settings/connections/applications/{application} :: `
  - `POST /orgs/{org}/policies/applications/{id}/request :: `
  - `POST /settings/applications :: oauth_application[callback_url],oauth_application[description],oauth_application[device_flow_enabled],oauth_application[name],oauth_application[url]`
  - `POST /settings/connections/applications/{application} :: `
  - `POST /settings/connections/applications/{application}/report :: revoke`
  - `PUT /orgs/{org}/policies/applications/{id}/set_state :: `

### personal: ORCID connection

- Disposition: `LOW`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Low-frequency identity-linking workflow.
- Routes: `/settings/orcid_connection/new`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### personal: Organization memberships

- Disposition: `RISKY`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Leaving organizations is destructive and should not be a generic settings command.
- Routes: `/settings/organizations`.
- Static modifying forms:
  - `POST /organizations/{org}/leave :: `

### personal: Package defaults

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Container permission inheritance default is web-only.
- Routes: `/settings/packages`.
- Static modifying forms:
  - `PUT /settings/packages :: packages[containers][inherit_access]`

### personal: Personal access tokens

- Disposition: `EXISTING`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: gh2 already creates fine-grained PATs; list, regenerate, expiration, and revoke are additional sensitive gaps.
- Routes: `/settings/personal-access-tokens`, `/settings/personal-access-tokens/{token}`, `/settings/tokens`, `/settings/tokens/{token}`, `/settings/personal-access-tokens/{token}/expiration`, `/settings/personal-access-tokens/{token}/regenerate`, `/settings/tokens/{token}/regenerate`.
- Static modifying forms:
  - `DELETE /settings/personal-access-tokens/{token} :: `
  - `DELETE /settings/tokens/{token} :: `
  - `POST /settings/personal-access-tokens :: filter,install_target,integration[default_permissions][actions],integration[default_permissions][actions_variables],integration[default_permissions][administration],integration[default_permissions][agent_secrets],integration[default_permissions][agent_tasks],integration[default_permissions][agent_variables],integration[default_permissions][artifact_metadata],integration[default_permissions][attestations],integration[default_permissions][blocking],integration[default_permissions][code_quality],integration[default_permissions][codespaces],integration[default_permissions][codespaces_lifecycle_admin],integration[default_permissions][codespaces_metadata],integration[default_permissions][codespaces_secrets],integration[default_permissions][codespaces_user_secrets],integration[default_permissions][contents],integration[default_permissions][copilot_agent_settings],integration[default_permissions][copilot_editor_context],integration[default_permissions][copilot_messages],integration[default_permissions][custom_properties_for_organizations],integration[default_permissions][dependabot_secrets],integration[default_permissions][deployments],integration[default_permissions][discussions],integration[default_permissions][emails],integration[default_permissions][enterprise_ai_controls],integration[default_permissions][enterprise_copilot_metrics],integration[default_permissions][enterprise_copilot_usage],integration[default_permissions][enterprise_credentials],integration[default_permissions][enterprise_custom_enterprise_roles],integration[default_permissions][enterprise_custom_org_roles],integration[default_permissions][enterprise_custom_properties],integration[default_permissions][enterprise_custom_properties_for_organizations],integration[default_permissions][enterprise_organizations],integration[default_permissions][enterprise_people],integration[default_permissions][enterprise_sso],integration[default_permissions][environments],integration[default_permissions][followers],integration[default_permissions][gists],integration[default_permissions][git_signing_ssh_public_keys],integration[default_permissions][gpg_keys],integration[default_permissions][interaction_limits],integration[default_permissions][issue_fields],integration[default_permissions][issue_types],integration[default_permissions][issues],integration[default_permissions][keys],integration[default_permissions][license_compliance_alerts],integration[default_permissions][members],integration[default_permissions][merge_queues],integration[default_permissions][metadata],integration[default_permissions][org_copilot_content_exclusion],integration[default_permissions][organization_actions_variables],integration[default_permissions][organization_administration],integration[default_permissions][organization_agent_secrets],integration[default_permissions][organization_agent_variables],integration[default_permissions][organization_announcement_banners],integration[default_permissions][organization_api_insights],integration[default_permissions][organization_campaigns],integration[default_permissions][organization_code_scanning_dismissal_requests],integration[default_permissions][organization_codespaces],integration[default_permissions][organization_codespaces_secrets],integration[default_permissions][organization_codespaces_settings],integration[default_permissions][organization_copilot_agent_settings],integration[default_permissions][organization_copilot_metrics],integration[default_permissions][organization_copilot_seat_management],integration[default_permissions][organization_copilot_spaces],integration[default_permissions][organization_credentials],integration[default_permissions][organization_custom_org_roles],integration[default_permissions][organization_custom_properties],integration[default_permissions][organization_custom_roles],integration[default_permissions][organization_dependabot_dismissal_requests],integration[default_permissions][organization_dependabot_secrets],integration[default_permissions][organization_events],integration[default_permissions][organization_hooks],integration[default_permissions][organization_models],integration[default_permissions][organization_network_configurations],integration[default_permissions][organization_plan],integration[default_permissions][organization_private_registries],integration[default_permissions][organization_projects],integration[default_permissions][organization_runner_custom_images],integration[default_permissions][organization_secret_scanning_bypass_requests],integration[default_permissions][organization_secrets],integration[default_permissions][organization_self_hosted_runners],integration[default_permissions][organization_user_blocking],integration[default_permissions][pages],integration[default_permissions][plan],integration[default_permissions][private_repository_invitations],integration[default_permissions][profile],integration[default_permissions][pull_requests],integration[default_permissions][repo_secret_scanning_dismissal_requests],integration[default_permissions][repository_advisories],integration[default_permissions][repository_custom_properties],integration[default_permissions][repository_hooks],integration[default_permissions][secret_scanning_alerts],integration[default_permissions][secret_scanning_bypass_requests],integration[default_permissions][secret_scanning_dismissal_requests],integration[default_permissions][secrets],integration[default_permissions][security_events],integration[default_permissions][starring],integration[default_permissions][statuses],integration[default_permissions][user_copilot_requests],integration[default_permissions][user_events],integration[default_permissions][user_models],integration[default_permissions][vulnerability_alerts],integration[default_permissions][watching],integration[default_permissions][workflows],target_name,user_programmatic_access[custom_expires_at],user_programmatic_access[default_expires_at],user_programmatic_access[description],user_programmatic_access[name]`
  - `POST /settings/personal-access-tokens/{token}/regenerate :: index_page,user_programmatic_access[custom_expires_at],user_programmatic_access[default_expires_at]`
  - `POST /settings/tokens :: oauth_access[custom_expires_at],oauth_access[default_expires_at],oauth_access[description],oauth_access[scopes][]`
  - `POST /settings/tokens/{token}/regenerate :: index_page,oauth_access[custom_expires_at],oauth_access[default_expires_at]`

### personal: Profile and privacy

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Only non-API preference fields are gh2 candidates, with low priority.
- Routes: `/settings`, `/settings/profile`.
- Static modifying forms:
  - `DELETE /settings/orcid_connection :: `
  - `DELETE /settings/primary_avatar :: `
  - `DELETE /settings/profile_email :: `
  - `PUT /users/{user} :: `
  - `PUT /users/{user} :: commit,user[profile_spoken_language_preference_code]`
  - `PUT /users/{user} :: required_field_0d6b,timestamp,timestamp_secret,user[display_name],user[profile_bio],user[profile_blog],user[profile_company],user[profile_display_local_time_zone],user[profile_email],user[profile_local_time_zone_name],user[profile_location],user[profile_pronouns],user[profile_social_accounts][][key],user[profile_social_accounts][][url]`
  - `PUT /users/{user} :: required_field_3675,timestamp,timestamp_secret,user[display_name],user[profile_bio],user[profile_blog],user[profile_company],user[profile_display_local_time_zone],user[profile_email],user[profile_local_time_zone_name],user[profile_location],user[profile_pronouns],user[profile_social_accounts][][key],user[profile_social_accounts][][url]`
  - `PUT /users/{user} :: required_field_4608,timestamp,timestamp_secret,user[display_name],user[profile_bio],user[profile_blog],user[profile_company],user[profile_display_local_time_zone],user[profile_email],user[profile_local_time_zone_name],user[profile_location],user[profile_pronouns],user[profile_social_accounts][][key],user[profile_social_accounts][][url]`
  - `PUT /users/{user} :: required_field_723e,timestamp,timestamp_secret,user[display_name],user[profile_bio],user[profile_blog],user[profile_company],user[profile_display_local_time_zone],user[profile_email],user[profile_local_time_zone_name],user[profile_location],user[profile_pronouns],user[profile_social_accounts][][key],user[profile_social_accounts][][url]`
  - `PUT /users/{user} :: user[profile_hireable]`
  - `PUT /users/{user}/set_private_contributions_preference :: user[private_profile],user[show_private_contribution_count]`
  - `PUT /users/{user}/set_profile_badges_preference :: user[achievements_enabled]`

### personal: Scheduled reminders

- Disposition: `CANDIDATE`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Authorization and schedule settings are repeatable web workflows.
- Routes: `/settings/reminders`, `/settings/reminders/{organization}`.
- Capability markers: `Upgrade`.
- Static modifying forms:
  - `PATCH /settings/reminders/{organization} :: Africa/Abidjan,Africa/Accra,Africa/Addis_Ababa,Africa/Algiers,Africa/Asmara,Africa/Asmera,Africa/Bamako,Africa/Bangui,Africa/Banjul,Africa/Bissau,Africa/Blantyre,Africa/Brazzaville,Africa/Bujumbura,Africa/Cairo,Africa/Casablanca,Africa/Ceuta,Africa/Conakry,Africa/Dakar,Africa/Dar_es_Salaam,Africa/Djibouti,Africa/Douala,Africa/El_Aaiun,Africa/Freetown,Africa/Gaborone,Africa/Harare,Africa/Johannesburg,Africa/Juba,Africa/Kampala,Africa/Khartoum,Africa/Kigali,Africa/Kinshasa,Africa/Lagos,Africa/Libreville,Africa/Lome,Africa/Luanda,Africa/Lubumbashi,Africa/Lusaka,Africa/Malabo,Africa/Maputo,Africa/Maseru,Africa/Mbabane,Africa/Mogadishu,Africa/Monrovia,Africa/Nairobi,Africa/Ndjamena,Africa/Niamey,Africa/Nouakchott,Africa/Ouagadougou,Africa/Porto-Novo,Africa/Sao_Tome,Africa/Timbuktu,Africa/Tripoli,Africa/Tunis,Africa/Windhoek,America/Adak,America/Anchorage,America/Anguilla,America/Antigua,America/Araguaina,America/Argentina/Buenos_Aires,America/Argentina/Catamarca,America/Argentina/ComodRivadavia,America/Argentina/Cordoba,America/Argentina/Jujuy,America/Argentina/La_Rioja,America/Argentina/Mendoza,America/Argentina/Rio_Gallegos,America/Argentina/Salta,America/Argentina/San_Juan,America/Argentina/San_Luis,America/Argentina/Tucuman,America/Argentina/Ushuaia,America/Aruba,America/Asuncion,America/Atikokan,America/Atka,America/Bahia,America/Bahia_Banderas,America/Barbados,America/Belem,America/Belize,America/Blanc-Sablon,America/Boa_Vista,America/Bogota,America/Boise,America/Buenos_Aires,America/Cambridge_Bay,America/Campo_Grande,America/Cancun,America/Caracas,America/Catamarca,America/Cayenne,America/Cayman,America/Chicago,America/Chihuahua,America/Ciudad_Juarez,America/Coral_Harbour,America/Cordoba,America/Costa_Rica,America/Coyhaique,America/Creston,America/Cuiaba,America/Curacao,America/Danmarkshavn,America/Dawson,America/Dawson_Creek,America/Denver,America/Detroit,America/Dominica,America/Edmonton,America/Eirunepe,America/El_Salvador,America/Ensenada,America/Fort_Nelson,America/Fort_Wayne,America/Fortaleza,America/Glace_Bay,America/Godthab,America/Goose_Bay,America/Grand_Turk,America/Grenada,America/Guadeloupe,America/Guatemala,America/Guayaquil,America/Guyana,America/Halifax,America/Havana,America/Hermosillo,America/Indiana/Indianapolis,America/Indiana/Knox,America/Indiana/Marengo,America/Indiana/Petersburg,America/Indiana/Tell_City,America/Indiana/Vevay,America/Indiana/Vincennes,America/Indiana/Winamac,America/Indianapolis,America/Inuvik,America/Iqaluit,America/Jamaica,America/Jujuy,America/Juneau,America/Kentucky/Louisville,America/Kentucky/Monticello,America/Knox_IN,America/Kralendijk,America/La_Paz,America/Lima,America/Los_Angeles,America/Louisville,America/Lower_Princes,America/Maceio,America/Managua,America/Manaus,America/Marigot,America/Martinique,America/Matamoros,America/Mazatlan,America/Mendoza,America/Menominee,America/Merida,America/Metlakatla,America/Mexico_City,America/Miquelon,America/Moncton,America/Monterrey,America/Montevideo,America/Montreal,America/Montserrat,America/Nassau,America/New_York,America/Nipigon,America/Nome,America/Noronha,America/North_Dakota/Beulah,America/North_Dakota/Center,America/North_Dakota/New_Salem,America/Nuuk,America/Ojinaga,America/Panama,America/Pangnirtung,America/Paramaribo,America/Phoenix,America/Port-au-Prince,America/Port_of_Spain,America/Porto_Acre,America/Porto_Velho,America/Puerto_Rico,America/Punta_Arenas,America/Rainy_River,America/Rankin_Inlet,America/Recife,America/Regina,America/Resolute,America/Rio_Branco,America/Rosario,America/Santa_Isabel,America/Santarem,America/Santiago,America/Santo_Domingo,America/Sao_Paulo,America/Scoresbysund,America/Shiprock,America/Sitka,America/St_Barthelemy,America/St_Johns,America/St_Kitts,America/St_Lucia,America/St_Thomas,America/St_Vincent,America/Swift_Current,America/Tegucigalpa,America/Thule,America/Thunder_Bay,America/Tijuana,America/Toronto,America/Tortola,America/Vancouver,America/Virgin,America/Whitehorse,America/Winnipeg,America/Yakutat,America/Yellowknife,Antarctica/Casey,Antarctica/Davis,Antarctica/DumontDUrville,Antarctica/Macquarie,Antarctica/Mawson,Antarctica/McMurdo,Antarctica/Palmer,Antarctica/Rothera,Antarctica/South_Pole,Antarctica/Syowa,Antarctica/Troll,Antarctica/Vostok,Arctic/Longyearbyen,Asia/Aden,Asia/Almaty,Asia/Amman,Asia/Anadyr,Asia/Aqtau,Asia/Aqtobe,Asia/Ashgabat,Asia/Ashkhabad,Asia/Atyrau,Asia/Baghdad,Asia/Bahrain,Asia/Baku,Asia/Bangkok,Asia/Barnaul,Asia/Beirut,Asia/Bishkek,Asia/Brunei,Asia/Calcutta,Asia/Chita,Asia/Choibalsan,Asia/Chongqing,Asia/Chungking,Asia/Colombo,Asia/Dacca,Asia/Damascus,Asia/Dhaka,Asia/Dili,Asia/Dubai,Asia/Dushanbe,Asia/Famagusta,Asia/Gaza,Asia/Harbin,Asia/Hebron,Asia/Ho_Chi_Minh,Asia/Hong_Kong,Asia/Hovd,Asia/Irkutsk,Asia/Istanbul,Asia/Jakarta,Asia/Jayapura,Asia/Jerusalem,Asia/Kabul,Asia/Kamchatka,Asia/Karachi,Asia/Kashgar,Asia/Kathmandu,Asia/Katmandu,Asia/Khandyga,Asia/Kolkata,Asia/Krasnoyarsk,Asia/Kuala_Lumpur,Asia/Kuching,Asia/Kuwait,Asia/Macao,Asia/Macau,Asia/Magadan,Asia/Makassar,Asia/Manila,Asia/Muscat,Asia/Nicosia,Asia/Novokuznetsk,Asia/Novosibirsk,Asia/Omsk,Asia/Oral,Asia/Phnom_Penh,Asia/Pontianak,Asia/Pyongyang,Asia/Qatar,Asia/Qostanay,Asia/Qyzylorda,Asia/Rangoon,Asia/Riyadh,Asia/Saigon,Asia/Sakhalin,Asia/Samarkand,Asia/Seoul,Asia/Shanghai,Asia/Singapore,Asia/Srednekolymsk,Asia/Taipei,Asia/Tashkent,Asia/Tbilisi,Asia/Tehran,Asia/Tel_Aviv,Asia/Thimbu,Asia/Thimphu,Asia/Tokyo,Asia/Tomsk,Asia/Ujung_Pandang,Asia/Ulaanbaatar,Asia/Ulan_Bator,Asia/Urumqi,Asia/Ust-Nera,Asia/Vientiane,Asia/Vladivostok,Asia/Yakutsk,Asia/Yangon,Asia/Yekaterinburg,Asia/Yerevan,Atlantic/Azores,Atlantic/Bermuda,Atlantic/Canary,Atlantic/Cape_Verde,Atlantic/Faeroe,Atlantic/Faroe,Atlantic/Jan_Mayen,Atlantic/Madeira,Atlantic/Reykjavik,Atlantic/South_Georgia,Atlantic/St_Helena,Atlantic/Stanley,Australia/ACT,Australia/Adelaide,Australia/Brisbane,Australia/Broken_Hill,Australia/Canberra,Australia/Currie,Australia/Darwin,Australia/Eucla,Australia/Hobart,Australia/LHI,Australia/Lindeman,Australia/Lord_Howe,Australia/Melbourne,Australia/NSW,Australia/North,Australia/Perth,Australia/Queensland,Australia/South,Australia/Sydney,Australia/Tasmania,Australia/Victoria,Australia/West,Australia/Yancowinna,Brazil/Acre,Brazil/DeNoronha,Brazil/East,Brazil/West,CET,CST6CDT,Canada/Atlantic,Canada/Central,Canada/Eastern,Canada/Mountain,Canada/Newfoundland,Canada/Pacific,Canada/Saskatchewan,Canada/Yukon,Chile/Continental,Chile/EasterIsland,Cuba,EET,EST,EST5EDT,Egypt,Eire,Etc/GMT,Etc/GMT+0,Etc/GMT+1,Etc/GMT+10,Etc/GMT+11,Etc/GMT+12,Etc/GMT+2,Etc/GMT+3,Etc/GMT+4,Etc/GMT+5,Etc/GMT+6,Etc/GMT+7,Etc/GMT+8,Etc/GMT+9,Etc/GMT-0,Etc/GMT-1,Etc/GMT-10,Etc/GMT-11,Etc/GMT-12,Etc/GMT-13,Etc/GMT-14,Etc/GMT-2,Etc/GMT-3,Etc/GMT-4,Etc/GMT-5,Etc/GMT-6,Etc/GMT-7,Etc/GMT-8,Etc/GMT-9,Etc/GMT0,Etc/Greenwich,Etc/UCT,Etc/UTC,Etc/Universal,Etc/Zulu,Europe/Amsterdam,Europe/Andorra,Europe/Astrakhan,Europe/Athens,Europe/Belfast,Europe/Belgrade,Europe/Berlin,Europe/Bratislava,Europe/Brussels,Europe/Bucharest,Europe/Budapest,Europe/Busingen,Europe/Chisinau,Europe/Copenhagen,Europe/Dublin,Europe/Gibraltar,Europe/Guernsey,Europe/Helsinki,Europe/Isle_of_Man,Europe/Istanbul,Europe/Jersey,Europe/Kaliningrad,Europe/Kiev,Europe/Kirov,Europe/Kyiv,Europe/Lisbon,Europe/Ljubljana,Europe/London,Europe/Luxembourg,Europe/Madrid,Europe/Malta,Europe/Mariehamn,Europe/Minsk,Europe/Monaco,Europe/Moscow,Europe/Nicosia,Europe/Oslo,Europe/Paris,Europe/Podgorica,Europe/Prague,Europe/Riga,Europe/Rome,Europe/Samara,Europe/San_Marino,Europe/Sarajevo,Europe/Saratov,Europe/Simferopol,Europe/Skopje,Europe/Sofia,Europe/Stockholm,Europe/Tallinn,Europe/Tirane,Europe/Tiraspol,Europe/Ulyanovsk,Europe/Uzhgorod,Europe/Vaduz,Europe/Vatican,Europe/Vienna,Europe/Vilnius,Europe/Volgograd,Europe/Warsaw,Europe/Zagreb,Europe/Zaporozhye,Europe/Zurich,Factory,GB,GB-Eire,GMT,GMT+0,GMT-0,GMT0,Greenwich,HST,Hongkong,Iceland,Indian/Antananarivo,Indian/Chagos,Indian/Christmas,Indian/Cocos,Indian/Comoro,Indian/Kerguelen,Indian/Mahe,Indian/Maldives,Indian/Mauritius,Indian/Mayotte,Indian/Reunion,Iran,Israel,Jamaica,Japan,Kwajalein,Libya,MET,MST,MST7MDT,Mexico/BajaNorte,Mexico/BajaSur,Mexico/General,NZ,NZ-CHAT,Navajo,PRC,PST8PDT,Pacific/Apia,Pacific/Auckland,Pacific/Bougainville,Pacific/Chatham,Pacific/Chuuk,Pacific/Easter,Pacific/Efate,Pacific/Enderbury,Pacific/Fakaofo,Pacific/Fiji,Pacific/Funafuti,Pacific/Galapagos,Pacific/Gambier,Pacific/Guadalcanal,Pacific/Guam,Pacific/Honolulu,Pacific/Johnston,Pacific/Kanton,Pacific/Kiritimati,Pacific/Kosrae,Pacific/Kwajalein,Pacific/Majuro,Pacific/Marquesas,Pacific/Midway,Pacific/Nauru,Pacific/Niue,Pacific/Norfolk,Pacific/Noumea,Pacific/Pago_Pago,Pacific/Palau,Pacific/Pitcairn,Pacific/Pohnpei,Pacific/Ponape,Pacific/Port_Moresby,Pacific/Rarotonga,Pacific/Saipan,Pacific/Samoa,Pacific/Tahiti,Pacific/Tarawa,Pacific/Tongatapu,Pacific/Truk,Pacific/Wake,Pacific/Wallis,Pacific/Yap,Poland,Portugal,ROC,ROK,Turkey,UCT,US/Alaska,US/Aleutian,US/Arizona,US/Central,US/East-Indiana,US/Eastern,US/Hawaii,US/Indiana-Starke,US/Michigan,US/Mountain,US/Pacific,US/Samoa,Universal,W-SU,WET,Zulu,personal_reminder[delivery_time][days][],personal_reminder[delivery_time][times][],personal_reminder[include_review_requests],personal_reminder[include_team_review_requests],personal_reminder[reminder_event_subscriptions][],personal_reminder[reminder_event_subscriptions][][event_type],personal_reminder[reminder_event_subscriptions][][options],personal_reminder[subscribed_to_events]`
  - `POST /reminder_slack_workspaces/{organization}/authorize :: `

### personal: Saved replies

- Disposition: `CANDIDATE`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Straightforward web-only CRUD.
- Routes: `/settings/replies`.
- Static modifying forms:
  - `POST /settings/replies :: base_commit_oid,body,comment_id,end_commit_oid,line,path,preview_side,preview_start_side,saved_reply_id,start_commit_oid,start_line,title`

### personal: Personal repository defaults and memberships

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Defaults are candidates; leaving repositories is a risky separate workflow.
- Routes: `/settings/repositories`.
- Static modifying forms:
  - `POST /account/leave_repo/{id} :: `
  - `PUT /settings/default_branch :: default_branch_name`
  - `PUT /settings/repositories/commit-comments :: policy`

### personal: Password and authentication

- Disposition: `EXCLUDED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Password, 2FA, passkeys, recovery codes, and factor removal remain explicit non-goals.
- Routes: `/settings/security`.
- Static modifying forms:
  - `DELETE /settings/two_factor_authentication/disable_factor :: `
  - `DELETE /u2f/registrations/{id} :: `
  - `POST /settings/two_factor_authentication/configure_factor :: `
  - `POST /settings/two_factor_authentication/login_preference :: login_preference`
  - `POST /settings/two_factor_authentication/setup/disable :: `
  - `POST /u2f/registrations :: nickname,page_view,response`
  - `PUT /account/password :: required_field_72e0,timestamp,timestamp_secret,user[old_password],user[password],user[password_confirmation]`
  - `PUT /account/password :: required_field_e5e9,timestamp,timestamp_secret,user[old_password],user[password],user[password_confirmation]`
  - `PUT /u2f/registrations/{id} :: u2f_registration[nickname]`

### personal: Personal code-security defaults

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Dependency graph, Dependabot, private reporting, and push-protection defaults are web-only at account scope.
- Routes: `/settings/security_analysis`.
- Static modifying forms:
  - `PUT /settings/security_analysis :: dependabot_self_hosted`
  - `PUT /settings/security_analysis :: dependabot_self_hosted,show_update_tip`
  - `PUT /settings/security_analysis :: dependabot_self_hosted_new_repos`
  - `PUT /settings/security_analysis :: dependency_graph,dependency_graph_new_repos`
  - `PUT /settings/security_analysis :: dependency_graph_new_repos`
  - `PUT /settings/security_analysis :: private_vulnerability_reporting,private_vulnerability_reporting_new_repos`
  - `PUT /settings/security_analysis :: private_vulnerability_reporting_new_repos`
  - `PUT /settings/security_analysis :: push_protection_user`
  - `PUT /settings/security_analysis :: security_alerts,security_alerts_new_repos`
  - `PUT /settings/security_analysis :: security_alerts,security_alerts_new_repos,show_alert_tip`
  - `PUT /settings/security_analysis :: security_alerts_new_repos`
  - `PUT /settings/security_analysis :: show_update_tip,vulnerability_updates,vulnerability_updates_new_repos`
  - `PUT /settings/security_analysis :: show_update_tip,vulnerability_updates_grouping,vulnerability_updates_grouping_new_repos`
  - `PUT /settings/security_analysis :: vulnerability_updates,vulnerability_updates_new_repos`
  - `PUT /settings/security_analysis :: vulnerability_updates_grouping,vulnerability_updates_grouping_new_repos`
  - `PUT /settings/security_analysis :: vulnerability_updates_grouping_new_repos`
  - `PUT /settings/security_analysis :: vulnerability_updates_new_repos`

### personal: Personal security log

- Disposition: `READ`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Read/export could be useful, but it is not a settings mutation.
- Routes: `/settings/security-log`, `/settings/security-log/results`.
- Capability markers: `Upgrade`.
- Static modifying forms:
  - `POST /settings/security-log/export.json :: q`

### personal: Web sessions

- Disposition: `RISKY`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: List and revoke are useful but security-sensitive and require exact-device confirmation.
- Routes: `/settings/sessions`, `/settings/sessions/{session}`.
- Static modifying forms:
  - `DELETE /settings/sessions/{session}/mobile_revoke :: `

### personal: Sponsorship log

- Disposition: `READ`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Low-priority read/export surface.
- Routes: `/settings/sponsors-log`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### repository: Repository code-review limits

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `free`.
- Finding: Web-only repository setting.
- Routes: `/{owner}/{repo}/settings/code_review_limits`.
- Static modifying forms:
  - `PUT /{owner}/{repo}/settings/code_review_limits :: restrict`

### repository: Repository Copilot and agent settings

- Disposition: `CANDIDATE`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Code review, coding agent, internet access, allowlist, MCP, and memory are web-only or incomplete.
- Routes: `/{owner}/{repo}/settings/copilot/code_review`, `/{owner}/{repo}/settings/copilot/coding_agent`, `/{owner}/{repo}/settings/copilot/internet_access`, `/{owner}/{repo}/settings/copilot/internet_access/allowlist`, `/{owner}/{repo}/settings/copilot/mcp`, `/{owner}/{repo}/settings/copilot/memory`.
- React apps: `copilot-code-review-repo-settings`, `copilot-internet-access-settings`, `copilot-memory`, `copilot-swe-agent-settings`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### repository: Repository Dependabot rules

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `free`.
- Finding: Preset and custom Dependabot rules are web-only.
- Routes: `/{owner}/{repo}/settings/dependabot_rules`, `/{owner}/{repo}/settings/dependabot_rules/edit_parent/{id}`, `/{owner}/{repo}/settings/dependabot_rules/edit_parent/1`, `/{owner}/{repo}/settings/dependabot_rules/new`.
- Static modifying forms:
  - `POST /{owner}/{repo}/settings/dependabot_rules :: dependabot_updates_enabled,rule_criteria,vulnerability_alert_rule[auto_dismiss],vulnerability_alert_rule[auto_dismiss_option],vulnerability_alert_rule[create_pr],vulnerability_alert_rule[name],vulnerability_alert_rule[rule_behavior]`
  - `PUT /{owner}/{repo}/settings/dependabot_rules/update_parent/1 :: rule_behavior,rule_name`
  - `PUT /{owner}/{repo}/settings/dependabot_rules/update_parent/{id} :: rule_behavior,rule_name`

### repository: Repository general settings

- Disposition: `MIXED`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Only the enumerated non-API fields are gh2 candidates; delete/visibility/transfer are risky or API-backed.
- Routes: `/{owner}/{repo}/settings`.
- Static modifying forms:
  - `DELETE /{owner}/{repo}/settings/delete :: `
  - `DELETE /{owner}/{repo}/settings/open-graph-image :: id`
  - `POST /{owner}/{repo}/discussions/welcome_templates :: `
  - `POST /{owner}/{repo}/settings/archive :: verify`
  - `POST /{owner}/{repo}/settings/rename :: new_name,required_field_3d0c,timestamp,timestamp_secret`
  - `POST /{owner}/{repo}/settings/rename :: new_name,required_field_cb2c,timestamp,timestamp_secret`
  - `POST /{owner}/{repo}/settings/set_visibility :: `
  - `PUT /{owner}/{repo}/branches/main :: `
  - `PUT /{owner}/{repo}/settings/commit_comments :: has_commit_comments`
  - `PUT /{owner}/{repo}/settings/discussion_activation :: has_discussions`
  - `PUT /{owner}/{repo}/settings/issue_creation_policy :: issue_creation_policy`
  - `PUT /{owner}/{repo}/settings/open-graph-image :: `
  - `PUT /{owner}/{repo}/settings/projects :: memex_projects_enabled`
  - `PUT /{owner}/{repo}/settings/pull_request_activation :: has_pull_requests`
  - `PUT /{owner}/{repo}/settings/pull_request_creation_policy :: pull_request_creation_policy`
  - `PUT /{owner}/{repo}/settings/update :: allow_private_repository_forking,enable_repository_funding_links`
  - `PUT /{owner}/{repo}/settings/update :: archive_program_opt_out_enabled,enable_repository_funding_links`
  - `PUT /{owner}/{repo}/settings/update :: has_issues`
  - `PUT /{owner}/{repo}/settings/update :: has_wiki,wiki_access_to_pushers`
  - `PUT /{owner}/{repo}/settings/update :: template`
  - `PUT /{owner}/{repo}/settings/update_archive_settings :: include_lfs_objects`
  - `PUT /{owner}/{repo}/settings/update_branch_protection :: branch_protection_disabled`
  - `PUT /{owner}/{repo}/settings/update_dco_settings :: enable_dco_signoff`
  - `PUT /{owner}/{repo}/settings/update_default_branch :: name`
  - `PUT /{owner}/{repo}/settings/update_issue_settings :: auto_close_issues`
  - `PUT /{owner}/{repo}/settings/update_merge_settings :: merge_commit_types[],merge_types[],squash_merge_commit_types[]`
  - `PUT /{owner}/{repo}/settings/update_push_settings :: enable_max_pushes,max_pushes_count`
  - `PUT /{owner}/{repo}/settings/update_release_settings :: release_immutability`

### repository: Repository App installations

- Disposition: `MIXED`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: Configuration orchestration is a gh2 candidate.
- Routes: `/{owner}/{repo}/settings/installations`, `/{owner}/{repo}/settings/installations/{id}/action`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### repository: Repository license policy

- Disposition: `CANDIDATE`; issue #6: `yes`; observed plans: `enterprise`.
- Finding: React-backed web-only policy.
- Routes: `/{owner}/{repo}/settings/license_policy`.
- React apps: `license-policy`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### repository: Repository email notifications

- Disposition: `CANDIDATE`; issue #6: `no`; observed plans: `enterprise+free`.
- Finding: Web-only repository notification routing.
- Routes: `/{owner}/{repo}/settings/notifications`.
- Static modifying forms:
  - `PUT /{owner}/{repo}/settings/notifications :: hook[active],hook[config_attributes][address],hook[config_attributes][secret],hook[config_attributes][send_from_author]`

### repository: Repository social preview

- Disposition: `LOW`; issue #6: `no`; observed plans: `free`.
- Finding: Low-priority web-only presentation setting.
- Routes: `/{owner}/{repo}/settings/og-template`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

### repository: Issue triage suggestions

- Disposition: `CANDIDATE`; issue #6: `yes`; observed plans: `enterprise+free`.
- Finding: React-backed web-only setting.
- Routes: `/{owner}/{repo}/settings/suggestions`.
- React apps: `issue-triage-suggestions-settings`.
- Static modifying forms: none; the observed setting is React-backed or read-only.

## Issue #6 omissions requiring follow-up

- `enterprise/advanced-security` — Enterprise advanced-security policy: Only web-only policy controls are gh2 candidates.
- `enterprise/ai-controls` — Enterprise AI controls: Capability-probed web commands are candidates.
- `enterprise/announcement` — Enterprise announcement: Show/update/clear is a straightforward web-only policy.
- `enterprise/audit-log` — Enterprise audit-log settings: Only missing configuration/export operations belong in gh2.
- `enterprise/code_quality_policies` — Enterprise code-quality policy: Entitlement-dependent React setting.
- `enterprise/copilot` — Enterprise Copilot settings: Missing policy controls require capability probes.
- `enterprise/member_privileges` — Enterprise member privileges: Use GraphQL first and add only unmatched policies to gh2.
- `enterprise/network-configurations` — Enterprise hosted-compute networking: React endpoints require entitlement and schema probes.
- `enterprise/organizations` — Enterprise organizations and transfers: Transfers are risky; ordinary organization operations should use GraphQL.
- `enterprise/personal-access-tokens` — Enterprise PAT policies: Fine-grained and classic PAT policy settings are web-only candidates.
- `enterprise/profile` — Enterprise profile and slug: Slug changes are risky; footer links are a lower-priority gap.
- `enterprise/roles` — Enterprise and organization roles: Only unmatched custom-role CRUD belongs in gh2.
- `enterprise/sandboxes` — Enterprise Sandboxes: Entitlement-dependent web-only setting.
- `enterprise/security` — Enterprise authentication security: Web-only remainder is high risk and should be isolated.
- `enterprise/security-analysis` — Enterprise code-security settings: Add only verified web-only controls.
- `enterprise/security-center` — Enterprise security center and review requests: Read/report via APIs; web-only request review is a gh2 candidate.
- `enterprise/support` — Enterprise support settings: gh2 already supports Support tickets; entitlement operations should use GraphQL.
- `organization/audit-log` — Organization audit log: Only missing export/configuration operations belong in gh2.
- `organization/code_review_limits` — Organization code-review limits: Web-only organization policy.
- `organization/codespaces` — Organization Codespaces: Expose only the settings absent from REST.
- `organization/copilot` — Organization Copilot settings: Capability-probed web commands are candidates for missing policy controls.
- `organization/dependabot_rules` — Organization Dependabot rules: Default and custom Dependabot rules are web forms.
- `organization/deploy_keys` — Organization deploy-key policy: Only the organization policy is a gh2 gap.
- `organization/discussions` — Organization Discussions toggle: Small web-only organization setting.
- `organization/import-export` — Organization import/export and attribution: Only the web-only archive/export remainder is a later gh2 candidate.
- `organization/member_privileges` — Organization member privileges: Prime gh2 gap: outside-collaborator invites, discussion creation, project base role, App request/install policy, visibility/delete permissions, team creation, dependency insights, and rename relaxation.
- `organization/oauth-apps` — Organization OAuth Apps: Create, settings, secrets, transfer, and delete are web-only.
- `organization/packages` — Organization package defaults: Web-only default policy.
- `organization/profile` — Organization profile and lifecycle: Profile fields stay on API; destructive lifecycle needs separate guarded commands.
- `organization/projects` — Organization Projects policy: Only the missing policy field is a gh2 candidate.
- `organization/roles` — Organization roles: Custom role CRUD is a gh2 candidate; assignments should use the API.
- `organization/sandboxes` — Organization Sandboxes: Entitlement-dependent web-only setting.
- `organization/security` — Organization authentication and code security: Web-only security mutations are high risk and require a separate command family.
- `organization/sponsors-log` — Organization sponsorship log: Low-priority read/export surface.
- `personal/code_review_limits` — Code review limits: A repeatable web-only account preference.
- `personal/copilot` — Personal Copilot settings: Feature, coding-agent, and memory preferences are entitlement-dependent web settings.
- `personal/credentials` — SSH/GPG and credential preferences: Do not duplicate key management; only the remaining preference is a gap.
- `personal/oauth-authorizations` — OAuth grants and OAuth Apps: Grant inspection/revocation and OAuth App registration lifecycle are web-only gaps.
- `personal/packages` — Package defaults: Container permission inheritance default is web-only.
- `personal/personal-access-tokens` — Personal access tokens: gh2 already creates fine-grained PATs; list, regenerate, expiration, and revoke are additional sensitive gaps.
- `personal/profile` — Profile and privacy: Only non-API preference fields are gh2 candidates, with low priority.
- `personal/repositories` — Personal repository defaults and memberships: Defaults are candidates; leaving repositories is a risky separate workflow.
- `personal/security_analysis` — Personal code-security defaults: Dependency graph, Dependabot, private reporting, and push-protection defaults are web-only at account scope.
- `personal/security-log` — Personal security log: Read/export could be useful, but it is not a settings mutation.
- `personal/sponsors-log` — Sponsorship log: Low-priority read/export surface.
- `repository/code_review_limits` — Repository code-review limits: Web-only repository setting.
- `repository/dependabot_rules` — Repository Dependabot rules: Preset and custom Dependabot rules are web-only.
- `repository/general` — Repository general settings: Only the enumerated non-API fields are gh2 candidates; delete/visibility/transfer are risky or API-backed.
- `repository/notifications` — Repository email notifications: Web-only repository notification routing.
