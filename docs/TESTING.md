<!--
AGENT MAINTENANCE INSTRUCTION

Build this document around the tests and verification strategy that actually exist.

Update it whenever:
1. implementation work adds, removes, renames, or materially changes tests, fixtures, commands, coverage responsibilities, or verification policy; or
2. other work reveals that the documented testing reality is stale.

Keep the suite useful and proportionate. Do not encourage repeated full-suite runs merely because they are available.
-->

# TESTING.md

## Testing principle

Tests should protect meaningful behaviour, contracts, invariants, and regressions.

Verification effort must be proportionate to the change.

Prefer the smallest test scope that can give useful confidence.

## When to add or update a test

Add or update tests when work introduces or changes:

- meaningful user-visible behaviour;
- a domain rule or invariant;
- a bug whose recurrence would matter;
- a durable data or interface contract;
- a failure/recovery path;
- integration/provider selection or fallback;
- authentication or authorisation behaviour;
- a shared helper whose behaviour is relied on broadly.

A bug fix should normally gain a regression test when a practical automated test can reproduce the failure.

Do not add tests merely to:

- mirror implementation line-by-line;
- prove trivial getters/setters or framework behaviour;
- duplicate equivalent coverage without a distinct risk;
- inflate test counts.

## Test scope by change size

### Small / local change

Prefer one targeted test file, case, or directly related group.

Do not run the full suite unless the targeted result indicates wider impact.

### Intermediate change

Run the directly affected group or groups.

Examples:

- one subsystem;
- API tests plus its persistence tests;
- component tests plus the related integration test.

Use broader coverage only where the dependency surface warrants it.

### Major / cross-cutting change

Use targeted or grouped tests while implementing, then run the full suite once when the change is otherwise ready.

Examples:

- shared infrastructure;
- schema changes;
- large refactors;
- authentication changes;
- dependency/toolchain changes;
- release-critical work.

## Test-run budget

Avoid test-loop churn.

Normal limits per pass:

- **Small change:** normally 1 targeted run, with at most 1 rerun after a fix.
- **Intermediate change:** normally up to 3 meaningful test invocations.
- **Major change:** targeted/grouped checks during work, then 1 full-suite run at the end; normally no more than 4 meaningful test invocations total.

A single invocation may run multiple related test files.

Exceed these limits only when failures genuinely require diagnosis or the user explicitly asks for exhaustive verification.

Do not repeatedly rerun the full suite after unrelated small edits.

## Full-suite rule

Run the complete suite when:

- the user explicitly asks;
- a major or cross-cutting change is ready for final verification;
- shared infrastructure changed;
- targeted failures suggest wider breakage;
- deployment/release confidence requires it.

Do not make a full-suite run the default closing ritual for a narrow pass.

## Failed tests

Classify a failed test before acting.

### Genuine regression

If the implementation appears wrong, fix the implementation within task scope and rerun the affected test.

If the regression blocks application function or blocks an approved roadmap task and cannot be resolved in the current pass, it may justify a Priority 0 roadmap blocker.

### Stale or obsolete test case

If evidence indicates that the implementation now reflects the intended behaviour and the test itself is stale:

1. do not silently treat the suite as passing;
2. report the stale test to the user;
3. add it to the dedicated **Priority 0.5 - Stale/failing tests** section in [ROADMAP](../ROADMAP.md);
4. include enough diagnosis that a future agent can understand:
   - test name/file;
   - observed failure;
   - why the test appears stale rather than the implementation being wrong;
   - likely correction;
   - any uncertainty.

Priority 0.5 is reserved for non-blocking stale or failing tests that the user can address together later.

Do not use Priority 0.5 for application regressions, production blockers, or feature work.

If the current task explicitly includes updating stale tests, update them instead of deferring them.

## Test environments

Automated tests should use:

- disposable local data;
- fixtures;
- mocks;
- sandbox providers;
- copied/sanitised snapshots;

as appropriate.

Do not connect tests to production databases, real user accounts, or destructive live provider operations without explicit user authorisation.

## Test data and fixtures

Once fixtures exist, document:

- owning location;
- what they represent;
- whether they are generated or hand-maintained;
- reset/cleanup behaviour;
- any data sanitisation rule.

