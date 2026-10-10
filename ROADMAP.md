# ROADMAP.md

This file records user-approved future work for the project.

Do not add speculative feature work automatically. Add, reprioritise, or remove roadmap items when the user explicitly asks, or when the user agrees that deferred work should be recorded here.

Agents may add genuine Priority 0 blockers and evidence-based Priority 0.5 stale/failing tests under the rules below.

## Priority model

Lower numeric priorities are more urgent; recall sorts in ascending numeric order.

- **Priority 0**: immediate must-address work. The user may assign urgent correctness, usability or product-invariant work here. Agents may add Priority 0 themselves only for genuine blockers that prevent the application from functioning or prevent another approved task from proceeding.
- **Priority 0.5**: reserved exclusively for stale or failing non-blocking test cases that should be addressed as a maintenance group later.
- **Priority 1**: the user's highest-priority planned feature or improvement work.
- **Priority 2+**: progressively lower priority.
- There is no upper limit.
- Multiple items may share the same priority.

Priority is relative. It is not a measure of effort, complexity, or severity.

Do not renumber existing items merely to make room.

## Adding ordinary roadmap work

When the user says to "add this to the roadmap", this file is the destination.

Each item should include:

- priority;
- short title;
- concise intended outcome;
- any dependency that materially affects sequencing.

Keep entries brief. The roadmap chooses future work; it is not a design specification.

If the user gives a priority, use it.

If no priority is given, ask for confirmation with a suggested number positioned against nearby work. Prefer:

> Make this Priority 3, ahead of X but after Y?

Mention one neighbour above and one below when both exist.

Do not silently assign an ordinary feature priority when sequencing is ambiguous.

## Priority 0 blockers

An agent may add Priority 0 without asking only when it discovers a genuine blocker that:

- prevents the application from functioning; or
- prevents another approved roadmap item from proceeding.

Keep agent-added blockers narrowly scoped.

When resolved, remove the blocker from the active roadmap.

User-assigned Priority 0 work does not need to satisfy the blocker-only rule.

## Stale/failing test policy

Priority 0.5 is reserved for tests that fail because the test case appears stale, obsolete, or out of sync with intended current behaviour, while the failure does not block application function or other approved work.

Agents may add entries here without first asking the user.

Each entry must contain enough diagnosis for a future maintenance pass:

- test file/name;
- observed failure;
- evidence that the test appears stale rather than the implementation being wrong;
- likely correction;
- uncertainty or follow-up needed.

Do not put genuine application regressions, blockers, or feature requests at Priority 0.5.

Once a stale/failing test has been corrected and passes again, remove its Priority 0.5 roadmap entry. Do not retain completed stale-test entries as historical work logs.

The detailed handling rule lives in [TESTING](docs/TESTING.md).

## Ordering and recall

When asked to recall, show, or summarise outstanding roadmap work:

1. list active items only;
2. sort ascending: Priority 0, 0.5, 1, 2, 3, and so on;
3. preserve stable order between items sharing a priority unless the user changes it;
4. show only the first **five** entries by default;
5. keep each entry brief;
6. show more only when asked.

Priority 0 work always appears first.

Priority 0.5 maintenance items appear after Priority 0 and before Priority 1 feature work.

## Completion

When roadmap work is completed, remove it from the active roadmap rather than retaining a completed-work history.

ROADMAP.md describes outstanding work, not a changelog.

If completed work contains durable information that future agents still need, place that information in the appropriate current authority such as ARCHITECTURE, DATA, CONTRACTS, INTEGRATIONS, TESTING or DEPLOYMENT rather than preserving the completed roadmap entry.

## Current roadmap

### Priority 1 - Data Health and Exceptions
Status: Incomplete

Add an Admin-facing diagnostic view that makes film records requiring human attention easy to identify, inspect and resolve without ad hoc database queries.

Surface actionable exceptions including missing IMDb or TMDB identities, identity conflicts, unresolved metadata, missing artwork, stale or incomplete enrichment, failed or inconclusive provider checks, and outstanding collection-roster evidence. Include films introduced through AI Predictions and other catalogue entry points where relevant.

Present useful context such as affected film, provider, exception type, severity, last checked date and appropriate next action, with navigation to the affected record.

Reuse existing authoritative maintenance status, coverage and cache evidence rather than redefining provider health. This is a diagnostic worklist, not another bulk-maintenance engine.

Depends on: None

### Priority 3 - Non-movie screen works
Status: Incomplete

Support non-movie screen works such as television series, miniseries and anthology episodes.

Establish an appropriate content model and identity granularity before implementation, addressing provider identity, canonical records, runtime/year/title presentation, search/import behaviour and suitable UI treatment rather than simply allowing television records into the existing movie model.

Preserve existing movie behaviour and historical records.

Depends on: None

### Priority 3 - Personal member retrospective
Status: Incomplete

Provide a curated personal retrospective for an individual BookClub member, distinct from the existing participant-filtered Metrics reports.

Present an approachable account of their club history through measures such as turns hosted, films brought, accumulated runtime, characteristic genres, directors and recurring themes. Emphasise interesting personal patterns and historical milestones rather than competition or comparative scoring.

Derive information from existing History and Metrics data without introducing unnecessary persisted aggregates or duplicating existing analytical reports.

Depends on: None

### Priority 3 - History search
Status: Incomplete

Add a lightweight way to search BookClub History by film title so a user can quickly establish whether, when and by whom a film was previously brought.

Use existing canonical History records, preserving repeated appearances, current ordering, filtering and pagination behaviour. Show sufficient identifying context, such as year and event, to distinguish matching films and navigate directly to the relevant historical record.

Keep this focused on historical appearances rather than expanding it into a general catalogue search.

Depends on: None

### Priority 3 - Metrics title uniformity
Status: Incomplete

Revisit Metrics title uniformity and related typography using the [Metrics typography audit by display case](docs/audits/METRICS_TYPOGRAPHY_AUDIT.md). Assess titles, labels, legends and other display cases separately, identifying which differences should be unified and which serve a deliberate semantic or responsive purpose.

Depends on: None

### Priority 5 - Cross-device freshness
Status: Incomplete

Improve how an already-open BookClub session notices legitimate changes made from another device or browser.

Prefer lightweight refresh-on-focus or age-based revalidation before considering continuous polling. Reuse existing catalogue refresh and mutation reconciliation mechanisms while protecting unsaved work, pending Seen answers and in-progress interactions.

The goal is to reduce surprising stale screens without unnecessary background traffic or synchronisation complexity.

Depends on: None

<!--
Ordinary item format:

### Priority 1 - Short title
Status: Incomplete

Concise intended outcome.

Depends on: None


Stale test format:

### Priority 0.5 - test name or short diagnosis
Status: Incomplete

Test: path/to/test :: case name
Failure: ...
Why likely stale: ...
Likely correction: ...
Uncertainty: ...
-->
