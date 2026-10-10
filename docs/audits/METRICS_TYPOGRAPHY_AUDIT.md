# Metrics typography audit by display case

Audit date: 10 October 2026. Source revision: `69e78fd35fb0b7fed33da5e41c026c0503c7cb4d`.

This report preserves the findings of the Metrics typography review. It is a snapshot for future decisions, not a new styling policy; [STYLE.md](../../STYLE.md) remains the interface authority. Rendered checks used synthetic data at viewport widths of 320px, 390px, 720px and 1440px.

The groups distinguish what the text does. Here, "common" means the treatment shared by the most report types, rather than the number of repeated rows. Measurements below give font size, weight and line height, respectively. All groups use Lexend Deca.

## 1. Report titles

These identify the whole report.

Common treatment: **20px, 600, 25px**, primary text colour.

Outliers: the six Most recurring director, writer, composer, cinematographer, editor and producer titles retain a **400-weight prefix and 600-weight role word**, at the same size and line height. Report titles are otherwise uniform.

## 2. Category labels

These identify what a bar or row represents.

Common treatment: **16px, 400, 24px**, primary text colour. Used by country names, language names, Genre fingerprint genres and Ratings Profile abbreviations.

Outliers:

- Classification versus acclaim: classification names use **16px, 600, 20px**, changing to **13px, 600, 16.25px** below 500px content width.
- Cycle scorecards: cycle numbers use **20px, 600, 25px**. They function as row identifiers despite being implemented as headings.

## 3. Contributor identities

The established identity treatment combines an avatar with a name at **11px, 600, 16.5px**, in primary text colour. It appears in the spread charts, Critics or audiences?, financial comparison and overlap matrices.

Plain-text alternatives:

- Genre fingerprint: **13px, 600, 19.5px**.
- Australian classifications: **13px, 600, 19.5px**.
- Contribution by host: **14px, 400, 21px**.
- Diversity charts: **16px, 400, 24px**.
- Theme fingerprint: **16px, 600, 24px**.

Avatar identities and plain-text names should be assessed separately.

## 4. Headline values

These are the main measurements beside a category.

Common treatment: **16px, 600, 24px**, primary text colour. Used by country and language film counts, Genre fingerprint ratios, diversity percentages and Ratings Profile means.

Outliers:

- Contribution by host counts: **14px, 600, 21px**.
- Overlap matrix values: **13px, 400, 19.5px**, with colour appropriate to the background. The mobile comparison uses **16px, 400, 24px**.

## 5. Legends

These explain colours or segments.

Common treatment: **13px, 400, 19.5px**, primary text colour.

- Australian classifications: names alongside swatches.
- Release Decades: names and percentages beneath swatches.

There are no typography outliers in this group. The horizontal and stacked arrangements are intentional layout differences.

## 6. Series keys

These distinguish multiple bars. There are two treatments, with no clear majority:

- Genre fingerprint, Brought / vs Club: **13px, 400, 19.5px**, secondary grey.
- Cycle scorecards and Classification versus acclaim, Critics / Audience: **13px, 400, 20.8px**, muted grey.

The latter combine the series name with an exact value, which may justify a different treatment.

## 7. Axis labels

These show the measurement scale.

Common treatment in the two spread reports: **13px, 400, 19.5px**, secondary grey. Used by Release-year Spread endpoints and Runtime Spread endpoints.

Outlier: the financial USD axis uses **13px, 400, 20.8px**, muted grey.

## 8. Supporting annotations

These explain or qualify a measurement.

Common treatment: **13px, 400, 20.8px**, muted grey. Used by:

- Spread means, standard deviations, shortest and longest values.
- Critics or audiences? counts and leaning descriptions.
- Diversity distinct counts.
- Ratings Profile medians.
- Median Budget / Revenue ratio text.

Outlier: Theme fingerprint attached counts and ratios use **13px, 400, 19.5px**, in the associated palette colour.

## 9. Values inside bars

These sit within coloured geometry.

Australian classification percentages consistently use **11px, 600, 11px**, in a contrasting colour. They are hidden when the segment is too narrow to fit the label.

This is a separate display case from values beside a bar.

## 10. Chart captions and column headings

These provide structure or orientation:

- Contribution by host, Films brought: **16px, 600, 24px**, primary text colour.
- Cycle scorecards, Cycle: **13px, 400, 20.8px**, muted grey.
- Overlap matrices, Contributor: **13px, 700, 19.5px**, primary text colour.
- Overlap member headings: the **11px avatar identity** treatment described in group 3.

There is no meaningful majority here because these elements serve different structural purposes.

## 11. Theme terms

Theme fingerprint terms have a deliberate special treatment: **weight 400**, associated palette colours, progressively sized from **20px to 15.6px**, with line height **1.5 times the font size**.

Its contributor headings belong to group 3, and its attached measurements belong to group 8.

## Comparisons for a future review

The strongest comparisons between elements serving the same purpose are category labels, plain contributor names, headline values, series keys and axis labels. Legends, values inside bars and theme terms are distinct display cases with clearer reasons for special treatment.

Any future uniformity decision should consider each display case on its own merits rather than applying one treatment to all text associated with charts.
