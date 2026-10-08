# ROADMAP.md

This file records user-approved future work for the project.

Do not add speculative feature work automatically. Add, reprioritise, complete, or remove roadmap items when the user explicitly asks, or when the user agrees that deferred work should be recorded here.

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

When resolved, remove the blocker from the active roadmap unless retaining it is specifically useful.

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

1. list incomplete items only unless completed work is requested;
2. sort ascending: Priority 0, 0.5, 1, 2, 3, and so on;
3. preserve stable order between items sharing a priority unless the user changes it;
4. show only the first **five** incomplete entries by default;
5. keep each entry brief;
6. show more only when asked.

Priority 0 work always appears first.

Priority 0.5 maintenance items appear after Priority 0 and before Priority 1 feature work.

## Completion

When ordinary roadmap work is completed:

- mark it complete rather than immediately deleting it;
- preserve the original priority;
- add only a brief completion note if context would otherwise be lost.

Periodically prune completed history when it no longer helps future work.

Priority 0.5 stale/failing-test entries are the exception: remove them once corrected rather than retaining completed test-history entries.

## Current roadmap

### Priority 1 - Australian streaming availability
Status: Incomplete

Capture and surface where a film can currently be watched in Australia, with Builder as the primary initial consumer. Store and display Australian availability only; availability from other regions is not useful to BookClub and should not be retained. Distinguish subscription/free/ad-supported access from rental or purchase where useful, using the existing watch-offer model where suitable.

Depends on: None

### Priority 1 - Admin operations redesign
Status: Incomplete

Rework Admin into a self-documenting operations console. Apart from Swap Turn, each maintenance action should have its own card, title and consistently phrased button. Each card should explain which external APIs may be contacted, relevant provider or BookClub limits, the current number of eligible films, the estimated provider-call count or range for the run, exactly what data will be collected or refreshed, and whether the operation fills blanks, refreshes all eligible records or invokes conditional fallbacks.

Depends on: None

### Priority 1 - Streamlined Classics event attestation
Status: Incomplete

When recording the current Classics turn, prefill the top three eligible Ranked Classics. The first two should be selected and locked; the third should be prefilled but optional. Committing the event should publish only the selected films through the normal Event/History workflow and apply the History Seen-by-all invariant automatically.

If fewer than three eligible Ranked Classics exist, prefill only those available rather than substituting Unranked films.

Depends on: None

### Priority 2 - Specialist film enrichment
Status: Incomplete

Expand enrichment only where additional external information would materially improve discovery, Builder, Film Detail or Metrics. Potential areas include awards and richer structured thematic or descriptive metadata. New sources should have a clear product use rather than being collected simply because the data exists.

Depends on: None

### Priority 2 - Metrics information architecture and mobile navigation
Status: Incomplete

Revisit Metrics organisation now that the underlying reports and performance architecture are mature. The existing horizontal category tabs are too long for comfortable mobile use, so reconsider the report groupings and navigation model rather than merely shrinking or scrolling the tabs. Reports may be regrouped, merged, added or retired where that produces a clearer set of useful analytical views. Introduce charts or richer visualisations only where they improve understanding.

Preserve the existing Metrics caching, lazy calculation and performance architecture.

Depends on: None

### Priority 2 - UI consistency audit and cleanup
Status: Incomplete

Perform an application-wide audit followed by implementation of consistent presentation conventions.

Focus specifically on:

- number formatting, including consistent thousands separators for whole-number counts;
- title and heading font size, weight and hierarchy;
- pill/badge usage, wording and meaning;
- inline Admin controls, including placement, wording, icon/button treatment and visibility.

Prefer shared formatting helpers, styles or components where equivalent presentation should genuinely be consistent. Preserve deliberate workflow-specific differences.

Depends on: None

### Priority 3 - Non-movie screen works
Status: Incomplete

Support non-movie screen works such as television series, miniseries and anthology episodes. Address provider identity, canonical records, runtime/year/title presentation, search/import behaviour and appropriate UI treatment rather than simply allowing television records into the existing movie model.

Depends on: None

### Priority 4 - Metrics first-entry performance follow-up
Status: Incomplete

Revisit Metrics first-entry scheduling only if production measurement or future catalogue growth makes the first visit perceptibly slower. Compare the current immediate enrichment prefetch with paint-first or idle-prefetch alternatives while preserving cross-route caching and lazy per-category calculations.

Current production navigation is fast, so this remains deliberately deferred.

Depends on: None

### Priority 5 - Cross-device freshness
Status: Incomplete

Improve how an already-open BookClub session notices legitimate changes made from another device or browser. Prefer lightweight approaches such as refresh-on-focus or age-based revalidation before considering continuous polling. The goal is to reduce surprising stale screens without adding unnecessary background traffic or synchronisation complexity.

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