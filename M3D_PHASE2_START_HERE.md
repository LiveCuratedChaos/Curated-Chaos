# Curated Chaos — M3D Phase 2

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
