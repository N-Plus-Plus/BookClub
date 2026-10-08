# STYLE.md: BookClub UX and UI Standard

Read this file fully before any user-facing interface work. This file defines BookClub's visual and interaction standard. Functional correctness is necessary, but a screen is not complete merely because the requested controls exist.

## 1. Authority and scope

For BookClub interface decisions, use this order:

1. Explicit instructions for the current task.
2. Established BookClub-specific UX/product decisions and coherent existing project patterns.
3. This STYLE.md.
4. Nearby implementation details.

Existing code alone does not establish a design decision or make an obviously weak or accidental implementation correct. Established project consistency normally wins over generic best practice. Do not use this file as permission to redesign established BookClub patterns unless the current task explicitly authorises that change.

If an existing pattern is known to be weak but the task does not authorise changing it, preserve it and note the issue rather than expanding scope.

Do not perform opportunistic UI cleanup outside the requested area. Change only what the task requires, plus the minimum neighbouring adjustments needed to keep the result coherent.

AGENTS.md governs agent routing and standing engineering/safety rules. README.md is the human overview; the specialised documents under docs/ own architecture, data, contracts, integrations, testing and deployment. STYLE.md governs user experience, visual design, composition, interaction, responsive behaviour and presentation.

## 2. Design intent

BookClub should feel deliberately designed, calm, dark, legible and visually coherent.

Task clarity matters, but it is not the only valid starting point. Strong product identity can lead the visual direction where appropriate. The final interface must still make the user's purpose and next useful action clear.

For every meaningful UI change:

- consider the whole screen, not only the changed component;
- preserve the established BookClub visual language unless instructed otherwise;
- keep the visual hierarchy deliberate;
- make mobile and desktop compositions intentional;
- inspect the result with real content where practical.

A technically correct component can still make the page worse.

## 3. Whole-screen composition

Review the full screen whenever user-facing UI changes.

Check:

- top-to-bottom hierarchy;
- left-to-right alignment;
- visual balance;
- grouping;
- whitespace;
- repeated shapes;
- competing focal points;
- whether the first viewport orients the user;
- whether the primary task is obvious where one exists;
- whether secondary, admin and developer controls are quieter;
- whether the screen still works with long titles, missing artwork, many rows and expanded details.

Strong alignment matters. Sections, controls and repeated objects should normally follow established page edges and column lines.

Do not create asymmetry simply to make the page feel more designed. Use asymmetry only when it improves the composition or supports the task.

## 4. Layout widths

BookClub may use task-specific content widths.

Do not force every screen into one universal maximum width. Editing, comparison, browsing and dashboard-like screens have different needs.

However, keep the total number of width conventions small. Prefer a small named set such as:

- narrow;
- standard;
- wide;
- full or data-heavy, only if genuinely needed.

Do not introduce a new one-off maximum width for an individual component when an established project width can serve it.

On desktop, actively compose for the available space. Do not merely stretch the mobile layout wider.

## 5. Spacing and rhythm

BookClub uses 4, 8, 12, 16, 20, 24 and 32px spacing, with explicitly defined 2px/6px microspacing. Use 8px icon-to-label/control gaps (16px between a page-heading destination image and title), 4–8px compact text groups, 12px poster-to-details, 8px label-to-field, 16px heading/content and row rhythm, and 24–32px section separation. Metrics retains its 32px outer gap. Poster dimensions, content-width tiers, drawer geometry and chart constraints are geometry rather than spacing tokens. The bottom dock's 5px label gap and 7px item padding retain its constrained composition.

Use central spacing tokens or established project values rather than arbitrary gaps.

Principles:

- smaller gaps within a logical group;
- larger gaps between distinct sections;
- headings should visually belong to the content below them;
- repeated relationships should use repeated spacing;
- generous breathing room is preferred over dense packing;
- do not compress controls or text merely to reduce scrolling;
- do not introduce giant empty areas that make the page feel unfinished.

When a layout needs an unusual gap, it should be explainable by the composition rather than convenience.

## 6. Surfaces, cards and borders

Flat composition is the default. Genuine standalone cards have a consistent quiet visible border by default: 1px asphalt-dark, with existing padding, background and corner radius. Flat sections and statistical strips are not automatically cards and do not gain borders. Use the shared .card treatment, including sign-in/onboarding; retain meaningful selected, warning, personal-turn and destructive treatments without adding boxes to rows, metadata or nested decoration.

Use cards or containers when they communicate a real boundary, independent object, selectable item or distinct task.

Do not add a card merely because:

- content needs spacing;
- a heading and text are adjacent;
- every section seems to need a rectangle;
- the layout otherwise feels unfinished.

Prefer:

- whitespace;
- alignment;
- typography;
- subtle dividers;
- section rhythm.

Visible borders should be quiet and purposeful. Strong borders should be reserved for things such as:

- focus;
- active selection;
- warnings;
- genuinely important boundaries.

Two horizontal dividers must never appear consecutively without meaningful content between them. Where an item-level final divider meets a section/group divider, retain only one boundary.

Nested cards should be uncommon.

Status badges are outlined rounded pills: 11px/800, line-height 1, 4px × 8px padding, 1px border and 24px minimum height. Intent changes colour, not geometry. Attached counts are a separate solid family: 11px/600, line-height 1, 2px × 4px padding, with semantic fills for tab/filter counts. Use each family according to meaning; do not vary padding or weight by screen.

## 7. Shape vocabulary

Use a very small approved set of corner radii.

Do not invent component-specific radii casually.

Rounded rectangles should support the visual language, not become the organising principle of every screen.

## 8. Dark visual identity

BookClub is fundamentally a dark interface.

Neutral or noticeably tinted dark foundations are both acceptable where deliberate. Dark foundations may lean towards a project colour if the result remains coherent and readable.

There is no general ban on blue, purple or other tinted dark surfaces. Use them only when they belong to the deliberate BookClub palette rather than appearing as incidental one-off colour choices.

Light themes are outside the normal BookClub design direction unless explicitly requested.

## 9. Colour and action priority

Keep the accent palette deliberately small.

Colour is part of action hierarchy, not a completely separate system.

Primary actions should normally receive the strongest approved action treatment for the current context. Secondary actions should be quieter. Destructive actions should use the destructive language of the project, but should not become visually dominant unless destruction itself is the primary task.

Filters and selection controls must look like filters or selections, not like submission buttons.

Use semantic colour consistently for:

- primary action;
- destructive action;
- warning;
- success;
- selection or active state, where needed.

Do not create a new accent for every category or screen.

Never rely on colour alone to communicate state.

## 10. Decorative effects

Decorative gradients, strong shadows and visual effects are discouraged unless they solve a concrete visual problem.

Appropriate examples include:

- a gradient to keep text legible over artwork;
- a shadow to separate a floating menu, dialog or popover;
- a subtle transition to make a state change understandable.

Do not use gradients, shadows, glow or elevation as substitutes for hierarchy or spacing.

Routine cards should not need shadows. Preserve BookClub’s top-left dark radial background atmosphere.

## 11. Typography

BookClub uses Lexend Deca for interface text and numbers. Keep the existing bundled 300/400/500/600/700/800 static font faces and the numeric-family/tabular-number conventions; this is not a variable-font configuration.

