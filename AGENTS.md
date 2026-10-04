# AGENTS.md: Project Guidance

Read this file before every coding, maintenance, review, investigation, or documentation pass in this project.

This file is the root standing guide for agents working in the repository. It should remain concise, current, and useful as a source of stable project context. Future prompts may rely on it without restating information already recorded here.

## 1. Authority and interpretation

Follow instructions in this order:

1. The user's current prompt defines the immediate task and scope.
2. This file defines standing project rules, safety boundaries, and working practices.
3. More specialised project documents govern their stated areas when they exist.
4. The current implementation is evidence of actual behaviour when documentation is incomplete or stale.

A specific user instruction may deliberately change an established project rule. Treat that as a scoped decision only when it is explicit and unambiguous. Never interpret a vague request as permission for destructive work, broad redesign, data loss, secret exposure, or an unrelated architectural change.

Do not ask the user to repeat context already stated accurately in this file or another clearly authoritative project document.

## 2. Project facts

| Project fact | Current state |
| --- | --- |
| Project name | BookClub; GitHub repository N-Plus-Plus/BookClub |
| Product purpose | Weekly four-person film journal, private Builder plans, explicit rotation, event history, Classics ranking, Seen It? collection and All Time Metrics |
| Intended users | Four human positions: Sean, Troy, Matt, Jess (sort_order 1-4); names/auth provisioned privately, development fixtures generic |
| Project maturity | Local-first application with avatar onboarding, roles, explicit rotation, private Builder publication and audited recoverable History; exact archive rehearsal complete; production schema through 0008 and historical/member/auth/open Classics cutover complete and verified; production application Worker and Pages deployed; real Google login and multi-user owner smoke pending |
| Application shape | Static frontend and independently deployed Worker API in one repository |
| Languages and runtime | TypeScript; Node 22.12+ for tools (24 recommended); browser UI; Cloudflare Workers API |
| Frameworks and major libraries | React, Vite, Zod, Lucide, bundled Fontsource Lexend Deca; Worker-only jose JWT/JWK verification; Wrangler and concurrently |
| Package manager | pnpm 10.32.1, pinned in package.json; pnpm-lock.yaml |
| Persistence or database | Cloudflare D1 via DB; local D1 default; versioned SQL migrations |
| External services | Optional TMDB metadata/artwork (Worker and explicit bounded import identity resolver); Worker-only MDBList primary ratings and OMDb fallback |
| Deployment target | GitHub Pages https://n-plus-plus.github.io/BookClub/; separate bookclub-api at https://bookclub-api.troy-nissen.workers.dev |
| Source-control policy | Git repository N-Plus-Plus/BookClub; main branch. Commit/push only when explicitly requested; do not deploy or rewrite history without separate authorisation |
| Test framework | Vitest; pure ranking/transformation and API boundary tests |
| Build, run, and verification commands | package.json scripts; section 16 and README.md |

Update facts only from implementation or explicit owner decisions. Keep setup detail in README.md.

## 3. Start-of-pass procedure

Before changing files:

1. Read this file completely.
2. Read the user's prompt closely and identify the exact requested outcome.
3. Inspect the repository root and determine whether the project is blank, scaffolded, or established.
4. Check for relevant manifests and guidance, such as `README.md`, package manifests, lock files, configuration examples, source directories, tests, and specialised documentation.
5. Inspect only the files and modules relevant to the requested task.
6. Identify safety-sensitive resources, including live databases, user files, credentials, network shares, production services, large downloads, and destructive commands.
7. Determine the smallest implementation scope that fully satisfies the request.
8. Choose verification proportionate to the change.
9. Check whether the work will require an update to this file or another authoritative document.

Do not begin with a full repository audit, full test suite, dependency upgrade, broad refactor, or new framework unless the task requires it.

When the repository is blank or nearly blank:

- Do not assume a language, framework, package manager, database, deployment platform, source-control workflow, or directory layout.
- Do not create speculative infrastructure.
- Establish only the minimum structure required by the user's current request.
- Record newly established project facts in this file before finishing the pass.

