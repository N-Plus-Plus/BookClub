# BookClub UI/UX audit

Audit date: 5 October 2026 (Australia/Sydney). Baseline: current local `main`, `4fba303`; working tree was clean. Audit only: no application, CSS, schema or production changes.

## GLOBAL

The interface has a coherent dark identity, shared poster/identity components, generous ordinary buttons and useful responsive grids. The strongest outliers are heavy shared card borders, indistinguishable Classics filters, prominent contextual maintenance, Builder's desktop width and several workflow hierarchy problems. Existing consistency is evidence to preserve, not permission to restyle everything.

Categories used throughout: **A. COMPLIANT**, **B. VALID EXCEPTION**, **C. LOW-RISK NORMALISATION**, **D. OWNER REVIEW NEEDED**, **E. LIKELY REDESIGN**. Each row is one finding with exactly one category. C/D/E confidence is included in Judgement. Global rows cover shared patterns; screen rows do not recount the same finding. Counts include both global and screen rows.

Finding totals: **A 7 · B 16 · C 12 · D 23 · E 4** (62 grouped findings). These are audit judgements, not 62 defects.

### What is working

Lexend Deca, Lucide, neutral dark surfaces, reusable identities, consistent poster proportions, explicit Unknown state and accessible ordinary action names should remain. Layouts use a genuine two-column adaptation in several contexts; not every screen is merely stretched mobile UI. No horizontal document overflow was measured on the nine main routes at the four primary widths.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| G01 Spacing tokens; nearly every screen | C. LOW-RISK NORMALISATION | §§5,27: approved scale and central values | `app.css` repeats literal 8/10/12/16/20px gaps and padding; central spacing scale is absent. | Accidental implementation drift; token aliases can preserve exact geometry. Confidence: High. | Name the existing repeated values first. Do not round 10/14/18px to a different scale automatically. |
| G02 Typography roles; shell, rows, forms, rankings | C. LOW-RISK NORMALISATION | §§11,27: limited central text roles | `.meta`, `.eyebrow`, item links and helper text use repeated literal sizes; `.65`, `.7`, `.75`, `.78`, `.8`, `.82`, `.85`, `.92rem` coexist. | Centralising exact repeated roles is safe; changing all small text is not. Confidence: High. | Alias current role values and deduplicate identical roles only; retain distinct identity/score sizes. |
| G03 Width conventions; shell and two gates | C. LOW-RISK NORMALISATION | §§4,27: small named width set | Shell is 1160px, sign-in 440px, onboarding 780px; footer is 70ch and dock 640px. | The three task widths are explainable; missing names are the issue. Confidence: High. | Name the three content widths without changing them. Keep footer readability and navigation width separate. |
| G04 Action icon sizing; shared Action/RouteLink | C. LOW-RISK NORMALISATION | §§14,27,28: consistent family and central values | Both wrappers render 18px icons; root `--button-icon-size` is 1rem and not applied to these SVGs. | One shared naming mismatch, not a need to resize every icon. Confidence: High. | Give shared action icons one 18px token; retain 22px navigation and contextual artwork icons. |
| G05 Control target constants; most screens | C. LOW-RISK NORMALISATION | §§15,27: generous central target sizes | 44px recurs in links, icon buttons, summaries and identity; button height is independently 2.85rem. | Repeated hit-area values can be named without changing behaviour. Confidence: High. | Tokenise the 44px minimum and existing heights; distinguish avatar display size from interactive target size. |
| G06 Routine card border strength; all major screens | D. OWNER REVIEW NEEDED | §§1,6,31: preserve established patterns; quiet purposeful boundaries | Root `.card` applies 2px white borders, including stats, developer disclosure and each event/ranking object. | Established project-wide aesthetic, not accidental one-off borders. It competes strongly with headings and state. Confidence: High. | Owner approves a routine border treatment using representative whole screens; do not globally flatten cards in Batch 1. |
| G07 Background gradient; entire app | D. OWNER REVIEW NEEDED | §§8,10: deliberate dark identity; effects need purpose | Root html/body use a top-left radial gradient from #222 to #070707. Routine cards have no shadows. | Established atmosphere rather than a stray screen gradient; removing it changes identity. Confidence: Medium. | Review once with G06; leave unused progress/modal effects out of the audit cleanup. |
| G08 Action hierarchy; Builder, History, Film detail, Home admin | D. OWNER REVIEW NEEDED | §§9,13,19: distinguish priority and destruction | Most actions use the same filled neutral treatment; some save/publication actions are green. Delete set sits with save/publish; History Delete looks like Edit/Audit. | Systemic role choices need agreement, not bulk intent attributes. Confidence: High. | Define primary/secondary/destructive roles per workflow before styling; preserve action positions pending review. |
| G09 Button/pill contrast; coloured save/Yes and neutral metadata pills | D. OWNER REVIEW NEEDED | §26: sufficient contrast | White label on `--emerald` #42cb6f has about 2.10:1 contrast; neutral badge text/border uses #606873 on near-black. | Coloured action labels are a concrete readability concern; palette treatment remains an owner decision. Confidence: High. | Check enabled default/hover/disabled states and approve text/fill adjustments while preserving semantic meaning. |
| G10 Async presentation; shell, detail, Builder, picker, onboarding | D. OWNER REVIEW NEEDED | §§21,26: layout-preserving loading, local errors | Loading alternates between a 10rem text panel and plain status text. Catalog refresh errors replace the whole route even when prior catalog exists. | Retry is explicit; skeleton/stale-data policy and field-level failures affect behaviour. Confidence: High. | Review state policy separately; retain existing recoverable input and local error messages. |
| G11 Native form controls; event/publication/admin | B. VALID EXCEPTION | §§19,26,28: compact options, semantic controls | Native labelled selects and radios are used instead of the constructed dropdown/switch recipes described in root CSS comments. | Established accessible controls meet the new standard; constructing replacements adds unnecessary risk. | Keep native semantics and existing labelled field pattern. |
| G12 Radius vocabulary; all screens | A. COMPLIANT | §§7,27: few shared radii | Most rectangles use `--radius-container`; badges use `--radius-pill`; onboarding selection marker is circular. | No meaningful one-off radius proliferation found in active components. | Preserve; no radius cleanup batch needed. |
| G13 Repeated schemas and imagery | A. COMPLIANT | §§22,24: stable comparison/imagery dimensions | Shared SessionCard/RankingCard/MovieRow repeat layouts; posters are 56×84 or 120×180, with a proportional narrow Seen variant. Metrics has one genre table, not competing copies. | No evidence of repeated table schemas with mismatched column widths. | Preserve shared components; do not invent a table-column unification task. |

