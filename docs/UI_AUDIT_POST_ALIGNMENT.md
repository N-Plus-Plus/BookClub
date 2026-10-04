# BookClub Post-Alignment UI/UX Audit

## Executive summary

BookClub is substantially more coherent after alignment. Quiet surfaces, explicit action roles, desktop navigation, current-turn orientation and subordinate maintenance now work together. Home, Builder, Event and Film detail no longer warrant the four broad redesign recommendations in the baseline.

The residual list contains **four actionable grouped findings**: two mechanical corrections and two focused owner decisions. The most visible regression is cramped Seen It? and Metrics composition beside the expanded drawer near 720–768px. The other concerns are incomplete Event-edit error routing and operation feedback in Film detail/Classics. Another broad automated cleanup is not warranted. A small explicitly authorised correction pass could precede human page-by-page review.

Audited 5 October 2026 (Australia/Sydney), against local `main` **ddf8e04**, matching the locally recorded `origin/main`; the starting worktree was clean. The immutable comparison baseline is [UI_AUDIT.md](UI_AUDIT.md), revision `4fba303`. It was not edited. Current AGENTS.md, STYLE.md and README.md were read fully before judgement; current rendered behaviour, rather than the presence of changed code, determines resolution.

## Baseline comparison

Original totals: **A 7 / B 16 / C 12 / D 23 / E 4** — 62 grouped observations, including compliant behaviour and valid exceptions.

Current totals: **A 7 / B 8 / C 2 / D 2 / E 0** — 19 grouped current observations; **four require action or a decision**. Categories mean A COMPLIANT, B VALID EXCEPTION, C LOW-RISK NORMALISATION, D OWNER REVIEW NEEDED and E LIKELY REDESIGN.

Current counts use the numbered current groups below, not every historical comparison row. Resolved historical concerns are consolidated into compliant patterns; preserved exceptions are grouped by purpose. Consequently the reduction in total observations is not itself a defect-resolution measure.

| Resolution of the 55 original non-A findings | Count |
| --- | ---: |
| RESOLVED | 35 |
| PARTIALLY RESOLVED | 3 |
| STILL PRESENT | 15 |
| SUPERSEDED | 2 |
| NEW FINDING, separate from the original 55 | 1 |

All 15 STILL PRESENT rows are **preserved B exceptions**, not unresolved defects. Of the original 39 C/D/E concerns, 35 are resolved, three partially resolved and one superseded by an explicit current design decision. None remains fully unresolved. The new finding is a responsive regression, not a renamed old concern.

### Evidence and limits

Reused the already-running **normal development application at http://localhost:4173/** and local Worker at localhost:8787, avoiding duplicate startup, migrations or seeding. A bounded health read confirmed `environment: local` and authentication bypass. The local snapshot contained 999 canonical films, 251 active events and 239 ranked Classics. These are snapshot counts, not production assertions. No production read/export, replacement, reset, provider enrichment or database mutation was performed.

Playwright/headless Edge rendered Home, History, Builder, Classics, Seen It?, Metrics, Event create, populated Event edit and Film detail at **320, 390, 719, 720, 768, 950, 1024 and 1440px**, with 900px viewport height. Avatar and sign-in gates were separately rendered at all eight widths. Review included populated eight-film Builder/editor/publication states, long titles, missing posters, History/Classics middle and end scrolling, score/audit/admin/developer disclosures and collapsed navigation. Main route checks recorded no document overflow or page exceptions. Visual review nevertheless found NEW01 below: absence of overflow does not establish readable composition.

Browser-only fixtures intercepted saves, audit evidence, searches, provider results, avatar collision and failures. Supplementary fixtures blocked non-local requests and all unhandled mutations, including the developer helper. No final publication or local replacement was executed; History confirmation was dismissed. Fixture outcomes demonstrate presentation/recovery, not successful persistence or actual provider availability. A populated genre fixture included an entirely unscored genre to check truthful missing values.

Live GIS branding/login, real session expiry, mobile virtual keyboard, physical safe-area devices, OS confirmation appearance, every keyboard traversal and a comprehensive contrast audit remain outside this local pass. The unconfigured sign-in gate was rendered; the official GIS integration was source-reviewed. Screenshots/results stay ignored and private under `.verification/`; snapshot titles and member records are not reproduced here.

