<!--
AGENT MAINTENANCE INSTRUCTION

Read `docs/DATA.md` whenever this document is relevant. CONTRACTS.md describes durable boundaries around data, not the storage model in isolation.

Build this document only from implemented contracts, verified behaviour, or explicit user decisions.

Update it whenever:
1. a task changes a durable interface, import/export shape, API payload, file format, compatibility rule, or validation boundary; or
2. unrelated work reveals that a documented contract no longer matches reality.

Describe the current contract, not its historical evolution. Do not duplicate stored schema detail that belongs in DATA.md.
-->

# CONTRACTS.md

## Admin score maintenance status

Authenticated admin-only `GET /api/v1/movies/maintenance-status` returns `candidateIds`, `eligibleDimensions`, `unavailableDimensions` and `unavailableFilms` for distinct Classics/active History films. Candidates have at least one missing usable live/API score without a conclusive negative check; the browser filters valid operation identities. Unavailable counts cover absent dimensions with negative observations, excluding stored usable live/API scores. Ordinary catalog, detail, auth and navigation payloads do not include score-check rows. Batch mutation responses remain bounded to the selected films.

## Scope and contract index

Read [DATA](DATA.md) alongside any data-bearing change. This file owns durable interfaces, not a copied storage schema.

| Contract | Producer / consumer | Authority / compatibility |
| --- | --- | --- |
| `/api/v1` JSON | Worker / `frontend/api.ts` | Routes below, `shared/types.ts`, `worker/src/validation.ts`; coordinate both deployments |
| Google exchange and app bearer | GIS/browser / Worker | [INTEGRATIONS](INTEGRATIONS.md#google-identity-services), auth/session invariants in DATA |
| Archive plans/overrides/cache | Parser/resolver / apply tooling | Strict versioned Zod models; [spreadsheet workflow](../scripts/import/README.md) owns operational detail |
| Production proof/bootstrap | Operator CLI / guarded production boundary | [PRODUCTION](../scripts/import/PRODUCTION.md); never ordinary app bootstrap |
| SQL snapshot | Cloudflare export / offline snapshot copier | `scripts/dev/snapshot.ts`; exact table compatibility and sanitisation in DATA |
| Env/config and build | Wrangler/Vite/operator / Worker/browser | Named configuration below; secrets never embedded in frontend |
| `/__dev/refresh` | Vite/DevTools / Node supervisor | Local-only guarded tooling surface |

## API envelope, trust and failures

Owner: `worker/src/index.ts`, `validation.ts`, `http.ts`. Consumer: `frontend/api.ts`; type definitions: `shared/types.ts`. All listed paths are relative to `/api/v1`. Success: `{data: ...}`. Failure: `{error:{code,message,fields?:[{path,message}]}}`. JSON body limit is 128 KiB, checked while streaming. Calendar dates are real `YYYY-MM-DD`; ID inputs are 1–100 ASCII letters/digits/underscore/hyphen. Defined mutation schemas are strict: unknown fields reject.

Public routes are GET health, POST Google login and OPTIONS preflight. All other reads/writes require a D1-backed bearer session except double-flag local bypass (`APP_ENV=local` AND `LOCAL_WRITE_BYPASS=true`). Concrete identity is still required for personal Builder/avatar and admin operations. Production ignores `X-BookClub-Dev-Member`. Seen writes require a concrete viewer and may change only that viewer's answer, including admins; admin is required only where stated below. Every ordinary mutation passes central `authorizeMutation`.

Status semantics: malformed JSON 400; missing/invalid/expired session or invalid Google credential 401; forbidden identity/origin/admin 403; missing record/guessed other-owner Builder 404; unsupported method 405; stale revision/version or occupied slot/identity conflict 409; oversized body 413; invalid fields/domain input 422; unavailable providers/auth configuration 503; unexpected errors safe 500. No stack trace, raw provider body or credential URL escapes.

CORS reflects exact configured origins only, never `*`, with no cookie credentials. Production temporarily allows exactly `https://n-plus-plus.github.io` and `https://bookclub.nissen.nexus` (no paths) during cutover; local `http://localhost:4173`. Permit Content-Type/Authorization; dev identity header only under local bypass. Requests without Origin still require auth. OPTIONS returns 204 for allowed/no origin. Responses use no-store, nosniff and Vary: Origin.

## Authentication and catalog routes

| Method / path | Request / result |
| --- | --- |
| GET `/health` | `{status,environment,authenticationRequired,googleAuthConfigured,tmdbConfigured,mdblistConfigured,omdbConfigured,demo}`; configuration presence only, no secrets. `demo` means local environment, not proof that catalog rows are fictional. |
| POST `/auth/google` | `{credential}` -> `{token,viewer,expiresAt}`; viewer `{id,display_name,sort_order,avatar,role}` |
| GET `/auth/me` | `{viewer}`; null for anonymous local bypass |
| POST `/auth/logout` | Revoke current hash -> `{loggedOut:true}` |
| GET `/avatars`; POST `/auth/avatar` | Available integer array; `{avatar:0–19}` -> viewer. One-time claim, collision/already chosen 409. |
| GET `/catalog/compact` | Additive `CompactCatalog`: `{members,movies,sessions,cycles}`; canonical Movie data once, effective usable preferred scores only, `CompactSession.movie_ids` preserves lineup order/repeats and replaces `movies`. New frontend hydrates the existing Catalog shape; 404/405/501 falls back to `/catalog`, while auth/network/server failures remain failures. |
| GET `/catalog` | `{members,movies,sessions,cycles}`; active History only; events include boolean `has_audit` from stored audit existence, no Builder/auth records |
| GET `/members`, `/movies`, `/sessions`, `/cycles`, `/classics` | Arrays of shared types; Classics is derived sorted membership |
| GET `/movies/:id`, `/sessions/:id` | MovieDetail / event with ordered movie objects; detail includes appearance event/date/kind/position and nullable stored `host_member_id`, also returned in mutation and maintenance MovieDetail payloads |
| GET `/movies/search?q=...` | Trimmed 1–150 chars -> `{local:SavedSearchResult[],external:SearchResult[],lookup:{available,message}}`; unavailable provider preserves local matches. Local fields: canonical `id`, `title`, nullable `year`, `tmdbId`, `poster`. External fields: provider/externalId/title/year/poster; no canonical ID. |
| GET `/movies/preview/tmdb/:externalId` | Positive numeric TMDB ID, <=10 digits -> read-only `TmdbPreview`: provider/externalId/title/original_title/year/release_date/runtime/overview/genres/assets/director. No canonical ID, scores, Seen or appearances; no D1 writes, including cooldown bookkeeping. |
| POST `/movies` | `{title,year?,runtime?}` -> MovieDetail (201); title 1–300, year 1870–2200, positive runtime <=10000 |
| POST `/movies/import` | `{provider:"tmdb",externalId}` (positive numeric string, <=10 digits) -> persisted/reused MovieDetail (201) |
| PUT `/movies/:id/classics` | `{classic:boolean}` -> MovieDetail; preserves canonical movie/allocated seed |
| PUT `/movies/:id/seen/:memberId` | `{seen:true|false|null}` -> MovieDetail; null returns Unknown by removing row; idempotent state-setting write, selected-film response read |

Search trims/collapses whitespace, compares case-insensitively, and removes at most one leading English A or The. Any whole-title matches across the collected local/TMDB pool suppress all weaker candidates; otherwise contiguous-substring matches retain source relevance order. Year is excluded. Saved TMDB identity owners suppress external duplicates. Pagination is frontend-only, six candidates from the same result set.

Event create/update, Builder publication and one-Session GET return the existing ordered-Movie Session shape through a session-scoped transactional read; they do not reconstruct unrelated catalogue data. Partial collection endpoints read their own scope; `/movies` includes the ranking roster, `/sessions` includes active History films, and `/classics` loads membership films and roster.

Ordinary film detail reads and Seen responses share the selected-film query used by maintenance: movie relationships, ranking roster and that film's active History appearances only, with no unrelated catalog/session/cycle read. The normal 15-second timeout is unchanged.

Movie responses preserve nullable metadata and arrays for genres/assets/IDs/scores/Seen. Ranking is nullable for nonmembers. Six recognised rating dimensions are normalised to /100; missing dimensions use the arithmetic mean of available genuine values, only at ranking time. At least one genuine recognised score and complete active-member Seen answers are required to rank. `sources` contains only fetched values; `missingRequiredScores` lists absent dimensions; `availableScoreAverage` is nullable; `imputedScores` contains derived provider/metric/value entries without retrieval provenance. No imputed source snapshots are stored. `rawScore` is the six effective squares summed, and `finalScore = rawScore * unseenMultiplier + tieBreak`; eligibility remains separate. On the 0009 bridge schema, director is null and rotation has empty `human_order`; swap-only operations return `503 SCHEMA_UPGRADE_REQUIRED`. Normal auth, reads and event publication remain available. Optional metadata/artwork check fields support deployment evolution. Neither catalog nor viewer exposes authorised emails, Google subs or session hashes.

## Maintenance routes

| Method / path | Access / request / result |
| --- | --- |
| POST `/movies/maintain` | Admin; `{mode:"missing"|"refresh"|"metadata",movie_ids:[1-10 IDs]}` -> `{results:RefreshResult[]}`. IDs deduplicate and must belong to Classics or active History. |
| POST `/movies/:id/refresh-scores` | Admin; compatibility explicit capture -> `{movie,providers}` |
| POST `/classics/enrich` | Admin; compatibility `{limit?:1–10}` default 10 -> `{results:RefreshResult[],remaining,unidentified}` |
| POST `/movies/enrich-metadata-selected` | Admin; `{movie_ids:[1–2 IDs]}` -> `{results:[{movieId,title,provider:"tmdb",status:"success"|"failed"|"conflict"|"skipped",message,retryAfter?}]}`. IDs deduplicate; missing films return 422 (without triggering legacy fallback), invalid stored TMDB identities report per-film failure, already-checked films report skipped. No global counts. |
| POST `/movies/enrich-metadata` | Admin; compatibility `{limit?:1–10}` default 10 -> `{results:[{movieId,title,provider:"tmdb",status:"success"|"failed"|"conflict",message,retryAfter?}],remaining,unidentified}` |

Browser bulk maintenance sends up to ten films per score request, preserving MDBList batching, and caps TMDB metadata requests at two films, with a two-second idle gap between requests. The legacy API retains its 1–10 compatibility limits. The selected metadata route accepts at most two IDs before deduplication and rechecks shared eligibility using only selected-film metadata relationships. The browser freezes the candidate queue once from its current catalogue in descending gap priority then ID order, with unidentified count fixed for the run. Progress/remaining track that queue; one shared-data reconciliation after completion, Stop or failure recalculates displayed eligibility/identity counts from the refreshed catalogue. Only 404/405/501 from the selected route allow a legacy fallback, preserving independent API/frontend rollout and rollback. Ordinary requests retain the 15-second client timeout; bulk maintenance retains 105 seconds. Score maintenance returns selected MovieDetail-compatible data without rebuilding the full catalogue.

Provider result shape: `{provider,status:"success"|"failed"|"skipped",count,message,retryAfter?,blocking?}`; retryAfter is seconds. Score maintenance marks single-film `not_found` failures `blocking:false`; credentials, rate limits, outage/network, malformed/unrecognised responses and unexpected execution failures are `blocking:true`. Provider-wide suppressed items also carry `blocking:true`. Consumers stop on explicit blocking or any retryAfter; a failed result without the additive flag remains blocking for older-Worker compatibility. Isolated failed films remain counted and visible with their returned movie title while later batches continue; completion reports unresolved films. Partial provider failure may be a successful HTTP response with failed/skipped items; consumers must inspect these fields. Score `remaining` is the unselected candidate count from that operation (SQL-selected unrankable, supported-identity Classics in title/ID order), not proof selected failures are now complete. Legacy metadata `remaining` is recomputed eligible identified films; `unidentified` counts no valid TMDB identity. Browser timeouts: ordinary 15s, score enrichment 65s, metadata and bulk maintenance 105s. Bulk responses contain only processed films; clients sequence a fixed ID queue rather than relying on rankability to prove completion. Populate skips films with all six usable live/API inputs or only conclusively checked-unavailable missing inputs; when called, all recognised returned MDBList ratings append as actual snapshots, while fallback captures fill absent live/API input types; Refresh ignores old-score completeness for fallback selection. Metadata mode updates available OMDb fields without changing scores. Provider rules belong in [INTEGRATIONS](INTEGRATIONS.md).

## Events, rotation and History

POST `/sessions` and PUT `/sessions/:id` accept:

```ts
{
  event_date: string, movie_ids: string[],
  host_member_id?: string | null, legacy_cycle_label?: string,
  cycle_id?: string | null, new_cycle?: {rough_date:string,title?:string,ordinal?:number},
  kind?: 'hosted'|'classics', date_precision?: 'exact'|'cycle_rough'|'unknown',
  cycle_slot?: number | null,
  complete_turn?: boolean, turn_version?: number, correct_anchor?: boolean
}
```

Nonempty ordered lineup, no three-film ceiling. Cycle title/legacy label max 300. Event title, notes and swap explanations are not accepted or stored. New Event host/kind are derived server-side from the current rotation (effective active member assigned to current position 1–4; slot 5 hostless Classics), independently of viewer, submitted host/kind or completion. Corrections retain stored host/kind, including inactive historical hosts; new-event completion defaults checked. Existing/new cycle are exclusive; slot 5 is Classics, 1–4 hosted. Classics has no host; hosted requires one. `cycle_rough` requires cycle context. Slot-1 new cycle requires exact matching anchor; later exact dates are independent. Changing an exact slot-1 date requires explicit `correct_anchor:true`; only unknown legacy reference dates follow. Edits never complete a turn. Creation returns event/201, replacement event/200.

Historical actual hosts may differ from nominal positions and remain stored; Event entry has no host selector. Builder publication retains its separate publisher-host contract. Unchecking new Event completion does not change current-turn host identity. Occupied active cycle/slot returns 409 with related work rolled back. Current completion requires correct turn/version and advances only explicitly. Slots follow fixed human positions then hostless Classics; completing Classics returns to slot 1 awaiting new cycle. Current Classics completion atomically marks films Seen for all active members; backfills/edits/restores do not.

GET `/rotation` -> singleton (including parsed `human_order` position/member map) or null before private initialisation. Admin POST `/rotation/swap` accepts only `{target_member_id:string,version:number}` and returns Rotation. Current position must be human; target must be an active human member distinct from the effective current member, assigned to a future/uncompleted position, with no active Event in the current cycle. Invalid targets return 422; stale/concurrent changes return 409 with no swap/audit partial write. Swaps exchange those two assignments for this cycle only, including before slot 1 creates its Cycle row. CLSC remains position 5; its completion clears the map for the next normal cycle. Generic PUT `/rotation` is unavailable. Admin status does not grant Builder access.

PUT `/sessions/:id` requires an admin or the stored actual host of a hosted event; submitted host/kind cannot grant ownership or change historical identity. DELETE and audit reads require admin, including in local bypass.

GET `/sessions/:id/audit` -> `HistoryAudit[]`, including deleted events, with actor/time/action/structured changes JSON. DELETE `/sessions/:id` -> `{deleted:true}` soft-deletes; POST `/sessions/:id/restore` -> `{restored:true}` admin only. Delete/restore never rewind rotation or reapply Seen; completed-turn edit/delete flags review. Replacement remains last-write-wins; do not imply a History revision guard exists.

## Private Builder

GET `/builders` and `/builders/:id` return only viewer-owned sets. POST/PUT accept `{title?,notes?,movie_ids,revision?}`; empty drafts supported, PUT requires current revision. DELETE accepts `{revision}` -> `{deleted:true}` and permanently removes only private draft. Other-owner IDs return 404 even for admins. Revision is a nonnegative integer.

POST `/builders/:id/publish` accepts `{revision,event_date,cycle_id:string|null,cycle_slot:1–5,complete_turn:boolean,turn_version?,new_cycle?}` -> event/201. Owner is actual hosted publisher; Classics remains hostless. Nonempty lineup required. Publication atomically copies immutable Builder creation time to planned_at, preserves film order, creates event/audit, removes draft and optionally completes guarded rotation/Seen changes. Private Builder titles/notes are not copied to History. Saved sets never enter catalog before publication.

## Import, export and artefact contracts

`model.ts` under `scripts/import/` strictly defines raw plan version 1 (`dryRun:true`), resolved plan version 2 (`schemaMigration:"0004_import_provenance.sql"` provenance marker), overrides version 1 and resolver cache version 1. The marker does not mean the apply target needs only migration 0004: local preflight requires all current migrations. Resolved plans retain canonical movies/all refs/IDs/status, cycles/events/positions, memberships/seeds/scores, canonical and original Seen observations, capture time, issues and separate raw/canonical Watch Order diagnostics.

Config (`config.ts`, example JSON) fixes import source/member IDs and optional snapshotCapturedAt. Apply requires exact matching capture, strict references, zero blockers, generic roster/no auth and schema checks. Overrides support source_refs/identity/tmdb_id/preferred_score_ref plus paired canonical_year/year_reason for explicit owner decisions; Seen overrides retain original evidence. Strict known refs and contradictory verified IDs are never bypassed. Source raw records remain unchanged. Exact formats and safe commands: [spreadsheet guide](../scripts/import/README.md), workbook interpretation: [legacy model](LEGACY_SPREADSHEET_MODEL.md).

Local apply writes only isolated preview, explicit `--apply`; fingerprints reject changed payloads and extra joins, identical continuation resumes pending work. Guarded production receipt version 1 binds exact plan/migration hashes, target and capture; bootstrap version 1 carries private members and initial rotation. Export proof binds timestamped SQL bytes/hash/count/target/plan. These are private operator artefacts, not public stable interchange APIs; consult [PRODUCTION](../scripts/import/PRODUCTION.md) before changing producers/consumers.

Current-production refresh consumes Cloudflare SQL export offline using Node SQLite, not resolved archive plans. Unknown source tables/columns reject; target nullable additions can use defaults. Counts/integrity/domain verification precede local swap. No user-facing public export or reverse sync is implemented. [DATA](DATA.md) owns sanitisation/recovery.

### Ordinary-local TMDB pairing manifest

`scripts/dev/pair-tmdb-cli.ts` consumes a reviewed version-1 manifest with `matched_count` and `pairings:[{movie_id,title,source_refs,tmdb_id,matched_title,matched_year,confidence:"high"}]`. Count must match; movie/TMDB IDs and each pairing's source refs must be unique. Exact stored import provenance and external identity ownership are rechecked. Existing non-TMDB identity or incomplete attached TMDB metadata requires review. This is separate from the strict archive resolver format.

`corepack pnpm exec tsx scripts/dev/pair-tmdb-cli.ts --manifest <private-file>` is preflight; explicit `--apply` makes live TMDB details requests and writes ordinary local D1 only. Local API must be stopped, fixed configuration/path guards and refresh lock hold; reports stay ignored under `.verification/tmdb-pairings`. Returned ID, title compatibility and year within one of matched_year are checked before transactional attachment/metadata. Per-item rejection/conflict is reported; provider-wide failure stops processing, identical completed pairings skip. No remote D1 path or production authority is supplied by this command.

Version 2 accepts three arrays: `pairings`, `merge_into_existing`, and `merge_groups`. Pairings use the same `movie_id,title,source_refs,tmdb_id` fields with `action:"pair"`, `confirmation:"owner_confirmed"|"corrected_rejection"`, and boolean `strict_year`. Corrected rejections require `expected_title`/`expected_year`; owner confirmation validates the returned ID and usable film without presentation-title/year rejection. Existing merges use `action:"merge_into_existing_tmdb_owner"`, `confirmation:"round1_existing_owner_conflict"` and the same member fields. Groups use `action:"merge_group_then_pair"`, `confirmation:"owner_confirmed"`, target `tmdb_id` and `members:[{movie_id,title,source_refs}]`. IDs, target IDs and all supplied source refs must be unique across operations. Policy/note text is data, never executed instructions.

Version 2 uses `.verification/tmdb-pairings-round2/verification-report.json` plus an immutable starting `baseline-state.json`; preflight uses a separate report and no application-data writes/provider calls. The report checkpoints usable provider responses before transactional mutation so failed writes can resume without refetching. Existing fresh metadata/artwork is reused for database-only merges. Durable local merge receipts retain original rows and operation hashes; matching receipts and surviving provenance are required to recognise missing members on rerun. Preservation/conflict policies and the local-only receipt schema belong to [DATA](DATA.md#local-tmdb-identity-pairing-maintenance). This format does not authorise remote schema changes or promotion.

Version 3 uses `pairings` with `action:"pair_or_merge_existing_owner"`, `tmdb_kind:"movie"`, `confirmation:"owner_confirmed"`, and `strict_year:false`, plus the same merge-group fields. It adds `removals:[{movie_id,title,source_refs,appearance_count,classic,action:"remove_from_active_catalogue",confirmation:"owner_confirmed"}]`, limited to the explicitly authorised final-cleanup titles described in DATA. Supplied notes/policy/roadmap fields remain data. Existing target ownership routes through the tested merge helper; new detail responses additionally capture their existing provider score data. The default ignored report directory is `.verification/tmdb-pairings-round3-final-v2`; response checkpoints are separated into `provider-cache.json` so the verification report contains concise results, actual counts, unresolved titles and preservation/integrity status.

### Private production identity reconciliation manifest

Version 1 records the exact production database name/ID, `identity_assignments`, ordered `merges`, explicit `removals`, `excluded_local_testing_movie_ids`, verified local counts and scoped `expected_production_counts`. Each identity/member carries canonical `movie_id`, `import_source`, `import_key` and exact `source_refs:[{import_source,source_ref}]`. Merges specify obsolete IDs, survivor ID, TMDB ID and durable local operation evidence. Removals carry the owner-authorised action, exact identity/provenance and expected appearance/membership state. Historical evidence hashes and the exact manifest-byte SHA-256 bind the package to its preflight, backup and apply receipts.

This ignored operator package contains identity/canonical decisions only: no local metadata, artwork, scores, provider timestamps or response bodies. It authorises no application deployment or provider calls. The full preservation, audit-storage, backup and supported D1 integrity rules are owned by [DATA](DATA.md#production-identity-reconciliation-maintenance).

## Configuration and public paths

| Name / path | Contract |
| --- | --- |
| `VITE_API_BASE_URL` | Public build-time Worker origin without `/api/v1`; production has no localhost fallback; dev fixes localhost |
| `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID` | Same public Google Web client audience, frontend build / Worker runtime |
| `APP_ENV`, `LOCAL_WRITE_BYPASS`, `ALLOWED_ORIGINS`, `DB` | Worker trust/env/origin/D1 bindings; top-level production and named local are separate |
| `TMDB_READ_TOKEN`, `MDBLIST_API_KEY`, `OMDB_API_KEY` | Optional Worker-only credentials; explicit resolver may use private TMDB process env/file |
| `worker/.dev.vars.local`, `.env.local`, `.env.production.local` | Ignored local secrets / public frontend build configuration; examples tracked |
| `/#/...`, `/` in development/build/preview | Static hash routes; preserve Vite base-aware asset/identity paths |
| `public/avatars/0.png`–`19.png`, `a.png` | Fixed one-time member choices and reserved Classics asset; never modify source assets to simplify tests |

## Development refresh boundary

`frontend/DevTools.tsx` calls same-origin `/__dev/refresh`; Vite proxies to `scripts/dev/server.ts` at 127.0.0.1:8790. GET status requires Host localhost:4173. POST requires exact localhost Origin/Host plus `X-BookClub-Confirm: replace-local-only` validated by `scripts/dev/request-policy.ts`; concurrent work returns 409, accepted start 202, invalid boundary 403. Status has phase/message and optional result; details never include raw private SQL/provider output. Import-preview mode has no helper proxy; production bundles omit dev tooling. This endpoint is not part of `/api/v1`.

## Contract-change rule

Identify all producers/consumers, read DATA, preserve required compatibility, and update implementation/tests and this document together. Include INTEGRATIONS for provider changes. Do not silently change durable contracts, archived fingerprint payloads or deployed frontend/Worker expectations.
