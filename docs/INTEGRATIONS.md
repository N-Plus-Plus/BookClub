<!--
AGENT MAINTENANCE INSTRUCTION

Build this document only as real integrations are added.

ARCHITECTURE.md should contain only a summary of external services. This file owns the operational and behavioural detail needed to understand, develop, test, or replace each integration.

Update it whenever:
1. implementation work changes provider use, credentials, endpoints, payloads, provider precedence, retries, rate limits, caching, fallbacks, or failure behaviour; or
2. other work reveals that this document no longer matches the actual integration.

Do not record secret values. Record secret names, binding names, scopes, and where they are supplied.
-->

# INTEGRATIONS.md

## Integration index

| Integration | Purpose / environments | Required configuration |
| --- | --- | --- |
| Google GIS / JWKs | Production login; optional explicit local auth testing | Public `VITE_GOOGLE_CLIENT_ID`, Worker `GOOGLE_CLIENT_ID`, private D1 member allow-list |
| TMDB | Explicit search/import/metadata maintenance; optional bounded operator resolver | `TMDB_READ_TOKEN` bearer read token |
| MDBList | Primary explicit multi-rating capture | `MDBLIST_API_KEY` |
| OMDb | Useful missing-input IMDb-ID fallback | `OMDB_API_KEY` |
| Cloudflare D1 / Wrangler / REST | API persistence, local emulation, guarded operator export/import | Worker `DB`; operator login or process-only Cloudflare credentials |
| GitHub Actions / Pages | Frontend build/publication | Public Actions variables for API origin/Google client |

Architectural summaries: [ARCHITECTURE](ARCHITECTURE.md). Stored meaning: [DATA](DATA.md). Application-facing payloads: [CONTRACTS](CONTRACTS.md). No scraping or TVDB API is active; `TVDB_API_KEY` is an unused example-file placeholder, not a required binding.

## Google Identity Services

Owners: `frontend/SignInScreen.tsx`, `frontend/api.ts`, `worker/src/auth.ts`, `auth-repository.ts`. The browser loads fixed official `https://accounts.google.com/gsi/client`, renders Google's button and exchanges popup credential with POST `/auth/google`. Worker fetches/cache-resolves keys at `https://www.googleapis.com/oauth2/v3/certs` via jose `createRemoteJWKSet`; no tokeninfo call, OAuth client secret, redirect URI or mail/Drive/Calendar scopes are used.

Configure the Web Application client for exact origin `https://n-plus-plus.github.io`, optionally localhost:4173 for deliberate local auth testing. Match public frontend ID and Worker audience. Provider keys belong in ignored `worker/.dev.vars.local` locally or supported Wrangler secrets in production; the Google client ID remains public even when stored using the secret mechanism.

Verification requires RS256 signature, configured audience, Google issuer (`accounts.google.com` or HTTPS form), exp, nonempty sub/email and boolean verified email. D1 first binds a privately allow-listed email to its sub atomically; established sub takes precedence and never silently rebinds. Login never creates members/allow-list. Invalid credentials return 401, unauthorised account 403, missing config or unavailable keys 503. No automatic login retry masks failure.

The app token is random 256-bit opaque bearer, expires after 90 days; only SHA-256 hash is stored in D1. Browser stores it at `bookclub.session` in localStorage because Pages/Worker are cross-site. A 401 clears session/private UI; confirmed logout revokes hash, while failed logout offers retry. Browser storage clearing does not revoke server row. Trusted scripts on the Pages origin can access localStorage; keep credentials out of URLs/logs and deploy only trusted code. Google credential is exchanged immediately and not stored as app authentication.

Double-flag local bypass never loads GIS and needs no internet/account. Auth tests inject verifiers or local signing keys and disposable D1, never real users. Existing app sessions authenticate against D1 without a new Google call. Null avatar gates private UI to the one-time chooser. Ordinary Vite development shows **Log in as Troy** instead of GIS and uses the existing `bookclub.dev-member` / `X-BookClub-Dev-Member` path with `club-member-2`; `/auth/me` reads the existing active member’s stored avatar and role. No member, bearer session or Google binding is created. Local logout clears the selected identity. Local login and subsequent reloads gate missing avatars through the same chooser before loading the catalog. The authenticated local selector remains available for concrete owner/admin workflows; isolated import preview retains its existing anonymous bypass. Production builds expose only Google authentication and the production Worker ignores dev identity headers.

## TMDB

Owners: `worker/src/providers/tmdb.ts`, `services.ts`, `repository.ts`; eligibility/sizing in `shared/metadata.ts`, `artwork.ts`; explicit resolver in `scripts/import/tmdb-resolution.ts`. Credential is Worker bearer `TMDB_READ_TOKEN`; resolver reads process env first then an explicitly supplied ignored env file, never OWNER_INFO.md.

