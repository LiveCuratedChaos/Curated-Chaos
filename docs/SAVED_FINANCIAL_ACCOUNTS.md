# Saved financial account overview

Enabled November 14, 2026 after explicit owner-approved read-only acceptance. The Mac launcher now includes --allow-private-saved-finance-read. Saved copies remain manually opened and amounts default hidden. Earlier preparation/acceptance sections below are historical; the final evidence supersedes their pending status.

## Scope and behavior

Daily Brief can show a manual View saved accounts panel with at most10 owner-private saved Chase account copies. The browser receives only name/type/subtype, current/available USD balances and save dates. It receives no record IDs, bank/account identifiers, connection IDs, provider credentials, transactions or encryption material. Amounts are hidden in the rendered view until Show amounts; this is display privacy, not a promise that an authorized response contains no amounts. Hidden values remain in memory until cleared. Hide, page hiding, offline, sign-out, expired view or disposal clears the view. No automatic provider refresh or finance read occurs on normal Brief load. Saved copy timestamps and an explicit old-snapshot warning avoid suggesting live balances. No totals combine deposits and debt.

Only a dedicated saved-account query is used: active/private/no-household/Finances/provider_bank_account/plaid_readonly rows for the verified owner, limit11 used to reject lists over10. It reads encrypted payloads only for those account rows, never the broader account+transaction query. If no rows exist, the encryption key is not read. For nonempty rows, the reader opens only the existing canonical owned mode0600 32-byte key, never creates/replaces it or opens connection credentials. AES context binds owner and record ID. Foreign/shared/deleted/QA/transaction/duplicate/invalid rows fail closed. Exact integer cents format even maximum safe values without floating-point division rounding.

The POST route requires explicit capability, active server session, same-origin cookie/CSRF and empty input. Owner is derived from the session; user-supplied owner IDs are rejected. A late response after sign-out is withheld. The feature flag is forwarded through factory, protected route, static asset/config and controller. Its fixture mode uses no real reader. Partial account-panel updates preserve open note/task drafts and do not enable amount reveal while an unrelated draft/review is active.

## Evidence

All1,627 offline tests pass, including privacy/whitespace/launcher checks. Fictional tests cover metadata allowlists, owner isolation, encrypted account-only projection/decryption, empty-list key avoidance, excessive lists, malformed/foreign data, exact cents, default masking, reveal/hide/reload, pending reads/sign-out, expiry, canonical-file permissions/symlinks, default-off factory/config routing, draft retention and the two-account in-process acceptance tool. A test-file edit mistake was corrected before acceptance: restored the original189-test controller baseline from the existing isolated checkout and reapplied all12 recent controller cases, then added2 finance controller cases. Full regression count and prior behavior are preserved.

Fictional browser acceptance verified escaped names, old-save labels, default-hidden amounts, explicit reveal, Unavailable values, corrected snapshot/footer wording and Hide clearing. Proof /private/tmp/curated-saved-account-fictional.png. Fixture tab/service closed. Owner app/runtime4042 untouched and its tab8 preserved.

## Prepared actual acceptance — NOT approved/run

`node tools/verify-private-saved-finance.mjs --allow-readonly-saved-finance-test --project=fngauurauwvbawlfzbbe`

Default invocation is plan-only and accesses no config/keys/network. Actual invocation uses exactly two temporary configured development sign-ins and one bounded saved-account list per owner. It checks signed-out, CSRF, owner input, exact display response and independent sign-out protections, then closes both logins. Reads the existing local key only to decrypt nonempty encrypted account rows. Prints counts/safe results only, never account names, amounts or credentials. No listening port, transaction read, bank refresh, source writes, database/schema change, backups or live-app changes. Its complete fake two-account run passed.

Next approval should cover this exact read-only test and, if successful, idle activation of the manually opened view with amounts hidden by default. Do not enable the real flag or request real records before that approval. Preserve owner drafts/open private views; queue activation if busy. This is an account-only first increment, not completion of Finances, budgeting, investments or transaction workflows.

## Approved actual acceptance and activation completed

Owner explicitly approved the read-only test and idle enabling. Ran the exact acceptance once: verified=true, savedAccountLists=2, accountsPerAccount=[3,0], closedTemporaryLogins=2, transactionReads=0, workspaceRecordReads=0, providerReads=0, recordWrites=0. The existing local key was used only for saved account decryption; no key replacement/provider refresh/backup access occurred. This two-login acceptance approval is consumed; do not rerun automatically.

Added only the approved saved-finance flag to the existing Mac launcher. Updated narrow launcher identity/probe to require the newly enabled finance capability so an older incomplete instance cannot be silently reused. All1,627 tests and privacy/whitespace/launcher checks pass. The owner workspace was idle with no drafts, reviews, open private details/mail, pending state or typed search/quick entry. Signed out and stopped runtime4042 with sign-in cleanup confirmed; final runtime97130 uses the unchanged prior flags plus saved-finance scope. Restored the existing owner login. DOM verified the enabled panel/button, zero account rows and zero email rows; no extra real account read or reveal was performed for activation. Real saved note text also stayed unopened. Public unopened-panel proof /private/tmp/curated-saved-accounts-enabled.png. Tab8 and setup tabs preserved. One read-only local identity probe returned running.

The owner can now choose View saved accounts, then Show amounts if desired. These are old saved copies, not a bank refresh. This does not enable transactions, budgeting, investment data, bank writes or AI processing.
