# Projects and tasks milestone — local implementation evidence

November 12, 2026. Owner chose projects/tasks as first daily-use priority and Apple Calendar viewing only for the initial calendar milestone. Finance and the rest of the approved scope remain retained. No upgrade, provider scope, real database change or live/owner-preview restart occurred.

## Baseline and reuse

Captured newer main working source as `c021ce6252c8cec9b8b79b7593b115efc372a4de` (486 public source files), parented to the prior `4289489` snapshot. Privacy scan passed; capture verified stable files and unchanged original HEAD/index. Merge `6ecc004` brings newer accepted task, priority, calendar-view/refresh, note, search and other private-preview improvements into the integration branch. Their historical real-data approvals are evidence only, not fresh authorization here.

The reconciled source has 1,625 tests including the durable foundation. One inherited offline-runner test falsely rejected the legitimate `deployment-readiness.test.mjs` filename because it searched every test path for “deploy”. The integration fix preserves the no-deploy/setup/private-command assertions on executed command flags and non-test commands while continuing to require every test input to end in `.test.mjs`. No verifier or deploy command was added to offline execution.

Reused existing organizer enums, section/date/subtask conventions, progress helper, cc_records identity/version trigger and server session/RPC foundation. Fictional model guards remain unchanged. New manual data has explicit source/schema/provenance, and old records are not converted or edited.

## Implemented locally

- Private manual projects: title, summary, status; section fixed after creation.
- Tasks: title, description, due date or undated, priority/status, project assignment, up to40 validated subtasks; complete/reopen and derived project progress.
- Today including overdue, Upcoming, Undated, Completed, open-task All and project filters.
- Explicit routine Save with feedback, page-memory drafts, history summaries and guarded Undo. No extra approval popup for manual edits. Full routine autosave/durable offline drafts remain open requirements, not claimed by this slice.
- Atomic SQL mutation/history/operation receipts, optimistic versions, immutable replay, same-owner/section live-project checks and current-version-only Undo. Undo creation soft-removes an eligible untouched record; it never hard-deletes or overwrites later edits. Replay refreshes current UI records instead of resurrecting an old receipt.
- Actor-derived server commands, CSRF/origin checks, optional production runtime route (default off), bounded paginated RPC, exact revision checks and overall list deadline.
- Private client/session clearing, account-change detection, passive idle verification, deadline clearing and cross-tab sign-out. Confirmed post-write revocation now propagates an ended-session marker while preserving write uncertainty, preventing an ended workspace from keeping a draft visible.
- Disposable, SQL-backed, explicit `--fixtures-only` loopback preview with an asset allowlist. No private configuration, tokens, real records, provider requests or persistent browser storage.

SQL draft009 stays under `supabase/drafts`; it is not applied. It adds private operation/history tables, service-only RPC and a trigger preventing existing browser table grants from bypassing the new manual workflow. Existing cc_records rows remain unchanged. Server secret storage/authoritative production auth and rate limiting still require their staged setup; this module does not manufacture access.

## Verification

Final full suite: **1,671 tests passed; zero failed, cancelled or skipped**. Content privacy and whitespace checks passed. Privacy scanner covers recognized patterns and bounded archives; ten binary copies are explicitly skipped. Final integrated log: `/private/tmp/cc-project-final-release.log`.

Evidence includes actual embedded PostgreSQL schema001+draft009, whole client→HTTP→actor service→SQL project/task/subtask/completion/progress/history/Undo flow, cross-owner/provenance/foreign-project rejection, exact idempotency and mismatch checks, stale versions and Undo, receipt replay after removal without resurrection, unknown-result draft preservation, protected subtask/record extensions, pagination conflicts/deadlines, client generation/account change, post-write revocation and forbidden static asset access. Controller tests include the real model, not only injected permissive stubs. Three worker branches were reviewed and integrated by the lead.

## Browser acceptance remains open

The new fictional page opened in Chrome and showed the empty authenticated demonstration workspace, filters and explicit fictional-data notice. Browser provider discovery returned “Local browser access is unavailable for this chat”. Native accessibility could read the page, but pressing New project did not change the page, and coordinate fallback returned `noWindowsAvailable`. Do not report a completed browser journey, device/mobile acceptance or production readiness from this evidence.

An access/review question is pending. Current fictional preview is `http://127.0.0.1:56289/project-workspace.html`, runtime96619. It was restarted only after confirming zero demo records; no owner preview was stopped. It is disposable and available only while that process/Mac runs. Open/reload the link for the current version; enter invented data only. Do not use it as personal storage.

Browser checklist: create a fictional project; create a task assigned to it; add two subtasks and a date; save; mark complete and inspect Completed/progress; reopen; edit/Undo; create a spare task and Undo its creation; inspect history; switch filters; ensure a draft cannot be silently replaced; sign out and confirm cards/drafts clear. Check keyboard navigation and narrow layout. Finish this before requesting owner-preview activation.

## Next external gate, not yet authorized

After browser acceptance, prepare a concrete development-only SQL009 installation and rollback-only two-record test (one fictional project, one task, temporary history/operation rows in the same rolled-back transaction). Verify exact target, existing schema state, service identity/secret custody and that no existing manual rows will be read or changed. Production data, provider refresh and Calendar edits stay excluded. Installation, any real connection/credential setup, hosted fixture execution and owner-preview promotion require the applicable bounded approval; no purchase is needed for local checks. Do not infer these approvals from this document.

The shared record/source contract can then compose manual tasks with the existing calendar viewing and Brief. Existing QA tasks and saved-source snapshots are not silently reclassified or copied. This is implemented local capability with open browser/hosted/integration gates, not the finished daily-use milestone or full product.
