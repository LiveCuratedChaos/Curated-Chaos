# Project progress and browsing

Owner decision, November16,2026: make separation of repeating chores an option while preserving their project links.

## Saved option

Open project includes Repeating chores in progress, with Show separately; keep linked and Include in completion percentage. This is saved per project as the optional boolean `payload.separateRecurring`, through the existing explicit review/approval flow. New drafts and legacy projects without the option display separate mode by default. Existing rows are not rewritten automatically. Invalid option values and unknown project fields are rejected; schemaVersion1 and the existing archive format remain compatible.

Project metadata saving changes only the selected project. Task contents, membership identities, recurrence dates/history and project status remain unchanged. Stale project reviews and uncertain acknowledgements retain the existing one-use/no-retry protections. A retained copyable project draft includes its selected progress mode.

## Complete counts

Project tasks displays a completion bar and counted/completed totals over all active linked task records, independent of search filters and the current50-row page. The service validates every fetched task/membership and fails instead of showing a partial result above its existing2000-record bound. Each linked task identity contributes once per project.

An ongoing repeating task has the supported saved recurrence schedule/series metadata and is not stopped. This includes completed history and a scheduled next occurrence. In separate mode, these occurrences remain linked and visible but do not enter the completion denominator; their own completed/total counts remain visible. Stopped repeats count as regular tasks. Include mode counts every active linked occurrence, including history. No counted tasks means no percentage, rather than100 percent. Other percentages round to the nearest integer. Progress never changes the manually selected project status.

Sparse task/project queries add only recurrence metadata, the stopped flag and the saved option. Task descriptions/checklists and project descriptions are not needed for progress. Internal series/database identifiers stay on the server. Browser summaries carry validated counts and a repeating/non-repeating label only; malformed or inconsistent counters are rejected.

## Project browsing

The project list now filters by title, area and status before its50-row pagination. Title matching is case-insensitive with Unicode normalization. Filters require an explicit apply action and can be cleared without writes. Saving preserves current filters; a project may disappear from that view when its title/area/status no longer matches. Ordinary task and membership behavior remains independent.

## Acceptance and limits

All1,766 local checks and62 desktop/narrow-screen fictional browser cases pass. Coverage includes both saved modes, legacy defaults, stopped/invalid recurrence, empty projects, rounding,60 linked tasks across pages, filter-independent progress, reviewed saves, exact membership/task preservation, fake-key encrypted archive round-trip, option transport, filtering and accessible native progress controls.

Extended the existing rollback-only development QA to switch a fictional project's option false/true and compare exact task/membership snapshots. It passed in separate project fngauurauwvbawlfzbbe; final queries confirmed no QA records or sessions persisted. It uses8 fictional records/two temporary sessions, creates no accounts and changes no existing records. No schema, RLS, authentication/provider setting or real backup/key change was needed. The running owner workspace was not restarted; current code loads on its next normal launch.

Narrow-screen fictional progress reviewed at /private/tmp/curated-project-progress-mobile.png, with no horizontal overflow. Automated Chromium/axe checks are partial evidence; physical Safari/iPhone and full screen-reader release acceptance remain open.

Next core checkpoint: master/subproject structure. Establish whether a smaller project may belong to one larger project or several before defining membership uniqueness, cycle protection and roll-up behavior. No hierarchy behavior is enabled or assumed.

## Cloud hierarchy follow-up

The owner approved several larger projects per subproject. The isolated cloud implementation and unapplied storage draft are documented in PROJECT_HIERARCHY.md; the earlier pending one-versus-several question is resolved. Direct project task progress remains available alongside explicitly labeled deduplicated hierarchy progress. No hosted activation is implied.
