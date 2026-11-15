# Curated Chaos — M3D Phase 2

## Local continuation — individual subtask editing

In Tasks & Projects, open Edit task to rename existing subtasks or select individual steps for removal, then choose Save subtask changes. Completion checkmarks and unrelated task/add-subtask drafts are preserved. Removal applies only when saved; Cancel discards unsaved edits. Updates still require the latest record version. No schema changes are required.

An offline fictional browser preview verified rename/removal, preserved completion, draft retention during completion changes, and blank-title rejection. These checks made no database requests; cloud persistence and account isolation remain to be verified separately with owner approval. See docs/COMPLETION_PLAN.md for the delivery sequence.

This release builds on M3D Phase 1, with no Supabase schema changes.

## New: multi-subtask editing

- Open Tasks & Projects > Tasks, then Edit task.
- Under Add subtasks, enter a title, use '+ Add another subtask' or Enter in the last field for additional titles.
- Select 'Save all subtasks' once to save all entered titles together.
- The editor remains open after a confirmed save, and the page attempts to retain your scroll position.
- Existing subtasks and their completion flags remain unchanged.
- Existing record ownership/version checks still run before cloud updates.
- Up to 40 subtasks per task (including existing ones).

## On your Mac

1. Extract this ZIP onto the Desktop as Curated_Chaos_Development_Starter_M3D_Phase2.
2. Stop the Phase 1 server (Control+C).
3. Run:

   cd "$HOME/Desktop/Curated_Chaos_Development_Starter_M3D_Phase2"
   cp "$HOME/Desktop/Curated_Chaos_Development_Starter_M3D_Tasks/.env.local" .env.local
   PORT=5215 npm start

4. Open http://localhost:5215/dev-organize.html

Never send or paste your .env.local file or credentials.

## Acceptance test

Sign into test Account A. Open an existing test task, click Edit task, add three new subtasks before saving, save once, and verify editor remains open and scroll doesn't jump to top. Refresh and verify all subtasks remain. Mark one checked, refresh, verify it stays checked. Verify preexisting tasks and account B separation as before.

## Local reliability fixes and manual regression checks

No schema changes or record migration are needed. Existing saved records are retained.

- Legacy Tasks QA and Daily Brief completion now require the record version read by that screen. Refresh after a conflict; stale pages cannot overwrite newer task payloads.
- Subtask drafts and unsaved task details stay in memory through failed saves. Only confirmed subtask saves clear their draft fields. Refreshing or leaving the page still discards unsaved text.
- Record lists now load stable pages instead of silently stopping at the old per-screen limit. This is not a transactional snapshot; refresh after concurrent changes.
- Static preview/assets no longer depend on local cloud configuration.

Run `npm test` with an existing Node 18+ installation. No dependency installation is required.

Browser acceptance (fictional accounts only):
1. Add three subtasks in one save. Confirm old flags remain, the editor stays open, scroll is retained, and refresh shows the saved items.
2. Enter unsaved task details, then save subtasks. Confirm the unsaved details remain available and are saved only with Save changes.
3. Disconnect the browser network after typing subtask drafts, attempt a save, and confirm the drafts remain. Restore the network and fetch latest before retrying an uncertain save to avoid duplicates.
4. Open a task in two tabs. Save a change in one, then attempt completion from the stale Tasks QA/Daily Brief tab. It must reject the stale update; refresh and check the newer details/subtasks remain.
5. Test the 40-subtask boundary, including tasks with existing subtasks. Excess additions must not partially save.
6. Verify filters retain their selected values, project progress is correct, and older records remain accessible when there are more than 250 records.
7. Verify Account B separation, keyboard use, and phone/tablet layouts. These require manual browser testing and have not been certified by offline tests.
