# BookClub semantic style decisions

Current design system, 8 October 2026. [STYLE.md](../../STYLE.md) is the lasting interface authority. The [inventory](LABEL_STYLE_INVENTORY.md) and [occurrences](LABEL_STYLE_OCCURRENCES.csv) are unchanged before-state evidence, including their reconstruction/runtime caveats.

## Typography

Roles live in `frontend/styles/shared-content.css`; owning stylesheets apply semantic/responsive variants. Lexend Deca's existing six bundled static faces and numeric conventions remain unchanged.

| Role / token | Size | Weight | Leading |
| --- | --- | --- | --- |
| Page H1 / `text-page-heading` | clamp(32px, 6vw, 52px) | 600 | 1.2 |
| Section H2 / `text-section-heading` | 20px | 600 | 1.25 |
| Subsection H3 / `text-subsection-heading` | 18px | 600 | 1.25 |
| Minor H4 / `text-minor-heading` | 16px | 600 | 1.25 |
| Film title / `text-movie-title` | 22px | 600 | 1.25 |
| Compact film / `text-film-compact` | 18px | 600 | 1.25 |
| Detail identity / `text-film-detail` | 24px | 600 | 1.25 |
| Seen hero / `text-film-hero` | 30px | 600 | 1.25 |
| Body / `text-body` | 16px | 400 | 1.5 |
| Supporting / `text-supporting` | 14px | 400 | 1.5–1.6 |
| Metadata/helper / `text-metadata` | 13px | 400 | 1.6 |
| Field label / `text-field-label` | 13px | 500 | 1.5 |
| Action/tab / `text-button` | 15px | 600 | 1 |
| Eyebrow / `text-eyebrow` | 11px | 600 | 1.5 |
| Compact identity/count / `text-identity` | 11px | 600 | 1–1.5 |

Small text is explicit rather than browser-relative. H4 has explicit size, weight, leading and zero margin. Strong emphasis uses 600 within its current role; status badges use 800. Metadata remains subordinate rather than inheriting body size. Page/section tracking, eyebrow tracking, muted colours and tabular figures retain their purposes.

The `.narrative` variant supplies 14px/300/1.6 for Seen, saved Detail and Add Classic overview. Preview overview uses supporting prose; its metadata uses `.meta`, with no broad paragraph override. Film titles share their role's leading, including History's event-heading variant. Film position markers reuse 18px/600 with tabular figures and no mid-number wrapping. Recent Seen identities use compact film titles; Builder poster captions use the metadata-label variant (13px/500) to identify images in a bounded strip.

## Controls

| Family | Geometry | Treatment |
| --- | --- | --- |
| Standard Action / RouteLink | 46px high; 12px inline padding; 8px icon gap | 15px/600; colour/intent independent of size |
| Icon Action | At least 44×44px | Ordinary icons stay 18px; navigation artwork has separate dimensions |
| Tab/source filter / `.tab-control` | 44px high; 12px inline padding; 8px gap | 15px/600; transparent, shared straight active underline and inset focus |
| Ordinary field | 48px high; 12px inline padding | 16px/400 input; 13px/500 label |
| Wrapping Action / `.action-wrap`, `.action-group-wrap` | At least 46px; standard inline padding/gap; 8px block padding | Natural label wrapping, 1.25 leading; Admin, narrow Home and long retry/developer controls |
| Seen responses | Equal 60px height; standard inline padding/gap | Aqua/ruby with black text/icons |
| Pagination / `.pagination-controls` | Standard Actions plus 8px trailing label padding | One row; central metadata may wrap; Previous/status/Next order retained |

Intent variants preserve constructive green/dark text, secondary paper text/raised surfaces, transparent tertiary and quiet destructive pink. Builder direct-add retains emerald/black. Disabled constructive colour/opacity and other disabled opacity remain intentional. Border colour alone is no longer authored on borderless Action variants.

