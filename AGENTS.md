# AGENTS.md: Project Guidance

Read this file before every coding, maintenance, review, investigation, or documentation pass in this repository.

This is the short, always-loaded orchestration guide. Keep it concise. It should point agents to deeper authoritative documents rather than duplicating them.

## 1. Authority

Follow instructions in this order:

1. The user's current prompt defines the immediate task and scope.
2. This `AGENTS.md` defines standing project rules and working practices.
3. Specialised project documents govern their named areas.
4. The current implementation is evidence of actual behaviour when documentation is incomplete or stale.

A specific user instruction may deliberately override an established rule. Treat that as scoped to the task unless the user clearly makes it a lasting project decision.

Do not ask the user to repeat context that is already accurately recorded in an authoritative project document.

## 2. Project documents and when to read them

Do not read every project document on every task. Load only the guidance relevant to the work being performed.

| If the task involves... | Read |
| --- | --- |
| Human-facing purpose, setup, ordinary use | `README.md` |
| User-facing UI, UX, visual design, interaction | `STYLE.md` |
| Modules, runtime dependencies, hosting, service boundaries, system shape | `docs/ARCHITECTURE.md` |
| Persistence, schema, migrations, imports, exports, backups, canonical stores | `docs/DATA.md` |
| APIs, durable interfaces, payloads, file formats, compatibility | `docs/CONTRACTS.md` and `docs/DATA.md` |
| External services, providers, credentials, rate limits, fallback behaviour | `docs/INTEGRATIONS.md` |
| Test strategy, fixtures, validation scope, stale tests | `docs/TESTING.md` |
| Environments, release process, commit/publish workflow, rollback, production smoke | `docs/DEPLOYMENT.md` |
| Deferred ideas and future work | `ROADMAP.md` |
| Spreadsheet parsing, reconciliation, local import preview | `scripts/import/README.md` and `docs/LEGACY_SPREADSHEET_MODEL.md` |
| Guarded archive production tooling and its recovery gates | `scripts/import/PRODUCTION.md` plus `docs/DATA.md` |

Do not create additional permanent guidance files by default. Add one only when a real body of stable guidance no longer fits cleanly in the existing authorities.

## 3. Documentation must track reality

Authoritative project documentation is part of the implementation.

Update the relevant document in the same pass when either:

1. **The task changes reality.** Code, configuration, schema, workflow, command, interface, dependency, deployment, or product changes make existing documentation incomplete, inaccurate, or misleading.
2. **The task discovers drift.** While working on something else, you find that an authoritative document no longer matches actual implementation or current behaviour.

When correcting documentation:

- update the existing authoritative section instead of appending a conflicting note;
- remove stale guidance rather than preserving competing versions;
- describe the current as-is state, not implementation history;
- do not turn authoritative docs into changelogs;
- do not add speculative claims;
- keep deeper detail in the specialised document that owns it.

If a task is explicitly read-only or audit-only and edits are not authorised, report documentation drift instead of changing files.

`ROADMAP.md` is different: ordinary future work is added only when the user asks or agrees. The exception is Priority 0 blockers and Priority 0.5 stale/failing tests under the rules in `ROADMAP.md` and `docs/TESTING.md`.

## 4. Start of a pass

Before changing files:

1. Read the current prompt and identify the exact requested outcome.
2. Read this file.
3. Inspect the owning code and smallest relevant surrounding area.
4. Load only the specialised documents required by the routing table.
5. Check for existing patterns, utilities, dependencies, and tests before creating new ones.
6. Identify live, sensitive, destructive, production-facing, or deployment boundaries before crossing them.
7. Implement the smallest complete change that satisfies the request.
8. Verify proportionately to risk and breadth.

Do not begin with a full repository audit, dependency upgrade, broad refactor, framework change, or complete test suite unless the task requires it.

## 5. Scope and implementation discipline

- Prefer targeted, low-risk changes over broad refactors.
- Do not add adjacent features merely because they may be useful later.
- Do not perform unrelated cleanup, file moves, formatting sweeps, or dependency upgrades.
- Reuse established patterns and owning modules before creating parallel implementations.
- Search the existing implementation before inventing a new helper, component, service, storage path, or abstraction.
- Centralise behaviour that must remain consistent across interfaces.
- Preserve existing public behaviour unless the task explicitly owns a contract change.
- Keep pure domain rules separate from transport, persistence, and presentation where the architecture supports it.
- Report assumptions, limitations, and deferred work honestly.

For user-facing interface work, `STYLE.md` is required reading. Preserve root `style.css`; `frontend/app.css` orders application styles under `frontend/styles/`. Edit the owning stylesheet and retain its cascade order. Follow BookClub-specific interface authority in STYLE.md.

Use UTF-8 and preserve established line endings. Avoid encoding-only changes. Applied SQL migrations are immutable; migration 0005 retains LF and trigger `WHEN` guards required by remote D1 parsing.

## 6. Safe autonomy and production boundaries

Agents may act autonomously for ordinary local development within task scope, including:

- reading and editing repository files;
- running established local development commands;
- running proportionate tests, type checks, linting, builds, and local smoke checks;
- using disposable fixtures, mocks, temporary files, or copied local data;
- fixing failures caused by the current change and rerunning affected checks.

Explicit user authorisation is required before:

- writing to production or live services outside an established deployment workflow;
- mutating real user data;
- destructive database or filesystem operations;
- deleting or rewriting source-control history;
- exposing or transmitting secrets, credentials, private data, or protected local files.

Commit, push, and deployment are permitted without a second confirmation only when the current task is a deployment/release/publish task and the standing clean-preflight workflow in `docs/DEPLOYMENT.md` applies.

Never deploy merely because an unrelated development task finished cleanly.

Never claim an operation is read-only unless its complete execution path is read-only.

