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

## Shared workflow and journal regression coverage

`shared-workflows.test.ts` protects stable SourceScores observer setup/cleanup, Action class merging, pagination boundaries, dialog Cancel/busy/focus lifecycle and synchronous bulk-controller exclusion/re-entry/release/stop. Existing metadata/score/enrichment suites retain queue, checkpoint, resume and failure feedback coverage. `provider-execution.test.ts` covers common read-only/writable cooldown gates and bounded quota parsing; provider/bulk/enrichment suites protect credential independence, reserve, not-found continuation, suppression and call counts. `builder-api.test.ts` uses disposable SQLite relation-write triggers to prove identical Builder lineups skip deletes/inserts while ordered changes replace atomically.

`journal-reconciliation.test.ts` combines the real Worker/disposable D1 with the frontend data hook to cover create/edit/publish/delete/restore, cycle creation, anchor date/audit patches, canonical movie/Seen/ranking reconciliation, older catalogue/rotation races, active History precedence over pending/already-confirmed No intentions and late stale Seen responses, released mutation leases and explicit Metrics invalidation. Its synthetic A–E replacement regression retains Lost in London scores, genres, IDs, Seen and provider evidence while checking all four Metrics categories, repeats, contributor filters, aggregates, soft deletion/restoration, full/compact hydration equivalence and over-broad cached enrichment. It preserves the separate Classics candidate and unknown-date missing and release-aware upcoming collection-roster populations. Successful product mutations must make zero follow-up catalog/compact or rotation calls; bootstrap reads remain one each. App integration and API/performance suites cover consumers and response contracts. No live services or data are used.

## Frontend route and loading checks

`tests/heading-casing.test.ts` mounts the real App with the shared fictional API harness to protect sentence-case Home/statistic and Admin headings, both Top/Bottom composite categories, four Metrics tab labels, ten Records film categories and six bold recurring-creator roles. It also checks protected Classic/Classic(s) and provider names, exact film/member/cycle/private-title insertion, all 18 stylised anagrams and intentional uppercase Seen/onboarding/header treatments. Existing behavioural suites retain their assertions with current copy; canonical source/talent definitions remain unchanged.

`tests/routes.test.ts` protects canonical route kinds, dynamic IDs, headings/images and both Navigation surfaces against drift. `tests/app-lazy-routes.test.ts` delays real Metrics/Admin module loading to verify Home's module boundary, shell-visible LoadingView, member denial before and after Admin loads, direct authenticated entries and enrichment reuse across route visits. App integration navigation waits for lazy content before asserting feature controls; Account-link assertions wait for the actual heading transition. Existing inspection, Seen, rotation and shell-title tests protect controller extraction behaviour.

## Artwork pipeline checks

`tests/asset-preparation.test.ts` uses disposable synthetic transparent PNGs to cover clean generation, persistent cache reuse after output removal, content/dimension/recipe invalidation, corrupted cache repair, concurrent serialization, stale-output pruning, aspect ratio and no enlargement. Runtime coverage checks canonical route images and extracted shell artwork, dynamically constructed member/Classics paths, chooser IDs and Lucide-only Action callers against the manifest and retained source inventory. `tests/prod-check.test.ts` prepares from an empty disposable cache/output with copied canonical sources before a real Vite build, checks every shipped derivative's dimensions/format, and rejects originals and obsolete files. `corepack pnpm assets:prepare --report` provides cache counters and source/output payload totals.

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

`tests/d1.ts` applies real migrations to an in-memory Node SQLite D1 adapter; `tests/import-fixture.ts` builds fictional workbook inputs. Tests use hand-maintained generic members/films, mocks and temporary directories, with cleanup owned by the test. MDBList provider fixtures distinguish single-film Letterboxd /5 from batch /10, including 9.2 to 92/100 with votes; maintenance regressions verify Refresh clears negatives only after persistence and preserves historical /5 snapshots. Provider tests protect informational Metacritic user /10, Trakt /100 and Roger Ebert /4 provenance and normalisation; bulk maintenance verifies batch persistence in Populate and Refresh, while score-lifecycle tests compare complete ranking results for every optional-source subset across zero to six live dimensions and legacy retirement. Provider tests include fictional OMDb HTTP 401/403 quota/credentials bodies and malformed authentication bodies; bulk/resume tests protect cooldown suppression and pending-batch accounting. Import/provider/REST tests never use the private archive, production accounts or live providers. Use Node 24 for the complete suite; see [ARCHITECTURE](ARCHITECTURE.md).

Local demo data lives in `worker/seed.sql`; `seed_runs` makes startup idempotent. `db:reset` deletes local work and is not a routine test prerequisite. Production snapshot copies are private even after auth sanitisation; screenshots/results belong in ignored `.verification/`, never public fixtures. See [DATA](DATA.md).

## Canonical commands

| Purpose | Command |
| --- | --- |
| Targeted tests | `corepack pnpm exec vitest run tests/ranking.test.ts` |
| Intermediate/grouped tests | `corepack pnpm exec vitest run tests/auth.test.ts tests/product-api.test.ts` (select actual impact group) |
| Full suite | `corepack pnpm test` |
| Type checking | `corepack pnpm typecheck` (root plus Worker TS projects) |
| Linting | `corepack pnpm lint` (correctness rules and React Hooks; zero warnings) |
| Build / compile verification | `corepack pnpm build`; static config `corepack pnpm prod:check`; add `--frontend` for process public build vars |
| Smoke testing | `corepack pnpm exec tsx scripts/dev/smoke.ts` (disposable local CRUD) |

Keep these commands aligned with the actual manifests/tooling.

## Current test structure

Vitest is configured in `vite.config.ts`, selecting `tests/**/*.test.ts` with at most four workers to bound memory/native image-processing contention. ESLint uses `eslint.config.mjs`; no formatter or standalone Vitest config exists. Browser scripts importing TypeScript modules (including metrics-performance.browser.mjs) run via `corepack pnpm exec tsx`; other configured synthetic browser scripts run with Node against local Vite. They block external/provider traffic. App integration tests use the test-only jsdom 26 environment and React act with mocked APIs; they require no browser automation, local servers, provider credentials or real data.

### Behavioural integration suites

| File under `tests/` | Contract |
| --- | --- |
| `event-inspection.test.ts` | Mounted Event drafts, search/back/confirmation, preview deduplication/import retry, prefill/corrections and returned-session reconciliation |
| `builder-inspection.test.ts` | Private editor/inspection, selection/reset/focus, import races/retry, ordered repeated films, optimistic autosave/final revision and Use set eligibility |
| `seen-detail-integration.test.ts` | Viewer-owned queue/Home counts, Detail groups/return context and serial save/retry through navigation |
| `history-home-integration.test.ts` | Cycle pagination/filter/sort/detail return, permissions/audit/delete and compact Home summaries |
| `admin-navigation.test.ts` | Account/Admin permission/navigation, maintenance stop/error feedback and local developer identity tools |
| `rotation-reconciliation.test.ts` | Returned swap updates, zero broad reloads and older catalogue/rotation response races |
| `canonical-title-ui.test.ts` | Canonical title consistency across member screens, search/confirmation and Metrics |
| `event-integrity-api.test.ts` | Slot uniqueness, restore collisions, stored/derived hosts and DB guards/races |
| `member-permissions-api.test.ts` | Avatars, roles, onboarding/collisions and personal Seen permissions |
| `builder-api.test.ts` | Owner-only CRUD, transactional/versioned publication/rollback and ordered-lineup write efficiency |
| `product-api.test.ts` | Rotation/Classics/cycle anchors, History audit/edit/delete/restore and permissions |

