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

BookClub should use a small approved spacing scale.

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

Flat composition is the default.

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

Nested cards should be uncommon.

BookClub may use pills and badges fairly freely for compact metadata, state and category presentation, provided they improve scanning and do not become visual noise.

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

BookClub uses Lexend Deca Variable for interface text and numbers unless explicitly redesigned.

Keep the hierarchy small.

Use a limited set of text roles:

- page title;
- section heading;
- item title;
- body;
- metadata;
- helper text;
- warning or error.

Prefer weight, size, spacing and contrast over many different font sizes or decorative treatments.

Uppercase text is acceptable sparingly for short identity elements, compact labels and established member-name treatment. Do not convert ordinary prose or controls to uppercase for decoration.

Linked film presentations use the shared movie-title typography role at approximately 1.5 times their base item-title size (or their existing larger title role). Keep year/runtime metadata subordinate. The full film identity container, including its poster and supporting metadata, is a native Film Detail link with visible hover and keyboard focus treatment; independent actions remain outside the link. Do not use decorative Eye icons to indicate Film Detail navigation. Informational film displays remain unlinked unless navigation is already intended.

Use Australian English throughout the interface. Possessive member display names ending in s or S take only an apostrophe (Jess’ week); other names take ’s (Sean’s week).

## 12. Copy and microcopy

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

Errors should state what happened and what the user can do next.

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
- Seen It?;
- Metrics.

Mobile retains fixed bottom navigation with safe-area space. At 720px and above, desktop uses a collapsible side drawer with visible destination labels when expanded and named icons with focus/hover explanations when collapsed. Content reserves the drawer width; component state is sufficient. The expanded collapse-control row also shows a small, randomly selected bundled fav image that collapses the drawer when clicked; it is hidden when collapsed.

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

Forms should be staged around the task.

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

Centre Home on a two-column current-turn card: heading and effective avatar/identity on the left; a right-aligned, bottom-aligned vertical action stack on the right. The viewer’s own turn uses “It is your turn” and a straight external selection bar beside the indented card, matching desktop navigation. Plan in Builder and Use from Builder are ordinary secondary actions, in that order. Record an Event is the constructive primary action and always bottom-most. The Watch Order shortcut is CLSC-only, above Record an Event. On their own turn, viewers may choose a private Builder set to prefill only the films of a new Event in saved order; the set remains private and untouched. A full-width Admin · swap current turn disclosure sits below the columns for human turns only, with one eligible future member selector and Swap turns; no generic rotation editor.

Do not let recent history, admin swap, developer tools or secondary widgets compete with that orientation. Home reads Current Turn, Last turn / Next Classics, then Classics Snapshot with a right-aligned View all link to Classics. Current Turn and Home Next Classics cards share Last turn’s faint asphalt-dark border. The Classics stat strip uses straight divider lines with square segment edges. Last turn uses a concise date (Cycle started <date> for approximate dates), no film count, stored host’s “<Name>'s turn” or “Classics week”, and identity docked at the top-right. Film order uses larger primary-text # markers. Next Classics shows only the top two eligible, rankable films with larger primary-text # ranks, Seen/No counts and the shared compact genuine-source flex row; status pills, Unknown counts, residual scores and score breakdowns are omitted on Home only.

### History

Prioritise scanning and understanding past nights.

Host, date precision, film order and cycle context should remain clear.

History defaults to newest cycles first with lower-to-higher event positions. Resort sits beside the first visible cycle heading, reverses cycles, events and jump options together while preserving each event’s stored film viewing order, and resets to page one. Its sort direction survives host filtering and temporary History film inspection through App memory, resetting on another main destination or reload. History paginates the selected cycle order at five cycles per page, with identical Previous / Next and page indicators above and below the cycles. Actual-host filtering resets to page one; cycle jump opens the containing page before scrolling. Ungrouped events follow the last page and do not count as a cycle. Keep one two-column event header: date/context above the week heading on the left, and Edit, Audit, restrained destructive Delete, then stacked host/Classics avatar and name on the right. The right group stays in one non-wrapping row at every width, retaining control sizes and gaps. The left text block takes the remaining width and may wrap, including its date/context, to avoid overlap or horizontal overflow. Do not repeat identity below the week heading. Edit is available to admins or the stored actual host; Audit and Delete are admin-only. Show Audit only when catalog evidence indicates a recorded audit trail; details load on demand beneath the card and reuse loaded evidence. History films use one stacked full Film Detail link per film in viewing order: a larger primary-text # marker, poster, then title above subordinate year/runtime and known AU classification, separated by middle dots without an Unknown placeholder. Show a known director below year/runtime, omitting the line when unknown. History film titles match the event heading size without changing titles elsewhere. Hosted headings use the stored actual host’s “<Name>'s week”; Classics uses “Classics week”. Cycle context reads “Cycle starting: <date>” followed by normal turn names separated by aligned Lucide ArrowRight icons, wrapping on narrow screens. History headings omit film counts and label approximate dates “Cycle started <date>”.