## 4. Project navigation

| Area | Owning files or directories |
| --- | --- |
| Application entry point | index.html; frontend/main.tsx; worker/src/index.ts |
| User interface | frontend/App.tsx, screen modules, components.tsx; root style.css and frontend/app.css |
| Domain or business rules | shared/ranking.ts (ranking/effective scores); shared/metrics.ts and genres.ts (appearance Metrics/finite genre vocabulary); shared/identity.ts (identity/onboarding/dates); worker/src/product-repository.ts (rotation/publication) |
| Persistence and data access | worker/src/repository.ts, product-repository.ts, auth-repository.ts; worker/migrations/; worker/seed.sql and reset.sql |
| API or service boundaries | worker/src/index.ts, validation.ts, http.ts, auth.ts, auth-repository.ts, services.ts, score-service.ts; provider interfaces/adapters under providers/ |
| Configuration | package.json, vite.config.ts, tsconfig.json, worker/tsconfig.json, worker/wrangler.jsonc, isolated worker/wrangler.import-preview.jsonc; environment examples |
| Shared utilities | shared/types.ts; frontend/api.ts is the sole browser API client |
| Tests | tests/ranking.test.ts, api.test.ts, auth.test.ts, product-api.test.ts, frontend-api.test.ts, providers.test.ts, ratings.test.ts, domain-api.test.ts, importer.test.ts, import-resolution.test.ts, import-io.test.ts, production-import.test.ts; scripts/smoke.mjs is an opt-in local persistence check |
| Build and deployment | dist/ generated by Vite; .github/workflows/pages.yml manually publishes frontend only |
| Further documentation | README.md (setup, API, schema, auth, deployment, limitations); scripts/import/README.md (dry-run/local apply); scripts/import/PRODUCTION.md (guarded cutover); docs/LEGACY_SPREADSHEET_MODEL.md (durable workbook semantics) |

AGENTS.md is the single root standing guide; there is no separate CODEX guidance file. README.md owns operational contracts. Original style.css owns visual tokens/primitives; frontend/app.css extends mobile layouts without replacing the system. OWNER_INFO.md is ignored private owner configuration, not public documentation; never print its credential-bearing content.

## 5. Documentation self-healing

Documentation maintenance is part of implementation work.

During every pass, compare the relevant documentation with the behaviour and structure being inspected or changed. Update an authoritative document when the pass makes it provably incorrect or materially incomplete.

This includes changes to:

- architecture or module ownership
- product behaviour
- public interfaces or data contracts
- routes, commands, or configuration
- persistence or schema
- security and safety assumptions
- external dependencies
- deployment or operating procedures
- testing policy
- important project navigation
- explicit non-goals or retired behaviour

When updating documentation:

- Edit the existing authoritative section instead of appending a conflicting rule elsewhere.
- Remove or replace stale guidance.
- Preserve intentional historical records by clearly labelling them as historical.
- Do not turn this file into a changelog or implementation diary.
- Do not add speculative claims.
- Keep detail in specialised documents when it would make this root guide unwieldy.
- In a read-only or audit-only task, report material drift instead of editing unless documentation changes are authorised.

Before finishing every pass, check whether `AGENTS.md` itself is stale, incorrect, or materially incomplete because of the work performed. Update it in the same pass when necessary, even when the user did not separately request documentation maintenance.

## 6. Scope and implementation discipline

Implement the narrow task requested.

- Prefer targeted, low-risk changes over broad refactors.
- Do not add adjacent features merely because they may be useful later.
- Do not redesign established behaviour incidentally.
- Do not perform unrelated cleanup, dependency upgrades, formatting sweeps, or file moves.
- Reuse established patterns and owning modules before creating parallel implementations.
- Centralise behaviour that must remain consistent across interfaces.
- Keep pure domain rules separate from transport, persistence, and presentation where the project architecture supports that separation.
- Preserve existing public behaviour unless the task explicitly owns a contract change.
- Report assumptions, limitations, and deferred work honestly.

