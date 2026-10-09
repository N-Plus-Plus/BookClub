<!--
AGENT MAINTENANCE INSTRUCTION

Keep this document minimal and operational.

Record only what a future agent needs to distinguish environments, run the application locally, preflight a release, and publish the supported public deployment.

Update it whenever:
1. local or public deployment paths, commands, hosts, bindings, release checks, credentials, or rollback behaviour change; or
2. other work reveals that this document no longer matches reality.

Do not duplicate architecture, integration, or data detail. Link to those documents where needed.
-->

# DEPLOYMENT.md

## Environments and local launch

| Environment | Entry / persistence |
| --- | --- |
| Local | http://localhost:4173/#/home; Worker localhost:8787/api/v1; independent local D1 |
| Import preview | Same ports; isolated preview config/state, never the production target |
| Public | https://bookclub.nissen.nexus (canonical after publication); https://bookclub-api.troy-nissen.workers.dev/api/v1; production D1 `bookclub-prod` via `DB` |

Requirements/topology: [ARCHITECTURE](ARCHITECTURE.md). Local data/snapshot safety: [DATA](DATA.md). Node 24 recommended; pinned pnpm 10.32.1.

Run:

`corepack pnpm install`

then:

`corepack pnpm dev`

Normal local startup applies local migrations/one-time seed and starts the frontend and local Worker. Ordinary local DB commands remain `--local --env local`; normal startup never reads or writes production.

Stop development before `corepack pnpm preview` because preview uses the same frontend port and the root `/` base.

## Operator credentials

Cloudflare deployment and production D1 operations require an authenticated operator context.