Prefer local or disposable verification over live-system verification whenever it can prove the same behaviour.

BookClub: ordinary D1 commands must remain `--local --env local`; isolated imports use their separate preview configuration/state. Never substitute `--remote` for local verification. The explicit production-snapshot refresh reads/exports production and replaces local data; it requires task authorisation and the documented guards. Normal startup never reads production. `OWNER_INFO.md`, credential files, snapshots and archive evidence are private: never print their contents or copy them into source, reports or builds.

## 7. Dependencies and package management

For JavaScript or TypeScript projects, default to **pnpm** unless the project explicitly establishes another package manager.

When creating a JS/TS project:

- pin the intended pnpm version using `packageManager` in `package.json`;
- use the project's lockfile;
- prefer `corepack pnpm ...` in documented commands when portability matters.

Before adding or changing a dependency:

1. identify the concrete requirement;
2. check whether the existing stack or standard library already provides it;
3. prefer an already-used dependency family over a competing alternative;
4. confirm compatibility with the established runtime;
5. avoid unrelated upgrades.

Do not introduce a new runtime, framework, database, container platform, build system, or package manager without a task-driven reason.

## 8. Source control

When Git is present:

- preserve unrelated user changes;
- do not discard, reset, rewrite, or clean the working tree to make the task easier;
- do not commit, push, branch, alter remotes, or rewrite history unless explicitly requested or the clean deployment workflow in `docs/DEPLOYMENT.md` applies;
- report changed files clearly.

If Git is not present, do not initialise it unless requested.

## 9. Testing and verification

Use `docs/TESTING.md` for testing strategy and run limits.

Default rule: verify proportionately.

- Prefer targeted checks for narrow changes.
- Use grouped tests when impact is intermediate.
- Run the full suite only for major/cross-cutting work, release confidence, user request, or evidence of broader risk.
- Do not repeatedly rerun unrelated passing checks.
- Do not run destructive or live-environment tests without explicit authorisation.
- Never report a check as passed if it was skipped, blocked, unavailable, or not applicable.

If a failing test appears stale rather than indicative of a product regression, follow the Priority 0.5 workflow in `docs/TESTING.md` and `ROADMAP.md`.

## 10. Project snapshot

Keep this short and current.

- **Project:** BookClub, private four-position weekly film journal.
- **Purpose:** History, owner-only Builder plans, explicit rotation, Classics ranking, Seen It? and All Time Metrics.
- **Maturity:** Established application; hosted frontend/API and historical import. Live state must be verified separately from local schema.
- **Stack/runtime:** React/Vite/TypeScript; Cloudflare Worker; Node >=22.12 (24 recommended and required for snapshot refresh).
- **Package manager:** pnpm 10.32.1; `pnpm-lock.yaml`.
- **Persistence:** Cloudflare D1 `DB`; independent local D1 and isolated import preview.
- **Deployment target:** Cloudflare Static Assets `bookclub-frontend` at `bookclub.nissen.nexus` and independently deployed `bookclub-api` Worker.
- **GitHub repository:** https://github.com/N-Plus-Plus/BookClub (main).

## 11. Key paths and commands

Maintain only high-value navigation hints. Inspect `package.json` before running scripts.

### Key paths

- **Application entry:** `index.html`, `frontend/main.tsx`, `worker/src/index.ts`.
- **Frontend orchestration:** `frontend/App.tsx`, `routes.ts`, `AppShell.tsx`, `useHashRoute.ts`, `useBookClubData.ts`, `useFilmInspection.ts` (all under `frontend/`).
- **UI:** `frontend/`, shared design system `style.css`, ordered `frontend/app.css` entry and owned `frontend/styles/`; ownership in `docs/ARCHITECTURE.md`. Sole browser API client `frontend/api.ts`.
- **Domain:** `shared/ranking.ts`, `shared/rating-dimensions.ts`, `shared/catalog-index.ts`, `shared/metrics.ts`, `shared/metrics-enrichment/`, `shared/genres.ts`, `shared/identity.ts`; ownership map in `docs/ARCHITECTURE.md`.
- **Persistence:** `worker/src/*repository.ts`, `worker/migrations/`; supported rolling-schema contract in `docs/DATA.md` and release gates in `docs/DEPLOYMENT.md`.
- **Local snapshot:** `scripts/dev/`, development-only `frontend/DevTools.tsx`.
- **Tests:** `tests/`; behavioural App/API suites and focused harnesses in `tests/helpers/`; ownership/commands in `docs/TESTING.md`. Vitest configured in `vite.config.ts`.
- **Build/deployment:** `dist/` generated; `worker/wrangler.jsonc`; `wrangler.frontend.jsonc`.

### Canonical commands

- **Install:** `corepack pnpm install` (CI: `--frozen-lockfile`).
- **Development:** `corepack pnpm dev`; UI localhost:4173, API localhost:8787/api/v1.
- **Build:** `corepack pnpm build`.
- **Targeted tests:** `corepack pnpm exec vitest run tests/ranking.test.ts`.
- **Full tests:** `corepack pnpm test`.
- **Type check:** `corepack pnpm typecheck`.
- **Lint:** `corepack pnpm lint`; correctness and React Hooks checks. No formatter.
- **Local schema:** `corepack pnpm db:migrate`; static production checks: `corepack pnpm prod:check` (no remote access).

Detailed commands and safety boundaries belong in the routed documents.

## 12. Final report

Keep closeout concise and factual.

Report, where relevant:

### Changed
Files or areas changed.

### Completed
What behaviour or outcome was implemented.

### Validation
Commands/checks run and results.

### Remaining / risks
Anything blocked, deliberately deferred, unverified, or requiring user judgement.

Mention production or sensitive-resource access only when relevant.