Typography follows semantic roles, independent of screen or HTML tag. Shared application tokens in `frontend/styles/shared-content.css` define:

| Role | Size | Weight |
| --- | --- | --- |
| Page H1 | Fluid 32–52px | 600 |
| Section H2 | 20px | 600 |
| Subsection H3 | 18px | 600 |
| Minor heading H4 | 16px | 600 |
| Standard film title | 22px | 600 |
| Compact film title | 18px | 600 |
| Detail film title | 24px | 600 |
| Seen hero film title | 30px | 600 |
| Body | 16px | 400 |
| Supporting prose | 14px | 400 |
| Metadata/helper | 13px | 400 |
| Field label | 13px | 500 |
| Button/tab label | 15px | 600 |
| Eyebrow/overline | 11px | 600 |
| Compact identity/count | 11px | 600 |

Classify subordinate text before applying a role; the inherited 16px body is not the default for metadata, helpers or supporting prose. Headings and film titles use 1.25 line height (the fluid H1 uses 1.2); ordinary text uses 1.5; metadata/narrative prose uses 1.6; controls and compact indicators use 1. Explicitly style h4 and small. Emphasis uses 600 within the current role; status badges use 800. Preserve subdued metadata colours, established heading/eyebrow tracking and tabular numeric alignment.

Named variants retain History film titles at the event H3 size, compact mobile Classics/narrow Builder titles, large Detail/Seen identities, Home's responsive statistic numerals/labels, compact branding/navigation microtext, light 300-weight narrative prose in Seen/Detail/Add Classic, and generated Metrics theme typography/report colours. Home statistics use 24–30px mobile numerals and 38px at 720px, with 11/13px labels and weight-500 numerals. Builder poster captions use the reusable metadata-label variant (13px/500), centred and ellipsised. The deliberately tiny attribution remains unchanged pending owner readability review. Details and the small exception register belong in [STYLE_UNIFICATION_DECISIONS](docs/audits/STYLE_UNIFICATION_DECISIONS.md).

Linked film identity containers, including poster and subordinate metadata, remain native Film Detail links with visible hover and keyboard focus treatment; independent actions remain outside the link. Do not use decorative Eye icons to indicate Film Detail navigation. Informational film displays remain unlinked unless navigation is already intended.

Whole-number counts use shared `formatCount` (`en-AU` thousands separators), including statistics, pagination, ranking/Seen counts, report counts, Admin estimates and progress. Preserve film years, dates, identifiers, units, percentages, score precision, calculation precision and the 99+ cap on Unranked filter and desktop Seen counts; accessible names expose the full formatted count. Fractional vote medians retain their existing precision.

Use Australian English throughout the interface. Possessive member display names ending in s or S take only an apostrophe (Jess’ week); other names take ’s (Sean’s week).

## 12. Copy and microcopy

### Casing

Use sentence case by default for interface-authored page, section, report, chart, card, dialog, group, fieldset, disclosure and empty-state headings, navigation destinations, tabs, statistic descriptors, labels and ordinary action copy. Capitalise the first word and genuine proper nouns, not subsequent ordinary words: Quick facts, Club timeline, Classics snapshot, Cycles completed, Ratings profile, Top 5 talent, Top 5 highest revenue / budget ratio, Seen it, Add to set and Record an event.

Reserve ALL CAPS for established eyebrows, overlines, compact identity treatments and taglines, including HAVE YOU SEEN..., THIS VISIT, WELCOME, TROY, FILM CLUB and LOCAL DEMO. Do not uppercase ordinary headings to bypass sentence case.

Retain exact casing for branding and stylised anagrams, genuine proper nouns, provider names, abbreviations/initialisms, film titles, member names, private Builder set titles and user-authored History cycle titles. Classic and Classics are explicitly protected BookClub proper nouns in singular and plural: Add Classic, Remove from Classics, Next Classics, Eligible Classics, Classics score, Classics week and Next ranked Classics. Preserve Book Club, BookClub and Builder for the named product/features, and IMDb, TMDB, OMDb, MDBList, Letterboxd, Trakt, Roger Ebert, Metacritic and Rotten Tomatoes.

Use controlled descriptors at the owning presentation: Top 5 highest critic scores, Top 5 lowest audience scores and Most recurring director (with the role word retaining its heavier weight). Keep canonical source definitions and talent-role constants intact. Preserve inserted content exactly: Sean’s turn, Cycle 12 and Use Friday ideas? must not recase the member, cycle or private title.

Do not implement casing with CSS text-transform, a generic runtime casing algorithm or broad transformations of composed strings. Edit controlled interface wording at its source; never lowercase strings containing external or user-authored content.

Be concise.

If the interface already communicates something clearly, do not explain it again in prose.

Prefer direct actions such as:

- Save
- Add film
- Publish
- Remove
- Restore

Avoid vague labels such as:

- Submit
- Process
- Action
- Confirm

unless the context genuinely requires them.

Errors should state what happened and what the user can do next. Cooldown/retry wait durations round up to whole minutes, using hr/min and omitting zero units; never display seconds.

Confirmation text should identify the object, scope and consequence.

Do not expose implementation language in member-facing UI.

## 13. Buttons and action hierarchy

When a screen or workflow has a clear next action, one action should normally dominate visually.

Secondary and tertiary actions should be quieter.

Avoid rows of several equally prominent buttons.

Action priority should be visible through a combination of:

- colour;
- fill;
- contrast;
- size where appropriate;
- placement;
- spacing.

Ordinary Actions share 46px height, 12px inline padding, 8px icon/text gap and 15px/600 labels. Primary/secondary/tertiary and intent colours do not change geometry. Icon-only Actions have at least 44×44px targets; artwork/icon dimensions remain independent. Tabs/source filters share `.tab-control` geometry: 44px height, 12px inline padding, 8px gaps and the same label role, transparent surface and active underline. Metrics identity choices are avatar tiles rather than ordinary text filters.

The reusable wrapping-label variant keeps the 46px minimum, 12px inline padding and 8px gap, adding 8px block padding with 1.25 line height when needed in Admin and long retry/developer controls. Seen answers remain equal 60px Actions. Narrow Builder editor actions hide decorative icons below 390px to retain standard label size and padding within controlled wrapping. Classics removal extends its 44px target around the established quiet 18px icon dock without colliding with the film link.

Keep destructive controls separate from routine completion.

Do not add extra button styles when the existing hierarchy can express the same role.

Next and Previous pagination buttons use an extra 0.5rem of padding after the label.

## 14. Icons

Use the established BookClub icon family consistently.

Icon-only controls are acceptable for familiar actions when:

- meaning is obvious in context;
- the hit target is adequate;
- an accessible name exists;
- a tooltip or equivalent explanation is available where useful.

Visible text is not mandatory for every major navigation item when space is constrained, but navigation must remain understandable.

Unfamiliar, consequential or ambiguous actions should normally have visible text.

Do not substitute arbitrary Unicode glyphs for proper icons.

## 15. Touch targets

Mobile interactive targets should normally be about 44px or larger in each usable dimension.

The visible icon or label can be smaller, but the hit area should remain generous.

Do not pack small icon-only controls together so tightly that accurate tapping becomes difficult.

## 16. Navigation

BookClub must keep clear access to:

- Home;
- History;
- Builder;
- Classics;
- Seen;
- Metrics.

