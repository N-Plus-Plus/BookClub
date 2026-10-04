# Guarded production cutover

Production historical cutover uses the trusted local operator process and authenticated Cloudflare D1 REST queries. Execution requires explicit owner authorisation; ordinary development and `import:apply:local` remain local. Application Worker deployment and Pages publication remain separate release operations.

Historical import and four-member/auth bootstrap are complete and verified, with open cycle 55 / Classics slot 5 / version 0. Application deployment is pending. Do not repeat bootstrap after real user actions.

Migrations 0001–0008 are complete. The exact archive was rehearsed again after the 0005 parser correction. Retain the original pristine pre-migration export and proof; do not overwrite them. Applied migrations must not change.

## Rehearse the exact archive first

Use the isolated preview steps in [README.md](README.md). Stop preview writers during apply. Preserve the original raw plan, cache, private overrides, prior owner correction records and resolved plan; original source-year evidence stays in that private archive. Do not rerun resolution after rehearsal without repeating the gate and using a separately reviewed fresh preview.

The authorised capture is `2026-10-04T06:53:20Z`. The archive baseline is 55 cycles, 250 events, 465 appearances, 1,092 source records and 627 candidate source rows. Slot 1 has 55 exact dates; the 195 other historical dates are cycle references. Require zero blockers, ambiguity and Seen conflicts, all 54 original owner TMDB mappings verified, unique/accounted-for refs and IDs, unchanged historical top 20, and derived canonical Watch Order. Amadeus's two legacy rows remain nonblocking evidence; no preferred row is supplied.

An identical explicit local apply must finish with zero conflicts and pending writes. Keep the fresh preflight, first apply, idempotence and actual catalog audit reports privately. No live metadata enrichment is required to import missing metadata.

```sh
corepack pnpm import:production --action prepare --plan .verification/import/resolved-plan.json --config scripts/import/import-config.local.json
```

`prepare` has no remote boundary. It checks the actual preview fingerprints, FKs, roster and migrations, then writes ignored `.verification/production/rehearsal.json`, binding the exact plan bytes and migration contents to the configured production name/ID. It creates `bootstrap.local.json` only if absent and never overwrites an existing private bootstrap. Blank email fields deliberately fail all later stages. The receipt is evidence of this exact local rehearsal, not a remote backup.

The tracked production binding is read from `worker/wrangler.jsonc`; its database name must be `bookclub-prod`. No second database ID is embedded in tooling. Public reports never contain bootstrap emails or credentials.

## Private member and open-turn bootstrap

Privately fill all four `authorized_email` fields using the intended Google Account identities, in lowercase trimmed form. Keep this file ignored. It supports display name, email, role, active, sort order, initially null Google sub and initially null avatar. Fixed positions and authorised roles are:

| ID | Position | Initial role |
| --- | --- | --- |
| club-member-1 | Sean | admin |
| club-member-2 | Troy | admin |
| club-member-3 | Matt | member |
| club-member-4 | Jess | member |

The private rotation is explicitly open Classics, slot 5, version 0, on the reviewed cycle 55 ID. That cycle's historical slots 1–4 exist and slot 5 must be free. Bootstrap inserts only the singleton state; it creates no event, completion, films or next cycle. First production use should enter the two films from the current real Classics event. Its explicit completion advances normally to Sean/slot 1 with no cycle; Sean's later slot-1 publication creates the next cycle.

Member/auth provisioning and rotation bootstrap check all existing state before writes. An identical pre-launch rerun is accepted. Different names, roles, emails, subjects, avatars, unknown members, active auth sessions, occupied current slot or advanced rotation version fail closed. Nothing resets established login or rotation state. Do not rerun this bootstrap after launch to change identities or rewind a turn.

## Execution gates

Every action except `prepare` requires these explicit arguments, with placeholders replaced from the reviewed configuration and receipt:

```text
--mode production
--database-name bookclub-prod
--database-id <EXACT_TRACKED_ID>
--plan-hash <EXACT_REHEARSED_SHA256>
--confirmation APPLY-BOOKCLUB-PRODUCTION
--plan .verification/import/resolved-plan.json
--config scripts/import/import-config.local.json
--bootstrap .verification/production/bootstrap.local.json
```

The plan must strictly validate, contain no reconciliation blockers, match the private config and exact capture, and retain the authorised baseline. Changed plan bytes or migration contents invalidate the rehearsal receipt. Missing flags, spelling mistakes, wrong target, incomplete private bootstrap and missing or changed backup proof abort before mutation. There is no reset, wipe, arbitrary SQL or local-importer remote switch.

Remote actions additionally require process-only `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` with the appropriate D1 permissions. Do not put credentials on command lines or in tracked files. The REST boundary verifies the actual remote database UUID/name before querying it; ordinary preflight/verify boundaries expose only read queries. The separate writable boundary requires explicit production apply and is opened only after offline gates, migrations and read-only preflight pass. All raw provider/Wrangler errors and output are suppressed.

