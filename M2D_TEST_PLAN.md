# Milestone 2D — Calendar acceptance (one test at a time)

1. Launch the M2D package on port 5197 after safe config reuse. Sign into Test Account A.
2. Open Calendar from sidebar/tab: month view is initial default, selected day displays in side panel, and old M1B / Quick Add fictional events and M2C due tasks show on their dates. Select a different date and refresh.
3. Add fictional event “QA 2D - Practice Appointment”, date 2026-11-05, 2:30 PM–3:30 PM, Work calendar, Work category, 15-minute reminder preference. Confirm saved on Nov 5. Refresh and verify.
4. Edit event title or time and save; refresh and verify updated details. No duplicate is created.
5. Switch month/week/day, navigate previous and next, press Today and verify dates. Choose a date and check daily panel.
6. Display & defaults: choose dots month style; hide Work calendar and verify event disappears (not deleted); restore Work. Hide Work category and check again; restore; hide/show due tasks.
7. Set default opening view to Week (then back to Month if preferred); save display preferences, refresh and verify saved values. Reminder selection is a saved metadata field ONLY; this build does not notify.
8. Sign into Test Account B: neither A's calendar event nor A's private preferences visible. Sign back into Account A and verify both remain.
9. Confirm prior Milestone 2C projects, tasks, linked subtasks, 2B Curation widget layout and Daily Brief still work. Verify project status now reads In Progress where older version used Active.
10. Narrow browser to phone width: Calendar grid should not overflow horizontally; tapping a date opens a slide-up selected-day panel, which can be closed; buttons and fields remain usable.

DO NOT enter real employer, school, medical, personal or financial data. This is fictional isolated QA. Calendar providers (iCloud/Google), reminder delivery, push notifications and shared calendar membership are NOT connected.
