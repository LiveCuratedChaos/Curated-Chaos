# Milestone 2F — Work & Career foundation (fictional QA only)

## Quick start
Copy `.env.local` from the previously working M2E folder into this new folder. Never upload/share this file.

`npm test` then `PORT=5202 npm start`. Open `http://localhost:5202/dev-work.html`.

## Acceptance test
1. Login with Development Account A. Work page and navigation load.
2. Add one fictional Work project by title. Confirm it appears and persists after refresh.
3. Add one fictional Work task with due date; check it complete, refresh and verify.
4. Add one fictional Career Development item. Verify it appears under Career and stays after refresh.
5. Check Tasks & Projects: the Work task/project are backed by existing cc_records; verify without editing real information.
6. Incognito Account B cannot see Account A's Work items. Account A retains its records.

Do not use real employers, investigative case information, identities, internal records, or sensitive material.

## Deferred
Work schedules, shift/time-off calendars, notes, configurable status pipelines, granular job applications, linked subtasks and widget customization. No new SQL migrations.
