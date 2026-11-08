# M3A — Global Themes & Appearance (fictional QA)

1. Run `npm test` and verify all tests pass.
2. Open `/dev-account.html` with Account A. Save **Earthy Green** and **Compact**, then open School, Work, Home, Finances, Search and Calendar. They should all use Earthy Green.
3. Refresh one of those pages; Earthy Green and Compact should persist.
4. Temporarily change the topbar **Palette preview** on any page. It may change that page immediately but must not alter the saved theme when navigating elsewhere.
5. Open an Incognito window with Account B. Its own saved palette should apply instead of Account A's. Sign out, and the page should revert to Classic Minimal.
6. Verify Account A retains its saved theme and records. No RLS changes or new database tables.

Limitations: preview is temporary, and visual theme is not a security setting. Financial amounts/notification preferences are saved but not fully enforced across every feature. Use fictional records only. No confidential work data or banking credentials.
