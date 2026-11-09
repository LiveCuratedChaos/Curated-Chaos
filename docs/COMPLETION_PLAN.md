# Curated Chaos completion plan

Updated November 9, 2026. Continue the existing M3D Phase 2 app; preserve the approved blueprint's full first-release scope.

> Current checkpoint: 929 automated tests pass. Local core workflows and the read-only saved-source Brief are implemented and incrementally browser-tested. Nine real Gmail metadata snapshots, 32 encrypted Chase snapshots and five encrypted Mac calendar snapshots are saved privately in the isolated development database. Google and Chase reads are separately consented; these are snapshots, not ongoing sync. A password-protected local key/credential recovery copy and a verified encrypted backup of the 46 real saved provider copies exist on this Mac only; other app records and full database recovery are not covered by that narrow provider backup. No production deployment has occurred. Remaining release gates include app-wide production authentication, household/guardian authorization, dependable separate-device and database backups, real-source approval-safe automation, physical-device acceptance and final visual/release work. Historical entries below document earlier milestones; later evidence supersedes their pending/completed status. The approved first-release scope is unchanged.

## Working agreement

Handle routine local development and verification autonomously. Preserve existing uncommitted work. Never disclose local credentials. Obtain owner approval before changing the live app or any database, connecting real providers, or inviting household members. No production deployment or database writes are part of this review.

## Review findings

- The project has functional development screens for tasks/projects, calendar, school, work, personal life, home, finances, search, account preferences, and widget layouts.
- Records and connections are explicitly fictional/development. Existing provider names and previews do not establish working calendar, email, banking, or investment integrations.
- The baseline includes uncommitted fixes to version checks, pagination, draft retention, static routes, and documentation. Preserve these changes.
- The baseline offline suite passes 222 tests. This does not certify browser behavior or database isolation.
- Node/npm are absent from the normal shell path. An existing app-bundled Node v24 runtime can execute offline tests without installation. A standard supported Node installation remains needed for a durable development setup.
- Development sessions retain refresh tokens in per-tab storage; production authentication needs further review and hardening.

## Delivery order and acceptance

1. **Complete task editing.** Rename/remove existing subtasks, retain checkmarks and unrelated drafts, reject stale updates, and preserve existing records. Verify offline behavior and isolated browser UI before any approved cloud acceptance test.
2. **Stabilize core workflows.** Audit create/edit/complete/search behavior across tasks, projects, calendar, school, notes, and widgets. Cover empty, loading, offline, error, keyboard, and mobile states. Fix demonstrated defects in small increments.
3. **Prove development isolation.** Review migrations and existing authorization tests without running database writes. Prepare adversarial account-isolation tests and a clear owner-approved development database test procedure.
4. **Build integrations and Daily Brief.** Implement provider adapters, server-side token boundaries, freshness/error states, and approval/deduplication flows with fictional fixtures first. Preserve the calendar, email, supported read-only finance, and advanced automation commitments. Ask for essential provider/access/cost choices only when needed. Real-provider consent is a separate approval gate.
5. **Finish family essentials and security.** Implement and verify roles, household grants, approval exceptions, session revocation, recovery, and data/export boundaries with synthetic users before inviting real members. Client filtering is not server authorization.
6. **Polish and prepare release.** Verify responsive layouts, themes, accessibility, device behavior, migration preview, backup, and rollback. Present a reviewable preview and acceptance evidence. Deploy or change databases only after owner approval.

## Current local increment

- Added subtask rename/removal through an explicit Save subtask changes action.
- Preserved completion flags, task metadata, editor position, and other drafts during subtask updates.
- Reused existing owner-scoped, version-guarded updates; no schema changes.
- Added model and controller regressions; all 227 offline tests pass.
- Browser-verified rename/removal, completion toggles, preserved unrelated drafts, and blank-title rejection using an in-memory fictional adapter with network connections blocked. This does not verify real database persistence, row-level authorization, or physical-device behavior. No cloud writes have been performed.

## Core reliability follow-up

- Notes now retain in-memory drafts through validation errors, failed or unconfirmed saves, and refresh checks. Confirmed saves clear the submitted draft; sign-out/session clearing removes it so the next account cannot inherit it.
- An unsuccessful reload after a confirmed save keeps its error visible instead of replacing it with a success notice.
- Note search updates the matching count alongside results without replacing the active input or draft form.
- Four new controller regressions cover failure, uncertainty, validation, refresh, confirmed saves, account clearing, escaping, and search counts. All 231 automated tests pass. Notes browser acceptance remains outstanding; these tests do not certify live persistence.

## Calendar reliability follow-up

- Event drafts survive validation failures, unconfirmed saves, and refresh checks; blank dates/times remain blank. Closing the editor or signing out clears them.
- An open event draft retains the version it was based on after refresh, preventing silent overwrites of newer edits. Dirty display preferences retain their original version too.
- Saves and editor changes are blocked while calendar data is loading. Failed reloads no longer leave an earlier success notice visible or claim that no prior write occurred.
- Event fields stack within the narrow schedule panel to keep dates, times, and choices usable.
- Six new controller regressions pass, bringing the full automated suite to 237 passing tests. An offline browser check confirmed draft title/description retention after a simulated failed save and refresh; no database requests or writes were performed. Live persistence, authorization, and physical-device acceptance remain outstanding.

## Shared workspace reliability follow-up

- Home, Personal Life, Finances, and Work retain quick-add drafts through refresh checks and failed/unconfirmed creates. Confirmed saves, explicit cancel, a new editor, and sign-out clear the relevant draft. No credentials or draft content are written to persistent browser storage.
- Work, Home, and Personal Life completion failures remain visible instead of being erased by an immediate reload. Failed post-save reloads clear prior success notices.
- Finance completion requests capture the original account and screen generation before awaiting a token or response. Late successes and failures are ignored after sign-out, a refresh, or an account change. The existing in-place checkbox/progress updates and expanded outlines are preserved.
- Work tasks reject impossible calendar dates, including non-leap February 29.
- Finances now highlights its own navigation item. Mobile Home links to the functional Home workspace instead of the older overview route.
- Fifteen controller/model/navigation regression tests cover these behaviors. All 252 automated tests pass, and whitespace checks pass. Browser acceptance of this latest increment remains outstanding; no database or production changes were made.

## School reliability and browser follow-up

- School quick-add and detail editors retain drafts through validation failures, failed/unconfirmed saves, refresh checks, and unrelated checklist updates. Their original record revisions stay attached to the draft, so refreshing cannot silently rebase stale edits over newer data. Closing/replacing an editor or signing out clears its drafts.
- Invalid dates and study times are rejected. Assignment, step, and study-session capacity limits fail before a write instead of silently dropping additions. Matching input limits prevent unintended title truncation.
- School reads and updates explicitly exclude deleted, household, and non-School records, alongside the existing owner and revision filters. Local normalizers also exclude deleted records.
- Seven new controller/model/API regressions pass. The full automated suite now passes 259 tests, and whitespace checks pass.
- Browser-verified study draft name/date/time retention after simulated save failure and refresh. Also verified failed-save and refresh draft retention in Work, Home, Personal Life, and Finances. All browser checks used an in-memory fictional adapter with database connections blocked. They do not certify real persistence or authorization.

Next local review: remaining Notes browser acceptance, search and widget failure handling, and production authentication/server-side security planning. Real provider connections, multi-account database acceptance, migration, and deployment remain approval gates, not completed features.

## Search and widget failure handling

- Search distinguishes loading, verified results, and unavailable data. Failed refreshes clear unverifiable results while preserving the query for retry. Signing out during a refresh resets the busy state and filters; late responses cannot restore the previous account's results.
- Search documents paginated reads and labels its 80-result display limit instead of implying that the old API fetch limits still apply.
- Widget layout saves block overlapping refreshes. Sign-out clears the layout-saving state and prevents a pending token request from starting old-account reads.
- An acknowledged layout write is only reported as verified when the follow-up read contains the same record and revision. Missing or newer rereads retain the draft and explain the uncertainty.
- Seven new controller regressions pass. The full suite passes 266 automated tests. Browser acceptance for these latest search/widget changes and Notes remains outstanding. No live service or database changes were made.

## Session safety and next approval gate

- Delayed sign-in/restore/refresh responses can no longer revive a signed-out session or overwrite a newer account. Concurrent restores and access-token refreshes share one request to avoid competing refresh-token rotations. Five new race regressions pass; the theme/session test now verifies emitted events behaviorally.
- Both development URL guards reject embedded credentials, query data, fragments, and nonstandard ports. Verification requests reject redirects.
- The RLS verification tool now defaults to a credential-free, network-free plan. Actual test writes require an explicit `--allow-dev-writes` invocation after owner approval. The test now verifies profile reads and stale-revision rejection as well as the existing isolation checks. Two new guard regressions pass.
- All 273 automated tests pass. Local browser checks now also verify Notes draft retention, Search's unavailable state after a failed refresh, and widget draft retention after a failed save. All used fictional in-memory adapters with database connections blocked.
- The next approval request is documented in DEVELOPMENT_DATABASE_TEST.md: use existing fictional accounts in the separately configured development database, create disposable QA fixtures, and verify account isolation. No schema migrations or production changes are requested. Do not execute the write-capable test before the owner approves it.

Production readiness remains incomplete: development refresh-token storage is accessible to browser JavaScript; household grants/invitations, real-provider credential handling, recovery, backups, and deployment still need their separate implementation and acceptance gates. Passing local mocks does not establish database isolation.

## Approved development database run

On November 8, 2026, after explicit owner approval, the write-capable isolation test passed all 27 checks against the separately configured development project. Labeled fixtures remain for audit. The initial restricted-network attempt stopped before authenticating; the permitted network run completed successfully. No schema or production changes were made. See DEVELOPMENT_DATABASE_TEST.md for the tested actions and limits.

## Real-source integration preparation

Added a server-only, read-only Google Calendar window adapter, tested with eight mocked provider cases. It validates explicit calendar grants, owner-scoped event identities, RFC3339/all-day timing, complete pagination, and failure handling without returning tokens. It is not wired to a route, OAuth flow, storage, or real account. All 281 automated tests pass. See INTEGRATION_PREPARATION.md for implementation boundaries, sources, and limits.

The first essential integration choice is the owner's email provider (Gmail/Google Workspace, Outlook/Microsoft 365, or iCloud). Await that answer before choosing its OAuth/API implementation. Calendar preparation does not authorize any real provider connection or new database changes.

## Gmail and authorization preparation

The owner selected Gmail. Added a server-only, metadata-first Gmail reader with explicit owner/connection/label grants, bounded windows, exact-time filtering, pagination and minimal output. Added testable authorization orchestration around the official Google client interface plus authenticated encryption for server-held tokens. These modules are not wired to real credentials, routes, storage, or accounts.

Seven Gmail tests and six authorization/encryption tests pass; the full suite passes 294 tests. No further database writes or production changes were performed.

Current user-action gate: Google Cloud shows initial service terms before project selection. The owner must review/accept those terms if appropriate, or switch to the correct existing Cloud account. Do not accept terms, create a Cloud project/client, add scopes or redirects, or connect Gmail without the applicable explicit user action/approval. INTEGRATION_PREPARATION.md records the prepared implementation and remaining boundaries.

The owner completed the initial Cloud setup. A separate `curated-chaos-development` project was created, and development app branding/testing/contact fields were prepared. Registration is paused at Google's separate API Services User Data Policy agreement for owner review. No OAuth client/scopes, billing activation, mailbox connection, deployment, or further database change was performed.

The owner completed app registration. Installed the pinned official Google library and implemented/tested the loopback connection gateway, local encrypted storage, app-session verification and CSRF/callback handling. It runs separately on port 5301 without disturbing the app already listening on 5215. All 301 automated tests pass; the dependency audit reported zero known vulnerabilities. The unconfigured setup page was browser-verified.

Prepared a Web OAuth client form in the isolated Google project with the exact local callback, leaving Create unclicked. Current owner-action gate: create/download the development credential, keeping its secret JSON local. After that, install it without overwriting files, restart the local gateway, and separately review test-user/scopes and live account consent before any mailbox or Calendar connection. No source data import or additional database write is authorized by client creation alone.

The owner downloaded the credential. It is now installed at the ignored `.local/google-oauth.json` with owner-only permissions, preserving existing files; the original download was protected too. The restarted local gateway shows its configured development sign-in page. No real Google account connection or data import was attempted.

Current approval gate: add the signed-in Google account as the sole development test user; enable the Gmail/Calendar APIs; save only identity/email plus read-only Gmail/Calendar scopes in `curated-chaos-development`. Test-user and scope forms are prepared but unsubmitted. Real account consent and live-source import remain separate approvals. No production or database changes are proposed by this setup step.

## Google connections and first read-only previews verified

The owner completed Google policy/consent steps. Both development APIs and account connections are configured. Private encrypted source selections restore after refresh and remain separate from import approval. The owner approved a primary-calendar preview for November 8–December 7 UTC and an Inbox metadata preview for November 1–7 UTC. Real previews completed: zero matching calendar events and nine matching Gmail messages. No provider content is stored in this plan or the app database. No production changes or automatic sync were performed.

The local gateway now provides verified-owner, CSRF-protected previews of exact stored selections, with session/selection rechecks and no partial output on failures. All 307 tests pass with fictional data; the real preview checks complement those tests. Next: integrate source review into the app's development screens, prepare idempotent owner-scoped persistence with fictional tests, and obtain approval before any database changes or storing real source items. Calendar's nonempty real-event rendering remains unverified because the chosen window returned none. Production token management, recovery/backups, multiuser authorization and deployment remain incomplete.

## App entry points and import-review preparation

Added local-only Google connection entry points in My Account and Integration, and brought the connection page into the app's existing visual system. Verified browser navigation from both entry points, the existing port-5215 app, saved selections, and all 11 local route responses. The original local app process stayed running.

Prepared a pure import-review mapper with deterministic per-owner/source identities, explicit item selection, private-only records, conflict checks, revision requirements, and separate provider record types. It has no execution path and creates no tasks or deletions. 312 automated tests pass, including source text that resembles instructions, excluded credentials/bodies, mixed-owner rejection, reimport/conflict handling and all-day boundaries.

Still required: production-safe app authentication, a persistence executor and approval flow, consumers for real provider records, stale-source/freshness handling, revocation/disconnect, recovery/backups, and deployment validation. No new database or production changes were made.

## Local connection safety

Added reversible, owner-bound pause/resume controls, explicit wording distinguishing local pause from Google revocation, read-time labels for previews, and reliable ordering for rapid source-choice saves. Local fixtures verify pause/restart/resume and permission boundaries; 314 tests pass. Browser verification left the real connections and source choices unchanged. True Google-side disconnect/revocation and distributed mutation locking are still outstanding.

## Explicit item review available

Implemented selected-item review from a short-lived encrypted server preview. Session, owner, source selection and expiry are verified; arbitrary client records cannot be imported through review. The UI defaults every item to unchecked and distinguishes review from saving or duplicate comparison. Browser-tested end to end using an isolated fictional provider server; 317 automated tests pass. Real-data/database import remains disabled. A database executor, duplicate/revision comparison and separate approval are still required before persistence.

## Persistence ready for a fictional development database check

Prepared the unwired insert-only executor and development repository. Reviews are single-use/session-bound/expiring; execution rereads current records, blocks changed/manual/deleted records, inserts atomically without upsert, and verifies acknowledgements and saved contents. Unknown outcomes require review rather than automatic retry. Canonical JSON comparison handles database object-key reordering. 325 automated tests pass, including offline CLI guards.

Next essential approval: run the concrete provider-import check in DEVELOPMENT_DATABASE_TEST.md. It will insert three labeled fictional owner-private provider fixtures, verify no duplicates on repeat, preserve all-day dates, and test second-account isolation against only these fixtures. No schema or real-source changes are proposed. The test is prepared but not run; real-content import remains disabled.

## Development import verified; server-held connection sessions prepared

The approved fictional provider-import run passed 11 actual database checks; three audit fixtures remain. Added and browser-verified their private snapshot view, with fictional labels and no Google refresh. No real-source content was saved.

Moved app authentication for the local connection area to server-held memory and an opaque HttpOnly/SameSite cookie, with verified identity, bounded attempts, expiry and targeted removal of its legacy browser refresh-token entry. The original fictional workspace auth manager remains separate. 331 automated tests pass; isolated browser sign-in/sign-out works.

Next essential owner action: sign into the updated connection area once using the existing development account so the new actual sign-in path can be verified. Existing Google grants/selections remain intact. Real-content imports, schema changes and production deployment are still not approved or enabled.

## Secure sign-in verified; first real-content decision pending

The owner completed the updated actual sign-in. Retained Google grants, original selected dates and the three private fictional fixtures were browser-verified. Added connection/snapshot entry links in Calendar and fictional Email without mixing real source items into their fictional editors or suggestion logic.

Finished the scoped save review path with fresh database comparison, preview-bounded expiry, current-source/session validation, single-use approval and default-denied insertion. Only an explicitly server-approved source selection plus an item cap can permit a save. 333 automated tests pass; a fully fictional browser workflow verified comparison and disabled saving. No real-content database write has occurred.

Next essential decision: approve or decline metadata-only storage of up to nine original Inbox items (November 1–7 UTC) in the private development database. Subject, sender, received time and provider identifiers only; no body/attachment access, Google changes, Calendar import, background sync, schema change or production deployment. The running actual gateway is still unapproved for real-content writes. If approved, apply the scoped configuration, verify a fresh development sign-in if required by restart, prepare an exact fresh review and execute once, then verify private saved contents without copying them to chat/docs.

## First approved real metadata persistence completed

After explicit approval, imported exactly nine Gmail Inbox metadata snapshots for November 1–7 UTC into the owner's private development records. The bounded one-shot tool verified the original selection, owner, count, database comparison, insertion acknowledgement and saved contents. No real source content was logged in chat/docs, and no bodies/attachments, Google changes, Calendar writes, automatic sync, schema changes or deployment occurred. 335 automated tests pass.

The browser's development session expired before an updated saved-item list could be verified; database verification completed successfully. Viewing results requires sign-in again, but there is no need to repeat the import. The gateway is not enabled for general real-content saving.

Next essential product choice: identify the first bank or financial service for the blueprint's required read-only finance integration. Ask only for the institution/service name, never an account number, password or other credentials. Research supported provider feasibility and consent/cost requirements before preparing any financial connection. Continue to treat production readiness, broader synchronization, real email-content parsing, finance connection and deployment as outstanding.

## Chase adapter prepared with fictional data

The owner chose Chase. Official Chase/Plaid research supports an OAuth route through Plaid, subject to actual developer-account/trial access and bank consent. Prepared a read-only adapter for selected-account cached balances and bounded transactions, with exact USD cents, null/unavailable values, pending/posted relationships, identity/owner/environment guards, pagination checks and minimized/redacted output. Nine new tests pass; full suite: 344.

No Plaid account, credentials, paid services, bank connection, financial-data reads, database changes or deployment occurred. The next essential question is whether the owner already has a Plaid developer account. Do not ask for keys or banking credentials in chat. Financial setup details and source links are in FINANCE_INTEGRATION_PREPARATION.md.

## Plaid trial ready; fake-bank test awaiting approval