## Evidence and limits

Read AGENTS.md first, then STYLE.md fully, README.md, both CSS files, App/components and every frontend screen plus FilmPicker, TurnFields, RotationCard, ClubIdentity and the browser API boundary. Relevant source owners are referenced in each section below.

Reused the already-running normal development servers at `http://localhost:4173/` and `http://localhost:8787/`, avoiding duplicate processes or another migration/seed pass. Playwright used installed local tooling and headless Edge. The refreshed local catalog contained 999 canonical films and 250 active events. No refresh/export, reset, production request, provider enrichment or persistent UI mutation was performed. Screenshots and browser scripts remain in ignored `.verification/`; private snapshot content is not embedded in this document.

Rendered main routes: Home, History, Builder list, Classics Ranked, Seen It?, Metrics, Event creation, populated Event editing and Film detail at **320, 390, 768 and 1440px**, with a 900px viewport height. Additional **719/720px** boundary checks covered Classics and populated Builder/publication. Whole-page captures and end scrolling covered main routes; long History/Classics also had middle/end viewport captures. Long real film titles and widespread missing posters were present. Zero document-width overflow and zero page exceptions were recorded in the main route sweep. This is not a claim that all content is optimally composed or keyboard-accessible.

Opened Classics Needs Data/Disqualified and score breakdown, Home admin rotation correction, History audit, the native History delete confirmation (dismissed), and developer replacement confirmation (not executed). The four local member identities were read through the supported local identity header; admin rendering used an admin local member. The live Builder list was empty, so populated sets, four-film editing, publication and saved-film search used **browser-only response fixtures**. Publication's preliminary save response was intercepted; no save reached the Worker, and final publication was never pressed. Recent Seen answer mutations, undo execution and persistent conflict recovery were source-reviewed only.

Avatar choice and sign-in were rendered at the four primary widths with browser-only identity/health fixtures. Avatar selection was local component state only. Sign-in inspection covered the unconfigured gate, not the live branded GIS control or a Google login. Some avatar screenshots captured image loading; they are not evidence of missing assets. Synthetic catalog failure/loading responses exercised the shared Failure/loading views without disrupting the running service. Actual provider failure, authentication expiry, avatar collision, success after persistent mutation, mobile virtual keyboard and physical safe-area devices remain unverified. Native confirmation wording/behaviour was inspected, but its operating-system visual appearance was not captured.