Mobile retains fixed bottom navigation with safe-area space. At 720px and above, desktop uses a collapsible side drawer with visible destination labels when expanded and named icons with focus/hover explanations when collapsed. Content reserves the drawer width; component state is sufficient. Drawer destination images are 33×33px in both expanded and collapsed states; bottom-dock images remain 22×22px. The drawer and bottom dock use the matching bundled images from `generated/public/buttons/`, derived from canonical `assets/source/buttons/` (Classics uses `classsics.png`); repeat each destination image beside its page heading. Admin, Film detail and Event headings use `admin.png`, `filmdetails.png` and `event.png`. Pagination uses Lucide ChevronLeft and ChevronRight; the expanded drawer collapse action uses Lucide PanelLeftClose, and History Re-sort uses Lucide ArrowUpDown. The drawer collapse-control row contains only its toggle.

Shared page headings use 24px above and below, with zero H1 margins and a 16px image/title gap; destination image size and vertical centring remain unchanged. Heading actions stay right-aligned, including when they wrap beneath the title at narrow widths. The account identity has a 12px right inset within its header alignment, including either desktop drawer state. Long account names wrap within the header.

Do not hide primary destinations behind a hamburger menu when there is sufficient room to expose them directly.

Desktop navigation should normally adapt into a desktop-appropriate form rather than simply preserving the mobile navigation unchanged.

Active state must be clear. The desktop current tab keeps its gentle background highlight and a straight vertical accent outside its left edge.

## 17. Responsive behaviour

Mobile-first does not mean mobile-only.

BookClub should intentionally compose for mobile and desktop.

On mobile:

- retain generous touch targets;
- avoid dense horizontal action rows;
- avoid hover-dependent interactions;
- keep actions in normal document flow unless there is an exceptional reason for sticky behaviour;
- preserve the same essential reading order used on larger screens.

On desktop:

- use the available width deliberately;
- use columns or grids where they improve comparison or workflow;
- do not stretch narrow forms across the entire screen;
- preserve strong alignment;
- use desktop-specific navigation where useful.

Content and action reading order should remain essentially the same across viewports.

Component-specific breakpoints are allowed when they improve a layout. Do not force every component to change at the same breakpoint.

## 18. Sticky and fixed UI

Use sticky or fixed elements only when persistent access materially improves the task.

Do not make primary actions sticky on mobile by default.

When sticky or fixed UI is used, verify that it does not cover:

- focused controls;
- validation messages;
- final content;
- safe areas.

## 19. Forms

Forms should be staged around the task. Ordinary fields use 48px height, 12px inline padding and 16px input text for mobile readability/browser behaviour. Labels use the 13px/500 field-label role; multiline fields retain their established resizing behaviour.

Use visible labels where ambiguity is possible. Placeholder text is not a label replacement.

Prefer compact selects or dropdowns for a small set of options unless the options themselves need comparison.

Hide optional or advanced fields behind clear disclosure where that reduces noise.

Validation should normally be inline beside the relevant field.

Preserve user input after recoverable errors.

Keep the main save or continue action easy to find.

Do not mix destructive controls into the normal completion path.

## 20. Confirmations and modals

Modals are a normal BookClub pattern for focused confirmations and secondary tasks.

However, destructive actions should normally prefer inline confirmation where that preserves context and the consequences are not unusually serious.

Use a modal destructive confirmation when:

- the consequence is shared or difficult to reverse;
- the action affects substantial persistent data;
- inline confirmation would be unclear;
- focused interruption is genuinely helpful.

Typed confirmation phrases should be reserved for exceptional high-impact destruction.

## 21. Loading, empty, success and error states

Every meaningful data surface must account for:

- loading;
- empty;
- error;
- success;
- stale or refetching state where relevant.

Prefer skeletons or placeholders that preserve the final layout during loading.

Keep empty states compact and practical. Usually provide:

- what is absent;
- the next useful action, if one exists.

Do not turn every empty state into a large illustrated panel.

Prefer the changed interface itself as success feedback when the result is obvious.

Toast notifications are an acceptable normal lightweight feedback mechanism, but should not replace feedback that belongs beside the affected control or content.

Errors should stay as local as practical to the failed task. A failed refresh preserves useful loaded data and shows a local retry state; initial loading must not invent stale data.

Routine manual freshness controls are not part of the member UI. Confirmed same-client changes update automatically through returned-data patches or existing automatic reads. Broad changes from another device/session may remain stale until full document reload; Detail and Builder retain their existing narrow mount reads. Do not add polling or route-entry catalogue refresh merely to guarantee freshness. Conditional error recovery and explicit admin/provider or local developer maintenance are exceptions.

## 22. Tables, rows and repeated data

Flexible row and card layouts are normally preferred over rigid tables, even for comparison-heavy information, when they produce a better responsive result.

Use a table when tabular comparison genuinely benefits the user.

Table columns align according to the meaning of their content:

- Text, descriptions, names and categorical labels: left.
- Numerical quantities, scores, percentages, currency and measures: right.
- Dates in dedicated date columns: centre.
- Column headings use the same alignment as their data.

Prefer tabular numerals for numeric columns. Apply these rules to future tables and existing tables when deliberately touched; document justified departures when they materially improve usability. The shared Score abbreviations glossary displays Abbreviation, Source, Native and Normalised at desktop widths (720px and above), with equal-width, right-aligned Native and Normalised columns and headings. Below 720px, hide both example columns and headings, remove the four-column minimum width, and let the left-aligned Abbreviation and Source columns fill the dialog with naturally wrapping source descriptions and no horizontal scrolling. Retain all canonical example data.

Compact film information shares one hierarchy beside its fixed-size poster: title; year, runtime and Australian classification where available and appropriate; known director; then Seen / Haven't / Unknown aggregate counts when supplied for a candidate listing. Omit unknown directors and unavailable metadata rather than inventing placeholders. Source-score rows remain below the identity. Home and Classics candidate summaries include all three counts once; Home omits member names. Ordinary Builder/Event/History rows do not acquire invented summaries. Larger Film Detail and the specialised Seen question retain their purpose-built presentation. Aggregate Haven't labels differ from conversational Yes/No actions and individual Not seen responses.

Australian availability is presentation-only: map recognised provider aliases conservatively to concise brand names, preserve recognisable unknown labels, and deduplicate after normalisation within each category in source order. Stream and Rent use identical metadata typography, colour and weight; Free and With ads retain their separate treatment. Never display Buy offers. Purchase-only data may explain that no cached streaming or rental options are displayed; it must not claim that no offers were cached. Provider IDs, stored offers and source responses remain unchanged.

Where multiple related tables repeat the same schema, keep their corresponding column widths consistent so comparisons do not shift between tables.

Repeated rows should have:

- strong alignment;
- predictable rhythm;
- quiet separators;
- stable positions for comparable values and actions.

Do not wrap every row in a heavy card unless the row represents a genuinely independent object.

Internal slot terminology never appears in member-facing UI. Use named historical turns where ordering helps; current turns use the effective member after swaps. Normalised `/100` source scores retain at most one decimal and suppress trailing `.0`, preserving meaningful fractions outside saved Film Detail. The detailed Classics-score card on saved Film Detail rounds visible normalised scores and raw/residual results to integers for presentation only; its concise source row uses the shared source formatting. Native IMDb `/10` and calculated/stored precision remain unchanged.

