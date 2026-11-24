# Read-only Calendar day schedule

Verified November17,2026. RELEASE_CHECKLIST.md is authoritative. This is the bounded selected-day schedule workflow under R21, not completion of remaining Calendar connections, category/household filters, destinations or synchronization.

## Workflow and preservation

With the explicit day-read scope enabled, selecting an available month date opens its saved schedule while the parent month, applied title filter, date bounds and main event actions stay intact. The drawer is a modeless desktop side panel or narrow-screen bottom sheet. It shows complete matching counts, up to50 events per page, all-day/continuing/multiday labels and honest unsupported/date-unavailable warnings. An empty verified day differs from a failed/disconnected/expired read. Previous/Next schedule controls browse every matching event without replacing the month. Close returns focus to the selected date.

Event descriptions and locations are not read in the list. Open schedule event performs a separate protected current-record read. Exact title/date/time/version and schedule must still match. Newlines/literal markup are preserved as escaped text in a CSP-compatible preformatted region. Missing optional range flags from narrower readers are normalized only to ordinary timed/single-date defaults; incompatible all-day/range replies are refused. No event editing or removal is offered by this reader. Existing edits remain available in the main event list.

## Read-only authority and lifecycle

`server/private-calendar-day.mjs` reuses the existing event search and selected-event validation with an internal get-only API facade. Its returned interface has no prepare/authorize/save methods. Served `eventReadToken` capabilities are never registered with the event editing resolver and cannot authorize edit-read/edit-review. The day reader is separate from month/Brief edit handles, so opening it does not invalidate the main list's capabilities.

Each page uses one bounded owner-private inventory read. Model validation enforces exact fields, supported dates, canonical title filters,50-row paging, full counts, event order/overlap and unique bounded opaque capabilities. Views/details expire within five minutes and no later than the session. New selections, parent Calendar queries, refresh, close/reset, offline, sign-out and disposal supersede old replies. Revoked sessions and changed/deleted/foreign selected records never disclose a body. Active drafts and pending saved changes block date reading; pending day reads block competing source/edit actions until closed or settled. Nothing is queued or automatically retried.

The default-off `--allow-private-calendar-day-read` requires the full private Calendar workspace. The owner launcher remains unchanged. Static config/client/entry and loopback/direct-TLS routes retain exact origin, cookie, CSRF and session boundaries. Without the flag, the previous date-to-list behavior remains. New reader access is confined to the enabled Calendar page and saved workspace records; no external calendar refresh/write or new provider scope is introduced.

## Acceptance

All2,226 local tests pass with zero failures/skips/cancellations; privacy/content, whitespace and launcher syntax checks pass. Coverage includes model/service/panel/controller, HTTP/HTTPS/CLI scope, overlap/midnight,120-record paging, selected details, foreign/deleted/stale rows, authority separation, preserved main handles, parent-query retirement, expiry, pending/late close/logout/revocation, optional range compatibility, exact detail text and draft guards. Independent review found no required fixes after optional-flag/same-day range compatibility corrections.

Fictional browser acceptance created one reviewed event with a location and two-line literal-markup details, opened November1 without changing November1–30 parent bounds, read the details only after selection, verified the bottom-sheet layout at390px (document375px; drawer366px), opened an empty date, and verified sign-out clearing. A separate disposable120-event inventory verified a60-event date as50then10 rows with correct Next/Previous state. The desktop drawer was420px wide at the right of a1280px viewport. Fixture sessions, tabs and server were stopped/cleared and viewport reset.106 desktop/narrow browser cases are prepared/discovered, not claimed executed; the standalone Chromium restriction and physical-device acceptance remain.

## Recovery and remaining work

No schema migration or real data rewrite is needed. Disable the new day-read flag to return to the earlier date-list path. Day tokens are temporary, server-side, separately scoped and expire naturally. Source rollback must remove only this feature's additions from shared files, preserving prior Calendar/Brief/hierarchy/recovery work. Do not restore whole shared files from an earlier checkpoint.

No actual private record/provider/credential/archive/key/schema/production change, owner app restart/launcher activation, hosted CI, branch switch/reset/publication, spending or deployment occurred. All other approved release scope remains required.