When the project is still blank, avoid building abstractions for hypothetical future requirements. Introduce structure only when it protects a real boundary or supports the requested implementation.

## 7. Safety and data preservation

Treat user data, production data, credentials, and external systems conservatively.

Unless explicitly authorised:

- Do not delete, overwrite, migrate, repair, regenerate, or bulk-modify live data.
- Do not run destructive database, filesystem, cloud, or API operations.
- Do not modify source assets merely to simplify development.
- Do not connect tests to live services or real user accounts.
- Do not expose credentials, tokens, private paths, personal data, stack traces, or raw sensitive payloads.
- Do not place secrets in source files, logs, URLs, fixtures, screenshots, generated reports, or documentation.
- Do not bypass path-boundary checks or validation guards.
- Do not claim an operation is read-only unless its complete execution path is read-only.

Use temporary fixtures, disposable test data, mocks, or copied snapshots for verification where appropriate.

Before relying on an external resource, perform a cheap and bounded preflight where practical. Distinguish unavailable environments from missing individual resources, and do not turn one environmental failure into a large set of false findings.

## 8. Dependencies and toolchain

Keep dependencies deliberate and minimal.

Before adding or changing a dependency:

1. Identify the concrete requirement it satisfies.
2. Check whether the existing stack or standard library already provides the capability.
3. Confirm compatibility with the established runtime and toolchain.
4. Avoid installing competing alternatives.
5. Avoid unrelated upgrades.
6. Record any material dependency decision in this file or the appropriate specialised document.
7. Report the exact dependency change and purpose.

Do not establish a new runtime, framework, package manager, database, container platform, or build system without a task-driven reason.

Inspect existing manifest scripts before running them. Do not assume a command is safe, cheap, offline, or non-destructive merely because its name suggests that it is.

## 9. Source control

First determine whether the project is actually under source control.

- Do not assume Git is present.
- Do not initialise Git, create branches, commit, push, alter remotes, add CI, or create repository metadata unless explicitly requested or already established as normal project practice.
- Do not rely on `git diff`, `git status`, or history commands when the directory is not a Git worktree.
- When Git is present, preserve unrelated user changes and do not discard or rewrite them.
- Never use destructive source-control commands merely to obtain a clean working tree.
- Report changed files explicitly whether or not source control is available.

Update the project facts section once the source-control policy is known.

## 10. Generated artefacts and local files

Keep generated, machine-local, large, or sensitive files separate from source where practical.

Examples may include:

- dependency directories
- build output
- caches
- logs
- temporary files
- local configuration
- environment files
- downloaded models or datasets
- database snapshots
- coverage reports
- generated exports
- editor or operating-system state

Once the project has a source-control policy, maintain appropriate ignore rules without hiding source files or required small fixtures.

Do not remove ignore protections simply to make generated files visible. Do not commit or share private local paths when a portable description is sufficient.

## 11. Persistence and contracts

D1 is canonical. The static browser has no database or provider credentials. All ordinary mutations pass through the Worker and its central authorizeMutation helper. Local bypass requires both APP_ENV=local and LOCAL_WRITE_BYPASS=true; all application reads and writes otherwise require opaque D1-backed bearer sessions. Google Identity Services credentials are verified in the Worker with jose, then matched to a privately provisioned member_auth allow-list. First login atomically binds the Google sub; established bindings never silently change. Session tokens last 90 days, live in browser localStorage to avoid cross-site cookie dependence, and are stored only as SHA-256 hashes in auth_sessions. CORS reflects exact configured origins only and is not authentication.

Schema ownership is worker/migrations/. Add new migrations; do not silently edit applied ones. Canonical local movie IDs are independent of external IDs. Preserve provider/metric score snapshots, scales and fetched timestamps; rankings consume latest snapshots through shared/ranking.ts. Classics membership is independent of movies. No seen-state row means Unknown; 1/0 are explicit answers. Event-film joins preserve any positive viewing position, with no three-film limit.

