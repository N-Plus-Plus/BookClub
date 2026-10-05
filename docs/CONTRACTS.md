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

## Scope and contract index

Read [DATA](DATA.md) alongside any data-bearing change. This file owns durable interfaces, not a copied storage schema.

| Contract | Producer / consumer | Authority / compatibility |
| --- | --- | --- |
| `/api/v1` JSON | Worker / `frontend/api.ts` | Routes below, `shared/types.ts`, `worker/src/validation.ts`; coordinate both deployments |
| Google exchange and app bearer | GIS/browser / Worker | [INTEGRATIONS](INTEGRATIONS.md#google-identity-services), auth/session invariants in DATA |
| Archive plans/overrides/cache | Parser/resolver / apply tooling | Strict versioned Zod models; [spreadsheet workflow](../scripts/import/README.md) owns operational detail |
| Production proof/bootstrap | Operator CLI / guarded production boundary | [PRODUCTION](../scripts/import/PRODUCTION.md); never ordinary app bootstrap |
| SQL snapshot | Cloudflare export / offline snapshot copier | `scripts/dev/snapshot.ts`; exact table compatibility and sanitisation in DATA |
| Env/config and build | Wrangler/Vite/Actions / Worker/browser | Named configuration below; secrets never embedded in frontend |
| `/__dev/refresh` | Vite/DevTools / Node supervisor | Local-only guarded tooling surface |

## API envelope, trust and failures

Owner: `worker/src/index.ts`, `validation.ts`, `http.ts`. Consumer: `frontend/api.ts`; type definitions: `shared/types.ts`. All listed paths are relative to `/api/v1`. Success: `{data: ...}`. Failure: `{error:{code,message,fields?:[{path,message}]}}`. JSON body limit is 128 KiB, checked while streaming. Calendar dates are real `YYYY-MM-DD`; ID inputs are 1–100 ASCII letters/digits/underscore/hyphen. Defined mutation schemas are strict: unknown fields reject.

Public routes are GET health, POST Google login and OPTIONS preflight. All other reads/writes require a D1-backed bearer session except double-flag local bypass (`APP_ENV=local` AND `LOCAL_WRITE_BYPASS=true`). Concrete identity is still required for personal Builder/avatar and admin operations. Production ignores `X-BookClub-Dev-Member`. Shared member workflows may correct any member's Seen answer; admin is required only where stated below. Every ordinary mutation passes central `authorizeMutation`.

Status semantics: malformed JSON 400; missing/invalid/expired session or invalid Google credential 401; forbidden identity/origin/admin 403; missing record/guessed other-owner Builder 404; unsupported method 405; stale revision/version or occupied slot/identity conflict 409; oversized body 413; invalid fields/domain input 422; unavailable providers/auth configuration 503; unexpected errors safe 500. No stack trace, raw provider body or credential URL escapes.

CORS reflects exact configured origins only, never `*`, with no cookie credentials. Production origin is `https://n-plus-plus.github.io` (no path); local `http://localhost:4173`. Permit Content-Type/Authorization; dev identity header only under local bypass. Requests without Origin still require auth. OPTIONS returns 204 for allowed/no origin. Responses use no-store, nosniff and Vary: Origin.

## Authentication and catalog routes

| Method / path | Request / result |
| --- | --- |
| GET `/health` | `{status,environment,authenticationRequired,googleAuthConfigured,tmdbConfigured,mdblistConfigured,omdbConfigured,demo}`; configuration presence only, no secrets. `demo` means local environment, not proof that catalog rows are fictional. |
| POST `/auth/google` | `{credential}` -> `{token,viewer,expiresAt}`; viewer `{id,display_name,sort_order,avatar,role}` |
| GET `/auth/me` | `{viewer}`; null for anonymous local bypass |
| POST `/auth/logout` | Revoke current hash -> `{loggedOut:true}` |
| GET `/avatars`; POST `/auth/avatar` | Available integer array; `{avatar:0–19}` -> viewer. One-time claim, collision/already chosen 409. |
| GET `/catalog` | `{members,movies,sessions,cycles}`; active History only, no Builder/auth records |
| GET `/members`, `/movies`, `/sessions`, `/cycles`, `/classics` | Arrays of shared types; Classics is derived sorted membership |
| GET `/movies/:id`, `/sessions/:id` | MovieDetail / event with ordered movie objects; detail includes appearance event/date/kind/position |
| GET `/movies/search?q=...` | Trimmed 1–150 chars -> `{local,external,lookup:{available,message}}`; unavailable provider preserves local matches |
| POST `/movies` | `{title,year?,runtime?}` -> MovieDetail (201); title 1–300, year 1870–2200, positive runtime <=10000 |
| POST `/movies/import` | `{provider:"tmdb",externalId}` (positive numeric string, <=10 digits) -> persisted/reused MovieDetail (201) |
| PUT `/movies/:id/classics` | `{classic:boolean}` -> MovieDetail; preserves canonical movie/allocated seed |
| PUT `/movies/:id/seen/:memberId` | `{seen:true|false|null}` -> MovieDetail; null returns Unknown by removing row |

Movie responses preserve nullable metadata and arrays for genres/assets/IDs/scores/Seen. Ranking is nullable for nonmembers; missing input is not zero. Optional metadata/artwork check fields support deployment evolution. Neither catalog nor viewer exposes authorised emails, Google subs or session hashes.

## Maintenance routes

| Method / path | Access / request / result |
| --- | --- |
| POST `/movies/:id/refresh-scores` | Member; explicit capture -> `{movie,providers}` |
| POST `/classics/enrich` | Member; `{limit?:1–10}` default 10 -> `{results:RefreshResult[],remaining,unidentified}` |
| POST `/movies/enrich-metadata` | Admin; same limit -> `{results:[{movieId,title,provider:"tmdb",status:"success"|"failed"|"conflict",message,retryAfter?}],remaining,unidentified}` |

Provider result shape: `{provider,status:"success"|"failed"|"skipped",count,message,retryAfter?}`; retryAfter is seconds. Partial provider failure may be a successful HTTP response with failed/skipped items; consumers must inspect status. Score `remaining` is the unselected candidate count from that operation, not proof selected failures are now complete. Metadata `remaining` is recomputed eligible identified films; `unidentified` counts no valid TMDB identity. Browser timeouts: ordinary 15s, score enrichment 65s, metadata 95s. Provider rules belong in [INTEGRATIONS](INTEGRATIONS.md).

## Events, rotation and History

POST `/sessions` and PUT `/sessions/:id` accept:

```ts
{
  event_date: string, movie_ids: string[], title?: string,
  host_member_id?: string | null, notes?: string, legacy_cycle_label?: string,
  cycle_id?: string | null, new_cycle?: {rough_date:string,title?:string,ordinal?:number},
  kind?: 'hosted'|'classics', date_precision?: 'exact'|'cycle_rough'|'unknown',
  cycle_slot?: number | null, swap_note?: string,
  complete_turn?: boolean, turn_version?: number, correct_anchor?: boolean
}
```

Nonempty ordered lineup, no three-film ceiling. Title/label max 300, notes max 10000, swap max 2000. Existing/new cycle are exclusive; slot 5 is Classics, 1–4 hosted. Classics has no host; hosted requires one. `cycle_rough` requires cycle context. Slot-1 new cycle requires exact matching anchor; later exact dates are independent. Changing an exact slot-1 date requires explicit `correct_anchor:true`; only unknown legacy reference dates follow. Edits never complete a turn. Creation returns event/201, replacement event/200.

Nominal versus actual hosted-member mismatch requires nonblank swap_note, also enforced by insert/update triggers. Occupied active cycle/slot returns 409 with related work rolled back. Current completion requires correct turn/version and advances only explicitly. Slots follow fixed human positions then hostless Classics; completing Classics returns to slot 1 awaiting new cycle. Current Classics completion atomically marks films Seen for all active members; backfills/edits/restores do not.

GET `/rotation` -> singleton or null before private initialisation. Admin PUT `/rotation` accepts `{cycle_id:string|null,nominal_slot:1–5,version:number|null,reason}`; reason nonblank <=2000, version detects stale correction. Returns Rotation. Admin status does not grant Builder access.

GET `/sessions/:id/audit` -> `HistoryAudit[]`, including deleted events, with actor/time/action/structured changes JSON. DELETE `/sessions/:id` -> `{deleted:true}` soft-deletes; POST `/sessions/:id/restore` -> `{restored:true}` admin only. Delete/restore never rewind rotation or reapply Seen; completed-turn edit/delete flags review. Replacement remains last-write-wins; do not imply a History revision guard exists.

## Private Builder

GET `/builders` and `/builders/:id` return only viewer-owned sets. POST/PUT accept `{title?,notes?,movie_ids,revision?}`; empty drafts supported, PUT requires current revision. DELETE accepts `{revision}` -> `{deleted:true}` and permanently removes only private draft. Other-owner IDs return 404 even for admins. Revision is a nonnegative integer.

POST `/builders/:id/publish` accepts `{revision,event_date,cycle_id:string|null,cycle_slot:1–5,complete_turn:boolean,turn_version?,swap_note?,new_cycle?}` -> event/201. Owner is actual hosted publisher; Classics remains hostless. Nonempty lineup required. Publication atomically copies immutable Builder creation time to planned_at, preserves film order/title/notes, creates event/audit, removes draft and optionally completes guarded rotation/Seen changes. Saved sets never enter catalog before publication.

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

## Configuration and public paths

| Name / path | Contract |
| --- | --- |
| `VITE_API_BASE_URL` | Public build-time Worker origin without `/api/v1`; production has no localhost fallback; dev fixes localhost |
| `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID` | Same public Google Web client audience, frontend build / Worker runtime |
| `APP_ENV`, `LOCAL_WRITE_BYPASS`, `ALLOWED_ORIGINS`, `DB` | Worker trust/env/origin/D1 bindings; top-level production and named local are separate |
| `TMDB_READ_TOKEN`, `MDBLIST_API_KEY`, `OMDB_API_KEY` | Optional Worker-only credentials; explicit resolver may use private TMDB process env/file |
| `worker/.dev.vars.local`, `.env.local`, `.env.production.local` | Ignored local secrets / public frontend build configuration; examples tracked |
| `/BookClub/#/...`, `/` dev base | Static hash routes; preserve Vite base-aware asset/identity paths |
| `public/avatars/0.png`–`19.png`, `a.png` | Fixed one-time member choices and reserved Classics asset; never modify source assets to simplify tests |

## Development refresh boundary

`frontend/DevTools.tsx` calls same-origin `/__dev/refresh`; Vite proxies to `scripts/dev/server.ts` at 127.0.0.1:8790. GET status requires Host localhost:4173. POST requires exact localhost Origin/Host plus `X-BookClub-Confirm: replace-local-only` validated by `scripts/dev/request-policy.ts`; concurrent work returns 409, accepted start 202, invalid boundary 403. Status has phase/message and optional result; details never include raw private SQL/provider output. Import-preview mode has no helper proxy; production bundles omit dev tooling. This endpoint is not part of `/api/v1`.

## Contract-change rule

Identify all producers/consumers, read DATA, preserve required compatibility, and update implementation/tests and this document together. Include INTEGRATIONS for provider changes. Do not silently change durable contracts, archived fingerprint payloads or deployed frontend/Worker expectations.
