# Milestone 2H — Home & Household foundation (fictional QA only)

No database migration. The existing cc_records Home section is used with visibility private and no household_id. Account isolation is retained. No sharing in this build.

## Setup
Extract to Desktop; copy `.env.local` from the last working M2G folder locally (never upload or share secrets). Run `npm test`; start with `PORT=5204 npm start`, then visit http://localhost:5204/dev-home.html.

## Acceptance
1. Sign in with Account A; Home page opens with Cleaning, Groceries, Maintenance, Deliveries.
2. Create a fictional Cleaning item called Test Kitchen Reset; save and refresh.
3. Add steps Wipe counters and Put away supplies; complete first and refresh.
4. Add a fictional Grocery List, Maintenance item, and Delivery item, each with name only. Refresh.
5. Visit School, Work, Personal, Calendar; ensure prior data remains visible.
6. Sign in to Account B separately; Account A's four household test records remain invisible. Recheck Account A.

## Deferred
Recurring schedules, quantities and favorites, warranties and usage schedules, returns/refunds, optional deadlines and reminders, household permissions and sharing, draggable widgets and activity logs. These are not live.
