# BookClub

A mobile-first film journal for a four-person weekly film club. Track event history, keep private Builder film sets, complete explicit club turns, inspect a persisted Classics watch order, and quickly fill missing Seen It? answers.

This is a functional local-first foundation. All bundled events and source ratings are **development examples**, not real club history or live provider ratings. The historical ranking formula, cycle model and safe spreadsheet dry-run and staged identity resolution with a guarded local D1 import preview are implemented; the historical production cutover is complete and verified. Repository: `N-Plus-Plus/BookClub`.

## Architecture and layout

| Path | Responsibility |
| --- | --- |
| `frontend/` | React/TypeScript UI, dedicated API client, hash routing, mobile layouts |
| `style.css` | Original authoritative dark visual system, preserved unchanged |
| `frontend/app.css` | Mobile layout extensions, 44px controls, safe areas, responsive cards |
| `shared/types.ts` | Provider-neutral API/domain contracts |
| `shared/ranking.ts` | Historical ranking, score normalisation, retrieval precedence, stable ordering, missing-answer queue |
| `shared/metrics.ts`, `shared/genres.ts` | Pure appearance Metrics and finite TMDB genre presentation |
| `worker/src/index.ts` | Versioned REST routing, boundary validation, JSON errors, CORS |
| `worker/src/http.ts`, `auth.ts`, `auth-repository.ts` | Central authentication/mutation guards, Google verification, D1 identity/session queries |
| `worker/src/repository.ts` | Shared catalog, canonical movies and persisted scores |
| `worker/src/product-repository.ts` | Avatars, owner-only Builder, explicit rotation and audited History transactions |
| `shared/identity.ts`, `frontend/ClubIdentity.tsx` | Base-aware member/Classics presentation and local calendar dates |
| `worker/src/services.ts`, `score-service.ts` | Metadata import and central explicit score enrichment |
| `worker/src/providers/` | TMDB metadata/artwork; optional MDBList primary ratings and OMDb fallback |
| `worker/migrations/` | Versioned schema; never edit an applied migration for a future schema change |
| `worker/seed.sql`, `worker/reset.sql` | Opt-in local demo data/reset |
| `tests/` | Vitest ranking, transformation, validation, auth/session/allow-list, frontend API, CORS and write-guard tests |
| `scripts/import/README.md` | Staged dry-run, resolution, overrides and local-only apply preview |
| `.github/workflows/pages.yml` | Manually triggered static frontend publication only |

GitHub Pages hosts only `dist/`. It needs no Node runtime, SSR, filesystem, server rewrites, or backend. Hash URLs such as `/BookClub/#/history` are refresh-safe. Vite sets `/BookClub/` at build time and `/` in development. The independently deployed Worker alone accesses the D1 `DB` binding and movie API credentials.

Dependencies are deliberately small: React, Lucide icons, bundled Fontsource Lexend Deca, Zod and Worker-only `jose` 6.2.12 for standards-based JWT/JWK verification; Vite/TypeScript, Vitest, Wrangler/Worker types and concurrently provide development tooling. ExcelJS 4.4.0 reads private XLSX files and tsx 4.23.15 runs the TypeScript dry-run CLI, as development-only dependencies. No CSS framework, Redux or ORM is used. `pnpm-lock.yaml` pins resolved versions. `pnpm-workspace.yaml` permits only esbuild/workerd installation scripts.

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
| `pnpm import:spreadsheet --file private.xlsx --config scripts/import/import-config.local.json` | Read-only analysis to ignored `.verification/import/` reports |
| `pnpm import:resolve --plan .verification/import/plan.json --config scripts/import/import-config.local.json` | Offline canonical resolution; optional bounded `--network` TMDB stage |
| `pnpm db:import-preview:prepare` | Migrate isolated local preview and prepare only Host 1–4 |
| `pnpm import:apply:local --plan .verification/import/resolved-plan.json --config scripts/import/import-config.local.json` | Local preview preflight; add `--apply` to write |
| `pnpm dev:import-preview` | Start UI/isolated local Worker without demo film seeding |
| `pnpm db:reset` | **Delete all local app data** and reseed; stop the servers first |
| `pnpm test` | Full Vitest suite |
| `pnpm typecheck` | Frontend/shared/tests and Worker TypeScript checks |
| `pnpm build` | Static production frontend in `dist/` |
| `pnpm prod:check` | Local static production/preview safety and migration continuity; no remote access |
| `pnpm preview` | Preview production build at http://localhost:4173/BookClub/ |
| `node scripts/smoke.mjs` | Optional API smoke against running local servers; creates labelled test event/movie |