`tests/d1.ts` applies real migrations to an in-memory Node SQLite D1 adapter; `tests/import-fixture.ts` builds fictional workbook inputs. Tests use hand-maintained generic members/films, mocks and temporary directories, with cleanup owned by the test. Provider tests include fictional OMDb HTTP 401/403 quota/credentials bodies and malformed authentication bodies; bulk/resume tests protect cooldown suppression and pending-batch accounting. Import/provider/REST tests never use the private archive, production accounts or live providers. Use Node 24 for the complete suite; see [ARCHITECTURE](ARCHITECTURE.md).

Local demo data lives in `worker/seed.sql`; `seed_runs` makes startup idempotent. `db:reset` deletes local work and is not a routine test prerequisite. Production snapshot copies are private even after auth sanitisation; screenshots/results belong in ignored `.verification/`, never public fixtures. See [DATA](DATA.md).

## Canonical commands

| Purpose | Command |
| --- | --- |
| Targeted tests | `corepack pnpm exec vitest run tests/ranking.test.ts` |
| Intermediate/grouped tests | `corepack pnpm exec vitest run tests/auth.test.ts tests/product-api.test.ts` (select actual impact group) |
| Full suite | `corepack pnpm test` |
| Type checking | `corepack pnpm typecheck` (root plus Worker TS projects) |
| Linting | Not configured; do not invent a command |
| Build / compile verification | `corepack pnpm build`; static config `corepack pnpm prod:check`; add `--frontend` for process public build vars |
| Smoke testing | `node scripts/smoke.mjs` (local write smoke); `corepack pnpm exec tsx scripts/dev/smoke.ts` (disposable local CRUD) |

Keep these commands aligned with the actual manifests/tooling.

## Current test structure

Vitest is configured in `vite.config.ts`, selecting `tests/**/*.test.ts`. No lint/formatter or standalone Vitest config exists. Event inspection component tests use the test-only jsdom 26 environment and React act with mocked APIs; they require no browser automation, local servers, provider credentials or real data.

