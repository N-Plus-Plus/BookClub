# Private spreadsheet migration workflow

`docs/LEGACY_SPREADSHEET_MODEL.md` owns workbook semantics. The staged Node/TypeScript tools use ExcelJS/tsx already installed for development. No browser dependencies, Python, production import path or new database technology are added. All generated plans, caches, overrides suggestions and reports remain under ignored `.verification/`. Never commit or publish them, private configs, workbook copies or preview D1 state. The workbook is read-only.

## 1. Analyse and validate the workbook

Copy `import-config.example.json` to ignored `import-config.local.json`. The confirmed order is `club-member-1` through `club-member-4`: Tracker B–E and Should Watch F–I. Positions are Sean, Troy, Matt and Jess respectively; display names and Google identities do not belong in import configuration. Tracker Ruff Date anchors the cycle and gives slot 1 its exact event date. Slots 2-5 use the anchor as a reference with `cycle_rough` precision because their actual dates are absent. Regenerate raw/resolved plans made before this clarification; strict plan validation rejects the old all-rough precision. IDs, counts, ordering, identity resolution and Watch Order are unchanged. Existing applied fingerprints are never overwritten: review any conflict separately, without resetting owner data.

```sh
pnpm import:spreadsheet --file "path/to/private.xlsx" --config scripts/import/import-config.local.json
```

This command never calls a provider or D1. It writes `plan.json` (version 1), `report.json`, and `report.md` to `.verification/import/`. `--out .verification/import/another-snapshot` selects another ignored directory. Existing junctions/symlinks and target collisions with inputs are checked. Missing workbook/config, invalid JSON/member config, missing sheets, unsupported layout and structural corruption have safe errors without raw exception/config contents.

Review the summary first: structural counts, historical Watch Order, blockers, review items and informational totals. JSON retains row-level diagnostics. Expected missing Seen answers on title-only rows, uncached helper formulas, surrounding whitespace and auxiliary N/A are informational. Unexpected Unknown on scored rows, malformed helper values and corrected helper-score mismatches stay visible. A mismatch due to trimmed Seen whitespace is a corrected legacy data defect, not an apply blocker.

Legacy Letterboxd P and Metacritic O are percentages (raw scale 100). Trimmed case-insensitive `N/A` produces no snapshot; arbitrary malformed text still warns. MDBList Letterboxd remains native scale 5. B–D and explicit normalized Yes/No answers remain canonical; formulas are never executed. Watch Order, Sheet2 and Not Book Club are never applied as source entities.

`snapshotCapturedAt` is optional during analysis/resolution. For apply, privately supply an ISO UTC timestamp, for example the actual time the migration archive captured the state. It is **not** a claim about when the spreadsheet originally retrieved each rating. No timestamp is inferred from file modification dates or hard-coded by the importer. Rerun resolution after setting/changing it.

Apply requires all current preview migrations through `0006_history_integrity.sql` before any writes. Preflight checks the product tables and active-slot/swap database invariants. Historical positional rows naturally occupy one cycle slot with matching nominal hosts; no swap notes are invented. The resolved plan's `schemaMigration: 0004_import_provenance.sql` remains its provenance-format marker; source refs, IDs, cache format and fingerprints are unchanged. Preparation still inserts only the generic positional roster, with default member roles/null avatars and no auth or current-turn initialisation. After eventual authorised import, identified canonical films may be explicitly enriched through the admin metadata endpoint without changing their internal IDs or any import/history/Seen/score provenance. Metadata coverage remains visible in Metrics until gaps are filled.

## 2. Resolve identities offline

```sh
pnpm import:resolve --plan .verification/import/plan.json --config scripts/import/import-config.local.json
```

The resolver first links identical valid IMDb IDs, exact conservative normalized title + known year, and title-only records with a unique richer title identity. Contradictory years on the same IMDb ID block; differing source titles on the same ID require alias review. Conflicting IMDb IDs prevent exact title/year linking. Title normalization trims, normalizes Unicode NFC and compares case-insensitively; it never strips punctuation, aliases or sequel numbers, and fuzzy similarity is never automatic evidence.

An isolated title-only source can remain a provisional canonical movie and does not require an external ID to apply. Repeated title-only source clusters without stronger evidence remain ambiguous. Same-title remakes with distinct known years/IDs remain separate, and title-only occurrences between them need a private decision. Count reductions depend on the identity evidence actually present; no arbitrary target reduction is forced.