## Original finding resolution

The current-category column describes the replacement or retained state; it is not another tally. Residual IDs refer to the four current issues detailed below.

| Original finding | Original category | Current status | Current category if applicable | Evidence / judgement |
| --- | --- | --- | --- | --- |
| G01 Spacing tokens | C | RESOLVED | A | Central exact-value spacing aliases are used across active layouts; rendered rhythm is preserved. |
| G02 Typography roles | C | RESOLVED | A | Named helper, metadata, body and heading roles replace repeated role literals. No material typographic inconsistency found. |
| G03 Width conventions | C | RESOLVED | A | Named narrow/onboarding/wide tiers; bounded editors and gates render purposefully. |
| G04 Action icon sizing | C | RESOLVED | A | Action and RouteLink share the 18px constant; Lucide treatment is consistent. |
| G05 Control target constants | C | RESOLVED | A | Shared target/control constants; sampled visible buttons, navigation and summaries meet 44px dimensions. |
| G06 Routine border strength | D | RESOLVED | A | Heavy white outlines no longer surround routine sections; event objects retain quiet boundaries. |
| G07 Background gradient | D | SUPERSEDED | B | STYLE.md §10 explicitly preserves the top-left radial atmosphere. Rendered gradient is coherent and no longer an open removal question. |
| G08 Action hierarchy | D | RESOLVED | A | Primary/secondary/tertiary/danger roles are visibly distinct; private deletion is separated from completion. |
| G09 Button/pill contrast | D | RESOLVED | A | Enabled constructive labels use dark text; neutral pills use brighter text/borders. The cited white-on-emerald and dim-neutral problems are absent. This is not full contrast certification. |
| G10 Async presentation | D | PARTIALLY RESOLVED | D — R01 | Shared initial placeholders and retained-catalog refresh recovery work. Film-detail mutation errors still offer a load retry rather than recovery of the failed operation. |
| G11 Native form controls | B | STILL PRESENT | B | Labelled native selects/radios remain appropriate; no replacement widget needed. |
| N01 Mobile persistent navigation | B | STILL PRESENT | B | Six named destinations remain reachable at 320–719px; final content has reserved bottom space. |
| N02 Desktop dock | D | RESOLVED | A | Expanded/collapsed side drawer replaces desktop dock; width is reserved and Enter toggling works. NEW01 new finding concerns remaining content grids, not drawer overlap. |
| N03 Decorative copy/footer density | D | RESOLVED | A | Routine page subtitles/eyebrows are reduced; attribution is disclosed and snapshot copy no longer claims real data is demo ratings. |
| N04 Route heading focus | B | STILL PRESENT | B | Hash navigation retains deliberate visible heading focus. |
| H01 Current-turn emphasis | B | STILL PRESENT | B | Explicit personal heading, edge and Builder action; other-member fixture does not claim ownership. |
| H02 Orientation/next action | E | RESOLVED | A | Current turn leads, personal Builder action dominates, old competing welcome removed and correction disclosed. |
| H03 Summary stat containers | D | RESOLVED | A | Flat divided supporting counters replace three heavy objects; missing-answer link remains. |
| HI01 Event objects/nominal order | B | STILL PRESENT | B | Independent journal objects, literal precision and nominal order preserved; one column at intermediate widths. |
| HI02 Repeated editing controls | D | RESOLVED | A | Edit is secondary, Audit tertiary and Delete restrained; controls remain visible without equal fills. |
| HI03 Archive-scale scanning | D | RESOLVED | A | Continuous archive now has cycle jump and actual-host filter; exercised on 251 events and inspected through its end. |
| HI04 Audit presentation | D | RESOLVED | A | Inline open/close, cached loaded evidence, readable action labels and disclosed full changes. Three toggle clicks made one audit read. |
| BU01 Open-set icon | C | RESOLVED | A | Open uses Eye rather than a back arrow. |
| BU02 Desktop editor width | E | RESOLVED | A | Centred editor is capped at 780px; eight-film rows/actions belong to a bounded workflow rather than the whole shell. |
| BU03 Save/publish/delete priority | D | RESOLVED | A | Save leads editing, Review publication is secondary, final publication leads its stage and deletion is separate below lineup. |
| BU04 Publication confirmation | B | STILL PRESENT | B | Separate inline review preserves date, host, original planning and shared consequences. Long set title wraps safely. |
| CL01 State-filter appearance | C | RESOLVED | A | Visible neutral selected outline/fill accompanies aria-pressed in all three pools. |
| CL02 Ranking-card objects | B | SUPERSEDED | A | Large paired cards replaced by aligned responsive rows; independent disclosure no longer stretches a neighbouring card. |
| CL03 Archive-scale comparison | D | RESOLVED | A | 239 candidates use stable rank/identity/score positions and quiet dividers; mobile stacks preserve all values. More scrolling alone is not a new defect. |
| CL04 Needs Data maintenance | D | PARTIALLY RESOLVED | D — R02 | Maintenance is disclosed and quiet; results remain a shared concatenated status, repeated within unrelated candidate disclosures. |
| SE01 Yes/No balance | D | RESOLVED | A | Both answers now have equal neutral treatment and target dimensions. Narrow desktop composition is separately NEW01. |
| SE02 Native progress | B | STILL PRESENT | B | Labelled native progress remains simple and purposeful. |
| ME01 Film-link targets | C | RESOLVED | A | Links now reserve at least 44px height/width; long titles remain navigable. |
| ME02 Numerical columns | C | RESOLVED | A | Right-aligned tabular numeric cells/ratings retain exact values and coverage. |
| ME03 Metadata maintenance | D | RESOLVED | A | Explicit Admin disclosure follows member data; it does not compete with charts. |
| ME04 Charts | D | RESOLVED | A | Stored-data host contributions compare events and appearances with exact counts. Scope independent of the selected filter is explicitly labelled. |
| ME05 Identity filters | B | STILL PRESENT | B | Visible small identity set remains useful; selection has text/outline and aria-pressed. |
| EV01 Edit subtitle | C | RESOLVED | A | Populated editing shows correction/lineup copy rather than film-detail fallback. |
| EV02 Mobile completion order | E | RESOLVED | A | Details → picker/ordered lineup → review → Save now holds at mobile and desktop, including eight films. |
| EV03 Optional exposure | D | RESOLVED | A | Title/notes, backfill and historical precision are disclosed; required swap explanation stays exposed. |
| EV04 Host choice tiles | B | STILL PRESENT | B | Meaningful identities remain comparable through labelled radio tiles. |
| EV05 Error locality | D | PARTIALLY RESOLVED | C — R03 | Date/lineup errors and first-invalid focus/input retention work; edit-only cycle/slot errors have no rendered destination or summary fallback. |
| FD01 Viewing hierarchy | E | RESOLVED | A | Identity leads; Seen, score/ratings and appearances precede maintenance and technical disclosures. |
| FD02 Repeated film identity | D | RESOLVED | A | RankingScore is score-only; no second title/poster accompanies the ranking. |
| FD04 Technical metadata visibility | D | RESOLVED | A | Identifier/artwork and capture provenance are disclosed while actual ratings remain visible. |
| AV01 Logout wording | C | RESOLVED | A | Uses Log out consistently. |
| AV02 Imagery/grid | B | STILL PRESENT | B | Illustrated choice remains the task; loaded four/five-column grids and selected check are sound. |
| SI01 Official Google control | B | STILL PRESENT | B | Official GIS delegation preserved in source; configured branding/login not exercised locally. |
| SI02 Single-task container | B | STILL PRESENT | B | Narrow sign-in card remains an appropriate intentional boundary across widths. |
| DI01 History confirmation | B | STILL PRESENT | B | Dismissed native confirmation retains recovery and unchanged-rotation wording. |
| DI02 Private Builder deletion | D | RESOLVED | A | Inline confirmation names the saved set, selections and consequence; cancellation works without mutation. |
| DI03 Lineup removal | B | STILL PRESENT | B | Unsaved lineup removal stays immediate and separate from persistent film deletion. |
| DE01 Developer selector | C | RESOLVED | A | Labelled field treatment and generous target replace compressed bare select. |
| DE02 Closed developer prominence | D | RESOLVED | A | Quiet utility with breathing room remains in its established location, as current STYLE.md requires. |
| DE03 Local replacement guard | B | STILL PRESENT | B | Explicit destructive confirmation remains inside expanded tooling; never executed. |

