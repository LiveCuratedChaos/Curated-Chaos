# Task and project association checkpoint

Owner decision, November15: a task can belong to several private projects. Every project must reference the same task record; membership never duplicates a task or changes completion, dates, description, priority or checklist.

## Prepared contract

Use separate private membership records, not task copies or embedded lists on both objects. A membership identifies one owner, task and project; uniqueness must hold for each pair, including retry and concurrent-tab attempts. Both target records must be active, private, owned by the signed-in account and supported by the selected workflow. No cross-account or household links.

Link/unlink needs a reviewed summary using displayed titles, an expiring owner/session-bound approval, exact target-state checks, idempotency and guarded storage. Unlink changes membership only. Completed tasks remain eligible and keep their history. Do not infer task completion from project status or change a project automatically when a task completes.

Removal/restoration must not silently reconnect a previously removed task or expose deleted content. Lists must filter both active membership and active target under the same ownership/session checks. Backup/restore must preserve stable references and reject dangling/foreign targets. Arbitrary database IDs must never become browser mutation authority.

## Recurring chore decision

Owner approved carrying the completed occurrence’s active project links into its next occurrence. The completion, successor and new memberships save in one transaction. Existing history and already scheduled occurrences keep their own links; relinking changes only the selected task. Anchored dates and the earlier reopening decision remain intact.

## Implemented and verified

The private Projects panel now has Project tasks: view linked task titles, browse/search all supported private tasks, and review/approve linking or unlinking one task. Several projects reference one task record. No descriptions/checklists are loaded for membership browsing. Protected HTTP/HTTPS routes accept only expiring opaque selected-item tokens; saves consume one approval and never retry automatically after uncertainty.

Separate private `project_task_link` records use the existing record RLS/session protections and archive format. A unique owner/task/project pair includes soft-deleted memberships, so relinking restores the canonical row. Invoker-only validation locks the task and project, prevents cross-account/private-scope/type changes, bounds each task to50 active projects and advances the task revision on membership changes to invalidate stale task/recurrence reviews. Task contents stay unchanged. Removing a task retires its links; restoring it never reconnects them. Linked projects cannot be removed or retyped until tasks are unlinked.

The recurring RPC carries active memberships with fresh link identities and fresh open checklist steps. A failed membership insert rolls back the completion and successor. Exact replay creates nothing. The acknowledgement/re-read checks account for membership-related successor revision changes. No existing source/history task is cloned for ordinary linking.

Recovery archives validate membership targets and reject duplicate or dangling pairs. Restore comparison blocks missing membership targets or occupied pairs. The private-workspace restore tool remains comparison-only; a full archive restore executor, including original-revision handling after membership insertion, is still a release gate. Full-engine snapshot recovery is separate.

Development installation: local CLI-generated migration20261116043700_private_project_task_links.sql is recorded by the connected migration service as20261116045240/private_project_task_links. Do not reapply the older baseline migrations or blindly push this mixed ledger. Rollback-only hosted QA passed8 fictional records/two temporary sessions, including inheritance, replay, restore privacy and missing sessions; final queries verified no QA records or sessions persisted. No real task/project links were created by QA. The launcher enables `--allow-private-project-task-links-reviewed` only on its next ordinary launch; no running owner preview was restarted.

Acceptance:1,755 local checks and58 desktop/narrow-screen browser cases pass. These include selected-token privacy, guarded writes, failed acknowledgements, task preservation, cancelling, unlinking, both-project recurring inheritance and protected HTTPS. Narrow-screen fictional review inspected at /private/tmp/curated-project-task-links-mobile.png with no horizontal overflow. No production, provider, key or backup-file access.

## Separate security review

The existing Supabase-provided public automatic-RLS event helper exposed client EXECUTE grants. Migration20261116045333_restrict_rls_event_helper.sql (hosted ledger20261116045402) removes execution for PUBLIC/anon/authenticated while preserving the enabled event trigger, postgres execution and existing record RLS. An offline event-trigger test proves new tables still receive RLS. Hosted grants and trigger state were verified; both helper advisor warnings cleared.

The remaining development advisor is [compromised-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Treat its availability/configuration as a hosted-release gate; no authentication setting, subscription or live project was changed. Public deployment remains out of scope.

## Progress checkpoint completed

Owner requested a saved option for repeating chores rather than a fixed exclusion policy. PROJECT_PROGRESS.md records both modes, full linked-task counters independent of filtering/paging, stopped-repeat treatment and read-only project title/area/status browsing. All1,766 local/62 browser checks pass. Extended development rollback QA verified option round trips preserve exact tasks and membership snapshots. Next product decision is master/subproject structure: one versus several larger projects per project.

## Cloud project-task detail navigation and recovery

Projects now offers **Open task** for a displayed private task when the already enabled selected-task read scope is available. It opens temporary, explicitly read-only title/date/area/priority/description/checklist details inside the project panel. Browsing remains sparse: descriptions and checklist text are fetched only after the explicit action. Separate opaque read handles are minted for at most the current50-row page and use the existing protected `/tasks/read` route; no raw IDs, new route or schema permission is introduced. Dated metadata is included in the sparse server selection so stale day/version checks remain effective. Identical titles still select different exact task identities.

The dedicated reader context clears on project list changes, membership review/save/cancel, Brief refresh, sign-out/session retirement and disposal. The panel clears old text on refresh, review, close, offline, expiry and account reset; late reads cannot restore it. Unknown response fields and mismatched scope/title/completion, malformed dates/checklists/counts or unbounded expiry fail closed. Rendering escapes literal markup. Background expiry preserves an actively edited project search and its selection while the alert announces expiry. No automatic read/write retry or persistent browser storage is added. Full task editing/completion remains in the existing Tasks workspace; this new in-project view is read-only.

Expired membership views now show an actionable fetch message rather than silently ignoring controls. Acknowledged project/link saves followed by unavailable list refreshes report that verification is unavailable; they do not claim the refreshed results were checked and never repeat the save automatically. Project/list/review/error targets accept programmatic keyboard focus. Calendar Pause restores its enabled replacement button after isolated rendering only when the same session owns the interaction and focus has not moved to an editor or another control.

All new work in this follow-up used fictional/embedded checks. No further hosted change or QA, real task/Calendar/provider read, credential/configuration/backup access, source push, deployment or owner Mac preview change occurred. The earlier approved hierarchy migration remains installed only in the isolated development database. Exact source and complete acceptance counts are recorded in CLOUD_INTEGRATION_2026-11-16.md.