Outputs are `resolved-plan.json` (version 2), `resolution-report.json`, `resolution-report.md`, `resolution-overrides.suggested.json`, and, when requests occur, `resolution-cache.json`. The resolved plan contains canonical movies, all source refs, external IDs/status, cycles, events and positions, one membership per canonical film, scores, canonical Seen and original row-level Seen observations, archive capture time and reconciliation issues. Historical validation is kept separately from the recomputed canonical top 20, with differences attributed to duplicate collapse/source corrections. The plan is strictly validated again at apply.

## 3. Optional bounded TMDB resolution

```sh
pnpm import:resolve --plan .verification/import/plan.json --config scripts/import/import-config.local.json --network --env-file worker/.dev.vars.local --max-requests 25
```

Network is explicit. Token precedence is `process.env.TMDB_READ_TOKEN`, then the explicitly supplied ignored `.dev.vars`/`.dev.vars.local` file. Only TMDB_READ_TOKEN is extracted; its value never enters errors/reports/cache. OWNER_INFO.md is never read. Without a token, offline resolution still succeeds and reports network unavailable. No score enrichment occurs.

IMDb identity uses TMDB's official [external-ID find](https://developer.themoviedb.org/reference/find-by-id); title/year uses [movie search](https://developer.themoviedb.org/reference/search-movie). An unambiguous movie find or unique exact title/year can resolve automatically. Title-only search needs one exact title/original-title match and complete result pagination; multiple remakes or incomplete pagination produce candidate choices (ID/title/year/original title) for review. Direct private TMDB selections can be checked through details. Invalid responses never become authoritative evidence.

Requests are sequential, timeout-bounded and capped (25 by default; `--max-requests 0` is cache-only). Results are saved atomically after each request. Repeat the same command to reuse successful/no-result caches and continue remaining work; an exhausted cap exits successfully with more work remaining. Temporary failures/429 persist a retry window and pause requests; resume after it expires. No raw upstream response/error or token is logged. Do not run simultaneous resolver processes over the same cache. Cache files contain private identity data, not credentials. To revise a stale lookup, edit/remove that entry privately after stopping the resolver.

## 4. Private decisions and canonical duplicates

Copy `resolution-overrides.example.json` to ignored `resolution-overrides.local.json`. The generated suggestions file contains unresolved refs/candidates plus a template; copy **selected decisions** into the strict example format (do not feed the suggestions document directly to the resolver).

```json
{
  "version": 1,
  "assignments": [
    { "source_refs": ["Should Watch:2", "Tracker:2:2"], "identity": "fictional-version-a", "tmdb_id": "123" },
    { "source_refs": ["Should Watch:3"], "identity": "fictional-version-b" }
  ],
  "seen": [ { "source_ref": "Should Watch:2", "member_id": "club-member-1", "seen": 1 } ]
}
```

These are fictional examples only. Same `identity` labels group records; different explicit labels separate versions. Optional `tmdb_id` attaches a selected identity. Optional `preferred_score_ref` chooses one legacy row within its assignment without falsifying source ordinals or timestamps. Unknown refs, duplicate assignments, conflicting preferred rows, one IMDb identity mapped to multiple TMDB IDs, and merging distinct verified IMDb IDs are rejected. There is intentionally no force-merge escape hatch for contradictory verified IDs; correct the identity evidence privately first. Network evidence conflicting with a manual TMDB decision is rejected.

```sh
pnpm import:resolve --plan .verification/import/plan.json --config scripts/import/import-config.local.json --overrides scripts/import/resolution-overrides.local.json
```

Confidently linked duplicate candidate rows yield one movie/membership and minimum original row seed. All movie/import refs and historical score observations survive. Compatible Seen collapses; Unknown yields to explicit. Contradictory explicit answers block until the private `seen` override chooses a canonical answer; original observations remain separately auditable. Effective scores use service precedence, newest actual capture, then optional private legacy preference and later legacy source ordinal at tied captures, then a stable fallback. Live MDBList/OMDb outrank legacy. Identical row scores can remain separate evidence but contribute only one effective provider/metric input.