Original A preservation: G12 radii and G13 shared imagery/schema consistency remain sound; EV06 lineup stays in normal flow; FD03 answers retain neutral Yes/No/Unknown semantics; AV03 collision recovery passed an intercepted 409; DI04 restore remains the documented API-only boundary. SE03's distinct recent-answer task remains valid, but its intermediate-width presentation is affected by the new grouped NEW01 regression. No original A pattern is treated as blanket proof of responsive compliance.

## Global current findings

### Compliant current groups

| ID | Category | Current judgement |
| --- | --- | --- |
| A01 | A | Coherent Lexend/Lucide dark visual system: central spacing, text, target and width values; small radius vocabulary and consistent imagery. |
| A02 | A | Quiet purposeful surfaces, brighter metadata, differentiated action hierarchy and generous sampled controls. |
| A03 | A | Shell exposes all six destinations, clear active state and desktop drawer reservation; content-specific regression is NEW01 below. |
| A04 | A | Home's current-turn ownership/action leads; statistics, admin correction and closed developer tools are subordinate. |
| A05 | A | Continuous History with jump/filter/cached audit; Classics rows align ranking/state/details at archive scale. |
| A06 | A | Bounded Builder and Event composition; coherent completion order, separated deletion and improved film-detail information order. |
| A07 | A | Explicit Unknown/missing states, exact chart/table values, stored-data provenance, practical empty states and retained-catalog refresh recovery. |