Admin operations share action geometry, wrapping and metadata/progress typography. Their separate cards, order, availability, synchronous lock, Stop boundary, checkpoints, Resume, Discard and feedback remain workflow-owned. Account and generic standalone film links retain minimum targets even when their content is shorter or the header is crowded.

## Spacing and badges

Regular spacing: 4, 8, 12, 16, 20, 24, 32px. Microspacing: explicitly defined 2px and 6px. Equivalent relationships use the same values: 8px icon/control/label gaps; 4–8px compact grouping; 12px poster/details; 16px row/heading rhythm; 24–32px sections. Metrics keeps its 32px outer rhythm. Zero remains useful for flush dividers and flat surfaces. Poster sizes, chart tracks, fixed row heights, width tiers, safe-area reserves and drawer dimensions are geometry constraints.

- Status: outlined pill, 11px/800/1, 4px × 8px padding, 1px border, 24px minimum height, semantic colour. Used for state and informational status; `.badge-wrap` allows long status prose to fit while retaining family typography/padding.
- Attached count: compact solid pill, 11px/600/1, 2px × 4px padding, semantic fill. Unranked retains 99+ visibly and its complete formatted accessible count. Classics tabs distribute space from intrinsic label/count widths so the capped badge fits at 320px without changing shared padding.
- SourceScores: shared 13px metadata; 2px row/6px column microspacing; intrinsic-width flex children and natural wrapping. Above six sources, label/value stack. Critic leading padding and measured divider offset remain independent of source widths. Sources never become equal-width columns.

## Variants and exception register

| Role / affected contexts | Divergent property | Reason | Reusable? |
| --- | --- | --- | --- |
| History film identity | 18px rather than standard 22px | Film identity and its event heading share one scanning level within a repeated archive event | Yes: History family |
| Classics below 720px, Builder lineup below 481px; recent Seen | 18px compact title | Secondary/repeated film identity shares space with poster, metadata and independent controls | Yes: compact film role |
| Detail / Seen prompt | 24 / 30px film identity | Detail leads the informational screen; Seen's one-film question is the current task's focus | Yes: detail/hero roles |
| Home summary strips | Numerals clamp(24px, 7.5vw, 30px), 38px from 720px; 11/13px labels; 500 numeral weight | Statistics need rapid scanning within three constrained segments; smaller mobile figures avoid splitting formatted numbers | Yes: statistic family |
| Branding, bottom dock and header microtext | 22px brand; 8.32px tagline; 10px navigation microtext | Persistent orientation has its own compact hierarchy and must leave space for page identity | Yes: identity variants |
| Bottom dock | 5px image/label gap, 7px item padding | Six destinations retain the established dock composition and adequate targets independently of ordinary action geometry | Yes: navigation geometry |
| Builder poster captions | Metadata size, 500 weight, ellipsis | Fixed 126px images need compact identification without making the whole strip taller for long names | Yes: metadata-label variant |
| Narrow Builder editor below 390px | Decorative button icons hidden | Three named actions retain their single row, readable labels, standard padding and full targets | Yes: narrow editor action group |
| Classics remove (C0257) | 44px target offset up/sideways, 12px top padding; 18px visible icon | Expands the original quiet icon dock without covering film identity or adjacent controls | Scoped icon-dock variant |
| Seen/Detail/Add Classic overview | 300 weight | Sustained narrative reading is quieter than identity, scores and actions | Yes: `.narrative` |
| Metrics themes and report colours | Twelve data-driven em sizes; ordered spectrum | Typography encodes ordered theme prominence; report colours identify stable analytical groups | Yes: report families; calculation/palette unchanged |
| Metrics report tables | 13px below 720px; 14px above | Dense comparisons use metadata on mobile and supporting text where columns have room; small annotations remain metadata | Yes: responsive table family |
| Metrics identity filters | Avatar tile geometry | Image-plus-member identity is a distinct selection object rather than a text tab; labels and hit areas remain explicit | Yes: identity selection family |
| Attribution | 5.6px body, 6.24px summary, 9px icon and compact 1.4 leading | Explicit owner constraint to preserve the deliberately tiny footer during this pass | Footer-only; owner readability review deferred |
| Browser-owned Google/native UI | Third-party/native rendering | Google sign-in and platform picker/pop-up content is owned outside application CSS | External ownership boundary |