Cycles own grouping and the nominal slot-1 Sean-derived anchor in compatibility column rough_date; legacy labels remain. Each event has an independent date. Legacy Ruff Date is exact for slot 1; slots 2-5 use the anchor as a cycle_rough reference because their actual dates are unknown. Newly completed events are exact; later slots never change the anchor. A changed exact slot-1 date requires explicit anchor-correction confirmation; only unknown legacy reference dates follow that audited correction, with rotation unchanged. Nominal cycle slots do not imply chronology. Optional import_source/import_key uniqueness and external-ID uniqueness support idempotent local imports and future production migration. A staged Node/TypeScript importer under scripts/import/ uses development-only ExcelJS/tsx. Parsing is network-free; resolution links conservative identity evidence and optionally uses capped, cached TMDB requests with private overrides. Attached TMDB IDs request direct details before IMDb lookup; verified TMDB title/year become canonical unless a private canonical_year/year_reason assignment records an explicit owner film-year decision; release dates are retained separately, safe returned IMDb IDs attach, original raw source records remain unchanged and contradictory verified IMDb evidence blocks apply. Resolved version-2 plans retain all movie refs/original Seen evidence and minimum duplicate membership seeds. Source scores retain source_ref/source_ordinal and optional private legacy preference for same-capture selection. Local apply requires an explicit matching archive snapshotCapturedAt, zero blockers and schema/member preflight; immutable fingerprints prevent conflicting reruns. It uses Wrangler's local Miniflare D1 emulator and the isolated import_preview config/state only, with generic Host 1–4, no demo history or auth rows, no remote path and explicit --apply. The development-only Vite import-preview mode fixes the API origin to localhost independently of root env files. Native Worker/local D1 event headers/ordered joins and imported metadata snapshots use atomic D1 batches; production REST cutover does not assume atomicity; History replacement remains last-write-wins; Builder revisions and rotation versions guard concurrent publication/correction transactionally. Regenerate old all-rough import plans; immutable fingerprints still reject conflicting reapply. README.md owns route/body contracts and scripts/import/README.md owns the staged migration and local apply boundary.

Production preparation uses the separate `import:production` CLI and ignored `.verification/production/` proofs/bootstrap/export material. Exact plan and migration hashes bind the passed local rehearsal to the tracked production name/ID. Future mutation requires explicit production mode, exact target/hash/capture, APPLY-BOOKCLUB-PRODUCTION, verified timestamped export proof, migrations through 0008 and clean preflight. Preflight/verify REST boundaries remain read-only; explicit guarded production apply uses authenticated D1 REST from the trusted local operator process with at most 100 statements per batch. REST atomic rollback is not assumed; immutable fingerprints, row comparison and read-only inspection govern identical continuation after failure. The temporary Worker runner is retired. No deployment or remote operation is part of preparation. Original raw plans/cache/overrides remain private source evidence. Owner-authorised capture is 2026-10-04T06:53:20Z; initial admins are Sean/Troy, Matt/Jess are members. Initial rotation is OPEN Classics slot 5 on reviewed cycle 55/version 0; no event, current films or next cycle is created. PRODUCTION.md owns execution, abort and resumability details.

Migration 0005 adds unique nullable member avatars (integers 0-19) and privately provisioned member/admin roles. Null avatar gates all private screens behind a one-time authenticated chooser; reserved a.png is Classics-only, rendered as CLSC rather than a fifth account. Identity URLs are Vite-base-aware and database names are uppercased in presentation. Local bypass has no concrete owner and cannot use personal Builder or admin operations.

Migration 0006 enforces one active event per non-null cycle/slot with a partial unique index; soft deletion frees it, occupied create/edit/publication/restore returns safe 409. Every hosted slot 1-4 resolves its nominal member by sort_order and requires a nonblank swap_note when actual host differs, including backfills/edits. Application validation and insert/update triggers return safe 422. Existing conflicts require explicit reconciliation, never automatic rewriting.

Builder sets/ordered canonical movie IDs belong only to their authenticated owner; even admins cannot list, inspect, edit, delete or publish another member's unpublished sets. They never enter catalog data. Publication atomically preserves original created_at as immutable sessions.planned_at, records publisher/actual host, creates History/joins/audit, removes Builder and optionally completes a versioned current turn. No 3-film ceiling; dates default to browser-local today at confirmation and allow past/future values.

