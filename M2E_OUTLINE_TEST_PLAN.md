# Curated Chaos — M2E Outline / Focus acceptance test

This is a fictional, owner-private development build. It does not import your WGU course plan or sync to Google/iCloud.

1. Open `/dev-school.html` and sign in with your existing development account.
2. Click **+ Degree / project** and enter only `Practice Degree 2`.
3. Click **Add class** under that degree and enter only `Practice Class 2`.
4. Switch to **Outline**; expand the class and add `Assignment A`.
5. Expand Assignment A and use **+ Step** to add `Research`, `Draft`, and `Revision`.
6. Switch to **Focus Widgets**, choose the new class, and tick `Research`.
7. Switch back to Outline and verify `Research` remains checked. Refresh the page and verify again.
8. In the class Focus Widget, use **+ Study session**. Save a fictional session and confirm it appears in the School-only planner, but not the main Calendar.
9. Open **Progress settings** on the degree to choose classes, credits, or terms, with optional totals.
10. Confirm existing practice courses are still visible. Do not enter real records in this fictional QA environment.

### Limitations of this stage
- Multiple programs are supported as separate degree records, with class linkage by matching program name. Avoid renaming degree projects in this build.
- Focus mode shows one selected class widget at a time; configurable multi-widget dashboard placement and the interactive mini month-calendar are future work.
- Assessment type, attachments, scheduled reminders, official WGU import, and live external calendar sync are not implemented in this build.
- Updates go to the existing development Supabase `cc_records` table and use version-guarded, private records. No SQL migrations required.
- Never upload your `.env.local` or actual test account passwords.
