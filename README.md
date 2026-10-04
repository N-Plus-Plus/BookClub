# BookClub

A mobile-first film journal for a four-person weekly film club. Track event history, keep private Builder film sets, complete explicit club turns, inspect a persisted Classics watch order, and quickly fill missing Seen It? answers.

This is a functional local-first foundation. All bundled events and source ratings are **development examples**, not real club history or live provider ratings. The historical ranking formula, cycle model and safe spreadsheet dry-run and staged identity resolution with a guarded local D1 import preview are implemented; production import remains separately authorised. Repository: `N-Plus-Plus/BookClub`.

## Architecture and layout

| Path | Responsibility |
| --- | --- |
| `frontend/` | React/TypeScript UI, dedicated API client, hash routing, mobile layouts |
| `style.css` | Original authoritative dark visual system, preserved unchanged |
| `frontend/app.css` | Mobile layout extensions, 44px controls, safe areas, responsive cards |
| `shared/types.ts` | Provider-neutral API/domain contracts |
| `shared/ranking.ts` | Historical ranking, score normalisation, retrieval precedence, stable ordering, missing-answer queue |
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

Selecting a TMDB result persists canonical metadata, TMDB/IMDb IDs where available, poster/backdrop references and a TMDB score snapshot. Repeated selections reuse known external IDs; no scheduled refreshes are implemented. Optional MDBList and OMDb rating adapters support explicit enrichment. Bundled ratings remain fictional development snapshots; no sites are scraped. Provider contracts were checked against the [official MDBList API schema](https://api.mdblist.com/docs/) and [OMDb documentation](https://www.omdbapi.com/).

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

Migration `0005_product_state.sql` adds nullable integer member avatars (0–19, unique even for inactive members), durable `member`/`admin` roles, singleton `club_rotation`, private `builder_sets`/ordered `builder_movies`, session planning/publication/soft-delete metadata and relational `history_audit`. No fifth member represents Classics: reusable identity presentation explicitly supports either a database member or `CLSC` with the reserved `avatars/a.png`. All asset URLs use Vite's base; member names are uppercased only for presentation. Root styling, Lucide and bundled Lexend Deca remain in use. Builder replaces Event in the five-item mobile navigation; direct Event creation remains available from Home and History.

Builder supports multiple private sets per member, optional title/note, timestamps and ordered canonical movie IDs. There is no planned event date, three-film ceiling, sharing or copying. Search/import/manual creation reuse the same film picker as direct events. Every Builder route derives its owner from the authenticated session. **Even administrators cannot list, inspect, edit, delete or publish another member's unpublished Builder**, including its title, notes, film IDs or counts. Other-owner and nonexistent IDs both return 404. No Builder data enters the catalog. Local bypass has no owner; personal workflows need a concrete session. Development tests use fictional allow-list/session rows, not production identities.

Publish first saves the private edits, then shows the chosen event date (default: today's browser-local calendar date), current turn/cycle and actual host. Dates may be past or future. Title/note become shared History metadata on publication. A single D1 batch verifies the Builder revision, creates the event/ordered joins, removes the Builder, appends its audit and optionally completes the current turn. `sessions.planned_at` permanently retains the Builder's original `created_at`; `published_by`, Builder reference/revision and completed-turn version are immutable publication metadata. No history edit, soft deletion or restoration resets the planning timestamp. Any failure rolls back all effects, including a newly created cycle and Seen answers.

Rotation follows active member positions 1→2→3→4→5 (hostless Classics)→1. It is stored explicitly with a cycle ID, nominal slot, version and updated timestamp, never calculated from calendar dates. Deferral performs no mutation. Only creation/publication with explicit `complete_turn:true`, current `turn_version`, current slot and matching cycle advances once. Slot 1 creates a new cycle using its actual event date as the anchor; subsequent slots use that cycle and independent exact dates. Classics completes it, leaving slot 1 with no cycle until the next slot-1 publication. Ordinary history/backfill creation defaults to no completion, and editing an existing record cannot complete another turn. Home shows the nominal identity and anchor, with added emphasis when it is the viewer's turn.

Actual hosted member and nominal slot are separate. Any member may record an event; Builder publication uses its owner as actual host. Off-turn current publication requires an explicit `swap_note`, with a visible warning and a deliberate alternative to record another historical cycle/slot without advancing rotation. No admin approval is needed. A swap records the actual host and explanation without changing member sort order or the permanent sequence. Classics remains hostless. The return leg of a swap is recorded explicitly when that nominal turn is fulfilled; there is no automatic future host assignment or scheduler.

Qualifying **current** Classics publication transactionally sets every lineup film Seen=Yes for all active members. Hosted events, old/backfilled Classics, edits and restores never apply this side effect. All History mutations append actor, time, action and structured before/after/order/turn details. Legacy imports predate application auditing; local bypass audit actors are null and displayed as local demo. Ordinary deletion sets `deleted_at`/`deleted_by`, preserving the session, ordered joins and audit; default History, catalog and film appearances exclude it. Admin restore is available through the API; an unknown legacy reference date follows the current corrected anchor on restore. Edits/deletion of a turn-completing event flag rotation review in the audit while keeping rotation unchanged. Admin corrections require a reason and current version, are separately audited, and never gain Builder access. Concurrent Builder edits, stale publications and turn corrections return safe 409 conflicts; refresh before retrying. History replacement remains last-write-wins.

## Historical Classics calculation

All policy lives in shared/ranking.ts. Required inputs are imdb:rating, rottentomatoes:audience and rottentomatoes:critic, normalised to 0–100. Raw is the sum of their squares. Residual is Raw × 1.025^explicitNoCount + stableRankSeed × 0.00001. All active members explicitly Seen (or an empty active roster) makes the candidate ineligible; residual becomes negative. Missing required scores means Needs Data and no calculated score. Unknown neither counts as No nor Seen. Metacritic, Letterboxd and TMDB are auditable extra ratings only. Ranked Watch Order excludes Needs Data and disqualified candidates.

Effective retrieval precedence for IMDb and RT critic is MDBList, OMDb, legacy spreadsheet, development demo, unspecified; RT audience uses MDBList then legacy (OMDb does not fabricate audience). TMDB prefers direct TMDB over MDBList. The latest usable snapshot within the preferred service wins; actual-time comparisons, optional private legacy preference and later legacy source ordinal resolve equal captures deterministically, with a stable final record fallback. API captures supersede legacy bootstrap values even if a legacy timestamp is newer. All snapshots remain stored.

Classics membership holds a stable seed. Migration backfills existing members in movie-ID order; SQL triggers allocate new seeds using a persistent counter inside the insert transaction. Removal retains each movie's allocation, so readdition restores its seed and deletion never renumbers others. Legacy local apply supplies minimum worksheet row seeds after canonical duplicate reconciliation. This is a tie-breaker, not quality.

## Cycles, refresh and dry-run

Migration 0003 introduced cycles, kind/precision and optional cycle slots; 0005 adds product state without changing 0001-0004. `cycles.rough_date` now means the cycle anchor established by nominal slot 1 (Sean), independently of every session event date. A new cycle requires hosted nominal slot 1, an exact event date and a matching anchor. New slot-1 records attached to existing cycles must match their anchor. Slots 2-5 retain independently chosen exact dates; dates are never derived from week offsets or forced to Sunday. Editing nominal slot 1 to a different exact date requires explicit `correct_anchor:true` confirmation. It atomically corrects the anchor and unknown legacy reference dates, with audits; later exact dates and rotation remain unchanged. Multiple active slot-1 records block this correction until reconciled. Later-slot edits cannot retime the anchor. Imported Ruff Date is exact for slot 1; later slots have genuinely unknown dates and use `cycle_rough` with the anchor as reference. History and film detail label this reference separately from exact event dates. The cycle heading identifies the anchor, with nominal slot order making no chronological claim. Existing ungrouped sessions remain compatible.

Source score history gains retrieved_via and optional upstream_updated_at, without inventing upstream timestamps. MDBList uses documented single Media Info and bounded POST batch Media Info routes; OMDb uses IMDb IDs and stores IMDb, supplied RT critic and Metacritic only. ScoreService centralises enrichment, persists snapshots once per source/metric/service per refresh, retains older data, then derives rank from current persisted state. Providers fail independently with safe messages; MDBList/OMDb HTTP 429 surfaces bounded Retry-After without automatic retry. Public health exposes configuration booleans only. Provider payloads and credential-bearing URLs never enter API responses.

Film detail manages Classics membership and explicit score refresh; it shows effective raw ratings, votes, service and capture times with the three algorithm inputs marked. Classics has Ranked, Needs Data and Disqualified views and explicit enrichment for up to 10 identifiable missing-score candidates. MDBList groups IDs into at most two batches; OMDb/TMDB use bounded per-film requests. Title-only candidates remain unresolved until identification; no background job or page-load provider calls exist. Browser enrichment timeout is 65 seconds for bounded slow provider calls. TheTVDB remains an unused Worker-only placeholder.

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
| `POST /sessions/:id/restore` | Admin-only restore; rotation and Seen unchanged |
| `PUT /movies/:id/seen/:memberId` | `{seen: true | false | null}` |

CORS reflects only configured exact origins, never `*`. Production uses `https://n-plus-plus.github.io` (the browser canonicalises the supplied `https://N-Plus-Plus.github.io` hostname to lowercase; origins have no `/BookClub/` path). It permits `Authorization` and `Content-Type`, with no cookie credentials. CORS is separate from authentication: requests without Origin still require a BookClub session. All application GETs and mutations are private; only health, Google login and preflight are public. Authenticated members can use the existing shared editing workflows, including answers for any club member.

## Google authentication and sessions

The static frontend checks public health first. With `APP_ENV=local` **and** `LOCAL_WRITE_BYPASS=true`, all existing demo reads/writes work without Google, internet or a session. Either flag alone cannot bypass authentication. Otherwise it tries `/auth/me` with the saved session before loading private data, or displays the private-journal sign-in gate with Google's official branded button. The signed credential is immediately exchanged with the Worker and is never stored for continuing authentication. Unauthorised Google accounts get a clear 403; BookClub has no registration, password, invitation code or public member creation route.

The Worker uses `jose` and Google's cached remote JWKs to verify RS256 signature, exact configured audience, either valid Google issuer, expiry, nonempty sub/email and boolean `email_verified === true`. No tokeninfo calls or OAuth client secret are used. Verification follows [Google's server verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token); `jose` supports [Cloudflare Workers](https://github.com/panva/jose).

Before first login, an operator creates four `members` plus four `member_auth` rows with lowercase trimmed authorised emails and null sub. A single guarded SQL UPDATE binds a matching email to its first verified sub and records timestamps. Existing sub matches take precedence even if email later changes. An email already bound to another sub is denied; no login inserts a member or allow-list row. Do not rewrite bindings as part of a bootstrap rerun. For this club provision the intended Gmail identities; Google cautions that verified third-party email ownership can change. Disabled members, deleted allow-list entries, expired or revoked sessions cannot access data.

The Worker generates a random 256-bit opaque bearer token and stores only its SHA-256 hash in D1. Tokens expire after 90 days. Hash lookup uses indexed SQL equality; no raw-secret comparison or application signing secret is needed. Tokens travel only in HTTPS response bodies and `Authorization: Bearer ...`, never URLs or logs. Stored hashes and authorised emails are not returned by the API. Logout deletes the current session; operator revocation can delete all `auth_sessions` for a member, or deactivate the member to block all access and subsequent login. Expired rows are inert; periodic pruning is an optional operator task, not a scheduled integration.

The browser deliberately stores the BookClub token in `localStorage` (`bookclub.session`) because Pages and Worker are cross-site and third-party cookies are unreliable. A 401 clears the saved token and private UI state. Clearing browser storage also signs the device out but does not itself revoke the server row. Logout clears storage after confirmed revocation; a network failure offers retry instead of claiming server logout succeeded. An authenticated member with `avatar=null`, including an existing session, sees the full-screen chooser before any private application screen loads. The 20 fixed assets are unmodified; a DB unique index protects claims, with 409 conflict recovery and refreshed choices. Selection never requires another Google login and normal UI cannot change it afterwards. The selected avatar sits above the uppercase database name at top-right; Logout is subordinate. Local bypass has no concrete viewer, so it does not impersonate a member or grant personal Builder/admin actions.

This persistence trades convenience for XSS exposure: scripts on the Pages origin can access localStorage, including other apps hosted on the same origin. Only deploy trusted code on that origin. React escaping remains in use; there is no raw HTML injection or user-controlled script execution. The only added script is the fixed official GIS library URL. Treat a stolen Google ID credential as replayable until Google expiry and a stolen BookClub bearer token as usable until expiry/revocation; keep them out of diagnostics.

The existing Google Web Application client should authorise JavaScript origin `https://N-Plus-Plus.github.io` (optional local testing: `http://localhost:5173`). The GIS popup callback needs no redirect URI or Gmail/Drive/Calendar scopes. Set matching `VITE_GOOGLE_CLIENT_ID` and Worker `GOOGLE_CLIENT_ID`; neither value is a secret. Local bypass never loads GIS.

## Private member bootstrap

After production migrations, copy `scripts/auth/bootstrap-members.example.sql` to `scripts/auth/bootstrap-members.local.sql`. Replace **every** name/email placeholder privately with the four real members, normalising each email to lowercase with no surrounding whitespace. Preserve stable `club-member-1` through `club-member-4` IDs. The example contains placeholders only; the populated local file is explicitly gitignored. Never read it into tests, logs or frontend builds, and never apply `worker/seed.sql` to production.

Permanent member positions are 1 Sean, 2 Troy, 3 Matt, 4 Jess. Preserve positional IDs/sort order; production names are database values, never frontend identity logic. Privately assign one or more `admin` roles in the reviewed bootstrap. All other members use `member`; roles are never inferred from email. Avatar starts null for every human. After historical reconciliation, explicitly initialise `club_rotation` using the reviewed current cycle, or the authenticated admin correction endpoint with `version:null`. Design-time Classics week means slot 5 for that reviewed setup only; migration 0005 contains no current-turn seed. Slot 1 uses `cycle_id:null`, waiting to create its next cycle. Import-preview remains generic Host 1-4 with null avatars, member roles, no auth rows and no automatic rotation.

The template uses `INSERT OR IGNORE`: an identical rerun does not duplicate members or overwrite established sub bindings. It intentionally does not update names/emails, and conflicting IDs/emails may be ignored. Privately review all four rows before execution and verify that there are exactly four intended members and four allow-list rows afterwards using the Cloudflare dashboard. Corrections require a reviewed operator change; do not reset a bound sub casually. The application does not enforce a database-wide count of four; that roster limit is maintained by private provisioning.

## First production deployment — human steps only, not performed

Review code and migration first. These are intentional remote operations for the owner, **not** local verification commands. Use the top-level production binding for `bookclub-prod`; the existing database ID is preserved. Never deploy `--env local`, use the demo seed remotely, or deploy a bypass configuration.

1. Authenticate: `pnpm exec wrangler login`.
2. Confirm top-level database ID and exact Pages CORS origin in `worker/wrangler.jsonc`, then apply migrations: `pnpm exec wrangler d1 migrations apply DB --config worker/wrangler.jsonc --remote`.
3. Create and privately review `scripts/auth/bootstrap-members.local.sql` as above.
4. Apply it intentionally: `pnpm exec wrangler d1 execute DB --config worker/wrangler.jsonc --remote --file scripts/auth/bootstrap-members.local.sql`. Review Wrangler output privately; it may contain personal SQL values. Do not share it in logs/chat. Verify four intended rows in each table privately.
5. Set Worker audience using `pnpm exec wrangler secret put GOOGLE_CLIENT_ID --config worker/wrangler.jsonc` (a secret binding is convenient here although the ID is public), and optional movie lookup token using `pnpm exec wrangler secret put TMDB_READ_TOKEN --config worker/wrangler.jsonc`. Enter values interactively. Retain `APP_ENV=production`, `LOCAL_WRITE_BYPASS=false`, and configured exact origin.
Optional Worker-only rating keys are MDBLIST_API_KEY and OMDB_API_KEY, set through wrangler secret put. TVDB_API_KEY is unused. No movie-provider key belongs in a VITE variable.

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

Production spreadsheet apply, remaining private identity decisions, Metrics, reporting, charts, notifications and PWA support are deferred. Event creation and History editing/audit/soft deletion are supported in the UI. Restoration has an admin API, without a full management screen. Navigation away from unsaved Event or Builder changes discards those changes; explicitly saved Builder sets persist privately in D1. Saved manual films remain in the canonical shared library. Recent answer undo is limited to the current Seen It? visit; persisted answers can always be corrected from film detail. History currently loads the small whole catalog; pagination can follow after migration size is known.

The next product pass is Metrics plus final deployment readiness, after the state model has owner review. Production launch still requires archive snapshotCapturedAt, identity reconciliation, privately provisioned names/roles/auth, reviewed current rotation, authorised production import and deployment, and live Google/mobile checks. Review private analysis, run the capped resolver until network work is complete, settle genuine ambiguity through private overrides, supply the archive capture timestamp, then preflight/apply and inspect the isolated local preview. Production import needs a future separately authorised pass. Production authentication is implemented; remote migration, private roster provisioning, runtime configuration and the human deployment checks above remain pending.
