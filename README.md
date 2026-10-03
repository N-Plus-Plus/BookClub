# BookClub

A mobile-first film journal for a four-person weekly film club. Track event history, build a new event, inspect a live Classics watch order, and quickly fill missing Seen It? answers.

This is a functional local-first foundation. All bundled events and source ratings are **development examples**, not real club history or live provider ratings. The final ranking formula and spreadsheet migration remain to be supplied. Repository: `N-Plus-Plus/BookClub`.

## Architecture and layout

| Path | Responsibility |
| --- | --- |
| `frontend/` | React/TypeScript UI, dedicated API client, hash routing, mobile layouts |
| `style.css` | Original authoritative dark visual system, preserved unchanged |
| `frontend/app.css` | Mobile layout extensions, 44px controls, safe areas, responsive cards |
| `shared/types.ts` | Provider-neutral API/domain contracts |
| `shared/ranking.ts` | Pure provisional ranking, score normalisation, latest snapshots, stable ordering, missing-answer queue |
| `worker/src/index.ts` | Versioned REST routing, boundary validation, JSON errors, CORS |
| `worker/src/http.ts` | Central write-authorisation hook and environment contract |
| `worker/src/repository.ts` | Parameterised D1 queries and atomic writes |
| `worker/src/services.ts` | Lookup/import orchestration; persisted metadata and score snapshots |
| `worker/src/providers/` | Search, metadata, artwork and score interfaces; optional TMDB implementation |
| `worker/migrations/` | Versioned schema; never edit an applied migration for a future schema change |
| `worker/seed.sql`, `worker/reset.sql` | Opt-in local demo data/reset |
| `tests/` | Vitest ranking, transformation, validation, CORS and write-guard tests |
| `scripts/import/README.md` | Future spreadsheet migration boundary |
| `.github/workflows/pages.yml` | Manually triggered static frontend publication only |

GitHub Pages hosts only `dist/`. It needs no Node runtime, SSR, filesystem, server rewrites, or backend. Hash URLs such as `/BookClub/#/history` are refresh-safe. Vite sets `/BookClub/` at build time and `/` in development. The independently deployed Worker alone accesses the D1 `DB` binding and movie API credentials.

Dependencies are deliberately small: React, Lucide icons, bundled Fontsource Lexend Deca and Zod; Vite/TypeScript, Vitest, Wrangler/Worker types and concurrently provide development tooling. No CSS framework, Redux, ORM or presentation test harness is used. `pnpm-lock.yaml` pins resolved versions. `pnpm-workspace.yaml` permits only esbuild/workerd installation scripts.

## Prerequisites and local startup

Use Node **22.12+** (Node 24 LTS recommended) and **pnpm 10.32.1**, the version pinned in `package.json`. No Cloudflare login, production resources, or movie API credentials are needed for local development.

```sh
pnpm install
pnpm dev
```

`pnpm dev` first applies local migrations and seeds once, then starts both servers:

- UI: **http://localhost:5173/**
- API: **http://localhost:8787/api/v1**
- Status: **http://localhost:8787/api/v1/health**

Use localhost (not a different hostname) to match the local CORS allowlist. The browser automatically targets port 8787 in development. A brief initial API connection error can be retried once Wrangler is ready. Ctrl+C stops both processes. Do not run two API processes over the same local database.

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Prepare local D1 and start both servers |
| `pnpm dev:ui` | Start Vite only on 5173 |
| `pnpm dev:api` | Start local Worker only on 8787; run `pnpm db:setup` first |
| `pnpm db:migrate` | Apply versioned migrations to local D1 only |
| `pnpm db:seed` | Insert demo records once; preserve user-created records/answers |
| `pnpm db:setup` | Local migrations followed by safe seed |
| `pnpm db:reset` | **Delete all local app data** and reseed; stop the servers first |
| `pnpm test` | Full Vitest suite |
| `pnpm typecheck` | Frontend/shared/tests and Worker TypeScript checks |
| `pnpm build` | Static production frontend in `dist/` |
| `pnpm preview` | Preview production build at http://localhost:4173/BookClub/ |
| `node scripts/smoke.mjs` | Optional API smoke against running local servers; creates labelled test event/movie |

Local D1 state is generated beneath `worker/.wrangler/`, ignored by source control. All supplied database scripts explicitly use `--local --env local`. Nothing contacts production D1. Startup is not a reset: the `seed_runs` marker ensures rerunning it never restores an intentionally undone answer or overwrites saved work.

To return to clean demo fixtures, stop the servers and run:

```sh
pnpm db:reset
pnpm dev
```

## What works without external credentials