The owner created the personal Plaid team and personally completed legal/security attestations and trial submission. Dashboard verification showed trial approval with 20 available connections and none used. Production/Sandbox secrets remain masked and were not copied or installed.

Prepared private Sandbox-only credential loading and an offline-by-default fake-bank verification tool. It creates one temporary fictional Chase Transactions Item, reads bounded selected fake account/transaction data and removes that fake Item. No Production or app database operation exists in this test. 348 tests pass.

Next essential approval: install only Sandbox credentials privately in the absent, Git-ignored `.local/plaid-sandbox.json` using exclusive creation, then run and clean up the temporary fake-bank test. Do not copy Production credentials, authorize real Chase data or assume a bank connection from trial approval alone.

## Actual Plaid Sandbox verified; live-key gate pending

The owner approved private Sandbox credential installation and fake-bank testing. Installed only the Sandbox configuration, mode 0600 and Git-ignored, without overwriting files or printing secrets. The actual Sandbox run verified one fictional account and four fictional transactions, then removed the temporary Item. No app database write or real bank connection occurred.

Prepared and tested the encrypted owner/session-bound Chase authorization orchestration and a restricted server client. Hosted Link is a development/embedded option; final SDK/HTTPS/redirect and actual bank compatibility remain to be verified. Product scope is Transactions only, with 30-day history, selected supported account types, no sending/transfer/payment/trade capability, duplicate-link protection and failed-new-link cleanup. 358 automated tests pass.

Next essential approval: install only the Production live-access key privately at the currently absent `.local/plaid-production.json` and prepare the real read-only Chase consent flow. Production credentials/calls, real bank consent/data reads and financial-data persistence are not authorized by Sandbox approval. No paid upgrade, production deployment or schema change is proposed. The owner must review the eventual bank consent themselves.

## Actual Chase consent ready for owner action

The owner approved private installation of the Production key and consent preparation. Installed the key privately without showing it or overwriting files. Prepared an actual Transactions-only Hosted Link request and opened the secure Plaid page showing Curated Chaos Development. No new hosting/deployment was required for this development hosted web flow.

The new loopback authorization server has a one-use launch capability, HttpOnly/SameSite session, verified development owner, Host/Origin/CSRF checks and no financial snapshot/import route. The hosted session lasts up to 15 minutes for bank/MFA completion; requested history is 30 days. 360 tests pass.

Next essential owner action: review Plaid's consumer Terms/Privacy, continue (phone number is optional), choose Chase, sign in directly with Chase and choose accounts. Do not enter bank credentials or accept consumer terms for the owner. Keep bank tab 17 and local completion tab 16 alive. Process 65424 is running; after owner completion, verify the selected connection via the local completion action without importing transactions or copying financial details into chat. An encrypted local access grant is part of connecting. Connection verification may receive selected-account metadata/cached balance fields but does not display or persist balance snapshots. Transaction previews and financial-snapshot storage remain separate approval gates.

## Chase connection verified; financial preview awaits approval

The owner completed bank sign-in/account selection and the final Share data action. Plaid showed Success; the local completion verified three selected Chase accounts and persisted only an encrypted access grant in private ignored local storage. No transaction read or financial snapshot/database import occurred. Connection verification received but did not display/persist cached balance fields.

Prepared the private financial preview pipeline and UI with exact owner/account/window guards, no write endpoints, cached-data/pending labels, hidden amounts by default, expiry and no browser storage. Six new tests and a fully fictional browser check pass; full suite: 366. The actual financial preview has not been run.

Next essential decision: approve or decline cached balances plus November 1–7 UTC transactions for all three already-authorized accounts, as an expiring local preview only. FINANCE_INTEGRATION_PREPARATION.md gives the exact guarded command. No further bank sign-in is needed; no financial records may be saved to the app database under preview-only approval.

## Real financial preview verified; encrypted persistence ready for approval

After explicit preview approval, read cached balances and November 1–7 UTC transactions for all three selected accounts. Result: three accounts, 29 transactions. Verified only counts and hidden amounts in the browser; no financial details were copied into chat/docs and no financial records were persisted.

Prepared selected-item financial import planning, insert-only execution, authenticated encryption at the database boundary, and an owner-private saved financial view linked from My Account/Finances. Amounts stay hidden by default; saved data is labeled stale/snapshot rather than live. Existing fictional planning editors and automatic totals/bill actions remain separate. Browser-tested the encrypted saved view with fictional data and the existing app navigation. 377 automated tests pass.

Next essential approval: one bounded encrypted save to the private development Supabase database of three account/balance snapshots and up to 29 transaction snapshots dated November 1–7 UTC. The guarded command and limits are in FINANCE_INTEGRATION_PREPARATION.md. Do not execute a financial write under the prior preview-only approval. The original local app remains running; the connection gateway will need the prepared code applied before saved-view verification. Existing local development credentials can be used privately for routine app reauthentication without asking the owner to repeat bank sign-in. This is not production deployment, background sync or financial automation.


## Approved encrypted financial save and saved-view verification completed

The owner explicitly approved the bounded initial financial save. The guarded tool saved and verified exactly three account/balance snapshots and 29 November 1–7 UTC transaction snapshots in the isolated development database. All 32 payloads are encrypted and owner-private. A separate read-only audit verified the encrypted envelopes and confirmed that the other development account could see none of these records through database authorization. No private financial details or credentials were copied into chat/docs.

Applied the prepared local gateway and privately reauthenticated with the existing development account. Browser-verified the actual saved view before and after reopening: three accounts, 29 transactions, amounts hidden by default. Reopening reads saved encrypted records without contacting Chase. Closed the temporary consent and expiring bank-preview servers/pages; the saved gateway and original local app remain available. No bank action, schema change, live-app change or deployment occurred.

Added a local transaction-status filter that combines with the account filter, preserves hidden amounts, and explains empty matches without additional source requests. A fictional controller regression verifies combined filters and a single saved-data read. This remains a snapshot viewer, not reconciled budgets or automated bill matching.

The prior initial-save approval gate is completed. It does not authorize ongoing refresh, changed-record updates, broader date ranges, household sharing or financial actions. Continue routine local work autonomously; release authentication, key recovery/backup, household security, integration acceptance and production deployment remain incomplete. Ask before any new database change or live-app change.


## Local key-loss safety follow-up

The recovery review found that a missing local encryption key could be regenerated even with encrypted records still present. The store now fails closed in that state and requests restoration of the original key. Invalid, insecure or linked keys remain rejected without overwrite. Two fictional recovery regressions verify no replacement/no record changes and successful reopening with the original key. No real key or stored record was modified, copied or rotated. Updated SECURITY_BOUNDARIES.md with current real-data contents, the remaining older workspace-session limitation, and the limits of key-loss detection. Backup/recovery and production authentication are still incomplete.


## Financial viewer lifecycle privacy follow-up

Closed financial pages now reject late responses at both the fetch and JSON parsing boundaries, preventing asynchronous work from restoring cleared private content. Missing, invalid or already-expired responses are rejected before rendering. Filter/amount interactions also check expiry, so a suspended browser timer cannot allow an interaction to redisplay expired records. Closing or expiry clears the in-memory data and amount-display setting. Three fictional regressions cover these timing cases; the complete suite passes 383 tests and whitespace checks pass. No provider requests, database writes, real-data screenshots or live-app changes were needed for this fix. This does not add cross-tab session revocation or solve production authentication.


## Google connection-page lifecycle privacy follow-up

Added a page/session generation guard to the local Google UI. Responses are checked before requests and after both asynchronous response boundaries. Leaving the page clears private controls, CSRF state and expiry timers; old responses cannot restore account labels, source previews or saved metadata. Expired authenticated status responses are rejected before rendering, and completed responses check the session deadline even if a browser timer has been suspended. Three fictional regressions verify late status, late saved records, closed/expired sessions and initially expired authentication. No Gmail/Calendar reads, database changes or live deployment were needed. Cross-tab revocation and production authentication remain future release work.


## Repository upload safety follow-up

Added `check:privacy`, an offline read-only guard for expected ignored credential locations and currently tracked private paths. The actual local repository passed: seven probes protected and no tracked private files found. Three isolated temporary-repository tests cover allowed example files, forced tracked credentials despite ignore rules, missing rules and nested private directories. All 389 tests pass. No credential contents were read, no Git files were staged/committed/pushed, and no backup or remote visibility claim is made. Content/archive/history review remains separate.


## Saved Google metadata browsing follow-up

Added in-memory search across saved titles and email senders, combined Gmail/Calendar filtering, chronological newest-first ordering, received timestamps and an explicit no-match state. Changing filters renders only the results area, preserving the active search input. All metadata remains escaped, real/fictional snapshot labels remain visible, and no new provider/database request is made by search or filtering. Retained metadata is cleared by the existing page-exit/session-expiry guard. Two additional fictional regressions cover combined filtering, ordering, unchanged source arrays, escaping, stable inputs, empty matches, no refetch and memory clearing. No real provider reads, database writes or live-app changes were made. Browser acceptance for these new controls remains outstanding.


## Saved-source browser acceptance completed

Verified the actual Google UI module against a separate loopback-only fictional server with no credentials, real providers or database access. Browser checks confirmed newest-first mixed sources, sender search, combined provider filtering, preserved search text and clear zero-result feedback. Added explicit accessible names to search/source controls after the native label query exposed ambiguity. At a narrow viewport, document content fit the available width without horizontal overflow; saved a fictional-only screenshot. Reset the viewport and closed/stopped the temporary browser/server. This supersedes the pending browser acceptance note for these controls; physical-device acceptance and nonempty real Calendar acceptance remain outstanding.


## Read-only saved-source Daily Brief implemented

Added an authenticated saved-source Brief endpoint and connection-page view, with navigation from the existing local Daily Brief. It reads only the existing owner-private saved repositories and revalidates the session after both reads. The financial repository remains sealed; the response contains only real account/transaction counts, no balances, amounts, sender identities, provider identifiers or credentials. QA fixtures are excluded. Calendar events overlap the current UTC day using exclusive ends; up to five recent saved email subjects are shown, with received times and a total snapshot count. Source age, missing-event limits, no unread/action inference and no bank refresh/reconciliation are explicit.

This increment does not modify the fictional task/suggestion engine, create real tasks, read providers, write databases or deploy the app. Source summary and security tests cover event boundaries, fixture exclusion, limits, no sensitive extra fields, missing authorization, revoked sessions and escaped rendering. Browser acceptance and application of the new endpoint to the already-running gateway remain outstanding; routine local restart/re-authentication can be done without changing the live app or database. No new bank consent is required to view already-saved records.


Browser-verified the Brief button and nonempty calendar/email/finance-count rendering using a separate fictional loopback server. Snapshot caveats and the saved-finance navigation appeared correctly; stopped and closed the fixture server/tab. This completes fictional browser acceptance for the new Brief view. The running authenticated gateway still requires a local restart to activate the new server endpoint; real saved-data acceptance has not been claimed.


## Actual saved-source Brief activated and verified

Restarted only the local connection gateway with the prepared endpoint and privately signed into the existing development account. Browser-verified the actual saved-source Brief for November 8 UTC: nine real saved email snapshots, three real account snapshots and 29 transaction snapshots. The page rendered successfully; only sanitized status/counts were inspected or captured, with no subjects, account names, merchant details or financial amounts copied into chat/docs. The test fixtures are excluded from the Brief counts. No Google/Chase refresh, database write, schema change or live deployment occurred. The original local app remains untouched and the updated gateway is running. This supersedes the pending gateway activation/actual saved-data acceptance note. Real nonempty Calendar acceptance remains outstanding; the original approved calendar window contained no events.


## Server-side session race hardening

Identity confirmation now verifies the same server-held session still exists and has not expired after awaiting the identity service. The status route also revalidates after reading encrypted connection metadata, so a concurrent sign-out cannot return private account labels or a stale CSRF token. Two regressions simulate sign-out/expiry during slow identity confirmation and sign-out during connection storage reads. All 398 tests pass and whitespace checks pass. No provider access or database write was used. Applying this local gateway change ends its in-memory development sessions; saved data and encrypted grants remain intact.


## Workspace token verification and private recovery preparation

Hardened the older fictional-workspace session manager to reject malformed/expired access responses before identity verification, recheck token expiry after identity verification, and enforce the original 12-hour limit after delayed refresh/restore. Three regressions cover these cases; this does not remove its browser-readable refresh-token limitation.

Prepared an offline password-protected local key/credential recovery tool and a double-click Terminal launcher. It includes only the original encryption key, existing local environment/provider credential files, provider storage and bank connection grants; it is explicitly not a database backup. Uses fixed-parameter scrypt and AES-256-GCM with format-specific associated data. The password is entered hidden in a local TTY, never accepted as an argument/environment variable or piped input. The default CLI mode reads no credentials and writes nothing. A recovery copy is exclusively created in a private directory outside the project, decrypted/compared in memory before writing, then read back for exact verification. It never restores, replaces or rotates active files/keys. Wrong passwords, tampering, unsafe paths, linked/nonprivate source files, missing keys and existing output are rejected. Git ignores recovery copies and the privacy check now includes them.

All recovery tests use temporary fictional keys/credentials. A metadata-only actual precheck confirmed six expected local source locations use private permissions; no source contents were copied. The actual Git privacy guard passes all eight probes with no tracked private files. No real recovery archive has been created. The next essential owner action is to choose and enter a recovery password privately in the local Terminal launcher. Store it separately; never send it in chat. Default storage is a local private Application Support recovery folder, which protects against accidental key loss but not loss of this Mac. An approved separate-device/storage backup and database backup are still outstanding. No live/database changes or new provider access are included.


## Owner-created local recovery copy confirmed

The owner authorized recovery setup and entered the password privately after opening the local Terminal launcher themselves (computer controls cannot open Terminal). The owner reported saving complete. A metadata-only check confirmed one nonempty, owner-private, nonlinked recovery archive in the intended local recovery directory; its contents were not opened and its password was never requested in chat. The tool verifies its encrypted round trip and exact file bytes during creation; a separate later password-based verification has not been performed by the agent. This supersedes earlier notes that no real recovery archive exists. The copy is on this Mac only; database backup and protection against loss of the Mac remain incomplete.

## Daily Brief and static-file boundary follow-up

The fictional task Brief normalizer now excludes soft-deleted tasks/notes/events and malformed task completion/title values; removed tasks also cannot be toggled through the payload helper. Missing timestamp fields no longer crash its stable ordering. A regression verifies removed/malformed rows are excluded. The API already filters deleted rows; this adds a second local guard.

Demonstrated and fixed a local static-server allowlist bypass using fictional linked files/directories: an allowlisted pathname must resolve to the corresponding ordinary file within the real project root. Links redirecting public paths to private content now return 404. Two regressions verify linked file/directory denial and continued denial of credential/key/recovery/tool paths, while ordinary modules remain served. All 408 tests pass and whitespace checks pass. No real source data was read by these tests and no database or live-app change occurred. The original running server is preserved; applying these server changes can use a controlled local restart later.


Owner storage choice: keep the encrypted recovery copy only on this Mac for now. The owner plans to purchase an external drive later; do not copy credentials/recovery archives to another device or service until the destination is explicitly authorized. This does not block routine local app development.


## Daily Brief refresh, session and draft acceptance

Daily Brief reads and task/decision requests now recheck the screen generation after delayed token retrieval, before starting old-account requests. Complete fetches normalize a candidate snapshot before changing preferences/records; normalization failure leaves the previous snapshot intact and explicitly unverified. Replacing an in-progress refresh with an offline check clears busy state. Confirmed writes no longer overwrite a subsequent reload error with a success notice; duplicate-handled approvals stop even if their verification reload fails.

Quick Add now retains in-memory title, date and section through validation errors, failed/unconfirmed saves and refreshes. Confirmed saves clear only the submitted draft, preserving newer edits typed while awaiting the response. Sign-out clears the draft. Six fictional controller regressions cover cancellation, reload errors, atomic snapshot staging, offline busy state and draft lifetimes. Updated the older structural regression to reflect staged normalization. All 414 tests pass and whitespace checks pass.

Browser-verified the actual Brief module against a separate, entirely fictional in-memory API: failed save retained title/date/School selection, Fetch latest preserved the draft, and sign-out removed the draft and returned to login. No real account sign-in, provider request or database write occurred. Saved a fictional-only draft screenshot and closed/stopped the temporary test browser/server. Production sign-in and cross-device acceptance remain incomplete.


## Suggestion-review draft and source-change safety

Suggestion reviews now retain in-memory edited title/date/section through refresh, validation errors and failed approval. Opening a review captures the source suggestion; a changed source blocks approval until the review is closed/reopened, rather than silently rebasing edits. Closing, confirmed saving/dismissal or sign-out clears the review draft. Explicitly blank dates/sections are invalid rather than falling back to source defaults. Private decision reads now request only undeleted owner-private/nonhousehold rows, and the decision normalizer independently excludes removed/household-associated rows. This remains a fictional QA decision workflow, not production transactional automation or an immutable audit log.

Four new regressions cover review drafts, escaped rendering, source changes, blank fields and private decision scope; replaced one older query-string assertion with a behavioral API filter check. All 418 tests pass; whitespace checks pass. Browser-verified the actual module against a fictional in-memory email/API: edited title/date/School section survived a simulated approval failure, and Close removed the dialog. Saved only a fictional screenshot; closed/stopped the temporary browser/server. No real email/bank access, database write, schema change or live deployment occurred.


## Saved-source Brief date navigation

Added selected UTC date, Previous day, Next day and Today controls to the saved-source Brief. Date filtering reads saved private records only, with no provider refresh or database write. Real-date validation, leap/year rollover and 2000–2100 bounds are enforced in the UI. Past-date summaries exclude mail received after the selected day; total mail count remains the full saved inventory. Financial inventory is explicitly not date-filtered or a historical balance. The UI explains that it filters the currently saved snapshot, not an archived historical view.

Three regressions verify date calculations, exact selected-day requests, invalid-date no-request behavior and future-mail exclusion. All 421 tests pass. Browser-verified actual UI against a separate fictional loopback server: February 28 → leap day → previous day, plus Today. Saved a fictional-only screenshot, closed/stopped temporary browser/server. The running gateway must be restarted to activate the server-side past-mail cutoff; no actual provider read, database change or live deployment occurred in this increment.


## One-message Gmail content preview prepared; real read not authorized

The next real-email-intelligence step requires content beyond the earlier metadata-only approval. Prepared a default-off one-message reader and loopback preview server. It selects only the single most recently received real message among exactly nine already-saved owner-private Gmail snapshots in the original November 1–7 UTC Inbox window. The exact project, original count, one-message cap and date window are explicit CLI gates. Changed saved metadata, source selection, Inbox membership, owner or session rejects the result before display. It performs one Gmail messages.get GET with format=full and no messages.list, attachment endpoint, Google edit, external-model call or database write. The OAuth grant remains the existing gmail.readonly scope; new message-content access still requires explicit owner permission.

Google's full message format returns parsed message structure, which can include HTML/inline parts; it is not a server-side plain-text-only API filter. Consent must therefore say one complete message is retrieved. The local extractor displays only supported inline UTF-8 plain text. It does not render HTML, open named/attachment/forwarded-message parts or separately fetch attachments. Incoming JSON is bounded to 2 MiB, text to 64 KiB, and MIME structure to 100 nodes/eight levels. Source text is inert untrusted data and never instructions to execute or permission to act.