`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are operator credentials used by Wrangler/Node tooling. They must be available in the process/OS environment. They do not belong in `worker/.dev.vars.local`.

`worker/.dev.vars.local` is for local Worker runtime secrets such as provider credentials.

Never print, commit, paste into tracked files, or pass secret values directly on command lines.

Before a production release, verify Cloudflare access with a read-only command such as:

`corepack pnpm exec wrangler d1 info bookclub-prod --config worker/wrangler.jsonc --json`

## Production surfaces

A complete BookClub production release has three distinct runtime surfaces:

1. Production D1 schema
2. `bookclub-api` Worker/API
3. `bookclub-frontend` Worker Static Assets / Custom Domain

Pushing `main` alone updates none of these runtime surfaces.

Publishing the frontend Worker does not deploy the API Worker or migrate D1.

Deploying the API Worker does not migrate D1 or publish the frontend Worker.

Applying D1 migrations does not deploy application code.

These surfaces must be treated as one coordinated release when the user asks to fully deploy the current build.

## Meaning of deployment requests

### Full deployment

When the user explicitly asks to:

- `fully deploy`
- `fully deploy the current build`
- `fully deploy current main`
- `ship the current build`
- or otherwise clearly requests the complete production release

that authorises the agent, after a clean preflight, to perform the complete release sequence without requesting a second confirmation:

1. Commit the intended release changes.
2. Push the release commit to `main`.
3. Create a fresh verified production D1 backup when schema mutation is required.
4. Inspect the production migration ledger and pending tracked migrations.
5. Bring production D1 to the schema required by the release using the safe compatibility order described below.
6. Deploy and verify the production `bookclub-api` Worker.
7. LAST: explicitly deploy `bookclub-frontend` from the verified release build.
8. Perform the production smoke checks below.

A full deployment request authorises applying reviewed, tracked D1 migrations required by the release to the exact configured `bookclub-prod` database.

It does not authorise unrelated production data mutation, arbitrary SQL, imports, rotation changes, metadata enrichment, deletion/restoration of club records, or other live-data maintenance.

### Scoped deployment

More specific requests remain scoped:

- `deploy API` / `deploy bookclub-api` means API Worker only.
- `deploy frontend` / `publish frontend` means `bookclub-frontend` only.
- An unspecified `deploy Worker` request must identify which Worker before publication.
- `apply production migrations` means D1 schema only.
- `push to main` means source control only.

Explicit task limits always override the default full-deployment rule.

## Deployment preflight

Before any full production release:

1. Read `AGENTS.md`, this document, [DATA](DATA.md), [TESTING](TESTING.md), and relevant integration guidance.
2. Inspect `git status`, current branch, intended changes, and remote `main`.
3. Preserve unrelated work. Do not silently include unrelated files in the release commit.
4. Confirm `worker/wrangler.jsonc` still identifies the exact production Worker/D1 target.
5. Confirm operator Cloudflare and source-control authentication; inspect both Wrangler configurations.
6. Run the final local release checks:

   `corepack pnpm lint`

   `corepack pnpm test`

   `corepack pnpm typecheck`

   `corepack pnpm build`

   `corepack pnpm prod:check`

   `git diff --check`

7. Run frontend production preflight with `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID` present in the process environment:

   `corepack pnpm prod:check --frontend`

8. Build with the intended public frontend variables and check that output contains no localhost/import-preview configuration, private material, secrets, or archive data.
9. Resolve release-blocking failures before continuing.

All checks run in the operator environment before publication; no push-triggered release automation is supported.

`.github/workflows/quality.yml` automatically runs lint, type checking, tests, build and static production/frontend configuration checks on pull requests and pushes to main. It uses Node 24, Corepack and pinned pnpm, with fictional public frontend inputs, read-only repository permissions and no production secrets, provider credentials, database access or deployment step. Passing CI does not authorise publication.

## Commit and push

A full deployment starts by making the intended source state durable.

Commit only the intended release changes to `main`, preserving unrelated work, then push `main`.

Confirm the pushed remote commit is the commit being released before any production schema mutation.

Do not mutate production first and commit later.

## Production D1 backup

Before applying any pending production migration, create a fresh production export.

Use a timestamped ignored path under `.verification/`, for example:

`.verification/production-deploy/backups/production-<timestamp>.sql`

Create the export with:

`corepack pnpm exec wrangler d1 export bookclub-prod --config worker/wrangler.jsonc --remote --output <timestamped-backup-path>`

Verify that:

- the command succeeded;
- the backup file exists and is non-empty;
- the source identity is the configured `bookclub-prod`;
- the backup was created immediately before the migration operation.

Do not rely on an older backup merely because one exists.

Production exports are safety evidence, not tracked repository files.

## Production migration ledger

Before Worker deployment, inspect the remote migration ledger:

`corepack pnpm exec wrangler d1 migrations list bookclub-prod --config worker/wrangler.jsonc --remote`

Compare pending migrations with the current source under `worker/migrations/`.

Do not hard-code an expected migration number in this document. Current source and remote state are authoritative.

Tracked migrations must remain contiguous and must be applied in their defined order.

## Schema and Worker compatibility gate

Ordinary local startup and import-preview preparation apply all current migrations. Releases still support the explicit 0009 bridge and additive cache/title transitions below; this is a supported rolling-upgrade contract, not permission to omit migrations from a current local environment. Director/enrichment probes in `SchemaCapabilities`, rotation-column checks and title-authority checks remain necessary until that bridge contract is deliberately retired. Dedicated routes fail with the documented schema-upgrade error before provider calls when their required migration is missing. CI exercises migrated disposable databases and these supported bridge states; it does not verify the production ledger.

Before changing production schema, inspect every pending migration together with:

- the currently deployed Worker assumptions; and
- the new Worker code being released.

Choose an order that keeps production coherent throughout the release.

### Additive/backward-compatible migrations

Migration `0016_provider_enrichment.sql` adds only provider-cache tables and analytical indexes, preserving existing movie, score and product tables. Old Workers ignore the new tables. New ordinary metadata/score paths capability-detect the cache and continue without it on older schemas; the dedicated enrichment route fails safely before provider calls until 0016 exists. Apply additive 0016 after the normal fresh backup and compatibility gates, deploy the API, then publish the frontend controls. Existing 0010–0013 bridge gates still apply when upgrading an older database. No provider crawl runs automatically after migration/deployment. The guarded local snapshot copier permits precisely these ten destination-only cache tables when copying a pre-0016 source; unknown source tables/columns still fail closed. This compatibility change performs no production refresh itself.

Migration `0017_canonical_title.sql` adds title authority with fallback classification and an insert trigger; it changes no existing title. Old Workers ignore the new column. Apply schema before the new Worker, then frontend. The new title endpoints require 0017; ordinary provider cache/title writes capability-detect older schemas. Run the explicit admin cached reconciliation after deployment to apply existing evidence without quota, then operator-selected independent provider jobs. No crawl runs during migration or deployment.

Migration `0018_au_watch_offers.sql` deletes only derived watch rows with NULL/non-AU country; no tables or canonical evidence change. New Worker reads and writes safely on pre-0018 databases with 0016 cache tables, filtering exact AU. Older Workers remain structurally compatible but may repopulate regionless rows: deploy the new AU-filtering API Worker first, then apply ordered 0018 after the normal fresh backup, verify the cache invariant, and publish the frontend last. Keep all earlier bridge/cache/title gates. Older Workers omitting the optional projection remain frontend-compatible. No provider request or automatic enrichment runs as part of migration/release.

Migration `0019_classics_first.sql` adds binary rotation/cycle flags and replaces only rotation/publication guards; existing data defaults to ordinary order. Release the bridge-compatible new API Worker first (Classics swaps fail with SCHEMA_UPGRADE_REQUIRED on older schemas), then apply ordered 0019 after the normal fresh backup/schema checks, then publish the frontend last. Retain earlier migration gates. The old Worker can handle untouched ordinary cycles but must not run once a Classics-first exchange is enabled: it cannot resolve the exceptional identity. Do not roll back to that Worker while an exceptional cycle is active or retained historical exceptional cycles require editing. No rotation exchange or event creation runs as part of migration/deployment.

If pending migrations only add schema or otherwise remain compatible with the currently deployed Worker, the normal order is:

1. backup;
2. apply migrations;
3. verify schema;
4. deploy Worker.

Migration `0015_drop_redundant_score_index.sql` removes only the explicit score lookup index; the UNIQUE identity index covers current queries. It rewrites/deletes no source rows or constraints. Both old and new Workers operate before or after this migration, so schema-first is safe. Negative-only score-check persistence uses the existing 0013 table and tolerates legacy positives; it requires an API Worker deployment but no frontend deployment or positive-row cleanup. Both the schema migration and API deployment are needed for the complete write reduction. Other pending migrations retain their own compatibility gates.

### Destructive or compatibility-sensitive migrations

If a migration drops, renames, constrains, or materially changes schema used by either the old or new Worker, do not blindly apply migrations first or deploy the Worker first.

Determine whether one of these is explicitly safe:

- new Worker is compatible with both old and new schema, allowing Worker-first;
- old Worker is compatible with both old and new schema, allowing schema-first;
- the repository provides an intentional bridge/staged migration sequence.

If no safe sequence exists, stop before production mutation and report the release blocker. A full-deployment request authorises the release, but it does not authorise guessing through an unsafe schema/application transition.

The current Worker supports both schema 0009 and 0012. For the 0010–0012 transition, deploy the bridge-compatible current Worker first and verify health, create a fresh verified production export, then apply the unchanged ordered migrations. Redeploy the same release Worker after migration and verify health before deploying the frontend Worker. Director detection is request-scoped; missing director reads as null and missing human_order means unswapped rotation. Turn swaps fail safely until 0011 exists.

Migration 0013 only adds `movie_score_checks` and is compatible with the previously deployed Worker. Once the database is at 0012, a future authorised release applies 0013 after a fresh backup and schema verification, then deploys the new Worker, then deploys the frontend Worker. The new score-maintenance routes require 0013; do not publish the new frontend before its Worker. If upgrading from 0009, retain the separate 0010–0012 bridge sequence above before this additive step.

Migration `0014_session_movie_lookup.sql` only adds a reverse History covering index; old and new Workers safely ignore its absence/presence for correctness. For a future authorised release, retain the 0010–0013 schema gates above, back up and apply additive 0014, deploy the Worker with `/catalog/compact`, then publish the frontend Worker. Older frontends retain `/catalog`; new frontends fall back to it when an older Worker returns 404/405/501 for the compact route. No score rows are rewritten or deleted.

Where practical, migrations should be designed so future releases have a clear compatible sequence.

## Unified Admin rollout

Migration 0020 is additive and compatible with the previous Worker. A future authorised release requires a fresh verified backup, additive migration 0020, the Worker exposing maintenance-coverage/maintenance-provider, then the frontend last. Existing metadata/score/enrichment routes remain compatible; the new UI does not substitute an older general crawl if coverage or the coordinated route is absent. Older snapshot exports may omit the two new tables and leave local coverage empty. Migration 0019 retains its separate existing gate and is unchanged. This local implementation does not authorise production migration, provider verification, deployment, commit or push.

## Collections and awards rollout

Migration `0021_collections_awards.sql` adds two successful-evidence tables and a separate failure-observation table, leaving 0020's operation constraint and all historical records unchanged. The prior Worker ignores them. For a future authorised release: fresh verified backup and existing compatibility gates, additive 0021 schema first, matching API Worker, frontend last. Ordinary metadata/score/enrichment capture capability-detects pre-0021 schemas and continues without new evidence; Metrics retains its older projection. Requests explicitly selecting collections/awards fail before upstream calls without 0021. The new Admin disables maintenance if matching evidence coverage/schema support is absent. Old five-operation requests and frozen v1 checkpoints remain compatible; resuming old aggregate progress never expands its stored operation scope. No crawl, provider call, local snapshot refresh or production mutation runs as part of migration or deployment. Snapshot copying permits the three new destination-only tables when the source predates 0021. Earlier bridge/cache/title/rotation gates remain unchanged.

## Aggregate Admin release

The two-phase aggregate coordinator and shared field-summary UI require the existing 0022/0023 schema and matching film/collection APIs; this change adds no migration. Inspect the ledger and retain all pending migration gates, deploy and verify the API, then explicitly publish the frontend last. Old v1 checkpoints retain their frozen film-only scope; new aggregate runs include rosters. Publication never starts provider maintenance.

## Applying production migrations

Migration `0023_maintenance_fields.sql` is additive/idempotent and leaves existing provider evidence untouched. After clean preflight and commit/push verification, inspect the ledger, create a fresh verified export, apply schema first, verify it, deploy/smoke the API, and publish the frontend last. The old Worker ignores the new table. Ordinary provider capture remains capability-aware on older schemas; current unified field-aware execution and Admin controls require 0023 before provider work. Legacy field interpretation is read-only; uncertain gaps become eligible only for explicit administrator-initiated Populate. Do not backfill, Populate, Refresh or reconcile identities during release. Retain all earlier compatibility gates.


Migration `0022_collection_rosters.sql` is additive and compatible with the prior Worker. After clean preflight and the committed/pushed source check, inspect the ledger, create a fresh verified production export, apply 0022 schema first, verify schema, deploy and smoke the API, then explicitly publish the frontend last. Older schemas omit roster projection while ordinary film maintenance remains usable; dedicated collection maintenance fails before provider calls until 0022 exists. Do not run Populate, Refresh or roster backfill during release. The empty cache is healthy: Metrics reports pending membership evidence until an administrator explicitly selects Populate missing collection rosters.

After the fresh backup and compatibility gate are complete, apply the tracked pending migrations to the exact production database:

`corepack pnpm exec wrangler d1 migrations apply bookclub-prod --config worker/wrangler.jsonc --remote`

Do not use the local environment or import-preview configuration for production migration.

After migration, run:

`corepack pnpm exec wrangler d1 migrations list bookclub-prod --config worker/wrangler.jsonc --remote`

Confirm the intended release has no unexpected pending migrations.

If migration output is ambiguous or reports failure, stop. Do not automatically retry a potentially partially-completed production mutation. Inspect the resulting immutable state and follow [DATA](DATA.md).

Journal mutation reconciliation requires the JournalMutationResult API responses; deploy the matching Worker before this frontend. No migration is needed. The previous frontend callbacks ignore the mutation body and retain their broad refresh, so Worker-first rollout preserves those workflows.

OMDb metadata idempotency requires the API Worker; browser-local resume requires the frontend. Release both for the complete behaviour, with Worker first under the normal schema/API compatibility gates. This feature requires no schema migration; independently pending migrations retain their own release gates.

## Deploying the production API Worker

The top-level `worker/wrangler.jsonc` is the production configuration:

- `APP_ENV=production`
- local bypass disabled
- exactly both temporary cutover origins: `https://n-plus-plus.github.io` and `https://bookclub.nissen.nexus`
- production D1 binding `DB`

