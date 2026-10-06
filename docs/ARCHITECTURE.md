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

React serves a static, hash-routed frontend. `index.html` and `frontend/main.tsx` start it; `frontend/App.tsx` gates authentication/avatar onboarding and owns navigation/catalog state, the optimistic serial Seen save queue, transient Event inspection context and a one-movie confirmation handoff. EventScreen owns its draft; FilmPicker owns query/results/page and per-mount preview cache. During inspection the same Event pane stays mounted and is hidden, with a stable source-route identity. Saved candidates use stored Detail; unsaved candidates share its identity header through FilmIdentity and use read-only PreviewScreen. No draft storage or route-entry refresh is involved. Vite uses `/` for development, builds and previews. The dedicated `bookclub-frontend` Worker serves only generated `dist/` with SPA fallback and Custom Domain `bookclub.nissen.nexus`; workers.dev and preview URLs are disabled. Hash routing needs no server routing or SSR. It has no script, D1, API or provider bindings. The API remains a separate Worker. Pushing main deploys neither Worker nor D1.

`#/admin` is an authenticated admin-only, URL-only route, excluded from navigation. `AdminScreen` composes `ClassicsMaintenance` (bulk scores/OMDb metadata) and `MetadataMaintenance` (TMDB metadata/artwork); record-scoped controls stay with their records. Only OMDb metadata mode uses `frontend/omdb-maintenance.ts` for a versioned browser-local remaining queue and completed count, reconciled against catalogue scope/identity on resume; no server checkpoint or credentials are stored. Score modes and TMDB maintenance retain their existing in-memory queues. TMDB maintenance freezes shared catalogue eligibility once and sends pairs of selected IDs to an additive metadata-only Worker route; global SQL selection/counts remain only on its compatibility route. One shared-data refresh reconciles completion, Stop and failure.

The frontend requests additive compact catalogue transport and hydrates ordered History film IDs into canonical Movie references, falling back to legacy `/catalog` on an older Worker. Bootstrap reads health/auth plus shared data; authenticated mutation reconciliation reads only catalogue/rotation. Rotation swaps and film writes use returned state. Pending/failed Seen intentions survive catalogue snapshots, including writes confirmed while a snapshot is in flight.

The independently deployed Worker (`worker/src/index.ts`) owns validation, authorisation, persistence and provider credentials. Zod validates boundaries; jose verifies Google JWTs. D1 is the canonical database. Shared TypeScript holds pure ranking, Metrics and identity rules; the UI derives presentation from the authenticated catalog.

Normal development prepares local D1, then runs Vite and a Node supervisor that starts/stops local Wrangler. Vite proxies `/__dev/refresh` to loopback 8790. `frontend/DevTools.tsx`, rendered only on local Admin (never import-preview), and the supervisor support an explicitly confirmed one-way production snapshot replacement; neither is present in production. Member switching and completed local replacement use the full auth-aware bootstrap reload. Development fixes its API to localhost even if root env files specify production.

## Internal technical dependencies

| Area | Owner | Coupling / purpose |
| --- | --- | --- |
| Browser API | `frontend/api.ts`, `shared/types.ts` | Sole ordinary browser API client and shared request/response types |
| UI system | `style.css`, `frontend/app.css`, `frontend/components.tsx`, `frontend/ClubIdentity.tsx` | Preserve root tokens/primitives; extensions use app.css. Lucide and bundled Lexend Deca; no CSS framework. [STYLE](../STYLE.md) owns design decisions. |
| Domain | `shared/ranking.ts`, `metrics.ts`, `genres.ts`, `identity.ts`, `metadata.ts`, `artwork.ts` | Effective scores, appearance calculations, finite genres, dates/identities, maintenance eligibility and poster sizing |
| Worker boundary | `worker/src/index.ts`, `validation.ts`, `http.ts`, `auth.ts`, `auth-repository.ts` | Routing, safe errors, exact CORS, central mutation guard and D1-backed sessions |
| Persistence/product | `worker/src/repository.ts`, `product-repository.ts`, `worker/migrations/` | One-pass catalogue assembly; bounded film/Session reads; SQL maintenance selection; transactional Builder/rotation/History; versioned schema |
| Providers | `worker/src/services.ts`, `score-service.ts`, `providers/` | Narrow local search, read-only TMDB preview, explicit metadata import/maintenance and score capture |
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

Remote schema, current rotation and provisioning are live state: tracked code cannot certify them. Project data records report the production migration ledger through 0014; current source includes 0015. Recheck live state and pending migrations under authorised release scope. Migration 0015 and negative-only score-check persistence are independently compatible with the existing 0013 score-check table; see [DEPLOYMENT](DEPLOYMENT.md). No live verification is required for ordinary documentation or tests.