`tests/helpers/app-integration.ts` owns fictional catalogue/search/preview fixtures, API mocks, App mounting/navigation and render waits. Every case resets mocks and creates/unmounts its own root. `tests/helpers/product-api.ts` owns authenticated generic members, Worker calls and a newly migrated disposable in-memory D1 per case, closed afterward. Suites are independently runnable; no shared persistent state or test-order dependency is required. Existing race, permission, error and browser/navigation assertions remain integration checks.

Large `metadata.test.ts` and `bulk-maintenance.test.ts` remain cohesive suites for their bounded metadata and score-maintenance workflows, respectively; `provider-enrichment.test.ts` covers provider capture/cache persistence and additive migration preservation.

### Automatic quality gate

`.github/workflows/quality.yml` runs on pull requests and pushes to main: frozen-lockfile install, lint, type checking, full Vitest suite, build and `prod:check --frontend`. One Linux/Node 24 job uses Corepack and the manifest's pnpm version, fictional public build inputs, read-only repository permission, no secrets and no deployment/provider/production D1 commands. Browser automation remains optional local verification.

ESLint covers tracked JavaScript/TypeScript source, tests and tooling, excluding generated/cache/verification/emulator output. Core and TypeScript recommended correctness rules cover unused imports/variables, unreachable code, invalid constructs and suppression comments; React rules enforce Hook placement and dependencies. Strict `tsc` owns type checking. Existing adapter `any`/optional-chain assertions remain permitted; private error sanitisation deliberately omits caught causes and cleanup catches may be empty. Two narrowly explained Hook exceptions protect current queue-ref cleanup and identity-scoped resource replacement. No formatting rules are introduced. `tooling/lint` isolates the TypeScript 6 compiler API needed by typescript-eslint from application TypeScript 7.

`tests/helpers/application-css.ts` recursively expands `frontend/app.css` imports in order for existing jsdom and source-level presentation assertions. With local Vite running, `node tests/css-ownership.browser.mjs` renders synthetic populated Home, navigation, History, Builder/editor/confirmation, Event/inspection/Preview, Classics/dialog, Seen, all Metrics tabs, Admin and Detail at 320/390/720/951/1440px, blocking APIs and external requests. `--baseline <ignored-css-path>` additionally compares every element's computed properties (including pseudo-elements) and bounds against a previous application stylesheet; animations/transitions are held still. Evidence belongs under ignored `.verification/css-ownership/`.

