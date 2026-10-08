<!--
AGENT MAINTENANCE INSTRUCTION

Build this document up only from facts established by the repository, the user's explicit decisions, or verified deployment/runtime behaviour.

Maintain it as the concise technical map of the current as-is application.

Update it in the same pass when:
1. the task changes any documented architectural fact; or
2. unrelated work reveals that this document no longer matches reality.

Prefer concise factual statements, tables, and direct paths over prose. Do not preserve implementation history here. Remove stale information instead of appending contradictory notes.

The first visible section must always let a future agent answer: "What does a totally fresh machine need in order to host, launch, and use this application correctly?"

Only include API sections when APIs actually exist.
-->

# ARCHITECTURE.md

## Fresh-machine requirements

| Requirement | Current state |
| --- | --- |
| Platform | Browser plus a Node development machine; no OS-specific app host or VPN requirement. Optional browser scripts need locally available Playwright and a compatible browser. |
| Runtime | Manifest: Node >=22.12; Node 24 recommended, required by the snapshot-refresh guard. SQLite-backed tests use `node:sqlite` (available from Node 22.13 without the experimental flag); prefer Node 24 for the complete toolchain. |
| Toolchain | Corepack, pnpm 10.32.1, Git for checkout; install from `pnpm-lock.yaml`. |
| Local services | Vite 4173, Wrangler local Worker/D1 8787, Node supervisor 8790; started by `corepack pnpm dev`. |
| Cloud accounts | None for local demos. Hosted operation requires GitHub source access, Cloudflare Workers Static Assets/Workers/D1, and a Google Web Application client with privately allow-listed accounts. Operator refresh requires Cloudflare D1 read/export authentication. |
| Configuration | Local bypass/configuration is tracked. Hosted builds require public `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID`; Worker requires `DB`, origin/env vars and matching `GOOGLE_CLIENT_ID`. Provider secrets are optional; see [INTEGRATIONS](INTEGRATIONS.md). |
| Network | Dependency installation and hosted use need internet; no Tailscale, network share or self-hosted server is part of BookClub. Optional API lookups and artwork CDN need internet. |
| Bootstrap | Local `dev` applies migrations and seeds generic fixtures once. Production requires privately provisioned members/auth and explicit rotation, never the development seed. |

## Repository

- **GitHub repository:** https://github.com/N-Plus-Plus/BookClub
- **Branch:** `main`; application root is the repository root.
- **Package manifest:** `package.json`; pinned resolution `pnpm-lock.yaml`. `pnpm-workspace.yaml` permits esbuild/workerd installation scripts.

## Hosting and runtime topology

| Environment | Platform / entry | Persistence | Access |
| --- | --- | --- | --- |
| Ordinary development | Vite http://localhost:4173/#/home; Worker http://localhost:8787/api/v1 | Local `bookclub-local`, under `worker/.wrangler/state/v3/d1` | Local double-flag bypass; optional local member selector |
| Import preview | Same ports, separate `worker/wrangler.import-preview.jsonc` | `worker/.wrangler/import-preview`, dummy preview identity | Generic positional members; no normal refresh supervisor |
| Static build preview | localhost:4173/ | Whatever API origin was configured at build | Real API auth applies; a configured production API is a live boundary |
| Production | https://bookclub.nissen.nexus (canonical after publication) plus https://bookclub-api.troy-nissen.workers.dev/api/v1 | Cloudflare D1 `bookclub-prod`, Worker binding `DB` | Privately provisioned Google identity followed by opaque bearer session |

Vite binds IPv4 loopback with strict port 4173. Use the localhost origin for CORS; do not run development and static preview concurrently. DevDashboard invokes the same app-owned `corepack pnpm dev`; it adds no required runtime. The neighbouring ToDonut project's 5173 is not a BookClub service.

## Application shape

React serves a static, hash-routed frontend. `index.html` and `frontend/main.tsx` start it. `frontend/routes.ts` is the pure canonical page-definition/resolver layer: primary paths, labels and images feed Navigation; resolved kinds, headings, images and dynamic IDs feed App and AppShell. Admin is recognised independently of permission; App retains the viewer-role guard and ordinary not-found treatment for other viewers.

