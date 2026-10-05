# ROADMAP.md

This file records user-approved future work for the project.

Do not add speculative feature work automatically. Add, reprioritise, complete, or remove roadmap items when the user explicitly asks, or when the user agrees that deferred work should be recorded here.

Agents may add genuine Priority 0 blockers and evidence-based Priority 0.5 stale/failing tests under the rules below.

## Priority model

Lower numeric priorities are more urgent; recall sorts in ascending numeric order.

- **Priority 0**: blockers only. Work that must be resolved for the app to function or for another approved task to proceed. Agents may add genuine blockers discovered during implementation.
- **Priority 0.5**: reserved exclusively for stale or failing non-blocking test cases that should be addressed as a maintenance group later.
- **Priority 1**: the user's expressed top next feature or work item.
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

> Make this Priority 3, ahead of Modal Standardisation but after Inbox Count Efficiency?

Mention one neighbour above and one below when both exist.

Do not silently assign an ordinary feature priority when sequencing is ambiguous.

## Priority 0 blockers

An agent may add Priority 0 when it discovers a genuine blocker that:

- prevents the application from functioning; or
- prevents another approved roadmap item from proceeding.

Keep blockers narrowly scoped.

When resolved, mark them complete immediately.

## Stale/failing test policy

This priority is reserved for tests that fail because the test case appears stale, obsolete, or out of sync with intended current behaviour, while the failure does not block application function or other approved work.

Agents may add entries here without first asking the user.

Each entry must contain enough diagnosis for a future maintenance pass:

- test file/name;
- observed failure;
- evidence that the test appears stale rather than the implementation being wrong;
- likely correction;
- uncertainty or follow-up needed.

Do not put genuine application regressions, blockers, or feature requests at Priority 0.5.

The detailed handling rule lives in [TESTING](docs/TESTING.md).

## Ordering and recall

When asked to recall, show, or summarise outstanding roadmap work:

1. list incomplete items only unless completed work is requested;
2. sort ascending: Priority 0, 0.5, 1, 2, 3, and so on;
3. preserve stable order between items sharing a priority unless the user changes it;
4. show only the first **five** incomplete entries by default;
5. keep each entry brief;
6. show more only when asked.

Priority 0 blockers always appear first.

Priority 0.5 maintenance items appear after blockers and before Priority 1 feature work.

## Completion

When roadmap work is completed:

- mark it complete rather than immediately deleting it;
- preserve the original priority;
- add only a brief completion note if context would otherwise be lost.

Periodically prune completed history when it no longer helps future work, but do not do so during unrelated tasks unless asked.

## Current roadmap

### Priority 3 - Non-movie screen works
Status: Incomplete

Support non-movie screen works such as television series, miniseries and anthology episodes, including provider identity modelling and UI behaviour.

Depends on: None

## Priority 0.5 - stale/failing tests

- **Score refresh bootstrap cutoff expectation** — `tests/domain-api.test.ts`, “appends scores, keeps history, derives rank and tolerates partial failure safely”, expects rawScore 42894.5 but receives 43400. The assertion retains demo TMDB 83 and expects two imputed dimensions after three MDBList live dimensions; `effectiveRankingScores` and the documented three-live-score cutoff retain only live observations, producing three imputed dimensions at average 85. The domain/test/seed implementation is unchanged by hosting preparation. Likely update rawScore and imputation expectations to the intended cutoff; confirm fixture intent and remaining assertions in a focused maintenance pass.

- **Static migration-count expectations** — `tests/prod-check.test.ts`, “checks tracked release safety and public variables without remote access”, expects 9 migrations but current main contains 12. Reproduces on untouched main; update both hard-coded counts or derive the count while retaining contiguous-migration coverage.
- **Importer Watch Order fixture expectations** — `tests/importer.test.ts`, “requires regenerated exact slot-1 dates without changing Watch Order or identities”, “parses cycles, merged followers, slots and ordered appearances”, and “supports headerless rank/title Watch Order and cached formulas without evaluation”, expect `exactMatch === true` but receive false (lines 25, 35, 51). All reproduce on untouched main. The fixture includes an Unknown Seen answer while current ranking requires no Unknown answers for Watch Order inclusion; likely split the exact-match fixture from Unknown-answer coverage or assert the intentional mismatch. Confirm fixture intent before changing assertions.

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