Home reads the database, showing the latest event, current Classics preview, eligibility/disqualification counts and missing answers. History includes one-, two- and three-film demo nights, viewing order and literal cycle labels. Events support any positive number of films, optional host/theme, saved-film search, manual creation, removal, ordering and atomic save. Classics ranks current source snapshots and seen state with a disqualified filter. Seen It? advances after each persisted answer, supports undo to Unknown and recent-answer corrections. Film detail exposes metadata, scores/timestamps, identifiers, artwork, ranking, per-member corrections and appearances.

Artwork is optional. Some fixtures reference TMDB CDN posters/backdrops; these need network access, but failed/missing images show a labelled fallback and do not block local workflows. Fonts and the approved TMDB attribution logo are bundled locally. No third-party API is called during ordinary screen loads. Search gracefully indicates unavailable lookup if no token is configured, if TMDB rejects it, or if the provider times out.

## Optional TMDB

Copy `worker/.dev.vars.example` to **`worker/.dev.vars.local`**, set `TMDB_READ_TOKEN` to your TMDB API Read Access Token, and restart the API. Use the bearer read token, not a frontend environment variable. The populated file is ignored; never commit it or copy it into the frontend. Local status reports only whether a token exists.

Selecting a TMDB result persists canonical metadata, TMDB/IMDb IDs where available, poster/backdrop references and a TMDB score snapshot. Repeated selections reuse known external IDs; no scheduled refreshes are implemented. The provider interfaces also define the integration point for future lawful IMDb/OMDb/other providers. Demo IMDb and critic scores are fixtures, **not connected integrations**. No sites are scraped.

