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
| `worker/src/http.ts`, `auth.ts`, `auth-repository.ts` | Central authentication/mutation guards, Google verification, D1 identity/session queries |
| `worker/src/repository.ts` | Parameterised D1 queries and atomic writes |
| `worker/src/services.ts` | Lookup/import orchestration; persisted metadata and score snapshots |
| `worker/src/providers/` | Search, metadata, artwork and score interfaces; optional TMDB implementation |
| `worker/migrations/` | Versioned schema; never edit an applied migration for a future schema change |
| `worker/seed.sql`, `worker/reset.sql` | Opt-in local demo data/reset |
| `tests/` | Vitest ranking, transformation, validation, auth/session/allow-list, frontend API, CORS and write-guard tests |
| `scripts/import/README.md` | Future spreadsheet migration boundary |
| `.github/workflows/pages.yml` | Manually triggered static frontend publication only |

GitHub Pages hosts only `dist/`. It needs no Node runtime, SSR, filesystem, server rewrites, or backend. Hash URLs such as `/BookClub/#/history` are refresh-safe. Vite sets `/BookClub/` at build time and `/` in development. The independently deployed Worker alone accesses the D1 `DB` binding and movie API credentials.

Dependencies are deliberately small: React, Lucide icons, bundled Fontsource Lexend Deca, Zod and Worker-only `jose` 6.2.12 for standards-based JWT/JWK verification; Vite/TypeScript, Vitest, Wrangler/Worker types and concurrently provide development tooling. No CSS framework, Redux, ORM or presentation test harness is used. `pnpm-lock.yaml` pins resolved versions. `pnpm-workspace.yaml` permits only esbuild/workerd installation scripts.

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
| `VITE_GOOGLE_CLIENT_ID` | root `.env.local` or GitHub repository Actions variable | Public Google Web Application client ID, embedded in the frontend build |
| `GOOGLE_CLIENT_ID` | Worker runtime configuration (Wrangler var or secret) | Same public client ID; expected ID-token audience; required for production login |
| `TMDB_READ_TOKEN` | Worker local secret file / Wrangler production secret | Optional TMDB bearer credential; server only |
| `APP_ENV` | Wrangler vars | `local` only for local development; default `production` |
| `LOCAL_WRITE_BYPASS` | Wrangler vars | Explicit `true` only in local env; default `false` |
| `ALLOWED_ORIGINS` | Wrangler vars | Comma-separated exact origins; local 5173/4173; production `https://n-plus-plus.github.io` |
| `DB` | Wrangler D1 binding | Local/production database, never a browser connection |

Production builds intentionally have no fallback to localhost or an invented backend. Set `VITE_API_BASE_URL` before building; if absent the UI reports a configuration error. Copy `.env.example` to `.env.local` for a configured build preview. Vite embeds both public `VITE_` values at build time; changing them requires rebuilding. The Pages workflow fails if either is missing. Optional future `MDBLIST_API_KEY`, `OMDB_API_KEY`, and `TVDB_API_KEY` belong only in Worker secrets; no provider credential may use a `VITE_` prefix. Their integrations remain unimplemented.

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
- `member_auth`: one allow-listed normalised email per member, unique nullable Google sub, creation/binding/last-login timestamps.
- `auth_sessions`: SHA-256 token hash, member foreign key, creation/expiry timestamps. These are authentication sessions, separate from film-event `sessions`.

D1 is canonical; frontend state is disposable. Event headers/joins and imported movie snapshots use transactional `DB.batch`. Seen updates use an atomic upsert. Update endpoints currently use last-write-wins and sessions use full replacement; multi-user conflict detection remains deferred. No live database has been migrated in this scaffold.

## Provisional Classics calculation

All policy lives in `shared/ranking.ts`. Normalise each usable score to 0–100, use only the newest snapshot per provider/metric, and take the weighted mean over present sources. Initial weights are TMDB 1, IMDb 2, demo critic 1 (unknown future sources default to 1). Missing sources do not count as zero. Add **2 points per explicit No answer**; Unknown adds nothing. Disqualify all-four-seen films regardless of score. Only active members participate; if the active roster is empty or all active members have seen it, it is also ineligible. The intended roster is four.

Equal scores use title, year, then local ID for stable ordering. UI output exposes base, seen/unseen/unknown counts, adjustment, final score, eligibility, source contributions and warnings. Scores with no usable sources receive a base of zero and a warning. This is deterministic demo behaviour, **not the spreadsheet algorithm**. Replace the pure module/config when the real formula arrives; do not embed arithmetic in UI or SQL.

## API, CORS and writes

All routes are under `/api/v1`; success is `{ "data": ... }`, failure is `{ "error": { "code", "message", "fields"? } }`. Zod validates inputs and calendar dates. JSON bodies are bounded to 128 KiB. Invalid inputs return 422, malformed JSON 400, missing resources 404, missing/invalid/expired sessions or invalid Google credentials 401, unauthorised Google accounts/disallowed origins 403, unavailable imports 503. Provider search errors are returned as an unavailable lookup alongside usable local search results. Internal errors return a safe generic message.