| Operation | Input / output used |
| --- | --- |
| GET `/3/search/movie?query=...&include_adult=false` | Search title; app takes first 20 results with ID/title/year/poster reference |
| GET `/3/movie/:id?append_to_response=external_ids` | Canonical title/original title/release date/runtime/overview/genres, safe external IDs, poster/backdrop and rating/votes |
| GET `/3/movie/:id?append_to_response=credits` | Read-only search preview identity/artwork and crew job Director; no persistence |
| GET `/3/find/:externalId?external_source=imdb_id` | Operator resolver only: conservative IMDb identity evidence |
| Resolver search/details | Capped exact title/year or attached TMDB identity verification; original raw records preserved |

Event search inspection uses a read-only movie-detail preview with `append_to_response=credits`; director names come only from crew job Director and join naturally. FilmPicker enriches only the currently visible six candidates, sequentially, sharing in-flight requests and caching previews/failures by TMDB ID for the mount. Page changes cancel obsolete frontend enrichment; returning to a page reuses cached results. Preview failures leave search results usable with Director: Unknown. Preview checks existing cooldowns without deleting expired rows or persisting new cooldowns, so its complete path has no D1 writes. The read-only preview carries identity/artwork without scores or canonical state.

Yes confirmation reuses known TMDB/IMDb identity or persists one canonical movie and snapshots; inspection/Nope never imports. Builder retains direct create/add/import controls. TMDB's direct 0–10 rating is auditable data, never a Watch Order input. Ordinary screen loads use stored records; images go directly to `image.tmdb.org`. Adapter references use w500/w1280; shared ordinary poster sizing rewrites recognised CDN URLs to w185 (small) / w342 (large). Failed/missing image has a labelled fallback and never requests metadata repair. D1 stores references/preference/dimensions/capture, not bytes.

Metadata selection/counts use narrow movie fields, TMDB identity, genre names and artwork existence queries, without reconstructing the catalogue. Admin POST metadata enrichment takes 1–10 existing valid TMDB identities, sequentially one details call per film. Candidates are unchecked/stale after 150 days or missing poster/backdrop without independent artwork-check marker; absent recognised genres lead priority. Success updates metadata/genres/preferred TMDB assets and both check timestamps atomically, including a legitimate absent image. Historical archive imports stay unchecked. Preserve canonical IDs and History/Seen/seeds/import provenance/score history. Current metadata maintenance writes the returned TMDB title/year as well as other metadata; private importer canonical_year decisions are not a persistent maintenance override. Conflicting verified identity returns per-film conflict instead of merge. Metrics exposes one **Fill missing metadata** action that automatically sequences bounded batches, updating local progress from each response and refreshing the application once on completion or any stop/failure and using batch-response counts rather than the initial catalogue to detect progress, stopping on failure/conflict/cooldown/no progress/zero remaining, navigation or Stop after this batch. Completed work persists and another invocation resumes eligibility.

Provider calls timeout after 8s. Search failure preserves saved matches and explains lookup unavailable. Credentials, network/outage or 429 stop sequential maintenance; safe messages omit raw payloads. D1 cooldown blocks further upstream calls, with parsed Retry-After seconds/date capped at 86400 and default 60 seconds when absent. No automatic retry or scheduled refresh exists. Operators must explicitly refresh stale records within the established six-month metadata cache policy.

Resolver network is explicitly enabled, sequential and capped (default 25, zero cache-only); successful/no-result cache entries are reused, saved atomically after each request. Temporary errors/429 pause with retry window. Exhausting cap leaves reviewable pending work. Never run concurrent writers on a cache. Private verified TMDB/year decisions and raw source provenance are retained; contradictory verified IMDb evidence still blocks apply. Exact commands: [spreadsheet guide](../scripts/import/README.md).

Tests mock fetch/TMDB responses; provider credentials are unnecessary. Local explicit real lookup is optional. Attribution uses bundled approved logo and required notice; retain it. No ordinary page-load enrichment or production provider calls belong in automated tests; visible search-page previews use mocked provider responses.

