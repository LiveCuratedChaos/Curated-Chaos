# Private project basics

The private Tasks workspace now includes an explicitly enabled Projects panel. View projects loads only private project titles, areas and status. Open project retrieves its details into an editable draft. Create and edit both require a server-verified review followed by explicit approval. Project statuses are Planned, In Progress, On hold and Completed (the saved value for In Progress remains `Active`); areas are Home, Personal Life, Work and School.

The initial checkpoint organizes project information only; the subsequent task-linking checkpoint is described in PROJECT_TASK_LINKING.md. Project information edits do not complete, reschedule or share tasks. It does not add household access, deletion, providers, AI processing or a new database schema.

## Protection and acceptance

- Project APIs are off by default. The development launcher enables `--allow-private-projects-reviewed` on its next normal launch; a running workspace is never stopped to activate it.
- Existing private-record ownership and active-session policies apply. Lists omit descriptions; details require an opaque selected-project token. Browser responses contain no database identity or provider credentials.
- Reviews are owner/context-bound, expire after five minutes and can be approved once. Inserts never upsert; edits match the selected version. Stale changes and unknown payload extensions are rejected rather than overwritten.
- A lost acknowledgement consumes approval without automatic retry. The browser keeps a locked, copyable draft so the owner can inspect saved projects before trying again. Sign-out, changed-account and page-hide handling clear private state.
- Project drafts block other workspace editing and saved-search actions. All user text is escaped, with exact description whitespace preserved.
- Generic encrypted private-workspace archives already include project records. An offline round-trip with a fictional key verifies this; no real archive/key was opened for this checkpoint.
- A one-project, two-session rollback-only acceptance transaction passed in the separate development database. It checked creation, exact identity collision rejection, versioned editing, stale edits, other-account privacy and missing-session denial. Final queries verified no QA project or sessions persisted. No policies, migrations or existing records changed.

Local automated checks cover model/service, sparse API transport, protected HTTP routes, cancelled late responses and database rollback. Desktop/narrow-screen fictional browser checks cover reviewed creation and editing, literal markup, retained drafts, accessible labels and the protected HTTPS transport. These are automated checks, not complete physical-device or screen-reader certification.

## Next checkpoint

Reviewed task linking is implemented; see PROJECT_TASK_LINKING.md for multi-project identity, recurring inheritance, development installation and recovery protections. Shared projects, hierarchy, project progress and cross-app placement remain later blueprint work.

## Progress and project filters

PROJECT_PROGRESS.md records the optional saved repeating-chore progress mode, complete linked-task counts and title/area/status project browsing. Both modes preserve links and manual project status; default legacy/new-draft display is separate. No data or schema migration is needed.


## Approved archive behavior — November 16, 2026

The owner additionally confirmed that archiving affects only the selected project. Do not cascade archive or reopen to subprojects, including shared subprojects attached to other parents.

The owner selected: archived subprojects keep contributing to their parent projects until explicitly unlinked. Archiving must preserve task memberships and project hierarchy relationships, shared-task deduplication, completion flags and the parent project's repeating-chore progress policy. It must not mark incomplete tasks complete or change other projects.

Archive is separate from deletion, unlinking and completion status. Preserve the project's existing status so reopening can restore the same work state. Current project deletion guards remain intact. An archive implementation must provide a way to find and reopen archived projects, clearly explain retained progress contributions in review, retain drafts on unconfirmed writes, and require the existing reviewed save flow. The isolated candidate implements this using an optional boolean archive flag through the existing reviewed project save flow. New and legacy projects default to current; the browser offers Current projects, Archived projects and All projects views. Reopening clears only the archive flag. No deletion, schema change or owner-runtime activation is implied.


## Optional project target dates

The isolated candidate supports a date-only project target date through the existing reviewed project save flow. Leave it blank for no target date. Existing undated projects need no migration; unrelated edits preserve an existing target date when the field is omitted, while an explicit blank clears it. Strict real-date validation covers 2000–2100, including leap years. Lists remain sparse and show only the target date alongside project status; descriptions still load on explicit Open project.

Target dates survive archive/reopen and appear in reviews and retained drafts. Saving a project date does not change linked task dates, create duplicate events or move calendar commitments. Automatic internal project-deadline Calendar presentation remains part of the wider approved Calendar work; it is not claimed by this metadata/editor increment. Existing ownership, version, one-use review and uncertain-save protections apply. No schema or real-record change or owner-runtime activation is part of this candidate.

## Calendar target markers — approved archive visibility

The owner confirmed that archived project target dates are hidden from Calendar by default while their links and parent-progress contributions remain intact. The isolated Calendar candidate derives read-only all-day markers from the existing private-project title/date scope; no event rows, copies, provider reads or writes are created. Undated and archived projects produce no markers. Reopening a dated project makes its target eligible again on Fetch latest.

Markers share the event list's date/title filters, ordering, fifty-row paging, complete month counts and five-minute freshness ceiling. Each project identity appears once regardless of parent paths. They are explicitly labeled Project target with their source area, and receive no event edit/detail or removal capability. Change the target date in Projects. General title search and Daily Brief retain their existing record scope; Calendar shortcuts apply their same filters to Calendar's event/target projection, as explained in the UI.

The existing project read scope must be enabled before Calendar reads sparse project metadata. Source failure, invalid/foreign/deleted/shared/duplicate project rows, unsupported dates or a combined result over the existing 2,000-row technical bound fail closed rather than display a partial success. Missing date fields remain valid legacy undated projects. Calendar does not change project status, tasks, links, recurrence, hierarchy or progress. Physical-device acceptance and richer category/filter controls remain in the full product scope.