Full-page screenshots may show the fixed dock across a capture seam. That artefact is not evidence that final content is unreachable. The page reserves bottom space; focused-control occlusion needs a dedicated keyboard/virtual-keyboard check.

## App shell and global navigation

### What is working

All six destinations stay exposed with icons and labels. Active links use both `aria-current` and visual selection. Header identity is compact; logout and refresh have accessible names. The dock includes bottom safe-area padding and the shell reserves end-of-page space.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| N01 Mobile persistent navigation | B. VALID EXCEPTION | §§16–18: persistence must help the task | Six-destination dock remains fixed on narrow screens. Targets are about 50px tall and all destinations remain visible at 320px. | Frequent switching justifies persistence; fixed navigation is not a prohibited sticky primary action. | Preserve mobile access; verify focused controls with a real virtual keyboard before future changes. |
| N02 Desktop dock | D. OWNER REVIEW NEEDED | §§16,17: desktop-appropriate navigation | At ≥720px the same dock becomes centred, max 640px; it stays fixed at the bottom. | It adapts dimensions but retains the mobile interaction form. Changing placement is not cosmetic. Confidence: Medium. | Owner compares current dock with a desktop navigation proposal in a separate pass. |
| N03 Decorative copy and footer density | D. OWNER REVIEW NEEDED | §§3,11,12: concise orientation and quiet metadata | Each screen repeats the shared eyebrow/subtitle and lengthy About/data sources footer, including demo-score wording on real snapshot data. | Attribution is required; repeated product and technical explanations may be unnecessarily prominent. Confidence: Medium. | Review copy separately; preserve required attribution and truthful data-source notices. |
| N04 Route heading focus | B. VALID EXCEPTION | §26: visible focus and keyboard usability | Hash navigation focuses the h1; a white outline can appear around the full heading block. | Visible route focus is deliberate accessibility feedback, not a stray card border. | Preserve focus indication; any alternate treatment requires keyboard review. |

## Home

### What is working

Rotation is first in member content and shows nominal identity, anchor and explicit completion semantics. Shared last-event and shortlist components preserve the film-journal identity. Personal-turn emphasis has a meaningful state purpose.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| H01 Current-turn emphasis | B. VALID EXCEPTION | §§6,9,30: emphasise current state | Personal turn uses a lighter border, raised surface and inset edge; not every turn receives it. | Meaningful ownership cue; do not remove it with general border/shadow cleanup. | Retain and review alongside routine border decisions. |
| H02 Orientation and next action | E. LIKELY REDESIGN | §§3,13,30: orient around current turn and likely next action | Current-turn prose mentions Builder but provides no Builder action; the large separate welcome card offers Start an event. Admin correction is a full-width action in the turn card. | Competing route/role priorities require a whole Home composition decision. Confidence: High. | Dedicated Home review: agree ordinary member/current-host/admin priorities before moving or promoting anything. |
| H03 Summary stat containers | D. OWNER REVIEW NEEDED | §§6,30: cards must express a boundary | Three independent bordered counters repeat the stat-card pattern used in Metrics. | Consistent dashboard vocabulary; flattening them is not a safe one-off removal. Confidence: Medium. | Owner reviews stat treatment with G06, retaining counts and Seen access. |

## History

### What is working

Cycle headings, explicit cycle anchors, date-precision labels, ordered films and actual identities are clear. Session cards represent independent nights rather than arbitrary section boxes. Audit remains an on-demand local task with useful legacy-empty copy.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| HI01 Event cards and nominal order | B. VALID EXCEPTION | §§6,22,30: independent objects and clear chronology | Cycle groups contain individual event cards in nominal-slot order, two columns on desktop. | These are real journal objects; nominal order is intentionally not chronological. | Preserve grouping, film order and precision labels; G06 may alter border strength only after approval. |
| HI02 Repeated editing controls | D. OWNER REVIEW NEEDED | §§13,30: scanning first; editing secondary | Every event has Edit/Audit/Delete outside its card, even across 250 active events. | Valid functions, but three equal fills repeat heavily. Disclosure or relocation changes access and scan rhythm. Confidence: High. | Owner reviews controls using a populated cycle; coordinate with G08 rather than hide them automatically. |
| HI03 Archive-scale scanning | D. OWNER REVIEW NEEDED | §§3,22,30: predictable rhythm and usable scanning | All cycles and events render in one long document; no jump/filter/pagination interaction. | Data growth reveals friction, but adding archive navigation is product work. Confidence: Medium. | Dedicated archive usability discussion if users struggle; no automatic pagination or density change. |
| HI04 Audit presentation | D. OWNER REVIEW NEEDED | §§11,12,21: concise local state | Audit actions are uppercase and change summaries combine raw dates, film lists and flags in metadata lines; repeated Audit clicks refetch without toggling closed. | Detailed evidence is useful, but labels and close behaviour need judgement. Confidence: Medium. | Review one changed and one legacy event; preserve audit information and actor/time evidence. |