Launch the production CLI through `corepack pnpm import:production`. The Wrangler command boundary uses Node to run the active pnpm CLI from `npm_execpath` with `exec wrangler`, selecting the project-local dependency. Missing or non-pnpm execution context fails closed. It uses no private Wrangler package paths, global CLI fallback or shell invocation; metrics are disabled and sensitive command output remains suppressed.

Remote migration parsing differs from local SQLite parsing. Migration 0005 uses LF endings (pinned by `.gitattributes`) and trigger `WHEN` predicates rather than nested `SELECT CASE ... END` guard bodies: the remote D1 query parser rejected the original bodies with `incomplete input: SQLITE_ERROR` (7500). Preserve these forms. A local migration pass alone cannot establish remote parser compatibility. If a migration fails, verify its ledger and every schema effect before retry; capture diagnostic output only in ignored private files and keep the normal error boundary suppressed. Correct only a proven defect in an unapplied migration, then repeat the exact fresh archive rehearsal and regenerate its receipt before further production mutation. Applied migrations remain immutable.

## Backup, migrations and production preflight

After separate owner authorisation, run `--action backup` with all gates. This uses the supported [Wrangler D1 export](https://developers.cloudflare.com/d1/wrangler-commands/#d1-export) mechanism, with the tracked production configuration and explicit `--remote`. It exports schema and data to a new timestamped ignored SQL file before any migration/bootstrap/import. It records database name/ID, UTC timestamp, exact plan hash, export SHA-256, byte count and path in a private proof JSON file. Existing backup paths are never overwritten. A successful command, nonempty export and matching content hash are required; keep an independent safe copy. This is export-integrity verification, not a claimed restore rehearsal.

Run `--action migrate` with all gates plus `--backup-proof <PRIVATE_PROOF_JSON>`. The tooling rechecks the export's actual bytes/hash. An older populated application schema is refused for separate review; the initial workflow never silently migrates existing live payloads. An already current database receives the immutable production preflight before a migration command. Wrangler applies existing versioned migrations; success is checked against `d1_migrations`, including 0008 and the cooldown table. A failure stops the workflow; do not reset or manually edit import fingerprints.

Run `--action preflight` after migrations. This is read-only and checks schema, product invariants, score provenance, planned/existing rows, external ownership, seeds, immutable fingerprints, extra event joins, member/auth conflicts, open-slot availability and FKs. A complete roster may be projected for this read-only preflight before actual provisioning. No projected row is persisted. All conflicts must be reviewed before import.

## Direct local-operator REST apply

Run `--action apply` with all gates and `--backup-proof <PRIVATE_PROOF_JSON>`. No runner URL, cutover token, Worker configuration or deployment is required. The CLI verifies exact remote identity, migrations and read-only preflight, opens the explicit writable boundary, then uses the existing domain functions to provision the four members/auth rows, import the exact archive, insert open rotation last, and verify through the read-only boundary. Keep the application unavailable and prevent concurrent writers throughout cutover.

The authenticated [D1 query endpoint](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/) accepts bounded query batches. Each request has at most 100 statements including fingerprints. We do **not** assume REST batches share native Worker `DB.batch()` atomic rollback semantics. The response envelope, result count, every result's literal success and results array must be valid. Network, HTTP, malformed, mixed or incomplete responses stop apply; upstream sensitive details are suppressed. No automatic retry occurs.

The importer preserves deterministic dependency order: movie/ref/external-ID groups, cycles, event headers/ordered joins, memberships, scores/provenance and Seen state/evidence. Immutable fingerprints and row comparison are the recovery mechanism. A failed or ambiguous request may leave some rows written. Stop and run read-only preflight before any continuation. Matching existing rows without fingerprints remain pending; differing rows/fingerprints or a fingerprint with a missing entity are conflicts. Identical continuation is safe only after inspection establishes zero conflicts and expected pending entities. Never delete partial state, reset D1, replace rows or blindly replay. The whole archive is not a single transaction.

`runner-config` and `--runner-url` are removed from the CLI. `production-worker.ts` is retained as retired, unused code; do not deploy it. No temporary Worker is part of this path.

## Verify and close the cutover

`--action verify` uses REST reads only. It checks applied migrations, all imported payloads and fingerprint hashes, source refs/IDs/seeds, 55/250/465 imported history, FK integrity, four intended members and Sean/Troy admin roles, four null-sub auth rows/null avatars, score and Seen provenance, cooldown schema, open Classics slot 5/version 0 with an unoccupied current slot, catalog loading and canonical top 20. Historical event/date precision is checked by immutable plan comparison. No current Classics event is required immediately after bootstrap.

After verification, remove abandoned private cutover token/config material and verify no temporary runner exists. Preserve the general Cloudflare API token. Preserve all private proofs and archive evidence. Application deployment, Worker secrets, GIS origin/audience checks, Pages publication and first-login/mobile visual checks remain distinct release operations. Do not run bootstrap again after real user actions. If any stage fails, stop, preserve the export and partial state, and use read-only preflight; never overwrite conflicts, reset D1 or delete unrelated rows.

Tests use fictional accounts, disposable D1 adapters and mocked commands/fetches. REST tests include simulated partial groups and malformed/mixed responses; they make no remote calls. Ordinary test/typecheck/build/prod-check scripts never execute production operations.
