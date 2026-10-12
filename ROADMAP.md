# ROADMAP.md

This file holds owner-approved future outcomes and standing blockers, not implementation history, transient errors or an agent-created backlog.

## Rules

- Add, reprioritise or remove ordinary work only at the owner’s request or approval. Ask when sequencing is ambiguous; do not renumber existing work to make room.
- Preserve existing approved priorities. Lower numbers are more urgent; equal priorities retain stable order. Show the first five active entries on recall unless asked for more.
- Report genuine current-task blockers immediately in the task response. Record standing blockers only with owner approval.
- Priority 0 remains available for owner-assigned urgent work. Priority 0.5 remains reserved for owner-approved stale-test maintenance; observed failures and diagnosis belong in the task response until recording is approved.
- Describe desired outcomes and necessary dependencies. Do not automatically add speculative ideas, failing-test backlogs or activity reports.
- Remove completed work. Durable facts belong in the owning specialist authority; confirmed state belongs in [README](README.md#current-state).

## Current roadmap

### Priority 1 - Data Health and Exceptions
Status: Completion/acceptance not confirmed. Source already includes frontend/DataHealth.tsx and the read-only /api/v1/admin/data-health endpoint; retain this approved outcome until remaining scope and owner acceptance are established.

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