## Builder

### What is working

Private ownership is explicit. Empty drafts are allowed; saved sets are independent objects. Shared FilmPicker preserves search/manual/order interactions. Publication is a distinct confirmation stage with date, host, rotation and shared-note consequences.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| BU01 Open-set icon | C. LOW-RISK NORMALISATION | §§12,14,28: clear consistent action meaning | Open set uses ArrowLeft, the same icon used for All sets and Back to set. | Open is not a back action; changing this familiar labelled icon has negligible workflow impact. Confidence: High. | Use an established open/view icon; keep label, target and location. |
| BU02 Desktop editor width | E. LIKELY REDESIGN | §§4,17,30: avoid sprawling Builder forms | Title/note, search and lineup stack across the full shell even at 1440px; row actions sit far from film identity. | Naming width tokens alone does not solve the composition. Confidence: High. | Dedicated Builder review of bounded forms and film-lineup relationship; preserve reading order and stages. |
| BU03 Save, publish and delete priority | D. OWNER REVIEW NEEDED | §§13,19: clear completion; separate destruction | All sets/Save set/Publish/Delete set share neutral fills in one toolbar; editor actions occur before title/films. | Choosing the primary action or moving controls changes task emphasis. Confidence: High. | Agree editor priorities and destructive placement before implementation; coordinate with G08. |
| BU04 Publication confirmation | B. VALID EXCEPTION | §§19,20,30: coherent focused confirmation | Publication is an inline separate stage with actual date, turn fields and clear shared consequences; green final action and neutral back. | A modal conversion is unnecessary; existing stage serves shared persistent publication. | Preserve stage, saved order and irreversible/shared consequences. |

## Classics / Watch Order

### What is working

Ranked, Needs Data and Disqualified are separate pools with explicit labels/counts. Rank, residual score and Seen/No/Unknown counts remain visible. Detailed formula evidence is disclosed, not expanded everywhere.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| CL01 State-filter appearance | C. LOW-RISK NORMALISATION | §§9,16,26: filters must read as selections; visible state | The three state buttons all use `.button`; `aria-pressed` changes but no CSS styles their selected state. At 320px they wrap to three equally filled rows. | Accidental visual-state omission. Can be repaired without changing pools, order or dimensions. Confidence: High. | Add scoped neutral selection treatment to these controls; preserve labels/counts, layout and keyboard semantics. |
| CL02 Ranking-card objects | B. VALID EXCEPTION | §§6,22,30: responsive comparison and state | Candidates use shared cards with score and disclosure, not a rigid table. | Flexible candidate objects are compatible with the standard; do not force a table merely for density. | Preserve comparison values and disclosure; border treatment is G06. |
| CL03 Archive-scale comparison | D. OWNER REVIEW NEEDED | §§3,22,30: easy scan/comparison | Ranked alone has 241 full candidate cards; two columns on desktop. Expanding one creates unequal neighbouring card heights. | Density/list/column decisions have multiple reasonable directions. Confidence: Medium. | Owner reviews real candidate scanning before compact rows, filtering or alternate comparisons. |
| CL04 Maintenance within Needs Data | D. OWNER REVIEW NEEDED | §§12,21,29,30: subordinate maintenance and local feedback | Bulk enrichment precedes candidates; refresh buttons repeat; result text can concatenate many provider failures and cooldowns. | Relevant to missing data, but prominence and result presentation need a workflow decision. Confidence: Medium. | Review with Film detail maintenance; retain explicit bounded calls and truthful partial outcomes. |

## Seen It?

### What is working

