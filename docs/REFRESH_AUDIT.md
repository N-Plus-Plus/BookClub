# Refresh audit

Actioned 5 October 2026 against current main (`8ec6193`), preserving existing uncommitted UI revisions. This document describes the current implementation; the earlier cleanup recommendations are complete. Review was source-only: no tests, typecheck, build, prod:check, browser automation or production access.

## Current controls

There is no routine member-facing manual freshness control. The page-heading **Refresh BookClub data** action is removed without replacement.

| Area | Current behaviour |
| --- | --- |
| App load failure with a loaded catalogue | **Try again** calls `App.load()` only after a load failure, preserving the last loaded journal. Load errors are separate from auth/action errors, so a failed logout does not offer a catalogue retry. |
| App / Detail initial load failure | **Couldn't load this view** → **Retry** remains conditional error recovery. |
| Sign-in | **Retry Google sign-in** and **Retry BookClub connection** remain failure-only explicit recovery; neither creates an automatic retry loop. Connection recovery rereads BookClub state rather than resubmitting a Google credential. |
| Detail Seen answers / Classics membership | Failed writes retain their targeted Retry actions and last confirmed data. Membership remains available to ordinary members behind **Classics membership**. |
| Detail score maintenance | **Admin · score maintenance** contains **Refresh scores**, provider feedback, score failure, **Check saved film data** and failed reconciliation retry. Saved-data reads are failure recovery, not routine refresh. |
| Classics Needs Data | Candidate rows and film links remain visible to members. Per-film **Refresh scores** and feedback are behind an admin-only disclosure. |
| Classics bulk maintenance | Admin **Enrich up to 10 films** remains explicit, bounded provider capture. |
| Metrics maintenance | Admin **Fill missing metadata** and **Stop after this batch** retain their sequencing, lightweight metadata path and one final automatic catalogue read. |
| Local developer maintenance | **Refresh Dev DB from Production** and **Confirm local replacement** retain their existing guards and explicit confirmation. This workflow was not executed. |

Score maintenance visibility is admin-only in the UI; existing API authorisation, provider semantics and cooldowns are unchanged. No provider capture occurs merely by opening Detail or Needs Data.

## Automatic updates after confirmed changes

`App.load()` remains generation-guarded: health/auth gating precedes concurrent catalogue and rotation reads. Failed reads preserve usable loaded data; 401 handling resets authentication. Its caught failures do not reject the returned promise.

| Action | State update |
| --- | --- |
| Initial mount, successful sign-in, avatar completion | Existing automatic `App.load()`; avatar completion also applies returned viewer. |
| Seen answers, Undo and corrections | Returned movie patches catalogue movies and matching session references; Detail also applies its local movie. |
| Detail Classics membership, score capture and saved-data recovery | Returned movie patches Detail and catalogue. |
| Classics single/bulk score capture | Each returned movie patches catalogue and derived rankings. |
| FilmPicker creation/import | Returned movie patches catalogue and editor selection. |
| Builder save/delete/review | Existing local sets and editing updates/reads. |
| Event save, History deletion, rotation correction, Builder publication | Existing automatic catalogue/rotation reads; event save also patches its confirmed session. |
| Metrics metadata maintenance | Local progress updates per batch, then one final `App.load()` after completion, stop or failure. |
| Developer identity change / successful local replacement | Existing automatic `App.load()`. |

These are confirmed-response updates, not speculative writes. No successful app mutation requires a member to manually refresh.

## Deliberate staleness and narrow reads

Home, History, Classics, Seen It? and Metrics use the global catalogue snapshot. Event forms also seed from that snapshot. Changes from another device/session may remain stale until full document reload. Hash navigation only changes the page, scroll and heading focus; it does not reread the catalogue.

Detail retains its keyed mount/re-entry movie read. Its initial read updates only local Detail state; writes and saved-data recovery patch both local and catalogue state. Builder retains its mount/viewer reads of private sets. `App.load()` does not reload an already mounted Detail movie or Builder sets/form.

History Audit retains lazy per-entry evidence reads and caching, with reopening after a failed read recovering the request. Avatar availability remains once per chooser interaction. FilmPicker retains explicit query-driven search.

Stored provider scores and metadata remain snapshots until explicit maintenance; document reload reads saved observations without contacting providers.

No catalogue polling, websockets, focus/visibility refresh, service workers or route-entry global refresh was added. Existing developer replacement status polling and user-started bounded metadata batches remain intentional maintenance operations.

Source search of frontend refresh/reload labels and `RefreshCw` actions found only conditional error recovery and admin/developer maintenance after removal of the heading action. STYLE.md records the lasting freshness rule.
