# AGENTS.md: BookClub agent guidance

## Purpose and authority

BookClub is a private four-position weekly film journal. Risk posture: owner-operated, populated private data; low-friction local development with stronger safeguards for data and access boundaries.

Authority: current user instructions and accepted decisions; this operating guide; relevant specialist authorities; verified source/behaviour; historical specs and audits as reference. Source alone does not establish live deployment or user acceptance. Do not reopen accepted functionality without changed dependencies, contradictory evidence, a reproducible failure or a review request.

## Work boundaries

Read this guide at the beginning of each pass. Inspect the local branch, worktree and relevant changes before editing; preserve all unrelated work. After compaction, recover the existing task state rather than restarting investigation.

Complete the requested outcome and necessary adjacent correctness work, inspect the focused diff, then stop. No unsolicited audits, refactors, upgrades, cleanup, report files or speculative backlog. Search owning symbols and immediate dependencies; read only relevant specialist passages. Reuse established helpers, dependencies and prior findings.

Ask before implementing materially ambiguous product, permission or irreversible data decisions. Resolve ordinary implementation choices independently. For a new substantial journey, show the first usable slice for owner review before broad polish; trivial changes need no artificial gate.

Do not commit, push, branch, change remotes, deploy or rewrite history unless explicitly authorised. Full-release requests retain the scoped clean-preflight authorisation in [DEPLOYMENT](docs/DEPLOYMENT.md#meaning-of-deployment-requests). Development completion never authorises publication.

## Changes and verification

Make the smallest coherent change; preserve established behaviour and security. Use UTF-8 and existing line endings. Preserve root style.css; frontend/app.css orders owned styles under frontend/styles/. Inspect affected STYLE and USER_EXPERIENCE passages for UI work.

Test authoring and execution are separate decisions. Add focused coverage for changed domain, access, persistence, provider, time-zone or regression risks when existing coverage is insufficient. Copy, icons and isolated CSS normally need no new tests. Finish a coherent edit, then run the smallest useful check; reuse unchanged passing evidence. No routine full-suite/build/browser campaign.

Release checking is a separate event: use the single existing procedure and bounded policy in [TESTING](docs/TESTING.md#bounded-release-check). Do not add wrappers merely to conform. Stop on release-gate failure or timeout, report actual evidence and obtain direction before expanding the budget. Report skipped/unavailable checks honestly.

## Production and privacy

Explicit task authorisation is required for live writes, real-data changes, destructive operations, DNS/secrets and production snapshots. Publishing code does not implicitly authorise unrelated data maintenance. Never expose or transmit credentials, private records, cookies, backups or archive evidence.

Ordinary D1 commands remain --local --env local; import preview has separate configuration/state. Never substitute --remote for local verification. Normal startup preserves local work and never reads production. Snapshot refresh reads/exports production and replaces local data only under its documented guards and task authority.

Applied migrations are immutable. Migration 0005 retains LF and trigger WHEN guards required by remote D1 parsing. Production data/schema work requires target/ledger inspection, one appropriate verified recovery point and safe compatibility ordering. Preserve newer writes during recovery. OWNER_INFO.md, credentials, snapshots and archive evidence are private; never print their contents or copy them into reports/builds.

## Targeted routing

| Concern | Entry points | Authority |
| --- | --- | --- |
| Purpose, local setup, confirmed state | package.json, index.html | [README](README.md) |
| Topology and ownership | frontend/main.tsx, frontend/App.tsx, worker/src/index.ts | [ARCHITECTURE](docs/ARCHITECTURE.md) |
| Persistence, migrations, snapshots | worker/src/*repository.ts, worker/migrations/, scripts/dev/ | [DATA](docs/DATA.md) |
| API, permissions, durable formats | frontend/api.ts, worker/src/routes/, shared/ | [CONTRACTS](docs/CONTRACTS.md), relevant DATA passages |
| Providers and credentials | worker/src/providers/ | [INTEGRATIONS](docs/INTEGRATIONS.md) |
| Visual conventions | style.css, frontend/app.css, frontend/styles/ | [STYLE](STYLE.md) |
| Journeys, feedback and recovery | frontend/routes.ts and owning feature | [USER_EXPERIENCE](USER_EXPERIENCE.md) |
| Tests and release check | tests/, vite.config.ts, .github/workflows/quality.yml | [TESTING](docs/TESTING.md) |
| Release and recovery | worker/wrangler.jsonc, wrangler.frontend.jsonc | [DEPLOYMENT](docs/DEPLOYMENT.md) |
| Approved future outcomes | none | [ROADMAP](ROADMAP.md) |
| Spreadsheet parsing and preview | scripts/import/ | [Import workflow](scripts/import/README.md), [legacy model](docs/LEGACY_SPREADSHEET_MODEL.md) |
| Guarded archive production operations | scripts/import/production-cli.ts | [Production import](scripts/import/PRODUCTION.md), relevant DATA passages |

Inspect package.json before running scripts. Use pinned pnpm 10.32.1 and pnpm-lock.yaml; prefer corepack pnpm commands. No new runtime, framework, database or dependency without a concrete task need and compatibility check.

## Documentation and completion

Update the owning authority when an enduring rule, command, contract or verified fact changes or is found stale; correct the existing passage. No documentation churn for minor edits, passing checks or temporary findings. README alone owns last-confirmed source/deployment/acceptance; ROADMAP holds owner-approved future outcomes and standing blockers. Do not create permanent guidance or dated audits by default.

Close out concisely with changed areas, delivered outcome, actual validation and remaining limitations. Distinguish local implementation, committed source, live deployment and human acceptance. Stop at the authorised boundary.