`frontend/App.tsx` composes controllers, gates sign-in/avatar onboarding and selects screens. It retains sign-in/logout actions, transient History sort context, Event prefill, heading action slots, notices and domain screen callbacks. `frontend/useHashRoute.ts` owns hash reads/subscription, page transitions, stable random shell-title selection, scroll reset and heading focus. Its transition callback delegates domain workflow decisions to App. `frontend/useBookClubData.ts` owns auth-aware bootstrap and catalogue-only refresh through one guarded catalogue/rotation operation, Seen reconciliation/read leases, generation protection, returned rotation revisions and authenticated Metrics-resource lifetime/invalidation. `frontend/seen-answers.ts` owns the optimistic serial Seen save queue. `frontend/useFilmInspection.ts` owns candidate inspection, preview/promise reuse, cancellation/return transitions, guarded confirmation/import and one-movie handoff. `frontend/AppShell.tsx` renders persistent Navigation, site/account header, page identity, heading slots and main/footer framing; drawer state remains in App across auth gates.

MetricsScreen and AdminScreen are selectively React.lazy-loaded under screen-level Suspense using LoadingView inside the normal shell. DevTools retains its existing development-only lazy boundary. Builder/Event/Seen stay eager to preserve their hidden mounted editors/queues through inspection; History/Classics/Detail/Preview remain eager. Shared modules must not statically import lazy screens or their full analytical implementation into the initial graph. Home Quick Facts imports `shared/metrics-summary.ts`, the small shared source for appearance selection, genuine IMDb summary and immutable score snapshots; `shared/metrics.ts` re-exports those rules for reports without duplication. The App-owned Metrics resource dynamically imports enrichment preparation only when its immediate read resolves; fetching, caching and on-demand category calculations keep their existing schedule. EventScreen and BuilderScreen own their drafts; Builder adds a per-draft serial/coalescing autosave queue through `frontend/builder-autosave.ts` with optimistic list updates and final-revision publication; FilmPicker owns query/results/page and per-mount preview cache, resetting search after accepted direct or inspection-confirmed inclusions. AddClassicModal reuses the picker for one replaceable read-only selection, resolves canonical identity on confirmation and patches returned membership through App. During inspection the same source editor stays mounted and is hidden, with a stable source-route identity. Saved candidates use stored Detail; unsaved candidates share its identity header through FilmIdentity and use read-only PreviewScreen. Confirmed returns leave focus to the picker reset rather than the route-heading focus. No draft storage or route-entry refresh is involved. Vite uses `/` for development, builds and previews. The dedicated `bookclub-frontend` Worker serves only generated `dist/` with SPA fallback and Custom Domain `bookclub.nissen.nexus`; workers.dev and preview URLs are disabled. Hash routing needs no server routing or SSR. It has no script, D1, API or provider bindings. The API remains a separate Worker. Pushing main deploys neither Worker nor D1.

`#/admin` is an authenticated admin-only route, linked above Logout in admin viewers’ Account dropdown and excluded from primary navigation. `AdminScreen` composes `ClassicsMaintenance` (bulk scores/OMDb metadata), `MetadataMaintenance` (TMDB metadata/artwork) and two `EnrichmentMaintenance` provider-cache controls under one synchronous frontend bulk lock; record-scoped controls stay with their records. OMDb metadata and both provider-enrichment controls share the versioned browser-local remaining-ID/completed-count checkpoint format through `frontend/maintenance-checkpoint.ts`, reconciled against their own catalogue scope/identity on resume; no server checkpoint or credentials are stored. OMDb metadata covers all valid-IMDb canonical films; score modes retain Classics/active History scope. The data layer centrally resolves retained OMDb / IMDb-linked, TMDB and MDBList title evidence into movies.title/title_source; admin cached reconciliation uses bounded D1-only batches. Score modes and TMDB maintenance retain their existing in-memory queues. TMDB maintenance freezes shared catalogue eligibility once and sends pairs of selected IDs to an additive metadata-only Worker route; global SQL selection/counts remain only on its compatibility route. Existing score/metadata controls reconcile through one final shared-data refresh. Dedicated enrichment refreshes shared data once only when canonical title authority or external-ID attachment changed it; responses contain aggregate-friendly outcomes rather than film details.

The frontend requests additive compact catalogue transport and hydrates ordered History film IDs into canonical Movie references, falling back to legacy `/catalog` on an older Worker. Bootstrap reads health/auth plus shared data; authenticated mutation reconciliation reads only catalogue/rotation. Rotation swaps and film writes use returned state. Pending/failed Seen intentions survive catalogue snapshots, including writes confirmed while a snapshot is in flight.

