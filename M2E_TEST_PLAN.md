# Milestone 2E — School foundation (development QA)

This package preserves M2D. It uses the existing isolated development Supabase `cc_records` table. No database migration, official degree-plan import, real WGU connection, or AI Concierge automation is included.

## Setup
1. Unzip as a new folder. Copy `.env.local` from your **local** M2D folder into this M2E folder. NEVER upload this file or share it.
2. Open Terminal in the M2E folder and run `npm test`, then `PORT=5198 npm start`.
3. Visit `http://localhost:5198/dev-school.html` and sign in using your isolated development test account.

## Acceptance checklist
- School navigation reaches School workspace from The Curation.
- You can add a practice course with code, title, program, credits, official order, independent study order, and target date.
- You can add assessment titles/types/statuses and save.
- Completed courses contribute to course count and earned practice credits; completed assessments appear in the counter.
- Edit an existing course, refresh, and confirm changes persist.
- Sign out, then sign in to the OTHER development test account; private practice records must not appear.
- Return to Calendar and Tasks & Projects; previous functionality still works.

## Not implemented yet
Official WGU catalog import, syllabus parsing, connected degree credits, fully flexible assessments, AI Concierge, school widget on The Curation, or real student data. Do not present practice totals as official degree progress.