### Metrics

Prioritise visual comprehension and comparison. The outer Metrics stack adds 1rem to the normal section gap; internal card and chart spacing retains the shared rhythm.

Charts are encouraged where they reveal patterns better than text alone. Metrics remains one route with global identity filters immediately above eight category tabs: Overview, Top / Bottom, Fingerprints, General Interest, Averages, Taste Diversity, Economics / Standalone and Extremes. Only the selected panel renders its reports; identity changes preserve the category. Default to Overview on mount, with in-memory state only. Use quiet transparent tabs, active text emphasis and a straight focus-token underline. The intrinsic-width strip scrolls horizontally rather than wrapping at narrow widths, keeps 44px touch targets and visible keyboard focus, and supports arrow keys/Home/End. Metric assignments and theme eligibility belong in DATA.md.

Use flat sections and quiet dividers. Genre and Theme fingerprints use dual coloured selected and neutral club bars normalised to the larger share. Release decades use one stacked bar with a complete legend. Top Directors and Cast include at least five entries and every fifth-place count tie. Fingerprints use horizontal bars with sentence-cased lowercase slugs and preserved natural provider text. Language/classification use individual bars scaled to the largest category in each profile, actual share labels and explicit Unknown, and diversity uses aligned comparisons with raw counts/coverage. Economics / Standalone contains Top/Bottom reported revenue/budget ratio lists with title links, year, reported amounts and unique-film coverage, World cinema and Original-language profile. Averages retains separate budget/revenue median charts and Ratings Profile. Role controls retain normal field styling and touch targets. Median economics and all diversity comparisons alternate jeans/lavender in contributor order. Diversity titles have concise per-ten explanations. Rating-source selectors use a spanning, non-wrapping scroll strip with an active underline. Rating-source axes use ten-point circle glyphs with clipped fractional fills and retain fixed order and visible mean, median and coverage, with full names accessible. Semantic CSS bars always retain exact visible values; category palette mappings stay stable as filters change. Pair comparisons, Top/Bottom and Popular/Obscure at wider content widths. Popular/Obscure film rows use full-width straight dividers with square edges. Genre Detail insets the first column 1rem from the left and the last column 1rem from the right, preserving sticky headers and fixed row heights. Extremes uses a two-column grid when space permits, collapsing to one column without shrinking text; film cards keep poster/title links, creator cards use primary white titles, smaller non-bold secondary count/tie metadata and readable names without dedicated coverage rows; every genuine tie remains visible. Charts respond to available content width beside either navigation drawer state; colour is never the only label. Data/resolution/counting rules belong in DATA.md.

Global maintenance controls live on the authenticated admin-only `#/admin` screen, which has no navigation or Account menu entry. Contribution by host shows Films brought only, alternating jeans and lavender bars by item order; calculations remain unchanged. Top/Bottom 5 each have independent full-width scrolling underlined score selectors in IMDb, LB, MC, MC-U, RT-A, RT-C, TMDB, Trakt, Ebert order, defaulting to IMDb on mount, with full provider headings and selected native-scale values. Top/Bottom 5 metadata beneath the year reads “Cycle X Film Y”, prefixed by the event date only for exact dates outside imported cycles; approximate/unknown and migrated cycle dates are omitted. Ungrouped appearances show Film Y. Use accessible comparisons from stored data with exact values and explicit missing-score coverage.

### Classics / Watch Order

Make ranking, state and comparison easy to scan.

Signed-in members with writes enabled can use Add Classic. Its modal retains one replaceable selection with poster, title, year/runtime, persisted director and available overview in the normal light prose style. Show a ruby Already listed! status for existing membership, otherwise We've seen it! for active History or all active members explicitly Seen; these states have no Add Classic action. Eligible confirmation closes the modal and patches the catalogue immediately. TMDB selection previews without importing; confirmation resolves the canonical movie and rechecks eligibility.

