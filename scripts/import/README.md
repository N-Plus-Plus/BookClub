# Spreadsheet dry-run

`docs/LEGACY_SPREADSHEET_MODEL.md` owns the durable domain semantics. The Node/TypeScript pipeline uses ExcelJS to read XLSX dates, cached formulas and merged cells without executing workbook formulas. `tsx` runs the TypeScript CLI on the established Node toolchain. Both are development dependencies; neither enters the browser/Worker bundle. No Python, D1 binding, database write, network resolution or apply command exists here.

Copy `import-config.example.json` to `import-config.local.json`. Privately set four distinct stable member IDs in Tracker B–E order; that same order maps Should Watch F–I. No private names are required. The example uses production bootstrap placeholder IDs; confirm the actual roster before relying on its mapping. Populated configs and XLSX files are ignored. Optional `snapshotCapturedAt` identifies an explicitly known capture time; otherwise historical snapshot/answer timestamps remain null in the plan, for review before apply.

```sh
pnpm import:spreadsheet --file "path/to/private.xlsx" --config scripts/import/import-config.local.json
```

The workbook may live anywhere. Reports are restricted to the ignored `.verification/` tree, including checks for existing symlinks/junctions. The default `.verification/import/` contains `plan.json`, `report.json` and `report.md`. An optional `--out .verification/import/another-snapshot` keeps separate runs. Console output contains aggregate counts only. Reports contain private history and must not be committed or publicly shared. The workbook and config are read-only.

Tracker cycles/events/positions retain source row/column references and deterministic import keys. All title-bearing Should Watch rows become membership records, including title-only candidates. Scores preserve source, raw scale, provenance and row seed; Seen imports explicit Yes/No only. Source B–D is canonical; E/J/K is recomputed for diagnostics. Formula errors/uncached results, malformed helpers, incomplete ratings, whitespace, Unknown answers, duplicates, top-20 differences and count drift are reported. Unrecognised layouts, missing sheets and invalid cycle dates fail safely. Count drift in a growing snapshot does not fail parsing.

Watch Order is verification-only. Sheet2 overlaps/unmatched aliases and Not Book Club titles are report-only. Source ID matches link identities; exact title/year or title-only overlap remains a manual suggestion. Never merge conflicting duplicate rows solely by title. Even ID-linked duplicate membership rows preserve their distinct seeds, snapshots and answers in the plan, requiring an explicit reconciliation decision before apply. No captured rank is imported as permanent order.

The plan is a validated proposal, **not apply-ready SQL**. It does not compare against existing D1 or independently verify workbook IDs with a provider. Review unresolved identities, conflicts, timestamp policy and private member mapping, then separately authorise an apply implementation. That later pass must back up durable data, preflight constraints and use idempotent import keys and atomic D1 batches. Do not use reset scripts on historical/production data. CI uses a fictional workbook generated in `tests/importer.test.ts`, never this private archive.