The five-minute preview remains in memory, uses a one-use private launch capability and HttpOnly/SameSite cookie, pins the local Host, rejects non-GET requests, rechecks the development identity and expiry, and defaults to hiding subject/sender/text until revealed. No source content is logged or written to the filesystem/database; only an opaque launch URL is stored briefly in a private temporary file. The viewer clears on expiry/exit and rejects late responses. No real message read has occurred.

Nine additional tests cover exact approval/owner/source gates, one GET, streamed response limits, unsupported encoding, skipped parts, changed metadata/labels/session, CLI offline defaults, exact count/window flags, one-use cookies/Host/method/session/expiry, hidden/escaped text and late-response rejection. All 430 tests pass. Browser-tested actual viewer with a completely fictional message, verified show/hide and no action/save controls, saved a fictional-only screenshot and closed/stopped the fixture server. The actual preview command remains unexecuted.

Next essential decision: allow or decline retrieval of the one complete newest message among the original nine saved Inbox snapshots, for this local expiring text preview only. It is not consent to save bodies, read other messages, use a cloud model, open/download attachments or create tasks. Proposed command only after approval:

```
node tools/gmail-text-preview-server.mjs --allow-one-gmail-text-preview --project=fngauurauwvbawlfzbbe --saved-count=9 --messages=1 --start=2026-11-01 --end=2026-11-08
```

