# Refresh audit

## Current controls

There is no routine member-facing manual freshness control. Conditional load-error Retry/Try again and explicit admin/provider maintenance remain. A failed refresh preserves the last loaded journal; load failures remain separate from action failures, including logout. Connection recovery may bootstrap again. No polling, focus/visibility refresh, service worker or route-entry global reload exists.

Admin maintenance lives on the URL-only authenticated admin route. Score work applies returned Movie patches during a run and performs one final shared-data reconciliation. TMDB metadata maintenance uses a fixed candidate queue from the loaded catalogue, selected two-ID requests with local queue progress, Stop after this batch and one final shared-data read after completion, stop or failure. Local developer snapshot replacement remains separately guarded and explicitly confirmed.

## Loading and mutation reconciliation

`App.load()` is bootstrap: health, authentication/avatar establishment, then concurrent compact catalogue and rotation. It remains for startup, sign-in, avatar completion, explicit connection recovery and developer identity/data replacement.

`App.refreshData()` fetches only catalogue and rotation after authenticated broad changes. Both reads are generation-guarded, retain last-good data after failures and rely on central 401 handling. Their caught failures do not reject the returned promise. The normal client timeout remains 15 seconds.

| Action | State update |
| --- | --- |
| Rotation swap | Apply returned Rotation directly; no shared-data or bootstrap reload. A rotation revision guard prevents an older in-flight shared read from replacing it while allowing that catalogue read to finish. |
| Event save/update, Builder publication, History delete/restore | One shared-data refresh; no preliminary local Session patch or health/auth reread. |
| Seen, Undo, corrections, Classics membership, per-film maintenance/saved-data recovery | Targeted returned Movie patch, including matching History references. |
| Score bulk maintenance | Returned Movie patches during the run, one final shared-data reconciliation. |
| TMDB metadata maintenance | Local fixed-queue progress, one final shared-data refresh that recalculates eligibility and identity counts. |
| FilmPicker creation/import | Returned Movie patch and editor selection. |
| Private Builder save/delete/review | Narrow owner-only Builder state; no public catalogue reload. |

Catalogue reads overlay latest queued/saving/failed Seen intentions before becoming visible. Read-scoped intention maps also preserve writes confirmed while an older catalogue snapshot is in flight; maps are released after the request. FIFO persistence, manual failure retry and visit-local Undo remain.

## Transport and deliberate staleness

Normal frontend `api.catalog()` requests `/catalog/compact`: canonical Movies once with effective score snapshots, Sessions with ordered movie IDs. Hydration restores the existing in-memory Catalog and shared Movie references. An older Worker's 404/405/501 falls back to legacy `/catalog`; other failures are not hidden. Selected-film Detail retains richer saved score history.

Home, History, Classics, Seen It? and Metrics use the global snapshot. Event forms seed from it. Other-client changes may remain stale until full document reload. Hash navigation only changes the page, scroll and heading focus. Detail retains its keyed narrow mount read and Builder its private mount/viewer reads; neither is automatically reloaded by shared-data reconciliation.

History audit evidence remains lazy and cached. Avatar availability is per chooser interaction. FilmPicker search is explicit and preview/details are requested only for actual external inspection, sharing in-flight and successful per-mount previews. Rendering or paginating search rows makes no preview calls.

Stored scores/metadata remain snapshots until explicit maintenance. Normal catalogue/Detail reads never contact providers. Architectural regression tests cover these refresh, transport and provider-traffic boundaries; production behaviour/performance remains unverified.