Ranked, Unranked (the existing Needs Data group) and Seen remain distinct, using ListSortDescending, Library and Rows3 icons respectively. Ranked paginates 20 films; the other tabs paginate 10, resetting on tab changes and clamping after list changes. Ranked numbers remain global, white # markers. Watch Order recognises IMDb, RT audience, RT critic, Letterboxd, Metacritic critic and TMDB. All values use /100; missing dimensions use the available-score arithmetic mean only during ranking. At least one genuine rating and complete active-member Seen answers are required. Compact responsive rows show only genuine source scores, Seen/No/Unknown counts and known director beneath year/runtime; status pills, residual scores and breakdowns are omitted on these tabs. The same shared concise source control is used across Home, Classics, Film Detail and Seen It?. It never displays missing-source warnings, available-score-average notices or imputed values; ranking/imputation explanation belongs only in Film Detail’s separate detailed Classics score breakdown. The shared source control presents genuine ranking and optional informational ratings in this order: IMDb, LB, MC, MC-U, RT-A, RT-C, TMDB, Trakt, Ebert. MC is Metacritic critic; MC-U is Metacritic user; Ebert is Roger Ebert. Optional ratings never enter Watch Order. Absent sources and imputed values are omitted. Six or fewer rendered sources retain inline label/value pairs in a full-width, baseline-aligned flex row with space between items, wrapping whole pairs only when necessary to avoid narrow-screen overflow. Above six, each intrinsic-width flex item centres its label above its /100 score; columns have no equal-width growth or boxes. Keep metadata typography and economical gaps; wrap columns only when available width requires it, retaining every source without page overflow. Full provider/metric names remain in accessible labels and titles. State controls form one equal-width, non-wrapping horizontal strip of semantic buttons, with a straight accent bar beneath the active tab and no selected box. Labels use the body text size and icons remain compact while touch targets remain at least 44px tall. Row bottom padding matches the gap from the divider to the following poster (the list gap plus row top padding). Below 720px, Classics row film titles use 75% of the shared movie-title size; poster and rank geometry stay unchanged. Filter counts use compact grass, rose and mandarin pills, capped visually at 99+ with full accessible counts. Bulk maintenance lives on the URL-only Admin screen; Classics tabs contain no maintenance panel. Film Detail has no membership, provider maintenance or technical identifier controls; score maintenance lives globally on Admin. Populate Missing Scores collects all recognised returned MDBList ratings for films with unresolved missing inputs; conclusively unavailable dimensions wait for an explicit Refresh Scores, Refresh Scores checks all distinct Classics/History films and may reorder Ranked, and Enrich/Refresh Metadata updates available IMDb year/runtime/director/genres. Show batch progress, saved partial results, identity gaps, provider failures/cooldowns and Stop after this batch. Maintenance uses explicit actions only.

### Admin

Only authenticated admins can view `#/admin`; other viewers receive the ordinary not-found treatment. Keep Admin absent from all discoverable navigation. Use the normal shell and Admin page heading with stacked, distinct Scores and OMDb metadata and TMDB metadata and artwork sections. Preserve live counts, progress, Stop and aggregate run feedback. Score/OMDb maintenance shows provider details only for failures, including available cooldown/retry information; ordinary success/skipped notes remain hidden. Its native progress fill uses pumpkin with a neutral asphalt-dark track. Keep the score/metadata explanation brief and operational. Show concise counts of missing scores still eligible to check and checked scores with no source data. Apply returned score batches through onMovie and discard film detail; retain aggregate counters and bounded provider/status summaries, without per-film run logs. TMDB metadata batches retain aggregate counters and one failure summary. Freeze the catalogue candidate queue at run start, show local queue progress during the run, then recalculate remaining/identity counts from the one final shared-data refresh.

The separate TMDB enrichment cache and MDBList enrichment cache sections follow the existing maintenance sections. Each shows all-catalogue eligible/identity-gap counts, concise Refresh/Resume controls, processed/total/remaining and update/no-change/failure counts, the shared progress style, Stop after this batch and bounded local failure/quota feedback. All bulk provider actions share one frontend lock. Resume preserves completed work using the existing credential-free checkpoint format; Discard allows a fresh full crawl. Enrichment buttons may wrap labels at narrow widths. Shared catalogue refresh is needed only when canonical IDs changed.