### Preserved valid exceptions

| ID | Category | Exception and reason |
| --- | --- | --- |
| B01 | B | Native controls/progress and identity option tiles: semantic controls or useful small-set comparison. |
| B02 | B | Fixed mobile dock: persistent access to six frequently used destinations, with reserved end space. |
| B03 | B | Independent History event objects and native shared-deletion confirmation: genuine journal boundaries and shared consequences. |
| B04 | B | Inline publication review and immediate unsaved lineup removal: confirmation proportionate to persistence. |
| B05 | B | Illustrated avatar choices: artwork is the choice itself, not ornamental filler. |
| B06 | B | Narrow sign-in card and official GIS button: focused private gate and external identity requirements. |
| B07 | B | Dominant destructive local-replacement confirmation: appropriate only inside the explicitly selected developer task. |
| B08 | B | Preserved radial atmosphere, personal-turn edge and route-heading focus: deliberate identity, meaningful ownership and accessibility feedback. |

### R01 — Operation-specific error recovery remains incomplete

**D. OWNER REVIEW NEEDED · original G10 · high confidence.** STYLE.md §§12,21,26 require actionable local recovery. Catalog refresh now preserves the journal and supplies Retry refresh; initial loading does not invent stale data. That major concern is resolved.

In `DetailScreen`, a rejected Seen answer instead appears above film identity with **Retry film load**. That retry fetches detail; it does not retry the rejected answer. Maintenance errors can also appear both above identity and inside maintenance because load and mutation tasks share one error state. A browser-only 503 Seen response reproduced the misleading recovery while retaining the previous answer.

This is a remaining part of the original async/error concern, not a new finding. It matters because a user may mistake a successful reload for completion of their correction. The remedy needs operation-specific state and feedback, not another error-card style. Owner review should settle retry wording/location during Film detail review; the persistence truth must be preserved. Resolve before treating failed-answer recovery as signed off. Generic initial skeleton geometry is acceptable here and is not another redesign request.

## Screen-by-screen review

### App shell and navigation

#### What now works well

Expanded labels, collapsed named icons, hover/focus explanation, visible active route and keyboard toggle are coherent. Content reserves 208px expanded/72px collapsed rather than being overlaid. The mobile dock remains below 720px. Route focus, long-page end space and disclosed truthful attribution are preserved. No collision or document overflow was measured in the sweep.

#### Remaining findings

NEW01 concerns the **content grids** beside the drawer, not primary-destination access or drawer positioning. See New findings. No navigation redesign is recommended.

### Home

#### What now works well

Current turn is the first member task. Personal ownership has an explicit heading and prominent Plan in Builder; another-member fixture uses Current turn and Plan your own set. Admin correction is disclosed. Supporting counts are flatter and recent history/shortlist no longer compete with a welcome action.

#### Remaining findings

None requiring C/D/E action on this evidence. Current-turn wording, Classics state and personal state deserve ordinary owner acceptance, not another automated composition pass.

