# BookClub pre-launch corrections

8 October 2026. Initial main/worktree: clean at `1cdc82cd9ef682d46378b1eb8c2a502695d57725`; the completed semantic-style-unification pass is already in this ancestry. All verification fixtures are synthetic. Production access is limited to the authorised release and read-only smoke/schema checks.

## A. Correct Home Cycles Completed

**Complete.** The milestone is the greatest completed chronological ordinal from active Classics completion/import evidence or a completed later first turn. Sparse older imports no longer reduce the figure; unfinished future turns, deleted events and unknown cycles do not qualify. A read-only local aggregate verified final completion at ordinal 55. Completed-turn workflows and History data are unchanged.

Source / evidence: shared/metrics-summary.ts; tests/home-timeline.test.ts.

Departure / limitation: None.

## B. Compact Watch Time

**Complete.** Appearance-weighted known runtime, including repeats, now displays unbounded H:MM with two-digit minutes. Existing statistic tabular numerals are retained.

Source / evidence: shared/metrics-summary.ts; tests/home-timeline.test.ts; tests/format-count.test.ts.

Departure / limitation: None.

## C. Home strip alignment

**Already satisfied.** Already satisfied by the unified three-column stats-grid. Browser geometry proves equal edges, widths and segment tracks for Quick Facts, Timeline and Snapshot at all five required widths; no duplicate containers or CSS were needed.

Source / evidence: frontend/styles/home-history.css; tests/pre-launch.browser.mjs.

Departure / limitation: None.

## D. History ordering and hosts

**Complete.** Newest cycles now show descending canonical event positions; oldest mode reverses them. Context uses active recorded events and stored hosts in chronological order, independently of host filtering. Sparse/legacy evidence is retained honestly, with unknown positions/hosts labelled. Pagination, filtering, edits and viewing order remain intact.

Source / evidence: shared/history-order.ts; frontend/HistoryScreen.tsx; tests/history-home-integration.test.ts; tests/pre-launch-semantics.test.ts.

Departure / limitation: None.

## E. Builder overview

**Complete.** Saved-set cards contain title/fallback, the existing ordered poster/title strip and Open set. Count/date and historical note narration are omitted; private notes still persist unchanged.

Source / evidence: frontend/BuilderScreen.tsx; tests/builder-inspection.test.ts.

Departure / limitation: None.

## F. Contextual Back

**Complete.** Ordinary Detail/Preview show heading Back. App-owned transient history entries identify a trustworthy origin, preserve its mounted Builder/Event/History/Classics/Metrics state, and restore scroll. Browser back/forward preserves the open Builder draft. Direct/refreshed entries return Home. Event Yes/Nope, Builder Add to Set and Seen Back remain specialised without redundant Back. No backend draft mechanism was added.

Source / evidence: frontend/useHashRoute.ts; frontend/App.tsx; tests/detail-back.test.ts; existing inspection/Seen suites; tests/pre-launch.browser.mjs.

Departure / limitation: None.

## G. Availability provenance

**Complete.** Removed the inline cache/source line while retaining offers, empty states and shared footer provenance.

Source / evidence: frontend/AustralianAvailability.tsx; existing au-watch-offers and product UI suites.

Departure / limitation: None.

## H. Builder divider

**Complete.** Removed Delete set’s top border and the final Builder lineup row’s bottom border; intermediate row separators remain. Standard whitespace separates the subdued destructive action.

Source / evidence: frontend/styles/builder-event.css; rendered Builder editor.

Departure / limitation: None.

## I. Divider roadmap

**Complete.** Added the active Priority 2 Bottom horizontal divider consistency sweep; no unrelated application sweep was performed.

Source / evidence: ROADMAP.md.

Departure / limitation: None.

## J. Score information control

**Complete.** The named 44px Info target is absolutely anchored above its own score instance with a small negative offset and no dedicated help line. Preceding metadata keeps clear of the target. Inline/stacked scores, critic divider, focus and empty-score omission are preserved.

Source / evidence: frontend/components.tsx; owning shared/detail/Classics-Seen styles; tests/score-abbreviations.test.ts; tests/compact-scores.browser.mjs.

Departure / limitation: None.

## K. Four-column glossary

