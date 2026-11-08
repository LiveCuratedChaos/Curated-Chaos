# Curated Chaos — Milestone 2E School project hierarchy (QA)

This is a development test package, not a production School integration.

## What changed
- Degree Completion: groups courses by program, treating each program as the main project.
- Current Class: shows an in-progress or next unfinished class as a mini-project, with assessments and nested checklist subtasks.
- Study Planner: supports up to three private practice study blocks per course and lists them chronologically. These blocks do **not** sync to the main Calendar.
- The existing course management form now includes assessment subtasks and study dates/times. Official order and independent study order remain editable.
- No real WGU information is automatically imported; only manually entered fictional test records should be used at this stage.

## Start on Mac
1. Extract this ZIP to Desktop.
2. Copy `.env.local` from your old `Curated_Chaos_Development_Starter_M2D` directory into this extracted directory. Never share that configuration file.
3. Open Terminal and enter:
   `cd "$HOME/Desktop/Curated_Chaos_Development_Starter_M2E_Project_School"`
   `npm test`
   `PORT=5199 npm start`
4. Visit `http://localhost:5199/dev-school.html` using a development test account.
5. Leave Terminal open while testing.

## Acceptance tests
1. Page loads and you can sign into your development test account.
2. Add a fictional course in a test degree program; it appears under Degree Completion.
3. Edit the course status to In Progress and add a fictional assessment, including at least one subtask; it appears under Current Class.
4. Add a practice study date, time and title; it appears under the separate Study Planner.
5. Refresh and confirm the saved records remain.
6. Verify your main Calendar does not show the private study block.
7. If you have a second development test account, confirm it cannot view the first account's records.

Note: This iteration shows a chronological study schedule, not a month-grid mini calendar yet. More complex calendar interaction, program defaults, and editable completed checklists are planned for subsequent iterations. Do not mark full 2E complete until your acceptance tests pass.