| Coverage | Files under `tests/` |
| --- | --- |
| Seen queue and Metrics UI | `seen-ui.test.ts` (catalogue-only rendering without detail reads, poster preloading/deduplication/failure fallback, poster-cache preservation through answers/corrections, five-answer current-visit pagination and Previous/Next, genuine source scores immediately before plot and queue-film updates, plot clamp/disclosure and visit preference, absent pending-save/Undo controls, optimistic serial saves/retry/ordered corrections and application-layer null writes, authoritative reconciliation and contribution chart presentation); `seen-api.test.ts` (single-film Seen/detail queries without catalog reads, ranking and appearances) |
| Presentation | `app-shell-title.test.ts` (fixed Home wordmark, exact authorised pool, direct non-Home/Admin entry, route transitions and movie identity changes, rerender/data-loading stability, repeat route-event suppression and fresh mount selection); `detail-presentation.test.ts` (saved-only identity variant, runtime grammar, full-width light overview and fit-content status, unique stored-History host attribution with natural name lists and inactive-member support, omitted attribution without an identifiable host, explicit Seen omission/alignment and compact Haven't heading, genuine source scores before overview including non-Classics and empty-source omission, Classics-only six-input summary, integer display and imputation, collapsed breakdown using actual raw/residual results, unavailable values and removed utility sections); `classics-presentation.test.ts` (Classics pagination/global ranks, active Unknown-voter names in member order, compact ordered source items, accessible provider names, inline flex layout and missing-score suppression, semantic Ranked/Unranked/Seen tabs, unchanged filter groups, compact filter pills/count boundaries/palette, Classics-only mobile title sizing, and Detail History inference/suppression), `presentation.test.ts` (human historical/current turns, case-insensitive possessive member names, grouped History event headers, applied CSS for a single row of controls beside flexible text (jsdom styles, not browser geometry), transparent Google render-target sizing, and shared rough-date copy, audit evidence, `/100` formatting and retained native/derived precision outside saved Detail) |
| Domain | `ranking.test.ts` (six dimensions, scale normalisation, mean imputation, Seen multiplier, final tie-break and source precedence), `metrics.test.ts` (Critics/Audience normalised composite ranking, missing-score exclusion, provenance, deterministic ties and filtered repeat appearances), `metrics-ui.test.ts` (independent Critics/Audience selectors, mount defaults, /100 values and category empty states, paired popularity switching, invariant medians and shared linked poster/metadata/context/identity rows), `event-validation.test.ts`, `maintenance-feedback.test.ts` (provider summaries and retry-duration ceiling/whole-hour boundaries in hr/min), `classics-presentation.test.ts` (legacy maintenance-controller progress and nonzero Unranked-only tab badges, full accessible counts, Admin operational/status copy, active success/skipped suppression across all score/OMDb modes, provider failure/retry details, aggregate progress and scoped orange browser fill), `artwork.test.ts`, `metadata-maintenance.test.ts` (extracted TMDB maintenance UI handlers, Stop/unmount, fixed queue ordering/eligibility, compatibility-error partial progress, bounded state for 980 films, local progress, final refreshed counts and failure recovery) |
| Event search/inspection | `film-search.test.ts` (matching, narrow SQL, preview no-write, credits, host); `film-selection.test.ts` covers active-History search badges across shared consumers, deleted evidence, catalogue updates and selectable repeats; behavioural App suites listed above cover preserved editors, confirmation/retry, queues, History, Admin and reconciliation |
| Current-cycle rotation and Home | `rotation.test.ts` (durable swaps, positional reset, eligibility, races, Event hosts), `rotation-ui.test.ts` (mocked React DOM identity/actions/disclosure/feedback); related rotation API coverage in `product-api.test.ts` |
| Architecture/performance | `performance.test.ts` (filter-assembler equivalence, stripped join keys, compact references/hydration/effective-score equivalence, narrow routes with catalogue disabled, SQL metadata bounds/counts, compatibility enrichment, direct Builder reads/batched validation, additive 0014 covering-index plans and 0015 before/after score-query plans/result equivalence); `frontend-api.test.ts` (compact hydration and selected metadata compatibility errors without general-endpoint fallback); Seen and Event inspection tests cover catalogue reconciliation, in-flight Seen writes, on-demand deduplicated previews, shared-data refresh and returned Rotation application. No wall-clock performance claims or live provider calls. |
| API/auth/product | `api.test.ts`, `auth.test.ts`, `event-integrity-api.test.ts`, `member-permissions-api.test.ts`, `builder-api.test.ts`, `product-api.test.ts`, `domain-api.test.ts`, `frontend-api.test.ts` |
| Providers/metadata | `omdb-failover.test.ts` (mocked dual-key selection across Metadata/Populate/Refresh/compatibility, independent existing/body/header cooldowns, bounded attempts and operation suppression, safe configuration/health/provenance/errors/logs, metadata checkpoint advancement/preservation), `providers.test.ts`, `ratings.test.ts`, `omdb-idempotency.test.ts` (zero durable no-op writes/timestamp preservation, changed scalar/genre diffs, aliases/order, unavailable fields, authoritative and raced identity conflicts, provider/DB rollback and explicit stale queue errors), `omdb-resume.test.ts` (versioned checkpoints, accepted batch advancement, failed/blocking/apply-error preservation, Stop/unmount/remount, completion, reconciliation without newly added films, corruption/storage denial, discard/restart, resumed progress and pacing); `metadata.test.ts` (one queue build followed by 490 indexed selected metadata reads in a 980-film run with global loaders forbidden, two-ID validation/admin checks, fresh/stale/artwork rechecks and successful optional-director omissions, skipped films, identity conflicts and cooldown suppression), `bulk-maintenance.test.ts` (admin/scope/bounds, mixed History/Classics batches, six-signal persistence without persisted imputation, negative-only score checks, inert legacy positives/status counts, Populate exclusion/incidental negative clearing, Refresh reconsideration/negative clearing and inconclusive fallback protection, ten-film complete/partial MDBList batching, single omitted-film recovery with scores/empty/not-found/blocking outcomes, no replay/retry loops, durable partial updates, cached/direct TMDB and fresh OMDb fallback, metadata reuse, cooldown/quota suppression), `score-maintenance.test.ts` (fixed queue, ten-film sequential batches, Stop/blocking failure/isolated unresolved completion, per-film title feedback, partial progress and bounded healthy state for 980-film runs), `maintenance-pacing.test.ts` (two-second idle gaps and Stop during idle). Bulk tests also forbid full catalogue reads and check ordinary reads while a mocked provider is pending; this proves request independence in the test adapter, not production D1 latency |
| Imports | `importer.test.ts`, `import-resolution.test.ts`, `import-io.test.ts`, `production-import.test.ts` |
| Schema/environment | `schema-compatibility.test.ts` (0009/final-schema auth, reads, events, metadata writes, safe swaps and migration capability discovery), `migration.test.ts` (including additive 0013 constraints/cascading observations and 0015 index-only preservation/unique score identities/deduplication; 0014 preservation/query-plan coverage lives in `performance.test.ts`), `dev-refresh.test.ts`, `dev-launch.test.ts`, `prod-check.test.ts` (working-tree migration sequence, exact cutover CORS, static-only frontend assets/Custom Domain and root Vite base), `tmdb-pairings.test.ts`, `tmdb-merges.test.ts` |

The local pairing/merge tests use disposable migrated D1 and mocked TMDB. They cover confirmed/corrected identities, survivor selection, ordered History/Builder appearances, Classics/seed evidence, score and Seen preservation, provenance/audit/fingerprints, unique ownership, rollback, raced state, receipt-based resume and cached response reuse. Rehearsing against a copied local emulator can additionally prove D1-specific parameter/authorisation limits; keep copied data/reports ignored and never use real providers for that rehearsal.

`tests/catalog-index.test.ts` protects canonical lookup identity, active-only History/session membership, repeat deduplication, no source mutation, same-object reuse and replacement-object invalidation. `tests/rating-dimensions.test.ts` protects registry identity/ordering, exact agreement with the six required ranking dimensions, optional observation isolation and nominal display scales independent of provider raw scales. The metadata collision race test injects at MovieRepository's batch builder; service/facade and narrow-query coverage remain in the existing suites.

`tests/source-scores.test.ts` protects shared Home/Classics/Detail genuine-only rows at five, six, seven and nine observations, Home warning suppression and retained detailed Detail imputation explanations, six versus seven-to-nine layout modes, canonical optional ordering/omission, audience/critic divider placement with missing sources and single-group omission, genuine-only selection, endpoint-equivalent Letterboxd presentation, Ebert /100 display and preserved /4 provenance, accessible provider/metric names and intrinsic-width wrapping styles.

`node tests/compact-scores.browser.mjs` uses local Vite and optional Playwright with synthetic Home Next Classics cards, Classics, Film Detail and Seen, blocking API/external requests. It verifies five/six inline-pair and seven/nine stacked modes at 320/390/720/951/1440px without page overflow; screenshots stay in ignored `.verification/compact-scores/`.

`node tests/film-selection.browser.mjs` uses Vite and optional Playwright with synthetic Classics/Builder data and blocked APIs/external requests. It checks 320/390/720/951/1440px composition, keyboard selection/focus, replacement, commit, Escape and overflow; screenshots stay in ignored `.verification/film-selection/`.

`tests/film-selection.test.ts` covers shared accepted-selection reset/focus, replacement identity/overview/eligibility, History/all-Seen rejection, read-only external preview, canonical import/retry, duplicate submission protection, immediate Classics reconciliation, derived Seen/unranked lifecycle and ordered Builder additions/repeats/removal/navigation. Event inspection tests verify accepted Yes resets while Nope/Back preserve the draft search. The disposable-D1 membership case in `domain-api.test.ts` verifies idempotent addition, immediate catalogue membership, derived per-member unanswered queues and absence of fabricated Seen/score/History data.

`metrics-staging.test.ts` protects complete five-turn cycles/imports/Classics-first, filter-independent qualification, population SD versus observed ranges, single/missing evidence, observed-year axes, rounded year/runtime labels, mirrored saturated pair rank colours, fixed comparison populations, binary leaning with neutrals, deduplicated genre subsets including triples/cutoff ties, bounded symmetrical fractional cosine, min-max keyword preferences, permanent global conflict elimination across all ten pairs, later-round conflicts, skipped disqualified lower preferences, canonical identity/case equivalence, deterministic symmetry and exhaustion, stable cast IDs and all-four-human per-column counts, Writer/Screenplay deduplication, director person-ID/name/Chaplin exclusions and five-plus-ties partnerships, revenue/financial ties, separate classification score denominators, streamable AU service/access unions and cutoff ties, documented hidden-gem midrank formula and cult vote/gap thresholds, collection negatives/unknowns, original awards text/null/zero counts, reception ties and fully answered four-human Classics pools. `metrics-staging-ui.test.ts` renders the relocated reports at their owning destinations and the Records comparisons through the actual four-tab screen, protects the existing reports, aligned axis geometry, touching score bars, six shared table columns, poster/rank/index structure, stable filtered axes/full matrices, named keyboard-scrollable earlier cycles, partial/missing cache states and one enrichment read. With local Vite already running, `node tests/metrics-staging.browser.mjs` mocks the App/API using synthetic fixtures and blocks external/provider traffic; it checks all 15 relocated sections and genre combinations, Hidden gems and Most cult only in Top 5, eight historical cycles with a measured five-card initial window, stable axes, contained accessible matrices and no page overflow at 320/390/720/951/1440px, and saves screenshots/measurements under ignored `.verification/metrics-staging/`. It never reads local/production databases. Focused command: `corepack pnpm exec vitest run tests/metrics-staging.test.ts tests/metrics-staging-ui.test.ts tests/metrics-enrichment-ui.test.ts tests/heading-casing.test.ts`. Full gates remain lint, typecheck, test, build, prod:check and git diff --check.

`tests/metrics-dashboard.test.ts` and synthetic `tests/metrics-fixture.ts` cover active appearance filtering/repeats, ALL genre baselines/signatures, deterministic top-five fingerprints and stable colours, chronological decades/Unknown, genuine normalised rating means/medians/coverage with informational Watch Order isolation, IMDb and exactly-six-dimension audience votes, effective-snapshot/invalid-count exclusion, appearance-weighted medians and deterministic canonical list deduplication, exact director-credit grouping/coverage and tie-aware deduplicated film extremes with missing data, including positive IMDb vote maxima/minima, missing/invalid/non-IMDb vote exclusion and repeat deduplication. Shared summary derivations remain covered; Home tests verify Quick facts totals and placement. Metrics genre and Top 5 score regression coverage remains. `metrics-refinements.test.ts` covers defensive comparison widths, fractional circles, cutoff ties, every composite dimension, missing-score omission, canonical film ties, revised visuals, Popular/Obscure cabinet cards and the continuous film/creator palette sequence, frequency-ranked theme lists including below-club ratios, empty contributor distributions, coverage-copy removal, consolidated median bars on a shared population scale with carrot budget colour and median revenue/budget labels and stable diversity colour alternation. `metrics-enrichment.test.ts` covers conservative keyword deduplication, role/person/company identity, Writer union, country/language profiles, theatrical/severity AU resolution, known-only percentages, positive-money eligibility, unique positive-money eligibility and repeat-weighted medians, creator ties/recurrence, diversity/coverage and all six filters. `metrics-api.test.ts` uses disposable migrated SQLite to prove seven read-only set queries, active History scope, partial cache, omitted unrelated payloads, no HTTP/credentials, authentication, older-schema 503 and unchanged catalogue transport. `metrics-enrichment-ui.test.ts` verifies one StrictMode request, local filters/roles across category tabs, filtered theme frequencies/ratios and unchanged diversity calculations against domain reports, linked ratio lists, all tied film links and failure/retry/partial states. `theme-keywords.test.ts` covers display labels, hyphen/whitespace/case identity deduplication, evidence preservation, shared conservative exclusions, cleaned theme diversity including one-off themes, one-off keyword eligibility, repeat-weighted counts, cross-provider deduplication, count-first ordering and exact alphabetical twelve-item cutoffs, plus the aggregate diagnostic. `metrics-tabs.test.ts` checks exactly four tabs and the approved 13/9/17/20 inventories and DOM order using synthetic `helpers/metrics-inventory.ts` expectations; every former Staging report appears once in its assigned destination, with no selectable Staging or standalone Studios section. It retains one active associated panel, default/new-mount state, global identity updates, no refetch/storage and four-destination keyboard focus/wrapping. The hand-maintained synthetic `metrics-enrichment-fixture.ts` contains TMDB-only, MDBList-only and combined keywords, partial evidence, multi-country/studio films, non-English languages, AU conflicts, recurring creators and missing/zero money; no private snapshots are used.

`metrics-general.test.ts` protects the exact four-tab and seventeen-report Breakdowns inventories, five ALL/one filtered contributor rows, whole-appearance classification percentages, one legend, Other/Unknown, the 5% inline threshold and accessible small segments. Financial cases retain repeat-weighted medians and independent partial coverage while proving one maximum across budget/revenue and all contributors, equal-value widths and filter-invariant axis/widths. Language cases exclude English/missing/spoken-only evidence, candidate/deleted-only films and repeated canonical appearances, verify member/Classics selection, alphabetical fifth-place ties, rank colours and leader-relative widths. Ratings retains all nine axes and domain-derived means under every identity. The browser harness additionally reviews long language names, small segments and all/single-group geometry at the five canonical widths with synthetic data only.

`metrics-top-five.test.ts` verifies the thirteen-report order, dynamic score/vote headings, moved reports absent from old tabs, all Talent roles, identity filters, no duplicate/bar wrappers, lazy loading and retry. Pure cases cover all three fifth-place tie examples, uncapped ties, singleton studios, appearance percentages, canonical multinational countries and the all-distinct-film denominator (including missing evidence), numeric ratio ties, grouped multipliers, reciprocal formatting and overflow/underflow exclusion.

Top 5 rendered assertions in `tests/metrics.browser.mjs` protect all four shared three-column film rows, 64×96px posters/fallbacks, accessible canonical links, intrinsic identities, title containment, five-width overflow in both desktop drawer states, long member names, synthetic successful/failed artwork, both popularity modes with invariant median copy, equal-width two-option selectors and the retained row divider without an adjacent section border. The harness also verifies all ten report headings in order, 26 tied studios with pagination, 16 tied countries with the distinct-film denominator, all seven talent roles and Top 5 enrichment error/retry. Screenshots cover full panels and scrolled endings, including two-column layouts when the Metrics container reaches 720px (1440px expanded and 951/1440px collapsed). Synthetic evidence does not certify private/live data or every browser engine.

`corepack pnpm exec tsx tests/metrics.browser.mjs` runs against `corepack pnpm dev:ui` with optional local Playwright and Edge/browser configuration below. All API reads including lazy Metrics enrichment are intercepted with synthetic cached data; external requests are blocked and no API server or database is needed. It checks the four original category panels at 320/390/720/951/1440px, exact unique current report assignments, default/reload state, global filters immediately above the intrinsic-width scrolling tab strip, active-tab visibility/readable labels/touch targets, arrow/Home/End focus, unchanged page scroll on switching, every identity filter without category reset, seven talent roles, contributor-only stacked classification and a filter-invariant shared financial axis, unique linked revenue/budget lists, diversity and composite score extremes, nine rating-circle axes and optional selections, repeated-film deduplication, long labels, sparse metadata, poster fallbacks, responsive grids, exact values, no page overflow/runtime errors, one lazy read per authenticated resource and zero tab/filter-triggered API calls. Screenshots and results stay ignored under `.verification/metrics/`.

`metrics-performance.test.ts` verifies cached/uncached report equivalence across all filters and roles, repeat/score/missing-data preservation, per-film fact and baseline reuse, resource invalidation/raced responses and account isolation, inactive-panel suppression, visited-report reuse, repeated-filter no-ops and complete bounded pagination. Enrichment UI tests verify invalidation after saved batches, including unmount, and no invalidation for unchanged facts. `corepack pnpm exec tsx tests/metrics-performance.browser.mjs` uses 1,000 synthetic films with 30 keywords and 15 cast credits each, intercepting all API calls and blocking external traffic. It records paint/navigation timings and long tasks, verifies navigation during a delayed enrichment read, cross-visit read reuse, bounded large-tie DOM and responsive overflow at 390/1440px. Set `BOOKCLUB_METRICS_URL` to a loopback preview origin to exercise a locally built production frontend; the harness uses a synthetic bearer token and intercepted APIs in either mode. Timings are diagnostic, not hardware-dependent pass thresholds; artifacts remain ignored under `.verification/metrics/`.

`tests/classics-removal-ui.test.ts` covers admin controls across all three tabs, film/count confirmation, cancellation, removal reconciliation and read-only/member visibility.

History/Classic corrections: `tests/history-classics.test.ts` covers universal event save/restore authoritative Seen/ranking evidence, post-publication No/null write guards, monotonic deletion/correction, active roster, idempotency, admin-only Classics removal and History precedence, and scoped sanitation. `tests/mobile-classics.browser.mjs` uses synthetic API interception to review Classics/Seen and Metrics mobile layout, heading action, removal confirmation, disclosure and five-row genre scrolling.

`tests/canonical-title.test.ts` protects provider precedence and refresh-order independence, authority upgrades without text changes, no-op reconciliation, missing/sentinel evidence preservation, exact IMDb-linked title admission, opportunistic HTTP counts, original-title separation, incomplete Media Info title-only capture without false analytical freshness, search, additive populated 0016→0017 preservation, admin-only bounded cached reconciliation and zero-provider-call backfill. `canonical-title-ui.test.ts` mounts the real App with Correct Provider Name and conflicting legacy-title fixture evidence across Home, History, all Classics tabs, Seen, Detail, Builder, Event, Metrics, local search, Add Classic and removal/Use from Builder confirmation. Existing enrichment/OMDb tests cover dedicated batching, rollback, credential failover, whole-catalogue metadata eligibility, pending failed metadata batches, Stop/resume and shared job locking. All provider payloads are synthetic. The optional disposable local D1 rehearsal under ignored `.verification/canonical-title/` applies a populated prior schema and migration 0017, then exercises the actual resolver SQL and lower-priority refresh through Wrangler `--local --env local` with a separate persist directory; it never alters ordinary local data.

`tests/builder-autosave.test.ts` uses deferred saves to prove serial revision handoff, intermediate-state coalescing, current-text flush, dirty failure retention/retry and final-revision publication ordering. `home-timeline.test.ts` covers deterministic local-calendar days, Australian number formatting, chronological completion through imported gaps, current completion markers and unfinished future cycles and active History runtime appearances. `history-home-integration.test.ts` covers Home summary strip order and History reverse cycles/events/jump with immutable numbered film order, page/filter/navigation/reload, AU metadata separators; `builder-inspection.test.ts` covers heading New set, title-blur creation without keystroke saves, absence of the note editor and preservation of stored notes, optimistic failure recovery, queued All sets and first-four poster previews. Ranking tests also protect Unranked ordering without partial No boosts, stable seed ties and unrated-last placement. `history-classification.test.ts` uses disposable D1 to prove shared Metrics AU resolution, one set query, omitted absent evidence, older-schema compatibility and zero provider calls/writes.

`node tests/shared-controls.browser.mjs` uses synthetic History with all network/API traffic blocked to check pagination, event identity, native-dialog focus/Cancel/Escape, busy closure guards, exactly one delete request and mobile/desktop overflow at 320/390/720/951/1440px. `tests/score-abbreviations.test.ts` protects the empty-summary omission, one named decorative control, canonical glossary with retained native/normalised examples (including optional/Audience/Critic meanings and genuine source steps), native cancellation/close and focus restoration. `node tests/compact-scores.browser.mjs` checks 80 Home/Classics/Detail/Seen width/source-count cases, including right-edge help placement/touch targets, complete glossary, keyboard opening, Escape/Close focus restoration, empty-score omission, exact divider position, inline/stacked wrapping and no page overflow. Both keep screenshots ignored under `.verification/`.

`node tests/home-history-builder.browser.mjs` uses local Vite and optional Playwright with synthetic App/API fixtures and blocked external/API requests. It checks Home order/Quick facts/icon-free Missing answers/faint borders, History Re-sort/jump/back/classification, 33px drawer icons in both drawer states, Builder creation-date ordering preserved through edits and new saves, heading action/poster count/centering, 126×189px posters with centred ellipsised titles, half-size attribution without a footer divider, emerald Plus, numbering/right-column actions, long-title wrapping and no page overflow at 320/390/720/951/1440px. Screenshots/results stay ignored under `.verification/home-history-builder/`.

`tests/format-count.test.ts` covers Australian thousands separators, unchanged numerical estimates, quota text fallbacks and full accessible local Unranked filter counts behind the 99+ cap. Existing presentation suites retain score precision, metadata, ordering and workflow assertions while referring to the semantic title/narrative/tab families.

With UI-only Vite running (`corepack pnpm dev:ui`, no API supervisor/database setup), `node tests/style-unification.browser.mjs` uses optional Playwright/Edge and entirely synthetic API functions. All ordinary API, supervisor and external traffic is blocked. It checks 320/390/720/951/1440px, every main route, Detail/Preview, populated Metrics panels, long/missing film content, Builder/search, dialogs, account/attribution, navigation, sign-in/avatar, developer disclosures and loading/error/evidence components. It verifies shared control labels/targets, overflow and removal collisions, then runs all six Admin operations against in-memory deferred batch functions to review focus, Stop, progress, Resume and Discard. No provider, database or production operation executes. `BOOKCLUB_STYLE_PHASE=before` captures the same core baseline without applying after-state assertions/jobs; default `after` writes comparison evidence. Screenshots/measurements stay ignored under `.verification/style-unification/{before,after}/`. Its control-state checks verify hover/focus geometry, visible outlines, selected tab underlines, disabled controls and enabled text contrast against composited surfaces; `BOOKCLUB_STYLE_CONTROLS_ONLY=1` runs only this focused subset. As with other optional harnesses, synthetic rendering does not certify live data, Google-owned sign-in, screen-reader behaviour or every browser engine.

## Unified Admin verification

`maintenance-contract.test.ts` exercises every declared film field/family across unchecked, present, unavailable, inconclusive, identity-change, provider-unavailable, Refresh and failed atomic persistence scenarios. It verifies all nine maintained rating capabilities against unchanged six Watch Order dimensions, provider-owned title gaps, empty/zero optional data, absent artwork, malformed rating evidence, incidental capture with partial success, legacy snapshot interpretation, additive/idempotent 0023 and frozen score checkpoint translation. Existing collection-roster suites retain validation, two-distinct-History scope, deduplication, failures and Stop/resume. Admin inventories and all eighteen heading-adjacent microdot lines are checked against the shared declaration by admin-field-summaries.test.ts. aggregate-maintenance.test.ts covers both intents, new collection eligibility after film commits, zero-work phases, unresolved film failures, Stop at either boundary, frozen collection scope, lost-response recovery, cooldowns, malformed responses and strict v2 checkpoints. aggregate-maintenance-ui.test.ts mounts the real Admin for a zero-film aggregate, separate estimates, second-phase Stop/resume, shared standalone lock and missing-roster-API gate.


`unified-maintenance.test.ts` uses disposable migrated D1, real repositories/services and fictional upstream fetch counters. It covers 36-film provider deduplication/estimate bounds, repeated successful-empty Populate with zero follow-up calls, stale/whole-catalogue scope, schema/identity gates, cooldown and MDBList reserve. Focused OMDb regressions trace the repository facade through individual, combined and score-only operations: usable/partial/unavailable and unchanged metadata persist identity-bound coverage, repeated Populate skips calls, Refresh remains eligible, and network/not-found/malformed/identity/metadata-write/coverage-write failures leave successful checks absent or unchanged. `unified-maintenance-api.test.ts` protects admin authorisation, strict bounded requests and complete read-only coverage. `unified-checkpoint.test.ts` protects corrupt checkpoints, frozen scope, durable lost-response reconciliation, Stop, partial success and transport/malformed interruption. Updated enrichment-ui, Admin navigation, casing and product UI suites exercise both groups, confirmations, all-action locking, permission change, local failure/quota feedback, remount/resume and necessary reconciliation. Compatibility controller tests retain their original isolated owners.

With existing UI-only Vite on localhost:4173, `node tests/unified-admin.browser.mjs` uses optional Playwright/Edge and synthetic App/API interception. It blocks all Worker/external/provider traffic and verifies card order, all eighteen inventory disclosures and their heading-adjacent 13px/400 subdued summaries, provider-check counts, checked-empty zero-work buttons, both confirmations, no mount requests, lock, Stop/resume without replay, pumpkin/ruby progress, 44px controls, quiet single card borders and no overflow at 320/390/720/951/1440px. Screenshots and measurements stay ignored under `.verification/unified-admin/`. Older six-card browser harnesses retain compatibility selectors; this is the current unified Admin rendered check.

## Optional local rendered and persistence checks

Provider enrichment: `tests/enrichment-fixtures.ts` holds synthetic TMDB appended-details and MDBList Media Info shapes. `provider-enrichment.test.ts` covers typed fields, exact crew mapping/top-15 billing, US/AU evidence, provider-separated keywords, Media Info identities and exclusion of regionless watch data, ownership conflicts, opportunistic score/metadata capture without extra calls, cache reconciliation/idempotency/failure freshness, bounded admin routes, cooldown/quota reserve, and populated 0015→0016 preservation/FK/uniqueness/cascades and older-snapshot compatibility. `enrichment-maintenance.test.ts` covers fixed serial paced queues, Stop, checkpoints, stale responses and blocking failure. `enrichment-ui.test.ts` mounts unified Admin controls with mocked APIs for cross-control locking, pending-batch interaction, local errors, one necessary final reconciliation and navigation/resume. Shared checkpoint extraction remains covered by `omdb-resume.test.ts`.

The schema-aware `tmdb-merges.test.ts` and `singin-repair.test.ts` also cover cache preservation/receipt evidence and wrong-identity discard under explicitly requested identity maintenance, using disposable fixtures only. Provider tests verify the documented Crew/Cinematography equivalent, both MDBList identity-group calls, successful empty sets, MDBList 429 headers/cooldown, the 100-parameter write bound and a pre-0016 schema gate before provider calls.

With `corepack pnpm dev:ui` running, `node tests/admin-enrichment.browser.mjs` uses optional Playwright/Edge and entirely synthetic API interception. It verifies both enrichment cards within the compatibility Admin console at 1440px and 390px: eligibility, delayed serial batches, progress, two-second pacing, Stop retaining completed work, reload/resume, local errors, all-maintenance locking, usable progress/control geometry, focus/scroll responsiveness and no page overflow. Screenshots/results remain ignored under `.verification/admin-enrichment/`. No API Worker, production data or live provider is used. MDBList shape verification during development consumed two authorised read-only IMDb batch calls with `append_to_response:["keyword"]`; automated tests use synthetic fixtures only.

Read [STYLE](../STYLE.md) fully before interface changes; source review alone is not layout verification. Review populated mobile, desktop and relevant intermediate widths, long/missing content and loading/error/recovery states. Do not broaden a documentation-only pass into application tests by default; check files, links, facts and `git diff --check` instead.

The optional browser harnesses below predate the current Film Detail and Admin simplifications; their old membership/maintenance/technical-disclosure selectors are not current regression checks. Use focused presentation tests and a mocked responsive render for current Detail verification. With normal local servers running, `node tests/ui-alignment.browser.mjs` reads the populated local snapshot and intercepts mutations using browser-only fixtures. Its historical coverage includes navigation/targets/forms/disclosures/responsive composition. It expects first two positional members, first as admin. `BOOKCLUB_UI_BEHAVIOUR_ONLY=1` skips the width screenshot sweep. `node tests/operation-feedback.browser.mjs` contains historical Film Detail/Classics failure-recovery scenarios with local reads and intercepted mutations, including controls that have since been removed.

`node tests/detail-seen-layout.browser.mjs` is a focused current Film Detail regression harness with Vite running. It renders the actual Detail component with synthetic four-member populations (0/4 through 4/0), blocks APIs and external requests, and waits for the requested committed fixture population with ID-scoped Detail reads from one shared synthetic API object across Vite module URLs, then checks 1024/951/900/600/390/320/280px widths for intrinsic divider position, no premature wrapping, left/right row alignment, unchanged identity widths and page/member overflow. Full-screen screenshots stay in ignored `.verification/seen-layout/`. It uses the same optional Playwright/browser environment variables below.

Both use optional locally installed Playwright: `BOOKCLUB_PLAYWRIGHT_MODULE` (default ignored `.verification/node_modules/playwright/index.mjs`) and `BOOKCLUB_BROWSER_PATH` (Windows default Edge). This is not a package dependency or automatic Vitest step. Screenshots/reports stay private and ignored.

Artwork: `corepack pnpm exec tsx tests/artwork-snapshot.ts`, then `node tests/artwork.browser.mjs` with Vite running. The helper reads an existing local SQLite snapshot, copies it into memory and mocks at most ten selected TMDB details responses. Its source SQLite filename is currently fixed to the ordinary local emulator layout; verify availability before running. Browser intercepts APIs/images, checks 390/900/1440px contexts and missing/failed fallback, including no page-load enrichment. No real provider or production call is made.

`scripts/smoke.mjs` is not a current validation command: it omits the required manual-film title and personal identities for guarded Event/Seen writes. Its journal-response reads use the current contract, but its remaining fixture/auth assumptions require a separate update before use. `corepack pnpm exec tsx scripts/dev/smoke.ts` checks catalog/derived screens, local member/admin and Builder/Seen CRUD, deleting its Builder and restoring Seen afterwards. Read scripts before use; cleanup does not make the execution path read-only. Do not connect any smoke to production without explicit authority.

Historical UI audits are [reference evidence](UI_AUDIT_POST_ALIGNMENT.md), not assertions that their findings persist in current source. Reverify before adopting an old diagnosis.

`tests/event-inspection.test.ts` and `tests/builder-inspection.test.ts` cover mounted Event/Builder drafts, inspection confirmation and retry, shared selection reset, Save set list navigation and Use set effective-turn eligibility including swaps, other turns, Classics, missing rotation and inactive members alongside existing route regressions. `tests/film-selection.test.ts` covers direct selection, Add Classic and shared known-only search director metadata. `node tests/builder-search.browser.mjs` uses synthetic App/API fixtures with Vite and optional Playwright, blocking all API/provider requests; it checks Builder without a private note field, Film icons for Open set, left/right editor action docking with controlled narrow wrapping and own/other-turn Use set gating, inspection actions, real-browser focus, Save/Use set, Event and Add Classic at 320/390/720/951/1440px. Screenshots stay in ignored `.verification/builder-search/`.

`tests/rotation-ui.test.ts` covers Home turn actions and the pre-exposed Admin swap card, including eligible future members, versioned saves and recoverable errors. `tests/admin-navigation.test.ts` verifies Admin placement; `tests/rotation-reconciliation.test.ts` verifies immediate swap reconciliation without broad reloads or stale-rotation overwrite.

`tests/au-watch-offers.test.ts` covers five AU access mappings, identity/access deduplication, other-region exclusion, malformed/missing AU semantics, persistence filtering, set-based compact/full projection and disposable populated 0009→0018 migration cleanup/idempotency with canonical preservation. `maintenance-estimates.test.ts` verifies TMDB pairs, actual MDBList mixed identity groups, OMDb failover, missing/refresh score fallback bounds and zero scope. `p1-product-ui.test.ts` covers independent Admin card naming/providers, cached Builder equal-weight streaming/rental availability with no requests, omitted/empty patch compatibility, seeded Classics sorting/locked selections/optional toggling/additional-film deduplication, 0–3 candidates, historical/member exclusions and live optional ineligibility. Existing History/journal tests cover universal Seen, restore, Builder publication and immediate reconciliation without broad reads.

`node tests/p1-product.browser.mjs` uses synthetic Vite module interception and blocks all API/provider traffic. Eight 320/390/720/951/1440px Builder availability/Classics attestation scenarios verify selections, exact submitted IDs, readable streaming/rental offers, long titles and no overflow; screenshots stay ignored under `.verification/p1-product/`. Existing Builder/search, mobile Classics and Admin harnesses retain their behavioural coverage.

## Pre-launch regression and rendered coverage

`tests/pre-launch-semantics.test.ts` covers recorded swapped/sparse History ordering, valid-date Newest/positive-runtime Shortest ties, all glossary increments, six displayed AU classification groups with the unchanged known denominator, and desktop-only viewer Missing answers counts at 0/1/9/99/100/126 in both drawer states, zero suppression, full accessible counts and no Classics/mobile navigation badge. `tests/detail-back.test.ts` protects ordinary Builder lineup navigation preserving the pending private draft and direct/refreshed Detail/Preview Home fallback. Existing inspection, Seen and History suites retain workflow behaviour; Ratings profile tests verify exactly ten circles at zero, fractional, exact-ten and maximum values.

`corepack pnpm exec tsx tests/pre-launch.browser.mjs` intercepts every API/provider request with synthetic data. It checks Home strip geometry, all main routes, Builder list/editor, Detail/Preview return and browser history, all four populated Metrics panels, glossary/footer and both drawer modes at 320/390/720/951/1440px. Screenshots and results remain ignored under `.verification/pre-launch/`. The existing Metrics and compact-score browser harnesses retain source-count, empty-state, keyboard/focus, scrolling and responsive geometry coverage.

## Collections and awards regression coverage

`tests/collections-awards.test.ts` covers collection validation/null/malformed identity evidence, original awards wording, conservative counts without named-prize double-counting, zero/unquantified/N/A/missing states, identity races, idempotent upserts and cascades, Populate suppression, positive↔negative Refresh, provider coalescing/request estimates, preservation after malformed/network failures, incidental capture, pre-0021 schemas, old frozen checkpoints and lost/partial-response reconciliation. `collections-awards-api.test.ts` covers strict four-operation requests, admin maintenance access, authenticated read-only History Metrics, typed states, obsolete identity exclusion and unchanged ordinary catalogue payloads. Merge, Silence and existing identity-repair suites protect receipt archival, independent evidence retention/discard and survivor preservation. Snapshot tests cover pre/post-migration copying. Existing title, score lifecycle and provider suites retain canonical authority and append-only provenance invariants.

`tests/p1-product-ui.test.ts` verifies two eight-card Admin groups and all seven independent operations. `enrichment-ui.test.ts` also rejects unsupported evidence schema. `corepack pnpm exec tsx tests/unified-admin.browser.mjs`, with UI-only Vite running, checks all eighteen maintenance cards plus Rotation at 320/390/720/951/1440px, aggregate confirmation, readable controls, overflow, Stop/Resume, partial failures and retained progress using synthetic API functions and blocked external/provider requests. Evidence stays ignored under `.verification/unified-admin/`.

Metrics presentation regression suites cover independent vote selections and persistence, the local Studios option and cutoff ties, count-only country bars, theme counts/ratios, equivalent diversity percentages, scoped economics identities/shared scale, the reusable complete glossary, and poster-backed alignment/Classics winner rows. The synthetic Metrics browser harness checks 320/390/720/951/1440px without production or provider access, including both desktop drawer modes for economics, glossary and tied Records rows. `BOOKCLUB_METRICS_PRESENTATION_ONLY=1` runs the focused presentation stress and recovery cases without repeating the baseline sweep.

## Metrics release refinement coverage

`collection-rosters.test.ts` uses disposable D1 and mocked TMDB for strict nonempty roster validation, canonical identity/deduplication, upcoming parts, two-film eligibility across contributors/repeats, completed/incomplete transitions, failure preservation, additive/older-schema compatibility, admin access, read-only projection, provider-call estimates, cooldown/quota, frozen queues and lost-response recovery. `metrics-release-refinement.test.ts` protects exact subtitles, independent axes, six-column star totals/pagination, scoped list density, paired gross type, classification treatment, stream union/Rent/Buy-only presentation, moved ranking scoring/ties/metadata and club-wide collection filtering.

`node tests/metrics-staging.browser.mjs` measures compact list rows and zero minimum link height, six-column table/pagination, touching bars, shared spread axes, expanded Top 5 row/index geometry, collection progress/links and single-line classifications at 320/390/720/951/1440px. It uses synthetic App/API data, blocks all external/provider traffic and stores screenshots/measurements privately under `.verification/metrics-staging/`. `collection-roster-ui.test.ts` covers the separate Admin controls, collection estimates, Stop/resume, lock, failures and cache invalidation. Opening Metrics or Admin never initiates roster provider work.

## Reporting and maintenance

Report exact commands/results, full-suite run or omission, blocked/skipped checks and manual checks still required. No passing claim for an unavailable environment. Keep this policy aligned with actual tests and fixtures. A skipped test is not a Priority 0.5 finding; that section requires an observed failure and evidence-based diagnosis. Documentation adoption itself does not require a Vitest run.

Score lifecycle regression coverage: `tests/score-lifecycle.test.ts` exercises the 0–6 live-dimension boundary, duplicates, invalid values, development demos, immediate retirement and disposable SQLite/shared-ranking equivalence. `tests/bulk-maintenance.test.ts` covers legacy-only live acquisition, negative checks and full Refresh reconsideration.

`tests/singin-repair.test.ts` uses disposable migrated D1 to verify guarded duplicate reconciliation, Cycle 34 preservation, Classics/seed/Seen/import/legacy-score retention, wrong-provider state discard, receipt evidence, identical reruns and race/unknown-relationship/conflict rejection.

`tests/silence-repair.test.ts` covers the exact guarded mismatch repair in place and into an existing survivor, reference/seed/legacy-evidence preservation, History Seen, wrong-provider cleanup, survivor cache retention, repeat safety and identity/History/score/roster races. Singin coverage also verifies the explicitly selected History Seen restoration option.

`tests/love-affair-repair.test.ts` covers the exact 1974-to-1939 mismatch in place and into a verified survivor, Classics/seed/Seen/reference and legacy-score preservation, wrong-provider cleanup, stale checks, unique identities, repeat safety and guarded race rejection. Candidate-only repair preserves Seen answers without inventing History; active History retains the all-Seen invariant.

`corepack pnpm exec tsx tests/home-history-refinement.browser.mjs` uses synthetic intercepted App/API fixtures and blocked external traffic at 320/390/720/951/1440px. It measures shared page headings, Home gutters/stat tracks, candidate metadata and help containment, responsive glossary column alignment, History heading/date order and cycle context, account dropdown/focus in both drawer states, and relevant Home/History/Classics/Detail/Seen overflow. Long titles/member/director names, absent directors, approximate dates and varied source counts remain production-independent. Evidence is ignored under `.verification/home-history-refinement/`.

`tests/compact-refinement.test.ts` protects conservative provider aliases and category deduplication, Buy suppression, compact hierarchy/count terminology, History-only inline badges, conditional search pagination, revision-aware Builder deletion and the simplified Seen states. `corepack pnpm exec tsx tests/builder-classics-seen.browser.mjs` exercises synthetic intercepted App/API fixtures at 320/390/720/951/1440px: Builder list/new/editor/search/delete/use, all Classics tabs, Seen active/completed/recent correction and pagination, and shared Home/History identities. It measures action/search geometry, tab typography, badge containment, candidate poster/count/Info alignment and overflow. External traffic is blocked; evidence stays in ignored `.verification/builder-classics-seen/`.

`tests/classics-first.test.ts` exercises migrated disposable D1 and a populated 0018→0019 upgrade: the five effective identities, first-event cycle anchor, immutable cycle flag, final-position reset/milestones, History order, unchanged past rows, Seen/film order, Builder revision/publication, stale/concurrent swaps, raced completion/deactivation and audit rollback. API and UI rotation tests protect administrator-only, mutually exclusive target forms and hostless Classics selection; Event tests protect first-position attestation and hosted final position. Earlier schemas fail closed for the new target while retaining ordinary human swaps.

`tests/admin-progress.test.ts` covers explicit interruption for score/OMDb/metadata/enrichment network, incomplete and blocking responses, retained fractions, nonblocking observations, voluntary Stop and new-run reset. `corepack pnpm exec tsx tests/admin-final.browser.mjs` renders real components with synthetic API functions and blocked external/Worker traffic at 320/390/720/951/1440px. It checks swap heading/targets/left alignment, the compatibility jobs’ normal/ruby painted progress pixels and accurate partial fractions, voluntary Stop/new-run reset, card borders and Home/flat Metrics exceptions across routes. Ignored evidence stays under `.verification/admin-final/`. Isolated local Wrangler migrations under that directory also verify native D1 parsing for fresh and populated upgraded databases, without touching normal local state or production.

`tests/journal-reconciliation.test.ts` uses the real Worker History edit response, request lease and App data controller with disposable migrated D1: Bicycle Thieves (canonical A) is replaced by Stalker (canonical B), testing Records mounted and opened after correction, retained catalogue records, other active appearances, deleted events, every identity filter, fresh loads and older in-flight catalogue results. Existing Metrics dashboard/performance tests retain all categories, canonical ties and invalidated asynchronous enrichment protection. `tests/seen-detail-integration.test.ts` also checks navigation count removal after the final answer, stability after a saved-answer correction, session/viewer and membership changes, and active-History exclusion.

`corepack pnpm exec tsx tests/mobile-corrections.browser.mjs` uses UI-only Vite, optional Playwright/Edge and blocked external/API traffic with synthetic data. It renders Home member/Classics turns at 320/360/375/390/430/720px (including measured preceding equal-column constraints), Score abbreviations at 320/360/390/719/720/1440px, expanded/collapsed desktop navigation at 720/951/1440px for 0/1/9/99/100/126 and a mounted Records before/after the real App data-controller journal replacement pathway. It checks visible columns, natural containment, standard single-line actions, accessible count text, badge/focus containment and current canonical Records links; screenshots and measurements remain ignored under `.verification/mobile-corrections/`. It makes no database or provider requests.


## Durable maintenance regression coverage

`maintenance-planning.test.ts` covers every card and both aggregate intents with 500/1,000/2,000-film fixtures, substantial pre-existing field/enrichment coverage and 250/500/1,000 eligible rosters. It compares exact planned units with the domain planner, enforces a 40-statement invocation budget, 100-bind ceiling and five compound SELECT terms, and exercises halfway recovery, lost responses, frozen additions, competing devices, failure rollback and zero planning provider calls. Tiny empty SQLite fixtures alone cannot verify production creation. The underlying Node SQLite default compound-SELECT limit differs from production D1; native D1 compatibility and read-only production SQL checks complement these enforced limits.

`maintenance-jobs.test.ts` uses disposable SQLite D1 fixtures and mocked providers for every film operation and both intents, first/middle/final poison records, roster isolation, bounded transport recovery, loss-of-response reconciliation, stop, cross-device lease races/expiry/fencing and strict legacy imports. Its 500-film/20-roster acceptance fixture verifies all safely executable work completes despite a poisoned film and collection without replay. `maintenance-job-api.test.ts` covers Admin authorization, tampered/oversized requests, read-only status and legacy writer exclusion. Existing MDBList/OMDb/provider suites protect reserve, omissions, failover and partial field coverage. `omdb-failover.test.ts` additionally covers premium-first ordering, all three tiers, independent cooldowns, earliest recovery, premium-only health/coverage and unchanged legacy two-key configurations.

Focused UI suites cover saved server status, interruption, Resume remaining, targeted Retry failed and completed-with-issues disclosure. `node tests/unified-admin.browser.mjs` uses an isolated synthetic intercepted backend with Playwright/Edge (paths overridable through BOOKCLUB_PLAYWRIGHT_MODULE/BOOKCLUB_BROWSER_PATH), checks all 18 field summaries, interrupted planning/reload/Resume planning with no provider dispatch, stop/reload/storage deletion, same job ID, issue retry, shared locks and horizontal containment at 320, 390, 720, 951 and 1440px, and writes ignored screenshots/measurements. No live provider or production catalogue is used.

Relocated report presentation corrections: focused suites also cover four canonical partnership roles with an independent retained selector and selected-role derivation; conventional integer financial ratios without rounded ranking; five-by-four mobile comparisons from the desktop cell evidence, with peer order and accessible unknowns; independent native collection disclosures and unchanged future/unknown-date partition; singular No tie and stacked creator winners. Browser checks use available content width at the 720px heatmap breakpoint, verify only the active layout is accessible, compact disclosure/provider spacing, shared 16px awards inset, and the measured first-five-genre scroll window in both drawer states. `metrics-staging-ui.test.ts` covers compact money, conservative Oscars extraction, twenty ordered poster-backed awards rows without pagination, unavailable scores and paired widths at 0/partial/100/unavailable, and rendered release-boundary transitions with a retained cache. `collection-rosters.test.ts` covers explicit date-only boundaries, unknown/invalid dates, repeated canonical appearances, future History evidence and pending rosters. Mixed-access/alias and case-insensitive original ad-provider exclusion fixtures in `metrics-staging.test.ts` complement disposable parser/persistence/catalogue coverage in `au-watch-offers.test.ts`. The relocated-report browser harness measures five actual awards rows, keyboard scrolling, transparent tracks and compact gross geometry at the existing five responsive widths. `metrics-performance.test.ts` spies on relocated calculations to prove inactive categories do no report work, retained results survive revisits, genuine catalogue changes invalidate them, and tab switches do not refetch enrichment. `tests/helpers/metrics-relocated-reports.ts` is a test-only isolated composition, not an application panel. Both Metrics browser harnesses use exactly four categories; the relocated harness measures all destination inventories and overflow in both desktop drawer modes. These are synthetic checks, not verification of live availability or production visuals.
