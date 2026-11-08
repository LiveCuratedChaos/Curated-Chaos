# Milestone 2G — Personal Life foundation

Fictional development tests only. No real personal sensitive information. No new SQL migrations.

## Setup
Copy `.env.local` locally from your working M2F folder (never share it). Run `npm test`, then `PORT=5203 npm start`, open http://localhost:5203/dev-personal.html.

## Acceptance tests
1. Sign in with Account A. Personal Life page loads from sidebar.
2. Add a fictional project named Test Home Refresh; refresh, verify it remains.
3. Expand project; add a step named Sort Supplies; check complete, refresh, verify.
4. Add a fictional Goal, List, and Routine with a name only; verify each category filter and persistence.
5. Check the Work and School pages still open, and existing records remain.
6. Sign in to Account B in Incognito: none of Account A Personal Life entries appear; Account A records are intact.

## Deferred
Optional due dates, goal milestones, list item collaboration, recurring routine timing, cleaning/maintenance, groceries, delivery tracking, freely configured widgets, household sharing and detailed project linking. These are not implemented by this foundation.