| Coverage | Files under `tests/` |
| --- | --- |
| Seen queue and Metrics UI | `seen-ui.test.ts` (catalogue-only rendering without detail reads, poster preloading/deduplication/failure fallback, poster-cache preservation through answers/corrections, five-answer current-visit pagination and Previous/Next, genuine source scores immediately before plot and queue-film updates, plot clamp/disclosure and visit preference, absent pending-save/Undo controls, optimistic serial saves/retry/ordered corrections and application-layer null writes, authoritative reconciliation and contribution chart presentation); `seen-api.test.ts` (single-film Seen/detail queries without catalog reads, ranking and appearances) |
| Presentation | `detail-presentation.test.ts` (saved-only identity variant, runtime grammar, full-width light overview and fit-content status, explicit Seen omission/alignment and compact Haven't heading, genuine source scores before overview including non-Classics and empty-source omission, Classics-only six-input summary, integer display and imputation, collapsed breakdown using actual raw/residual results, unavailable values and removed utility sections); `classics-presentation.test.ts` (Classics pagination/global ranks, compact ordered source items, accessible provider names, non-wrapping flex layout and missing-score suppression, semantic Ranked/Unranked/Seen tabs, unchanged filter groups, compact filter pills/count boundaries/palette, Classics-only mobile title sizing, and Detail History inference/suppression), `presentation.test.ts` (human historical/current turns, case-insensitive possessive member names, grouped History event headers, applied CSS for a single row of controls beside flexible text (jsdom styles, not browser geometry), transparent Google render-target sizing, and shared rough-date copy, audit evidence, `/100` formatting and retained native/derived precision outside saved Detail) |
| Domain | `ranking.test.ts` (six dimensions, scale normalisation, mean imputation, Seen multiplier, final tie-break and source precedence), `metrics.test.ts` (six-dimension stored-score ranking, missing-score exclusion, provenance, deterministic ties and filtered repeat appearances), `metrics-ui.test.ts` (ordered independent score selectors, mount defaults, headings, native values and dimension-specific empty states), `event-validation.test.ts`, `maintenance-feedback.test.ts`, `classics-presentation.test.ts` (Admin operational/status copy, active success/skipped suppression across all score/OMDb modes, provider failure/retry details, aggregate progress and scoped orange browser fill), `artwork.test.ts`, `metadata-maintenance.test.ts` (extracted TMDB maintenance UI handlers, Stop/unmount, fixed queue ordering/eligibility, bounded state for 980 films, local progress, final refreshed counts and failure recovery) |
| Event search/inspection | `film-search.test.ts` (matching, narrow SQL, preview no-write, credits, host), `event-inspection.test.ts` (mocked React DOM mount preservation, pagination/on-demand preview cache, confirmation/retry, Builder order/unavailable sets, personal Seen queue/Home count/corrections, App-owned serial save persistence and recoverable failure across navigation, Detail grouping and Seen-origin Back, History cycle pagination/jump/filtering, URL-only Admin routing/access/navigation, local-only developer tooling/application-shell indicator and auth-aware member-switch reload, moved bulk maintenance actions, pending-batch Stop, provider failure/cooldown feedback and absence of per-film maintenance, role/host-gated card actions, audit visibility/cache, director metadata, delete and History and compact Home date headings, top-two eligible/rankable Home Classics summaries and shared compact Classics/Home source-score items) |
| Current-cycle rotation and Home | `rotation.test.ts` (durable swaps, positional reset, eligibility, races, Event hosts), `rotation-ui.test.ts` (mocked React DOM identity/actions/disclosure/feedback); related rotation API coverage in `product-api.test.ts` |
| Architecture/performance | `performance.test.ts` (filter-assembler equivalence, stripped join keys, compact references/hydration/effective-score equivalence, narrow routes with catalogue disabled, SQL metadata bounds/counts, compatibility enrichment, direct Builder reads/batched validation, additive 0014 covering-index plans and 0015 before/after score-query plans/result equivalence); `frontend-api.test.ts` (compact hydration and selected metadata old-Worker fallback restricted to 404/405/501); Seen and Event inspection tests cover catalogue reconciliation, in-flight Seen writes, on-demand deduplicated previews, shared-data refresh and returned Rotation application. No wall-clock performance claims or live provider calls. |
| API/auth/product | `api.test.ts`, `auth.test.ts`, `product-api.test.ts`, `domain-api.test.ts`, `frontend-api.test.ts` |
| Providers/metadata | `omdb-failover.test.ts` (mocked dual-key selection across Metadata/Populate/Refresh/compatibility, independent existing/body/header cooldowns, bounded attempts and operation suppression, safe configuration/health/provenance/errors/logs, metadata checkpoint advancement/preservation), `providers.test.ts`, `ratings.test.ts`, `omdb-idempotency.test.ts` (zero durable no-op writes/timestamp preservation, changed scalar/genre diffs, aliases/order, unavailable fields, authoritative and raced identity conflicts, provider/DB rollback and explicit stale queue errors), `omdb-resume.test.ts` (versioned checkpoints, accepted batch advancement, failed/blocking/apply-error preservation, Stop/unmount/remount, completion, reconciliation without newly added films, corruption/storage denial, discard/restart, resumed progress and pacing); `metadata.test.ts` (one queue build followed by 490 indexed selected metadata reads in a 980-film run with global loaders forbidden, two-ID validation/admin checks, fresh/stale/artwork rechecks and successful optional-director omissions, skipped films, identity conflicts and cooldown suppression), `bulk-maintenance.test.ts` (admin/scope/bounds, mixed History/Classics batches, six-signal persistence without persisted imputation, negative-only score checks, inert legacy positives/status counts, Populate exclusion/incidental negative clearing, Refresh reconsideration/negative clearing and inconclusive fallback protection, ten-film complete/partial MDBList batching, single omitted-film recovery with scores/empty/not-found/blocking outcomes, no replay/retry loops, durable partial updates, cached/direct TMDB and fresh OMDb fallback, metadata reuse, cooldown/quota suppression), `score-maintenance.test.ts` (fixed queue, ten-film sequential batches, Stop/blocking failure/isolated unresolved completion, per-film title feedback, partial progress and bounded healthy state for 980-film runs), `maintenance-pacing.test.ts` (two-second idle gaps and Stop during idle). Bulk tests also forbid full catalogue reads and check ordinary reads while a mocked provider is pending; this proves request independence in the test adapter, not production D1 latency |
| Imports | `importer.test.ts`, `import-resolution.test.ts`, `import-io.test.ts`, `production-import.test.ts` |
| Schema/environment | `schema-compatibility.test.ts` (0009/final-schema auth, reads, events, metadata writes, safe swaps and migration capability discovery), `migration.test.ts` (including additive 0013 constraints/cascading observations and 0015 index-only preservation/unique score identities/deduplication; 0014 preservation/query-plan coverage lives in `performance.test.ts`), `dev-refresh.test.ts`, `dev-launch.test.ts`, `prod-check.test.ts` (working-tree migration sequence, exact cutover CORS, static-only frontend assets/Custom Domain and root Vite base), `tmdb-pairings.test.ts`, `tmdb-merges.test.ts` |

The local pairing/merge tests use disposable migrated D1 and mocked TMDB. They cover confirmed/corrected identities, survivor selection, ordered History/Builder appearances, Classics/seed evidence, score and Seen preservation, provenance/audit/fingerprints, unique ownership, rollback, raced state, receipt-based resume and cached response reuse. Rehearsing against a copied local emulator can additionally prove D1-specific parameter/authorisation limits; keep copied data/reports ignored and never use real providers for that rehearsal.

## Optional local rendered and persistence checks

Read [STYLE](../STYLE.md) fully before interface changes; source review alone is not layout verification. Review populated mobile, desktop and relevant intermediate widths, long/missing content and loading/error/recovery states. Do not broaden a documentation-only pass into application tests by default; check files, links, facts and `git diff --check` instead.

The optional browser harnesses below predate the current Film Detail and Admin simplifications; their old membership/maintenance/technical-disclosure selectors are not current regression checks. Use focused presentation tests and a mocked responsive render for current Detail verification. With normal local servers running, `node tests/ui-alignment.browser.mjs` reads the populated local snapshot and intercepts mutations using browser-only fixtures. Its historical coverage includes navigation/targets/forms/disclosures/responsive composition. It expects first two positional members, first as admin. `BOOKCLUB_UI_BEHAVIOUR_ONLY=1` skips the width screenshot sweep. `node tests/operation-feedback.browser.mjs` contains historical Film Detail/Classics failure-recovery scenarios with local reads and intercepted mutations, including controls that have since been removed.

Both use optional locally installed Playwright: `BOOKCLUB_PLAYWRIGHT_MODULE` (default ignored `.verification/node_modules/playwright/index.mjs`) and `BOOKCLUB_BROWSER_PATH` (Windows default Edge). This is not a package dependency or automatic Vitest step. Screenshots/reports stay private and ignored.

Artwork: `corepack pnpm exec tsx tests/artwork-snapshot.ts`, then `node tests/artwork.browser.mjs` with Vite running. The helper reads an existing local SQLite snapshot, copies it into memory and mocks at most ten selected TMDB details responses. Its source SQLite filename is currently fixed to the ordinary local emulator layout; verify availability before running. Browser intercepts APIs/images, checks 390/900/1440px contexts and missing/failed fallback, including no page-load enrichment. No real provider or production call is made.

`node scripts/smoke.mjs` creates labelled local movie/event data; use disposable local state. `corepack pnpm exec tsx scripts/dev/smoke.ts` checks catalog/derived screens, local member/admin and Builder/Seen CRUD, deleting its Builder and restoring Seen afterwards. Read scripts before use; cleanup does not make the execution path read-only. Do not connect any smoke to production without explicit authority.

Historical UI audits are [reference evidence](UI_AUDIT_POST_ALIGNMENT.md), not assertions that their findings persist in current source. Reverify before adopting an old diagnosis.

## Reporting and maintenance

Report exact commands/results, full-suite run or omission, blocked/skipped checks and manual checks still required. No passing claim for an unavailable environment. Keep this policy aligned with actual tests and fixtures. A skipped test is not a Priority 0.5 finding; that section requires an observed failure and evidence-based diagnosis. Documentation adoption itself does not require a Vitest run.

Score lifecycle regression coverage: `tests/score-lifecycle.test.ts` exercises the 0–6 live-dimension boundary, duplicates, invalid values, development demos, immediate retirement and disposable SQLite/shared-ranking equivalence. `tests/bulk-maintenance.test.ts` covers legacy-only live acquisition, negative checks and full Refresh reconsideration.

`tests/singin-repair.test.ts` uses disposable migrated D1 to verify guarded duplicate reconciliation, Cycle 34 preservation, Classics/seed/Seen/import/legacy-score retention, wrong-provider state discard, receipt evidence, identical reruns and race/unknown-relationship/conflict rejection.