## 23. Metrics and charts

Metric-heavy screens should normally consider charts as a desirable presentation tool.

Use charts when they help users understand:

- distribution;
- ranking;
- change;
- comparison;
- proportion.

Do not add decorative charts that merely restate a single obvious number.

Charts should work with the surrounding data rather than replace essential exact values.

## 24. Imagery

Imagery should carry content, identity or useful atmosphere.

Do not add decorative imagery merely to fill empty space.

Repeated posters, thumbnails or media tiles within the same context should use consistent dimensions and aspect ratios.

Missing artwork must degrade gracefully without breaking the information hierarchy.

## 25. Motion and hover

Hover effects should be subtle. Hover should clarify interactivity rather than animate the interface.

Small fades or positional transitions are useful when they make state changes easier to follow.

Avoid:

- large movement;
- bouncing;
- perpetual animation;
- theatrical transitions around routine controls.

Respect reduced-motion preferences.

## 26. Accessibility as usability

Use semantic controls and headings.

Ensure:

- keyboard operability;
- visible focus;
- meaningful accessible labels;
- sufficient contrast;
- adequate touch targets;
- no essential information depends on hover;
- state is not communicated by colour alone;
- focused elements are not obscured.

Accessibility is part of the interaction design, not a final ARIA pass.

## 27. Central design tokens

Core visual values should come from central project tokens.

Centralise at least:

- base and raised surfaces;
- text colours;
- accent colours;
- semantic state colours;
- spacing scale;
- radius scale;
- typography roles;
- repeated control heights or target sizes;
- major layout width tiers.

Avoid arbitrary one-off spacing, radius and font values unless the composition genuinely requires one.

Do not add a one-off value simply because it is faster than using or extending the established system.

## 28. Reuse and consistency

Before creating a new visual pattern:

1. inspect the nearest comparable BookClub interaction;
2. reuse it when it serves the same purpose;
3. extend it when the task genuinely needs more;
4. create something new only when the established pattern cannot serve the task.

Existing BookClub consistency takes precedence over generic style preferences unless the current task explicitly authorises a change.

Do not copy a component merely because it looks similar if its semantics are different.

## 29. Admin and developer controls

Admin and developer functions should normally live behind an explicit admin/developer area or disclosure.

They must not compete visually with ordinary member tasks.

When a contextual admin control genuinely belongs on a screen, keep it visually subordinate.

Local developer tooling must remain clearly separate from member-facing workflows.

## 30. BookClub screen priorities

### Home

Centre Home on a responsive current-turn card: heading and effective avatar/identity on the left; a right-aligned, bottom-aligned vertical action stack on the right. The viewer’s own turn uses “It is your turn” and a straight external selection bar beside the indented card, matching desktop navigation. Plan in Builder and Use from Builder are ordinary secondary actions, in that order. Record an event is the constructive primary action and always bottom-most. Its full label and icon stay on one line with ordinary 15px type, 12px inline padding and a 46px touch target. Below 720px give actions their intrinsic width beside the flexible identity; below 375px stack identity above the right-aligned action column to avoid collisions or page overflow. The Watch Order shortcut is CLSC-only, above Record an event. On their own turn, viewers may choose a private Builder set to prefill only the films of a new Event in saved order; the set remains private and untouched. Current-turn swapping lives on Admin, with no swap control on Home.

Do not let recent history, admin swap, developer tools or secondary widgets compete with that orientation. Home reads Current turn, Last turn / Next Classics, then Quick facts, Club timeline and Classics snapshot, with no snapshot shortcut; Next Classics retains its View all link. Current turn and Home Next Classics cards share Last turn’s faint asphalt-dark border. All nine Home statistic cells use 16px left padding on mobile and 32px from 720px, preserving equal tracks and responsive typography. Home Last turn and History film rows use a single 4px title-to-metadata gap. The Classics stat strip uses straight divider lines with square segment edges; Missing answers has no icon. Quick facts shows all-time Events, Films brought and Average IMDb in the same large-number/small-descriptor style and three-segment strip as Classics snapshot. Club timeline uses that same strip for inclusive local-calendar Days active since 5 July 2020, Cycles completed (the latest completed chronological cycle ordinal, using recorded completion/import evidence despite historical gaps) and appearance-weighted known-runtime Watch time as unbounded hours and two-digit minutes (`862:46`). Last turn places the event heading before its subordinate concise date (Cycle started <date> for approximate dates), no film count, stored host’s “<Name>'s turn” or “Classics week”, and identity docked at the top-right. Film order uses larger primary-text # markers. Next Classics shows only the top two eligible, rankable films with larger primary-text # ranks, a coherent text column beside the fixed-size poster: title, year/runtime, known director (omit when unknown), then one Seen/Haven't/Unknown count line. The metadata column reaches at least the poster height, with Seen/Haven't/Unknown aligned at its lower edge for short identities. The shared compact genuine-source flex row sits beneath the film identity; status pills, member names, residual scores and score breakdowns are omitted on Home only.

### History

Prioritise scanning and understanding past nights.

Host, date precision, film order and cycle context should remain clear.

History defaults to newest cycles first with higher-to-lower event positions. Re-sort sits beside the first visible cycle heading, reverses cycles, events and jump options together while preserving each event’s stored film viewing order, and resets to page one. Its sort direction survives host filtering and temporary History film inspection through App memory, resetting on another main destination or reload. History paginates the selected cycle order at five cycles per page, with identical Previous / Next and page indicators above and below the cycles. Actual-host filtering resets to page one; cycle jump opens the containing page before scrolling. Ungrouped events follow the last page and do not count as a cycle. Keep one two-column event header: week heading above the subordinate date/context on the left, and Edit, Audit, restrained destructive Delete, then stacked host/Classics avatar and name on the right. The right group stays in one non-wrapping row at every width, retaining control sizes and gaps. The left text block takes the remaining width and may wrap, including its date/context, to avoid overlap or horizontal overflow. Do not repeat identity below the week heading. Edit is available to admins or the stored actual host; Audit and Delete are admin-only. Delete uses the shared native application dialog, identifying the event/date/films and preserving the restore and unchanged-rotation explanation; Cancel/Escape restore focus and mutation-busy state guards closure/repeated deletion. Show Audit only when catalog evidence indicates a recorded audit trail; details load on demand beneath the card and reuse loaded evidence. History films use one stacked full Film Detail link per film in viewing order: a larger primary-text # marker, poster, then title above subordinate year/runtime and known AU classification, separated by middle dots without an Unknown placeholder. Show a known director below year/runtime, omitting the line when unknown. History film titles match the event heading size without changing titles elsewhere. Hosted headings use the stored actual host’s “<Name>'s week”; Classics uses “Classics week”. Cycle context reads “Cycle starting: <date>” at the left edge with that cycle’s recorded hosts at the right edge in canonical chronological event positions, separated by aligned Lucide ArrowRight icons; host filtering does not rewrite the cycle context, and missing hosts/positions remain explicit, wrapping to right-aligned lines on narrow screens. History headings omit film counts and label approximate dates “Cycle started <date>”.

### Metrics

