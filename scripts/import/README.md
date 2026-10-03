# Future spreadsheet importer

The actual importer belongs in this directory. No real spreadsheet has been provided and no importer is implemented.

Treat the spreadsheet as read-only input. Begin with a copy and a dry-run mapping report. Resolve the historical meaning of cycle labels with the owner before deciding whether a cycle groups films, events, or another concept. `sessions.legacy_cycle_label` preserves the literal label without assigning that meaning today. A future cycle entity/relationship can be added by migration once semantics are known.

Import boundaries:

- Create canonical local movies using stable import source/key pairs; attach provider IDs through `movie_external_ids`. Do not merge films solely on similar titles.
- Group events in `sessions`, preserve dates, hosts, literal cycle labels and notes. Use `session_movies.position` for all positive viewing positions; there is no three-film limit and repeated appearances are permitted.
- Add candidates through `classics`, preserving source and legacy reference.
- Import captured scores into `source_scores` with provider, metric, raw value/scale, optional normalisation, capture timestamp, and import keys. Preserve snapshots; do not migrate an old rank as the current calculated score.
- Map the four real members explicitly to stable member IDs. Write `seen_states` only for explicit Yes/No. Unknown means no row.
- Use parameterised SQL and transactional D1 batches. Preflight foreign keys and unique external IDs. Make reruns idempotent through `(import_source, import_key)` constraints and stable joins.
- Produce an import report, verify counts/order and unknown answers, and back up any existing durable data before an authorised import. Do not reuse `worker/reset.sql` against real data.

Canonical state lives in D1. The Worker repository/service boundary owns ordinary writes. A future offline importer can prepare validated records and commit through an authorised tool or API; the static frontend never receives database credentials.