The About & data sources footer includes the approved, unmodified TMDB logo and required notice. Attribution requirements: [TMDB FAQ](https://developer.themoviedb.org/docs/faq). Token documentation: [TMDB application authentication](https://developer.themoviedb.org/docs/authentication-application).

## Environment configuration

| Variable | Location | Meaning |
| --- | --- | --- |
| `VITE_API_BASE_URL` | root `.env.local` or GitHub repository Actions variable | Worker origin, without `/api/v1` or trailing slash; public, never a secret |
| `TMDB_READ_TOKEN` | Worker local secret file / Wrangler production secret | Optional TMDB bearer credential; server only |
| `APP_ENV` | Wrangler vars | `local` only for local development; default `production` |
| `LOCAL_WRITE_BYPASS` | Wrangler vars | Explicit `true` only in local env; default `false` |
| `ALLOWED_ORIGINS` | Wrangler vars | Comma-separated exact origins; local 5173/4173; production `https://n-plus-plus.github.io` |
| `DB` | Wrangler D1 binding | Local/production database, never a browser connection |

Production builds intentionally have no fallback to localhost or an invented backend. Set `VITE_API_BASE_URL` before building; if absent the UI reports a configuration error. Copy `.env.example` to `.env.local` for a configured build preview. Vite embeds this public value at build time; changing it requires rebuilding.

## D1 schema and persistence

- `members`: stable IDs, display order, active state, timestamps. Four generic development names.
- `movies`: canonical local IDs, original title, year/date, runtime, overview, timestamps, unique optional import source/key.
- `movie_external_ids`: provider-neutral identifiers, unique provider/ID and one ID per provider/movie.
- `movie_genres` and `movie_assets`: genres, poster/backdrop references, provider, optional dimensions, capture time and one preferred asset per movie/type. No image binaries.
- `source_scores`: provider/metric, raw value/scale, optional 0–100 value, vote count, capture timestamp and optional import source/key. Snapshots are preserved; only the latest per metric affects rank.
- `sessions` and `session_movies`: date, theme, host, notes, opaque legacy cycle label, import key, ordered joins with no three-film ceiling. A repeated film in an event is representable.
- `classics`: independent pool membership with date/source/legacy reference.
- `seen_states`: explicit 1/0 per movie/member and timestamp. **No row means Unknown**. Setting `seen: null` removes the answer.
- `seed_runs`: development seeding marker.

D1 is canonical; frontend state is disposable. Event headers/joins and imported movie snapshots use transactional `DB.batch`. Seen updates use an atomic upsert. Update endpoints currently use last-write-wins and sessions use full replacement; multi-user conflict detection is deferred until authentication is chosen. No live database has been migrated in this scaffold.

## Provisional Classics calculation

All policy lives in `shared/ranking.ts`. Normalise each usable score to 0–100, use only the newest snapshot per provider/metric, and take the weighted mean over present sources. Initial weights are TMDB 1, IMDb 2, demo critic 1 (unknown future sources default to 1). Missing sources do not count as zero. Add **2 points per explicit No answer**; Unknown adds nothing. Disqualify all-four-seen films regardless of score. Only active members participate; if the active roster is empty or all active members have seen it, it is also ineligible. The intended roster is four.

Equal scores use title, year, then local ID for stable ordering. UI output exposes base, seen/unseen/unknown counts, adjustment, final score, eligibility, source contributions and warnings. Scores with no usable sources receive a base of zero and a warning. This is deterministic demo behaviour, **not the spreadsheet algorithm**. Replace the pure module/config when the real formula arrives; do not embed arithmetic in UI or SQL.

## API, CORS and writes

All routes are under `/api/v1`; success is `{ "data": ... }`, failure is `{ "error": { "code", "message", "fields"? } }`. Zod validates inputs and calendar dates. JSON bodies are bounded to 128 KiB. Invalid inputs return 422, malformed JSON 400, missing resources 404, locked writes/disallowed origins 403, unavailable imports 503. Provider search errors are returned as an unavailable lookup alongside usable local search results. Internal errors return a safe generic message.

| Method / route | Behaviour |
| --- | --- |
| `GET /health`, `/catalog`, `/members`, `/movies`, `/sessions`, `/classics` | Status and stored/derived data |
| `GET /movies/search?q=...` | Saved search plus optional provider search |
| `GET /movies/:id` | Film detail including appearances and ranking |
| `POST /movies` | Manual film `{title, year?, runtime?}` |
| `POST /movies/import` | Persist `{provider: "tmdb", externalId}` snapshot |
| `GET /sessions/:id` | One event with ordered films |
| `POST /sessions`, `PUT /sessions/:id` | Create/replace `{event_date, title?, host_member_id?, legacy_cycle_label?, notes?, movie_ids}` |
| `PUT /movies/:id/seen/:memberId` | `{seen: true | false | null}` |

CORS reflects only configured exact origins, never `*`. Production is configured for `https://n-plus-plus.github.io` (an origin has **no `/BookClub/` path**). CORS does not authenticate requests. The central `authorizeMutation` hook permits writes only when both explicit local flags are set; the default production configuration blocks **every mutation**, including requests without Origin. Production is intentionally read-only until a lightweight authentication mechanism is implemented. There is no permanent write secret in the static frontend.

## Later Worker/D1 deployment — not performed

These are future, intentional Cloudflare operations, not local setup commands:

1. Choose production authentication and implement the central hook before enabling writes.
2. Authenticate Wrangler. The owner-supplied existing `bookclub-prod` database is recorded in the top-level binding; no database was created or contacted in this pass.
3. Verify the **top-level** `database_id` in `worker/wrangler.jsonc` identifies the intended database. Keep the local binding independent. Do not deploy `--env local`.
4. Confirm top-level `ALLOWED_ORIGINS` matches the GitHub Pages origin and retain production flags. Do not apply the development seed to production.
5. Apply schema intentionally with `pnpm exec wrangler d1 migrations apply DB --config worker/wrangler.jsonc --remote`.
6. If desired set `pnpm exec wrangler secret put TMDB_READ_TOKEN --config worker/wrangler.jsonc`.
7. Deploy with `pnpm exec wrangler deploy --config worker/wrangler.jsonc`, then verify health/CORS and that unauthenticated writes remain blocked.
8. Configure the returned Worker origin as `VITE_API_BASE_URL` for the frontend.

Use backups and reviewed migrations once real data exists. Cloudflare references: [local D1](https://developers.cloudflare.com/d1/best-practices/local-development/), [migrations](https://developers.cloudflare.com/d1/reference/migrations/).

## Later GitHub Pages publication — not performed

Enable GitHub Actions as the Pages source in repository settings. Add the public repository Actions variable `VITE_API_BASE_URL` for the deployed Worker origin, and configure the matching Worker CORS origin. Run the **Publish frontend to GitHub Pages** workflow manually when ready; it installs with the pinned pnpm, tests/types/builds and publishes `dist/`. It has no push trigger, performs no Worker deployment and contains no credentials. If desired, add a branch trigger in a later authorised deployment pass. Hosting target is `https://n-plus-plus.github.io/BookClub/`.

For an intentional custom-domain/root-path deployment change `base` in `vite.config.ts`; never scatter path prefixes in components. Reference: [Vite static deployment](https://vite.dev/guide/static-deploy.html).

## Current boundaries and next work

The real spreadsheet importer, final ranking formula, production authentication, score refresh operation, Classics pool administration, elaborate editing, reporting, charts, accounts, notifications and PWA support are deferred. New events are supported in the UI; the API can replace existing events, but an edit screen is not yet implemented. Navigation away from an unsaved Event screen discards that draft; saved manual films remain in the library. Recent answer undo is limited to the current Seen It? visit; persisted answers can always be corrected from film detail. History currently loads the small whole catalog; pagination can follow after migration size is known.

The next step is to obtain the spreadsheet plus the authoritative ranking formula, review the cycle/member mapping, and implement a dry-run idempotent importer. Choose authentication before making the independent production Worker writable.