Official API references: [messages.get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get), [message format](https://developers.google.com/workspace/gmail/api/reference/rest/v1/Format), [message and MIME structure](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages), [attachment body representation](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments).


## Approved actual one-message preview completed

The owner explicitly approved retrieval of the single newest message among the nine original saved Inbox snapshots, including its complete message structure, for an expiring local plain-text preview only. Ran the exact scoped command. Initial attempts failed on provider availability/timeouts and then a legacy text encoding; setup diagnostics deliberately blocked message retrieval and printed only safe status categories. Retried only the same scoped newest saved message after adding tested common Western encoding support (UTF-8/US-ASCII/ISO-8859-1/Windows-1252). No other message/date/label scope was added. Failure messages expose only allowlisted categories, never provider error contents, identifiers or tokens.

The actual preview succeeded with one approved message and supported plain text. Browser-verified only the status paragraph and hidden-text control: One message preview / Plain text available / Nothing saved; source text was not rendered or copied to chat/docs/screenshots. Captured a status-only screenshot and retained the private preview tab for the owner. It expires after five minutes; the opaque launch file is removed on use. No separate attachment retrieval, HTML rendering, external AI, message-body persistence, task creation, Gmail edits, database writes or deployment occurred. All 432 automated tests pass. This completes the bounded preview approval, not broader/ongoing content access or permission to save real tasks. Reopening after expiry must not trigger automatic rereads.


## Cross-tab connection sign-out privacy

The local Google gateway UI now broadcasts only a signed-out marker (no account/source identifiers or data) through same-origin BroadcastChannel. Open connection views clear controls, CSRF and retained metadata; saved-finance views clear records/amount-display state and reject late responses. The sign-out action clears local content before awaiting the server response, while retaining the original CSRF only for that one request. Page exit closes the channel. Browser contexts without BroadcastChannel retain existing expiry/exit clearing; this does not certify cross-device revocation or change the older fictional-workspace session architecture. The separate one-message preview still has its own short-lived capability/session and expiry; it is not silently treated as the gateway cookie.

Two additional regressions cover cross-tab clearing and delayed-response rejection. All 434 tests pass. Browser-verified actual UI modules in two same-origin fictional tabs: signing out of connections immediately removed the financial view and displayed the sign-out message. No real private content, provider call, database write or deployment was used. Saved a fictional-only screenshot and closed/stopped the temporary fixture tabs/server.


## Atomic fictional approval prepared; database permission needed

Prepared migration 003 and a default-off client/API path so a fictional suggestion's task and history can be inserted atomically with source locking, revision checks and duplicate protection. Installed pinned, integrity-verified PGlite 0.5.15 as a dev-only dependency and executed the migration and adversarial cases in an entirely separate in-memory PostgreSQL database with fictional auth roles/users. Browser-tested the enabled path against a fictional API; no fallback legacy writes occur on RPC failure. Source reads now include their revisions. The actual local feature switch remains absent/off, and the actual schema remains unchanged.

Prepared offline-by-default `verify-atomic-approval.mjs` for three new disposable fictional QA rows, real concurrent request/isolation/conflict checks and version-guarded reversible cleanup after explicit approval. Read-only precheck of active tasks visible to existing dev A/B found zero duplicate approved-source groups; deleted rows/other owners remain outside that precheck. Full rollout scope, safeguards and limits are in DEVELOPMENT_DATABASE_TEST.md. Next essential permission is to apply only migration 003 to the isolated development project, run that bounded QA/cleanup, and activate the local flag after success. No provider read, real record change or live deployment is proposed.


## Approved atomic development rollout completed

The owner explicitly approved migration 003 in the isolated development database, the three-record fictional acceptance/soft-delete cleanup, and local activation after successful checks. The owner signed into the Supabase dashboard privately. Verified the SQL editor project name `curated-chaos-dev-isolated` and ref `fngauurauwvbawlfzbbe`, applied only migration 003 and observed Success / No rows returned. No original/live project was selected or changed.

Actual QA run `16d4eee3-ce53-4a1f-a755-21ce64ae17aa` created exactly one new fictional source, one task and one linked approval history record. Its first checker stopped because its duplicate-insert test omitted the task section from the reread projection; this was a test-tool defect, not evidence of lost task/history atomicity. Inspected the same run before further writes and confirmed the linked pair and other-account isolation. Fixed the projection and added a regression emulating PostgREST column projection, plus a resume mode that requires the exact existing linked QA records and creates no new fixtures. Continued only that same run. Concurrent retries returned the existing task; stale source and other-owner approval were rejected; a correctly scoped direct duplicate insert was rejected by the unique index. No extra test rows were created.

The resumed verification succeeded and version-guarded soft-delete cleanup covered only the three new disposable QA rows. An independent read-only follow-up confirmed source version 2/deleted, one task/deleted and one history/deleted. Existing records were not updated, deleted or overwritten. This proves hosted duplicate/identity/permission behavior and retry handling; the original fresh-concurrent response details were not retained after the first checker stopped. Offline PostgreSQL rollback cases remain separate evidence, not a claim to have deliberately injected a failure into the hosted schema.

Enabled only the local `CC_DEV_ATOMIC_FICTIONAL_APPROVALS=enabled-after-approved-migration` setting, preserving existing .env.local contents and private permissions, then restarted the agent-owned connection gateway. Its `/dev-config.json` confirms the expected dev project and enabled flag. Browser-verified the development workspace at `http://127.0.0.1:5301/dev-dashboard.html` using existing test credentials privately: Quick Add available, no alerts, QA task absent. No additional approval/task save was performed in the browser. The separate old port-5215 process remains untouched; use the updated port-5301 workspace for this feature. The expired temporary email-text preview process was stopped; it will not reread Gmail automatically.

No Gmail/Chase reads, real task creation, real-body persistence, original/live schema change or deployment occurred in this rollout. The owner-approved local recovery copy predates this nonsecret feature flag; its original key/credentials remain unchanged. Pinned PGlite is dev-only, no package lifecycle scripts ran. The index/RPC remain limited to fictional approval records; production automation/authentication/household security are still incomplete.


## Removed-source suggestion cleanup verified

Sample email/life API reads now explicitly filter `deleted_at is null` and `household_id is null` and include deletion metadata and revisions. Both local normalizers reject removed rows before template deduplication, so an old removed example cannot hide a valid replacement. Suggestion builders independently refuse removed sources, and legacy approval history validation refuses removed task acknowledgements. Four regressions cover these boundaries; all 449 tests pass and whitespace checks pass.

A read-only actual development check verified owner-private active source results and confirmed the soft-deleted atomic QA email was not returned. No new database write, schema change, provider read or deployment was needed. This closes the remaining possibility that cleaned-up QA sources could reappear as pending suggestions after refresh.


## Local-day and time-zone Brief handling

Added a visible time-zone selector to the saved-source Brief, with America/New_York as the current owner's default, UTC and the browser's zone where different. Today uses the selected zone's calendar day; Previous/Next operate on calendar dates. Server-side local-day boundaries handle DST-short/long days and reject nonexistent local dates/time zones before database reads. Timed calendar overlaps and the recent-email cutoff use those boundaries; displayed instants are converted to the selected zone. All-day saved dates remain date-based. Financial inventory remains explicitly not date-filtered/historical, and no source freshness is implied. This is a local-view choice, not a saved per-profile database preference.

Four additional regressions verify New York 23/25-hour days, skipped-date rejection, local-evening event/mail inclusion, Today near UTC midnight, and endpoint zone validation/default-day handling. All 453 tests pass; whitespace checks pass. Browser-verified the actual UI against fictional data for New York and UTC, including explicit zone headings and converted timestamps; captured a fictional-only screenshot and stopped/closed the fixture server/tab. Restarted only the agent-owned local gateway to activate the prepared server changes. Its in-memory connection sessions end on restart, while saved records and encrypted grants remain intact. No new Google/Chase read, database write or live deployment occurred.


## Household policy audit and rollback-only hosted test prepared

Added offline PostgreSQL authorization tests using the existing foundation migrations, fictional auth roles and four synthetic users across two synthetic households. Verified that household ownership does not expose another adult's private records, section grants do not cross tenants, read-only members cannot write, write grants imply read only for that section, direct membership escalation and scope/ownership moves are rejected, membership removal/revoked section rights affect subsequent queries, private records remain accessible to their owner, and anonymous access/hard deletion are denied. Unsupported child roles are rejected by the current schema; this is not evidence that guardian/child account features are implemented or compliant.

Prepared `householdPolicyCheck` to generate a rollback-only SQL script for the two existing development test users. Its temporary footprint is two new fictional households, three memberships (including owner-trigger rows), and six new fictional records. Within one transaction it tests private/tenant/section isolation, allowed versus denied writes, membership escalation, ownership moves and membership removal, then ROLLBACK discards all those writes. A final read-only result verifies none of the QA households/memberships/records remained. It contains no schema changes, no new user accounts/invitations, provider reads or existing-row updates. Claims are simulated within the trusted SQL test transaction; this verifies hosted policies/roles but is not an independent end-to-end JWT/invitation/cache test.

The generated script itself was executed successfully in a separate in-memory PostgreSQL test, including complete rollback and unchanged preexisting fictional fixtures. A second guard test verifies that preparation defaults offline and cannot execute SQL. Prepared a private mode-0600 SQL artifact only after verifying the two existing development identities. Actual hosted execution remains unapproved and unperformed. Artifact: `.local/household-policy-checks/c67479ef-d063-4541-ae13-122ea1362915.sql` (Git-ignored; contains development user IDs, not credentials; do not copy its contents into chat).

Next essential permission: run that exact rollback-only privacy check in isolated project `fngauurauwvbawlfzbbe`. Confirm the project before Run. If an assertion fails and the editor stops before the final ROLLBACK, execute ROLLBACK on that test connection before any other operation, inspect safely and do not invent a passing result. Do not apply any RLS change, invite anyone, enable real household sharing or enroll children under this test permission. The original live app/database remain out of scope.


## Approved hosted household privacy check passed with complete rollback

The owner explicitly approved the rollback-only privacy test in the isolated development database. Verified the Supabase SQL editor remained `curated-chaos-dev-isolated` / `fngauurauwvbawlfzbbe`. Cleared the prior editor contents before inserting the exact prepared private SQL artifact; verified the rollback-only script contained ROLLBACK and no COMMIT. Executed its two-household/three-membership/six-record fictional transaction only.

The hosted assertions passed for adult-private and cross-household isolation, section-specific read/write behavior, denied grant escalation, denied owner/section moves and access removal after membership removal. Supabase returned `policy_checks=passed`, `no_qa_households_saved=true`, `no_qa_memberships_saved=true`, and `no_qa_records_saved=true` after ROLLBACK. Captured only the result grid, with no credentials, private source content or development user identifiers in the screenshot. No new users, invitations, schema/security-rule changes, provider reads or existing-row changes were committed. No original/live project was changed.

This verifies the hosted foundation's SQL roles/policies against temporary fictional data. Auth claims were simulated inside the trusted SQL transaction; this is not certification of invitation/guardian flows, real child enrollment, independent cross-device cache revocation or production compliance. Real household sharing/invitations remain disabled/unapproved and require their own implementation/acceptance. Local automated suite remains 460 passing tests; this hosted check required no code changes.


## Organizer, School and Tasks reliability follow-up

Organizer/School reads and organizer creates/updates now check account/screen generation after delayed token retrieval before starting requests. Organizer post-save reload failures no longer claim nothing changed or leave an earlier success notice; editing stays disabled until verification succeeds. Open organizer editors keep their original revision across refreshes, rejecting stale drafts instead of silently rebasing them. Confirmed same-editor subtask writes may advance to their acknowledged revision; later unseen revisions still conflict. New quick-add text typed during an in-flight create is retained. Organizer sign-out remains available while busy and clears drafts/records immediately.

The older Tasks QA view now retains title/date/section drafts through refresh/filter/validation and unconfirmed saves, clears only a confirmed submitted draft, preserves reload errors, and gates writes on a verified load. It rejects old-account reads/creates/toggles after delayed token retrieval. Session clearing resets busy/filter/draft state. The shared development API now bounds both fetch and response-body reads with a 15-second AbortController deadline and clears its timer on completion. Timeout errors explicitly retain uncertainty about whether a write reached the server; no automatic retry is added.

Twelve additional regressions cover generation guards, truthful post-save errors, original editor revisions, newer quick-add drafts, task draft/filter/error behavior, deadline cleanup and busy sign-out. All 472 tests pass. Browser-verified the actual organizer module against a fictional version-changing API: refresh retained edited text, Save rejected the stale version without calling the write adapter, and the warning explained close/reopen. Saved a fictional-only screenshot and closed/stopped the temporary fixture browser/server. No actual database write, schema change, provider access or live deployment was needed.

Next integration clarification: the original authorized Google primary-calendar preview returned zero events for its selected window. Before preparing further real calendar reads or assuming this is the owner's primary schedule, confirm whether the connected Google calendar is the one they actually use or whether their schedule lives in iCloud/Outlook/another calendar. Ask for service/calendar choice only, never event names or credentials. No new provider read or authorization expansion is implied by this local reliability work.


## Apple/iCloud calendar source selected; local helper prepared, no access granted

The owner confirmed their calendar is Apple/iCloud, not the empty Google primary-calendar source. Researched Apple's supported third-party Apple Account/app-specific-password routes and local EventKit access. No custom web-based Apple authorization support is assumed, no public calendar link was requested, and no Apple credentials were accessed. Google remains separately authorized; no grant was revoked or expanded.

Prepared `native/calendar-preview/CalendarPreview.swift` and a default-plan builder. The local macOS 14+ helper can preview calendars already synced to this Mac through EventKit, avoiding an Apple password and public publishing. Important scope: Apple's `fullAccess` permission allows reading/modifying the calendar store; there is no separate read-only authorization for reading events. The helper's implementation only reads and offers no event save/remove/commit, account credential, database, direct networking or export operations. It lists calendar names only after explicit Connect/macOS permission, automatically selects none, and reads events only after the owner chooses 1–5 calendars and a local date window of 1–31 days and clicks Preview. Maximum 250 events; canceled/out-of-window or invalid results are rejected/skipped without partial display. Snapshot fields are title, selected calendar title, start/end and all-day flag only. It is not yet bridged to the Daily Brief or enabled for persistence/sync.

Details start hidden, render as inert plain text without automatic links, hide on focus loss, and clear on selection change, expiry (five minutes), close or detected permission loss. Calendar/event view state is not intentionally persisted; window restoration is disabled. OS Calendar authorization itself persists until revoked. The helper reads the Mac store, which may lag iCloud; it does not trigger an explicit cloud refresh. This is local development tooling, not a signed/distributed production integration or a solution for other devices/hosting.

Built both fictional and real bundles in new exclusive Git-ignored private build folders, locally ad-hoc signed/verified them, and ran compiled no-access window self-checks. Two Node guard tests verify offline defaults and the absence of event mutation/network/credential/export surfaces. Full suite: 474 passing tests. Native GUI verification could not be completed through computer controls (launch timed out; no running helper was observed). Finder fallback did not establish a helper window and was stopped after a user-state-change notification. Do not claim visual acceptance. No real helper launch, Calendar permission, calendar listing/event read, Apple sign-in, database write or live change occurred.

Prepared real helper: `.local/calendar-preview-builds/66d96962-ce21-463f-91a3-e519de3ee525/Curated Chaos Calendar Preview.app`. Fictional helper: `.local/calendar-preview-builds/1be8c2e9-1304-4b51-9db7-b6c73409e229/Curated Chaos Calendar Fixture.app`. These builds are not overwritten. Opening the real helper shows its explanation first; Connect triggers the permission request. Request the owner's explicit choice before any real Calendar access: use this local helper with macOS full-access permission (read-only behavior), or prepare a manual calendar-file import instead. The owner must review the OS permission, choose calendar(s)/dates and request the preview. Never ask for an Apple password or verification code in chat; do not bypass an OS security warning.

Official references: [Apple third-party calendar access](https://support.apple.com/en-us/121539), [Apple app-specific passwords](https://support.apple.com/en-us/102654), [EventKit access](https://developer.apple.com/documentation/eventkit/accessing-calendar-using-eventkit-and-eventkitui), [requestFullAccessToEvents](https://developer.apple.com/documentation/eventkit/ekeventstore/requestfullaccesstoevents(completion:)). The installed Apple SDK EKTypes/EKEventStore headers independently confirm that full access includes read/modify and the request method is available on macOS 14+.


## Owner-verified actual Apple calendar preview

The owner chose the local Mac helper approach after disclosure that macOS Full Calendar Access includes read/edit capability while this helper contains only read operations. Opened the prepared real helper through Finder after direct app launch proved unreliable. Native accessibility showed its explanation, five available calendars, no automatic selection and permission available. The owner selected all five calendars in the UI for the displayed November 8–December 8 local date range. Calendar access/selection occurred through the owner's UI; the agent did not change Apple credentials or grant an OS permission on their behalf.

Computer controls then became unreliable during the preview handoff. The owner explicitly reported: five events from five selected calendars. Record this as owner-verified native preview acceptance, not an agent-inspected event list or independent screenshot. No event titles/details were copied into chat/docs. The five-minute preview remains local/in-memory and does not export to the browser, save to Supabase, change calendar events or contact an AI service. The five selected calendars include three iCloud calendars plus birthday/subscribed calendars; do not describe all five as iCloud calendars.

This confirms local Calendar-store access and nonempty selected-window preview. It does not yet connect Apple events to the saved-source Daily Brief, implement cross-device iCloud access, authorize persistence or enable automatic refresh. Any bridge must retain calendar/date choice, owner binding, minimized fields, expiry and explicit review; database persistence remains a separate owner approval gate. Native Calendar permission persists until revoked even after preview expiry/closure. The real helper bundle remains the prepared immutable development build. Local suite remains 474 passing tests; no code changed for this acceptance update.


## Mac-based calendar bridge prepared — November 8

The owner chose Mac-based calendar updates for now, superseding the earlier request for updates while the Mac is off. No independent cloud iCloud connection, Apple password, or public calendar link is required or configured.

Prepared an opt-in temporary bridge from the native preview to a separate Mac-calendar panel alongside the saved-source Daily Brief. It is disabled by default. A verified local app session prepares a one-use handoff in an exclusive owner-private file containing no events or provider credentials. The native helper reads that file only after the owner explicitly chooses Review in Daily Brief, validates the exact loopback destination and approved calendar count/date window/time zone/event cap, and posts only title, calendar label, timing and all-day metadata. Redirects, ambient cookies, credentials and caching are disabled. The gateway whitelists fields, rechecks the owner/session before and after asynchronous work, consumes the capability once, and clears memory on expiry/sign-out. All-day boundaries are checked in the source time zone. No database write or AI operation exists in this path.

Both transfer-enabled fixture and real helper builds compiled and passed existing native window self-checks without launch or Calendar access. A compiled native-reader test verifies rejection of public files, symlinks, expired capabilities and other destinations. Fictional gateway tests cover the complete prepare/transfer/read/sign-out flow; controller tests cover opt-in visibility, escaping and late-response rejection. These are automated checks, not a visual acceptance test or real-calendar transfer proof. Full suite: 487 passing; repository privacy check: eight ignore rules protected, zero tracked private files. Original running gateway was not restarted or enabled for real transfer.

Next approval gate: open the updated helper and enable one temporary local transfer of up to five events from five owner-selected calendars, November 8 through December 8, 2026 (end excluded), America/New_York. The owner must create a fresh native preview because the earlier five-event preview expires. macOS may require Calendar permission again for the rebuilt helper. Real transfer, persistence, unattended refresh, and live/database changes have not occurred in this increment. Durable calendar saving and scheduled refresh remain later work with separate approvals as needed.


### Approved Mac preview attempt and all-day correction

Owner approved the bounded temporary local transfer. Restarted only the local gateway with that exact five-calendar/five-event scope, restored the existing development sign-in through its form, and opened the transfer-enabled native helper through Finder. The owner selected five calendars and produced a five-event preview. Two explicit attempts using fresh one-use handoffs were rejected; neither created an app snapshot. Sanitized gateway diagnostics identified the reason as all-day boundaries, without event titles/dates/payloads in output. No event body, database persistence or AI operation occurred.

Corrected native all-day conversion to use covered local calendar dates: retain an exclusive midnight endpoint, otherwise include the final covered local date. Timed events retain their original instants. Native self-checks now cover both 23-hour and 25-hour daylight-saving dates, midnight and final-second all-day endpoints, and unchanged timed intervals. The gateway still strictly requires local day boundaries; its guard was not relaxed. Added fixed rejection categories for troubleshooting without exposing source values. Rebuilt the helper and reran all 487 tests successfully; privacy check still protects eight probe paths with zero tracked private files.

The corrected helper is open and awaiting macOS Calendar permission/reselection. The actual corrected real-event transfer has not yet succeeded. Current corrected build: `.local/calendar-preview-builds/e9972516-52bb-450d-b1ab-34bfe7b2c199/Curated Chaos Calendar Preview.app`. Local gateway process is enabled only for the approved bounded preview, without database save permission. The original app on port 5215 remains unchanged.


### Corrected real Mac preview verified

The owner approved Calendar access and recreated the same five-calendar/five-event selection in the corrected helper. An explicit fresh handoff succeeded: the helper displayed Preview transferred, and the owner-authenticated app displayed a Temporary Mac snapshot for November 8 in America/New_York. No transferred events overlap that selected day; this empty day is not evidence of an empty month. Event titles/details were not emitted into agent output. Privacy-safe proof shows only the empty-day preview status at `/private/tmp/curated-mac-calendar-preview-status.png`.

Added a single-success limit to the bridge for future enabled sessions: once an approved transfer succeeds, additional preparations are denied until a separately approved server session is started. Its regression test includes another app session. The source-level native date checks now run in the automated suite as compiled Swift, without EventKit access. All 489 tests pass. The current successful preview is being allowed to expire before returning the local gateway to its default transfer-disabled mode. No database save, calendar edit, cloud connection or AI processing was performed.


Final cleanup verified: both the native helper and browser displayed their automatic expiry messages; the private handoff file was absent. Stopped the preview-enabled gateway and restarted the default local gateway without any real-calendar transfer flag. Its status confirms real-calendar transfer is disabled. The one-time approval is consumed; another real-event transfer needs separate approval. The temporary preview is complete, with no persisted calendar records or production/database changes.


## Saved-copy age visibility — November 8

The saved-source Brief now shows per-source snapshot counts, oldest and newest app save timestamps, unknown timestamp counts and empty-source state. It explicitly distinguishes saving an app copy from checking Google or Chase: last source check remains unknown. Google read projection now includes existing database `created_at`; no provider fetch or database mutation was added. Read models take save times only from that database field, not payload claims, message arrival or transaction dates. Malformed, rolled or future save timestamps become unknown for the inventory; database microsecond timestamps normalize safely.

Added tests for mixed save ages, missing/future/invalid timestamps, fixture exclusion, no financial/source-identity leakage, database timestamp provenance and the display contract. Full suite: 493 passing. Browser-tested the actual UI with a separate in-memory fictional server showing older/newer Gmail copies, one unknown save time, no saved Google calendar and two Chase copies. Proof: `/private/tmp/curated-brief-save-times-fictional.png`. Closed the fixture tab and stopped its server. Restarted the local gateway in its default mode to load the change; real-calendar transfer remains disabled. No real sources were read or saved during this increment, and no production/database changes occurred.


## Encrypted Mac-calendar storage preparation — November 8

Prepared a separate pure import planner and sealed repository for owner-private Mac calendar snapshots. It requires a complete bounded owner/selection preview, explicit selected event keys and stable calendar/event/recurrence identities. All-day exclusive dates and timed instants are preserved. Matching copies are unchanged on retry, altered content requires conflict review, and tombstones or identity/scope collisions block saving. Source identifiers, calendar names, event titles, recurrence anchors and timing are encrypted together; associated data binds ciphertext to owner, record and origin. This identity strategy deduplicates the same supplied Mac event identities; EventKit moves/recreation can change identifiers, so it does not promise universal cross-device or recreated-event deduplication.

Added repository support for `provider_mac_event` under Calendar with `apple_readonly`/`apple_import_qa` origins. Existing generic development table/policies support this shape; no schema or policy change is proposed. These storage modules are not wired to the native helper or public save routes. The temporary bridge still does not expose event identifiers or permit database saving. Real saving requires a separately authorized fresh preview with identities, a review interface and explicit approval after development acceptance.

Hardened the shared import executor: cached review contents now clear on their deadline and gateway sign-out, and session/review validity is rechecked after asynchronous write authorization immediately before a database insert. Offline regressions prove sign-out/expiry during that check prevents writes.

Prepared `tools/verify-mac-calendar-storage.mjs`, offline by default. Its explicit test is capped at two deterministic fictional encrypted private records in the exact separate development project, using the two existing test accounts and existing private provider encryption key without changing it. It verifies ciphertext-only stored payloads, owner reread, second-account invisibility, repeat-without-insert, and blocked changed-content overwrite; then it reversibly soft-deletes only the two exact content-verified QA rows with revision guards and rereads cleanup. It performs no Calendar reads, real-event transfer, schema changes or live-app changes. A named run supports resuming an uncertain insert without duplicates; resume-only mode can finish an interrupted partial cleanup without new rows and reports cleanup separately from full acceptance.

All 504 automated tests pass, including fake-network execution of the entire checker, lost acknowledgement and interrupted cleanup. Privacy check: all eight probe paths protected, zero tracked private files; whitespace check passes. No new credentials, key read, database access or real-provider operation was performed for this increment. Next approval gate: execute this exact two-record fictional development database test. No storage UI or real saved-calendar claim is made before that acceptance.


## Approved encrypted Mac-calendar development acceptance — November 8

The owner approved the exact two-record fictional storage/privacy check. Executed `verifyMacCalendarStorage` against the confirmed separate development project `fngauurauwvbawlfzbbe`, run `3bea005a-3f80-48cc-820b-2cde7f2d7c27`. The checker completed successfully: two new fictional private records, two encrypted payloads, zero rows visible to the second independent account even when querying account A's IDs/owner filter, zero inserts on repeat, changed-content save blocked, and both exact test records reversibly soft-deleted with a final content-verified reread. No schema, security-rule, existing-record, native Calendar, real-event or production changes occurred. Existing local provider key was read privately, not changed. This acceptance covers fictional storage, not real calendar persistence.

## Real-calendar review interface prepared (not enabled)

Added a separately opt-in identifier-review mode to the native helper and one-use bridge. The standard preview still strips identifiers. Only the explicit identity-review build captures calendar/event identifiers and an optional original recurrence anchor; its transfer must match an identity-review handoff. Both remain temporary on this Mac. Browser review items contain whitelisted title/calendar/timing and opaque hashed selection keys, never raw source identifiers. Private server review state is owner/session-bound, cloned, cleared on sign-out/expiry and capped by the original five-minute preview deadline. Saved-copy comparisons use the existing encrypted development repository through read-only queries. No Mac-calendar save endpoint exists; review reports `saveEnabled:false` and has no save control.

The UI lists the full bounded transfer, with every event initially unchecked, an explicit review-selected action, new/already-saved/conflict counts, and an explanation that nothing is saved. Actual handler/bridge tests verify raw identifiers stay out of browser responses, missing/mismatched identity mode is rejected, other sessions cannot read the preview, review performs reads only, and a forged save request returns 404 without a database write. Compiled native payload tests verify identifiers are omitted in standard mode and absent recurrence encodes safely as null.

The updated real helper compiled and passed its self-checks without launch or Calendar access: `.local/calendar-preview-builds/c5d17704-fd03-4d6d-92ce-fef2e47eadd5/Curated Chaos Calendar Preview.app`. Browser-tested the complete actual handler/UI with two in-memory fictional native transfers on a separate temporary server: both initially unchecked, then deliberately selected, yielding New 2 / Already saved 0 / Conflicts 0 / Nothing saved. Proof: `/private/tmp/curated-mac-calendar-review-fictional.png`. Closed that tab and stopped the fictional server. Full suite: 509 passing; all eight privacy probes protected and zero tracked private files. The actual local gateway remains in its default real-transfer-disabled mode.

Next approval gate: fresh one-time review of up to five real events from the same five owner-selected calendars, November 8 through December 8, 2026 (end excluded), America/New_York, including internal calendar/event IDs and recurrence anchors for repeat-copy recognition. It expires within five minutes, compares only existing saved development copies, and does not save any real records or send content to AI. A separate later approval is required before real database saving.


## Approved real identifier review — November 8

Owner approved the bounded fresh five-minute identity-bearing review, with database saving disabled. Started only the local gateway with the exact five-calendar/five-event scope for November 8–December 8 (end excluded), America/New_York, and opened the identity-review helper. Owner granted the macOS Calendar prompt. Compared the five available calendar labels locally with the previously owner-selected five: exact match, with no names emitted; restored that same selection rather than asking for five repeated clicks. The helper produced five events, explicitly transferred them once, and the browser listed five initially unchecked items. Selected the five approved events for review only. The owner-authenticated existing-copy comparison returned New 5 / Already saved 0 / Conflicts 0 / Nothing saved. No event titles, source identifiers or private dates were emitted into agent output; no real database writes or AI processing occurred.

Browser review expiry was observed with zero items remaining. The private handoff file was absent. The native expiry status could not be re-observed because macOS window capture returned an invalid-parameter error; do not claim independent visual native-expiry proof for this run. The helper's five-minute clearing code is unchanged. Stopped the review-enabled gateway, clearing its in-memory state, and restarted default mode without transfer/review/save approval flags. The real review approval is consumed.

## Bounded encrypted real-save path prepared (not enabled)

Prepared optional saving only after a separate server-side approval, complete fresh review and explicit Save reviewed Mac events action. Saving is capped at five transferred events in the approved scope. Startup requires identity review and the exact confirmed separate development target, checked before provider-key-store creation. The handler permits one successful batch, blocks competing saves including a second request that awaited body parsing, consumes a reviewed approval through the shared insert-only executor, encrypts all content/source IDs and verifies acknowledgement plus reread. Conflicts, tombstones, expired/session-changed reviews and source changes block execution. Uncertain saves never retry automatically; the UI directs the owner to read saved snapshots and review again. No changes to native calendars or existing database records are supported.

Added owner-private saved Mac snapshot reads and whitelist models, with native source/recurrence identifiers excluded from browser responses. Saved Mac copies now participate in date/time-zone Daily Brief overlap and save-time inventory, excluding QA records. A dedicated saved Mac snapshot panel distinguishes permanent copies from temporary previews. Real saving is disabled by default and was never enabled on the running actual gateway in this increment.

The updated native helper's disclosure now correctly separates its temporary transfer from a separately approved app save. It compiled/self-tested without launch or Calendar access: `.local/calendar-preview-builds/17f19a6e-132d-454f-95cc-b518719e4bf4/Curated Chaos Calendar Preview.app`.

Browser-tested the complete actual handler/UI/sealed-memory repository with two invented events via `tests/fixtures/mac-calendar-ui-server.mjs --fixtures-only`: select/review, explicit save, verified two-copy list, and date-filtered Mac event plus saved-copy inventory in Daily Brief. No credentials or real database/provider access exist in that fixture. Proof: `/private/tmp/curated-mac-calendar-save-fictional.png`. Closed its tab and stopped its server. Automated tests cover the encrypted one-batch save, overlapping save denial, hidden source IDs, revoked saved reads, malformed/deleted/mixed-owner rows, QA exclusion, date overlap and exact-target startup rejection before key-store creation. Full suite: 514 passing; eight privacy probes protected, zero tracked private files; whitespace check passes.

Next approval gate: refresh the same bounded five-calendar selection and save up to five newly reviewed real event copies as encrypted private records in the separate development database. Unlike temporary previews, these would remain saved after preview expiry. Fields are event title, calendar label, timing/all-day status and internal calendar/event/recurrence identifiers used for repeat-copy recognition. No edits to source Calendar, no overwrites of existing records, no AI processing or production changes. Approval has not yet been granted for this persistent real-data step.


### Real-copy save approval received; native handoff pending

Owner approved refreshing the same five-calendar selection and saving up to five newly reviewed encrypted private development copies for November 8–December 8, America/New_York. Started the local gateway with that exact bounded scope and explicit development target `fngauurauwvbawlfzbbe`; no write has yet been requested. Restored app sign-in and read the saved Mac snapshot panel: zero saved snapshots before this approved save.

Direct native launch/capture failed. Reset the computer-control session, then opened the prepared helper through Finder and observed the expected review disclosure and dates. Subsequent native control/inspection failed with macOS ScreenCaptureKit invalid-parameter errors. The browser remains usable. A private one-use handoff was prepared. Asked the owner to complete Connect / permission / same-five selection / Preview / Review in Daily Brief manually while native automation is unavailable. This is an access handoff, not a new save-approval request. Save approval remains valid for the same bounded operation; it has not been consumed. Do not claim any real calendar copies saved until the reviewed save succeeds and reread is verified.


## Approved five-event encrypted save completed — November 8

Owner approved refreshing the exact five-calendar/five-event selection and saving up to five freshly reviewed copies in the separate development database. Native app launch/capture initially failed. Opened the approved immutable helper through Finder and observed the correct dates/disclosure. Later native controls remained unavailable, so the owner completed Connect, Calendar permission, selection, Preview and explicit transfer manually, reporting Preview transferred. No new save approval was requested; the existing bounded approval was used.

The owner-authenticated app received five review items. Explicitly selected those five and reviewed them: New 5 / Already saved 0 / Conflicts 0. Executed Save reviewed Mac events once. The handler returned Saved and verified 5 / Already saved 0; a separate saved-snapshot panel read returned five. No event titles, calendar names, private timing or source identifiers were emitted into agent output.

A separate read-only verification using the existing two independent test accounts and the confirmed development project found exactly five active `apple_readonly` Mac rows for account A, all owner-private with no household, all having only the encrypted payload envelope (`version`, `scheme`, `encrypted`). AES-GCM envelope structure was checked without decrypting or printing contents. Account B queried account A's exact IDs/owner scope and saw zero rows. This verification performed zero writes or Calendar reads.

Stopped the save-enabled gateway, removed its consumed owner-private one-use handoff file after matching the exact scope/endpoint, and restarted the default gateway without transfer/review/save approval flags. Restored owner sign-in, confirmed zero transfer controls, and reread the saved Mac panel: all five copies remain available after restart. This consumes the bounded real-save approval. No further transfers/saves are enabled, no existing records were overwritten, and no Apple Calendar event, schema, security policy or live app was changed. The native helper's ordinary expiry remains its own five-minute timer; native clearing was not independently re-observed because of the macOS capture problem.

No code changed during this acceptance; the last complete automated suite remains 514 passing. Existing local provider encryption key was reused without rotation. These are saved development snapshots, not automatic calendar synchronization or a production deployment.


## Unified saved-source search — November 8

Saved-source search now combines owner-private whitelisted Google email/calendar copies with encrypted Mac calendar copies. The API reads saved repositories only, confirms the session before and after the combined read, and rejects the entire result if either source fails validation or the session ends. Raw Mac source/recurrence identifiers stay server-side. Search matches event titles, mail senders and Mac calendar labels, includes an explicit Mac Calendar filter and accurate source labels, and states that no source has been refreshed. Failed reloads clear the old in-memory search inventory.

Browser-tested with a separate in-memory fictional server seeded with two encrypted QA Mac copies: both listed, title search reduced to one, calendar-name search found both, and Gmail filtering gave a clear empty result. Proof: `/private/tmp/curated-saved-mac-search-fictional.png`. Closed the tab and stopped the fixture server. Restarted the real local gateway in default transfer/save-disabled mode to load the search change. No real source reads, new snapshots or database changes were performed for this search acceptance.

## Encrypted saved-provider backup prepared (not executed)

The earlier password-protected recovery archive covers local keys/credentials, not saved database records. Prepared `tools/backup-saved-providers.mjs` to make one encrypted local snapshot of exactly the currently approved real provider inventory: nine email metadata copies, three account copies, twenty-nine transactions and five Mac event copies (46 total; no saved Google events). It is a narrow saved-provider backup, not a full backup of app tasks, profiles, households, credentials, connection grants or the database.

The entrypoint defaults to an offline plan. Actual creation requires separate approval, the exact confirmed development project and `--records=46`; any changed inventory stops before key access/export. It reads only the existing owner's private saved rows, excludes QA records, rechecks the owner, and validates payload scope/field lists. Source encrypted envelopes and decrypted finance/calendar read models are authenticated locally; unexpected credentials, mail bodies or extra payload/envelope fields are rejected. No provider refresh, DB write, restore, external upload or key rotation exists in this operation.

The archive encrypts all records, owner/project metadata and timestamps with the existing provider key. It creates an exclusive owner-private `.ccsnapshot` under `~/Library/Application Support/Curated Chaos/Recovery/ProviderSnapshots`, validates the canonical private parent, refuses links/public directories, syncs to disk, and decrypts/rereads only in memory to verify the exact snapshot. Existing files are never overwritten; verification failure removes only this operation's own new file. Recovery requires the existing provider key, whose separately password-protected recovery archive already exists. Both remain Mac-local until a later approved external-drive copy; no protection against losing the Mac is claimed.

Tests cover a complete invented 46-record backup through fake database reads and actual encrypted disk verification, a changed inventory stopping before key access, wrong keys/owners/projects, tampering, malformed/shared/deleted/QA records, unexpected credentials/bodies, exclusive writes and private-path safeguards. Added `*.ccsnapshot` to Git ignores and to both ignore-probe and tracked-private-file checks. All 527 tests pass; nine privacy probes protected, zero tracked private files; whitespace check passes. No real backup was created. Next approval gate is creation/verification of this exact one encrypted Mac-local 46-copy provider snapshot.


## Approved encrypted saved-provider backup completed — November 8

Owner approved one encrypted Mac-local backup of the exact 46 saved copies. Executed `tools/backup-saved-providers.mjs --allow-private-provider-backup --project=fngauurauwvbawlfzbbe --records=46`. The confirmed development owner inventory matched nine email metadata copies, three account copies, twenty-nine transactions and five Mac events. The tool created, synced, authenticated and exact-reread verified one encrypted archive:

`/Users/sam/Library/Application Support/Curated Chaos/Recovery/ProviderSnapshots/badc7990-6c0c-4718-a9c0-74408aec5f5d.ccsnapshot`

Reported verified=true, recordCount=46, encrypted=true, zero provider reads, zero database writes, credentialsIncluded=false, restoreAttempted=false. A separate metadata-only check confirmed a nonempty regular file owned by this user with mode 600, without reopening contents. The existing provider encryption key was reused without rotation; no existing archive/file was overwritten. No real data, credentials, source identifiers or monetary contents were emitted into agent output.

This consumes the single backup approval. Keep this archive together with the existing separately password-protected key recovery archive for later external-drive copying. Both are currently on this Mac; no hardware-loss protection, external copy, full app/database backup, automatic refresh, scheduled backup or restore drill is claimed. Last full test suite remains 527 passing; no implementation changed during the real acceptance. Reviewed the remaining blueprint gates afterward: production authentication, household/guardian controls, broader recovery/restore testing and physical-device acceptance still remain. No deployment or further database changes occurred.


## Read-only recovery preview verified — November 8

Prepared `server/provider-restore-preview.mjs` and `tools/preview-provider-restore.mjs`. The entrypoint defaults offline and has no restore/apply/write option. It authenticates the selected encrypted backup for the same verified owner/development project, reads only its exact record IDs, rechecks identity, and prints counts only. Private file/key reads require regular owner-private mode-600 canonical files, no symlinks and bounded lengths. Unknown/duplicate current IDs or unverifiable current ciphertext abort the comparison.

The pure planner proposes inserts only for missing archived records with valid original save metadata. It preserves matching content even when current ciphertext was re-encrypted or its revision increased. Content changes are conflicts; visible scope/owner/type/origin changes, tombstones and older/invalid revisions block action rather than undo later decisions. Missing old save metadata also blocks a proposed insert. No executor, upsert, update, deletion, restore, file writer or cross-project identity remapping is exposed by this preview. A future actual restore still needs a separate implementation/acceptance and owner approval before database changes.

Fictional tests cover missing/current copies, detached proposal data, new encryption with the same content, changed content, tombstones, foreign/shared scope, revisions, duplicate/unknown IDs, corrupt ciphertext, CLI write-flag rejection, exact-ID GET-only reads, count-only output, mismatched-target refusal and private file guards. Shared fictional snapshot fixtures were factored out without changing the existing encrypted backup format.

Ran the read-only preview on the existing approved archive `badc7990-6c0c-4718-a9c0-74408aec5f5d` against the confirmed isolated development project and owner. Result: verified 46, already present 46, missing proposals 0, conflicts 0, blocked 0, restorePerformed=false, databaseWrites=0, fileWrites=0, providerReads=0. This confirms the archive remains readable with the existing key and matches the saved copies; it is not evidence of an executed disaster restore or full app/database recovery. No contents, source identifiers, credentials or amounts were printed. The archive itself was unchanged.

Full suite: 535 passing; nine privacy probes protected, zero tracked private files; whitespace check passes. No production changes, new backup, native Calendar access or database writes occurred.


## Insert-only recovery and hosted fictional drill prepared — November 8

Added a server-only restore executor with a default-deny write policy. It authenticates the encrypted archive for the verified same owner/project, builds a bounded read-only plan, stores a detached encrypted archive for a one-use five-minute review, rechecks current copies and session after asynchronous authorization, and executes one atomic insert-only batch only if approved. Conflicts or blocked/tombstoned/scope-changed records prevent the whole batch. Matching current copies are never overwritten. Insert acknowledgements and final rereads must preserve original payloads, source ownership, revision and original save timestamp. An uncertain acknowledgement is not retried automatically; a fresh review recognizes inserted copies without duplicates. Explicit session forgetting also cancels known in-flight preparation/authorization, and disposal clears the review cache and private key copy. This executor is not exposed through an HTTP endpoint or the read-only preview command.

Added a marked QA archive mode requiring an exact fixture run in both archive inspection and record validation, with matching QA origins and payload markers. Ordinary real backup and read-only preview remain unable to accept QA archives; the real archive format/default is unchanged. No real archive was opened or changed during this work. The repository's existing created_at field is now included consistently in read/insert acknowledgements so restoration timestamps can be verified.

Prepared `tools/verify-provider-restore.mjs`, offline by default. The explicit hosted test requires an exact confirmed development project, named run and two-fixture cap. It builds an encrypted archive of two clearly labeled fictional Mac events entirely in memory, restores those two records, verifies original save times, encrypted storage, independent-account privacy, duplicate-free repeat and changed-archive conflict blocking, then reversibly soft-deletes only the exact content-verified QA rows with revision guards and rereads cleanup. It does not open a real backup, access native Calendar/providers, change existing records or schema/policies, rotate keys, or deploy anything. It reads the existing private provider key only after the target/accounts are verified. A named resume recognizes a lost insert acknowledgement without creating duplicate rows; resume-only cannot create missing fixtures and can finish exact partial cleanup.

Offline acceptance covers the complete fake-network drill, lost acknowledgement, interrupted cleanup, preserved unrelated records, corrupt resumed fixtures, target/scope flags and absence of a run. Eight executor tests cover default denial, exact data/version/time preservation, same-session single claim, conflicts/tombstones, late expiry/sign-out, stale-resolver cancellation, uncertain insertion and bad timestamp acknowledgement. Shared fictional QA storage fixtures were factored out. All 549 tests pass; nine privacy probes protected, zero tracked private files; whitespace check passes. No connected database writes or real restore occurred. Next gate: owner approval for this exact two-record fictional development restore drill.


## Approved hosted fictional recovery drill completed — November 8

Owner approved the exact two-record development drill. Executed `verifyProviderRestore` against confirmed isolated project `fngauurauwvbawlfzbbe`, named run `8ffd7e21-70b5-44c0-afce-dbec519c6993`. The complete drill passed: two encrypted fictional event records recovered from a marked in-memory QA archive, original save times preserved, zero inserts on repeat, changed-copy recovery blocked, zero visibility from the second independent account, and both exact QA records reversibly soft-deleted with a verified cleanup reread.

The tool reported realArchiveReads=0 and providerReads=0. The existing local encryption key was read privately without modification. No real backup, existing records, Calendar events, schema/policies or live app was changed. No credentials, source contents or keys were printed. This consumes the two-record drill approval. The result proves the bounded same-owner insert-only recovery path against the hosted development schema; it does not claim a personal-data restore, cross-project identity recovery or complete database disaster recovery. No code changed during this acceptance; the full suite remains 549 passing.


## Account reliability and prepared session revocation check · November 8

My Account now imports its saved-finance entry renderer correctly; its signed-out page was verified in the browser. The import-aware controller harness tests both signed-out and signed-in rendering. Preferences retain complete drafts after errors, block uncertain writes or concurrent edits until an explicit reload, verify matching write acknowledgements and rereads before reporting success, exclude deleted/shared rows, and ignore late work after sign-out. Successful save, failed save, uncertain acknowledgement and sign-out races are covered with fictional in-memory adapters; no real preferences were written.

Migration 004 is PREPARED ONLY. It adds a boolean check matching the authenticated JWT owner/session to auth.sessions, with a fixed search path and narrowly granted functions; anonymous callers cannot execute it, and authenticated callers receive no table access or session identifiers. It changes no app records or existing row policies. Offline PostgreSQL tests verify malformed/missing/mismatched claims, deleted-session rejection and independent-session survival.

The private connection gateway has an optional fail-closed active-session guard, disabled by default and not enabled in the running gateway. Exact development-project startup approval is required. Tests cover cookie bootstrapping/password login rejection, unavailable checks, sign-out during checks and revocation during a saved-record read. `tools/verify-development-sessions.mjs` defaults offline; a separately approved hosted test would create two new logins for existing development A/B accounts, close only those new sessions with local-scope sign-out, check revocation/isolation and clean up. No source refresh or app-record writes are part of that test. Migration and hosted acceptance remain pending approval. This narrow check does not complete app-wide production authentication, device management, timeout enforcement or replacement of legacy per-tab tokens.

Validation: all 573 tests pass; repository privacy check passes nine ignore probes and finds zero tracked private files; diff whitespace check passes. No live deployment, database change, real-source read or credential disclosure in this increment.


## Approved session-check acceptance and next protection · November 8

Owner approved migration 004 and its bounded hosted acceptance. Applied the exact migration in Supabase's SQL editor for fngauurauwvbawlfzbbe (new query a32c1c1b-0ab4-48cd-9ae8-b834f62c980b); result Success, no rows returned. The verifier created two temporary existing-account logins, demonstrated revoked access denied/independent login still active, and closed both. App records changed: zero; provider reads: zero. Enabled the local gateway with --require-active-development-session and the exact project guard. Other source-transfer/save flags remain disabled. Unsigned local status returns no connections. This approval is completed and consumed.

Next, migration 005 is PREPARED ONLY: four restrictive policies require an active session for profiles, households, memberships and records in addition to existing owner/household rules. It does not grant access or edit records. Offline PostgreSQL tests cover revoked reads/updates/inserts, preserved owner/household boundaries, missing/mismatched claims and normal fictional create/version-update. The existing verifier now has a separately gated --verify-record-access mode: new disposable A/B logins, bounded reads of only record identifiers/owner IDs (no payloads), revoke new A, confirm direct record access denied and B's bounded identifiers unchanged, then close B. It writes no app records. Applying these policies and running this new acceptance need a fresh owner approval; neither has happened. Remaining production authentication and device-session management gaps are unchanged.

All 579 tests pass, privacy nine-probe check passes, and diff whitespace check passes. No live app/database change.


## Database session enforcement accepted; widget follow-up · November 8

Owner separately approved migration 005 and its read-only two-login acceptance. Applied the exact migration in the isolated development SQL editor, query 60c3f74b-34aa-4500-a873-be79dd29430f; Success, no rows returned. Hosted acceptance verified a new active A login could read bounded own identifiers, revoked A could no longer read records, and B's bounded identifier set stayed unchanged. Both new logins were closed. Zero app-record changes/provider reads. Four restrictive session policies now supplement existing owner/household policies. This approval is completed; do not rerun new hosted tests under it. App-wide production authentication and device-session management remain unfinished.

Local widget audit fixed deleted dashboard layouts appearing in reads/model selection and being editable through the versioned API. Widget saves now verify acknowledged normalized content and reread content, retain drafts on uncertainty, and disable repeat saves until explicit draft discard/latest-load review. Workspace loading also checks its generation after token acquisition before starting reads. Tests cover these paths with fictional adapters.

`tools/verify-widget-storage.mjs` is PREPARED ONLY, default offline. After separate approval it creates one private fictional layout with exact run marker/ID and old initial timestamps, verifies edit and stale-write rejection, confirms second-account invisibility, reversibly soft-deletes that exact test row, verifies deleted-row list/model/update exclusion, and closes its two temporary existing-account logins. Exact scope/version checks and cleanup rereads protect unrelated rows; lost insert acknowledgement attempts only exact-fixture cleanup and never repeats insertion. Existing-ID collisions stop without cleanup or overwrite. No real providers, existing layouts, security changes or live app are touched. Actual one-row acceptance is pending approval.

Validation: all 588 tests pass, plus focused verifier tests after reporting cleanup improvements; privacy check still passes nine ignore probes with zero tracked private files; whitespace check passes. No new real-source reads or live deployment.


## Widget acceptance passed; Daily Brief Settings follow-up · November 8

Separately approved one-layout hosted run d626cc20-eae0-49aa-b3ad-df202c60c48a passed in the isolated development project: one fictional row created and edited, outdated update denied, account B saw zero, exact row soft-deleted with reread verification, deleted row excluded from list/model/update. Both temporary logins closed. No existing layouts/security policies/source refresh/live app changes. Approval is consumed; do not rerun a new fixture without approval.

Daily Brief Settings had independently retained older save logic and omitted navigation from writes, which reset My Account navigation to defaults. It now preserves navigation while editing appearance/filter choices and uses the same draft-retention, uncertain-write review, acknowledgement/reread-content checks and generation/owner guards as My Account. A late post-save reread cannot restore private preferences after logout. Three new actual-import controller regressions demonstrated failures before the fix and pass afterward. These fixes are local; no actual preferences were saved.

Prepared only: tools/verify-preferences-storage.mjs requires separate exact-project/run/one-fixture approval, creates one fictional private preference record, tests a revisioned appearance/navigation update, blocked stale writes, second-account isolation, reversible removal and tombstone exclusion from list/model/updates; closes its two new test logins. The fixture may briefly become the latest DEVELOPMENT preferences during the test; existing preference records are never edited. Offline guard/success/collision/lost-acknowledgement cleanup tests pass. No hosted execution yet.

Validation: all 596 tests pass; nine-probe repository privacy check passes with zero tracked private files; whitespace check passes. App-wide production authentication, guardian/family essentials, complete database/separate-device recovery and full device acceptance remain release gates.


## Preferences acceptance passed; first-save uniqueness prepared · November 8

Separately approved one-record preferences run b401cffd-6dc6-45b2-a5d5-6e07ac0e78a6 passed in fngauurauwvbawlfzbbe: fictional appearance/navigation update, stale-write rejection, B visible rows zero, reversible exact-fixture removal/reread, deleted-record list/model/update exclusion, both temporary logins closed. No existing preferences, providers, schema or live app changed. This approval is consumed.

Read-only aggregate query 4bb39c6a-3472-4220-92ba-b32a07973b91 checked active private brief_preferences/dashboard_layout groups: zero duplicate-owner/type groups. It returned no owner identifiers or payloads and changed no app records. This snapshot is not a concurrency guarantee.

Migration 006 is prepared, not applied: one partial unique index on owner_id/item_type for active private, household-null preferences and layouts. It prevents two simultaneous first saves creating competing active records; deleted rows may coexist with one replacement, but restoring a deleted record alongside an active replacement is rejected. Existing owner/household/session policies stay intact. Existing duplicates cause transactional index creation to fail with no cleanup or overwrite. Offline PostgreSQL tests prove duplicate rejection, independent owners/types, replacement/restoration behavior, harmless failure with legacy duplicates and exclusion of unrelated/household records. No change to first-release scope.

Next approval is only for applying the prepared development index and reading its schema definition/validity afterward; no new fixture rows or test logins are needed. Earlier one-row acceptance scripts may be unable to create fixtures for owners that already have active settings after this rule is installed; do not bypass it or rerun completed acceptance approvals. All 601 automated tests pass, privacy nine-probe check passes with zero tracked private files, whitespace check passes. Production deployment remains untouched.


## Development settings uniqueness installed · November 8

Owner approved migration 006. Applied its exact SQL in fngauurauwvbawlfzbbe, query 737ca34c-9eef-4f1a-a4cf-2ec9490ceec0; result Success, no rows returned. Separate read-only query 6e4f06dd-3609-49ab-98b7-7cf97a5788c9 returned one installed index with indisunique=true and indisvalid=true. Verified exact owner_id/item_type columns and brief_preferences/dashboard_layout + private + household-null + undeleted predicate. No app records edited/removed, new fixture rows, new login sessions, provider refreshes or live project changes. Approval completed.

Current isolated database now enforces the session and active-settings uniqueness protections in migrations 004–006. Prior per-owner one-row acceptance tools are historical one-shot procedures; they must not be rerun against an owner with existing active settings or used to bypass the installed uniqueness boundary. Existing 601 offline tests pass; the hosted uniqueness check was schema inspection only, with insert/replacement behavior separately tested in offline PostgreSQL. Remaining release gates at the top of this plan remain open; this is not a production-release certification.


## Prepared broader private-workspace backup · November 9

The existing verified real provider archive covers only 46 saved source copies, not other private app records. Prepared server/private-workspace-backup.mjs and tools/backup-private-workspace.mjs to address that narrower owner-record gap. Default invocation is offline. No actual workspace records, credential files or encryption key were read for this increment; no hosted logins or backup files were created.

After separate approval, exact development target and existing account-A temporary login, the tool reads only that owner's private household-null cc_records, including deleted records and saved provider copies, capped at 2000 rows/5 MB plaintext. Identifier-keyset pagination rejects foreign/shared/duplicate/out-of-order rows. Two matching inventories and a final live-session check are required before reading the existing provider key and writing. This is matching-read consistency, not a transactional whole-database snapshot. All original record IDs, payloads, revisions, created/updated timestamps and tombstones are preserved.

A new typed AES-256-GCM archive binds owner/project identity in encrypted content and uses its own authenticated format context, distinct from provider archives. Output is a new exclusive 600 file under a canonical owner-private recovery directory, followed by exact authenticated disk reread. Existing files are never overwritten; error cleanup removes only this operation's own inode. The existing key is wiped from this operation's memory buffer afterward and never rotated; the temporary login is closed. Default output directory is Recovery/WorkspaceSnapshots and suffix .ccworkspace. Git ignores that suffix and the privacy checker now tests ten protected paths, including forced-tracked workspace archives.

Scope excludes profiles, households/memberships, shared records, auth accounts, credential files, provider connection grants, database schema/storage and other owners. It does not replace a full database backup, include an automatic restore, or protect against loss of this Mac. Existing key/credential recovery and external-device backup remain necessary. Private note payloads are copied as saved; the tool makes no claim to detect secrets a user may have written inside ordinary records. It performs no database writes, source refresh, external upload or live-app change.

All 613 automated tests pass. New tests cover encrypted roundtrip/tombstone preservation, tampering/wrong identity/key, ownership/scope rejection, mode 600/exclusive writes/symlink refusal, exact-target gate, matching/changing inventories, key wiping/login cleanup after failure, and pagination past one page. Privacy ten-probe and whitespace checks pass. Actual owner-private workspace backup remains pending a new approval.


## Approved private-workspace backup verified · November 9

Owner approved one encrypted private-workspace backup. Created and disk-reread verified archive 2116bd95-0964-4fc0-84dd-dae3d2a8dc89.ccworkspace in this Mac's private Recovery/WorkspaceSnapshots directory. It contains 129 owner-private cc_records, including deleted records and saved provider copies. AES encryption, exact authenticated reread and mode 600 verified. Temporary login closed. Database writes zero, provider reads zero, restore attempted false; existing files/key unchanged. No shared household data or credential files exported. This approval is consumed; new exports require a new applicable approval.

This extends saved-provider coverage to the account's private workspace records; it is still not a complete database backup or separate-device disaster-recovery copy, and actual restoration of this broader archive has not been tested. Profiles/memberships/shared records/auth accounts/schema/storage are excluded. Existing key/credential recovery remains necessary to decrypt it. No production deployment.


## Workspace recovery comparison and prepared fictional drill · November 9

Added a counts-only read-only workspace archive comparison. It authenticates the exact archive/owner/project/key, checks the approved record count, requires two matching current private inventories, rechecks the temporary login, compares without returning payloads and closes the login/wipes its key buffer. There is no restore flag, insertion payload or public write endpoint. Missing archived tombstones are not proposed as active records. Deletion-state differences, changed content, older revisions, changed creation times/scope, active singleton competition and approved-source task uniqueness are blocked or flagged. Unrelated current records are only counted, never proposed for removal. Ciphertext changes in nested provider payloads conservatively count as conflicts; no generic semantic decryption is attempted.

Under the standing authorized read-only app/recovery review, compared real archive 2116bd95-0964-4fc0-84dd-dae3d2a8dc89 against current development private records: all 129 unchanged, zero missing/archived-deleted/conflicts/blocked/current-only. No app-record or file writes, source refreshes, upload or restoration. Temporary login closed. This confirms comparison, not actual restoration of 129 records or full database recovery.

Prepared tools/verify-workspace-recovery.mjs for a separately approved two-record hosted drill: creates only a marked fictional note/task archive and random key in memory, inserts those exact two new records under current session RLS, verifies original revision/created/updated preservation, owner reread/second-account invisibility/repeat unchanged/changed-content and deleted-state protections, then reversibly removes exact scoped fixtures and closes both new logins. Real backup/key files are never read. No overwrite/upsert/undelete/schema change or general restore service is added. Lost acknowledgement triggers only marker/ID/owner/version-checked cleanup; existing-ID collision stops without cleanup. Interrupted cleanup can finish only its verified remaining rows in finally; otherwise stop for inspection. This drill is pending fresh write approval.

All 632 tests pass, including offline PostgreSQL acceptance against migrations 001–006, failure/cleanup guards and comparison conflicts. Privacy ten-probe and whitespace checks pass. Production auth/family/device/full recovery gates remain open.


## Approved workspace recovery drill passed · November 9

Separately approved hosted run 8e3ef286-dcfb-4086-80c7-df81c7503240 passed in fngauurauwvbawlfzbbe: two fictional note/task records recovered from an encrypted in-memory test archive, original revisions and created/updated times preserved, account B visible rows zero, repeat comparison unchanged two, changed copies flagged and deleted copies blocked. Both exact fictional rows were reversibly soft-deleted with reread verification; both temporary logins closed. Real archive reads zero, real key reads zero, provider reads zero. No existing records/schema/policies/live app changed. Approval is completed and consumed.

This proves the bounded fictional insertion/comparison/cleanup path only, not actual restoration of the 129-record real workspace archive, all payload dependencies, profiles/shared household data, cross-project identity mapping or complete database recovery. The real archive remains unchanged at its original 129-record capture; these two new deleted QA fixtures are later records and are not automatically added to that backup.


## Server-held workspace session foundation · November 9

Moved the next local development focus from recovery to the unresolved browser renewal-token boundary. Added server/private-workspace-sessions.mjs as a server-only, in-memory session component; it is NOT wired to workspace screens, the connection gateway, HTTP routes or browser storage. Existing development sessions still use their prior per-tab implementation. No production-authentication completion is claimed.

The component keeps upstream access/renewal credentials only in server memory and exposes opaque random handles, a CSRF binding and whitelisted user/expiry metadata. Session handles are stored hashed internally. Capacity, idle lifetime (at most 30 minutes) and absolute lifetime (at most 12 hours) are bounded, with unref expiry timers. Verification checks user identity, token expiry and the installed active-session RPC. Concurrent renewals share one request; late renewals after logout/disposal are revoked and cannot restore state. Protected read callbacks receive credentials only inside the trusted server process and recheck session/upstream validity after reading, withholding late results. They are not a general write proxy or browser transport. Closing/disposal attempts local-scope upstream revocation and reports unconfirmed cleanup honestly.

Prepared tools/verify-private-workspace-sessions.mjs, default offline, for separately approved authentication-only acceptance. It creates two new logins for existing development A/B accounts, shortens only A's local test token expiry metadata to exercise actual renewal immediately (no hosted expiry/configuration change), coalesces concurrent checks, verifies local and upstream revocation, confirms B stays active, and closes both. No app-record reads/writes, provider calls, backup/key access, public endpoint, UI integration or live app changes. Hosted execution remains pending fresh approval.

All 647 tests pass, including revoked/unavailable upstream checks, late read suppression, idle/absolute time limits, single-flight renewal, wrong-owner renewal, late login after disposal, capacity/malformed responses and acceptance cleanup guards. Privacy ten-probe and whitespace checks pass. Remaining work includes actual HTTP-only cookie transport with origin/CSRF controls, complete browser integration, durable deployment/session operations, reauthentication and devices/session UI. The component is groundwork only.


## Approved server-session acceptance passed · November 9

The separately approved authentication-only hosted test passed in fngauurauwvbawlfzbbe: two new temporary existing-account logins, one coalesced real server-side renewal, revoked login blocked locally/upstream, independent login stayed active, both temporary logins closed. App-record reads/writes and provider reads zero; no backup/key access, workspace UI or live app changes. This approval is complete and consumed.

The server-only in-memory session foundation is accepted for this bounded path. It is not connected to workspace screens or an HTTP cookie adapter, so the existing per-tab browser token boundary remains an open release gate. No production authentication completion or enablement is implied.


## Isolated private sign-in browser transport prepared · November 9

Added a separate loopback HTTP adapter, preview UI and standalone entrypoint on 127.0.0.1:5312. It is not wired into the existing workspace/gateway. Upstream access/renewal tokens and vault handles stay in server memory; the browser receives an opaque HttpOnly SameSite=Strict path-scoped context cookie and safe status/CSRF fields. No app-record, arbitrary proxy or filesystem endpoints exist. Exact Host/origin/Fetch Metadata checks, JSON/custom-header/bound-CSRF POST requirements, no-store/CSP/frame protections, bounded contexts and login throttling are enforced. This is HTTP on exact loopback only; no Secure-cookie/HTTPS production claim is made.

Pending-login sequence checks allow logout/cancel before or after body/authentication awaits without issuing a late authenticated cookie. The context CSRF binding remains stable through login completion so a cancel sent before the browser processes the login response remains valid. The server vault handle is distinct and newly generated for each sign-in. Logout retires the context first and clears the cookie; failed upstream revocation is reported honestly. Future production transport still needs its own fixation/rotation, TLS, durable operation and threat review.

Browser-verified fictional preview sign-in, reload persistence and sign-out with no real configuration/accounts/providers: screenshot /private/tmp/curated-private-signin-fictional.png. The fictional service was stopped afterward. Page hiding clears rendered account status/fields; persisted page restoration rechecks status. Password fields are reset after submit; no browser storage API is used by this preview. Existing workspace browser renewal-token storage is unchanged because this is not yet integrated.

Prepared tools/verify-private-cookie-sessions.mjs (offline by default) to start the isolated real development preview temporarily, test two new existing A/B account logins, cookie attributes/safe responses, CSRF/origin rejection, cookie logout and independent status, close both logins and stop the service. No workspace data or backup/key access, no schema changes or provider calls. Hosted execution is pending new approval. Full loopback acceptance with fictional upstream accounts and failure cleanup passes locally.

All 663 automated tests pass, including pending-body/pending-auth/cancel-after-response races and server cleanup. Privacy ten-probe and whitespace checks pass. Existing app/live deployment remain unchanged; production auth and full app browser integration are still release gates.


## Approved private cookie transport acceptance passed · November 9

The separately approved hosted HTTP acceptance passed in the isolated development project: two new temporary existing-account logins, HttpOnly Strict path-scoped cookies verified, CSRF/origin rejection passed, logout cleared the cookie, independent login stayed active, upstream credentials absent from browser-facing responses. Both temporary logins closed and the temporary loopback 5312 service stopped. App-record reads/writes/provider reads zero; no backup/key access, existing workspace UI or live app changes. Approval completed and consumed.

This accepts the isolated sign-in transport only. Existing workspace screens are not yet integrated, and their legacy per-tab renewal-token handling remains unchanged. Production HTTPS/durable sessions/re-authentication/device controls and application-wide integration remain open release gates.


## Private cookie settings read prepared · November 9

Extended only the isolated sign-in preview with an opt-in GET /auth/workspace/preferences route. Default sign-in-only behavior still has no record access; enabling requires allowPreferencesRead and an explicit reader. The server authorizes owner identity/session before and after data access, queries only the verified owner's preferences, rejects foreign/shared/deleted responses and returns normalized whitelisted settings plus safe read-only metadata. Raw record IDs/payloads/credential fields are not returned. There is no settings-write route, arbitrary proxy or existing-workspace integration. Context expiry/cookie lifetime is updated only after successful session re-verification; sign-out/expiry/sequence changes suppress late private responses.

Added a view-only saved-settings panel that reads only after an explicit click. It shows appearance/density/privacy display/navigation/quiet-hours preferences, renders values as text, retains no record data in browser storage, clears the panel immediately on logout/pagehide/expiry and rechecks cached-page sign-in. Server renewal credentials remain outside browser responses. This is still exact-loopback development HTTP, not production authentication/TLS or a replacement for the existing app's per-tab sessions.

Browser-verified fictional sign-in → explicit saved-settings load → logout; the data values were removed (zero remaining rendered preference items, panel hidden). Screenshot /private/tmp/curated-private-settings-fictional.png contains fictional data only. The fictional preview server was stopped afterward. No real account/key/backup/provider reads occurred in preparing this increment.

The existing cookie verifier has a separately gated --verify-preferences-read mode: two new temporary existing-account logins, exactly one owner-scoped preferences-list read each, signed-out access denied, no writes, both logins closed and temporary service stopped. It reports counts only and is pending new approval. Fictional full HTTP acceptance and foreign-data failure cleanup pass. All 670 tests pass; privacy ten-probe/whitespace checks pass. Live app and existing workspace screens unchanged.


## Approved read-only private settings acceptance passed · November 9

Hosted cookie/settings test passed after separate owner approval: two new temporary existing-account logins, exactly two owner-scoped preferences reads, both accounts had supported saved preferences, signed-out reads denied, CSRF/origin/cookie/logout/independent-session checks passed and upstream credentials absent from responses. Both logins closed; temporary loopback preview stopped. App-record writes/provider reads zero; no backups/keys, existing workspace UI or live app changes. Approval completed and consumed.

This proves the isolated cookie-to-preferences read path only. It does not enable preference saving through this transport, migrate existing workspace screens or complete production authentication. Existing per-tab app sessions remain unchanged.


## Reviewed private settings save prepared · November 9

Added opt-in review/save routes to the separate cookie preview; default remains sign-in/read-only and existing workspace screens are untouched. Saving requires explicit read+save startup flags and API capabilities. The browser can propose only appearance palette, density and hide-amounts display values, never owner IDs, navigation, source permissions or arbitrary fields. Server normalization preserves all other supported preferences and extension payload fields. A process-private HMAC binds the current owner/record/version/payload/duplicate count to its read tag; stale tags/duplicates reject review. A one-use random review is bound to the browser context and expires within five minutes. New read/review, logout/disposal or expiry invalidates pending reviews.

Approval claims a review once before asynchronous authorization. The server verifies session/owner, rereads the current tag, rechecks upstream session validity and context/expiry before a version-guarded patch or uniqueness-protected first insert. Matching acknowledgement and full payload reread are required before success. Concurrent saves, stale/deleted rows, field injection and review replay are rejected. In-flight writes cannot be rolled back on logout; uncertain outcomes are reported honestly and never auto-retried. Failed/uncertain browser saves retain the in-memory draft, disable another review/save until explicit discard/latest-load, and clear on logout/pagehide/expiry. Unchanged saved settings produce no write; first-time default saving requires explicit review/approval.

Fictional browser proof: loaded a saved compact layout, reviewed compact→balanced, explicitly approved, observed verified save with unrelated navigation/privacy preferences retained, then signed out with cleared data. Screenshot /private/tmp/curated-private-settings-save-fictional.png is fictional only. The preview process was stopped. No actual development preference writes/logins were performed in this increment.

Prepared verifier mode --verify-preferences-save (requires --verify-preferences-read and fresh approval). It permits at most two version-guarded updates to ONE existing test-A preferences row: temporarily toggle density compact/balanced, then restore the original VALUE through a new review/approval. It rejects missing existing preferences, extra changed fields, review replay and B changes. This advances the record's revision/save time; it is not a rollback of metadata. No new preference rows may be created. Safe restoration rereads first and stops rather than overwriting concurrent changes; if restoration cannot be confirmed the test stops for inspection, and a temporary density value may remain in development. Both temporary logins close and the service stops in finally. No providers/backups/keys/schema/live app changes. Actual hosted write acceptance is pending fresh owner approval.

All 685 tests pass: server review/save/expiry/concurrency/uncertain acknowledgement and initial-create/no-op paths; explicit write authority and late sign-out semantics; full fictional HTTP density-change/restoration and concurrent-edit refusal. Privacy ten-probe and whitespace checks pass. This is an isolated development save bridge, not app-wide browser migration, production auth or release completion.


## Approved reviewed density save acceptance passed · November 9

Separately approved hosted write test passed in fngauurauwvbawlfzbbe: two new temporary logins, one existing test-A preferences record updated twice through fresh one-use reviews (temporary density toggle then original VALUE restoration), review replay blocked, account B preferences unchanged, original density reread verified, signed-out reads denied and cookie/CSRF/origin checks passed. Eleven logical preferences-list reads, two acknowledged app-record updates, no new rows. Both temporary logins closed; preview service stopped. Provider reads zero; no backups/keys/security rules/existing workspace UI/live app changes. Approval complete and consumed.

Only density changed during the test, and its original value is restored. The existing record's version/save timestamp advanced normally; this is not a metadata rollback. The isolated reviewed-save path is accepted for this bounded case, but the original workspace screens still use their legacy session implementation. Full browser migration, production transport/durable sessions and other release gates remain open.


## Private cookie Daily Brief read bridge prepared · November 9

Added an opt-in read-only Daily Brief to the isolated private workspace preview. GET /auth/workspace/brief uses only the server-held verified owner/session and a new bounded, owner/private/household-null/undeleted task-note-event query. Keyset pagination is complete up to a hard 2000-record cap and rejects repeated/out-of-order identities rather than presenting partial data. It selects only metadata plus JSON fictional/title/day/done/time fields; full note bodies, arbitrary payloads and provider records are not requested. JSON-field projection/aliases follow the [official PostgREST table API reference](https://docs.postgrest.org/en/v14/references/api/tables_views.html). Existing legacy API methods are unchanged.

The server reuses the established supported development-record normalizer, then whitelists display-only task titles/dates/sections, event titles/times and note titles. No IDs, raw payloads or credential fields reach the browser. Due/upcoming/events-today/note sections have explicit counts and a 20-item displayed cap; unsupported development rows are counted as omitted. Today uses New York time; checkedAt describes only this saved-workspace read, never provider synchronization. Connected Gmail/Calendar/bank snapshot records are intentionally excluded from this particular bridge; the broader approved Brief scope is not waived.

The UI loads only after View Daily Brief is clicked, uses textContent and clears all brief items on logout/pagehide/expiry. Shared busy controls prevent overlapping panel actions from stranding draft states. Browser fictional proof passed: sign-in, explicit Brief load (task/event/note title), logout with panel hidden/zero remaining item nodes. Screenshot /private/tmp/curated-cookie-daily-brief-fictional.png. Fictional preview stopped after testing. No real accounts/data/providers/backup keys accessed in this increment.

Prepared verifier --verify-workspace-brief is a separate read-only scope; it cannot be combined with preference-read/save acceptance. It creates two new existing-account logins, performs one owner-scoped task/note/event display-list read each, checks response whitelists/signed-out denial/cookie-origin-CSRF/session independence, reports only counts, closes both and stops the service. Real hosted execution is pending fresh approval. No app record writes, note bodies, preferences reads, source refresh, schema changes or existing app UI/live deployment changes.

All 697 tests pass: grouping/time-zone/item-limit/metadata privacy, least-data API projection/pagination, owner/tombstone/duplicate guards, logout/revocation suppression and full fictional HTTP acceptance/failure cleanup. Privacy ten-probe and whitespace checks pass. This moves workspace read traffic onto the new transport in the separate preview, not yet a migration of all existing screens or a production release.


## Approved private Daily Brief acceptance passed · November 9

Separately approved hosted read-only test passed: two new temporary existing-account logins, two owner-scoped task/note/event display-list reads (37 source records for A, one for B), signed-out access denied, cookie/origin/CSRF/logout/session-independence checks passed and upstream credentials absent from responses. The least-data projection requested no note bodies. Both temporary logins closed and the isolated preview service stopped. App-record writes/provider reads zero; no preferences, backups/keys, schema or live app changes. Approval completed and consumed.

This accepts the separate cookie-to-workspace Brief read bridge only. Existing workspace screens remain on legacy auth, and connected source snapshots are not integrated into this particular bridge. Production authentication, full browser migration and other release gates remain open.


## Private dashboard integration and reviewed task completion · November 9

Cookie-only sign-in now supports the existing Daily Brief in a separate opt-in server, without changing the original dashboard or service. Integrated read-only two-account acceptance passed (37/one supported source rows; both temporary logins closed; no writes). Task completion is implemented behind a disabled-by-default flag with expiring account-bound reviews, explicit approval, optimistic version checks, unrelated-field preservation and verified rereads. Fictional browser completion/sign-out and uncertain-response/offline regressions pass. The separately approved one-fictional-task development database drill passed: one new fixture completed through explicit review, account B denied, replay blocked, unrelated fields preserved, exact fixture soft-deleted, both logins closed and service stopped. No existing tasks or live app changes occurred.


## Selected-note text in private Daily Brief · November 9

Added a default-off read-only note viewer to the isolated cookie dashboard. The list still projects titles only; opening one displayed note requires a short-lived opaque capability bound to the signed-in owner/context and saved revision. The selected API projects only note title/body/fictional marker and scope/version metadata, never the full payload. Unsupported, foreign, household, deleted, changed and oversized notes fail closed. Final session verification and capability rechecking suppress late content after logout, expiry or refresh. Browser text is escaped, never HTML; no links/files or AI/provider calls are triggered. Closing the note, offline state, page hiding, sign-out and expiry clear its text. Returning to a visible tab verifies the session and fetches a fresh list; it does not reopen note text.

Fictional browser open/close/sign-out proof passed; screenshot `/private/tmp/curated-private-note-fictional.png` contains fictional text only. Preview service stopped. All 738 tests pass, including explicit note access, least-data projection, account/context/stale/expiry guards, late-response suppression and full fake two-account acceptance with no private text in logs. Privacy ten-probe and whitespace checks pass.

Prepared actual acceptance reads the display list for both existing development accounts and opens at most ONE supported account-A note body, verifies B cannot use A's capability and signed-out access fails, reports counts only, closes both temporary logins and stops the preview. New note-body access awaits owner approval. No actual note body, provider, backup/key or app-record write was accessed in this increment. The original app/live deployment remains unchanged.


## Approved selected-note acceptance passed · November 9

One saved development account-A note was read through the private dashboard after separate approval. B and signed-out access were denied, both temporary logins closed and service stopped. Reports contain counts only, not note text. Two display-list reads plus one selected-note read; zero app-record writes/provider reads. No live changes. The feature remains opt-in/default-off; this verifies its read path without enabling note editing or migrating other workspaces.


## Reviewed private note editing prepared · November 9

The isolated cookie Daily Brief now has default-off reviewed editing for an opened supported private note. Only title (up to 120 characters) and text (up to 1000 characters) can be proposed. A server-only full snapshot preserves unrelated payload fields; ownership/scope/displayed revision are checked on review and the exact snapshot is rechecked before a version-guarded patch. The owner/context-bound review is one-use and expires with the five-minute selected-note capability. Acknowledgement plus matching reread are required for success. No-op proposals do not write. Failed or uncertain saves retain the temporary draft and disable further review/save until explicit discard/latest; no automatic retries. Drafts clear on sign-out, hidden tabs and note-view expiry as disclosed in the interface. Offline state retains the draft but blocks saving. No browser credential/storage fallback or arbitrary record editing was introduced.

Fictional browser open/edit/review/approve/verified-list/sign-out passed; proof `/private/tmp/curated-private-note-edit-review-fictional.png` shows only fictional proposed text. Fixture service stopped. All 760 tests pass, including stale/deleted/shared record refusal, wrong-account/context/expiry/replay guards, review races, logout during preflight, payload preservation, lost acknowledgements, draft retention and exact fictional fixture cleanup. Privacy ten-probe/whitespace checks pass.

Prepared a bounded hosted verifier to create ONE new marked fictional private note, read/review/edit only that fixture, check account isolation and replay/payload protections, soft-delete it and close both temporary logins/service. It cannot edit existing notes. Actual execution awaits a new database-write approval. No database/provider/backup/key or live-app changes occurred in this increment.


## Approved reviewed note-edit acceptance passed · November 9

Hosted one-fictional-note run `3b658b4a-f173-4012-8b39-a2c9ee0f3175` passed: create, explicit review/approved title-text save, B privacy, replay denial, extension-field preservation and exact soft-delete/reread verified. Both temporary logins closed and isolated service stopped. Existing-note writes/provider reads zero. The original app and live deployment are unchanged; reviewed private note editing remains opt-in/default-off. This supersedes the preceding pending-hosted-test status.


## Reviewed private task creation prepared · November 9

Added an opt-in Add a task flow to the cookie-only Daily Brief. Only title, valid date and one supported section are accepted. The server assigns identity, owner, private scope, initial incomplete state and source; the browser cannot inject any of them. Review performs no insert. Each account/context-bound five-minute review can create at most one task, with active-session verification, insert-only storage and matching acknowledgement/reread. No upsert or overwrite path exists. Repeated approval and uncertain insertion cannot automatically retry; an uncertain response retains and locks the temporary draft until discard/latest. Offline drafts are retained but saving is blocked; sign-out/hidden tabs erase drafts. Feature defaults off.

All 779 automated tests pass, including non-writing review, malformed fields, wrong accounts, expiry/replay, stale context, uncertain acknowledgement, existing-identity collision refusal, draft retention and exact fixture cleanup. Fictional browser add/review/approve/verified-Brief/sign-out passed; `/private/tmp/curated-private-task-create-fictional.png` contains only fictional data. Fixture service stopped; privacy ten-probe and whitespace checks pass.

The prepared hosted verifier creates one fictional task THROUGH this review path, checks B denial and repeated/unapproved save rejection, confirms the resulting private task in Daily Brief, soft-deletes/rereads the exact fixture and closes both temporary logins/service. It cannot edit existing tasks. Actual execution awaits database-write approval; no database/provider/backup/key or live-app changes occurred in preparing this increment.


## Approved reviewed task-creation acceptance passed · November 9

Hosted run `94b96d61-e148-49a9-8bcb-fcb2bec98fc9` passed: non-writing review, one explicitly approved private fictional task creation, B isolation/approval denial, replay protection and exact soft-delete/reread verified. Both temporary logins closed and service stopped. Existing-task writes/provider reads zero; original app/live deployment unchanged. Task creation remains default-off. This supersedes the preceding pending-hosted-test status.


## Reviewed private task editing prepared · November 9

The opt-in cookie Daily Brief now supports reviewing edits to a displayed incomplete task's title, date and supported section. Opaque five-minute capabilities bind the displayed owner/context/identity/version/title/date/section. Review rereads the exact private task and preserves its entire payload except proposed title/date; section is the only other writable column. Completion status, subtasks and extension fields stay intact. One-use review, exact snapshot preflight, active-session checks and version-guarded PATCH precede acknowledged/reread success. No-op edits do not write. Uncertain responses retain and lock the temporary draft pending discard/latest; no automatic retry. Old completion tokens reject a task changed by editing; a fresh completion preserves its new fields. Editing defaults off.

All 801 tests pass, including malformed/injected fields, stale/shared/deleted/completed tasks, wrong account/context/expiry/replay, competing reviews, logout during preflight, uncertain acknowledgements, draft retention and exact fixture cleanup. Browser-verified task title/date/section change → review → approval → moved to Upcoming → fresh completion review/approval → cleared task → sign-out. Combined fictional preview enabled create/edit/complete and note controls; the fixture adapter now preserves edits for original/new tasks. Screenshot `/private/tmp/curated-private-task-edit-fictional.png` contains fictional data only. Service stopped; privacy ten-probe/whitespace checks pass.

Prepared a one-fictional-task hosted edit drill: create a new marked fixture, review/approve title/date/Home→Work changes, verify completion/subtask preservation, B isolation and replay denial, then soft-delete/reread the exact fixture and close both temporary logins/service. Full reads/edits are restricted to that new fixture ID. Actual execution awaits new database-write approval. No hosted app-record writes/provider/backup/key/live changes occurred during this preparation.


## Approved reviewed task-edit acceptance passed · November 9

Hosted run `aa138e81-8b6e-4c44-9438-7ae8ce372a19` passed: one new fictional private task, explicitly reviewed title/date/section edit, preserved completion/subtask/extension fields, B privacy, replay denial and exact soft-delete/reread. Both temporary logins closed and isolated service stopped. Existing-task writes/provider reads zero; original app/live deployment unchanged. Task editing remains default-off. This supersedes the preceding pending-hosted-test status.


## Cross-tab sign-out and passive session verification prepared · November 9

Fixed a private-dashboard gap where another open tab could retain account content after a sibling signed out. A same-origin BroadcastChannel now sends only `{type: ended/changed}` events, never identity/credential/record data. Peer events immediately clear private records, drafts, pending reviews and client request generation; they do not sign out an unrelated upstream login or automatically reread records. Recheck sign-in explicitly verifies the current cookie before loading again. Unknown events are ignored and the channel closes on disposal. Where BroadcastChannel is unavailable, visibility restoration and passive checks remain fail-closed fallbacks.

Added an authentication-only passive check endpoint and 60-second visible/not-busy UI verification. Passive checks verify owner/session and clear failed/changed-account views without loading app records or extending the idle deadline. Active/passive concurrent checks share verification while only active work extends idle time. Idle/absolute expiry cannot be rescued by slow verification; late responses cannot resurrect cleared tabs. Tests cover all these cases plus hidden-tab skips and count-only acceptance cleanup.

All 812 tests pass. Fictional browser proof: two tabs shared one verified sign-in and displayed fixture records; signing out in one immediately cleared the other with an explicit peer-change notice; recheck remained signed out. Screenshot `/private/tmp/curated-private-cross-tab-signout-fictional.png` contains no private data. Fixture service stopped; privacy/whitespace checks pass. Prepared hosted `--verify-passive-check` mode creates/closes two temporary development logins, verifies unchanged deadlines, signed-out denial and independent-session continuity, with zero app-record reads/writes. Actual authentication-only execution awaits approval. No real login/data/provider/backup/key/live changes occurred during preparation.


## Approved passive-session acceptance passed · November 9

The separately approved authentication-only hosted test passed: two temporary development logins, passive checks kept idle deadlines unchanged, signed-out access denied and independent login unaffected. Both logins closed and preview service stopped. App-record reads/writes and provider reads zero; no backups/keys, schema/security rules or live changes. This completes the bounded temporary-login approval and supersedes the pending hosted-test status above.


## Shared private-screen safety and Mac launcher ready · November 9

Extended cross-tab sign-in change/sign-out clearing and non-idle-extending passive checks to the separate sign-in/settings/Brief preview UI, matching the dashboard. Unknown messages are ignored; peer changes clear metadata/values/drafts and require explicit recheck. Hidden screens clear state, visible restoration verifies sign-in, and failures keep retry available without retaining old account metadata. A successful dashboard recheck clears the old peer-change notice. All 819 tests pass, including standalone script VM behavior, client lifecycle and existing server acceptance regression coverage.

Fictional browser proof passed in both directions between the combined dashboard and separate sign-in screen: shared cookie restore, sign-out cleared the sibling, explicit recheck stayed signed out. Screenshot `/private/tmp/curated-private-shared-session-fictional.png` contains no real data. Both fictional logins closed and service stopped. Privacy/whitespace and launcher shell syntax checks pass.

Added executable `tools/Open-Private-Workspace.command`: starts only the exact separate development project on loopback 5312, enables the accepted task-create/edit/complete and note-read/edit controls, and opens the dashboard after its service binds successfully. It prefers an installed Node 22+ and falls back to the existing app-bundled runtime; no installation, configuration edits, credential output, automatic sign-in or automatic app-record writes. Occupied port stops without replacing any service. Manual review/approval remains required for each task/note mutation. README documents startup/stop and the temporary-draft boundary. The actual combined workspace has not been opened against real records for owner use; awaiting owner approval for scoped sign-in/display. No production launch or live change is implied.


## Approved combined private workspace opened for owner · November 9

After explicit owner approval, started the combined private workspace on separate loopback 5312 targeting fngauurauwvbawlfzbbe and signed in privately with the configured development account A. Browser verification inspected only booleans: signed in, saved Brief loaded, task controls present, note body not opened. No private title/body/credential was printed or copied into the report. The visible user-facing tab was retained as a deliverable and the service deliberately remains running for owner use. Header-only proof `/private/tmp/curated-owner-workspace-public-header.png` contains branding/public labels only. No agent app-record writes, note-body opens, provider refresh, backup/key access, schema changes or live deployment occurred. User may manually review/approve app changes; no further automatic writes are authorized by opening the preview. Original/gateway services untouched. Runtime exec session 75852 owns this preview; do not stop it as test cleanup while the owner is using it.


## Local content privacy checks and stable preview assets prepared · November 9

Extended the read-only repository guard with opt-in `--scan-content`. It inspects non-ignored working candidates and staged/index blobs independently, skips protected credential/recovery locations without opening them, blocks filesystem symlinks and uses bounded in-memory ZIP inspection without extraction. Recognized provider/private-token and private-key patterns return categories/counts only, never matched values; private archive entries are counted without returning their names. Unsupported/encrypted/malformed/oversized archives fail closed. Binary assets are explicitly counted as skipped, so a clean result is not a guarantee of absence of all secrets or encoded/private binary data. No upload, Git mutation or credential-file read occurs.

Actual local scan passed: 356 working sources, 157 index sources, 505 text sources including four archive entries; ten binary source copies skipped; zero recognized credential findings, private archive entries or blocked sources. Ten existing ignore probes pass and no private files are tracked. Counts precede this documentation update and can change on rerun.

Changed the future private static server to capture its explicit public asset allowlist once, so subsequent source edits/removals/new files cannot silently change an initialized preview. No credentials/config source files are captured. Existing origin/CSP/no-store/path/symlink restrictions remain. Tests prove source changes cannot alter an active captured view and previously missing/linked assets stay unavailable until a new service. This code is not yet active in the owner's running process.

The cookie acceptance tests now use ephemeral sockets with the same exact logical Host/Origin security contract, allowing the full suite to run while owner preview port 5312 remains untouched. All 829 tests pass; whitespace/content privacy checks pass; original owner service PID 70576 remains running. No new app-record access/writes, real logins, provider/backup/key access or live changes occurred. Await owner readiness before restarting only the private preview and signing back in to activate the fixed asset set; restart clears unsaved in-page drafts and closes its current login. Do not stop the owner preview as routine fixture cleanup.


## Approved private preview restart completed · November 9

After owner readiness approval, stopped only prior private runtime session 75852, started the same combined exact-development preview with fixed public asset capture, and signed the owner back in. Browser confirmed sign-in and saved Brief load; no note bodies opened or app-record changes made. Owner tab retained. New runtime session 1772 intentionally remains running. Original/gateway services, providers, backups/keys, schema and live app unchanged. Header-only proof `/private/tmp/curated-owner-workspace-restarted-header.png` contains public branding/labels only. This activates the stable asset boundary and supersedes the pending restart note above.


## Reviewed private note creation and isolated staging prepared · November 9

Added default-off Add a note to the private dashboard: title/text validation, non-writing review, one-use five-minute approval, server-assigned UUID/owner/private scope and insert-only storage. Exact acknowledgement and targeted reread are required before success. Identity collisions never overwrite. Lost acknowledgements consume the review and lock the retained temporary draft; no automatic retry. Hidden tabs/sign-out clear drafts; explicit discard/latest is required after uncertainty. The initial post-save refresh reads titles only; note text opens separately on demand. Existing note read/edit behavior remains intact.

Added a bounded staging port 5313 with a separate `cc_workspace_staging` cookie; owner port 5312 retains `cc_workspace_preview`. This is necessary because browser cookies are shared across ports on the same host. Logical origins, same-origin requests and BroadcastChannels stay isolated. CLI rejects other ports. Fixtures and actual bounded QA can run on staging without stopping or replacing the owner service.

All 849 tests pass, including note creation/replay/privacy/collision/uncertain-save cleanup, UI draft behavior and separate-cookie guards. Fictional browser add/review/approve/title-list/open/sign-out passed on 5313; proof `/private/tmp/curated-private-note-create-fictional.png` contains fictional data only. Staging fixture service stopped. Owner preview on 5312 remained the same PID 74106; read-only DOM booleans confirmed it remained signed in/loaded, and its tab was retained. No real note-body access or app-record writes occurred. Repository content privacy and whitespace checks pass.

Prepared `verify-private-note-creation.mjs`: one new marked fictional private note only, created THROUGH review/approval on isolated 5313, B cannot approve/read it, replay/unapproved save blocked, exact fixture soft-delete/reread, both temporary logins closed and staging stopped. Existing-note body opening is disabled by its API wrapper; rereads are restricted to the new ID. Actual execution awaits database-write approval. New feature is not activated in the owner's existing frozen preview or launcher; no owner-preview restart, provider/backups/keys/schema/live changes.


## Approved reviewed note-creation acceptance passed · November 9

Run `e658579e-4b8a-439e-859c-13d8af32f78f` passed after separate approval on staging 5313: non-writing review, one explicitly approved private fictional note creation, B visibility zero/approval denied, replay protection and exact soft-delete/reread verified. Both temporary logins closed and staging stopped; existing-note writes/provider reads zero. Owner preview 5312 remained running unchanged. No existing record, backup/key, schema/security or live changes. Note creation stays default-off in the current owner preview/launcher; this supersedes the pending hosted-test status above.


## Read-only private title search prepared · November 9

Added default-off saved title search with query/type/section filters across all supported private task/note/workspace-event records returned by the existing bounded metadata projection, including completed tasks and dates outside the current Brief. Unicode/case matching searches titles only; no note bodies or provider snapshots are requested. Exact owner/private/undeleted scope and full-list validation precede whitelisted results. At most 50 results are shown with full match count; the existing 2000-source cap fails closed rather than silently truncating. Results expose type/title/section/date/time/task-completion fields only, no IDs or raw payload. User-submitted searches use active-session/CSRF/origin checks, extend active idle time correctly and clear failed/late/offline/signed-out results. Previous query/filter labels stay explicit while editing a new query. Pending task/note drafts block search to prevent draft loss.

All 861 tests pass, including beyond-Brief-cap search, Unicode/filters, body exclusion, wrong-owner/tombstone/duplicate validation, HTTP signed-out/invalid-field/late-response protection, UI escaping/counts/draft lifecycle and fake two-account acceptance. Fictional staging browser mixed search → combined note/section filter → zero-match feedback → sign-out clearing passed. Proof `/private/tmp/curated-private-title-search-fictional.png` contains fictional data only. Staging stopped; current owner preview 5312 is not restarted or altered.

Prepared separate `--verify-title-search` acceptance on staging 5313: two temporary existing development logins, exactly one title-metadata list read each, signed-out denial, account isolation and count-only output, zero note bodies/app writes/providers/backups/keys. Launcher now includes explicit flags for accepted note creation and pending title search on future starts; no current runtime change. Await a combined owner decision for that read-only test and, only if it passes, one owner-preview restart/sign-in to enable Search/Add a note. Save/discard unsaved drafts first. No live deployment or further automatic record saves are authorized.


## Approved title search and Add a note activated · November 9

Read-only title-search acceptance passed on staging after explicit approval: two temporary logins, one owner-scoped metadata list read each, match counts seven/one, signed-out denial and cookie/origin/CSRF/account checks passed; both logins closed and staging stopped. Note-body reads/app writes/provider reads zero.

As separately approved in the same readiness decision, stopped only prior owner runtime 1772 and restarted combined owner preview with title-search/note-create flags. Privately restored configured account A; Boolean-only browser verification confirmed sign-in, Brief load, Add a note and Search controls, and no note body opened. No UI search or app-record mutation was executed by agent during activation. Retained owner tab and running service session 61372. Header-only proof `/private/tmp/curated-owner-search-notes-header.png` contains public labels only. Existing saved records, original/gateway services, providers/backups/keys/schema/live app unchanged. This supersedes prior pending activation notes.


## Open notes from private title search prepared · November 9

Search results can now offer Open note when note reading is enabled. Search remains title-only; text is requested only on explicit selection. A separate bounded note-capability pool serves up to 50 displayed search notes, preserving the current Brief's 20-note handles. Both pools bind private owner/context/record revision/title and expire within five minutes. A new search invalidates earlier search handles; a fresh Brief/sign-out clears both. The note-read router and reviewed editor resolve either pool without accepting arbitrary IDs. Full-body responses recheck session and selected capability after the read; late/changed/foreign/stale responses fail closed. Existing reviewed edit/version/payload-preservation protections apply unchanged to a searched note.

All 873 tests pass, including explicit opening, separate capability pools, current Brief continuity, 50-note bounds, foreign browser-context denial, later-search invalidation/late-text suppression, reviewed search-note save and full fake one-fixture cleanup. Browser staging search → Open note from results → edit → review/approve → verified saved Brief → sign-out passed. Proof `/private/tmp/curated-private-search-note-fictional.png` contains fictional text only. Staging stopped; owner preview 61372/port 5312 remains untouched. No real note bodies/app records/providers/backups/keys accessed during preparation; repository content/whitespace checks pass.

Prepared one-fictional-note hosted search/open/edit drill on 5313: create one new marked fixture, exact-title A/B searches, title-only result, B cannot find/open A's note, explicit A open and reviewed single edit, extension-field preservation, replay denial and exact soft-delete/reread. Both temporary logins/staging close. Full reads/edits are wrapped to the new fixture ID. Await a combined decision for this bounded database test and, only on success and owner readiness, one private-preview restart/sign-in to enable result opening. Restart clears temporary drafts; existing records and live app are excluded.


## Approved searched-note workflow accepted and activated · November 9

Run `268b9092-f842-46e0-a1d8-f8e21159ba59` passed after explicit approval: one new private fictional note, title-only search, B search/open denial, explicit A open and reviewed edit, replay denial, extension-field preservation and exact soft-delete/reread. Existing-note writes/provider reads zero; both temporary logins closed and staging stopped. No existing note text was read.

Under the same owner readiness approval, stopped only private runtime 61372 and restarted its combined preview to load search-note capabilities. Privately restored account A and verified signed-in/Brief/search booleans without executing a search, opening note bodies or approving record changes. Owner tab retained; runtime 56746 remains running. Header-only proof `/private/tmp/curated-owner-search-open-header.png` contains public labels only. Saved existing records/original gateway/live app/providers/backups/keys/schema unchanged. This supersedes pending test/activation notes above.


## Reviewed task actions from title search prepared · November 9

Incomplete task results now offer Edit task and Review completion when their existing feature authorities are enabled. Separate search pools issue at most 50 owner/context/revision-bound five-minute action handles without invalidating current Brief task handles. Completed task results remain view-only. Edit/review/save and completion/review/save resolve the originating pool server-side; raw IDs and arbitrary fields remain rejected. New searches invalidate their older task handles; Brief refresh/logout clears both pools. Old completion handles reject tasks changed by an edit; a fresh search supplies current handles. Searches are blocked while a record save is being checked, preventing another tab's query from cancelling in-flight save verification. Completion/subtask/extension fields remain preserved by the existing reviewed editing path; uncertain outcomes never auto-retry.

All 888 tests pass, including pool bounds, Brief handle continuity, late/replaced search reviews, stale completion after editing, blocked search during save, completed task action omission, UI reviewed editor/completion behavior and fake one-fixture combined cleanup. Fictional staging browser search → edit/review/approve → search again → completion review/approve → verified Brief → sign-out passed. Proof `/private/tmp/curated-private-search-task-fictional.png` contains fictional data only. Staging stopped; current owner preview on 5312 stays unchanged.

Prepared one-fictional-task hosted combined drill on 5313: create new marked task, A/B exact-title searches and B action denial, one explicitly approved title/date/section edit, reject old completion handle, fresh search then one explicitly approved completion, verify subtasks/unknown payload preservation, replay denial and exact soft-delete/reread. At most one edit and one completion, both restricted to the new fixture ID. Both temporary logins/staging close. Await a combined decision for the bounded database test and conditional owner-preview restart/sign-in only if it passes and the owner is ready to clear temporary drafts. No existing records/providers/backups/keys/schema/live changes in preparation.


## Approved searched-task workflow accepted and activated · November 9

Run `f3732c8e-7927-4b04-958d-544c733440c6` passed after explicit approval: one new fictional task, search/B action denial, one approved title/date/section edit, stale completion rejection, fresh search and one approved completion, preserved subtasks/unknown payload and exact soft-delete/reread. Existing-task writes/provider reads zero; both temporary logins/staging closed.

Under the same readiness decision, stopped only owner runtime 56746 and restarted the combined preview to load searched-task actions. Privately restored configured A and verified signed-in/Brief-loaded/error-null state without executing a search, opening note text or approving existing-record changes. Owner tab retained; runtime 4798 remains running. Header-only proof `/private/tmp/curated-owner-search-task-header.png` contains public labels only. Existing records, original/gateway/live app, providers/backups/keys/schema unchanged. This supersedes pending test/activation notes above.


## Read-only saved appearance in private workspace prepared · November 9

Added opt-in saved palette/density application to the cookie dashboard's verified Brief response. A new API projection reads only palette, density and fictional/source/scope/version markers for the active owner-private preferences record; navigation, amounts, source toggles and quiet hours are not requested. The server returns only safe display choices/read-only availability state. Missing preferences use explicit defaults; duplicate/foreign/shared/deleted/unsupported rows fail closed. An isolated appearance-request failure can use an explicitly labeled default while final session verification still protects the Brief. No preferences are written. The UI applies only verified current-generation results and resets appearance on sign-out/hidden/failed session; late responses cannot recolor a different account.

All 901 tests pass, including least-field API projection, private scope/duplicate guards, invalid-value sanitization, fallback availability, sign-out/late response suppression and fake read-only A/B acceptance with count-only reports. Browser fictional saved coastal/compact appearance → sign-out neutral/balanced reset passed. Proof `/private/tmp/curated-private-appearance-fictional.png` is fictional only. Staging stopped; current owner runtime 4798 is unchanged. Content privacy/whitespace/launcher syntax checks pass.

Prepared separate `--verify-appearance-read` mode on staging 5313: two temporary development logins; one title/display metadata Brief read plus one minimal appearance read each; no note bodies/settings writes/providers/backups/keys. It verifies safe applied choices without printing them, closes both logins/staging, and fails if appearance is unavailable rather than falsely claiming acceptance. Await a combined decision for that read-only test and, only on success/readiness, one owner preview restart/sign-in with `--allow-private-appearance-read`. Launcher flag is prepared for future starts, not active in the current frozen preview. Restart clears unsaved drafts; saved records/settings and live app remain excluded.


## Approved saved appearance accepted and applied · November 9

Read-only staging appearance acceptance passed after explicit approval: two temporary logins, two minimal appearance reads plus two Brief metadata lists, both accounts had supported saved appearance, signed-out/account/cookie/CSRF/origin checks passed, appearance values not logged. Both test logins/staging closed. Appearance/app writes, note-body/provider reads zero.

Under the same readiness decision, stopped only owner runtime 4798 and restarted its combined preview with read-only appearance enabled. Privately restored A and verified signed-in/Brief-loaded/saved-appearance-applied booleans; no note text opened, searches executed or record/settings changes approved. Owner tab retained; runtime 78603 remains running. Header-only proof `/private/tmp/curated-owner-appearance-header.png` contains branding/public labels, no account or record contents. Saved settings/records, original/gateway/live app, providers/backups/keys/schema unchanged. This supersedes pending acceptance/activation notes above.


### Reviewed appearance editor prepared — 911 tests

The private dashboard now has an opt-in two-field appearance editor, behind `--allow-private-appearance-save-reviewed`. The browser receives only palette and density. Review creates no write; approval uses the existing one-use, expiring server review, owner/session checks and optimistic version guard. Existing raw payload fields other than palette/density are preserved exactly, including absent fields. Discard cancels the server review; uncertain writes lock the draft rather than retrying. Hidden/sign-out clears drafts.

All 911 tests pass. Fictional browser proof: compact remained applied during review, approval saved and reread spacious, and sign-out reset balanced. Proof: `/private/tmp/curated-private-appearance-editor-fictional.png`. Fictional staging was stopped; owner runtime 78603 remains unchanged. Privacy scan found no protected-path failures or content findings (10 binary sources skipped); whitespace and launcher syntax checks pass. Launcher flag is prepared for future starts only.

Prepared bounded hosted acceptance: two temporary development logins, toggle only account A's existing density, restore its original value, verify account separation and close both logins/staging. This advances save version/time twice. Raw unrelated settings must remain exact; a concurrent edit stops restoration for review instead of overwriting it. No hosted writes have been performed for this checkpoint. Await approval for that test and, only if successful and drafts are ready, a private preview restart/sign-in to enable the editor.


## Approved reviewed appearance accepted and activated · November 9

Explicit approval received for density-only development test/restoration and conditional private preview restart. Acceptance passed: two temporary logins created/closed; two minimal appearance reads and 15 bounded app-record reads; exactly two app writes to existing A preferences; density-only change and original display value restored; review replay blocked; B preferences unchanged; no note bodies or provider reads. Save version/time advanced as disclosed. Both staging logins/service closed.

Stopped only owner runtime 78603, restarted combined private preview with reviewed appearance editing, and privately signed A back in. Verified signed-in, Brief loaded, saved appearance applied and Appearance settings control visible using boolean-only observation. No owner UI edits approved. Owner tab 55 retained, runtime 11842 remains running at http://127.0.0.1:5312/dev-dashboard.html. Public-header proof `/private/tmp/curated-owner-appearance-editor-header.png`. Original/gateway/live app, other records, providers, backups, keys and schema unchanged. Supersedes pending acceptance/activation entries above.


## Keyboard focus and narrow-screen acceptance prepared · November 9

Fictional browser inspection demonstrated that Enter on Add a task opened the form but dropped focus to BODY. The private controller now keeps a fixed, local focus destination through loading, focuses the first editor control, review heading (never an approval button), selected note heading, search results/error, verified save feedback and the appropriate add/settings control after discard. Hidden/sign-out clearing cancels pending focus so a late response cannot refocus old content. Background session checks do not request focus. Appearance-only header copy now correctly indicates reviewed saving. No API, database schema or record payload change.

Four focused regressions and all 915 tests pass. Fictional browser proved task entry → review H2 → approved fictional creation/status feedback; note entry; discard back to Add a note; appearance selector entry. Narrow viewport note editor had document width equal to content width (375 px), with no horizontal overflow; viewport override reset. Proofs `/private/tmp/curated-keyboard-fixed-fictional.png` and `/private/tmp/curated-keyboard-mobile-fictional.png` contain fictional content only. This is a simulated narrow viewport, not physical-device certification. Staging runtime 35625 stopped. Owner runtime 11842/tab 55 retained and unchanged. Content scan/ignore/whitespace checks pass (10 binary sources skipped).

Await one readiness decision before restarting only the private preview to activate the UI fixes: restart closes its sign-in and clears unsaved drafts, then configured A is privately signed back in. No new hosted acceptance test, app-record writes, provider reads, backups, keys, original/gateway/live-app changes are needed or authorized for this increment.


## Approved keyboard fixes activated · November 9

Owner explicitly approved the private preview restart. Stopped only runtime 11842 and restarted combined preview as runtime 93764 at http://127.0.0.1:5312/dev-dashboard.html. Privately signed configured A back in and verified signed-in, Brief-loaded, appearance-applied and H1-focus booleans. No editor opened or record/settings save performed. Owner tab 55 retained. Header-only proof `/private/tmp/curated-owner-keyboard-header.png` contains public branding only. All 915 tests passed before activation; database/provider/backups/keys/original/gateway/live app remain unchanged. Supersedes pending activation above.


## Upcoming workspace events prepared · November 9

Private Brief now groups future supported workspace events separately from today's events, sorted by saved date/time. It returns only title/day/time, caps the visible upcoming list at 20 and discloses its full count. Uses the same existing owner-private minimal-field record read: no new provider, calendar permissions, event description, identities or note text. The separate read-only session UI also renders the new section. Browser missing-list responses fail visibly; sign-out removes future event content. These are workspace events, not the encrypted Apple Calendar provider snapshots.

All 920 tests pass, including future/past/today separation, New York midnight boundary, cap/counts, escaping, missing-response handling, logout clearing and fake two-account read-only acceptance with no private content logged. Fictional browser displayed tomorrow's planning session with date/time and cleared it on sign-out; screenshot `/private/tmp/curated-upcoming-events-fictional.png`. Fictional staging 59067 stopped, owner runtime 93764 untouched/tab retained. Privacy scan/ignore/whitespace checks pass (10 binary sources skipped).

Prepared acceptance reuses staging `--verify-appearance-read`: two temporary development logins, existing Brief title/display projections and minimal appearance fields only; additionally validates upcoming-event date ordering/counts/field boundary. No record/settings writes or note text/providers/backups. Both logins and staging close. Await a combined approval for the read-only test and conditional owner-preview restart/sign-in. Restart clears unsaved drafts. No live-app/database-schema change.


## Approved upcoming workspace events accepted and activated · November 9

After explicit owner approval, read-only staging acceptance passed: two temporary development logins, two Brief minimal-field reads and two appearance reads; cookie/CSRF/origin/account/sign-out checks and future-event ordering/count/field validation passed. Both temporary logins/staging closed. App/settings writes, note-body/provider reads zero. No event values were logged.

Stopped only owner runtime 93764 and restarted combined preview as runtime 75695 at http://127.0.0.1:5312/dev-dashboard.html. Privately signed configured A back in; verified signed-in, Brief-loaded, upcoming-section-visible and saved-appearance-applied booleans. No editors or note text opened, searches executed or record changes approved. Owner tab 55 retained. Header-only proof `/private/tmp/curated-owner-upcoming-header.png`. All 920 tests passed before activation. Existing records/settings, original/gateway/live app, providers/backups/keys/schema unchanged. This supersedes pending acceptance and activation entries above.


## Saved-title browsing prepared · November 9

Added Browse tasks, Browse note titles and Browse workspace events beside title search. Browsing requires one explicit supported type; blank all-type queries still fail. Reuses existing owner-private minimal title/date/time/status projection and 50-result cap/full count. Completed tasks remain visible without edit/completion handles. Note text remains closed until explicit selection; existing action reviews remain required. Controls block overlapping requests and cannot discard an open draft. Results heading receives focus; logout removes results.

All 923 tests pass, including explicit blank-type validation, section/cap/field boundaries, no implicit note read, pending/draft blocking, keyboard focus and full fake two-account acceptance. Browser fictional tasks, notes and events browsing passed without typing; future event visible, note text closed, sign-out cleared results. Proof `/private/tmp/curated-browse-titles-fictional.png`. Fictional staging 93347 stopped. Owner runtime 75695/tab 55 retained unchanged. Privacy/ignore/content/whitespace checks pass (10 binary sources skipped).

Prepared title-search acceptance now explicitly performs four minimal record-list reads per account: QA title query plus each of three browse types (eight lists total), two temporary logins, no note text/appearance/preferences/provider/backups or writes; closes both test logins/staging. Uses `--verify-title-search` on isolated 5313. Earlier two-read acceptance descriptions are historical, not permission for this expanded run. Await a combined approval for this bounded read-only acceptance and, if successful/readiness confirmed, owner-preview restart/sign-in. Restart clears unsaved drafts; live app remains unchanged.


## Approved saved-title browsing accepted and activated · November 9

Owner approved bounded read-only acceptance and conditional restart. Acceptance passed: two temporary logins created/closed, eight minimal Brief record-list reads (one title search plus each of three explicit browse types per account), cookie/CSRF/origin/account/sign-out checks passed, title browsing verified. No app writes, note bodies or provider reads; private titles not logged. Staging closed.

Stopped only owner runtime 75695, restarted combined preview as runtime 6576 at http://127.0.0.1:5312/dev-dashboard.html, and privately restored configured A sign-in. Boolean-only verification confirmed Brief loaded, all three browse controls visible and saved appearance applied. No owner browse/search executed, note text opened, editors opened or record changes approved. Owner tab 55 retained. Public-header proof `/private/tmp/curated-owner-browse-header.png`. All 923 tests passed before activation. Saved records/settings, original/gateway/live app, providers/backups/keys/schema unchanged. Supersedes pending acceptance/activation above.


## Collapsible completed tasks prepared · November 9

Implemented the approved Brief completed-section pattern in the private dashboard. Completed supported tasks appear collapsed by default with a count, newest task dates first (not claimed completion times), first 20/full count disclosed. Only title/day/section are returned; completed rows receive no completion/edit handles. Expansion is local memory only, survives refresh and clears on account/session clearing. Native details/summary supports keyboard opening. Existing task status and stored preferences are untouched. The separate read-only session UI also lists completed task display fields.

All 926 tests pass. Model checks cover order/cap/full count/no action handles/private-field omission. Controller checks cover default collapse, refresh expansion preservation, close and sign-out. Fictional browser approved one in-memory task completion, opened the Completed section with Enter, verified refresh keeps expansion and zero action buttons inside it, then signed out and verified clearing. No hosted writes occurred. Proof `/private/tmp/curated-completed-tasks-fictional.png`; fictional staging 30813 stopped. Owner runtime 6576/tab 55 retained untouched. Privacy/content/ignore/whitespace checks pass (10 binary sources skipped).

Prepared staging `--verify-appearance-read` acceptance includes the same two owner-private minimal-field Brief lists and two appearance reads. It now verifies completed-task title/day/section-only keys, cap/count and newest-date ordering. Two temporary logins close; no app/settings writes, note text, providers/backups. Await combined approval for this read-only test and conditional private-preview restart/sign-in. Restart clears unsaved drafts; original/gateway/live app remains untouched.


## Approved Completed section accepted and activated · November 9

Explicit approval received for bounded read-only development acceptance and conditional private-preview restart. Acceptance passed: two temporary logins created/closed, two minimal Brief lists plus two minimal appearance reads; completed-list field/count/date-order checks and cookie/CSRF/origin/account/sign-out checks passed. App/settings writes, note bodies and provider reads zero. Staging closed.

Stopped only owner runtime 6576, restarted combined preview as runtime 24984 at http://127.0.0.1:5312/dev-dashboard.html, and privately restored configured A. Boolean-only verification confirmed signed-in, Brief loaded, Completed visible/collapsed and appearance applied. Completed was not opened; no existing task status changed, note text opened, search executed or editor used. Owner tab 55 retained; public-header proof `/private/tmp/curated-owner-completed-header.png`. All 926 tests passed before activation. Saved records/settings, original/gateway/live app, providers/backups/keys/schema unchanged. Supersedes pending acceptance/activation entries above.


## Task-status browsing and Clear search prepared · November 9

Title browsing now accepts optional status all/open/completed, default all for existing callers. Specific status is permitted only with explicit task type, applied before counts/caps. Completed tasks receive no write handles. Dashboard shows Task status only enabled for task type, resets status when leaving tasks, permits blank query only for a selected type, and labels the applied result status. Clear search removes results/selected note/completion review and resets filters/focus without reading or writing app records. Server selections retain their existing bounded expiry; clearing the display grants no new access or task status change. Active drafts and pending work block clearing/browsing.

All 929 tests pass, including filter scope/invalid statuses, completed action denial, blank task status query, switching record type, clear behavior/focus/no extra reads and full fake acceptance. Fictional browser confirmed empty Completed before a fictional completion, completed-only result afterward with no completion action, Open exclusion, and Clear search/query focus. No hosted writes. Proof `/private/tmp/curated-task-status-fictional.png`. Fictional staging 5817 stopped; owner runtime 24984/tab 55 retained untouched. Privacy/content/ignore/whitespace checks pass (10 binary sources skipped).

Prepared `--verify-title-search` staging acceptance now performs six minimal-field lists per account: one QA title query, task browse all/open/completed, note browse, event browse (12 total across two temporary logins). Checks returned task status, account/session boundaries and field limits, then closes both logins/staging. No note text, appearance/settings/provider/backups reads or app writes. This supersedes historical eight-list tool scope, not prior permissions. Await explicit combined approval for this read-only check and conditional private-preview restart/sign-in; restart clears unsaved drafts. Live app remains untouched.