### Builder

Prioritise optimistic draft creation and the path from adding films to Use Set. New set is an intrinsic-width constructive action beside the Builder page heading on the list. Saved set cards show up to their first four canonical posters below their count/Open set content, evenly distributed with a single poster centred.

Use a bounded, centred vertical editor on desktop. Film additions, removals and moves update immediately and enqueue background autosaves; title/note typing stays local until a changed field blurs. The first such action creates a new record. Serial saves coalesce edits and adopt each returned revision without replacing newer text or refreshing the list. Failures preserve dirty drafts for the next edit or Save set retry. Save set flushes the latest draft and returns to All sets; All sets remains responsive during background saves. Use Set flushes before confirmation and again before publication, using the final persisted revision. Private-set deletion uses a separate inline confirmation. Builder hides manual film creation only in its picker; direct-add result Plus buttons use emerald with black foreground. Lineup rows place strong # markers before posters and dock up/down/trash in a right column, stacking those controls vertically at narrow widths while titles wrap.

Search identity opens normal Detail/Preview while the same Builder editor and picker remain mounted and hidden, preserving private fields, ordering, query, results and page. Only Builder-search inspection shows an intrinsic-width Plus / Add to Set action in the page-heading action area. It confirms the canonical saved movie or explicitly imports a TMDB candidate, then returns to the editor and uses the shared accepted-selection reset. Repeated films remain permitted. Failed inclusion stays on detail with local retry feedback; returning without inclusion preserves search.

Use Set current-turn feedback follows the shared effective member after swaps. The viewer’s own turn keeps normal Actual host copy; another human member produces an advisory in the approved pumpkin-dark token. Classics remains hostless and historical backfill has no current-turn warning.

Advanced or unusual options should remain disclosed.

### Seen It?

Prioritise repeated low-friction answering for the authenticated viewer only: unanswered Classics films and personal Yes/No. Queue identity stacks year, runtime and persisted director below the title; use “HAVE YOU SEEN...” without member or Unknown badges. The shared genuine-source score flex row sits immediately above the plot, omitted when no genuine sources exist. Existing plot summaries sit below the linked identity and above Yes/No, without a nested card. Initially show a fixed three-line clamp with compact More/Less disclosure outside the link; the expansion preference persists as films advance during the mounted visit. Omit the plot block when overview is absent.

Answers and corrections update the local catalog and Recent answers immediately. Background Seen writes use one App-owned FIFO request at a time; pending saves never disable the next Yes/No buttons and have no transient status label. Keep failed latest answers visible with named manual retry controls and preserve later queued answers. Reconcile saved MovieDetail data while preserving newer local intentions. Undo has no rendered control; the application-layer null-write capability remains supported.

Yes and No retain equal geometry and accessibility, with solid mint Yes and ruby No buttons and black icons/text. Use catalogue films directly without detail reads. Preload the actual large poster URLs for the next three unanswered films in queue order, deduplicate by URL and retain image objects as the queue advances. Refill from the back; image failure preserves the normal Poster fallback. Recent answers contain current-visit activity in recent-first order, five per page; bottom-only Previous, page indicator and Next controls appear above five entries, and new answers return to page one. Recent answers provides visible correction controls.

### Event create/edit

Use details → ordered films → completion as the essential Event reading order. Save follows the workflow without a review summary. The first card contains only Actual event date and “Complete the current turn”, checked by default for new events. Editing reflects stored completion without advancing rotation. Host is not selectable: new Events derive hosted identity from the effective active member assigned to the current cycle position 1–4; slot 5 is hostless Classics. Unchecking completion does not change identity. Corrections preserve stored historical host and kind; historical date controls remain disclosed. Event titles, notes, swap explanations and turn-helper prose are absent. Field errors preserve input and focus the first invalid control.

Find a film shows at most six candidates per page with Previous / Next and Page N of M. Whole-title matches after whitespace/case normalisation and removal of at most one leading A or The suppress weaker contiguous-substring results; year text is not a title match. Each linked result shows a left poster and title and year, plus director only when known, with the existing unknown-year/no-poster fallbacks. Inspection keeps the Event or Builder editor and its search mounted, preserving all draft fields, lineup order, query, results, pagination and manual input. Builder prefill seeds once in exact saved order; incomplete or unavailable sets cannot be used.

