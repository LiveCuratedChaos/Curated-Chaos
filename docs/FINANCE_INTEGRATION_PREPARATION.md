# Chase read-only integration preparation

The owner selected **Chase** as the first financial institution. That selection does not approve creating a Plaid account, accepting service terms, fees, linking a bank, reading financial data, or saving financial records.

## Supported route and access requirements

Chase's [data-sharing guide](https://www.chase.com/digital/data-sharing) describes authorizing apps through a secure Chase window and selecting the accounts shared. The app must never ask for or store the owner's Chase username/password.

Plaid is the proposed intermediary, not an established connection. Its [OAuth guide](https://plaid.com/docs/link/oauth/) documents Chase's OAuth behavior and account-selection constraints. Its current [environment/trial guide](https://support.plaid.com/hc/en-us/articles/16110110883479-How-are-Sandbox-Production-Trial-plan-and-Limited-Production-different) documents a Trial plan for eligible US/Canada accounts created on/after April 15, 2026, with up to ten Production Items and OAuth institution access. Its [free-use guide](https://support.plaid.com/hc/en-us/articles/16194695660311-Can-I-use-Plaid-for-free) includes Chase in that trial access. Actual account eligibility/institution access must be checked in the developer dashboard; no trial or production access is claimed.

Older Limited Production restrictions still appear in parts of Plaid's documentation. They must not be applied as a blanket statement that a new eligible trial cannot access Chase: the current trial documentation and OAuth guide distinguish these plans. Full Production or an eligible trial is needed for actual OAuth access. Sandbox tests alone do not validate Chase connectivity. Any pricing, contract, trial eligibility, bank consent and permission changes require the applicable owner action/approval. No paid plan or account was created.

## Local adapter

`server/plaid-chase-read.mjs` provides only `/accounts/get` and `/transactions/get` reads. Plaid uses HTTPS POST for these read operations; the adapter exposes no transfers, payments, trades, account-number/Auth retrieval, paid live-balance fetch, or paid refresh calls. API documentation: [Accounts](https://plaid.com/docs/api/accounts/), [Transactions](https://plaid.com/docs/api/products/transactions/), [API versioning](https://plaid.com/docs/api/versioning/). The API version is explicitly pinned to `2020-09-14`.

The adapter defaults to Sandbox and requires server-held credentials. Production requires explicit constructor approval and a separate trusted owner grant allowing live reads. Grants bind owner, connection, environment, Chase institution `ins_56`, Item identity, Transactions product and selected account IDs. Responses must match the expected Item/institution and healthy connection status.

Initial previews support selected USD checking/savings and credit accounts; unsupported account types/currencies fail visibly rather than being coerced or silently aggregated. Amounts use validated signed integer cents. Unavailable balances remain null, not zero. Cached balances/transactions are labeled provider-cached, with retrieval time separate from an unknown source-update time. Routing/account numbers, contact/identity information, geolocation, raw provider bodies and credentials are excluded from returned records.

Transaction windows are inclusive-start/exclusive-end UTC calendar dates, capped at 31 days and 500 records. The adapter converts the end to Plaid's inclusive date convention, requests only selected accounts, and checks the full bounded pagination. Changed totals, duplicates, missing pages, unexpected accounts/currencies/dates and mismatched source identity reject the result. `/transactions/get` is a cached window read, not a database-level atomic snapshot or continuous sync guarantee. Future incremental sync must use cursor/error handling and separately approved persistence.

Pending status and the pending-to-posted relationship are preserved. No automatic budget totals, transfer categorization, inferred bills, investments or financial decisions are produced. Pending transactions must not be counted as confirmed expenses or added again when replaced by a posted transaction.

## Verification and next gate

Nine fictional tests cover owner/account/environment scope, production opt-in, date bounds, USD precision/signs, null cached balances, pagination failure, pending relationships, minimized output and redacted errors. The full app suite passes **344 tests**. No real Plaid request, bank connection, credential installation, new dependency, financial-data read, database write or deployment occurred.

Next essential information: whether the owner already has a Plaid developer account. Inspect that account's actual eligible access or prepare account creation only after the owner's answer and applicable authorization. The owner must review service agreements, any paid commitments and the actual Chase consent screen. Keys/passwords must never be pasted into chat. No financial connection or persistence is enabled merely by choosing Chase.

### Developer signup prepared

The owner confirmed they do not have a Plaid developer account. Opened Plaid's public developer dashboard, followed Sign up, and selected the Personal use option appropriate to this personal app. The current signup page offers Google signup or email and states that account creation accepts Terms of Use, Developer Policy and Privacy Statement. No name/email, password, Google signup, agreement acceptance, credential creation or bank connection was submitted by the agent. Left the page for the owner to review the terms and create the account themselves. No paid plan or trial application has been selected.

### Developer team created; trial agreement gate

The owner completed signup, the CAPTCHA and team creation. The dashboard showed the new personal team, Sandbox availability and a Free trial offer for ten connections. The Sandbox secret remained masked; no key was revealed, copied or installed.

Opened the trial application to inspect its requirements. It asks for the owner's country and separate attestations about personal data access, account/API-key security, encryption/code security, plus agreement to Plaid's Master Services Agreement. All country choices and agreement checkboxes remain unselected. The trial inclusion panel lists ten connections with several products; this is not an instruction to request all those products from the bank. The planned application integration remains Transactions-only and read-only.

No trial submission, terms acceptance, paid-plan change or Chase connection was performed by the agent. Left the application for the owner to provide their actual country and review/accept only accurate statements and agreements. Do not infer legal attestations from timezone or assume the required MFA/security commitments are already satisfied.

### Trial approved; Sandbox credential/test gate prepared

The owner completed the trial application. The actual dashboard showed **Trial access approved**, **up to 20 connections**, and **0/20 used**. This account-specific allowance supersedes the generic ten-Item trial description for this account; no live connection was created to test the limit.

Inspected Build → Keys. Client ID is visible; both Production and Sandbox secrets remain masked. No secret was revealed, copied, rotated or installed. The Production secret is not needed for the proposed fake-data test and must remain untouched.

Prepared a private Sandbox-only credential loader for `.local/plaid-sandbox.json`. It rejects Production/extra credential fields, symlinks and group/other-readable files. Git ignores the path, and the destination was verified absent so installation can use exclusive creation without overwriting anything. Do not save credentials until explicit owner approval.

Prepared `tools/verify-plaid-sandbox.mjs` as offline-plan-only by default. With explicit approval it will use only `https://sandbox.plaid.com`, create one temporary fictional Chase Item initialized for Transactions, exchange its Sandbox token, read a selected supported fake USD account and bounded fake transaction window, then remove that temporary fake Item in a cleanup step. No live bank credentials/data, Production request, paid service, app database write or production deployment is involved. Only sanitized counts and cleanup status are printed. Official endpoint references: [Sandbox](https://plaid.com/docs/api/sandbox/) and [Items/token exchange/removal](https://plaid.com/docs/api/items/).

Four additional local tests verify fake creation/read/cleanup, cleanup on validation failure, credential-file permissions/environment, and offline default behavior. Full suite: **348 passing tests**. No actual Plaid API test has run.

Next essential approval: securely copy only the Sandbox client ID/secret through the dashboard controls into the private, ignored local file, without displaying the secret or sharing it in chat; run the prepared temporary fake-bank test and cleanup. The Production secret, real Chase consent, real financial reads and financial-data storage remain outside that approval.

### Sandbox credentials installed and actual fake-bank test completed

After explicit owner approval, copied only the client ID and Sandbox secret using their labeled dashboard copy controls, never Show or any Production control. Saved exclusively to `.local/plaid-sandbox.json` with owner-only mode 0600; no existing file was overwritten. Credentials were not displayed or printed. The initially empty browser clipboard could not be restored through its nonempty-item API, so it was explicitly cleared immediately afterward; no credential was left on the clipboard. Git confirms the file is ignored.

Ran the approved Sandbox verification against Plaid's actual Sandbox endpoint. Result: **one fictional account**, **four fictional transactions**, **temporary Item removed**, **no live bank connected**, **no app database writes**. Neither account details, amounts, API secrets nor access tokens were printed. This proves the Sandbox API path, not real Chase connectivity.

### Authorization flow prepared with fictional tests

Added an unwired, server-only Hosted Link orchestration for the local development/embedded context. It requests only Transactions, 30 days of history, US accounts, checking/savings/credit-card subtypes, one Item, and a five-minute hosted session. No phone/email delivery or extra products are requested. The provider-hosted destination must be `https://secure.plaid.com/hl/…`. Attempts are encrypted and bound to a verified owner/session, and successful completion is claimed atomically before token exchange.

Completion obtains the public token through the server-bound Link token rather than accepting arbitrary browser tokens. It verifies Chase institution, Item identity, product scope and selected supported USD account IDs, then encrypts the access token for the injected connection store. Failed verification removes only the newly exchanged Item. Duplicate new links are blocked so a new connection does not inadvertently invalidate an existing Chase grant. No balance/transaction snapshot is stored by authorization. The backing store, authenticated app routes and real bank-consent UI remain unwired.

The Hosted Link approach is prepared as a development/embedded flow, not a declaration that it is the final PWA integration. Plaid recommends its normal SDK for standard owned frontends; Hosted Link is appropriate to supported embedded/out-of-product contexts. Actual OAuth redirect/hosting requirements and Chase compatibility must be tested, not inferred from mocked sessions. Sources: [Hosted Link](https://plaid.com/docs/link/hosted-link/), [Link API](https://plaid.com/docs/api/link/), [OAuth guide](https://plaid.com/docs/link/oauth/). The normal Production OAuth redirect requires HTTPS. Plaid's Transactions history request has a minimum 30-day history in Production; a narrower app display window does not narrow the provider's underlying acquisition.

Added a fixed-endpoint client that cannot request payment/transfer/trade APIs, extra products, broader account filters, arbitrary delivery/redirect destinations or a mismatched token environment. Production use and its private credential loader default to denied. `.local/plaid-production.json` is ignored and was verified absent. No Production secret has been revealed/copied/installed and no Production call or real bank connection has occurred.

Full suite: **358 passing tests**, including server-session binding, pending/replay/expiry behavior, wrong-institution rejection, encrypted output, failed-link cleanup, default-denied Production, and endpoint/request minimization. Next essential approval is to privately install the live-access Production key and prepare the actual read-only Chase consent flow. The owner must personally choose accounts/review bank consent; real financial reads or database persistence are not approved by the completed Sandbox test.

### Live-access key installed; actual Chase consent prepared

After explicit owner approval, copied only the client ID and Production secret using the labeled controls and saved `.local/plaid-production.json` exclusively with mode 0600. The secret was never shown or printed, and the temporary clipboard contents were restored/cleared. No credential rotation, paid upgrade or existing-file overwrite occurred.

Added an offline-by-default, loopback-only Chase authorization server on port 5304. It verifies the existing development app owner using privately stored test credentials, binds a single-use launch capability to an HttpOnly/SameSite browser session, pins Host/Origin, checks CSRF and sessions, and has no transaction-read or app-database-import endpoint. Future successful authorization stores only an encrypted connection token/Item/account-ID grant in private local files, not financial snapshots. The app's original server and database schema remain unchanged.

Extended the hosted consent window to 15 minutes to allow bank sign-in/MFA; requests still require the same owner/session and expire no later than Plaid's token. The request remains Transactions-only with 30-day history and selected checking/savings/credit-card account types. A separate explicit completion action verifies the bank result. This is the local development/embedded consent flow, not final public PWA hosting.

Prepared actual authorization using the approved Production key. Plaid accepted the request without requiring a new external deployment for this hosted web flow, and the secure Hosted Link page displayed **Curated Chaos Development uses Plaid to connect your account**. It offers phone-number signup or **Continue without phone number**, with consumer Terms and Privacy Policy. Neither choice was submitted by the agent, and no phone number, Chase credentials or bank consent was entered. No live bank is connected yet, and no account balances/transaction data was read or stored.

The owner must review those consumer terms, continue if they agree, select Chase, sign in directly with Chase and choose the intended accounts. Completion will keep an encrypted connection on this Mac; financial snapshots/imports remain a separate step. Current live authorization process session: 65424; in-app browser bank tab 17, local completion tab 16. Do not print the Hosted Link token/URL or any subsequent account details into chat/docs.

360 automated tests pass, including offline startup guards for the actual consent server. The actual hosted page is browser-verified; real Chase compatibility and final consent are not verified until the owner completes them.

### Chase consent completed and encrypted grant verified

The owner completed Chase's bank authorization and personally clicked Plaid's final **Share data** confirmation. Plaid showed Success. The local completion action then verified the backend-bound Hosted Link result and reported **three selected Chase accounts authorized**. A single encrypted grant was saved in the private, ignored `.local/plaid-connections` directory, containing the access token, Item identity, selected account IDs, environment and Transactions scope. No bank credentials, account identifiers, names, balances or transaction details were printed or copied into chat/docs.

The completion check received selected-account metadata/cached balance fields only to validate the expected accounts/currency; it did not display or persist balance snapshots. No transaction endpoint was called and no financial records were inserted into the app database. The connected-account count was browser-verified and captured without account details. Bank consent is no longer pending.

### Read-only financial preview prepared; not yet executed

Added a private encrypted-grant loader and explicit preview service. It requires a verified owner/session, explicit financial-read approval, an exact approved linked-account count and a valid bounded date window. Changed account counts, grant identity or app sessions fail closed. The adapter reads only selected cached accounts and a complete bounded transaction window; no transfer/payment/trade, paid live-balance refresh or database operation is exposed.

Prepared `tools/chase-preview-server.mjs` as an offline plan by default. A future explicitly approved invocation must specify the expected development project, three accounts, and exact start/exclusive-end dates. It will hold the result in server memory, expose it only through a one-use local launch capability and private HttpOnly/SameSite session, and expire the data. It writes no financial snapshot to disk or database. Amounts start hidden, null balances remain Not provided, pending transactions are marked unconfirmed, and no automatic totals or bill matching is claimed.

Six new fictional tests cover the approval/account/date gates, encrypted owner-bound storage, changed sources/sessions, no credentials in results, offline defaults, escaped text, amount privacy and memory clearing. Browser-tested the preview UI against an isolated fictional server: amount hide/show and selected-account filtering worked. The fixture server was stopped. Full suite: **366 passing tests**.

Next essential approval: read cached balances and November 1–7 UTC transactions for exactly the three already-authorized accounts. Proposed command after approval only:

```
node tools/chase-preview-server.mjs --allow-financial-preview --project=fngauurauwvbawlfzbbe --accounts=3 --start=2026-11-01 --end=2026-11-08
```

This is a read-only, expiring preview, not financial-data persistence or automatic sync. Do not execute the command or enable financial import before owner approval. No new bank sign-in or grant creation is needed for this preview.

### First approved financial preview completed

The owner explicitly approved cached balances and November 1–7 UTC transactions for the three already-authorized accounts, as a private preview without database persistence. Ran the exact preview command above. Result: **three accounts and 29 transactions**. The real local preview was browser-verified with amounts hidden; only its count/status paragraph was captured. No balances, account names, merchant names, identifiers or transaction details were copied into chat/docs. No financial records were saved to disk or the app database, no paid refresh endpoint was used, and no bank data was modified.

The preview is expiring in-memory data, not a saved financial workspace. Its bank source is cached and may lag Chase. It does not establish reconciled budgets, bill-payment status, transfer matching or production readiness.

### Encrypted financial saving and saved view prepared; not executed

Prepared `planChaseImport` for explicit selected account/transaction keys from a complete verified preview. It proposes only private Finances records with deterministic source identities and validated signed USD cents. Account balances remain distinct from transaction flows; null balances, pending status and pending-to-posted links are preserved. It creates no payments, tasks, budget decisions or deletions. Reimports compare canonically; changed/manual/deleted records stop for review instead of being overwritten.

Added application-layer encryption through `createSealedFinanceRepository`. Financial payloads (including source identifiers, names and amounts) are sealed with authenticated encryption before reaching Supabase, with owner/record-specific associated data. They are decrypted only by the private server after database/session checks. The existing private local encryption key remains on this Mac, outside Git. Database RLS still applies to the owner-private records; encryption does not replace authorization. Key recovery/production secret management and cross-device hosting remain future release work.

Prepared a separate saved-finance reader/page, with hidden amounts, explicit saved/stale labels and no bank refresh. It is linked from local My Account and Finances. The original fictional budget/planning editors are not silently converted into real-data editors, and no financial totals or automated bill matching is claimed. Browser-tested saved-record rendering using fully fictional encrypted fixtures; verified the Finances link in the already-running app. The fixture server was stopped. The actual connection server has not been restarted to activate these new routes yet.

Prepared `tools/import-reviewed-chase.mjs`, which defaults to a credential/network/write-free plan. Only a distinct approved invocation can reread the exact three linked accounts/window, enforce a maximum of 29 transaction snapshots, compare current private records and atomically insert new encrypted snapshots. No update/upsert/delete, banking action, schema migration or deployment is included. The repository now supports the two explicit financial record types separately from Google records. The generic executor remains default-denied without a server-owned write authorization.

**377 automated tests pass**, including financial item/owner/date/amount scope, deterministic duplicate prevention, conflict/tombstone rejection, encryption at the database boundary, corrupted/swapped ciphertext rejection, encrypted acknowledgement/reread verification, default-denied writes, offline CLI guards and private saved-view authorization. No real financial save has been performed.

Next essential approval: save three account/balance snapshots and at most 29 November 1–7 UTC transaction snapshots as encrypted owner-private records in the isolated development Supabase database. Proposed command after approval only:

```
node tools/import-reviewed-chase.mjs --allow-financial-import --project=fngauurauwvbawlfzbbe --accounts=3 --max-transactions=29 --start=2026-11-01 --end=2026-11-08
```

This approval would be for that bounded initial snapshot only, not ongoing refresh, broader date ranges, changed record updates, household sharing or financial actions. The tool stops if account selection expands, counts exceed the cap or existing records need an update. After approval, apply the prepared gateway code and privately reauthenticate using the existing local development credentials if needed to verify the saved view; no new Chase sign-in is required merely to read saved snapshots.


## Approved encrypted financial save and saved-view verification completed

The owner explicitly approved the bounded initial financial save. The guarded tool saved and verified exactly three account/balance snapshots and 29 November 1–7 UTC transaction snapshots in the isolated development database. All 32 payloads are encrypted and owner-private. A separate read-only audit verified the encrypted envelopes and confirmed that the other development account could see none of these records through database authorization. No private financial details or credentials were copied into chat/docs.

Applied the prepared local gateway and privately reauthenticated with the existing development account. Browser-verified the actual saved view before and after reopening: three accounts, 29 transactions, amounts hidden by default. Reopening reads saved encrypted records without contacting Chase. Closed the temporary consent and expiring bank-preview servers/pages; the saved gateway and original local app remain available. No bank action, schema change, live-app change or deployment occurred.

Added a local transaction-status filter that combines with the account filter, preserves hidden amounts, and explains empty matches without additional source requests. A fictional controller regression verifies combined filters and a single saved-data read. This remains a snapshot viewer, not reconciled budgets or automated bill matching.

The prior initial-save approval gate is completed. It does not authorize ongoing refresh, changed-record updates, broader date ranges, household sharing or financial actions. Continue routine local work autonomously; release authentication, key recovery/backup, household security, integration acceptance and production deployment remain incomplete. Ask before any new database change or live-app change.

## November14: new-read preparation and session cleanup

Saved accounts and transactions are now manually available in the private Brief; see SAVED_FINANCIAL_ACCOUNTS.md and SAVED_TRANSACTIONS.md for the distinct completed approvals. No ongoing Chase refresh is enabled.

Hardened financial tool lifetimes locally: import temporary sign-ins close on success/failure; the memory-only preview expires within five minutes and explicitly closes its server/session and clears ticket/data on close or startup failure. Three shared temporary-login tests plus two preview lifecycle tests use fictional dependencies only. All1,644 offline checks pass. No new credentials, bank requests or database writes.

Prepared next optional source acceptance: existing three Chase accounts, provider-cached balances and up to500 transactions over November8–15,2026 UTC (end excluded), no partial preview if the bounded window fails verification. This is one temporary preview using existing grants, not ongoing access, paid refresh, saving, budget totals or a banking action. Command remains unexecuted and requires new owner approval:

```
node tools/chase-preview-server.mjs --allow-financial-preview --project=fngauurauwvbawlfzbbe --accounts=3 --start=2026-11-08 --end=2026-11-15
```

## November14: approved one-time newer-window preview completed

Owner approved one temporary cached Chase preview for November8–15,2026 UTC (end excluded), same three linked accounts, up to500 transactions. Actual preview verified3 accounts and22 transactions. Browser checked exact window, hidden amounts, cached warning and unsaved status without printing names, amounts or details. Closed preview tab12 and runtime79264; CLI confirmed temporary sign-in closed. No database writes, balance changes or ongoing access enabled. Public count-only proof: /private/tmp/curated-chase-preview-summary.png.

Prepared transaction-only insert path in import-reviewed-chase.mjs. --transactions-only excludes account/balance keys from proposed records, reads only existing encryption key without creating/replacing it, compares deterministic transaction records, skips unchanged copies and stops before writing if conflicts or cap changes appear. Existing balances and transactions cannot be updated or deleted by this flow. Fictional tests verify unchanged balance preservation, changed-transaction rejection, review without writes, a single transaction insertion and duplicate retry without a second write. All1,647 offline checks pass. No actual transaction-only import has run.

Next approval, if desired, is a new same-window cached read (provider can return up to500 transactions) and insert of at most22 new encrypted private transaction copies in the separate development database. Accounts must still number3; more than22 transaction results stop before writing. Copies persist beyond the preview. Existing balance copies remain old. Proposed exact command, not run:

```
node tools/import-reviewed-chase.mjs --allow-financial-import --transactions-only --project=fngauurauwvbawlfzbbe --accounts=3 --max-transactions=22 --start=2026-11-08 --end=2026-11-15
```

## Approved transaction-only save completed

Owner approved saving up to22 new encrypted transaction copies in development. Exact guarded command above executed once successfully: accountSnapshots0, transactionSnapshots22, inserted22, alreadySaved0, window November8–15 UTC (end excluded), verifiedAt2026-11-15T03:59:15.590Z. Transaction contents were reread by the insert executor and the temporary login closed before exit0. No amounts, names, identifiers or credentials printed. No existing accounts/transactions updated/deleted, paid refresh, banking action or live change. No further bank reads authorized by this completed run.

Saved transaction inventory is now51. The existing provider backup covers only46 old provider copies; the newly prepared exact68-copy backup requires separate approval. Current private workspace stays open and source panels unopened.

Approved updated provider backup completed:68 records (9 email metadata,3 accounts,51 transactions,5 calendar events), encrypted and verified on disk. New exclusive archive b43afccc-87eb-4377-b5e6-24eb0bab2902.ccsnapshot in the private local Recovery/ProviderSnapshots folder. Temporary login closed; zero provider reads, database writes or restore attempts; credentials excluded. Older backups preserved. This remains on the same Mac and does not protect against loss of the Mac. Current code validation remains1,648 passing offline checks; no code changed during this backup run.