The independently deployed Worker (`worker/src/index.ts`) owns validation, authorisation, persistence and provider credentials. Zod validates boundaries; jose verifies Google JWTs. D1 is the canonical database. Shared TypeScript holds pure ranking, Metrics and identity rules. Metrics memoises active History appearance selection and derives existing genre/decade/director reports, genuine-rating profiles, IMDb-vote popularity and tie-aware film extremes from the catalogue. Opening Metrics additionally makes one lazy authenticated `GET /metrics/enrichment` read through `frontend/api.ts`; `worker/src/metrics-repository.ts` batches seven set-based SELECTs scoped to active History films. `shared/metrics-enrichment.ts` owns pure enrichment analytics and `frontend/EnrichedMetrics.tsx` presents them within seven in-memory category tabs on the existing single route. `frontend/metrics-cache.ts` retains the enrichment read across route visits within the authenticated App lifetime, invalidating after saved provider enrichment batches, shared-data refresh or full bootstrap and replacing the resource on viewer changes. Reports calculate on demand for the active category and remain cached during the mounted visit; canonical-film effective scores, normalised enrichment facts and club frequency baselines are reused without changing repeat counts. Identity/role filters remain local, with ALL History retained as baseline. Long result lists use `frontend/MetricsResults.tsx` to bound mounted rows while retaining every tie. Home Quick Facts uses the shared lightweight count/IMDb summary; catalogue-derived shell counts are memoised. Ordinary catalogue/bootstrap payloads carry only an optional derived AU classification from one additional set query, sharing the Metrics resolver; raw cache facts stay in the lazy Metrics projection. No provider calls, cache writes, persistent aggregate tables or ranking inputs are added.

Normal development prepares local D1, then runs Vite and a Node supervisor that starts/stops local Wrangler. Vite proxies `/__dev/refresh` to loopback 8790. `frontend/DevTools.tsx`, rendered only on local Admin (never import-preview), and the supervisor support an explicitly confirmed one-way production snapshot replacement; neither is present in production. Member switching and completed local replacement use the full auth-aware bootstrap reload. Development fixes its API to localhost even if root env files specify production.

## Local artwork generation

High-resolution canonical PNGs live in tracked `assets/source/{avatars,buttons,newFav}/`; their bytes remain unchanged. `scripts/assets/manifest.mjs` declares all 20 member choices, Classics avatar, nine navigation/heading images, brand and dedicated favicon. `public/` holds small hand-maintained static files (TMDB SVG). Vite serves/copies only ignored `generated/public/`; source originals never enter `dist/`.

`corepack pnpm assets:prepare` uses development-only sharp to resize inside the original aspect ratio without enlargement, cropping or palette quantisation: lossless RGBA PNG, Lanczos3, compression 9. Maximum dimensions are 128×128 for destination/heading images (22px dock, 33px drawer, up to 52px headings), 96×96 brand (30px), 32×32 favicon, and 320×320 avatars (44px normal, 80px Home, 132px chooser). Runtime URLs stay unchanged except the dedicated `/favicon.png`.

Persistent ignored `.cache/bookclub-artwork/` stores encodings keyed by SHA-256 source contents, dimensions, complete format/encoding recipe/version and sharp/native library versions. Bump `imageRecipe.version` when processing behaviour changes beyond its declared options. SHA-256 receipts detect damaged cache files. Unchanged runs hash/validate/copy without re-encoding; outputs already identical are not rewritten. A process lock serializes concurrent preparation; atomic writes prevent partial files. Removed manifest outputs are pruned only from the generator-owned output directory.

Normal `dev` delegates preparation once to `dev:ui`; `dev:ui`, `dev:import-preview:ui` and `build` automatically prepare before Vite starts. A fresh clone needs only the normal install/build commands. Never hand-edit generated or cached files. To deliberately regenerate, stop preparation/dev/build processes, delete only `.cache/bookclub-artwork/` and `generated/public/`, then run `corepack pnpm assets:prepare` (`--report` prints per-file bytes). Cleaning `dist/` preserves the cache. After a killed preparation, remove its abandoned `prepare.lock/` directory only after confirming preparation processes have stopped.

## Internal technical dependencies