Deploy the current Worker with:

`corepack pnpm exec wrangler deploy --config worker/wrangler.jsonc`

Never deploy `--env local` or the retired import-preview/import runner as production.

A successful push to `main` does not deploy the Worker.

After deployment, verify the Worker reports the intended production environment and expected authentication configuration.

Workers Logs are enabled in the production configuration with full sampling (`observability.enabled=true`, `head_sampling_rate=1`). Invocation logging is enabled by default; traces are not enabled.

When diagnosing Worker failures, inspect:

**Workers & Pages -> bookclub-api -> Observability**

The request wrapper logs unexpected internal exceptions before returning its generic 500. Expected validation, authentication and provider failures are not logged as internal exceptions.

## API Worker runtime configuration

Public/runtime configuration must remain separate from source control.

Public frontend process variables at build time:

- `VITE_API_BASE_URL` - Worker origin, without `/api/v1`
- `VITE_GOOGLE_CLIENT_ID`

Worker runtime configuration must use the matching Google client ID where required.

Optional provider secrets include:

- `TMDB_READ_TOKEN`
- `MDBLIST_API_KEY`
- `OMDB_API_KEY` (primary)
- `OMDB_API_KEY_SECONDARY` (optional bounded failover)

Use supported Cloudflare secret mechanisms such as interactive `wrangler secret put` or stdin bulk mechanisms. Never put secret values in tracked files or command-line arguments.

