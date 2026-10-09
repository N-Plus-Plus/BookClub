export const metricsInventory = {
  "Top 5": [
    "Top 5 highest critic scores",
    "Top 5 lowest critic scores",
    "Top 5 most popular · IMDb",
    "Top 5 most obscure · IMDb",
    "Top 5 hidden gems",
    "Top 5 most cult",
    "Top 5 talent",
    "Creative partnerships",
    "Top 5 genre combinations",
    "Top 5 production countries",
    "Top 5 non-English original languages",
    "Top 5 highest revenue / budget ratio",
    "Top 5 lowest revenue / budget ratio"
  ],
  "Tastes": [
    "Genre fingerprint",
    "Genre taste overlap",
    "Theme fingerprint",
    "First shared theme",
    "Shared stars",
    "Recurring cast",
    "Directors",
    "Original languages",
    "Production countries"
  ],
  "Breakdowns": [
    "Contribution by host",
    "Cycle scorecards",
    "Franchise / collection completed",
    "Unrequited collections",
    "Critics or audiences?",
    "Ratings profile",
    "Awards and nominations",
    "Classification versus acclaim",
    "Australian classification",
    "Genre detail",
    "Release decades",
    "Release-year spread",
    "Runtime spread",
    "Median reported budget / revenue",
    "Highest-grossing film by genre",
    "Most expensive flops",
    "Streaming platform representation"
  ],
  "Records": [
    "Top critic",
    "Top audience",
    "Bottom critic",
    "Bottom audience",
    "Most aligned critics and audiences",
    "Most misaligned critics and audiences",
    "Most popular",
    "Most obscure",
    "Most Classics viewed",
    "Least Classics viewed",
    "Oldest",
    "Newest",
    "Longest",
    "Shortest",
    "Most recurring director",
    "Most recurring writer",
    "Most recurring composer",
    "Most recurring cinematographer",
    "Most recurring editor",
    "Most recurring producer"
  ]
} as const;
/** Exclude subgroup/film headings inside report bodies and the Records cabinet title. */
export function reportHeadings(node:HTMLElement) {
 return [...node.querySelectorAll(".metrics-panel h2,.metrics-panel h3")].filter(e=>e.textContent!=="Records" && (e.tagName==="H2" || !e.closest(".staging-report"))).map(e=>e.textContent);
}