One named member/film question, equal-sized 60px answer targets, explicit Unknown and visible progress support repeated answering. Recent answers remain distinct from the main task. No answer was submitted during this audit.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| SE01 Yes/No visual balance | D. OWNER REVIEW NEEDED | §§9,30: neither answer should be visually biased | Yes is green constructive; No is neutral grey. Both are equally placed/sized. | Existing project action language conflicts with the new screen-specific neutrality requirement. Confidence: High. | Owner approves a balanced answer treatment; do not change semantic colours in a mechanical batch. |
| SE02 Native progress | B. VALID EXCEPTION | §§10,21,28: purposeful simple feedback | Native progress has a text label; unused root decorative striped progress is not used. | Simple indicator avoids needless animation and remains understandable. | Preserve native progress rather than adopting unused visual effects. |
| SE03 Recent-answer panel | A. COMPLIANT | §§6,17,21: separate task and practical empty state | Secondary panel is below the question on mobile and alongside on desktop; empty copy is brief. | Distinct correction task justifies its container and layout. | Preserve; source-reviewed undo/recent correction semantics require no restyling. |

## Metrics

### What is working

Identity filters visibly select, use consistent avatars and keep ALL/CLSC explicit. Appearance/repeat/unique distinctions and missing-score/genre coverage remain truthful. Top/bottom schemas share the same CSS; exact values remain available.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| ME01 Film-link targets | C. LOW-RISK NORMALISATION | §§15,26: mobile targets about 44px | `.metrics-film-link` has no minimum hit area; ten ranking links measure below 44px high while sibling MovieLink has a 44px minimum. | Same navigation intent with an accidental target-size gap. Confidence: High. | Increase link hit area within existing row space; keep rank/identity columns and inspect long-title wrapping. |
| ME02 Numerical columns | C. LOW-RISK NORMALISATION | §§22,27,28: stable comparable values | Genre cells inherit left alignment and no numeric role; root table primitives align numbers right with tabular figures. | Aligning numeric columns is safe without changing widths, schema or data. Confidence: High. | Apply numeric alignment/tabular figures to count/share/IMDb values; retain coverage helper text. |
| ME03 Metadata maintenance panel | D. OWNER REVIEW NEEDED | §§29,30: explicit subordinate admin area | Admin-only maintenance is a full card with a full-width button at the end of the metrics content; not behind disclosure. | Below ordinary data, but visually equivalent to product sections. Confidence: High. | Owner decides disclosure versus current contextual panel; retain explicit operation and useful results. |
| ME04 Charts | D. OWNER REVIEW NEEDED | §§23,30: visual comprehension; charts where useful | Counts, top/bottom lists and a genre table; no charts. Current snapshot has no recognised genre coverage. | Absence is not automatically a defect; a meaningful chart requires data and purpose. Confidence: Medium. | Agree a useful comparison using a browser fixture with populated genres; no decorative chart or enrichment merely for the audit. |
| ME05 Identity filters | B. VALID EXCEPTION | §§9,19,30: filters identifiable; compare identities where useful | Avatar-based buttons occupy three columns on mobile/six on desktop rather than a compact select. | Small familiar identity set benefits from visible comparison; controls already look selected rather than submitted. | Preserve; redundant filter-icon removal is optional owner taste, not required cleanup. |

## Event creation/editing and shared film picker

### What is working

Visible labels, independent actual date, clear host identity, swap explanation and rotation/backfill distinctions protect important semantics. Shared picker supports ordered films with adequate reorder/remove targets. Manual creation is disclosed. Existing populated two-film editing rendered safely.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| EV01 Edit subtitle | C. LOW-RISK NORMALISATION | §§12,30: direct contextual copy | App subtitle lookup uses the full route string; `event/:id` falls back to film-detail prose: “The film, the scores, and our shared history.” | Accidental route-copy fallback, not a design choice. Confidence: High. | Give Event editing a truthful contextual subtitle; keep heading and structure. |
| EV02 Mobile completion order | E. LIKELY REDESIGN | §§17,19,30: details/lineup one coherent workflow | Save belongs to the left details form. On mobile it appears before search and lineup; users may reach completion before reviewing the films. | Moving completion or changing form ownership affects reading order and validation. Confidence: High. | Dedicated Event workflow review at mobile and desktop widths; preserve all turn/correction semantics. |
| EV03 Optional field exposure | D. OWNER REVIEW NEEDED | §§19,30: staged forms; optional disclosure | Optional title/note/swap and backfill selectors are shown in the long details form; current completion removes some fields. | Disclosing additional fields changes discoverability and staging. Confidence: Medium. | Owner reviews common creation versus historical correction; no automatic hiding. |
| EV04 Host choice tiles | B. VALID EXCEPTION | §§19,24,28: compare meaningful options | Four native radios display identity avatars/names rather than a compact host select. | Identity comparison is useful and already established; label targets are generous. | Preserve host semantics and identities. |
| EV05 Error locality | D. OWNER REVIEW NEEDED | §§19,21: validation beside fields | Save errors appear near Save; picker errors after its sections. API field paths are flattened into message text by `api.ts`. | Input is retained, but field mapping/local focus would be behavioural work. Confidence: High. | Plan focused validation work; do not solve with a different global error-card style. |
| EV06 Sticky lineup declaration | A. COMPLIANT | §§17,18: purposeful actual sticky behaviour | CSS defines desktop `.event-lineup` sticky, but FilmPicker renders no element with this class. Active picker stays in normal flow. | Unused CSS is not evidence of a sticky UX exception. | Do not activate or remove unrelated CSS during normalisation. |

