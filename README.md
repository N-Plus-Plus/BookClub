# BookClub

A mobile-first private film journal for a four-person weekly club. Repository: [N-Plus-Plus/BookClub](https://github.com/N-Plus-Plus/BookClub).

## Status and purpose

The canonical frontend after publication is [BookClub](https://bookclub.nissen.nexus), served by the static-only `bookclub-frontend` Cloudflare Worker, with a separate API Worker. Historical club data has been imported; local demo fixtures are fictional. This repository contains the current application and independent local development environment. Local schema and hosted schema must be checked separately before release.

Home shows the explicit current turn. History records ordered films, actual hosts, cycles and date precision, with editing, audit and recoverable deletion. Builder saves private sets visible only to their owner and publishes them into shared History. Classics calculates Watch Order from six stored rating dimensions (IMDb, RT audience, RT critic, Letterboxd, Metacritic and TMDB) and Seen answers. Available ratings are normalised to /100; missing dimensions use their arithmetic mean during ranking only. At least one real rating is required. Six effective squared scores are summed, then the explicit-No novelty multiplier and deterministic tie-break are applied. Seen It? collects Yes/No/Unknown answers. All Time Metrics compares active History appearances, hosts, genres and IMDb coverage.

## Requirements and setup

Use Node >=22.12 (Node 24 recommended), Corepack and pinned pnpm 10.32.1. Node 24 is required for production-snapshot refresh; see [architecture](docs/ARCHITECTURE.md) for test/runtime details. No Cloudflare account, Google login or provider credentials are required for ordinary local demo development.

```sh
corepack pnpm install
corepack pnpm dev
```

Open **http://localhost:4173/#/home**. The API is **http://localhost:8787/api/v1**. Use localhost to match CORS. Startup applies local migrations, seeds once and starts both servers; it preserves saved work. The local landing screen offers **Log in as Troy**, using the existing second member record and its stored avatar/role. A missing avatar enters the normal avatar chooser; production retains Google sign-in. Ctrl+C stops them. Do not run competing API processes over the same local database.

## Common commands

| Purpose | Command |
| --- | --- |
| Development | `corepack pnpm dev` |
| UI / API separately | `corepack pnpm dev:ui` / `corepack pnpm dev:api` (prepare with `db:setup` first) |
| Build | `corepack pnpm build` |
| Production build preview | `corepack pnpm preview` at localhost:4173/ (stop development first) |
| Targeted tests | `corepack pnpm exec vitest run tests/ranking.test.ts` |
| Full tests / types | `corepack pnpm test` / `corepack pnpm typecheck` |
| Static production preflight | `corepack pnpm prod:check` |
| Explicit production-to-local snapshot | `corepack pnpm db:refresh-from-prod` (operator credentials, Node 24, stopped local API) |

Snapshot refresh replaces local work; the development tools panel can stop/restart its own Worker after explicit confirmation. Read [data and recovery rules](docs/DATA.md#backup-recovery-and-local-snapshots) first. `corepack pnpm db:reset` deletes all local app data; stop servers first. Neither operation is part of normal startup.

## Configuration, data and services

Development fixes the API to localhost regardless of root env files. For production builds/previews, copy `.env.example` to ignored `.env.local` and set public `VITE_API_BASE_URL` to the Worker origin without `/api/v1`, plus `VITE_GOOGLE_CLIENT_ID`. Missing production API configuration produces a visible error. Provider secrets never use a `VITE_` prefix.

Optional local provider credentials belong in ignored `worker/.dev.vars.local`, copied from `worker/.dev.vars.example`; restart the API after changes. Google authenticates privately provisioned club accounts in production. TMDB supplies optional search/metadata/artwork; MDBList supplies ratings with OMDb fallback. Ordinary screens read stored snapshots and do not trigger provider API refreshes. Artwork CDN failures degrade to a labelled fallback. Fonts and attribution assets are bundled.

D1 is canonical; production, ordinary local D1 and import-preview D1 are separate. See [DATA](docs/DATA.md) and [INTEGRATIONS](docs/INTEGRATIONS.md).

For explicit local TMDB identity pairing maintenance, stop the local API and run `corepack pnpm exec tsx scripts/dev/pair-tmdb-cli.ts --manifest <private-json>` to preflight; add `--apply` to validate/enrich eligible pairings and reconcile explicitly supplied version-2 duplicate merges. See [local pairing safety and reports](docs/DATA.md#local-tmdb-identity-pairing-maintenance).

## Deployment

Cloudflare Workers Static Assets hosts the root `/` build at `bookclub.nissen.nexus` using `wrangler.frontend.jsonc`. GitHub remains the canonical source; pushing main deploys nothing. The existing GitHub Pages site may remain temporarily as rollback, but repository publication to Pages is retired. The API is [bookclub-api](https://bookclub-api.troy-nissen.workers.dev), deployed independently. Releases follow [DEPLOYMENT](docs/DEPLOYMENT.md); completing development work does not authorise publication.

## Current limits

Metrics is all-time, without date-range filtering. History restore is an admin API without a management screen. Unsaved Event/Builder edits are discarded on navigation; saved Builder sets persist privately. Seen It? Recent answers offers current-visit corrections, five per page; film detail can correct persisted answers. No notifications, PWA or scheduled provider refresh is implemented.

## Further documentation

- [AGENTS](AGENTS.md): agent routing and standing engineering rules.
- [STYLE](STYLE.md): BookClub UI/UX authority and rendered review.
- [ROADMAP](ROADMAP.md): user-approved future work.
- [ARCHITECTURE](docs/ARCHITECTURE.md): requirements, topology and module ownership.
- [DATA](docs/DATA.md): storage, lifecycle and snapshot safety.
- [CONTRACTS](docs/CONTRACTS.md): API, configuration and durable import/export boundaries.
- [INTEGRATIONS](docs/INTEGRATIONS.md): Google and provider behaviour.
- [TESTING](docs/TESTING.md): proportionate verification and commands.
- [DEPLOYMENT](docs/DEPLOYMENT.md): environments and release procedure.
- [Spreadsheet workflow](scripts/import/README.md): specialised parser, resolver and isolated preview operations.

## Maintenance rule for agents

Keep this the fastest human-readable explanation of the current app and setup. Correct changed facts and discovered drift in the same pass; remove obsolete wording. Brevity and completeness are equally important. Link to specialised authorities instead of duplicating deep detail. Do not add implementation history, release diaries or speculative future work.