Migration `0004_import_provenance.sql` adds `movie_import_refs`, original `seen_import_observations`, and immutable apply fingerprints. Source scores gain `source_ref`, `source_ordinal`, and `legacy_preferred`; uniqueness includes the source ref, preserving conflicting rows captured at one time. Existing snapshots and all prior import/upstream/retrieval fields are retained. Should Watch movie refs also audit membership origins; `legacy_reference` is never used as a list.

## 5. Validate and preflight a dedicated local preview

```sh
pnpm db:import-preview:prepare
pnpm import:apply:local --plan .verification/import/resolved-plan.json --config scripts/import/import-config.local.json
```

Preparation runs all migrations and inserts only Host 1–4 with the confirmed stable IDs, never demo films/events, email addresses or auth bindings. `worker/wrangler.import-preview.jsonc` is a separate config with only a dummy local database identity, `APP_ENV=local` and local auth bypass. Its state is `worker/.wrangler/import-preview/`; normal development state is separate. All Wrangler preview commands include `--local --env import_preview --persist-to worker/.wrangler/import-preview`.

The apply CLI opens Wrangler's installed Miniflare D1 emulator directly, using that fixed preview identity and state directory. It cannot call a remote D1 API and accepts no environment, DB identity or `--remote` option. Configuration/junction guards refuse a production binding or redirected state directory. Do not run the preview Worker or other writers during apply.

Preflight requires an explicit capture timestamp matching the resolved plan, four positional IDs/placeholder members, schema 0004 compatibility, valid references/ordering/seeds/provenance and zero reconciliation blockers. Auth rows also cause refusal. Preflight reports create/reuse totals for movies/refs/IDs, cycles/events/appearances, memberships/snapshots/answers, provisional identities, conflicts and capture time; generated reports are ignored. It performs no application-data writes. Invalid plans fail before opening D1; storage/schema conflicts fail before writes.

## 6. Apply, verify and inspect locally

```sh
pnpm import:apply:local --plan .verification/import/resolved-plan.json --config scripts/import/import-config.local.json --apply
pnpm dev:import-preview
```

`--apply` is the explicit confirmation flag; without it the command remains preflight-only. Dependency-ordered D1 batches keep each movie/ref/ID group and each event with its ordered joins transactional; groups have a 100-statement bound. Cycles, memberships, snapshots and original/canonical Seen follow in dependency order. All group bounds are checked before writes. The whole archive is resumable rather than one giant transaction: a failed batch rolls back that group, earlier committed groups remain, and identical reruns resume safely.

Stable refs and payload fingerprints reject changed identity, prior payloads, additional/changed event joins, seed conflicts or removals of previously applied entities. There are no deletes or last-write-wins identity updates. An identical rerun creates nothing. Retain the resolved plan/config used for a preview; resolving more evidence after applying may deliberately cause a conflict and requires a separately reviewed new preview, never silent remapping.

Post-apply queries verify actual imported cycle/event/appearance counts against the plan (the reference archive expects 55/250/465), all planned rows, no orphan foreign keys, unique refs/seeds, valid Seen/provenance and derived current ranking. Membership count is derived after reconciliation; report source candidates, canonical memberships and duplicate collapse. `apply-preflight.json` and `apply-report.json` record aggregates privately.

The browser uses http://localhost:5173/ and the isolated preview Worker on 8787. `dev:import-preview:ui` selects the development-only Vite import-preview mode, which fixes the API origin to localhost even if root env configuration points to production. Inspect History, Cycles, Classics, Seen It? and film detail with no Google sign-in. Startup never loads demo history. Provider credentials are optional and used only for explicit operations; no private file is copied. Stop normal development servers first to avoid port conflicts. Mobile/browser visual inspection remains an owner check.

Only a **future separately authorised pass** may design and execute production import, with backups, private roster/auth bootstrap and reviewed reconciliation. No production D1 access, deployment, Pages publication, commit or push is part of this workflow.

## Verification

`pnpm test`, `pnpm typecheck`, `pnpm build`, and `git diff --check` verify the implementation. Tests use fictional workbooks, disposable SQLite D1 adapters and mocked TMDB, never live providers or production accounts. Local integration can use the preview config with an alternate ignored `.verification/` persistence directory to exercise a fictional import without contaminating the owner's real preview. Keep live identity smoke requests small and explicitly capped; ordinary tests stay offline.