### History

#### What now works well

Continuous archive preserves cycle anchor, literal date precision, actual identity and ordered films. Jump/filter reduce traversal effort without pagination. Edit/Audit/Delete hierarchy is clear even in middle/end captures; 320px wrapping keeps readable targets. Audit closes/reopens and reuses fetched evidence; technical evidence remains accessible.

#### Remaining findings

None requiring C/D/E action. Hundreds of events still produce a long journal, but this is now an explicit contract with useful navigation. Do not re-report the old absence-of-navigation concern or demand automatic pagination.

### Builder

#### What now works well

Centred bounded editor, consistent film rows/actions, leading Save, secondary Review publication and separately placed private deletion substantially improve the workflow. Eight-film and long-title fixtures remain readable. Inline deletion identifies object/scope/consequence; Keep set cancels. Publication makes title/note sharing and turn consequences explicit.

#### Remaining findings

None requiring C/D/E action. Save remains above the editor; long lineups require returning to it. This is compatible with current STYLE.md and was not demonstrated to obstruct the task. Human review can assess that practical preference without declaring another defect.

### Classics / Watch Order

#### What now works well

Rank/state/score are aligned, details disclosed and filters visibly selected. 239 ranked items were inspected at top/middle/end. Rows stack safely on narrow screens; expanding one no longer alters a paired neighbour. Admin and candidate maintenance are subordinate.

#### Remaining findings

**R02 — maintenance-result scope/presentation: D, original CL04, high confidence.** STYLE.md §§12,21,29 require concise local feedback. A fixture bulk result still concatenates count, identification, provider failure and cooldown messages into one paragraph. The same shared `status`/`error` is also rendered inside every candidate maintenance disclosure: opening an unrelated candidate repeats the bulk operation's result. Single-film actions likewise share that state.

The controls' prominence is resolved; feedback scoping is not. Users should be able to tell which operation/film a result describes. This requires a small task-specific decision about bulk summary versus candidate results, not row-density redesign. Owner input is warranted for useful result presentation during Classics review; a scoped implementation should associate results with their originating operation and retain partial failures/cooldowns. No real enrichment was run.

### Seen It?

#### What now works well

Equal neutral answer treatment removes the original Yes bias. Named-member question, Unknown, progress and recent-answer correction remain clear at mobile and wide desktop sizes.

#### Remaining findings

NEW01: expanded-drawer intermediate widths squeeze the question into a narrow two-column pane. This is a composition regression, not answer imbalance or a reason to redesign the queue.

### Metrics

#### What now works well

Host contribution bars answer who hosted how many events/appearances. Exact counts accompany bars; the all-time comparison is explicitly independent of the selected identity. Filters update summaries/rankings; average IMDb coverage, repeats/unique distinction and Uncategorised remain honest. Genre fixture showed recognised genres, percentages and **No scores** for an unscored genre rather than zero. Numeric alignment and larger film-link targets help comparison. Admin maintenance is disclosed.

#### Remaining findings

NEW01 affects summary and top/bottom grids near the drawer breakpoint. The charts themselves fit narrow screens and need no replacement. No extra chart is justified merely because charts were absent in the baseline.

### Event create/edit and shared picker

#### What now works well

Details → search/ordered films → review → completion now holds across widths. Optional/historical controls are disclosed; swap and anchor consequences remain explicit. Empty date/lineup errors appear locally; first-invalid date focus and preservation after a fixture API date rejection passed. Historical precision disclosure opens and receives focus when its field is rejected. Eight-film order/reorder/remove targets are usable.

#### Remaining findings

**R03 — error fallback for unrendered edit fields: C, original EV05, high confidence.** STYLE.md §§19,21,26 require visible actionable validation. Editing preserves `cycle_id`/`cycle_slot`, but does not mount TurnFields. The API error handler recognises those paths, suppresses its summary and stores field errors; neither field's message/control is rendered in edit mode. An intercepted `cycle_slot` 422 left the populated editor with no rejection text. The real validation contract can return this path, for example when changing a hosted slot 1–4 event to Classics while retaining its slot.

