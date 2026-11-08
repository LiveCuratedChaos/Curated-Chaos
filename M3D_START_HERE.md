# Curated Chaos — Milestone 3D, Phase 1: Quick Add & Optional Due Dates

This package builds on the M3C Navigation Save Fix package. All earlier development pages, Supabase tables, and account isolation are retained. Do not delete previous folders or database records.

## Install (Mac)
1. Unzip this package on your Desktop. Folder: `Curated_Chaos_Development_Starter_M3D_Tasks`.
2. Quit/stop the existing 3C server with Control+C in its Terminal window.
3. In Terminal, run:
   `cd "$HOME/Desktop/Curated_Chaos_Development_Starter_M3D_Tasks"`
4. Reuse your existing *local* development credentials without copying them into chat:
   `cp "$HOME/Desktop/Curated_Chaos_Development_Starter_M3C_Navigation/.env.local" .env.local`
5. Run `npm run setup:reuse` if you don't already have `dev-config.json` (the setup reuses local credentials; it does not modify Supabase schema).
6. Run `PORT=5214 npm start` and open `http://localhost:5214/dev-organize.html#quick-add`.

## Phase 1 tests
1. Sign in to fictional Account A. Create a task using **title only**. Save. Under Tasks, the new task should display **No due date**.
2. Edit that task, add a due date, save, then clear the date and save again. It should remain visible.
3. Add a subtask, toggle its checkbox, refresh, and confirm it persists.
4. Verify your previous projects/tasks are intact. Sign into fictional Account B and confirm that Account A's task is not visible.

**Scope note**: Undated tasks are visible in the Tasks & Projects workspace. The earlier date-based Daily Brief/Calendar screens continue to show dated tasks only. This phase doesn't add recurrence, task deletion, or live account integrations. Later 3D refinements can bring undated task summaries into other views.

## Safety
Only use fictional data in this development environment. No production credentials should be shared in chat.
