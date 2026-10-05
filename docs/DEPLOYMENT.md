<!--
AGENT MAINTENANCE INSTRUCTION

Keep this document minimal and operational.

Record only what a future agent needs to distinguish environments, run the application locally, preflight a release, and publish the supported public deployment.

Update it whenever:
1. local or public deployment paths, commands, hosts, bindings, release checks, or rollback behaviour change; or
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

Requirements/topology: [ARCHITECTURE](ARCHITECTURE.md). Local data/snapshot safety: [DATA](DATA.md). Node 24 recommended; pinned pnpm 10.32.1. Run `corepack pnpm install`, then `corepack pnpm dev` (local migrations/one-time seed followed by both services). No cloud/provider credentials required. Ordinary DB commands remain `--local --env local`; normal startup never reads production. Stop development before `corepack pnpm preview` (same 4173, production `/BookClub/` base).

## Public deployment path

Required: Cloudflare operator access to Worker/D1 and GitHub access to main/Actions/Pages. Top-level `worker/wrangler.jsonc` is production (`APP_ENV=production`, bypass false, exact Pages origin); never deploy `--env local` or the retired import runner.

Public frontend variables: Actions `VITE_API_BASE_URL` (Worker origin, no `/api/v1`) and `VITE_GOOGLE_CLIENT_ID`; match Worker `GOOGLE_CLIENT_ID`. Runtime optional secrets: `TMDB_READ_TOKEN`, `MDBLIST_API_KEY`, `OMDB_API_KEY`. Supply through supported interactive `wrangler secret put` or stdin bulk mechanisms, never command-line values/tracked files. [INTEGRATIONS](INTEGRATIONS.md) owns configuration detail.

Worker: `corepack pnpm exec wrangler deploy --config worker/wrangler.jsonc`. Frontend: manually dispatch **Publish frontend to GitHub Pages** (`.github/workflows/pages.yml`) on reviewed main; workflow tests/types/preflights/builds and publishes `dist/` only. It does not deploy Worker or migrate D1. Pages source is GitHub Actions.

## Deployment preflight

Confirm intended target/changes, config/bindings, no release blocker, documentation accuracy and [TESTING](TESTING.md) scope. Release checks: `corepack pnpm test` (one final local suite), `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm prod:check`, `git diff --check`. Run `corepack pnpm prod:check --frontend` with both public values in process environment; it does not read ignored env files or access Cloudflare. Build separately with configured public env; inspect for localhost/import-preview, private emails, secrets/archive material. CI also runs its own full suite.

Verify remote migration ledger before new-column Worker deployment. Source includes 0009; prior deployment records report through 0008. Pending migration/production data mutation requires separate authorised scope and verified export backup; it is not implicit in ordinary application publication. See [DATA](DATA.md) and the guarded [operator guide](../scripts/import/PRODUCTION.md); do not replay initial bootstrap for a live app.

## Default publish rule

When the current task explicitly requests deployment/release/publish/ship and preflight is clean:

1. Commit intended release changes to `main`, preserving unrelated work.
2. Push `main` if required by publication.
3. Deploy the Worker and/or publish Pages through the path above, as scoped.
4. Perform production smoke below.

No second confirmation is required for that clean release workflow. Explicit task limits override it. Unrelated development does not authorise commit, push or deployment, and publication does not authorise destructive/live-data operations.

## Production smoke check

Check public health: production, authentication required, expected Google/provider presence. Private reads and unauthenticated mutations must return 401; nonexistent bearer must fail session lookup. Intended-origin preflight succeeds; arbitrary origin rejects. These checks need no new session/event.

Check Pages shell/JS/CSS/fonts/avatars 0–19 and reserved a.png, icons, hash-route refresh and Worker health; inspect mobile sign-in without overflow/runtime errors/mixed content. Real login/Google origin settings require owner access. Existing records report owner login success; multi-user smoke has not been signed off in those records.

For authorised owner smoke: use separate profiles for two members, verify identities/avatar exclusivity, Home/History/Metrics/Classics and Builder ownership. Any disposable Builder mutation must remain explicitly within owner smoke scope; never publish an event, advance rotation, import or enrich merely to test deployment. Read current turn rather than assuming the old bootstrap rotation is still live.

## Recovery

No general automated app/database rollback is established. Preserve verified production exports/proofs; a failed/ambiguous data operation stops for read-only inspection under [DATA](DATA.md). Do not reset live identity/rotation or blindly replay cutover. Local snapshot replacement has its own guarded retained-state recovery. Platform/source-control history records releases; this document is not a release diary.