Prioritise visual comprehension and comparison. The outer Metrics stack adds 1rem to the normal section gap; internal card and chart spacing retains the shared rhythm.

Charts are encouraged where they reveal patterns better than text alone. Metrics remains one route with global identity filters immediately above five category tabs: Top 5, Tastes, Breakdowns, Records and Staging. Only the selected panel renders its reports; identity changes preserve the category. Default to Top 5 on mount, with in-memory state only. Use the shared tab-control label role, transparent surface, hover emphasis and inset straight focus-token underline as Classics tabs, without icons. The intrinsic-width strip scrolls horizontally rather than wrapping at narrow widths, keeps 44px touch targets and visible keyboard focus, and supports arrow keys/Home/End. Metric assignments and theme eligibility belong in DATA.md.

Top 5 uses balanced equal-width Critics / Audience controls for each ranking (Critics initially), and IMDb / All audiences for both popularity lists (IMDb initially). Both vote medians remain visible independently of selection. Score and popularity selectors sit inline with their dynamic report headings and wrap deliberately at narrow widths. All four lists share a 64×96px poster, flexible information column and intrinsic-width right identity column with stacked avatar/name. Keep title, metadata, known director, Cycle X · Film Y context and final composite /100 or vote measure inside the information column; titles never span beneath the identity. Exact non-imported event dates retain their context; missing posters use the shared fallback. Row dividers remain, with no extra group border between reports.

Use flat sections and quiet dividers. Genre fingerprints use dual coloured Brought and neutral vs. Club bars, with jeans/lavender contributor colours alternating in ALL and no supplementary appearance-count/percentage detail; bars are normalised to the larger share. Theme fingerprints use vertical, palette-coloured word lists of the twelve most frequent eligible keywords per identity (or fewer when unavailable), sorted by descending occurrence count then displayed name and identity, with humanised labels and club ratios. Ratios are display information, including values below 1.0x; there is no club-appearance minimum or expansion for cutoff ties. The explanation is exactly “Most frequent keywords for each boob.”; lowercase single words and slugs start with a capital. Omit theme coverage labels, the global all-time/host/repeat summary and Popularity & obscurity appearance coverage. Release decades use one stacked bar. Most common uses the full decade (2010s); each legend entry stacks a colour swatch, abbreviated decade reference and percentage on three separate rows, without separator dots. Unknown remains explicit. Top 5 talent, studios and production countries use compact text/data rows without graphical bars and show five plus every fifth-place count tie. Talent retains all Role options and its appearance-share explanation. Lists above twenty results use twenty-row Previous/Next pages with full counts; film-extreme lists above twenty use five films per page. Small lists remain together, ratio numbering stays global, and pagination makes every tie available. Genre fingerprints use horizontal bars with sentence-cased lowercase slugs and preserved natural provider text. Australian classification uses one legend above five aligned contributor rows of 100%-stacked bars. Each distribution divides by that contributor’s total active appearances, including missing classifications. Other/Unknown combines both buckets using Unknown’s colour. Show percentages inside segments only at 5% or above; smaller segments retain percentage descriptions in the accessible bar label and title. On narrow charts, small eligible labels rotate within their segment to remain legible. Empty contributors show No film appearances. Identity filtering shows only that contributor with no CLUB row. The diversity reports retain aligned comparisons with distinct counts and no coverage copy. Top 5 contains, in order, highest scores, lowest scores, most popular, most obscure, talent, studios, highest revenue / budget ratio, lowest revenue / budget ratio, production countries and Top 5 non-English original languages. Ratio lists retain title links, year and reported amounts, without unique-film coverage copy. Multipliers use thousands separators and one decimal; ratios below one in the lowest list use reciprocal division (1 ÷ 40.0). Years remain ungrouped. Ratio rows have a non-wrapping aligned rank column and separate stacked Reported budget USD / Reported revenue USD label/value rows, with right-aligned full amounts and thousands separators. Breakdowns contains Contribution by host, Release decades, Genre detail, Australian classification, Median reported budget / revenue and Ratings profile, in that order. The financial comparison is one chart with aligned contributor labels, touching carrot Budget bars with USD labels above and grass Revenue bars with USD labels below, plus one shared numeric USD X-axis. Its maximum is the greatest valid median budget or revenue across all five contributors and never changes with the identity filter; ALL shows five groups and an identity selection shows one, without CLUB. Keep the finite meaningful median revenue/budget ratio or unavailable label. Ratings profile remains complete and final on Breakdowns. The Top 5 language ranking excludes English and missing original languages, counts distinct canonical active-History films, retains fifth-place ties and scales horizontal jeans/lavender bars in rank order relative to the leading language; labels use readable names and formatted film counts. Talent and Production countries omit coverage labels. Role controls retain normal field styling and touch targets. Tastes contains Genre fingerprint, Theme fingerprint, Production countries, Original languages, Directors and Recurring cast, in that order. The latter four retain a responsive paired grid without a nested tab wrapper or extra section divider. These diversity comparisons alternate jeans/lavender in contributor order. Diversity report titles have concise per-ten explanations. Rating-source selectors use a spanning, non-wrapping scroll strip with an active underline. Rating-source axes always use exactly ten ten-point circles, including neutral unfilled circles, with clipped proportional fractional fills and retain fixed order and visible mean and median, with full names accessible. Semantic CSS bars always retain exact visible values; theme word-list colours cycle through the approved palette in displayed order after sorting; other category palette mappings stay stable as filters change. Pair comparisons, Top/Bottom and Popular/Obscure at wider content widths. Popular/Obscure film rows use full-width straight dividers with square edges. Genre detail insets the first column 1rem from the left and the last column 1rem from the right, preserving sticky headers and fixed row heights. Film-based Records eligibility derives exclusively from qualifying active, non-deleted History appearances for the selected identity, deduplicated by canonical film ID. Removing the last qualifying appearance removes a film immediately after committed History reconciliation; another qualifying appearance retains eligibility. Catalogue, Classics membership and cached enrichment alone never confer eligibility. Replacement films use canonical metadata and every genuine tie remains represented. Records uses a two-column grid when space permits, collapsing to one column without shrinking text; film cards keep poster/title links, release year and known director; categories run Top critic, Top audience, Bottom critic, Bottom audience, Oldest, Newest, Longest, Shortest, Most popular, Most obscure, using highest and lowest positive IMDb vote counts and showing all ties. Film and creator headings use primary neutral text; creator role words are heavier than “Most recurring”; inset every sub-card by standard symmetrical spacing; creator cards retain, smaller non-bold secondary count/tie metadata and readable names without dedicated coverage rows; every genuine tie remains available through its result pages. Charts respond to available content width beside either navigation drawer state; colour is never the only label. Data/resolution/counting rules belong in DATA.md.

Global maintenance controls live on the authenticated admin-only `#/admin` screen, which is available to admins through their Account menu and stays out of primary navigation. Contribution by host shows Films brought only, alternating jeans and lavender bars by item order; calculations remain unchanged. Use accessible comparisons from stored data with exact values and explicit missing-score coverage.