## Film detail

### What is working

Film identity leads; title/year/runtime, missing overview/genres and missing poster remain intelligible. Member answers distinguish Unknown and expose selected state. Captured ratings, input provenance and appearance dates remain truthful.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| FD01 Viewing hierarchy | E. LIKELY REDESIGN | §§3,30: identity/viewing first; provenance subordinate | Membership/refresh panel immediately follows identity. Seen and scores follow; identifiers/artwork precede appearances. Many bordered sections compete. | Content order and disclosure changes require a dedicated film-detail decision. Confidence: High. | Owner reviews member viewing versus maintenance tasks before reorder/disclosure changes. |
| FD02 Repeated film identity inside RankingCard | D. OWNER REVIEW NEEDED | §§6,12,28: reuse purposefully without redundant hierarchy | A ranked detail uses the whole shared candidate card, repeating poster/title already shown above. | Useful reuse, but possibly redundant; removing fields creates a variant. Confidence: Medium. | Review a fully ranked film before extracting a ranking-only presentation. |
| FD03 Per-member answer controls | A. COMPLIANT | §§9,15,26: fair answering and explicit state | Yes/No/Unknown are equally neutral; selection outline and text state accompany `aria-pressed`. Inactive members are disabled. | Good state-selection pattern; do not apply global constructive/destructive intents here. | Preserve answer parity and Unknown. |
| FD04 Technical metadata visibility | D. OWNER REVIEW NEEDED | §§12,29,30: provenance subordinate | External IDs, asset dimensions, service names and normalised ratings are permanently visible. | Honest evidence, but member utility varies; disclosure changes content access. Confidence: Medium. | Review which technical details stay open, preserving all audit/provenance data. |

## Avatar onboarding

### What is working

Focused full-screen choice, explicit one-time consequence, clear selected outline/check, disabled continuation until choice and collision refresh recovery are present. Grid shifts from four to five columns without changing reading order.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| AV01 Logout label | C. LOW-RISK NORMALISATION | §§12,28: consistent direct copy | Onboarding says “Logout”; shell accessible action says “Log out of BookClub”. | Small inconsistent verb spelling only. Confidence: High. | Use “Log out” without changing action, position or emphasis. |
| AV02 Choice imagery and grid | B. VALID EXCEPTION | §§7,19,24,30: focused visual comparison | Large illustrated selectable tiles and check/plus overlays; not a select dropdown. | Artwork is the actual choice and product identity; decorative-image restrictions do not apply. | Preserve assets, selection cues and responsive grid. |
| AV03 Loading/recovery | A. COMPLIANT | §§19,21,30: focused recoverable choice | Local loading, explicit no-available-avatar/contact state, retry choices and 409 selection reset exist. | Recovery is source-supported; collision was not executed. | Keep; test actual collision separately when changing onboarding logic. |

## Sign-in

### What is working

Private-club context is brief, narrow and focused. Misconfiguration states identify the administrator as the next step; script failure offers a specific retry. No member navigation distracts from the gate.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| SI01 Official Google control | B. VALID EXCEPTION | §§1,9,28,30: clear sign-in and external identity constraints | Configured mode delegates button rendering/branding to GIS, unlike normal BookClub actions. | Correct deliberate third-party identity exception; configured GIS was source-reviewed only in this pass. | Preserve official button; verify live configured rendering separately without changing branding. |
| SI02 Single task container | B. VALID EXCEPTION | §§4,6,20: distinct task boundaries | Narrow 440px sign-in card contains context, control and local failures. | One gate card is a justified task boundary despite general flat defaults. | Preserve focused width and concise context. |

## Dialogs, confirmations and admin controls

### What is working