Input is preserved, but a user can press Save corrections and receive no explanation. This is mechanical error routing: always expose a fallback for errors without an available field destination, retaining field-local focus where a control exists. Owner approval of a new editor or cycle-edit feature is unnecessary. Fix before human Event validation review. Precision/kind errors also remain at the details section's end rather than beside their select; include them in the same small mapping/locality correction, not a separate finding.

### Film detail

#### What now works well

Single identity leads, with graceful missing metadata/artwork. Seen corrections, score-only ranking, ratings and shared appearances precede maintenance. Required score inputs are marked; missing data is not fabricated. Source/capture and identifiers/artwork remain available through disclosure.

#### Remaining findings

R01: failed mutation feedback still uses load-retry recovery. Hierarchy/provenance concerns FD01/FD02/FD04 are resolved; do not reopen them merely because this failure state needs work.

### Avatar onboarding

#### What now works well

Focused one-time choice, loaded imagery, selected check/outline, disabled continuation until selection and consistent Log out. All eight widths rendered without overflow. Intercepted collision removed the unavailable avatar, cleared selection and disabled continuation without another login.

#### Remaining findings

None requiring C/D/E action. Real persistent claim and physical-device interaction were not tested.

### Sign-in

#### What now works well

Private-club context stays brief and focused. Narrow task card and administrator next step in the unconfigured gate remain coherent at every requested width. No member navigation distracts from the gate.

#### Remaining findings

None established. Configured official GIS rendering/login remains a separate owner check; local fixture review is not evidence that live authentication passed.

### Admin, developer and destructive flows

#### What now works well

Home rotation, Classics scores and Metrics metadata live behind explicit disclosures. Developer closed state is quiet in its required location; expanded selector, explanation and replacement confirmation remain usable. Ordinary private deletion is inline; shared History uses native interruption with recovery/rotation wording. Unsaved lineup removal remains proportionate.

#### Remaining findings

R02 applies to Classics results after opening maintenance. No separate global admin/developer styling issue remains. Local replacement was never confirmed and production was not contacted.

## New findings

### NEW01 — Intermediate content grids ignore expanded drawer's available width

| Attribute | Evidence / judgement |
| --- | --- |
| Area | Seen It? and Metrics, especially 720–768px with expanded desktop navigation |
| Category | **C. LOW-RISK NORMALISATION** |
| STYLE.md rule | §§3,4,17,22,26: intentional responsive composition, readable comparison and usable content; §16 requires reserved drawer width |
| Current behaviour | At 719px content has about 683px; at 720px expanded drawer leaves about 464px. Seen retains two columns and a 120px poster, squeezing the film title into fragments. Metrics activates four summary/six filter columns and two ranking panes; Film appearances and titles break within words. At 768px Seen remains cramped. At 950/1024/1440px the ordinary sample is materially better; collapse also improves available space. |
| Judgement | New reservation correctly prevents overlay but exposes old viewport-based grids to much less space. Current CSS explicitly stacks Home/History/Detail at 720–950px, but omits Seen and Metrics. Zero overflow assertions do not catch this readable-layout failure. Baseline mobile/wide examples and preserved underlying content confirm this is not the old desktop-dock or Yes/No concern renamed. |
| Confidence | High; rendered at all eight widths, expanded/collapsed comparison and source-supported width calculations |
| Suggested next step | Extend the established narrow composition to these grids when actual available width is insufficient: stack Seen/recent and Metrics rankings; retain two-column summary where needed. Preserve drawer policy, content order, data and answer parity. Compare expanded/collapsed at 719/720/768/950px. |
| Owner input / timing | No new product decision required for this bounded responsive correction. Fix before judging these screens in page-by-page human review. No broad breakpoint unification or navigation redesign. |

No other genuinely new finding was established. R01/R02/R03 are narrower residuals of original concerns, even where alignment changed their exact presentation.

## Human-review priorities

Only **two D areas and no E areas** remain:

1. **Film detail — R01:** decide where failed Seen/maintenance operations explain recovery and how retry differs from loading. Test a successful load followed by a failed correction; unchanged answers must remain unmistakable.
2. **Classics — R02:** review bulk and single-candidate result scope, partial failures and cooldown wording. Preserve compact scanning and disclosed maintenance; review result feedback rather than redesign the list.

After mechanical corrections, begin human task review with **Event create/edit, Film detail, Classics, Seen It? and Metrics**. These exercise the most important changed interactions and the residual concerns. Home and Builder improved strongly and need acceptance checks, not another commissioned redesign.