club_rotation has one explicit nullable-cycle/slot/version state, privately initialised after history review. Fixed positions 1-4 then hostless Classics advance only on explicit qualifying creation/publication. Deferral/calendar time do nothing. Slot 1 creates/anchors its new cycle; Classics returns to slot 1 awaiting that creation. Swaps record nominal slot, actual host and explicit explanation without altering positional order; return swaps are explicit future publications. Current Classics completion marks all four active members Seen transactionally; backfills, edits, restores and hosted events do not. History changes append actor/time/structured audit. Soft deletion hides events/appearances without removing joins or rewinding rotation; admin restore/correction is server-authorised and audited. Correcting/deleting a completed-turn event flags review instead of silently changing rotation. README.md owns API contracts and private setup.

The seed marker prevents startup from overwriting saved work or restoring removed answers. Reset scripts delete all local app data and must never be used on production. Production binding records the owner-supplied existing database; its remote name/UUID have been verified by an owner-authorised authenticated identity read. This does not authorise production mutation or deployment.

## 12. User interface work

This section applies only once a user interface exists.

Before changing UI, inspect the established visual system, component primitives, accessibility patterns, responsive behaviour, and any authoritative style document.

- Reuse existing tokens and components before introducing one-off styling.
- Preserve interaction and accessibility conventions.
- Check affected layouts at relevant viewport sizes.
- Do not introduce a second icon family or parallel component system without a deliberate decision.
- Do not alter established visual rules incidentally during feature work.
- Update the authoritative style guidance when deliberately extending the visual system.
- Report deliberate deviations.

Until a UI stack and visual system are established, do not invent detailed permanent style rules in this file.

## 13. Error behaviour and truthful status

Prefer explicit, actionable states over generic failure.

Where relevant, distinguish between:

- invalid input or configuration
- unavailable environment
- unsupported capability
- blocked operation
- authentication or authorisation failure
- missing resource
- corrupt input
- conflict or stale state
- partial output
- deferred verification
- implementation error

Do not swallow meaningful errors. Do not present experimental, partial, simulated, cached, or unverified results as authoritative. Do not report a check as passed when it was skipped, blocked, or not applicable.

Browser-facing and user-facing errors must not expose secrets, private internals, or raw stack traces.

## 14. Verification strategy

Verification must be proportionate to the change and grounded in the project's actual commands.

Default approach:

- Run focused checks for the files or behaviour changed.
- Prefer targeted unit, integration, type, lint, syntax, build, or smoke checks over the complete suite for a narrow pass.
- Run the full suite when the prompt requests it, the change affects broadly shared infrastructure, release confidence is required, or targeted failures indicate wider risk.
- Do not repeatedly rerun unrelated passing tests.
- Do not run environment-dependent or destructive checks against live resources without explicit authorisation.
- For documentation-only changes, inspect content and formatting; automated tests are not normally required unless documentation generation is involved.
- For a blank project with no test framework, do not add one solely to validate a trivial initial file unless the task establishes testing as part of the project.

Before running a command, inspect its definition when its cost or side effects are uncertain.

Report:

- exact commands run
- relevant results
- whether the full suite was run
- checks skipped, blocked, or unavailable
- why the verification scope was appropriate
- any manual verification still required

## 15. Editing and encoding

Unless the project establishes another requirement:

- Use UTF-8 for source and documentation.
- Preserve existing line endings and file encoding when editing established files.
- Avoid broad formatting or encoding-only changes during unrelated work.
- Use stable code, identifiers, headings, routes, selectors, or constants as patch anchors.
- Preserve deliberate user-authored wording and comments outside the task scope.
- Do not claim encoding corruption without evidence.
- Keep generated changes deterministic where practical.
- Migration 0005 uses LF endings pinned by `.gitattributes` and trigger `WHEN` guards for remote D1 parser compatibility; preserve these forms. Applied migrations remain immutable, and any migration-content correction requires a fresh exact-archive rehearsal receipt before production mutation.

