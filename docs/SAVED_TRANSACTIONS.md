# Saved transactions

November 14, 2026. The private Brief has a gated, manual saved Chase transaction panel. The owner approved the read-only acceptance and idle activation; the Mac launcher and private workspace now enable the manual panel.

The panel displays twenty saved copies per page, with explicit next/previous controls and a maximum of 500 copies. Each request reads at most 21 encrypted transaction records (one lookahead). Pages follow save order, with transaction dates sorted within the page. Changes to saved copies may move records between pages. It does not claim a complete statement or calculate totals. Pending copies are labeled and may be stale.

Displayed fields are transaction name, merchant, date, inflow/outflow, pending status and copy-save date. Amounts are hidden initially and reset to hidden on every page or reload. Account, connection, provider and record identifiers never reach the view. Hide, expiry and sign-out clear the panel; late requests cannot repopulate a cleared session.

The route requires its own feature gate, the existing saved-account scope, active owner authentication, exact origin and CSRF protection. It reads only private, undeleted, owner-matching Chase transaction ciphertext. Decryption lazily reads the existing private local key; it never creates or replaces that key. There are no bank calls, account-list reads, writes, provider refreshes or backup operations.

Validation: all 1,638 offline checks pass, including fake two-account acceptance. Fictional browser checks verified manual opening, masked amounts, explicit reveal, pending and inflow/outflow labels, keyboard paging, five-row final page, remasking, previous-page navigation and clearing. The temporary fixture tab and service were closed.

The real acceptance tool is tools/verify-private-saved-transactions.mjs. It is plan-only without an explicit project-matched consent flag. Proposed acceptance uses two temporary configured development sign-ins and reads up to 21 saved transaction copies per account, validates isolation/sign-out, reports counts only and closes both logins. The owner-approved real acceptance and activation are recorded below. No live app or database changes are proposed.

Approved real acceptance passed: two bounded lists, displayed counts [20,0], both temporary logins closed, zero account-list/workspace/provider reads and zero writes. No transaction values were printed. Owner tab8 was idle, the prior runtime closed its sign-ins, and runtime95498 restored the owner sign-in with the transaction panel unopened. The launcher identity now requires transaction capability to avoid reopening an outdated instance.

Local follow-up adds merchant/name and pending/posted filtering of only the loaded page, with explicit submission and match counts. Filters do not fetch additional copies and reset on page changes or hiding. Applying a filter remasks amounts. Fictional browser checks passed for matching, no matches and keyboard submission. All1,639 offline checks pass. No additional real reads were needed.

The page-only filters are activated after an idle sign-out/reload and restored owner login; runtime95498 remains running. Source panels were left unopened. All1,644 checks now pass including financial-tool lifecycle tests.

Owner-approved transaction-only import later saved22 new encrypted November8–14 UTC copies, verified them and closed its temporary login. Total saved transactions now51; old account/balance copies remain unchanged. The manual panel will show current saved pages when the owner chooses View saved transactions; no automatic bank refresh or UI data read was triggered. All1,648 current offline checks pass after provider-backup preparation.