The ordinary-local pairing CLI (`scripts/dev/pair-tmdb-cli.ts`, `pair-tmdb.ts`) is another explicit operator path: reviewed manifest, stopped API, preflight by default and `--apply` for sequential live details/attachment. It reads process `TMDB_READ_TOKEN` then the normal local secret file, checks returned ID/title/year/provenance and preserves existing identity ownership. It shares TMDB cooldowns, stops on provider-wide failure, saves ignored reports and verifies local integrity/catalog/detail afterwards. It never writes production; see [manifest contract](CONTRACTS.md#ordinary-local-tmdb-pairing-manifest).

Its version-2 runner (`pair-tmdb-round2.ts`, `tmdb-merge.ts`) also reconciles explicitly supplied duplicates. Owner-confirmed identities bypass title/year presentation checks; corrected rejections use corrected expected data. Each successful details response is checkpointed and reused for canonical metadata/artwork and retry after failed writes. Existing merge survivors with metadata and artwork checks fresh within 150 days cause no TMDB request. Calls remain sequential with persisted cooldown and no automatic provider retry; no rating providers or image downloads participate.

## Rating providers

Owners: `worker/src/score-service.ts`, `providers/mdblist.ts`, `omdb.ts`, `ratings.ts`, `http.ts`, `repository.ts`; selection in `shared/ranking.ts`. Explicit member score refresh and bounded missing-score Classics enrichment only. Credentials are Worker-only, supplied in local ignored secret file or production Wrangler secret bindings.

| Provider / actual operation | Data used |
| --- | --- |
| MDBList GET `https://api.mdblist.com/{imdb|tmdb}/movie/:id/?apikey=...` | Media Info ratings/votes; IMDb ID preferred, valid TMDB ID fallback |
| MDBList POST `https://api.mdblist.com/{imdb|tmdb}/movie/?apikey=...` with `{ids:[...]}` | 1–10 IDs per batch; groups by provider, at most two batches per enrichment |
| OMDb GET `https://www.omdbapi.com/?apikey=...&i=tt...&type=movie` | IMDb rating/votes, supplied RT critic percentage, Metascore; never fabricate RT audience |

MDBList maps IMDb scale 10, RT critic/audience 100, Metacritic 100, Letterboxd 5, supplied TMDB 100. Snapshot provenance records `retrieved_via`, fetched time and optional upstream_updated_at only when known. Legacy Letterboxd percentages remain scale 100, not silently converted to native 5.

Capture uses MDBList first; OMDb runs only with valid IMDb ID where it can fill missing required IMDb/RT critic. Missing RT audience alone cannot justify OMDb. TMDB API is never called for score refresh. Bulk work selects up to ten identifiable unrankable Classics; unidentified films remain unresolved. Successful usable snapshots append even if another provider fails. Results explicitly report success/failed/skipped and counts; no automatic retries.

Effective IMDb/RT critic service precedence is MDBList, OMDb, legacy spreadsheet, demo, unspecified; RT audience has no OMDb source. TMDB rating prefers direct TMDB over MDBList. Latest usable actual capture within preferred service wins, then private legacy preference/later source ordinal for tied legacy captures and stable fallback. API observations outrank legacy even if legacy capture timestamp is newer; all original snapshots remain stored.

Shared HTTP failures distinguish not found, credentials, rate limit, outage/network and unusable responses. Eight-second requests bound upstream waits. Provider-wide failure suppresses further calls to that provider within one bulk operation; single refreshes remain independent. Explicit 429 persists per-provider D1 cooldown (Retry-After/default 60s, max 86400); cooldown calls make no network request. OMDb Response False/unrecognised ratings yield safe errors, not raw response leakage. Credential-bearing query URLs must never enter errors/API/logs. Existing snapshots remain usable; missing data stays missing.

Tests use recorded fictional payloads and mocked fetch, including malformed responses, fallbacks and cooldown suppression. No quotas or real accounts are used by automated checks.

## Cloudflare operator and runtime boundaries

Worker runtime uses native `DB.prepare`/`DB.batch`; transactional product rules are in [DATA](DATA.md). Wrangler local emulates D1; no remote destination belongs in ordinary DB scripts.

Explicit production snapshot refresh uses `d1 info` identity read and `d1 export --remote` read/export, then offline restore/local replacement. Operator credentials are Wrangler login or process-only `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` with needed read/export access. Fixed source/destination and suppressed private command output are in `scripts/dev/`.

Separate archive operator tooling uses authenticated `https://api.cloudflare.com/client/v4/accounts/:accountId/d1/database/:databaseId` identity and `/query` calls, and Wrangler exports/migrations. Read-only preflight/verify expose reads; explicit guarded apply opens writable boundary only after exact offline target/hash/capture/export gates. At most 100 statements/request; validate envelope/result count/literal success/results, stop on mixed/malformed/partial failure and never assume REST atomic rollback or retry blindly. [PRODUCTION](../scripts/import/PRODUCTION.md) owns recovery. Retired `production-worker.ts` is not deployed. Tests mock commands/REST and disposable D1.

## GitHub publication integration

`.github/workflows/pages.yml` is manual workflow_dispatch, installs pinned pnpm/Node 24, runs tests/types/static public-config preflight/build, uploads `dist/`, and deploys Pages using platform permissions. Actions variables `VITE_API_BASE_URL`/`VITE_GOOGLE_CLIENT_ID` are public build inputs; missing values fail. No Worker or database deployment occurs in this workflow. [DEPLOYMENT](DEPLOYMENT.md) owns release steps.