Once formatting, linting, or encoding commands are established, record them in the project facts or command section.

## 16. Project commands

Inspect current package.json before relying on these scripts.

| Purpose | Command |
| --- | --- |
| Install dependencies | pnpm install (CI: pnpm install --frozen-lockfile) |
| Start development mode | pnpm dev: local migrations/seed then UI and API |
| Frontend / API only | pnpm dev:ui / pnpm dev:api (prepare DB first) |
| Build | pnpm build; static dist/ with /BookClub/ base |
| Static production preflight | pnpm prod:check; add --frontend to check process public build variables; no remote access, build separately |
| Production build preview | pnpm preview; localhost:4173/BookClub/; requires configured API base |
| Targeted tests | pnpm exec vitest run tests/ranking.test.ts or tests/api.test.ts |
| Full test suite | pnpm test |
| Type checking | pnpm typecheck |
| Linting / formatting | Not configured; do not invent a command |
| Local database | pnpm db:migrate / pnpm db:seed / pnpm db:setup |
| Local reset | pnpm db:reset; explicitly destructive to LOCAL data; stop servers first |
| Spreadsheet analysis | pnpm import:spreadsheet --file private.xlsx --config scripts/import/import-config.local.json; ignored reports, no database writes |
| Identity resolution | pnpm import:resolve --plan .verification/import/plan.json --config scripts/import/import-config.local.json; optional explicit capped --network |
| Isolated import preview | pnpm db:import-preview:prepare; pnpm import:apply:local --plan .verification/import/resolved-plan.json --config scripts/import/import-config.local.json (preflight; add --apply); pnpm dev:import-preview |
| Production cutover preparation | pnpm import:production --action prepare --plan .verification/import/resolved-plan.json --config scripts/import/import-config.local.json; offline only; PRODUCTION.md owns future guarded actions |
| Optional local API smoke | node scripts/smoke.mjs; creates labelled demo movie/event |

UI is http://localhost:5173/; API is http://localhost:8787/api/v1. Use the localhost origin to match CORS. Ordinary packaged D1 commands use --local --env local; preview commands use isolated worker/wrangler.import-preview.jsonc, --local --env import_preview and --persist-to worker/.wrangler/import-preview. Never substitute --remote during local verification.

## 17. Current boundaries, decisions, and non-goals