History removal explicitly preserves recoverability and rotation. Publication warns about shared notes and qualifying Classics Seen effects. Local replacement has a deliberate confirmation; no typed phrase is imposed on ordinary actions. No custom modal component is currently mounted by these screens.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| DI01 History native confirmation | B. VALID EXCEPTION | §20: interrupt shared persistent changes where justified | `window.confirm` explains removal, admin restoration and unchanged rotation; browser blocks accidental completion. | Shared History impact justifies confirmation. Native chrome differing from app styling is not itself a defect. | Preserve guard unless owner commissions a contextual confirmation replacement. |
| DI02 Private Builder deletion | D. OWNER REVIEW NEEDED | §§12,20: prefer inline for ordinary destruction; identify object | Native “Permanently delete this private set?” omits set title; routine private deletion shares the editor toolbar. | Inline versus modal and destructive separation need task review. Confidence: High. | Review with Builder; include object/consequence if confirmation is retained. |
| DI03 Film-lineup removal | B. VALID EXCEPTION | §§19,20: proportionate destructive safeguards | Remove immediately changes unsaved lineup; no persistent film deletion and no confirmation. | Reversible draft editing should not receive the same interruption as shared History destruction. | Keep lightweight removal; do not add blanket confirmations. |
| DI04 Restore/admin coverage | A. COMPLIANT | §§1,29: do not invent adjacent product UI | Admin rotation and metadata controls exist; restoration is API-only, documented in README. | Absence of a restore screen is an explicit product boundary, not style noncompliance. | Preserve scope; no new administration dashboard in normalisation. |

## Local developer tools

### What is working

Tools are a labelled disclosure, development-only, absent from production builds, and use the supported local member selector. Replacement explains local data loss and waits for deliberate confirmation. No replacement was run.

### Findings

| Area | Category | STYLE.md rule | Current behaviour | Judgement | Suggested next step |
| --- | --- | --- | --- | --- | --- |
| DE01 Selector target/style | C. LOW-RISK NORMALISATION | §§15,19,27,28: labelled generous consistent controls | Bare native select lacks `.field__input`; rendered control is small and compressed against label. | An accidental omission from the existing field pattern. Confidence: High. | Apply existing input-label/field treatment inside the disclosure; retain native select, values and behaviour. |
| DE02 Closed panel prominence | D. OWNER REVIEW NEEDED | §§3,29,30: developer tasks out of member hierarchy | Shared bordered developer disclosure appears before every route's member content and directly touches the next section. | Disclosure is correct, but placement and frame compete with the task. Confidence: High. | Owner approves quieter treatment/location; do not move it as a spacing-only change. |
| DE03 Local replacement confirmation | B. VALID EXCEPTION | §§9,20,29: explicit high-impact local task | Destructive red confirmation is dominant inside expanded tools; Cancel stays neutral. | Appropriate within the explicitly chosen replacement task; not an ordinary member primary action. | Preserve confirmation boundary and truthful progress. |

## Proposed implementation batches

### Batch 1: SAFE / LOW-RISK NORMALISATION

Only the C findings below belong in an automatic implementation proposal. The audit does not authorise implementation.

| Group | Finding IDs | Boundaries |
| --- | --- | --- |
| Central aliases | G01–G05 | Name existing spacing, text roles, widths, action icon size and target sizes; preserve computed dimensions and existing root tokens. Extend in `frontend/app.css` under the current project ownership rule. Do not tokenise every unique illustration dimension or round values wholesale. |
| Clear selection feedback | CL01 | Scoped neutral selected styling for Classics filters; no new tabs/navigation/layout or action priority changes. |
| Repeated data usability | ME01–ME02 | Film-link hit area and numeric alignment; preserve schemas, column widths, exact values and metadata. Check mobile row growth. |
| Small semantic/copy omissions | BU01, EV01, AV01 | Open-set icon, event-edit subtitle, Log out wording; no action/stage/position change. |
| Local developer field consistency | DE01 | Existing labelled-field treatment and minimum target only; keep developer panel position and confirmation. |

No global border removal, new radius scale, table replacement, colour-role remapping, card deletion, breakpoint merge or navigation redesign belongs here. There was no active repeated-table-width mismatch or stray routine-card shadow to fix.

### Batch 2: OWNER REVIEW NEEDED