OMDb failover requires only an API Worker deployment and the desired Worker secret bindings; no frontend deployment, D1 migration or cooldown cleanup is required. Both keys remain Worker-only secrets; no OMDb username is needed. Local development uses the ignored `worker/.dev.vars.local` mechanism.

[INTEGRATIONS](INTEGRATIONS.md) owns provider/configuration detail.

## Publishing the static frontend (final release step)

`wrangler.frontend.jsonc` defines the assets-only `bookclub-frontend` Worker, `./dist`, SPA fallback and exact Custom Domain `bookclub.nissen.nexus`. It disables workers.dev and preview URLs and has no runtime script or bindings. Build and deploy are separate operations. Normal `corepack pnpm build` prepares cached lightweight artwork into `generated/public/` before Vite copies it into `dist/`; high-resolution `assets/source/` is excluded. A fresh clone/cache works automatically. See [artwork generation](ARCHITECTURE.md#local-artwork-generation).

In PowerShell, set the public build inputs (the client ID must be the existing Web Application client matching Worker `GOOGLE_CLIENT_ID`):

```powershell
$env:VITE_API_BASE_URL = 'https://bookclub-api.troy-nissen.workers.dev'
$env:VITE_GOOGLE_CLIENT_ID = '<existing-web-application-client-id>.apps.googleusercontent.com'
corepack pnpm prod:check --frontend
corepack pnpm build
```

Inspect `dist/index.html` for root `/assets/` references, and inspect generated output for private material or local configuration. Validate packaging without publication:

```text
corepack pnpm exec wrangler deploy --dry-run --config wrangler.frontend.jsonc
corepack pnpm exec wrangler deploy --dry-run --config worker/wrangler.jsonc
```

After the release source is committed/pushed and any required D1 migration and API deployment/verification are complete, LAST publish the already-verified build:

`corepack pnpm exec wrangler deploy --config wrangler.frontend.jsonc`

Equivalent package command: `corepack pnpm deploy:frontend`. This command does not build. Do not publish stale `dist/`; rebuild/recheck if source or build variables changed after preflight. Record the release commit, build inputs and frontend deployment output.

### Human cutover prerequisites and rollback

The operator must own the active Cloudflare `nissen.nexus` zone in the target account. Inspect the hostname for conflicting DNS records or existing Worker ownership before first deployment; an existing CNAME prevents Custom Domain creation. Resolve conflicts deliberately, outside repository preparation. Do not create a placeholder DNS record: Wrangler Custom Domain deployment creates the domain association, managed DNS record and certificate automatically. Wait for the domain and certificate to become active and verify HTTPS before smoke testing. See [Cloudflare Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

Use an operator token with Workers product-level Admin for first-time Worker creation; subsequent deployment needs Workers Editor at product scope (Custom Domains currently do not support per-Worker roles). Also grant Zone > Workers Routes > Write and Zone Read scoped to `nissen.nexus` for domain management/discovery. Legacy Workers Scripts Edit and Workers Routes Edit tokens remain supported; verify the creation permission before first publication. Scope to the intended account/zone; D1 release operations require their own D1 permissions. See [Workers permissions](https://developers.cloudflare.com/workers/authorization/workers/). No Cloudflare credentials belong in GitHub Actions, source or the frontend build. Do not enable Cloudflare Workers Builds or another push-triggered deployment integration.

Before publication, add `https://bookclub.nissen.nexus` to the existing Google Web Application client's Authorised JavaScript origins and retain `https://n-plus-plus.github.io`. No redirect URI is required by the current GIS credential callback implementation; keep both frontend/Worker client IDs unchanged. Google and Cloudflare dashboard state are human prerequisites, not certified by static preflight.

After publication `https://bookclub.nissen.nexus` is canonical. The existing GitHub Pages deployment may remain online temporarily as rollback; its publisher is retired and the repo no longer maintains that deployment. API CORS and Google origins temporarily support both hosts. Sessions in browser localStorage are origin-specific, so users must sign in on the new host. Later unpublishing Pages and removing its CORS/Google origin are deliberate cleanup, outside this cutover preparation.

Reverting source or pushing main does not roll back deployed assets. Frontend recovery requires an explicit compatible known-good build/deployment or deliberate use of the already-published Pages site. Confirm API/schema compatibility before selecting either. Preserve the database recovery gates below.

## Full deployment sequence

Unless the compatibility gate requires a specifically different safe schema/Worker order, a normal full deployment proceeds as follows:

1. Inspect current state and intended release.
2. Run complete local preflight.
3. Commit intended changes to `main`.
4. Push `main`.
5. Confirm remote `main` matches the release commit.
6. Verify Cloudflare production identity.
7. Create and verify a fresh production D1 export if schema mutation is required.
8. Inspect pending production migrations.
9. Inspect migration/old-Worker/new-Worker compatibility.
10. Apply required production migrations in the safe release order.
11. Verify the migration ledger.
12. Deploy the current `bookclub-api` Worker.
13. Verify production Worker health.
14. LAST: explicitly deploy the verified `dist/` using `wrangler.frontend.jsonc`.
15. Verify the frontend Custom Domain and certificate are active.
16. Perform the production smoke checks below.
17. Report the released commit, migration result, Worker result, frontend deployment result, smoke result, and any remaining issue.

No second confirmation is required after a clean preflight when the user explicitly requested a full deployment.

## Production smoke check

After the full release, verify the runtime surfaces rather than assuming successful commands imply a healthy application.

### Worker/API

Check production health and confirm:

- environment is production;
- authentication is required;
- expected Google/provider configuration is present where health exposes it;
- private reads and unauthenticated mutations return 401;
- nonexistent bearer/session credentials fail safely;
- intended-origin preflight succeeds;
- arbitrary origin is rejected.

These checks must not create a new club session/event or otherwise mutate club history.

### Static frontend

Check `https://bookclub.nissen.nexus/`:

- shell loads;
- JS and CSS load;
- fonts load;
- avatars `0` through `19` and reserved `a.png` load;
- icons render;
- hash routes work;
- refresh/navigation does not break routing;
- frontend reaches the production Worker;
- no localhost/import-preview URLs are present;
- no mixed-content/runtime errors appear;
- mobile sign-in does not overflow.

### Authenticated owner smoke

Where owner credentials are available and the release warrants it, verify representative authenticated behaviour including:

- identity;
- avatar exclusivity;
- Home;
- History;
- Metrics;
- Classics;
- Builder ownership.

Use separate profiles when multi-user behaviour is being checked.

Any disposable Builder mutation must remain explicitly within owner smoke scope.

Do not publish an event, advance rotation, import data, enrich metadata, alter Seen state, or otherwise mutate durable club state merely to test deployment.

Read current production state rather than assuming an older bootstrap rotation or cycle is still current.

## Failure handling

A failed release step does not authorise blindly continuing to later steps.

Examples:

- failed local preflight: fix before production work;
- failed/ambiguous migration: stop and inspect schema state;
- failed Worker deployment: establish whether the old or new Worker is currently live before proceeding;
- unhealthy Worker after migration: do not publish a frontend that depends on the unhealthy API;
- failed frontend publication: inspect which assets are live and deploy only a verified compatible build.

Report the exact completed and incomplete release surfaces.

## Recovery

No general automated application/database rollback is established.

Preserve:

- fresh production exports;
- migration evidence;
- release commit SHA;
- Worker deployment output;
- frontend deployment output and build identity.

A failed or ambiguous production data/schema operation stops for read-only inspection under [DATA](DATA.md).

Do not reset live identity or rotation, replay bootstrap/import operations, or perform arbitrary compensating SQL.

Local snapshot replacement has its own guarded retained-state recovery and is separate from production deployment.

Source-control and platform histories record releases. This document is operational guidance, not a release diary.