- Mobile-first from 360px; card/stacked workflows, safe-area bottom navigation, approximately 44px targets. Every BookClub-owned action uses Lucide; the official Google sign-in control is the sole branding exception. Use Lexend Deca everywhere, including numbers; fonts are bundled with Fontsource.
- Preserve root style.css. Extensions belong in frontend/app.css, using existing dark surfaces, shared radii, and intent colours. No generic CSS framework or second icon family.
- Static GitHub Pages frontend uses hash routing and Vite-controlled base paths. All fetches go through frontend/api.ts; no browser D1 access, secrets, SSR, filesystem or server rewrites.
- TMDB is optional; application calls use Worker-only secrets, while the explicit import resolver may read process.env.TMDB_READ_TOKEN or a supplied ignored env file, never OWNER_INFO.md. Imported metadata/ratings are persisted snapshots; ordinary pages never call provider APIs. MDBList/OMDb adapters append rating snapshots with retrieved_via provenance; no scraping. Explicit per-film refresh and up-to-10-film missing-score enrichment are authenticated and never automatic.
- Admin-only POST /movies/enrich-metadata explicitly updates up to 10 existing TMDB-identified canonical films never checked or stale at 150 days, prioritising genres. Live TMDB imports and successful enrichment record the provider fetch timestamp atomically; historical imports remain unchecked. TMDB rate limits, credential failures and outages stop the sequential batch. Production operations must refresh stale records within TMDB's six-month cache window. Migration 0008 persists explicit provider Retry-After cooldowns; calls during cooldown make no upstream request. Bulk score enrichment suppresses further MDBList/OMDb calls after a provider-wide credentials, rate-limit, outage or network failure for that operation; single refreshes remain independent. Score enrichment uses MDBList first and OMDb only for missing required inputs, never TMDB ratings. TVDB remains intentionally unused/deferred.
- All Time Metrics derives active History appearances from the authenticated catalog, never Builder. Human filters use actual host, CLSC uses kind; repeats count in averages/counts, unique films deduplicate IDs. Effective IMDb uses shared ranking selection, missing scores stay missing. Each appearance counts once per recognised TMDB genre (Science Fiction displays Sci-Fi), with selected-appearance denominator and visible Uncategorised/IMDb coverage. Six mobile navigation destinations retain 44px targets.
- The historical policy in shared/ranking.ts sums squared 0–100 IMDb/RT audience/RT critic inputs, multiplies by 1.025^explicitNoCount and adds rank_seed*0.00001. Unknown is distinct from No; all active members Seen disqualifies. Missing required scores stay Needs Data. Other ratings never affect rank. Stable SQL-allocated membership seeds survive removal/readdition; legacy seeds are worksheet rows. API retrieval precedence is MDBList, OMDb, legacy, demo (direct TMDB preferred for TMDB). Legacy observations sharing a capture use optional private preference then later source ordinal. Never migrate captured rank into permanent ordering.
- Generic fixtures are development data only. Do not invent real member names or treat demo scores/events as history.
- Production reads and writes require authenticated club members. Public routes are health and Google login (plus preflight). Never deploy the local environment. No permanent shared write secret belongs in the static frontend. Public VITE_GOOGLE_CLIENT_ID and Worker GOOGLE_CLIENT_ID must match; no OAuth client secret is used. Initial production names/emails are provisioned through ignored .verification/production/bootstrap.local.json; scripts/auth/*.local.sql remains a historical manual setup path; never seed development identities to production.
- Further production data mutation, date-range Metrics/charts, social features, notifications, PWA, scheduled refreshes and elaborate admin tooling are deferred. Production Worker runtime bindings and Pages Actions variables are configured; application deployments and automated public/browser smoke passed. Real GIS login/Google Console origin settings and authenticated multi-user checks remain owner verification. README.md owns release procedure/endpoints. Basic roles, History editing/audit/soft deletion, admin restore API and rotation correction are implemented.
- Local credential files and OWNER_INFO.md are ignored. Preserve user-provided private files; never echo tokens, include them in source/builds/tests, or access live D1 for verification without explicit owner authorisation.

## 18. Final report requirements

Every implementation report should state, where relevant:

1. Files created, changed, moved, or removed.
2. The exact scope completed.
3. Material architecture, behaviour, dependency, configuration, schema, or command changes.
4. Verification performed and results.
5. Whether the full test suite was run.
6. Checks skipped, blocked, or deferred, with reasons.
7. Safety-sensitive resources accessed or deliberately not accessed.
8. Assumptions, limitations, risks, and unresolved decisions.
9. Any documentation changed.
10. Whether `AGENTS.md` was checked.
11. Whether `AGENTS.md` was changed, and why or why not.

Do not bury blockers, substitutions, failures, or unverified claims in general prose.

A concise closeout format is acceptable:

```text
Files changed:
- ...

Completed:
- ...

Validation:
- ...

Not changed or not run:
- ...

AGENTS.md:
- Checked: yes
- Updated: yes/no
- Reason: ...
```

## 19. AGENTS.md closeout check

Before finishing every pass:

1. Re-read the sections relevant to the work performed.
2. Check whether the pass established new project facts.
3. Check whether architecture, ownership, commands, contracts, safety rules, project navigation, or non-goals changed.
4. Check whether any statement in this file is now stale, incorrect, duplicated, or materially incomplete.
5. Update the existing authoritative section when needed.
6. Remove obsolete guidance rather than adding a conflicting note.
7. Keep this file focused on information future agents need.
8. State in the final report that the file was checked and whether it changed.

This maintenance requirement applies even when the user does not mention `AGENTS.md` in the current prompt.