| Method / route | Behaviour |
| --- | --- |
| `GET /health` | Public non-sensitive capabilities: environment, demo, authenticationRequired, googleAuthConfigured, tmdbConfigured |
| `POST /auth/google` | Public `{credential}`; verify Google and allow-list, return `{token,viewer,expiresAt}` |
| `GET /auth/me` | Bearer session required; return `{viewer: {id,display_name}}` (null under local bypass) |
| `POST /auth/logout` | Bearer session required; revoke current session and return `{loggedOut: true}` |
| `GET /catalog`, `/members`, `/movies`, `/sessions`, `/classics` | Authenticated stored/derived data |
| `GET /movies/search?q=...` | Saved search plus optional provider search |
| `GET /movies/:id` | Film detail including appearances and ranking |
| `POST /movies` | Manual film `{title, year?, runtime?}` |
| `POST /movies/import` | Persist `{provider: "tmdb", externalId}` snapshot |
| `GET /sessions/:id` | One event with ordered films |
| `POST /sessions`, `PUT /sessions/:id` | Create/replace `{event_date, title?, host_member_id?, legacy_cycle_label?, notes?, movie_ids}` |
| `PUT /movies/:id/seen/:memberId` | `{seen: true | false | null}` |

CORS reflects only configured exact origins, never `*`. Production uses `https://n-plus-plus.github.io` (the browser canonicalises the supplied `https://N-Plus-Plus.github.io` hostname to lowercase; origins have no `/BookClub/` path). It permits `Authorization` and `Content-Type`, with no cookie credentials. CORS is separate from authentication: requests without Origin still require a BookClub session. All application GETs and mutations are private; only health, Google login and preflight are public. Authenticated members can use the existing shared editing workflows, including answers for any club member.

## Google authentication and sessions

The static frontend checks public health first. With `APP_ENV=local` **and** `LOCAL_WRITE_BYPASS=true`, all existing demo reads/writes work without Google, internet or a session. Either flag alone cannot bypass authentication. Otherwise it tries `/auth/me` with the saved session before loading private data, or displays the private-journal sign-in gate with Google's official branded button. The signed credential is immediately exchanged with the Worker and is never stored for continuing authentication. Unauthorised Google accounts get a clear 403; BookClub has no registration, password, invitation code or public member creation route.

