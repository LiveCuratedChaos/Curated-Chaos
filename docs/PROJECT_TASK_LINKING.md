# Task and project association checkpoint

Owner decision, November15: a task can belong to several private projects. Every project must reference the same task record; membership never duplicates a task or changes completion, dates, description, priority or checklist.

## Prepared contract

Use separate private membership records, not task copies or embedded lists on both objects. A membership identifies one owner, task and project; uniqueness must hold for each pair, including retry and concurrent-tab attempts. Both target records must be active, private, owned by the signed-in account and supported by the selected workflow. No cross-account or household links.

Link/unlink needs a reviewed summary using displayed titles, an expiring owner/session-bound approval, exact target-state checks, idempotency and guarded storage. Unlink changes membership only. Completed tasks remain eligible and keep their history. Do not infer task completion from project status or change a project automatically when a task completes.

Removal/restoration must not silently reconnect a previously removed task or expose deleted content. Lists must filter both active membership and active target under the same ownership/session checks. Backup/restore must preserve stable references and reject dangling/foreign targets. Arbitrary database IDs must never become browser mutation authority.

## Product boundary still needed

Recurring chores create a new task occurrence. Before enabling reviewed linking, establish how project membership carries into the next occurrence and whether later relinking affects only the current occurrence or the series. This is separate from the already-decided anchored date schedule and keeping the successor when reopening history.

## Remaining implementation

Prepare and test atomic membership storage and rollback QA before development installation; add selected-task project review UI and selected-project task lists; check stale edits, repeat approval, account privacy, missing sessions and recovery. This document is a design contract only; no membership records, schema, task associations or automation have been created or enabled.