Staging contains independent flat report sections with concise definitions and sample sizes. Cycle scorecards use paired rose Critics and lavender Audiences bars on a fixed 0–100 scale, with a focusable vertical region fitted to the latest five complete cards; every earlier complete cycle remains scrollable. Release-year intervals show mean ± population standard deviation; runtime intervals show observed min/max. Both retain a contrasting mean marker and a shared full-club axis when filtered. Contributor reception uses fixed −100% to +100% diverging rose/lavender bars and a net marker, with counts and neutral ties written out. Heatmaps retain all five contributors, sticky row labels and contained keyboard-accessible horizontal scrolling on narrow screens; identity filtering emphasises the selected row/column. Every cell has pairwise text details. Awards use a compact accessible data table that becomes labelled stacked rows below 500px content width. Keep numeric alternatives and missing states visible, and paginate long lists with existing MetricsResults rather than clipping or discarding ties. Staging presentation belongs to frontend/metrics/staging/ and frontend/styles/metrics.css; calculation definitions belong to DATA.md.

Records pairs Most aligned/Most misaligned critics and audiences immediately after the four score records, and Most/Least Classics viewed after the creator records. Retain existing film and creator reports, responsive two-column layout and every exact tie. Classics viewer records explicitly compare the four humans across one fully answered candidate pool independently of the contributor filter.

### Classics / Watch Order

Make ranking, state and comparison easy to scan.

Signed-in members with writes enabled can use Add Classic. Its modal retains one replaceable selection with poster, title, year/runtime, persisted director and available overview in the normal light prose style. Show a ruby Already listed! status for existing membership, otherwise We've seen it! for active History or all active members explicitly Seen; these states have no Add Classic action. Eligible confirmation closes the modal and patches the catalogue immediately. TMDB selection previews without importing; confirmation resolves the canonical movie and rechecks eligibility.

Ranked, Unranked (the existing Needs Data group) and Seen remain distinct, with text labels and no tab icons. Only Unranked shows a count badge, hidden when its count is zero. Desktop Classics navigation has no count badge. Desktop Seen navigation shows only the authenticated viewer’s canonical Missing answers count, shared with Home and the Seen queue and respecting active History precedence. Hide it at zero, display 1–99 exactly and cap at 99+ from 100, with the uncapped count and singular/plural meaning in the link’s accessible name. Keep the compact rose count visible and aligned in expanded and collapsed drawers; the mobile dock has no badge. Preserve the local Classics Unranked filter count and eligibility predicate. Ranked paginates 20 films; the other tabs paginate 10, resetting on tab changes and clamping after list changes. Ranked numbers remain global, white # markers. Unranked sorts descending by raw score plus the stable seed tie-break, without a Seen multiplier; films without usable ratings follow scored films. Its displayed details remain unchanged. Contextual admin removal buttons use a -0.5rem left offset. Watch Order recognises IMDb, RT audience, RT critic, Letterboxd, Metacritic critic and TMDB. All values use /100; missing dimensions use the available-score arithmetic mean only during ranking. At least one genuine rating and complete active-member Seen answers are required. Compact responsive rows show only genuine source scores, Seen/Haven't/Unknown counts with active Unknown members’ current names in member order, and known director beneath year/runtime; status pills, residual scores and breakdowns are omitted on these tabs. The same shared concise source control is used across Home, Classics, Film Detail and Seen. Classics places source scores below the compact identity, with space reserved in preceding metadata for the absolute help target. Its absolute 44px help target remains above the scores, with the visible icon at the right content edge and its lower edge aligned to Home’s Seen/Haven't/Unknown metadata. It never displays missing-source warnings, available-score-average notices or imputed values; ranking/imputation explanation belongs only in Film Detail’s separate detailed Classics score breakdown. The shared source control presents genuine ranking and optional informational ratings in this order: IMDb, LB, MC-U, RT-A, TMDB, Trakt, Ebert, MC, RT-C. A thin vertical divider precedes the first available critic source (Ebert, MC or RT-C) when an audience/user source is also present, including when adjacent sources are absent. The divider sits halfway across the visible gap between the adjacent audience/user and critic items, recalculating with responsive spacing. When the critic item wraps onto a new line, the divider stays attached within its leading padding. MC is Metacritic critic; MC-U is Metacritic user; Ebert is Roger Ebert. Optional ratings never enter Watch Order. Absent sources and imputed values are omitted. Six or fewer rendered sources retain inline label/value pairs in a full-width, baseline-aligned flex row with space between items, wrapping whole pairs only when necessary to avoid narrow-screen overflow. Above six, each intrinsic-width flex item centres its label above its /100 score; columns have no equal-width growth or boxes. Keep metadata typography and economical gaps; wrap columns only when available width requires it, retaining every source without page overflow. Full provider/metric names remain in accessible labels and titles. Every rendered SourceScores summary anchors its subordinate named Info button absolutely above-right with a small negative offset, outside the wrapping score row and without a dedicated layout line. It opens the shared native Score abbreviations dialog, listing every sourceRatingKeys entry in canonical order as Abbreviation, Source, Native and Normalised. Expand IMDb to Internet Movie Database and TMDB to The Movie Database. Explicit native scale/step descriptions produce hypothetical examples one valid increment below the maximum, with exact normalised percentages; these examples never change aggregate precision or parsers. Show all four columns from 720px and only Abbreviation and Source below 720px, without horizontal scrolling. No scores means no help control; full-text score presentations do not gain one. State controls form one equal-width, non-wrapping horizontal strip of semantic buttons, with a straight accent bar beneath the active tab and no selected box. Classics state labels use the 16px body text role, while other tabs retain their standard label role; touch targets remain at least 44px tall. Row bottom padding matches the gap from the divider to the following poster (the list gap plus row top padding). Below 720px, Classics row film titles use 75% of the shared movie-title size; poster and rank geometry stay unchanged. The Unranked count uses a compact rose pill, capped visually at 99+ with full accessible counts. All tabs retain full counts in their accessible labels and titles. Bulk maintenance lives on the admin-only Admin screen; Classics tabs contain no maintenance panel. Film Detail has no membership, provider maintenance or technical identifier controls; score maintenance lives globally on Admin. Populate missing scores collects all recognised returned MDBList ratings for films with unresolved missing inputs; conclusively unavailable dimensions wait for an explicit Refresh scores, Refresh scores checks all distinct Classics/History films and may reorder Ranked, and Enrich/Refresh Metadata updates available IMDb year/runtime/director/genres. Show batch progress, saved partial results, identity gaps, provider failures/cooldowns and Stop after this batch. Maintenance uses explicit actions only.

### Admin

Only authenticated admins can view `#/admin`, through the Account dropdown. Swap current turn remains the first card with its existing eligibility and feedback. Two flat section headings follow: **Populate missing data** and **Refresh all data**. Each section starts with its aggregate card, then five individual cards in order: scores, OMDb metadata, TMDB metadata and artwork, TMDB enrichment, MDBList enrichment. Use ordinary quiet card borders, Sentence case, metadata-role descriptions and counts, and compact Data collected and safeguards disclosures. Aggregate actions require a native confirmation showing films, film/provider work units, BookClub batches and estimated upstream request ranges. Zero-work actions are disabled.