Local D1 state is generated beneath `worker/.wrangler/`, ignored by source control. Ordinary database scripts use `--local --env local`; import preview uses an isolated config, `--local --env import_preview` and explicit separate persistence. Nothing contacts production D1. Startup is not a reset: the `seed_runs` marker ensures rerunning it never restores an intentionally undone answer or overwrites saved work.

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

Selecting a TMDB result persists canonical metadata, TMDB/IMDb IDs where available, poster/backdrop references and a TMDB score snapshot, and records that metadata check immediately. Repeated selections reuse known external IDs; no scheduled refreshes are implemented. Optional MDBList and OMDb rating adapters support explicit enrichment. TheTVDB key is intentionally unused/deferred; any future v4 integration must cache its login bearer token rather than authenticate per film. Bundled ratings remain fictional development snapshots; no sites are scraped.

The About & data sources footer includes the approved, unmodified TMDB logo and required notice. Attribution requirements: [TMDB FAQ](https://developer.themoviedb.org/docs/faq). Token documentation: [TMDB application authentication](https://developer.themoviedb.org/docs/authentication-application).

## Environment configuration

| Variable | Location | Meaning |
| --- | --- | --- |
| `VITE_API_BASE_URL` | root `.env.local` or GitHub repository Actions variable | Worker origin, without `/api/v1` or trailing slash; public, never a secret |
| `VITE_GOOGLE_CLIENT_ID` | root `.env.local` or GitHub repository Actions variable | Public Google Web Application client ID, embedded in the frontend build |
| `GOOGLE_CLIENT_ID` | Worker runtime configuration (Wrangler var or secret) | Same public client ID; expected ID-token audience; required for production login |
| `TMDB_READ_TOKEN` | Worker local secret file / Wrangler production secret; explicit resolver process env or supplied private env file | Optional TMDB bearer credential; never in the browser |
| `MDBLIST_API_KEY` | Worker local secret file / Wrangler production secret | Optional primary multi-rating provider; server only |
| `OMDB_API_KEY` | Worker local secret file / Wrangler production secret | Optional IMDb-ID rating fallback; server only |
| `TVDB_API_KEY` | Worker-only placeholder | Unused; deferred |
| `APP_ENV` | Wrangler vars | `local` only for local development; default `production` |
| `LOCAL_WRITE_BYPASS` | Wrangler vars | Explicit `true` only in local env; default `false` |
| `ALLOWED_ORIGINS` | Wrangler vars | Comma-separated exact origins; local 5173/4173; production `https://n-plus-plus.github.io` |
| `DB` | Wrangler D1 binding | Local/production database, never a browser connection |

Production builds intentionally have no fallback to localhost or an invented backend. Set `VITE_API_BASE_URL` before building; if absent the UI reports a configuration error. Copy `.env.example` to `.env.local` for a configured build preview. Vite embeds both public `VITE_` values at build time; changing them requires rebuilding. The Pages workflow fails if either is missing. Application provider credentials remain Worker-only; the explicit offline tool can also read a private TMDB token for identity resolution. No provider credential uses a `VITE_` prefix. TheTVDB is deferred.

## D1 schema and persistence

- `members`: stable IDs, display order, active state, timestamps. Four generic development names.
- `movies`: canonical local IDs, original title, year/date, runtime, overview, timestamps, unique optional import source/key.
- `movie_external_ids`: provider-neutral identifiers, unique provider/ID and one ID per provider/movie.
- `movie_genres` and `movie_assets`: genres, poster/backdrop references, provider, optional dimensions, capture time and one preferred asset per movie/type. No image binaries.
- `movie_import_refs`: multiple durable source references per canonical movie; Should Watch refs also audit membership origins.
- `seen_import_observations`: original per-row explicit answers with archive observation time, independent of the canonical answer or private override.
- `import_applied_entities`: immutable entity fingerprints for conflict-safe resumable local apply.
- `source_scores`: provider/metric, raw value/scale, optional 0–100 value, vote count, capture timestamp, retrieval service, optional upstream timestamp and import source/key. History is preserved; source_ref/source_ordinal and optional private legacy_preferred distinguish observations at one capture. Preferred retrieval service then latest usable snapshot determines effective score.
- `cycles`: stable ID, ordinal, Sean-derived anchor in the compatibility column `rough_date`, optional label/import keys and timestamps.
- `sessions` and `session_movies`: date/precision, kind, optional cycle/source slot, theme, host, notes, compatible legacy label, import key and ordered joins with no three-film ceiling. Repeated films are representable.
- `classics`: independent pool membership with stable rank seed, date/source/legacy reference. `classics_seed_allocations` and `rank_seed_counter` retain transactional allocation across membership removal.
- `seen_states`: explicit 1/0 per movie/member and timestamp. **No row means Unknown**. Setting `seen: null` removes the answer.
- `seed_runs`: development seeding marker.
- `member_auth`: one allow-listed normalised email per member, unique nullable Google sub, creation/binding/last-login timestamps.
- `auth_sessions`: SHA-256 token hash, member foreign key, creation/expiry timestamps. These are authentication sessions, separate from film-event `sessions`.

D1 is canonical; frontend state is disposable. Event headers/joins, audits, publication, Builder removal, qualifying Classics Seen updates and rotation changes use transactional `DB.batch`. Seen updates use an atomic upsert. History replacement remains last-write-wins; Builder revisions and rotation versions detect conflicting changes. SQL publication guards recheck both inside the transaction. No live database has been migrated in this pass.

## Members, Builder, rotation and recoverable History

Migration `0005_product_state.sql` adds nullable integer member avatars (0–19, unique even for inactive members), durable `member`/`admin` roles, singleton `club_rotation`, private `builder_sets`/ordered `builder_movies`, session planning/publication/soft-delete metadata and relational `history_audit`. No fifth member represents Classics: reusable identity presentation explicitly supports either a database member or `CLSC` with the reserved `avatars/a.png`. All asset URLs use Vite's base; member names are uppercased only for presentation. Root styling, Lucide and bundled Lexend Deca remain in use. Home, History, Builder, Classics, Seen It? and Metrics form the six-item mobile navigation; direct Event creation remains available from Home and History.

Builder supports multiple private sets per member, optional title/note, timestamps and ordered canonical movie IDs. There is no planned event date, three-film ceiling, sharing or copying. Search/import/manual creation reuse the same film picker as direct events. Every Builder route derives its owner from the authenticated session. **Even administrators cannot list, inspect, edit, delete or publish another member's unpublished Builder**, including its title, notes, film IDs or counts. Other-owner and nonexistent IDs both return 404. No Builder data enters the catalog. Local bypass has no owner; personal workflows need a concrete session. Development tests use fictional allow-list/session rows, not production identities.

Publish first saves the private edits, then shows the chosen event date (default: today's browser-local calendar date), current turn/cycle and actual host. Dates may be past or future. Title/note become shared History metadata on publication. A single D1 batch verifies the Builder revision, creates the event/ordered joins, removes the Builder, appends its audit and optionally completes the current turn. `sessions.planned_at` permanently retains the Builder's original `created_at`; `published_by`, Builder reference/revision and completed-turn version are immutable publication metadata. No history edit, soft deletion or restoration resets the planning timestamp. Any failure rolls back all effects, including a newly created cycle and Seen answers.

Rotation follows active member positions 1→2→3→4→5 (hostless Classics)→1. It is stored explicitly with a cycle ID, nominal slot, version and updated timestamp, never calculated from calendar dates. Deferral performs no mutation. Only creation/publication with explicit `complete_turn:true`, current `turn_version`, current slot and matching cycle advances once. Slot 1 creates a new cycle using its actual event date as the anchor; subsequent slots use that cycle and independent exact dates. Classics completes it, leaving slot 1 with no cycle until the next slot-1 publication. Ordinary history/backfill creation defaults to no completion, and editing an existing record cannot complete another turn. Home shows the nominal identity and anchor, with added emphasis when it is the viewer's turn.

Actual hosted member and nominal slot are separate. Any member may record an event; Builder publication uses its owner as actual host. Every hosted nominal slot 1–4 whose actual host differs from the member at that `sort_order` requires a nonblank `swap_note`, including current completions, direct History backfills, Builder backfills and later edits. Event and Builder visibly require the explanation before submission. Application validation and migration 0006 insert/update triggers return a safe 422; Classics, ungrouped/null-slot events and matching hosts need no explanation. No admin approval is needed. Swaps preserve member positions and permanent rotation. The return leg remains an explicit future publication.

Migration `0006_history_integrity.sql` enforces one active session per non-null `(cycle_id,cycle_slot)` with a partial unique index. Different cycles/slots and null cycle/slot events remain unrestricted. Soft deletion frees the slot; restore rechecks it. Creation, editing, Builder publication, current completion and admin restoration into an occupied slot return a useful 409 and roll back all related changes. Existing duplicates make migration fail for explicit owner reconciliation; nothing is silently merged, deleted or rewritten. Migrations 0001–0005 remain unchanged.

## All Time Metrics and stored metadata

All authenticated members may view Metrics; there is no date filter or admin requirement. ALL includes every active hosted and Classics event. Human filters use **actual `host_member_id`**, so a swapped night belongs to its actual host, not the nominal turn. Database names/avatars identify positions 1–4; CLSC selects Classics and uses `avatars/a.png`. Builder is never queried by Metrics and never enters catalog data.

The unit is a **film appearance**, including repeats within/across events. Events, appearance count, canonical unique-film count and appearance-weighted average IMDb are derived by `shared/metrics.ts`. Effective current stored `imdb:rating` uses `latestScores`/`scoreValue`; missing scores stay missing, coverage is shown and an unscored average is an empty state. Display scores are out of 10. Top/bottom five select scored appearances, allowing repeated films with event/date precision, cycle/slot, position and host context. Score descending/ascending respectively, then ascending event date, title, session/movie IDs and position resolve ties deterministically.

By Genre uses stored `movie_genres` and a finite 19-genre TMDB movie vocabulary. Explicit presentation maps Science Fiction to Sci-Fi, normalises punctuation/casing and deduplicates aliases; unknown strings do not create arbitrary categories. Each appearance contributes once to **every** applicable genre. Percentages divide by all selected appearances; totals may exceed 100%. Genre IMDb averages include only scored appearances, with per-row score coverage. No recognised stored genre means Uncategorised. Both genre and IMDb coverage remain visible before enrichment; ordinary page loads call no provider.

Admin-only `POST /api/v1/movies/enrich-metadata` accepts `{ "limit": 10 }` (optional default 10, integer 1–10). Metrics offers an explicit **Fill missing metadata** control only to admins. It selects existing canonical films with a stored TMDB ID that are never checked or stale after 150 days, prioritising absent genres then missing original title, release date, runtime, overview and TMDB artwork. It performs at most one bounded TMDB details request per selected film, sequentially, with an 8-second provider timeout; rate limits, credential failures and provider-wide outages stop the batch. Production operations must explicitly refresh stale metadata within TMDB's six-month cache window. Response: `{results:[{movieId,title,provider:"tmdb",status:"success"|"failed"|"conflict",message}],remaining,unidentified}`. `remaining` counts identified stale/unchecked films; `unidentified` counts canonical films without TMDB identity.

Migration `0007_tmdb_metadata_checked.sql` adds nullable `movies.tmdb_metadata_checked_at`, exposed by the catalog. Null means no successful TMDB metadata snapshot; historical imports remain null, while live TMDB imports and successful enrichment atomically store their fetch timestamp. At 150 days records become eligible for another explicit maintenance run; no automatic page-load or scheduled refresh is performed. Failed/conflicted updates leave the marker unchanged.

Enrichment updates provider-owned metadata/genres and preferred TMDB poster/backdrop snapshots **in place**, preserving internal movie IDs permanently. Existing artwork snapshots remain stored. A missing safe IMDb ID may be added; a conflicting IMDb/TMDB identity returns a per-film conflict for owner reconciliation, without stealing or merging. History joins, Classics seeds, Seen answers, source-score history, import references, creation time and import provenance are unchanged. Repeating metadata updates does not create films or duplicate preferred assets. No background/scheduled requests or real archive import are part of this path.

Qualifying **current** Classics publication transactionally sets every lineup film Seen=Yes for all active members. Hosted events, old/backfilled Classics, edits and restores never apply this side effect. All History mutations append actor, time, action and structured before/after/order/turn details. Legacy imports predate application auditing; local bypass audit actors are null and displayed as local demo. Ordinary deletion sets `deleted_at`/`deleted_by`, preserving the session, ordered joins and audit; default History, catalog and film appearances exclude it. Admin restore is available through the API; an unknown legacy reference date follows the current corrected anchor on restore. Edits/deletion of a turn-completing event flag rotation review in the audit while keeping rotation unchanged. Admin corrections require a reason and current version, are separately audited, and never gain Builder access. Concurrent Builder edits, stale publications and turn corrections return safe 409 conflicts; refresh before retrying. History replacement remains last-write-wins.

## Historical Classics calculation

All policy lives in shared/ranking.ts. Required inputs are imdb:rating, rottentomatoes:audience and rottentomatoes:critic, normalised to 0–100. Raw is the sum of their squares. Residual is Raw × 1.025^explicitNoCount + stableRankSeed × 0.00001. All active members explicitly Seen (or an empty active roster) makes the candidate ineligible; residual becomes negative. Missing required scores means Needs Data and no calculated score. Unknown neither counts as No nor Seen. Metacritic, Letterboxd and TMDB are auditable extra ratings only. Ranked Watch Order excludes Needs Data and disqualified candidates.

Effective retrieval precedence for IMDb and RT critic is MDBList, OMDb, legacy spreadsheet, development demo, unspecified; RT audience uses MDBList then legacy (OMDb does not fabricate audience). TMDB prefers direct TMDB over MDBList. The latest usable snapshot within the preferred service wins; actual-time comparisons, optional private legacy preference and later legacy source ordinal resolve equal captures deterministically, with a stable final record fallback. API captures supersede legacy bootstrap values even if a legacy timestamp is newer. All snapshots remain stored.

Classics membership holds a stable seed. Migration backfills existing members in movie-ID order; SQL triggers allocate new seeds using a persistent counter inside the insert transaction. Removal retains each movie's allocation, so readdition restores its seed and deletion never renumbers others. Legacy local apply supplies minimum worksheet row seeds after canonical duplicate reconciliation. This is a tie-breaker, not quality.

## Cycles, refresh and dry-run

Migration 0003 introduced cycles, kind/precision and optional cycle slots; 0005 adds product state without changing 0001-0004. `cycles.rough_date` now means the cycle anchor established by nominal slot 1 (Sean), independently of every session event date. A new cycle requires hosted nominal slot 1, an exact event date and a matching anchor. New slot-1 records attached to existing cycles must match their anchor. Slots 2-5 retain independently chosen exact dates; dates are never derived from week offsets or forced to Sunday. Editing nominal slot 1 to a different exact date requires explicit `correct_anchor:true` confirmation. It atomically corrects the anchor and unknown legacy reference dates, with audits; later exact dates and rotation remain unchanged. Migration 0006 prevents multiple active records in any cycle slot. Later-slot edits cannot retime the anchor. Imported Ruff Date is exact for slot 1; later slots have genuinely unknown dates and use `cycle_rough` with the anchor as reference. History and film detail label this reference separately from exact event dates. The cycle heading identifies the anchor, with nominal slot order making no chronological claim. Existing ungrouped sessions remain compatible.

Source score history gains retrieved_via and optional upstream_updated_at, without inventing upstream timestamps. MDBList uses documented single Media Info and bounded POST batch Media Info routes; OMDb uses IMDb IDs and stores IMDb, supplied RT critic and Metacritic only. ScoreService uses MDBList first, then calls OMDb only where it can fill a currently missing Watch Order input; TMDB is not called for score refresh because its rating is not a required input. Within a bulk operation, a provider-wide credential, rate-limit, outage or network failure suppresses further calls to that provider, while a single-film refresh remains independent. Explicit 429 responses persist a small D1 provider cooldown through Retry-After; calls during it make no network request and no automatic retry occurs. Provider payloads and credential-bearing URLs never enter API responses.

Film detail manages Classics membership and explicit score refresh; it shows effective raw ratings, votes, service and capture times with the three algorithm inputs marked. Classics has Ranked, Needs Data and Disqualified views and explicit enrichment for up to 10 identifiable missing-score candidates. MDBList groups IDs into at most two batches and OMDb uses only useful bounded single-ID fallbacks; no TMDB rating calls occur in this workflow. Title-only candidates remain unresolved until identification; no background job or page-load provider calls exist. Browser enrichment timeout is 65 seconds for bounded slow provider calls.

See [legacy domain model](docs/LEGACY_SPREADSHEET_MODEL.md) and [dry-run workflow](scripts/import/README.md). The spreadsheet parser remains network-free and writes only ignored plans/reports. A separate resolver provides conservative offline links, optional capped/resumable TMDB lookups and private overrides. Local apply is guarded by matching archive snapshotCapturedAt, zero blockers and preview member/schema validation; it uses only the isolated local D1 emulator. Migration 0004 preserves multiple source refs and same-time conflicting observations. See the linked workflow for exact commands, override format and atomicity/resume boundaries. Production apply is impossible through these tools.

## API, CORS and writes

All routes are under `/api/v1`; success is `{ "data": ... }`, failure is `{ "error": { "code", "message", "fields"? } }`. Zod validates inputs and calendar dates. JSON bodies are bounded to 128 KiB. Invalid inputs return 422, malformed JSON 400, missing resources 404, missing/invalid/expired sessions or invalid Google credentials 401, unauthorised Google accounts/disallowed origins 403, unavailable imports 503. Provider search errors are returned as an unavailable lookup alongside usable local search results. Internal errors return a safe generic message.

| Method / route | Behaviour |
| --- | --- |
| `GET /health` | Public non-sensitive capabilities: environment, demo, authenticationRequired, googleAuthConfigured, tmdbConfigured, mdblistConfigured, omdbConfigured |
| `POST /auth/google` | Public `{credential}`; verify Google and allow-list, return `{token,viewer,expiresAt}` |
| `GET /auth/me` | Bearer session required; return `{viewer: {id,display_name,sort_order,avatar,role}}` (null under local bypass) |
| `POST /auth/logout` | Bearer session required; revoke current session and return `{loggedOut: true}` |
| `GET /catalog`, `/members`, `/movies`, `/sessions`, `/classics` | Authenticated stored/derived data |
| `GET /movies/search?q=...` | Saved search plus optional provider search |
| `GET /cycles` | Authenticated cycle records |
| `PUT /movies/:id/classics` | `{classic: boolean}`; add/remove membership, preserve movie and seed |
| `POST /movies/:id/refresh-scores` | Explicit capture; `{movie, providers}` with safe partial results |
| `POST /classics/enrich` | `{limit?: 1–10}`; `{results,remaining,unidentified}` for missing-score candidates |
| `POST /movies/enrich-metadata` | Admin-only `{limit?: 1–10}`; safe per-film metadata results plus remaining unchecked identified films/unidentified count; internal IDs/history preserved |
| `GET /movies/:id` | Film detail including appearances and ranking |
| `POST /movies` | Manual film `{title, year?, runtime?}` |
| `POST /movies/import` | Persist `{provider: "tmdb", externalId}` snapshot |
| `GET /sessions/:id` | One event with ordered films |
| `POST /sessions`, `PUT /sessions/:id` | Create/replace `{event_date, title?, host_member_id?, legacy_cycle_label?, notes?, movie_ids, cycle_id?, new_cycle?: {rough_date,title?,ordinal?}, kind?, date_precision?, cycle_slot?, swap_note?, complete_turn?, turn_version?, correct_anchor?}`; edits never complete a turn |
| `GET /avatars` | Concrete viewer required; available integers 0-19 only |
| `POST /auth/avatar` | `{avatar: 0-19}`; claim for the session viewer once, 409 on collision/already chosen |
| `GET /rotation` | Explicit singleton rotation or null before private initialisation |
| `PUT /rotation` | Admin-only `{cycle_id,nominal_slot:1-5,version:number|null,reason}`; stale version returns 409 |
| `GET /builders`, `GET /builders/:id` | Only session owner's unpublished sets; guessed other-owner IDs return 404 even for admins |
| `POST /builders`, `PUT /builders/:id` | `{title?,notes?,movie_ids,revision?}`; ordered canonical IDs, empty drafts and 4+ films supported; PUT requires current revision |
| `DELETE /builders/:id` | `{revision}`; owner-only permanent private deletion |
| `POST /builders/:id/publish` | `{revision,event_date,cycle_id,cycle_slot,complete_turn,turn_version?,swap_note?,new_cycle?}`; atomic publish, nonempty lineup, owner as actual hosted publisher |
| `GET /sessions/:id/audit` | Club-visible append-only actor/time/action/change trail, including deleted records |
| `DELETE /sessions/:id` | Audited soft deletion; rotation unchanged |
| `POST /sessions/:id/restore` | Admin-only restore; 409 if the active cycle slot is occupied; rotation and Seen unchanged |
| `PUT /movies/:id/seen/:memberId` | `{seen: true | false | null}` |

CORS reflects only configured exact origins, never `*`. Production uses `https://n-plus-plus.github.io` (the browser canonicalises the supplied `https://N-Plus-Plus.github.io` hostname to lowercase; origins have no `/BookClub/` path). It permits `Authorization` and `Content-Type`, with no cookie credentials. CORS is separate from authentication: requests without Origin still require a BookClub session. All application GETs and mutations are private; only health, Google login and preflight are public. Authenticated members can use the existing shared editing workflows, including answers for any club member.

## Google authentication and sessions

The static frontend checks public health first. With `APP_ENV=local` **and** `LOCAL_WRITE_BYPASS=true`, all existing demo reads/writes work without Google, internet or a session. Either flag alone cannot bypass authentication. Otherwise it tries `/auth/me` with the saved session before loading private data, or displays the private-journal sign-in gate with Google's official branded button. The signed credential is immediately exchanged with the Worker and is never stored for continuing authentication. Unauthorised Google accounts get a clear 403; BookClub has no registration, password, invitation code or public member creation route.

The Worker uses `jose` and Google's cached remote JWKs to verify RS256 signature, exact configured audience, either valid Google issuer, expiry, nonempty sub/email and boolean `email_verified === true`. No tokeninfo calls or OAuth client secret are used. Verification follows [Google's server verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token); `jose` supports [Cloudflare Workers](https://github.com/panva/jose).

Before first login, an operator creates four `members` plus four `member_auth` rows with lowercase trimmed authorised Google Account emails and null sub. A single guarded SQL UPDATE binds a matching email to its first verified sub and records timestamps. Existing sub matches take precedence even if email later changes. An email already bound to another sub is denied; no login inserts a member or allow-list row. Do not rewrite bindings as part of a bootstrap rerun. Provision the intended Google Account identities, which may use non-Gmail email addresses. Disabled members, deleted allow-list entries, expired or revoked sessions cannot access data.

The Worker generates a random 256-bit opaque bearer token and stores only its SHA-256 hash in D1. Tokens expire after 90 days. Hash lookup uses indexed SQL equality; no raw-secret comparison or application signing secret is needed. Tokens travel only in HTTPS response bodies and `Authorization: Bearer ...`, never URLs or logs. Stored hashes and authorised emails are not returned by the API. Logout deletes the current session; operator revocation can delete all `auth_sessions` for a member, or deactivate the member to block all access and subsequent login. Expired rows are inert; periodic pruning is an optional operator task, not a scheduled integration.

The browser deliberately stores the BookClub token in `localStorage` (`bookclub.session`) because Pages and Worker are cross-site and third-party cookies are unreliable. A 401 clears the saved token and private UI state. Clearing browser storage also signs the device out but does not itself revoke the server row. Logout clears storage after confirmed revocation; a network failure offers retry instead of claiming server logout succeeded. An authenticated member with `avatar=null`, including an existing session, sees the full-screen chooser before any private application screen loads. The 20 fixed assets are unmodified; a DB unique index protects claims, with 409 conflict recovery and refreshed choices. Selection never requires another Google login and normal UI cannot change it afterwards. The selected avatar sits above the uppercase database name at top-right; Logout is subordinate. Local bypass has no concrete viewer, so it does not impersonate a member or grant personal Builder/admin actions.

This persistence trades convenience for XSS exposure: scripts on the Pages origin can access localStorage, including other apps hosted on the same origin. Only deploy trusted code on that origin. React escaping remains in use; there is no raw HTML injection or user-controlled script execution. The only added script is the fixed official GIS library URL. Treat a stolen Google ID credential as replayable until Google expiry and a stolen BookClub bearer token as usable until expiry/revocation; keep them out of diagnostics.

The existing Google Web Application client should authorise JavaScript origin `https://N-Plus-Plus.github.io` (optional local testing: `http://localhost:5173`). The GIS popup callback needs no redirect URI or mail, Drive or Calendar scopes. Set matching `VITE_GOOGLE_CLIENT_ID` and Worker `GOOGLE_CLIENT_ID`; neither value is a secret. Local bypass never loads GIS.

## Private member bootstrap

The guarded cutover workflow in [scripts/import/PRODUCTION.md](scripts/import/PRODUCTION.md) owns initial production provisioning. Its ignored `.verification/production/bootstrap.local.json` carries the four real names and authorised Google Account emails; no private value enters tests, tracked files or frontend builds. Preserve `club-member-1` through `club-member-4` in positional order: Sean, Troy, Matt, Jess. Initial roles are explicitly Sean/Troy `admin`, Matt/Jess `member`, with null avatars and Google subs. All four email fields must be supplied privately before execution.

The authorised initial rotation is open Classics/slot 5/version 0 on reviewed cycle 55. Bootstrap creates no current event or next cycle. The first real Classics completion advances to Sean/slot 1; Sean's next slot-1 publication creates the cycle. Conflicting members/auth or advanced/occupied rotation are rejected, and identical pre-launch reruns are safe. The older SQL example is retained only as a historical manual template; its `INSERT OR IGNORE` behaviour is insufficient for the guarded cutover. Never provision the development seed to production.

## Production release and verification

The production application Worker is **bookclub-api**, at **https://bookclub-api.troy-nissen.workers.dev**. The frontend is **https://n-plus-plus.github.io/BookClub/**, published through the existing **Publish frontend to GitHub Pages** Actions workflow. GitHub Pages uses GitHub Actions as its source. Both deployments use the reviewed main revision; deployment does not run the historical importer.

The top-level `worker/wrangler.jsonc` binds the existing `bookclub-prod` database, retains `APP_ENV=production`, `LOCAL_WRITE_BYPASS=false`, and allows only `https://n-plus-plus.github.io`. Worker runtime bindings configured through Wrangler's supported secret mechanism are `GOOGLE_CLIENT_ID`, `TMDB_READ_TOKEN`, `MDBLIST_API_KEY` and `OMDB_API_KEY`. The Google client ID is public, despite using a secret binding. Cloudflare account ID/API token are operator-only; TVDB remains unused. Never deploy `--env local`, publish provider credentials to Vite, or deploy the retired cutover runner.

GitHub repository Actions variables `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID` supply the public frontend configuration. The API base is the Worker origin above, without `/api/v1` or a trailing slash. The client ID must match the Worker's audience. An ignored root `.env.production.local` containing only these two public values supports local production builds; ordinary development and the isolated import-preview mode retain their local API behaviour.

For a separately authorised future release:

1. Review current main, migrations and production configuration. Run `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm prod:check` and `git diff --check`. Run `prod:check --frontend` with the two public variables in the process environment.
2. Configure changed runtime bindings with `wrangler secret put` interactively or `wrangler secret bulk` through stdin; never put values on command lines or in tracked config. Deploy only `corepack pnpm exec wrangler deploy --config worker/wrangler.jsonc`.
3. Verify public `GET /api/v1/health` reports production, authentication required and expected provider/auth configuration. Private reads and unauthenticated mutations must return 401; a nonexistent bearer token must fail the D1 session lookup. Intended-origin preflight must succeed, arbitrary origins must be rejected. These checks create no sessions or film events.
4. Confirm the two repository Actions variables, then manually dispatch **Publish frontend to GitHub Pages** on reviewed main. The workflow tests, typechecks, checks public configuration, builds and publishes only `dist/`.
5. Verify the Pages shell, JS/CSS, bundled fonts, all 20 member avatars, reserved Classics `a.png`, icons, hash-route refresh and Worker health request. Inspect the build for localhost/import-preview URLs, private emails, credential values and private archive content.

Automated release checks passed: private sign-in gate and official Google control render in a mobile-sized browser without runtime errors, horizontal overflow, mixed content or failed requests. All 63 published files match the local production build (text line endings normalised). Live authenticated Home/History/Builder screens and real Google login remain owner checks; underlying production catalog, History, Metrics and canonical Watch Order were verified read-only without bypassing API authentication or creating sessions.

The owner must verify the existing Google **Web Application** client's **Authorized JavaScript origins** includes exactly `https://n-plus-plus.github.io` (no path). The GIS popup callback requires no redirect URI or additional scopes. Google Console settings were not accessible during release; rendering the official button does not prove real login succeeds. Audience, signature, issuer and verified-email validation remain enforced in the Worker.

Owner smoke checklist:

- Sign in as Troy; confirm Troy identity, initial avatar chooser, normal application access and admin controls. Choose an avatar.
- Sign in as a second authorised member in a separate browser/profile; confirm correct identity and exclusion of Troy's selected avatar.
- Confirm Home's current turn is Classics, History and Metrics are populated, Watch Order is populated, and Builder loads.
- Save a disposable Builder set as one member; confirm the other member cannot see it, then delete it as its owner without publishing.

Leave cycle 55 / Classics slot 5 / version 0 open during these checks. The current Classics event has not been created and cycle 56 does not exist. After owner smoke passes, enter the two current Classics films through the normal application UI. Do not rerun import, bootstrap, identity resolution or enrichment as a release check.

Keep the pristine backup and private rehearsal/reconciliation proofs. Once real login occurs, pre-launch archive verification's null-sub/avatar/no-session assumptions no longer apply; do not reset identity or rotation to make that check pass. Future live data mutation requires its own authorised scope.

## Current boundaries and next work

Date-range Metrics, charts, notifications and PWA support are deferred. Event creation and History editing/audit/soft deletion are supported in the UI. Restoration has an admin API, without a full management screen. Navigation away from unsaved Event or Builder changes discards those changes; explicitly saved Builder sets persist privately in D1. Saved manual films remain in the canonical shared library. Recent answer undo is limited to the current Seen It? visit; persisted answers can always be corrected from film detail. History currently loads the small whole catalog; pagination can follow after migration size is known.

Tracked release readiness includes migrations through 0008, Metrics and bounded admin metadata enrichment. `pnpm prod:check` statically validates production/bypass/CORS, DB binding shape, contiguous migrations and isolated preview configuration without authenticating or accessing Cloudflare. `pnpm prod:check --frontend` additionally validates public build variables from the process environment (not ignored env files); the Pages workflow runs it before its production build. Run `pnpm build` separately. Passing this check does not verify remote bindings, Worker secrets or a matching GIS audience.

Real archive reconciliation and the exact isolated local rehearsal are complete. The authorised capture, canonical year decisions, Sean/Troy admin roles and open Classics/slot-5 cutover state are settled. Production migrations, historical import and private member/auth provisioning are complete and verified. The pristine pre-migration backup is retained. Production runtime bindings, application Worker deployment, Pages publication and automated public/browser smoke checks are complete. Real Google login, authenticated multi-user checks and owner mobile visual checks remain pending. No private archive artifact is needed for ordinary development or tests.
