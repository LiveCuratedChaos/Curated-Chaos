# Milestone 2L — Final integration & acceptance (fictional development)

This is an end-to-end **regression gate**, not a release or a production security audit.

1. Open `/dev-integration.html` and click **Check all routes**. All 11 routes must show OK.
2. In Account A, go to Search and find two existing test records in different areas. Open one corresponding workspace and confirm the record exists.
3. In School, confirm the same saved subtask completion appears in Outline and Focus after refresh.
4. In Finances, verify a previously completed task remains complete after refresh.
5. In My Account, verify saved palette or other preference survives refresh.
6. In Incognito, sign in as Account B; Search must not show Account A records. Check Account A remains intact.
7. Mark the checklist in Integration; report the result. A browser refresh resets checklist state intentionally.

Do not input real financial information, confidential employer cases, or sensitive personal data. Do not upload `.env.local` or credentials. No new migrations are needed.

**Limits:** Automated route checks prove only that local pages respond. Account privacy must be confirmed with separately signed-in test users; backend RLS must be checked independently before any production use. No real integrations or notifications are enabled.