Content-width tiers, poster aspect ratios, History's non-wrapping edit/audit/delete/identity group, responsive drawer, Film Detail Seen-column intrinsic sizing, chart row heights and fixed chart geometry are retained layout contracts, not exceptions to text/control role consistency.

## Known findings resolved

| Before-state evidence | Current rule |
| --- | --- |
| SourceScores, `classics-seen.css:47,50` | `space-2` explicitly defined; inline and stacked rows use the same microspacing |
| Metrics retry, C0409/C0410 | Shared Action with retry icon; actual error component rendered synthetically |
| Detail paragraphs, C0613–C0626/C0664–C0666 | Explicit metadata/supporting/narrative roles; broad override removed |
| History evidence H4, C0748 | Shared minor-heading role; actual HistoryEvidence fixture rendered, not assumed from reconstructed DOM |
| Metrics small, C0348/C0350 | Explicit metadata size/weight/leading |
| Borderless secondary/tertiary/danger/direct-add Actions | Ineffective border-colour declarations removed; semantic foreground/fill retained |
| Classics remove, C0257 | 44px target; rendered film-link collision checks |
| Repeated type/padding/gap declarations | Shared tab, pagination, wrapping-action, count and narrative families; redundant consumer overrides removed |

Count display uses `shared/format.ts`: `formatCount` for numbers and `formatCountText` for safe integer quota text. Timeline reuses the helper through its existing export. Formatting never feeds ranking, provider payloads, persisted values or calculations. Dates, years, identifiers, percentage/unit labels, native score precision and saved Detail rounding remain intact. Existing fractional IMDb vote medians retain precision.

## Verification and owner review

The reproducible local harness is `node tests/style-unification.browser.mjs` with Vite UI running, optional Playwright/Edge and entirely synthetic API functions. `BOOKCLUB_STYLE_PHASE=before` captures the baseline; default `after` also verifies targets, role labels, page overflow, Classics remove collisions and all six Admin operation states. Evidence stays ignored under `.verification/style-unification/`.

The baseline captured 183 screen/state/width samples before implementation; the final matrix captured 303, across 320/390/720/951/1440px. Comparison covers all main routes, Detail, Preview, sign-in/avatar gates, Metrics/Classics panels, populated Builder/search, long titles, missing artwork, score glossary/Add/Remove dialogs, account controls, attribution, drawer state, developer/operation disclosures, loading/failure and actual evidence/error components. Additional after-state scenarios cover Builder set picker, History deletion confirmation, guarded developer confirmation and each Admin operation's running/focused/Stop/progress/Resume/Discard presentation. Provider functions are synthetic; no production, database, supervisor or external provider operation runs.

The compact-score harness passed 64 source-count/width cases; the Seen-column harness passed 35 population/width cases, including 280px. Five additional rendered capped-count cases verify the 99+ badge, full accessible count and unclipped tab labels. The style harness also checks enabled hover/focus geometry, visible keyboard outlines, selected tab underlines and disabled controls at all five widths: 78 enabled cases passed, including text contrast of at least 4.5:1 against composited surfaces (using the lightest page-gradient endpoint). `BOOKCLUB_STYLE_CONTROLS_ONLY=1` runs those control-state checks alone. Normal quality checks passed: lint, typecheck, 88 test files/1,090 tests, build, static prod:check and diff whitespace checks. Current runtime evidence remains bounded: synthetic fixture review does not certify live data, browser-owned Google UI, every possible provider message, assistive-technology behaviour or all browser engines. Attribution readability is deliberately deferred for owner review; Metrics mobile information architecture remains separate roadmap work.