The Worker uses `jose` and Google's cached remote JWKs to verify RS256 signature, exact configured audience, either valid Google issuer, expiry, nonempty sub/email and boolean `email_verified === true`. No tokeninfo calls or OAuth client secret are used. Verification follows [Google's server verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token); `jose` supports [Cloudflare Workers](https://github.com/panva/jose).

Before first login, an operator creates four `members` plus four `member_auth` rows with lowercase trimmed authorised emails and null sub. A single guarded SQL UPDATE binds a matching email to its first verified sub and records timestamps. Existing sub matches take precedence even if email later changes. An email already bound to another sub is denied; no login inserts a member or allow-list row. Do not rewrite bindings as part of a bootstrap rerun. For this club provision the intended Gmail identities; Google cautions that verified third-party email ownership can change. Disabled members, deleted allow-list entries, expired or revoked sessions cannot access data.

The Worker generates a random 256-bit opaque bearer token and stores only its SHA-256 hash in D1. Tokens expire after 90 days. Hash lookup uses indexed SQL equality; no raw-secret comparison or application signing secret is needed. Tokens travel only in HTTPS response bodies and `Authorization: Bearer ...`, never URLs or logs. Stored hashes and authorised emails are not returned by the API. Logout deletes the current session; operator revocation can delete all `auth_sessions` for a member, or deactivate the member to block all access and subsequent login. Expired rows are inert; periodic pruning is an optional operator task, not a scheduled integration.

The browser deliberately stores the BookClub token in `localStorage` (`bookclub.session`) because Pages and Worker are cross-site and third-party cookies are unreliable. A 401 clears the saved token and private UI state. Clearing browser storage also signs the device out but does not itself revoke the server row. Logout clears storage after confirmed revocation; a network failure offers retry instead of claiming server logout succeeded. The member name and Lucide logout control appear in the app header.

This persistence trades convenience for XSS exposure: scripts on the Pages origin can access localStorage, including other apps hosted on the same origin. Only deploy trusted code on that origin. React escaping remains in use; there is no raw HTML injection or user-controlled script execution. The only added script is the fixed official GIS library URL. Treat a stolen Google ID credential as replayable until Google expiry and a stolen BookClub bearer token as usable until expiry/revocation; keep them out of diagnostics.

The existing Google Web Application client should authorise JavaScript origin `https://N-Plus-Plus.github.io` (optional local testing: `http://localhost:5173`). The GIS popup callback needs no redirect URI or Gmail/Drive/Calendar scopes. Set matching `VITE_GOOGLE_CLIENT_ID` and Worker `GOOGLE_CLIENT_ID`; neither value is a secret. Local bypass never loads GIS.

## Private member bootstrap

After production migrations, copy `scripts/auth/bootstrap-members.example.sql` to `scripts/auth/bootstrap-members.local.sql`. Replace **every** name/email placeholder privately with the four real members, normalising each email to lowercase with no surrounding whitespace. Preserve stable `club-member-1` through `club-member-4` IDs. The example contains placeholders only; the populated local file is explicitly gitignored. Never read it into tests, logs or frontend builds, and never apply `worker/seed.sql` to production.

The template uses `INSERT OR IGNORE`: an identical rerun does not duplicate members or overwrite established sub bindings. It intentionally does not update names/emails, and conflicting IDs/emails may be ignored. Privately review all four rows before execution and verify that there are exactly four intended members and four allow-list rows afterwards using the Cloudflare dashboard. Corrections require a reviewed operator change; do not reset a bound sub casually. The application does not enforce a database-wide count of four; that roster limit is maintained by private provisioning.

## First production deployment — human steps only, not performed

Review code and migration first. These are intentional remote operations for the owner, **not** local verification commands. Use the top-level production binding for `bookclub-prod`; the existing database ID is preserved. Never deploy `--env local`, use the demo seed remotely, or deploy a bypass configuration.

1. Authenticate: `pnpm exec wrangler login`.
2. Confirm top-level database ID and exact Pages CORS origin in `worker/wrangler.jsonc`, then apply migrations: `pnpm exec wrangler d1 migrations apply DB --config worker/wrangler.jsonc --remote`.
3. Create and privately review `scripts/auth/bootstrap-members.local.sql` as above.
4. Apply it intentionally: `pnpm exec wrangler d1 execute DB --config worker/wrangler.jsonc --remote --file scripts/auth/bootstrap-members.local.sql`. Review Wrangler output privately; it may contain personal SQL values. Do not share it in logs/chat. Verify four intended rows in each table privately.
5. Set Worker audience using `pnpm exec wrangler secret put GOOGLE_CLIENT_ID --config worker/wrangler.jsonc` (a secret binding is convenient here although the ID is public), and optional movie lookup token using `pnpm exec wrangler secret put TMDB_READ_TOKEN --config worker/wrangler.jsonc`. Enter values interactively. Retain `APP_ENV=production`, `LOCAL_WRITE_BYPASS=false`, and configured exact origin.
6. Deploy only the production Worker: `pnpm exec wrangler deploy --config worker/wrangler.jsonc`.
7. Check public `GET <Worker-origin>/api/v1/health`: authenticationRequired and googleAuthConfigured must be true; it must expose no credentials.
8. Check unauthenticated `GET <Worker-origin>/api/v1/catalog` returns 401 (also confirm an unauthenticated mutation returns 401).
9. Verify one allow-listed GIS login using a locally served production build pointed at this Worker. Set the two public Vite values, build, and serve `pnpm preview` at `http://localhost:4173/BookClub/`. For this pre-Pages check, temporarily configure this exact origin in Worker CORS and Google's JavaScript origins, retaining the production origin. Restore production-only CORS after verification. Alternatively do this check in a reviewed staging environment. Confirm first binding, authenticated reads/writes, outsider 403 and logout revocation without printing credentials/tokens. Do not paste credentials into curl commands, URLs or shared logs.
10. Set GitHub repository Actions variables `VITE_API_BASE_URL` (deployed Worker origin, no `/api/v1`) and `VITE_GOOGLE_CLIENT_ID` (matching audience).
11. Enable GitHub Pages with **GitHub Actions** as the source.
12. Manually run **Publish frontend to GitHub Pages**. It validates both public variables, installs pinned pnpm dependencies, tests/types/builds and publishes `dist/`. It does not deploy Worker or use provider secrets.
13. Verify `https://N-Plus-Plus.github.io/BookClub/`: sign-in gate, authorised login, private views, authenticated edits, reload persistence, logout and rejection of an unauthorised Google account. Test on mobile. Confirm Worker production-only CORS and no local bypass.

The live Google button/account flow and actual remote binding remain human deployment checks; automated verification uses generated signing keys, substituted Google verification and disposable SQLite, never live Google or D1. Test SQL includes the actual migrations and repository queries. Authentication tests use Node's built-in SQLite (available under the established Node 22.12+ runtime; it may emit an experimental warning).

Use backups and reviewed migrations once real data exists. References: [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [GIS JavaScript callback](https://developers.google.com/identity/gsi/web/reference/js-reference), [Vite static deployment](https://vite.dev/guide/static-deploy.html). For a deliberate root/custom-domain deployment adjust the owning `base` in `vite.config.ts`.

## Current boundaries and next work

The real spreadsheet importer, final ranking formula, score refresh operation, Classics pool administration, elaborate editing, reporting, charts, accounts, notifications and PWA support are deferred. New events are supported in the UI; the API can replace existing events, but an edit screen is not yet implemented. Navigation away from an unsaved Event screen discards that draft; saved manual films remain in the library. Recent answer undo is limited to the current Seen It? visit; persisted answers can always be corrected from film detail. History currently loads the small whole catalog; pagination can follow after migration size is known.

The next step is to obtain the spreadsheet plus the authoritative ranking formula, review the cycle/member mapping, and implement a dry-run idempotent importer. Production authentication is implemented; remote migration, private roster provisioning, runtime configuration and the human deployment checks above remain pending.