## Safe residual normalisation

Only two C groups qualify:

- **R03:** visible fallback for edit errors without a rendered field, plus local association for existing select errors. Preserve inputs, focus semantics and all cycle/rotation rules; do not add cycle-edit capability incidentally.
- **NEW01:** extend existing responsive stacking to Seen/Metrics where drawer reservation makes desktop grids too narrow. Preserve control sizes and information order.

These are candidates for a separately authorised focused correction pass. No global border/token/copy sweep, new component system, card removal campaign or colour redesign is justified.

## Regression checks

| Check | Result and practical limit |
| --- | --- |
| Navigation | Expanded/collapsed drawer, active destinations, content reservation and Enter toggle passed. Collapsed named links retain focus/hover explanations. Mobile dock changes at 720px without overlap; NEW01 affects content readability. |
| Responsive layouts | 72 route/width checks completed with zero document overflow. Populated gates at all eight widths also passed overflow checks. Visual composition exposed NEW01 despite these passes. |
| Focus | Route focus preserved; drawer keyboard toggle and first-invalid date focus passed. Historical precision error opened/focused its disclosure in completed fixture checks. R03 covers errors with no destination. Full keyboard/screen-reader certification was not performed. |
| Target sizes | Existing harness sampled visible `.button`, navigation links and summaries at 320/390/719/720/768/1440px and found at least 44px in each dimension. Metrics links now carry the same minimum. Native radio/checkbox labels provide larger hit areas; not every target was exhaustively measured. |
| Disclosures | Audit open/close/reopen made one fetch; score, technical, optional, admin and developer disclosures were opened. Closed maintenance stays quiet. R02 concerns scoped result feedback after opening it. |
| Validation | Date/lineup rejection, first-invalid focus and API-date input retention passed. Browser-only edit slot rejection reproduced missing feedback (R03). Persistent server outcomes were not tested. |
| Charts / missing values | Exact host event/appearance counts accompany bars; all-time scope is labelled. Genre fixture retained percentages, coverage and No scores for missing IMDb. No provider request was made. |
| Destructive flows | Inline Builder cancellation passed; History native dialog dismissed with recovery/unchanged-rotation wording. Publication and developer replacement consequences inspected without executing final actions. |
| Loading / error / stale | Delayed initial catalog rendered placeholders; initial 503 exposed Retry. Failed refetch preserved loaded journal with Retry refresh. Fixture failed Seen correction reproduced R01. Avatar collision recovery passed. |

Commands run: `node tests/ui-alignment.browser.mjs`, `node .verification/post-audit.mjs`, `$env:POST_AUDIT_STATES_ONLY='1'; node .verification/post-audit.mjs`, and `node .verification/post-gates.mjs`. Supplementary harness attempts initially needed corrections for retained drawer state, strict locators matching repeated status elements and same-document hash navigation retaining fixture data; these were harness issues, not additional application failures. Completed runs, not those interrupted attempts, support the assertions above. The audit also inspected screenshots beyond assertion output.

Documentation review: AGENTS.md and STYLE.md now agree on interface authority; README describes continuous History and stored-data charts. The baseline's old authority/chart drift is resolved. Historical root CSS commentary still describes strong container borders and monochrome restrictions that current STYLE.md/active app extensions override; treat it as stale implementation commentary, not authority to undo alignment. No material new drift in AGENTS.md was established. All standing documents remain unchanged under this audit-only scope.

Validation: `git diff --check` and `git diff --no-index --check -- NUL docs/UI_AUDIT_POST_ALIGNMENT.md` checked whitespace, including the new untracked file. Full unit tests, build and typecheck were not run: documentation-only audit, no application edits and no observed reason to broaden verification.

## Final judgement

1. **Another broad automated UI normalisation pass is not justified.** A small pass limited to R03/NEW01 is worthwhile if authorised.
2. **Move primarily to human page-by-page review.** Use that review to settle R01/R02 and validate real tasks, rather than reopening resolved design choices.
3. **Review Event create/edit, Film detail, Classics, Seen It? and Metrics first.** Correct the mechanical breakpoint/validation problems before evaluating those screens' final usability.

The baseline remains immutable. Only this new audit document changes tracked project content; no implementation, deployment, commit or push occurred.