**Complete.** The native dialog now contains Abbreviation, Source, Native, Normalised. IMDb/TMDB expand fully. Explicit source scale/step metadata generates examples, not film ratings; Ebert uses half /4, Letterboxd half /5, IMDb and MC user tenths /10, TMDB native half /10, Trakt integer /10, critic/RT percentages integer /100. Normalised percentages suppress trailing zeroes. Aggregate/parser precision is unchanged. Mobile overflow is contained.

Source / evidence: shared/rating-dimensions.ts; frontend/components.tsx; tests/score-abbreviations.test.ts; tests/pre-launch-semantics.test.ts.

Native examples describe permitted source rating increments, not the precision of averaged imported observations. References: [TMDB native ratings](https://developer.themoviedb.org/reference/movie-add-rating), [Letterboxd scale](https://letterboxd.com/about/faq/), [Trakt ratings](https://docs.trakt.tv/reference/getusersratingsmovies).

## L. Desktop Unranked count

**Complete.** Classics and Navigation share isUnrankedClassic. The existing catalogue supplies the count through AppShell. Rose pill hides at zero, caps at 99+, exposes the exact count accessibly and works in both drawer states; the mobile dock has none.

Source / evidence: frontend/ClassicsScreen.tsx; frontend/Navigation.tsx; frontend/AppShell.tsx; tests/pre-launch-semantics.test.ts.

Departure / limitation: None.

## M. Footer width

**Complete.** Removed the faux-column max-width; native attribution spans the available content width with unchanged tiny typography, links and touch target. All six primary routes and disclosure states were rendered at five widths.

Source / evidence: frontend/styles/app-shell.css; tests/pre-launch.browser.mjs.

Departure / limitation: None.

## N. Top Directors copy

**Complete.** Removed successful director-coverage narration; rankings, percentages and real empty feedback remain.

Source / evidence: frontend/metrics/TopBottom.tsx.

Departure / limitation: None.

## O. Talent copy

**Complete.** All roles now read Share of appearances with <role> credit. Removed Director’s appended explanation without changing credit matching.

Source / evidence: frontend/metrics/Fingerprints.tsx.

Departure / limitation: None.

## P. Studio copy

**Complete.** Removed coverage and multi-company narration. Studio values, evidence and meaningful empty feedback remain.

Source / evidence: frontend/metrics/Standalone.tsx.

Departure / limitation: None.

## Q. Contribution copy

**Complete.** Removed redundant all-time/selected-identity subtitle; heading, chart and counts remain.

Source / evidence: frontend/metrics/General.tsx.

Departure / limitation: None.

## R. Genre detail

**Complete.** Copy is Multi genre films count once in each. Numeric columns have equal widths, common padding, right-aligned headers/values and tabular numbers; Genre uses the remaining width. Sticky bounded scrolling remains.

Source / evidence: frontend/metrics/General.tsx; frontend/styles/metrics.css; tests/metrics.browser.mjs.

Departure / limitation: None.

## S. Australian classification

**Complete.** Only presentation combines Other and Unknown counts/shares into Other/Unknown with the Unknown colour. Six rows remain; canonical data and known-classification headline denominator are unchanged. Removed the appended denominator narration.

Source / evidence: frontend/metrics/Profiles.tsx; frontend/metrics/Standalone.tsx; tests/pre-launch-semantics.test.ts.

Departure / limitation: None.

## T. Revenue ratios

**Complete.** Removed redundant parent heading. Every result has stacked USD budget/revenue label/value rows, right-aligned comma-separated amounts, preserved ratio/title/year and an unbreakable rank marker. Sorting/ties/pagination are unchanged.

Source / evidence: frontend/metrics/General.tsx; frontend/styles/metrics.css; tests/metrics-enrichment-ui.test.ts.

Departure / limitation: None.

## U. Ratings Profile

**Complete.** Subtitle is Mean /100. Exactly ten approved circles always render, with proportional fill by ten-point interval, neutral empty circles and preserved visible mean/median. Tests include 0, fractions, exact tens, 70.4 and 100.

Source / evidence: frontend/MetricsVisuals.tsx; frontend/metrics/Averages.tsx; tests/metrics-refinements.test.ts.

Departure / limitation: None.

## V. Median economics

**Complete.** Subtitle is Reported USD. Unused median tracks are transparent; coloured paired lengths, touching geometry, scales and ratios remain.

Source / evidence: frontend/metrics/Averages.tsx; frontend/styles/metrics.css.

Departure / limitation: None.

## W. Diversity structure

**Complete.** Removed top heading/prose and Themes report; the lazy cached diversity calculation now evaluates four dimensions. Theme Fingerprint remains. Remaining local reports and empty states are preserved without an empty wrapper.

Source / evidence: frontend/metrics/Diversity.tsx; frontend/EnrichedMetrics.tsx; metrics assignment/performance tests.

Departure / limitation: None.

## X. Recurring cast copy

**Complete.** Removed the appended one-off explanation; the per-ten calculation is unchanged.

Source / evidence: frontend/metrics/Diversity.tsx.

Departure / limitation: None.

## Y. Production countries copy

**Complete.** Removed distinct-count narration and repeated Appearance count and share below country bars. The Bar detail prop is optional; other useful descriptions retain their own values. Counts/shares and empty feedback remain.

Source / evidence: frontend/metrics/Standalone.tsx; frontend/MetricsVisuals.tsx.

Departure / limitation: None.

## Z. Cabinet

**Complete.** Visible tab/heading are Cabinet; internal extremes identity and keyboard/cache behaviour remain. Added Newest by strict valid actual ISO release date and Shortest by finite positive runtime, preserving unique-film ties and Oldest/Longest semantics. Categories use requested order; known directors appear below year. Sub-cards have symmetrical standard insets and neutral headings; creator role words are heavier.

Source / evidence: shared/metrics.ts; frontend/metrics/Extremes.tsx; frontend/metrics-tabs.ts; tests/pre-launch-semantics.test.ts; Metrics suites.

Departure / limitation: None.

## AA. Top/Bottom mobile

**Complete.** Reduced score-filter padding while retaining scroll fallback, normal labels/focus and selection. Full-width result rows have symmetrical standard insets, unparenthesised year plus cycle/film context beside the score, and a separate right-docked identity column. Missing-host/Classics treatments remain.

Source / evidence: frontend/metrics/TopBottom.tsx; frontend/styles/metrics.css; tests/presentation.test.ts; Metrics/browser suites.

Departure / limitation: None.

## AB. Popular/obscure inset

**Complete.** Both poster lists now use standard symmetrical horizontal row padding and retain full-width dividers, posters and links.

Source / evidence: frontend/styles/metrics.css; tests/metrics.browser.mjs.

Departure / limitation: None.

## AC. Keyword casing

**Complete.** Natural phrases as well as lowercase single words/slugs capitalise their first character and preserve subsequent spelling/case. Provider precedence, canonical identities and deduplication are unchanged.

Source / evidence: shared/theme-keywords.ts; theme-keywords and theme fingerprint tests.

Departure / limitation: None.

## AD. Genre comparison label

**Complete.** Only Genre fingerprint passes the Brought label to ComparisonBars; Club remains and the shared default stays Selected for other consumers.

Source / evidence: frontend/metrics/Fingerprints.tsx; frontend/MetricsVisuals.tsx.

Departure / limitation: None.

## AE. Authoritative docs

**Complete.** Reconciled lasting Home, History, navigation, glossary, classification, Cabinet, circle and Diversity rules in current authorities, including discovered Metrics mount/Quick Facts documentation drift. The roadmap remains active-only.

Source / evidence: STYLE.md; docs/DATA.md; docs/ARCHITECTURE.md; docs/TESTING.md; ROADMAP.md.

Departure / limitation: None.

## AF. Regression and rendered acceptance

**Complete.** All 90 test files / 1,115 tests pass. Lint and typecheck pass. Production build, prod:check, prod:check --frontend and both Wrangler dry-runs pass. Five-width synthetic primary-route/Builder/Detail/Preview/Metrics/glossary/footer/navigation inspection and 64 compact-score checks pass, with no page errors/overflow. Existing populated/sparse Metrics browser checks pass. Changed test expectations track the requested behaviour; persistence, precision, ties and caching assertions remain.

Source / evidence: tests/pre-launch.browser.mjs; tests/compact-scores.browser.mjs; tests/metrics.browser.mjs; ignored .verification/pre-launch evidence.

Rendered checks use synthetic local fixtures and blocked provider traffic. Authenticated production smoke is separate and must be recorded after publication.

## AG. Committed handoff report

**Complete.** This temporary report records actual changes and evidence per letter. It is included in the intended release commit and will receive a factual deployment closeout commit. No private fixture, owner, snapshot or credential contents appear here.

Source / evidence: PRE_LAUNCH_FIXES.md.

Release outcome fields remain pending until deployment completes.

## AH. Authorised cleanup

**Blocked.** Safety review identified obsolete unreferenced candidates and retained workflow references. Automatic approval review rejected both guarded and explicit absolute-path native PowerShell deletion commands as “blocked by policy”. No deletion was executed; all candidates remain. The release proceeds because this cleanup blocker does not affect application correctness.

Source / evidence: Supplied exact candidate inventory; native PowerShell path/worktree/dependency guards.

Deletion commands were unavailable under automatic tool approval policy. No source-history rewrite or alternative deletion mechanism was attempted.

## AI. Full production release

**Partially complete.** Pending source commit/push and coordinated API then frontend publication. Read-only Cloudflare target/authentication checks succeeded; the production ledger contains all tracked 0001–0018 migrations, with no pending migration or schema change. No schema mutation/backup is required for this release.

Source / evidence: docs/DEPLOYMENT.md; exact configured bookclub-prod / bookclub-api / bookclub-frontend targets.

The application has not yet been published from this change.

## Cleanup inventory

No files were deleted.

| Candidate | Outcome | Reason |
| --- | --- | --- |
| `docs/NOMINAL_AND_SCORE_FORMAT_AUDIT.md` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/admin-enrichment` | Skip | Retained tracked references: docs/TESTING.md, tests/admin-enrichment.browser.mjs |
| `.verification/artwork-preflight` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/builder-search` | Skip | Retained tracked references: docs/TESTING.md, tests/builder-search.browser.mjs |
| `.verification/film-selection` | Skip | Retained tracked references: docs/TESTING.md, tests/film-selection.browser.mjs |
| `.verification/frontend-architecture` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/home-history-builder` | Skip | Retained tracked references: docs/TESTING.md, tests/home-history-builder.browser.mjs |
| `.verification/home-status` | Skip | Retained ignored workflow reference: .verification/home-status.mjs |
| `.verification/mobile-classics` | Skip | Retained tracked references: tests/mobile-classics.browser.mjs |
| `.verification/p1-product` | Skip | Retained tracked references: docs/TESTING.md, tests/p1-product.browser.mjs |
| `.verification/pass2-baseline` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/product-build` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/seen-layout` | Skip | Retained tracked references: docs/TESTING.md, tests/detail-seen-layout.browser.mjs |
| `.verification/shared-controls` | Skip | Retained tracked references: tests/shared-controls.browser.mjs |
| `.verification/sign-in` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/targeted-improvements` | Skip | Retained ignored workflow reference: .verification/targeted-improvements.browser.mjs |
| `.verification/worker-observability-dry-run` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/legacy-document.tmp` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/architecture-tranche.diff` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/architecture-tranche-files.txt` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/alignment-before.json` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/alignment-after.json` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/alignment-detail.json` | Skip | Retained ignored workflow reference: .verification/alignment-detail.mjs |
| `.verification/app-before.css` | Skip | Retained ignored workflow reference: .verification/alignment-detail.mjs |
| `.verification/app-after.css` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/lint-initial.txt` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/lint-final.txt` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/full-tests.txt` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/full-tests-final.txt` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/build-final.txt` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/product-pass-report.md` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/pass2-baseline.patch` | Blocked | Deletion command rejected by automatic approval policy |
| `.verification/pass2-results.json` | Skip | Retained tracked references: tests/ui-alignment.browser.mjs |
| `.verification/pass2-width-results.json` | Skip | Retained tracked references: tests/ui-alignment.browser.mjs |
| `worker.verification/worker-observability-dry-run` | Absent | Not present |

Explicitly retained: original label audit/inventory/CSV, STYLE_UNIFICATION_DECISIONS, both UI audits, REFRESH_AUDIT, style-unification/css-ownership/label-audit/current-release evidence, all registered worktrees including metrics-release-20261008, identity/pairing/import/backup evidence, artwork-snapshot.json, browser/dependency/auth/local DB/private owner material, maintained tests/source assets, dist/generated/caches and this report.


## Release summary

- Release commit / pushed remote SHA: pending.
- Production schema: all tracked migrations 0001–0018 applied; no pending migration (read-only remote ledger verified).
- Build inputs: production API origin and the unchanged Google Web Application client ID recovered from the currently published public bundle; private material excluded.
- API Worker: pending.
- Frontend LAST: pending.
- Production smoke: pending.
- Outstanding: cleanup and release completion.
