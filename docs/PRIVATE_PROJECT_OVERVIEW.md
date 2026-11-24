# Current private projects in Daily Brief

November17 checkpoint. This increment connects one actual protected domain source to the Brief. It does not complete the configurable Brief, cross-domain intelligence, household inputs or historical snapshots. The authoritative release status remains R16/R17 in RELEASE_CHECKLIST.md.

The Daily Brief requests an independent read-only `projects/overview` only when private Projects is enabled. Task, Note and Calendar workspaces do not request it. Existing private project summaries supply the complete bounded inventory: total, open and completed counts, plus up to five open projects in title order. Planned, Active and On hold are open; Completed is counted separately. This never invents due dates, task progress, recommendations or project status changes.

The section explicitly describes **current saved project state**, even when the Brief's selected date is in the past. It does not claim a historical snapshot. Completed projects stay saved and accessible in Projects; excluding them from this short open list changes no records. Additional open projects are counted and described as available in Tasks.

## Privacy and failure handling

`server/private-project-overview.mjs` reuses exact private project owner/origin/schema/version checks, rejects duplicate identities and bounds the complete source to2,000 rows. Only displayed rows receive opaque read handles. Descriptions, raw record IDs, relationships and task contents are absent from the overview. Counts and fields are verified again by `src/private-project-overview.mjs` before display.

The route requires both private-project and Brief scopes, active cookie sign-in, exact origin and CSRF. It accepts no caller-supplied owner, record ID or filters. Its reader is separate from universal search and editable Projects selections. The existing selected-project read route resolves either read-only context, verifies current owner/session and exact version/title/status/area, and cannot authorize writes.

New overview requests invalidate previous overview reads. A per-context sequence prevents a slower superseded request from replacing newer capabilities, including an empty response. Brief refresh, project actions and session retirement invalidate them too. The direct-TLS candidate preserves the same inner gates and transport protections.

An unavailable or malformed optional project source returns only `{available:false}` from an otherwise verified session. It does not fabricate zero projects, a successful check time, or fail the core tasks/events. A browser transport/validation failure must confirm the same active owner before showing the unavailable fallback; inability to verify identity clears private content through the existing sign-in boundary.

Overview and detail capabilities last at most five minutes. Expiry updates only the overview region, preserving focus elsewhere. Expired source handles cannot reopen details. A late details response notifies the controller to remove its loading shell even after source expiry; background renders preserve an edited field's value/cursor without stealing newer focus. Offline, tab hiding, sign-out, account changes and disposal clear the section/details. Literal descriptions remain escaped and load only on selection.

## Verification and recovery

All2,040 local tests pass, zero failures/skips/cancellations; privacy/content, whitespace and launcher checks pass. New checks cover overview privacy/counts/caps/empty/unavailable states, disabled scopes, source failure isolation, exact selected reads without edit authority, superseded-request ordering, independent search/Brief capabilities through HTTPS, controller integration, revoked-owner fallback and no typed-workspace fetch. Focused selected-detail checks cover source disappearance and late-shell clearing.

Fictional browser acceptance created one Active and one Completed project, navigated to Daily Brief, verified1 open/1 completed with only the open title displayed, opened exact multiline/literal text on demand, inspected390px layout with scrollWidth375, and confirmed sign-out clearing. The fictional session/tab/server closed.96 desktop/narrow browser executions are prepared; standalone Chromium remains restricted. This is not96 automated passes, physical-device acceptance, real-account acceptance or a production release.

No database migration, provider read, real record/archive/key/credential access, owner app restart/launcher change, hosted CI, branch switch/reset/publication, purchase or deployment occurred. Source rollback disables only the new overview fetch/section/route and its read context; preserve shared project/search reader behavior, the TLS boundary and earlier uncommitted Calendar/recovery work. No records require reversal.

Remaining work includes per-profile section/category/household selection, ordering/collapse/hide settings, narrative/tone/length controls, other authorized domain sources, source links, scheduled/change-triggered refresh, history/snapshots, realistic volume and real device/access acceptance. All remain in the approved release.
