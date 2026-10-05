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
| Public | https://n-plus-plus.github.io/BookClub/; https://bookclub-api.troy-nissen.workers.dev/api/v1; production D1 `bookclub-prod` via `DB` |

Requirements/topology: [ARCHITECTURE](ARCHITECTURE.md). Local data/snapshot safety: [DATA](DATA.md). Node 24 recommended; pinned pnpm 10.32.1.

Run:

`corepack pnpm install`

then:

`corepack pnpm dev`

Normal local startup applies local migrations/one-time seed and starts the frontend and local Worker. Ordinary local DB commands remain `--local --env local`; normal startup never reads or writes production.

Stop development before `corepack pnpm preview` because preview uses the same frontend port and the production `/BookClub/` base.

## Operator credentials

Cloudflare deployment and production D1 operations require an authenticated operator context.

`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are operator credentials used by Wrangler/Node tooling. They must be available in the process/OS environment. They do not belong in `worker/.dev.vars.local`.

`worker/.dev.vars.local` is for local Worker runtime secrets such as provider credentials.

Never print, commit, paste into tracked files, or pass secret values directly on command lines.

Before a production release, verify Cloudflare access with a read-only command such as:

`corepack pnpm exec wrangler d1 info bookclub-prod --config worker/wrangler.jsonc --json`

GitHub Pages CLI publication requires an authenticated GitHub CLI session:

`gh auth status`

## Production surfaces

A complete BookClub production release has three distinct runtime surfaces:

1. Production D1 schema
2. Cloudflare Worker/API
3. GitHub Pages frontend

Pushing `main` alone updates none of these runtime surfaces.

Publishing Pages does not deploy the Worker or migrate D1.

Deploying the Worker does not migrate D1 or publish Pages.

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
3. Create a fresh verified production D1 backup.
4. Inspect the production migration ledger and pending tracked migrations.
5. Bring production D1 to the schema required by the release using the safe compatibility order described below.
6. Deploy the current production Cloudflare Worker.
7. Dispatch a new GitHub Pages workflow for the release commit and monitor it to completion.
8. Perform the production smoke checks below.

A full deployment request authorises applying reviewed, tracked D1 migrations required by the release to the exact configured `bookclub-prod` database.

It does not authorise unrelated production data mutation, arbitrary SQL, imports, rotation changes, metadata enrichment, deletion/restoration of club records, or other live-data maintenance.

### Scoped deployment

More specific requests remain scoped:

- `publish Pages` means Pages only.
- `deploy the Worker` means Worker only.
- `apply production migrations` means D1 schema only.
- `push to main` means source control only.

Explicit task limits always override the default full-deployment rule.

## Deployment preflight

Before any full production release:

1. Read `AGENTS.md`, this document, [DATA](DATA.md), [TESTING](TESTING.md), and relevant integration guidance.
2. Inspect `git status`, current branch, intended changes, and remote `main`.
3. Preserve unrelated work. Do not silently include unrelated files in the release commit.
4. Confirm `worker/wrangler.jsonc` still identifies the exact production Worker/D1 target.
5. Confirm Cloudflare and GitHub authentication.
6. Run the final local release checks:

   `corepack pnpm test`

   `corepack pnpm typecheck`

   `corepack pnpm build`

   `corepack pnpm prod:check`

   `git diff --check`

7. Run frontend production preflight with `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID` present in the process environment:

   `corepack pnpm prod:check --frontend`

8. Build with the intended public frontend variables and check that output contains no localhost/import-preview configuration, private material, secrets, or archive data.
9. Resolve release-blocking failures before continuing.

GitHub Pages CI runs its own tests, typecheck, frontend preflight and build again before publication.

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

Before changing production schema, inspect every pending migration together with:

- the currently deployed Worker assumptions; and
- the new Worker code being released.

Choose an order that keeps production coherent throughout the release.

### Additive/backward-compatible migrations

If pending migrations only add schema or otherwise remain compatible with the currently deployed Worker, the normal order is:

1. backup;
2. apply migrations;
3. verify schema;
4. deploy Worker.

### Destructive or compatibility-sensitive migrations

If a migration drops, renames, constrains, or materially changes schema used by either the old or new Worker, do not blindly apply migrations first or deploy the Worker first.

Determine whether one of these is explicitly safe:

- new Worker is compatible with both old and new schema, allowing Worker-first;
- old Worker is compatible with both old and new schema, allowing schema-first;
- the repository provides an intentional bridge/staged migration sequence.

If no safe sequence exists, stop before production mutation and report the release blocker. A full-deployment request authorises the release, but it does not authorise guessing through an unsafe schema/application transition.

The current Worker supports both schema 0009 and 0012. For the 0010–0012 transition, deploy the bridge-compatible current Worker first and verify health, create a fresh verified production export, then apply the unchanged ordered migrations. Redeploy the same release Worker after migration and verify health before dispatching Pages. Director detection is request-scoped; missing director reads as null and missing human_order means unswapped rotation. Turn swaps fail safely until 0011 exists.

Where practical, migrations should be designed so future releases have a clear compatible sequence.

## Applying production migrations

After the fresh backup and compatibility gate are complete, apply the tracked pending migrations to the exact production database:

`corepack pnpm exec wrangler d1 migrations apply bookclub-prod --config worker/wrangler.jsonc --remote`

Do not use the local environment or import-preview configuration for production migration.

After migration, run:

`corepack pnpm exec wrangler d1 migrations list bookclub-prod --config worker/wrangler.jsonc --remote`

Confirm the intended release has no unexpected pending migrations.

If migration output is ambiguous or reports failure, stop. Do not automatically retry a potentially partially-completed production mutation. Inspect the resulting immutable state and follow [DATA](DATA.md).

## Deploying the production Worker

The top-level `worker/wrangler.jsonc` is the production configuration:

- `APP_ENV=production`
- local bypass disabled
- exact Pages origin
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

## Worker runtime configuration

Public/runtime configuration must remain separate from source control.

Public frontend Actions variables:

- `VITE_API_BASE_URL` - Worker origin, without `/api/v1`
- `VITE_GOOGLE_CLIENT_ID`

Worker runtime configuration must use the matching Google client ID where required.

Optional provider secrets include:

- `TMDB_READ_TOKEN`
- `MDBLIST_API_KEY`
- `OMDB_API_KEY`

Use supported Cloudflare secret mechanisms such as interactive `wrangler secret put` or stdin bulk mechanisms. Never put secret values in tracked files or command-line arguments.

[INTEGRATIONS](INTEGRATIONS.md) owns provider/configuration detail.

## Publishing GitHub Pages

Pages source is GitHub Actions.

The workflow is:

`.github/workflows/pages.yml`

named:

**Publish frontend to GitHub Pages**

It uses `workflow_dispatch`. Pushing `main` alone does not publish Pages.

A new Pages deployment can be started either:

1. through GitHub Actions using **Run workflow** with `main` selected; or
2. from an authenticated GitHub CLI / Codex session.

For CLI publication:

1. Verify authentication:

   `gh auth status`

2. Confirm the intended release commit has already been pushed to `main`.

3. Trigger a new workflow dispatch:

   `gh workflow run pages.yml --ref main`

4. Identify the newly-created run if necessary:

   `gh run list --workflow pages.yml --limit 5`

5. Match the run to the intended release commit/dispatch time.

6. Monitor it to completion:

   `gh run watch <run-id>`

Do not use `gh run rerun` or GitHub's **Re-run** action as the normal publication path. Re-running an old workflow can publish an older commit.

If a Pages workflow fails because the release source itself is defective, fix the source, commit and push the fix, then create a new workflow dispatch for the new `main`.

The Pages workflow performs its own:

- test suite;
- typecheck;
- production frontend preflight;
- build;
- Pages artifact upload;
- publication.

It does not deploy the Worker or migrate D1.

## Full deployment sequence

Unless the compatibility gate requires a specifically different safe schema/Worker order, a normal full deployment proceeds as follows:

1. Inspect current state and intended release.
2. Run complete local preflight.
3. Commit intended changes to `main`.
4. Push `main`.
5. Confirm remote `main` matches the release commit.
6. Verify Cloudflare production identity.
7. Create and verify a fresh production D1 export.
8. Inspect pending production migrations.
9. Inspect migration/old-Worker/new-Worker compatibility.
10. Apply required production migrations in the safe release order.
11. Verify the migration ledger.
12. Deploy the current Cloudflare Worker.
13. Verify production Worker health.
14. Dispatch a new GitHub Pages workflow from current `main`.
15. Monitor the Pages workflow to successful completion.
16. Perform the production smoke checks below.
17. Report the released commit, migration result, Worker result, Pages run/result, smoke result, and any remaining issue.

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

### Pages

Check the public Pages application:

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
- failed Pages workflow: do not re-run an older workflow run as a shortcut.

Report the exact completed and incomplete release surfaces.

## Recovery

No general automated application/database rollback is established.

Preserve:

- fresh production exports;
- migration evidence;
- release commit SHA;
- Worker deployment output;
- Pages workflow/run identity.

A failed or ambiguous production data/schema operation stops for read-only inspection under [DATA](DATA.md).

Do not reset live identity or rotation, replay bootstrap/import operations, or perform arbitrary compensating SQL.

Local snapshot replacement has its own guarded retained-state recovery and is separate from production deployment.

Source-control and platform histories record releases. This document is operational guidance, not a release diary.