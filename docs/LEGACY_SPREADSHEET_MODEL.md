# Legacy spreadsheet model

Tracker is the authoritative historical event source. A nonblank date in A starts a cycle; blank rows continue it. Merged-cell followers are blank source cells, not repeated dates or films. Each populated B–E host column yields one event per cycle, with films in vertical viewing order. F yields a hostless Classics Collection event. Source slots reproduce grouping, not chronology. Cycle dates are approximate; historical events use `cycle_rough` precision. G contains ancillary Not Book Club titles and is report-only. Sheet2 is an old helper, never canonical history.

Should Watch contains candidates in A; IMDb, RT audience and RT critic on 0–100 scales in B–D; Seen answers in F–I in the same member order as Tracker B–E. E/J/K are diagnostic helpers, L is a duplicate/helper title, M is an IMDb URL, N year, O Metacritic, P Letterboxd. J actually stores the explicit No count (the exponent), despite the Unseen Multi heading. Unknown remains absence; trim Yes/No whitespace and compare case-insensitively.

Historical ranking is `(IMDb² + RT audience² + RT critic²) × 1.025^explicitNoCount + rankSeed × 0.00001`. All active members explicitly Seen disqualifies and negates the score. All three source ratings must exist to rank. Unknown neither receives novelty nor disqualifies. Metacritic, Letterboxd and TMDB never enter this formula. Legacy seeds are worksheet row numbers. App seeds are allocated transactionally and survive membership removal/readdition.

Watch Order contains derived output only, including the headerless rank/title layout with cached formula results. Recompute it; never persist it. The reference snapshot has 55 cycles, 220 hosted events / 406 appearances, 30 Classics events / 59 appearances: 250 events / 465 appearances. Should Watch has 373 scored and 254 title-only rows, totalling 627 before reconciliation. These counts are diagnostic expectations, not hard limits for later snapshots.

Duplicates may conflict in ratings or answers. Identical workbook IMDb IDs can confidently link proposed identities, but all source rows/memberships remain visible for review. No title/fuzzy matching automatically merges films. Titles and history stay in ignored reports. Capture timestamps absent from the workbook remain unknown in the dry-run; an eventual apply must explicitly choose a bootstrap capture policy.

Classics lifecycle: candidate → ranked choice → Classics event → explicit Seen answers → disqualified. Event creation does not silently manufacture Seen answers.