1. Shared visual language: G06–G09 and H03 — routine borders/stat surfaces, background atmosphere, action roles and contrast. Review before broad styling to avoid contradicting deliberate BookClub identity.
2. Navigation/copy/states: N02–N03, G10 — desktop dock, repeated copy, preserved-data refresh errors and loading layout. Include keyboard/safe-area verification.
3. Archive interaction: HI02–HI04, CL03–CL04 — repeated edit/maintenance controls, large-list scanning and audit/result presentation. No automatic hiding or density reduction.
4. Task-specific priorities: BU03, SE01, EV03/EV05, FD02/FD04, DI02 — editor completion, answer neutrality, form staging/validation, provenance and private deletion.
5. Metrics/admin/developer: ME03–ME04, DE02 — maintenance disclosure, chart purpose and developer prominence. A chart is not mandated where data cannot support one.

### Batch 3: DEDICATED SCREEN REDESIGNS

| Screen | Finding | Review required before changes |
| --- | --- | --- |
| Home | H02 | Current-turn/member/admin priorities and the relationship between Builder and Start an event. |
| Builder editor | BU02 | Bounded desktop form composition and proximity of lineup actions without changing publication/privacy rules. |
| Event creation/editing | EV02 | Coherent details → film lineup → completion reading order and form boundaries on mobile/desktop. |
| Film detail | FD01 | Viewing/history hierarchy versus membership, refresh, scores and technical provenance. |

These are candidates for focused design review, not a conclusion that every screen needs replacement. History/Classics scale and Metrics charts stay in owner-review scope until a clear task need is agreed.

## Validation and documentation observations

Browser commands run: `node .verification/ui-audit.mjs`, `node .verification/ui-audit-states.mjs`, `node .verification/ui-audit-extra.mjs`. The first route-run attempt exposed a local browser setup issue: changing the developer identity in storage required a reload before the mounted app adopted it. The harness was corrected and completed. No app correction was needed. Scripts used isolated browser storage and response fixtures; screenshot/measurement artifacts are ignored and private.

Validation: main route sweep completed at four widths with zero document overflow and zero page exceptions; additional fixture/state/breakpoint captures completed. A direct sRGB calculation confirmed the white/emerald contrast value; no full contrast audit was run. These checks do not certify every hit target, keyboard traversal, OS dialogs or virtual-keyboard behaviour. `git diff --check` passed; the new untracked document was also checked with `git diff --no-index --check -- NUL docs/UI_AUDIT.md`. Full tests, build and typecheck are not needed for a documentation-only audit and were not run.

AGENTS.md was checked for drift. Its §12 precedence puts STYLE.md before nearby implementation, whereas new STYLE.md §1 explicitly ranks established BookClub patterns ahead of the standard. This pass follows the user's explicit conservative audit principle. The owner should reconcile the standing authority wording before future UI implementation; no standing guide was edited in this audit. Root CSS's old guidance about strong card borders, monochrome-only foundations, custom dropdowns and white administrative buttons also differs from the new standard. These comments are historical implementation guidance, not automatic instructions to replace active established patterns. README continues to document charts as deferred; STYLE encourages considering useful charts, which does not itself authorise a new Metrics feature.

## Final summaries

### Safe normalisation summary

**Five global low-risk patterns and seven screen-specific low-risk findings**: twelve C findings total. The first five are predominantly exact-value token aliases, giving broad maintainability benefit with little visible change. The seven local corrections touch shared action wrappers/app route copy, Classics filter state, Metrics links/table and the developer field. Approximate implementation scope: a small CSS token/selector pass plus a handful of TSX edits, with rendered comparison at the same widths; no new dependencies, schema changes, navigation changes or content removal.

### Owner-review summary

Main judgement calls: routine borders and atmosphere; action/destructive hierarchy and contrast; fair Yes/No treatment; desktop navigation; archive scan density; admin/developer disclosure; loading/stale/error policy; optional fields and field validation; chart utility and provenance visibility. High confidence establishes the concern, not authority to choose the design.

### Redesign summary

Four dedicated review candidates: **Home orientation, Builder desktop editor, Event completion order and Film detail hierarchy**. Review the actual task flow before any layout change. Sign-in, onboarding and the core Seen question do not need wholesale redesign on this evidence.

### Suggested implementation order

1. Reconcile standing authority wording, then authorise exact-value token aliases G01–G05; verify no geometry/role changes.
2. Implement the seven local C findings in small reviewable groups; compare populated mobile/tablet/desktop screens and keyboard focus.
3. Owner approves shared border/action/contrast decisions and Yes/No balance using representative screens; avoid broad implementation until these choices are concrete.
4. Review Home, Builder, Event and Film detail individually, preserving product semantics and essential reading order.
5. Revisit archive-scale navigation, state policy and meaningful Metrics charts only if owner review establishes their task value.