| Area | Owner | Coupling / purpose |
| --- | --- | --- |
| Browser API | `frontend/api.ts`, `shared/types.ts` | Sole ordinary browser API client and shared request/response types |
| UI system | `style.css`, `frontend/app.css`, `frontend/components.tsx`, `frontend/ClubIdentity.tsx` | Preserve root tokens/primitives; extensions use app.css. Lucide and bundled Lexend Deca; no CSS framework. [STYLE](../STYLE.md) owns design decisions. |
| Domain | `shared/ranking.ts`, `metrics.ts`, `genres.ts`, `identity.ts`, `metadata.ts`, `artwork.ts` | Effective scores, appearance calculations, finite genres, dates/identities, maintenance eligibility and poster sizing |
| Worker boundary | `worker/src/index.ts`, `validation.ts`, `http.ts`, `auth.ts`, `auth-repository.ts` | Routing, safe errors, exact CORS, central mutation guard and D1-backed sessions |
| Persistence/product | `worker/src/repository.ts`, `enrichment-repository.ts`, `title-repository.ts`, `product-repository.ts`, `worker/migrations/` | One-pass catalogue assembly; bounded film/Session reads; SQL maintenance selection; transactional Builder/rotation/History; versioned schema |
| Providers | `worker/src/services.ts`, `score-service.ts`, `enrichment-service.ts`, `providers/` | Narrow local search, read-only TMDB preview, explicit metadata import/maintenance and score capture |
| Snapshot tooling | `scripts/dev/` | Fixed production read/export source, sanitised staging, verification and local-only replacement; explicit local TMDB pairing maintenance |
| Archive tooling | `scripts/import/` | Development-only ExcelJS/tsx parser, resolver, local apply and separate guarded operator production CLI |
| Build/release | `vite.config.ts`, `worker/wrangler.jsonc`, `wrangler.frontend.jsonc` | Static frontend build, separate explicit API and frontend deploys; frontend publication last |

## External technical dependencies and services

| Dependency | Use | Failure impact / detail |
| --- | --- | --- |
| GitHub | Canonical source repository; no automatic publication | Source collaboration unavailable; [DEPLOYMENT](DEPLOYMENT.md) |
| Cloudflare Workers Static Assets/Workers/D1 | Static frontend, separate private API and canonical persistence | Private app reads/writes unavailable; [DATA](DATA.md), [INTEGRATIONS](INTEGRATIONS.md) |
| Google GIS/JWKs | Required production sign-in and verified identity | New sign-in unavailable; existing valid app sessions use D1; [INTEGRATIONS](INTEGRATIONS.md#google-identity-services) |
| TMDB API and image CDN | Optional explicit film lookup/metadata; images from stored references | Local/manual catalog remains usable, artwork falls back; [INTEGRATIONS](INTEGRATIONS.md#tmdb) |
| MDBList / OMDb | Optional explicit rating snapshots | Existing snapshots remain; missing inputs remain Needs Data; [INTEGRATIONS](INTEGRATIONS.md#rating-providers) |

No scheduled jobs, R2/image binary store or TVDB integration is active.

## Internal and external APIs

The Worker exposes `/api/v1` HTTP JSON to `frontend/api.ts`; auth, catalog, events, Builder, rotation and maintenance families are defined in [CONTRACTS](CONTRACTS.md). There is no separate public third-party developer API. The dev-only supervisor's loopback HTTP surface is a tooling boundary, not a Worker route.

External calls use Google JWK verification, TMDB search/details, MDBList Media Info and OMDb IMDb lookup. The explicit archive resolver also uses TMDB find-by-ID; the snapshot/production operator tools use authenticated Cloudflare operations. Detailed endpoints, credentials and failure behaviour belong in [INTEGRATIONS](INTEGRATIONS.md).

## Architectural invariants and unknowns

The static browser has no D1/provider secrets; ordinary fetches go through `frontend/api.ts`. CORS is not authentication. Builder ownership is enforced server-side even for admins. Catalogue and stored-film page loads never call provider APIs; explicit search and unsaved-film preview may call TMDB; poster display/failure never triggers metadata repair. Local/production/preview stores remain separate. Generated builds, private snapshots, credentials and archive reports stay ignored.

Remote schema, current rotation and provisioning are live state: tracked code cannot certify them. Current source includes 0016; verify the live production ledger and pending migrations under authorised release scope. Migration 0015 and negative-only score-check persistence are independently compatible with the existing 0013 score-check table; see [DEPLOYMENT](DEPLOYMENT.md). Additive 0016 caches are capability-detected by ordinary provider paths; dedicated enrichment requires the new schema. No live verification is required for ordinary documentation or tests.
