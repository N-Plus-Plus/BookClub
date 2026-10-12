# STYLE.md: BookClub visual standard

Read the relevant passages before user-facing interface work. This file defines BookClub's reusable visual and interaction styling. USER_EXPERIENCE.md owns journeys, feedback and recovery. Functional correctness is necessary, but a screen is not complete merely because the requested controls exist.

## 1. Authority and scope

For BookClub interface decisions, use this order:

1. Explicit instructions for the current task.
2. Established BookClub-specific UX/product decisions and coherent existing project patterns.
3. This STYLE.md.
4. Nearby implementation details.

Existing code alone does not establish a design decision or make an obviously weak or accidental implementation correct. Established project consistency normally wins over generic best practice. Do not use this file as permission to redesign established BookClub patterns unless the current task explicitly authorises that change.

If an existing pattern is known to be weak but the task does not authorise changing it, preserve it and note the issue rather than expanding scope.

Do not perform opportunistic UI cleanup outside the requested area. Change only what the task requires, plus the minimum neighbouring adjustments needed to keep the result coherent.

AGENTS.md governs agent routing and standing engineering/safety rules. README.md is the human overview; the specialised documents under docs/ own architecture, data, contracts, integrations, testing and deployment. STYLE.md governs reusable visual design, composition, interaction styling, responsive behaviour and presentation. USER_EXPERIENCE.md governs workflows.

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

Review the affected composition for material layout changes; inspect immediate context for small edits.

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

BookClub uses 4, 8, 12, 16, 20, 24 and 32px spacing, with explicitly defined 2px/6px microspacing. Use 8px icon-to-label/control gaps (16px between a page-heading destination image and title), 4–8px compact text groups, 12px poster-to-details, 8px label-to-field, 16px heading/content and row rhythm, and 24–32px section separation. Metrics retains its 32px outer gap. All Metrics tabs open 32px below the tab bar without an initial divider; subsequent report headings gain 32px section padding, with 12px footnote separation. Every tab ends with a full-width text-only Back to top button flanked by upward chevrons and immediate scrolling. Data sources begins 16px after final content and leaves 8px below its collapsed or expanded content above the page edge or mobile navigation. Poster dimensions, content-width tiers, drawer geometry and chart constraints are geometry rather than spacing tokens. The bottom dock's 5px label gap and 7px item padding retain its constrained composition.

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

Prefer tabular numerals for numeric columns. Apply these rules to future tables and existing tables when deliberately touched; document justified departures when they materially improve usability. The shared Score abbreviations glossary displays Abbreviation, Source, Native and Normalised at desktop widths (720px and above), with equal-width, right-aligned Native and Normalised columns and headings. Below 720px, hide both example columns and headings, remove the four-column minimum width, and let the left-aligned Abbreviation and Source columns fill the dialog with naturally wrapping source descriptions and no horizontal scrolling. Retain all canonical example data. Mobile Rotten Tomatoes source labels omit the trailing Score; desktop retains it, and Metacritic labels remain unchanged.

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

Every Admin maintenance card places a concise field-type summary immediately beneath its heading, using the shared operation inventory, ordinary 13px subdued metadata, microdot separators and natural wrapping. Populate and Refresh share the same summary. Keep heading/summary spacing compact; retain explanatory copy, server progress, controls and the detailed safeguards disclosure afterward. Concise inline server status distinguishes successful, unchanged, skipped, deferred, unfinished and temporarily blocked units. Planning shows films or collections reviewed against the frozen candidate count, separately from execution results. Interrupted preparation offers Resume planning and identifies a planning failure; partial work must not look ready or complete. Resume remaining preserves original scope; Retry failed targets deferred work only. Use an expandable View issues list and existing action wrapping, retain 44px touch targets, and explain another browser’s active lease. Do not offer local-only Discard Progress. Closing the page stops dispatch; do not imply background execution. Aggregate progress distinguishes film/provider work from collection rosters and names the current phase.

## 30. BookClub screen priorities

Screen-specific journeys and accepted composition live in [USER_EXPERIENCE](USER_EXPERIENCE.md#established-bookclub-journeys). Read only the affected screen passage alongside the relevant visual rules here.

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

## 32. Task-scaled rendered review

Copy, colour and icon edits require inspection of the affected control/state and immediate context. Layout or workflow changes require the affected journey, recovery and implicated narrow/wide layouts. A new major page warrants the complete affected screen and practical user feedback before extending the design elsewhere.

Use available rendering or owner device feedback when visual consequences warrant it; source inspection alone does not prove visual quality. Inspect long content, missing artwork, expanded details or intermediate widths only where relevant. Do not install browser infrastructure or run unrelated screenshot campaigns. Report unobserved states honestly. Verification timing and release checking belong in [TESTING](docs/TESTING.md).

## 33. Document maintenance and relationships

Update this authority in the same pass when an explicit lasting visual decision changes, or when other work reveals drift. Preserve BookClub-specific decisions; do not replace them with a generic starter. Remove stale rules rather than append competing ones. Product/data behaviour belongs in [DATA](docs/DATA.md) and [CONTRACTS](docs/CONTRACTS.md); rendered verification policy belongs in [TESTING](docs/TESTING.md). Journey decisions belong in [USER_EXPERIENCE](USER_EXPERIENCE.md). The [style decision register](docs/audits/STYLE_UNIFICATION_DECISIONS.md) records semantic families and justified exceptions.