All twelve actions use one synchronous maintenance lock, frozen provider work and credential-free checkpoints. Individual actions stay independent; aggregates coordinate overlapping provider responses. Progress shows the current provider, completed/total film/provider work units, remaining work, measured requests, updated/no-change/failed counts and safe quota/retry feedback. Pumpkin covers active, successful and voluntarily stopped runs; ruby marks interrupted failures, cooldowns, transport errors and invalid responses. Stop after this batch completes the safe current batch and retains accepted work. Resume reconciles pending work with current identities and durable successful checks without adding new films. One final catalogue reconciliation runs when canonical metadata/identities/scores changed; coverage is reread after completion/Stop/failure and Metrics enrichment is invalidated when its cache changed. No job starts on mount or navigation.

### Builder

Prioritise optimistic draft creation and the path from adding films to Use set. New set is an intrinsic-width constructive action beside the Builder page heading on the list. Saved set cards appear from oldest creation date to newest; edits do not move them in this order. They show up to their first four canonical posters below their count/notes and above Open set (Lucide Film icon), at 126px wide (189px tall), evenly distributed with a single poster centred; wrap the strip on narrow screens. Each poster has a centred, single-line canonical film title below it, using metadata-size white text at weight 500 and ellipsis for overflow.

Use a bounded, centred vertical editor on desktop. Film additions, removals and moves update immediately and enqueue background autosaves; title typing stays local until the changed field blurs. The editor omits the private note field; existing stored notes remain preserved when a set is edited. The first such action creates a new record. Serial saves coalesce edits and adopt each returned revision without replacing newer text or refreshing the list. Failures preserve dirty drafts for the next edit or Save set retry. Save set flushes the latest draft and returns to All sets; All sets remains responsive during background saves. The editor action row keeps All sets left-aligned and Delete set, Use set and Save set in that order in a right-aligned group. Delete set appears only for an existing set, with its confirmation immediately below the row; there is no bottom deletion section. Narrow layouts wrap the groups and actions while retaining readable labels and accessible targets. Use set is disabled unless the viewer is the effective active member for the current human turn, including swaps; empty sets also remain disabled. Use set flushes before confirmation and again before publication, using the final persisted revision. Private-set deletion retains its revision-aware inline confirmation. Builder hides manual film creation only in its picker; direct-add result Plus buttons use emerald with black foreground. Lineup rows place strong # markers before posters and dock up/down/trash in a right column, stacking those controls vertically at narrow widths while titles wrap.

Search identity opens normal Detail/Preview while the same Builder editor and picker remain mounted and hidden, preserving the private title, ordering, query, results and page. Only Builder-search inspection shows an intrinsic-width Plus / Add to set action in the page-heading action area. It confirms the canonical saved movie or explicitly imports a TMDB candidate, then returns to the editor and uses the shared accepted-selection reset. Repeated films remain permitted. Failed inclusion stays on detail with local retry feedback; returning without inclusion preserves search.

Use set availability follows the shared effective member after swaps. Other-member turns, Classics, missing rotation and unresolved/inactive members disable Use set. Its confirmation retains normal Actual host copy.

Advanced or unusual options should remain disclosed.

### Seen

Prioritise repeated low-friction answering for the authenticated viewer only: unanswered Classics films and personal Yes/No. Queue identity stacks year, runtime and persisted director below the title; use “HAVE YOU SEEN...” without member or Unknown badges. The shared genuine-source score flex row sits immediately above the plot, omitted when no genuine sources exist. Existing plot summaries sit below the linked identity and above Yes/No, without a nested card. Initially show a fixed three-line clamp with compact More/Less disclosure outside the link; the expansion preference persists as films advance during the mounted visit. Omit the plot block when overview is absent.

Answers and corrections update the local catalog and Recent answers immediately. Background Seen writes use one App-owned FIFO request at a time; pending saves never disable the next Yes/No buttons and have no transient status label. Keep failed latest answers visible with named manual retry controls and preserve later queued answers. Reconcile saved MovieDetail data while preserving newer local intentions. Undo has no rendered control; the application-layer null-write capability remains supported.

Yes and No retain equal geometry and accessibility, with solid mint Yes and ruby No buttons and black icons/text. Use catalogue films directly without detail reads. Preload the actual large poster URLs for the next three unanswered films in queue order, deduplicate by URL and retain image objects as the queue advances. Refill from the back; image failure preserves the normal Poster fallback. Recent answers contain current-visit activity in recent-first order, five per page; bottom-only Previous, page indicator and Next controls appear above five entries, and new answers return to page one. Recent answers provides visible correction controls without a redundant correction instruction. Keep its THIS VISIT overline, empty-state text and pagination. The All caught up card retains its explanatory message without an Explore Classics shortcut.

### Event create/edit

Use details → ordered films → completion as the essential Event reading order. Save follows the workflow without a review summary. The first card contains only Actual event date and “Complete the current turn”, checked by default for new events. Editing reflects stored completion without advancing rotation. Host is not selectable: new Events derive hosted identity from the effective active human assignment; ordinary position 5 is hostless Classics, while the exceptional Classics-first cycle has hostless position 1 and Sean hosted at position 5. Unchecking completion does not change identity. Corrections preserve stored historical host and kind; historical date controls remain disclosed. Event titles, notes, swap explanations and turn-helper prose are absent. Field errors preserve input and focus the first invalid control.

Find a film uses a programmatically named Search films input without a redundant visible label, and a content-sized, right-aligned Search button. Enter submits normally. Show at most six candidates per page; render Previous / Next and Page N of M only when there is more than one page, without an empty pagination row. Whole-title matches after whitespace/case normalisation and removal of at most one leading A or The suppress weaker contiguous-substring results; year text is not a title match. Each linked result uses the compact film-information hierarchy with available runtime/classification and known director, retaining the existing unknown-year/no-poster fallbacks. Inspection keeps the Event or Builder editor and its search mounted, preserving all draft fields, lineup order, query, results, pagination and manual input. Builder prefill seeds once in exact saved order; incomplete or unavailable sets cannot be used.

Shared search marks canonical saved results present in active History with a ruby-outlined, ruby-text `Seen it` badge on the title line, separated by a deliberate horizontal gap. The background remains transparent and the intact badge may wrap below a long title. Explicit Seen votes do not establish History; unsaved external results have no History label. The badge is informational and repeats remain selectable across Builder, Event and Add Classic. Catalogue replacements supply current History evidence without separate picker state.

Accepted film inclusion clears the shared picker query, results and pagination and returns focus to the empty search field. Builder direct additions and Event Yes confirmation retain their ordered multi-film semantics, including repeated appearances; inspection cancellation preserves the search. Add Classic uses the same reset with a single replaceable selection. Linked result/lineup Film Detail navigation stays separate from selection.

Backfill, current-turn completion and correction semantics must remain truthful.

### Film detail

Lead with film identity, Seen state, ratings and shared appearances. Rough dates read ‘Cycle started <date>’. Appearances use “<stored host name>'s week” or “Classics week”; never infer the host from nominal position. Seen state is a read-only two-column summary shown only for Classics candidates or films with History appearances. Any active History appearance means authoritative Seen=1 for every active member, placing all active members in Seen it and none in Haven’t. Publication, correction and restoration persist this evidence; personal No/null writes cannot undo it while active History exists. Unscreened Classics use explicit answers: Haven’t (explicit No) and Seen it (explicit Yes), with a divider and existing stacked avatar/name identities in member sort order. Unanswered members appear in neither column. Detail entered from Seen shows Back in the heading row and preserves the personal queue and Recent answers context; ordinary Film Detail and Preview show a heading Back action when specialised inspection actions are absent. Return to the trustworthy same-app origin with mounted drafts, filters, pagination and scroll preserved; direct entry or reload falls back to Home. Keep this context short-lived and application-owned.