Accepted film inclusion clears the shared picker query, results and pagination and returns focus to the empty search field. Builder direct additions and Event Yes confirmation retain their ordered multi-film semantics, including repeated appearances; inspection cancellation preserves the search. Add Classic uses the same reset with a single replaceable selection. Linked result/lineup Film Detail navigation stays separate from selection.

Backfill, current-turn completion and correction semantics must remain truthful.

### Film detail

Lead with film identity, Seen state, ratings and shared appearances. Rough dates read ‘Cycle started <date>’. Appearances use “<stored host name>'s week” or “Classics week”; never infer the host from nominal position. Seen state is a read-only two-column summary shown only for Classics candidates or films with History appearances. Any History appearance places all active members in Seen It and none in Haven’t, solely as presentation inference without persisting answers. Unscreened Classics use explicit answers: Haven’t (explicit No) and Seen It (explicit Yes), with a divider and existing stacked avatar/name identities in member sort order. Unanswered members appear in neither column. Detail entered from Seen It? shows Back in the heading row and preserves the personal queue and Recent answers context; normal navigation shows neither Back nor Event-search controls.

Saved Film Detail keeps the backdrop and side-by-side poster/core metadata, with muted runtime in hours/minutes instead of a separate year. The shared genuine-source score flex row sits immediately above the overview, including outside Classics when genuine stored sources exist. The weight-300 overview spans the full card beneath both columns, followed by a fit-content informational Classics status pill. Seen has no parent heading; its left heading/member bundle aligns left and its right heading/member bundle aligns right, preserving member order. Each side starts at the larger intrinsic width of its heading or complete member bundle, then receives half the remaining space, placing the full-height divider midway between the bundles. Members wrap only when the combined content and normal divider spacing cannot fit, retaining each side’s alignment.

Classics score appears only for Classics candidates with ranking data: six full provider labels in IMDb, Letterboxd, Metacritic critic, RT audience, RT critic and TMDB order. Genuine inputs display integer /100; missing inputs show a dash with “average used” only when ranking supplies an imputed value. The collapsed Score breakdown groups Scores (including missing/imputed inputs), Modifiers (Unseen multiplier only) and Crunchy math (Sum of Squares of Scores (SoSoS) and SoSoS × Modifiers (residual score) from rawScore/residualScore). It omits the score hero, counts and warning summary. There is no separate Ratings, membership, per-film maintenance or technical provenance section.

Only Event-search inspection shows “Nope, this isn't it” and the stronger “Yes, this one!” on the right of the Film detail heading. Nope and browser Back return to the preserved editor without removing the candidate. Yes appends a saved canonical movie, importing an external candidate only at confirmation; recoverable import errors stay inline on detail. External previews retain their year/runtime and overview beside the poster; the saved Detail variant does not change Preview. Previews omit stored-only sections. External films are not persisted before accepted confirmation. Builder-search inspection instead shows Add to Set and uses the same canonical confirmation handoff and picker reset; ordinary Film Detail has neither inclusion action.

Saved Film Detail is informational; global score/provider maintenance remains on Admin.

### Avatar onboarding

Keep the choice focused, obvious and recoverable. Offer available avatars in a horizontal native scroll-snap carousel. Initially centre and nominate the third available avatar, or the last available avatar when fewer than three remain. The centred avatar is nominated and committed by Choose and continue; tapping an option centres it. Load availability once per interaction, with claim collisions using the normal error path. Hide the scrollbar on mobile and keep it slim on desktop. Group actions on the right with Log out followed by Choose and continue. Use restrained selection emphasis and respect reduced motion.

### Authenticated header

Keep the slate icon and BookClub wordmark with the small tagline “HAVE YOU UPDATED THE SPREADSH... WEB APP?”. The existing avatar and uppercase member name form a button that toggles a compact Logout dropdown. Outside clicks, leaving the account controls with keyboard focus, and Escape dismiss it; Logout uses the existing session behaviour.

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

Update this authority in the same pass when an explicit lasting UX decision changes, or when other work reveals drift. Preserve BookClub-specific decisions; do not replace them with a generic starter. Remove stale rules rather than append competing ones. Product/data behaviour belongs in [DATA](docs/DATA.md) and [CONTRACTS](docs/CONTRACTS.md); rendered verification policy belongs in [TESTING](docs/TESTING.md). The dated [UI audits](docs/UI_AUDIT_POST_ALIGNMENT.md) are reference evidence, not current design authority or permission to implement their recommendations.