Saved Film Detail keeps the backdrop and side-by-side poster/core metadata, with muted runtime in hours/minutes instead of a separate year. The shared genuine-source score flex row sits immediately above the overview, including outside Classics when genuine stored sources exist. The weight-300 overview spans the full card beneath both columns, followed by a fit-content informational pill. Classics candidates show “Classics candidate”; other films show “Brought by <name>” using unique stored hosted-History participants in member order, including former participants. Multiple names use “Sean and Troy” or “Sean, Troy and Jess”, without a comma before “and”. Omit the pill when no participant can be identified. Seen has no parent heading; its left heading/member bundle aligns left and its right heading/member bundle aligns right, preserving member order. Each side starts at the larger intrinsic width of its heading or complete member bundle, then receives half the remaining space, placing the full-height divider midway between the bundles. Members wrap only when the combined content and normal divider spacing cannot fit, retaining each side’s alignment.

Classics score appears only for Classics candidates with ranking data: six full provider labels in IMDb, Letterboxd, Metacritic critic, RT audience, RT critic and TMDB order. Genuine inputs display integer /100; missing inputs show a dash with “average used” only when ranking supplies an imputed value. The collapsed Score breakdown groups Scores (including missing/imputed inputs), Modifiers (Unseen multiplier only) and Crunchy math (Sum of Squares of Scores (SoSoS) and SoSoS × Modifiers (residual score) from rawScore/residualScore). It omits the score hero, counts and warning summary. There is no separate Ratings, membership, per-film maintenance or technical provenance section.

Only Event-search inspection shows “Nope, this isn't it” and the stronger “Yes, this one!” on the right of the Film detail heading. Nope and browser Back return to the preserved editor without removing the candidate. Yes appends a saved canonical movie, importing an external candidate only at confirmation; recoverable import errors stay inline on detail. External previews retain their year/runtime and overview beside the poster; the saved Detail variant does not change Preview. Previews omit stored-only sections. External films are not persisted before accepted confirmation. Builder-search inspection instead shows Add to set and uses the same canonical confirmation handoff and picker reset; ordinary Film Detail has neither inclusion action.

Saved Film Detail is informational; global score/provider maintenance remains on Admin.

### Avatar onboarding

Keep the choice focused, obvious and recoverable. Offer available avatars in a horizontal native scroll-snap carousel. Initially centre and nominate the third available avatar, or the last available avatar when fewer than three remain. The centred avatar is nominated and committed by Choose and continue; tapping an option centres it. Load availability once per interaction, with claim collisions using the normal error path. Hide the scrollbar on mobile and keep it slim on desktop. Group actions on the right with Log out followed by Choose and continue. Use restrained selection emphasis and respect reduced motion.

### Data attribution

Retain the shared Data sources & attribution disclosure with its label, body text and Info icon at half their previous size, without a horizontal divider above the footer. Preserve the disclosure touch target. Attribution spans the available content width. Expanded attribution is one compact text block with line breaks between the ratings notice, TMDB disclaimer, linked TMDB logo and MDBList/OMDb links; use tight line spacing without paragraph gaps or tall link rows.

### Authenticated header

Use the canonical `assets/source/newFav/fav1.png` artwork through its generated `favicon.png` (32px) and `newFav/fav1.png` brand derivative (96px), displayed at 45×45px beside the title, preserving existing typography and placement. The visible title is exactly “Book Club” on Home; on every other route, including Admin and direct loads, it selects an ephemeral anagram from the fixed 18-title pool in `frontend/app-shell-title.ts`. Selection occurs only on initial non-Home entry or a changed hash-route page, remaining stable during ordinary rerenders. Keep the small tagline “HAVE YOU UPDATED THE SPREADSH... WEB APP?”. The existing avatar and uppercase member name form a button that toggles a compact Account dropdown. Admin viewers see an Admin link above Logout, navigating to `#/admin` and closing the dropdown; other viewers see only Logout. Outside clicks, leaving the account controls with keyboard focus, and Escape dismiss it; Logout uses the existing session behaviour.

### Sign-in

Keep the private-club context brief and make sign-in obvious. The Google GIS render target is a transparent structural wrapper with no border or padding; retain the Google control width aligned with the card content and leave Google-rendered styling unchanged.

### Developer tools

Local development tools live only on `#/admin` in normal local development, excluding production and import-preview. Closed disclosure is a quiet utility; expanded tools retain explicit local replacement confirmation. Member switching and database replacement use the full auth-aware bootstrap reload. The local disposable database indicator uses straw text/icon as an absolute overlay at the top-left of the application wrapper, outside main and page headings, without adding layout space. Shared mandarin and straw aliases resolve to the canonical pumpkin and sunflower palette tokens.

## 31. Anti-patterns

Avoid:

- everything becoming a card;
- heavy borders around every section;
- nested boxes used instead of hierarchy;
- arbitrary one-off spacing and radii;
- rows of equally prominent actions;
- filters styled like submission buttons;
- unnecessary explanatory copy;
- giant illustrated empty states;
- decorative shadows and gradients;
- success messages for every obvious state change;
- tiny mobile targets;
- major destinations hidden unnecessarily;
- mobile layouts merely stretched across desktop;
- wide forms filling available space without reason;
- one-off component aesthetics;
- admin/developer controls competing with member tasks;
- UI cleanup outside the authorised task scope.

## 32. Required rendered review

For every meaningful interface change:

- run the application;
- inspect the complete screen;
- inspect representative mobile and desktop widths;
- inspect intermediate widths when the layout changes there;
- use populated data where authorised and practical;
- check long content and missing artwork where relevant;
- scroll the whole page.

Source review alone is not proof of good layout.

Before completion ask:

- Is the user's goal understandable?
- Is the intended visual identity intact?
- Is there an obvious primary action where one should exist?
- Is the whole screen balanced?
- Is the layout comfortably spacious rather than cramped?
- Are alignment lines strong?
- Are cards and borders doing real work?
- Are mobile targets large enough?
- Is desktop intentionally composed?
- Are secondary, destructive, admin and developer actions subordinate?
- Are loading, empty, error and success states appropriate?
- Is the copy concise?
- Does the result remain consistent with BookClub?
- Did the task accidentally expand into unrelated cleanup?

If the screen technically works but still feels assembled rather than designed, the task is not finished.

## 33. Document maintenance and relationships

Update this authority in the same pass when an explicit lasting UX decision changes, or when other work reveals drift. Preserve BookClub-specific decisions; do not replace them with a generic starter. Remove stale rules rather than append competing ones. Product/data behaviour belongs in [DATA](docs/DATA.md) and [CONTRACTS](docs/CONTRACTS.md); rendered verification policy belongs in [TESTING](docs/TESTING.md). The [style decision register](docs/audits/STYLE_UNIFICATION_DECISIONS.md) records semantic families and justified exceptions; the original label inventory/CSV remain immutable before-state evidence. The dated [UI audits](docs/UI_AUDIT_POST_ALIGNMENT.md) are reference evidence, not current design authority or permission to implement their recommendations.
