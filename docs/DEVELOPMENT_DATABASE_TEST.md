# Proposed development database isolation test

This is a reviewable approval request, not a record of a completed database test. No live checks were run during the local reliability work.

## Approved run result — November 8, 2026

The owner approved the write-capable development test. It completed with **27 checks passed**, including two distinct authenticated test users, private-record isolation in both directions, denied ownership spoofing/changes, denied hard deletion, household isolation and membership protections, anonymous-read denial, and stale-revision rejection.

Labeled QA fixtures remain in the configured development project for audit. No schema migrations or production changes were performed. This result establishes only the exercised development checks; it does not certify invitation flows, grants between household members, production sessions, provider integrations, or backup/restore.

## Destination and credential handling

Use only the separately configured Supabase development project. Before any network request, the existing local configuration guard must confirm an exact Supabase HTTPS URL, a matching development reference, a different original-project reference, a publishable key, the existing explicit development-only acknowledgment, and two distinct fictional account logins. Stop if any check fails. This guard checks configuration consistency; it cannot independently prove the owner's project classification.

Do not print local credentials, access tokens, refresh tokens, or provider response bodies. Read existing test credentials internally only after owner approval for this run. Requests reject redirects. No administrative/service-role key is used.

## Authorized actions requested

1. Sign in as the two existing fictional test accounts.
2. Create each account's profile if absent, without editing existing profiles. Verify each account can read its own profile.
3. Create two uniquely labeled private QA records and two uniquely labeled QA households. Existing database triggers create their owner memberships.
4. Create one uniquely labeled shared QA record in a newly created QA household.
5. Test that the accounts cannot read or modify each other's private records, spoof ownership, view another household, or directly grant membership. Test that anonymous requests cannot read a private fixture.
6. Update only the newly created private QA record with its expected revision, then verify a stale revision cannot overwrite it.
7. Attempt a hard-delete of a newly created QA record and expect denial. If permissions are broken, this particular disposable record might be deleted; no preexisting records are deletion targets.

The script stops at the first failed check. An unexpectedly permitted deny-test may create or modify additional QA fixtures; it does not target production data or preexisting application records. Fixtures remain in development for audit. No cleanup deletion is requested.

## Excluded actions

No schema migrations, grants/policy changes, deployments, live provider connections, real-user invitations, production writes, or edits/deletions of existing app records. This test does not certify production auth, child/guardian rules, invitations, backup/restore, or real integrations.

## Execution gate

`node tools/verify-rls.mjs` prints this test's summary without reading credentials or contacting Supabase. The write-capable invocation is `node tools/verify-rls.mjs --allow-dev-writes` (or `npm run test:rls -- --allow-dev-writes`) and must wait for owner approval.

If the development project or fictional accounts are unavailable, report that blocker and ask for the minimum setup decision. Never switch to the original project to make the test run.

## Proposed provider-import verification — not run

The next requested database action is a separate, tightly scoped development-only import test. Run only after explicit owner approval for this action:

```
node tools/verify-provider-import.mjs --allow-dev-writes --fixtures-only --project=fngauurauwvbawlfzbbe
```

The script defaults to an offline plan with no credential reads. All three command guards are required; the exact project must match the isolated development configuration and differ from the original app. It uses the existing fictional A/B account credentials privately, not administrative/service-role credentials.

Actions after approval:

- Create exactly three uniquely labeled, private, fictional provider records owned by Test Account A: two message metadata examples and one all-day calendar example. They use `origin: google_import_qa`, `payload.fictional: true`, and a unique fixture run identifier.
- Verify exact saved contents, all-day exclusive end dates, deterministic identities, and a repeat import that inserts nothing.
- Verify Test Account B cannot read those records. Attempt one unauthorized update against a newly created fixture; it must be denied, and A must reread unchanged contents. If isolation is broken, only a new fixture can be modified and the run stops.
- Leave the three fictional records for audit. No hard deletion, migrations, households/profiles, real Google calls, real source content, production deployment or real-content import is included.

This tests the actual development persistence path. It does not approve storing real message/event data, production rollout, background sync or other database actions. A failed/uncertain run can leave labeled fixtures; inspect the recorded run before retrying.

### Provider-import verification result — approved and completed

On November 8, 2026, after explicit owner approval, the exact development-only command above completed **11 checks successfully**. Audit run: `365ff45c-70b2-4f45-9ddd-ee740e1a4fc9`.

The test inserted exactly three labeled private fictional records for Test Account A (two message metadata examples and one all-day event). Repeat execution created no duplicates or extra inserts. All-day exclusive end dates survived storage. Test Account B could neither read nor modify A's provider records, and A's reread confirmed the contents remained intact. The three fixtures remain in development for audit.

No schema change, actual Google request, real-source import, delete or production deployment occurred. This approval was for this bounded fictional test, not future real-content persistence.


## Prepared atomic fictional approval rollout — owner permission required

Problem: existing fictional suggestion approval sends task and history in separate writes. A partial failure can leave them out of step; client rechecks alone cannot eliminate simultaneous-tab duplicates.

Prepared migration `supabase/migrations/003_atomic_fictional_approval.sql` adds only a partial unique index for fictional approved-source tasks and a caller-authorized atomic RPC. It does not change RLS, broaden household rights, decrypt/read provider bodies, alter existing rows or deploy the live app. The RPC uses `auth.uid()` (no supplied owner), SECURITY INVOKER and an empty search path, locks the owner-private undeleted fictional source, checks its revision and supported source type, blocks dismissed/conflicting/deleted approvals, and inserts the task and decision in one transaction. Retries return the existing linked task. Existing duplicate index keys make the entire migration fail/roll back; do not automatically remove duplicates. Direct private-record writes and other history actions retain the prototype's existing limits; this is not a production immutable audit/automation system.

Offline validation uses integrity-verified, pinned `@electric-sql/pglite` 0.5.15 as a development-only dependency. Tests create a completely separate in-memory PostgreSQL database with fictional auth users/roles, apply migrations 001/002/003 there, and verify RLS/anonymous denial, idempotency, history-failure rollback, stale source rejection, deleted approval blocking, index duplicate protection and migration rollback without touching existing duplicate fixtures. The browser was separately tested against a fictional in-memory API and confirmed one task/history result and no repeated pending suggestion. These tests do not certify the actual hosted database, independent live connection locking or deployed JWT behavior.

A read-only actual precheck examined active task rows visible to the two existing dev users: no duplicate approved-source groups. It did not inspect deleted rows or other owners. No schema/record write occurred.

After explicit approval only:

1. Verify the Supabase SQL editor is the isolated dev project `fngauurauwvbawlfzbbe`, never the original project. Review and execute only migration 003, not historical migrations 001/002.
2. Run `node tools/verify-atomic-approval.mjs --allow-atomic-approval-test --project=fngauurauwvbawlfzbbe --fixtures=3`. The default command is offline. The approved test creates exactly one new fictional source, its one task and one history row, tests two concurrent RPC calls, owner/B isolation, stale revision and direct duplicate rejection, then reversibly soft-deletes only those three new verified QA rows using their versions. No hard deletion or existing-row update. Failures stop without automatic retry; inspect the printed fictional QA run before resuming because partial QA cleanup may remain.
3. Only after successful actual acceptance, set local `CC_DEV_ATOMIC_FICTIONAL_APPROVALS=enabled-after-approved-migration` and restart the local service. No actual environment change has been made during preparation. The flag is operational rollout control, not an authorization boundary. Enabled clients use only the RPC; an error never falls back to two legacy writes.
4. Verify the local flow without changing original/live hosting. To stop rollout, turn off the local flag; keep the protective index and unused RPC rather than weakening/deleting them automatically. Any later schema rollback requires separate review.

Approval requested: migration 003 in the isolated development database, the bounded three-record fictional acceptance/soft-delete cleanup, and local feature activation after success. No real task creation, provider read, real-body persistence, production schema change or deployment is included.


## Approved atomic development rollout completed

The owner explicitly approved migration 003 in the isolated development database, the three-record fictional acceptance/soft-delete cleanup, and local activation after successful checks. The owner signed into the Supabase dashboard privately. Verified the SQL editor project name `curated-chaos-dev-isolated` and ref `fngauurauwvbawlfzbbe`, applied only migration 003 and observed Success / No rows returned. No original/live project was selected or changed.

Actual QA run `16d4eee3-ce53-4a1f-a755-21ce64ae17aa` created exactly one new fictional source, one task and one linked approval history record. Its first checker stopped because its duplicate-insert test omitted the task section from the reread projection; this was a test-tool defect, not evidence of lost task/history atomicity. Inspected the same run before further writes and confirmed the linked pair and other-account isolation. Fixed the projection and added a regression emulating PostgREST column projection, plus a resume mode that requires the exact existing linked QA records and creates no new fixtures. Continued only that same run. Concurrent retries returned the existing task; stale source and other-owner approval were rejected; a correctly scoped direct duplicate insert was rejected by the unique index. No extra test rows were created.

The resumed verification succeeded and version-guarded soft-delete cleanup covered only the three new disposable QA rows. An independent read-only follow-up confirmed source version 2/deleted, one task/deleted and one history/deleted. Existing records were not updated, deleted or overwritten. This proves hosted duplicate/identity/permission behavior and retry handling; the original fresh-concurrent response details were not retained after the first checker stopped. Offline PostgreSQL rollback cases remain separate evidence, not a claim to have deliberately injected a failure into the hosted schema.

Enabled only the local `CC_DEV_ATOMIC_FICTIONAL_APPROVALS=enabled-after-approved-migration` setting, preserving existing .env.local contents and private permissions, then restarted the agent-owned connection gateway. Its `/dev-config.json` confirms the expected dev project and enabled flag. Browser-verified the development workspace at `http://127.0.0.1:5301/dev-dashboard.html` using existing test credentials privately: Quick Add available, no alerts, QA task absent. No additional approval/task save was performed in the browser. The separate old port-5215 process remains untouched; use the updated port-5301 workspace for this feature. The expired temporary email-text preview process was stopped; it will not reread Gmail automatically.

No Gmail/Chase reads, real task creation, real-body persistence, original/live schema change or deployment occurred in this rollout. The owner-approved local recovery copy predates this nonsecret feature flag; its original key/credentials remain unchanged. Pinned PGlite is dev-only, no package lifecycle scripts ran. The index/RPC remain limited to fictional approval records; production automation/authentication/household security are still incomplete.


## Household policy audit and rollback-only hosted test prepared

Added offline PostgreSQL authorization tests using the existing foundation migrations, fictional auth roles and four synthetic users across two synthetic households. Verified that household ownership does not expose another adult's private records, section grants do not cross tenants, read-only members cannot write, write grants imply read only for that section, direct membership escalation and scope/ownership moves are rejected, membership removal/revoked section rights affect subsequent queries, private records remain accessible to their owner, and anonymous access/hard deletion are denied. Unsupported child roles are rejected by the current schema; this is not evidence that guardian/child account features are implemented or compliant.

Prepared `householdPolicyCheck` to generate a rollback-only SQL script for the two existing development test users. Its temporary footprint is two new fictional households, three memberships (including owner-trigger rows), and six new fictional records. Within one transaction it tests private/tenant/section isolation, allowed versus denied writes, membership escalation, ownership moves and membership removal, then ROLLBACK discards all those writes. A final read-only result verifies none of the QA households/memberships/records remained. It contains no schema changes, no new user accounts/invitations, provider reads or existing-row updates. Claims are simulated within the trusted SQL test transaction; this verifies hosted policies/roles but is not an independent end-to-end JWT/invitation/cache test.

The generated script itself was executed successfully in a separate in-memory PostgreSQL test, including complete rollback and unchanged preexisting fictional fixtures. A second guard test verifies that preparation defaults offline and cannot execute SQL. Prepared a private mode-0600 SQL artifact only after verifying the two existing development identities. Actual hosted execution remains unapproved and unperformed. Artifact: `.local/household-policy-checks/c67479ef-d063-4541-ae13-122ea1362915.sql` (Git-ignored; contains development user IDs, not credentials; do not copy its contents into chat).

Next essential permission: run that exact rollback-only privacy check in isolated project `fngauurauwvbawlfzbbe`. Confirm the project before Run. If an assertion fails and the editor stops before the final ROLLBACK, execute ROLLBACK on that test connection before any other operation, inspect safely and do not invent a passing result. Do not apply any RLS change, invite anyone, enable real household sharing or enroll children under this test permission. The original live app/database remain out of scope.


## Approved hosted household privacy check passed with complete rollback

The owner explicitly approved the rollback-only privacy test in the isolated development database. Verified the Supabase SQL editor remained `curated-chaos-dev-isolated` / `fngauurauwvbawlfzbbe`. Cleared the prior editor contents before inserting the exact prepared private SQL artifact; verified the rollback-only script contained ROLLBACK and no COMMIT. Executed its two-household/three-membership/six-record fictional transaction only.

The hosted assertions passed for adult-private and cross-household isolation, section-specific read/write behavior, denied grant escalation, denied owner/section moves and access removal after membership removal. Supabase returned `policy_checks=passed`, `no_qa_households_saved=true`, `no_qa_memberships_saved=true`, and `no_qa_records_saved=true` after ROLLBACK. Captured only the result grid, with no credentials, private source content or development user identifiers in the screenshot. No new users, invitations, schema/security-rule changes, provider reads or existing-row changes were committed. No original/live project was changed.

This verifies the hosted foundation's SQL roles/policies against temporary fictional data. Auth claims were simulated inside the trusted SQL transaction; this is not certification of invitation/guardian flows, real child enrollment, independent cross-device cache revocation or production compliance. Real household sharing/invitations remain disabled/unapproved and require their own implementation/acceptance. Local automated suite remains 460 passing tests; this hosted check required no code changes.


## Prepared Mac calendar encrypted-storage check (not executed)

The next separate approval covers at most two fictional owner-private encrypted Mac calendar records in development only. The entrypoint is `tools/verify-mac-calendar-storage.mjs`; it defaults to a no-access plan. Execution requires `--allow-mac-storage-test --project=EXACT_DEV_PROJECT --run=UUID --fixtures=2`. The project must match the confirmed isolated configuration and differ from the original project before authentication or key access. Use one named run and inspect its state before retrying; `--resume-only` refuses new fixtures and can finish exact partial cleanup.

The checker authenticates the two existing development accounts, reads the existing private provider encryption key without creating/rotating it, and saves one fictional timed appointment and one fictional two-day event through the sealed insert-only path. It checks encrypted raw payloads, exact owner rereads, account-B invisibility, duplicate-free retry and changed-content conflict blocking. It then soft-deletes only the exact two verified QA rows at their known revisions and rereads the tombstones. Existing records and security rules are untouched. There are no native Calendar requests, real-event imports, invitations, new user accounts or live-app changes. Offline fake-network tests cover normal execution, lost insert acknowledgement, absent-run resume and interrupted cleanup. Actual hosted acceptance still needs owner approval.


### Actual encrypted Mac-calendar result

Owner-approved run `3bea005a-3f80-48cc-820b-2cde7f2d7c27` completed in isolated development project `fngauurauwvbawlfzbbe`: two fictional records inserted with encrypted payloads, exact owner rereads verified, account B saw zero even with account A's IDs/owner scope, repeat inserted zero, altered content was blocked, and both exact QA rows were reversibly soft-deleted and reread. No real events, existing records, schema/policy changes or key rotation. The run is finished; do not rerun as a new fixture set without another approval.


## Prepared fictional provider restore drill (not executed)

`tools/verify-provider-restore.mjs` defaults to an offline plan. Actual execution requires separate approval and `--allow-fictional-restore-test --project=EXACT_DEV_PROJECT --run=UUID --fixtures=2`. The existing private encryption key is read without modification after exact target and two existing test-account checks. An explicitly marked two-record QA archive is generated in memory; the real 46-copy backup is never opened.

The drill inserts at most two encrypted private fictional event records with their archived original save times, verifies owner reread/account-B invisibility/repeat-without-insert/changed-content blocking, then reversibly soft-deletes exactly those two verified QA records at their observed revisions and rereads cleanup. No existing records, tables, policies, memberships, Calendar events or live app are changed. The run ID is logged before any insert. Inspect it before retrying; `--resume-only` refuses to create missing fixtures and can finish only verified partial cleanup. Default/guard/fake-network tests pass, but hosted execution remains pending owner approval.


### Actual recovery drill result

Approved run `8ffd7e21-70b5-44c0-afce-dbec519c6993` completed in `fngauurauwvbawlfzbbe`: two encrypted fictional events restored with original save times, repeat inserted zero, changed copy blocked, second account saw zero, and both exact QA rows were reversibly soft-deleted and cleanup reread verified. No real archive/provider access or existing-record/schema/policy/live-app changes. The run is finished; another write-capable drill requires a new approval.


## Prepared session revocation acceptance · pending owner approval

Review `supabase/migrations/004_development_session_guard.sql` for the separate development project fngauurauwvbawlfzbbe only. It adds two narrowly granted boolean functions without changing app records, existing row policies or authentication sessions. Do not execute without approval.

After approved application, the prepared command is `node tools/verify-development-sessions.mjs --allow-development-session-test --project=fngauurauwvbawlfzbbe`. Default invocation is offline. The test uses existing private A/B credentials without logging them, creates two disposable login sessions, signs out only newly created A with local scope, verifies its old access is denied and newly created B remains active, then signs out B. The finally block attempts cleanup of every newly created login even on failure. No new accounts, app records, provider reads, source refreshes or production changes. Existing sessions are not explicitly revoked; server-side single-session policies, if configured, can affect concurrent logins. A failed test or uncertain cleanup must be inspected before retrying.

Only after that acceptance passes, enable the optional local gateway check with the exact-project startup guard. Do not enable Mac transfer, review, save or provider refresh flags as part of this acceptance. App-wide production sessions remain a separate release gate.


### Session-check result and prepared next acceptance

Migration 004 and its two-login test passed after explicit owner approval on November 8. Both temporary logins closed, revoked session blocked, independent session stayed active, zero app-record changes/provider reads. The private-connection gateway is now enabled with this check. Do not rerun a new login drill under the consumed approval.

Migration 005 remains unapplied. After a new approval, apply only to fngauurauwvbawlfzbbe, then use `node tools/verify-development-sessions.mjs --allow-development-session-test --project=fngauurauwvbawlfzbbe --verify-record-access`. This new mode creates two disposable existing-account logins and reads up to 100 sorted identifiers/owner IDs from each owner's records (no payloads, titles, transaction contents or source refreshes). It requires demonstrated A access before revocation, then denies A's old-token record access, checks B's bounded result unchanged, and closes its new logins. Empty B results do not independently prove a positive B record read; offline policies additionally prove positive access. No app records are inserted, updated or deleted. Policy errors may require development re-sign-in or an owner-approved rollback; do not change live policies.


### Actual direct-access session result

After separate approval, migration 005 was applied on November 8 in fngauurauwvbawlfzbbe. The bounded record-identifier acceptance passed: revoked A direct access denied, B's bounded results unchanged, both temporary logins closed, app-record writes zero, provider reads zero. No live project changes. This hosted approval is finished and consumed.

## Prepared one-layout acceptance (not executed)

After separate approval only, use `node tools/verify-widget-storage.mjs --allow-fictional-widget-test --project=fngauurauwvbawlfzbbe --run=NEW_UUID --fixtures=1`. It creates one private fictional dashboard layout, tests a revision-guarded edit and rejected stale edit, verifies account B cannot read it, soft-deletes the exact fixture at its observed revision, and rereads to verify removal plus deleted-layout API/model/edit exclusion. The initial timestamp is old so it does not displace an existing newer layout during initial selection. The test edit receives the normal current timestamp; the disposable layout may temporarily be the most recent development layout until removal. Existing layout rows are never edited. Two new existing-account logins are closed even when tests fail. No source refresh, schema/policy changes or live app changes.

The run ID is logged before writes. A lost insert acknowledgement triggers only scoped cleanup, never insertion retry. An existing ID stops before insertion and is not cleaned. Cleanup requires matching owner, private scope, type, origin, run marker and observed version; failure stops for inspection. No general restore/resume mode or hard delete exists. Five fake-network guard/success/failure tests pass. The actual hosted test remains unapproved and unexecuted.


### Actual widget test result

Approved run d626cc20-eae0-49aa-b3ad-df202c60c48a passed on November 8: one fictional layout created/edited then reversibly removed and reread verified, stale/deleted updates blocked, deleted active-list/model exclusion verified, other-account visible rows zero, both temporary logins closed. No existing records or provider access. This approval is finished.

## Prepared one-preferences-record acceptance (not executed)

After separate approval only: `node tools/verify-preferences-storage.mjs --allow-fictional-preferences-test --project=fngauurauwvbawlfzbbe --run=NEW_UUID --fixtures=1`. Creates one private fictional settings row, updates its appearance/navigation at its observed revision, rejects a stale edit, checks B invisibility, soft-deletes the exact fixture and rereads, then rejects deleted-row update and verifies active-list/model exclusion. Both new existing-account logins close in finally. It shares the widget acceptance's exact target/marker/version/ID collision and lost-acknowledgement cleanup boundaries. Existing preference rows are never edited. Its current-timestamp edit may briefly select the disposable fixture as development preferences until removal; no live app/source refresh/schema changes.


### Actual preferences acceptance

Approved run b401cffd-6dc6-45b2-a5d5-6e07ac0e78a6 passed November 8: one fictional row created/edited and soft-deleted with reread verification; stale/deleted edits rejected; deleted active-list/model exclusion; account B visible rows zero; both new temporary logins closed; zero provider reads or existing-record changes. Approval completed.

## Prepared migration 006 · pending approval

The read-only active-private-settings duplicate-group preflight returned zero rows (zero duplicate groups). Apply 006 only after new owner approval and only in fngauurauwvbawlfzbbe. It creates a unique partial index, never changes records and fails on existing duplicates; do not clean duplicates automatically or use IF NOT EXISTS to hide an unexpected index definition.

After approved application, inspect public.cc_one_active_private_settings_per_owner with pg_index/pg_get_indexdef to verify uniqueness, validity, correct columns and the exact active/private/household-null/two-type predicate. This verification needs no new fixture records or logins. Offline tests additionally demonstrate rejection/replacement behavior. The old fictional settings/layout acceptance scripts are not general repeatable tests once uniqueness is installed: an owner's existing active row correctly blocks creating another fixture. Use separately authorized isolated fixture owners for any future positive write drill; never remove existing settings to make a test pass.


### Actual migration 006 verification

After owner approval, applied 006 to fngauurauwvbawlfzbbe (737ca34c-9eef-4f1a-a4cf-2ec9490ceec0). Separate read-only schema inspection (6e4f06dd-3609-49ab-98b7-7cf97a5788c9) confirmed index cc_one_active_private_settings_per_owner is unique and valid, uses owner_id/item_type, and has the exact two-type active private household-null predicate. No fixtures, test logins, record updates/removals or source reads. Approval finished. Do not rerun historical one-row settings/layout acceptance procedures against an owner whose active row already exists.


## Prepared private-workspace backup · not executed

After separate approval only, `node tools/backup-private-workspace.mjs --allow-private-workspace-backup --project=fngauurauwvbawlfzbbe` creates one new local encrypted archive of account A's private household-null cc_records, including deleted records and already saved providers. It signs in temporarily with existing private configuration, checks current session, reads a bounded inventory twice, refuses differences, uses the existing 32-byte provider encryption key without rotating it, verifies the exclusive private output file by authenticated reread, wipes its key buffer and closes its temporary login. No database changes or provider refreshes. No actual records/key/credentials were read while preparing or testing this tool.

It excludes shared household records, profiles, memberships, auth accounts, credential files, connection grants, schema/storage and other owners. It is not complete database recovery or a separate-device backup; no restore command is exposed. Output defaults to this Mac's private Recovery/WorkspaceSnapshots directory. If login cleanup fails after archive completion, a new archive may already exist: inspect before retrying rather than blindly creating more copies. Default invocation prints only the offline plan.


### Actual private-workspace backup acceptance

Approved November 9 export 2116bd95-0964-4fc0-84dd-dae3d2a8dc89.ccworkspace verified 129 owner-private cc_records including deleted records; exact encrypted disk reread and mode 600 passed; temporary login closed. Zero database writes/provider reads/restore attempts. Existing files/key unchanged. This is an export-only acceptance, not a hosted restore test. Approval completed; do not create another real export under it.


## Workspace comparison result / prepared two-record recovery drill

Read-only comparison of archive 2116bd95-0964-4fc0-84dd-dae3d2a8dc89 returned 129 unchanged, zero missing/conflicts/blocked/current-only, zero app-record/file writes/provider reads/restores, temporary login closed. This does not prove actual 129-record restoration. `tools/preview-workspace-restore.mjs` defaults offline and has no restore flag.

After fresh owner approval only, `node tools/verify-workspace-recovery.mjs --allow-fictional-workspace-recovery --project=fngauurauwvbawlfzbbe --run=NEW_UUID --fixtures=2` creates a fictional note/task archive and key in memory (no real file reads), inserts those two original-ID/revision/timestamp rows, verifies exact owner reread/account-B invisibility/comparison protections, reversibly removes only them and closes both new temporary logins. Exact run markers, payloads, identity/scope, created times and observed revisions are checked before cleanup. Existing collisions stop without overwrite or cleanup. Lost acknowledgement never retries insertion; cleanup only handles the exact new fixtures. Inspect the logged run if cleanup fails, and never reuse this authorization for another run.

The prepared drill passes offline PostgreSQL tests with current RLS/migrations 001–006 plus fake-network cleanup/error guards. It does not offer a real-archive restore or test all payload dependencies, active singleton replacement, shared household recovery or a new database project. Hosted execution remains pending approval.


### Actual workspace recovery result

Approved run 8e3ef286-dcfb-4086-80c7-df81c7503240 passed November 9: two fictional rows recovered with original revisions/times, B saw zero, repeat comparison unchanged two, changed-copy/deleted-state protections passed, both exact fixtures soft-deleted and cleanup reread verified, both temporary logins closed. Real archive/key/provider reads zero. No existing records or live project changes. This approval is consumed; do not run another write-capable drill without new approval. Real-archive recovery and broader database disaster recovery remain untested.


## Prepared server-held session acceptance · not executed

After new approval only: `node tools/verify-private-workspace-sessions.mjs --allow-server-session-test --project=fngauurauwvbawlfzbbe`. Two new existing A/B logins are created inside the server-only session component. Only A's local expiry metadata is shortened to exercise actual Supabase renewal immediately; hosted expiry settings are not changed. It verifies one coalesced renewal, old-handle/upstream revocation and independent B status, then closes both in disposal. No cc_records reads/writes, source refresh, credential storage files, backup/key access, public endpoint, workspace UI integration, schema changes or live app changes. Default invocation is offline. Failed acceptance must not be blindly retried if login cleanup is unconfirmed. Current server/browser sign-in integration remains unchanged.


### Actual server-session test result

Approved November 9 authentication-only acceptance passed: two temporary logins created/closed, one coalesced real renewal, revoked login blocked locally/upstream, independent login stayed active, app-record reads/writes/provider reads zero, workspace UI unchanged. This authorization is finished; do not repeat the hosted test under it. No HTTP cookie transport or production deployment was enabled.


## Prepared private cookie transport acceptance · pending approval

After new approval only: `node tools/verify-private-cookie-sessions.mjs --allow-private-cookie-test --project=fngauurauwvbawlfzbbe`. It starts the isolated loopback 5312 authentication preview, creates two temporary existing-account logins via local HTTP, checks HttpOnly/Strict/path cookie attributes, safe response fields, bound CSRF and Origin rejection, logout/cookie clearing and independent login status. Both logins are explicitly closed; disposal closes any remaining session on errors and stops the temporary service. Exact development-project validation occurs before a server/upstream client is created.

No app record reads/writes, source refresh, backup/key access, schema/policy changes, existing app UI integration or live deployment. Default invocation is offline. Full HTTP acceptance/failure cleanup passes with fictional upstream accounts; browser fake sign-in/reload/sign-out was observed. Existing per-tab workspace auth remains unchanged. If port 5312 is occupied, stop for inspection rather than terminating an unknown service. Real hosted execution remains unapproved.


### Actual private cookie test result

Approved November 9 HTTP acceptance passed: two temporary existing-account logins created/closed, HttpOnly Strict cookies verified, CSRF/origin checks passed, logout cookie cleared, independent account active and upstream credentials absent from responses. App-record reads/writes/provider reads zero; workspace UI unchanged. Temporary port 5312 service stopped. This approval is complete; do not rerun with new logins under it.


## Prepared read-only private settings acceptance · pending approval

After a fresh approval: `node tools/verify-private-cookie-sessions.mjs --allow-private-cookie-test --project=fngauurauwvbawlfzbbe --verify-preferences-read`. This starts only the separate loopback preview, creates two temporary existing A/B logins, reads each account's saved preferences exactly once through the protected cookie route, verifies signed-out access denial, closes both logins and stops the service. No preference writes, other app records, providers, backup/key files, schema changes or current workspace/live UI integration. Reports only counts/check results, not saved values. Accounts with no supported saved preference row produce defaults and are counted separately; that does not prove positive stored-row persistence.

The read route is default disabled. For fictional browser checks use --fixtures-only --allow-private-preferences-read with the standalone preview tool; it opens no real configuration or API client. All 670 tests pass, including real loopback HTTP requests with a fictional upstream, wrong-owner failure cleanup and mid-read logout/revocation suppression. Actual real read acceptance is pending approval.


### Actual read-only private settings result

Approved November 9 acceptance passed: two new temporary logins, two owner-scoped preference reads, both accounts with saved preferences, signed-out read denial, cookie/CSRF/origin/logout checks passed, both logins closed, preview service stopped. App-record writes and provider reads zero; existing workspace UI unchanged. Approval is consumed. No saved preference values or credentials were printed.


## Prepared reviewed density save acceptance · pending approval

After a new explicit approval: `node tools/verify-private-cookie-sessions.mjs --allow-private-cookie-test --project=fngauurauwvbawlfzbbe --verify-preferences-read --verify-preferences-save`. This starts only the isolated save-enabled preview, creates two temporary existing-account logins and reads their saved preferences. Existing A preferences are required; it toggles only density (compact↔balanced), requires the server review to contain exactly that one field, explicitly approves the one-use review, checks replay rejection/B unchanged, then rereads and restores A's original density through another review/approval. At most two update attempts on the same existing A row; creation is blocked. Original save version/timestamp cannot be restored and will advance normally.

Restoration occurs in finally only if the latest normalized preferences equal either the original state (nothing to restore) or the exact expected test state. Unexpected concurrent edits stop restoration rather than overwrite other work. An unconfirmed restore can leave the temporary density in development; inspect before retrying. All temporary sessions close and the preview stops even after test failure. No other app records, providers, backup/key files, security rules or live app are touched. Fake HTTP success/lost-ack cleanup/concurrent-change tests pass. No actual hosted writes have been performed under this mode yet; earlier read-only/auth approvals do not authorize it.


### Actual reviewed saving acceptance

Approved November 9 test passed: eleven logical preference-list reads, two acknowledged updates to the same existing A record (density toggle/restoration), B unchanged, review replay blocked, original density value confirmed, signed-out reads denied, both temporary logins closed and service stopped. No new preference rows, providers, backups/keys, security rules or live app changes. Save version/time advanced as disclosed. This approval is complete and cannot be reused for another write test.


## Prepared private Daily Brief acceptance · pending approval

After new approval only: `node tools/verify-private-cookie-sessions.mjs --allow-private-cookie-test --project=fngauurauwvbawlfzbbe --verify-workspace-brief`. This starts the isolated brief-enabled preview, creates two new existing A/B logins and makes exactly one owner-scoped saved task/note/event list read each. The real API projects only required title/date/time/completion/fictional metadata, not full note bodies or provider payloads. The verifier checks read-only/whitelisted output, anonymous/signed-out denial, safe cookie/origin/CSRF behavior and independent login status; reports counts only, closes both logins and stops the service.

This mode cannot be combined with preference read/save acceptance. No app-record writes, preference access, providers, backup/key files, schema/security changes, existing workspace UI migration or live deployment. Fixture mode --fixtures-only --allow-private-brief-read needs no real configuration/accounts; its browser load/clear proof passed and the service was stopped. Full fictional HTTP and API-projection tests pass. Hosted real-data read remains pending approval.


### Actual private Brief result

Approved November 9 acceptance passed: two logical owner-scoped Brief list reads with 37 A/one B source rows, no note-body projection, signed-out access denied, cookie/origin/CSRF/logout/independent-account checks passed. Both temporary logins closed and service stopped. No app-record writes/providers/preferences/backups/keys or live app changes. This completed test does not authorize app-record writes. Equivalent read-only regression checks within the approved accounts and fields may continue under the existing development authorization.


## Integrated private Daily Brief and prepared task-completion drill · November 9

The actual existing dashboard document now has an opt-in private server response that loads the cookie-only controller. The original document and running app are unchanged. Integrated read-only acceptance passed with 37 A/one B source records, two temporary logins closed, zero app-record writes, key-free browser configuration, blocked legacy authentication scripts and service stopped. This reused the already-approved read-only scope.

Task completion is disabled by default. Enabled previews issue account/context-bound opaque task capabilities and one-use five-minute reviews. Explicit approval performs fresh ownership/version/payload checks, preserves unrelated task fields and requires acknowledged save plus matching reread. Logout, offline state and expiry clear pending browser actions; uncertain responses never retry automatically. Fictional browser review/completion/sign-out passed.

**Pending new database-write approval:** `node tools/verify-private-task-completion.mjs --allow-fictional-cookie-task-test --project=fngauurauwvbawlfzbbe --run=NEW_UUID --fixtures=1`. Creates exactly one marked fictional private task, checks B cannot read/review it, completes it through review/approval, rejects replay, checks preserved subtasks, then soft-deletes and verifies the exact fixture. Closes both temporary logins and stops the private service. Existing tasks/settings, providers, backup/key files, schema/security rules and live app are excluded. Offline fake-adapter tests cover collision refusal, lost acknowledgement and exact cleanup. No hosted task-completion drill has run.


### Approved task-completion drill passed

November 9 run `78f70da9-6244-44a6-aa09-dbbd41ae390b` passed: exactly one fictional private task created, explicitly reviewed/completed and soft-deleted; other-account visibility zero and review denied; approval required and replay blocked; unrelated payload/subtasks preserved; existing-task writes zero; both temporary logins closed; provider reads zero and preview service stopped. The bounded approval is complete. Another database-write drill requires approval. Task completion stays disabled by default; no live app or existing task changes.


## Prepared selected-note acceptance · awaiting note-body access approval

Command after approval: `node tools/verify-private-cookie-sessions.mjs --allow-private-cookie-test --project=fngauurauwvbawlfzbbe --verify-workspace-brief --verify-dashboard --verify-note-read`.

Creates two temporary logins for the existing development test accounts; reads supported task/event/note display lists once per account; opens at most ONE displayed account-A note body through its owner/context/version-bound capability; denies account B and signed-out note access. Only counts/status are logged, no title/body. Zero app-record writes, provider reads, preference access, backup/key access, schema or live changes. Closes both logins and stops the separate service even on test failure. Fixture UI and offline fake HTTP success/failure cleanup pass. This scope extends beyond the previously approved title-only Brief reads and has not been executed against actual saved note text.


### Approved selected-note acceptance passed · November 9

The separately approved hosted test passed: exactly one account-A saved note title/body read through the private cookie dashboard, two owner-scoped Brief lists (37 A/one B source rows), B capability use denied and signed-out note access denied. No note title/body was logged or copied into documentation. Both temporary logins closed and isolated service stopped. Three logical app-record reads, zero app-record writes/provider reads; no preferences, backups/keys, schema or live changes. This completes the bounded one-note access approval; additional note-body acceptance requires the applicable authorization.


## Prepared reviewed note-edit acceptance · awaiting database-write approval

After approval only: `node tools/verify-private-note-edits.mjs --allow-fictional-cookie-note-edit-test --project=fngauurauwvbawlfzbbe --run=NEW_UUID --fixtures=1`.

Creates one new marked private fictional note for existing development account A. Lists supported Brief display fields for A/B, opens ONLY the new fictional note, reviews/approves exactly one title/text update, checks B isolation, explicit approval, replay denial and unrelated payload preservation. Soft-deletes and rereads the exact fixture, closes both temporary logins and stops the separate preview. Full-note reads and edits are wrapped to refuse any existing note identity. Cleanup accepts only the named owner/origin/marker/payload/version, refuses collisions and never overwrites unrelated records. Lost acknowledgement triggers exact cleanup without retrying the edit. No existing notes/settings/tasks, providers, backup/key files, schema/security rules or live app changes. Offline fake success/collision/wrong-target/uncertain-save tests and fictional browser review/save proof pass. No actual database note-edit drill has run.


### Approved reviewed note-edit acceptance passed · November 9

Run `3b658b4a-f173-4012-8b39-a2c9ee0f3175` passed after separate owner approval. Exactly one new fictional private note created, title/text edited after explicit review/approval and exact fixture soft-deleted/reread. B visibility zero and review denied; replay blocked; unrelated payload fields preserved; existing-note writes zero. Both temporary logins closed, service stopped, provider reads zero. No existing app records, backups/keys, schema/security rules or live changes. This completes the bounded write approval; the feature remains default-off.


## Prepared reviewed task-creation acceptance · awaiting database-write approval

After approval only: `node tools/verify-private-task-creation.mjs --allow-fictional-cookie-task-create-test --project=fngauurauwvbawlfzbbe --run=NEW_UUID --fixtures=1`.

Two temporary logins for existing development A/B; exact fixture-ID collision precheck; non-writing review of a new fictional Home task; B cannot approve A's review; unapproved/repeated requests denied. Exactly one insertion occurs through the actual private dashboard review/approve path, using a server-only named UUID. Exact private scope/payload and Daily Brief visibility are checked; B cannot read it. The exact fixture is soft-deleted/reread, both logins closed and service stopped. Full-task rereads and inserts are wrapped to reject any existing task ID. No existing task/settings/note writes, provider access, backup/key files, schema/security rules or live changes. Fake end-to-end success/wrong-project/collision/lost-acknowledgement cleanup and fictional browser proof pass. The actual hosted drill has not run.


### Approved reviewed task-creation acceptance passed · November 9

Run `94b96d61-e148-49a9-8bcb-fcb2bec98fc9` passed after separate owner approval: review was non-writing; exactly one new private fictional task was inserted through explicit approval; B visibility zero and approval denied; replay blocked; exact fixture soft-deleted/reread. Existing-task writes zero, both temporary logins closed and preview service stopped. Provider reads zero; no other existing records, backups/keys, schema/security rules or live changes. This completes the bounded creation-test approval; task creation remains opt-in/default-off.


## Prepared reviewed task-edit acceptance · awaiting database-write approval

After approval only: `node tools/verify-private-task-edits.mjs --allow-fictional-cookie-task-edit-test --project=fngauurauwvbawlfzbbe --run=NEW_UUID --fixtures=1`.

Create one new marked private fictional Home task. Load A/B display Briefs; B cannot review A's edit capability. Review/approve one title/date/Home→Work update, deny unapproved/repeated approval, verify incomplete status/subtasks/other payload preserved. Soft-delete/reread only the named exact fixture and close both temporary logins/service. Existing identity collision stops before insertion or cleanup; full reads/edits are wrapped to the single new ID. A lost save acknowledgement triggers exact fixture cleanup without repeating the edit. No existing tasks/notes/settings writes, providers, backups/keys, schema/security rules or live app changes. Offline full fake success/wrong-target/collision/uncertain-response cleanup tests and combined fictional browser editing/completion passed. Hosted edit drill has not run.


### Approved reviewed task-edit acceptance passed · November 9

Run `aa138e81-8b6e-4c44-9438-7ae8ce372a19` passed after separate owner approval: exactly one new fictional private task created, title/date/section edited after explicit review/approval and exact fixture soft-deleted/reread. B visibility zero and review denied, replay blocked, completion/subtasks/unrelated payload preserved. Existing-task writes zero; both temporary logins closed and service stopped; provider reads zero. No other existing app records, backups/keys, schema/security rules or live changes. This completes the bounded editing-test approval; editing remains opt-in/default-off.


## Prepared passive-session acceptance · awaiting temporary-login approval

After approval: `node tools/verify-private-cookie-sessions.mjs --allow-private-cookie-test --project=fngauurauwvbawlfzbbe --verify-passive-check`.

Authentication-only mode, incompatible with preferences/Brief/note modes. Creates two temporary logins for existing A/B development accounts, records their idle deadlines, passively verifies them without extension, signs A out and denies its passive check, verifies B stays active with the same deadline, then closes B. Cookie/origin/CSRF protections and cleanup are checked; count/status-only report. Zero app-record reads/writes, providers, backup/key access, schema/security changes or live app changes. Offline fake acceptance and real two-tab fictional browser clearing/recheck proof passed; hosted authentication-only test has not run.


### Approved passive-session acceptance passed · November 9

Hosted authentication-only test passed after separate approval: passive checks verified both existing development test-account logins without extending idle deadlines; signed-out passive access denied; independent login remained active. Both temporary logins closed and isolated service stopped. Cookie/origin/CSRF checks passed. App-record reads/writes and provider reads zero; no backups/keys, schema/security or live changes. Bounded approval complete.


## Combined private workspace for owner use · awaiting access decision

The prepared Mac launcher enables previously accepted private task create/edit/complete and note read/edit controls together on the separate development service. Opening/signing in displays owner-scoped task/event display fields and note titles; note bodies load only on explicit Open note. Every mutation requires a displayed review and approval. No automatic record writes/provider refresh/backups/keys/schema/live changes. The CLI/launcher never signs in automatically. If the owner separately authorizes agent-assisted sign-in, use only the configured development account, keep credentials out of chat/logs, inspect only status/counts, do not open note bodies or approve app-record changes, and leave the user-facing preview open as requested. Existing original/gateway services must remain untouched. This ongoing-use access is separate from completed bounded fixture tests.


### Approved combined workspace access opened · November 9

Owner approved opening/signing in for use. Separate combined service is running on 5312 in configured development project; owner-facing browser tab retained, signed in as existing A, initial saved Brief verified by status/count-free booleans only. No note body opened or app-record changes approved/executed by agent. Public-header-only proof saved, no private contents copied. This ongoing owner preview is intentionally left running; do not close it as fixture-test cleanup. Manual user review/approval remains required for writes. Providers/backups/keys/schema/live app untouched.


### Approved preview restart completed · November 9

Owner explicitly confirmed readiness to clear temporary drafts/sign-in. Only the private preview was stopped/restarted; configured development account restored, saved Brief load verified and tab retained. Stable asset capture is active. No note-body opens or app-record writes; no provider/backups/keys/schema/live changes. Runtime session 1772 remains open for owner use, replacing 75852; do not stop as test cleanup.


## Prepared reviewed note-creation acceptance · awaiting database-write approval

After approval only: `node tools/verify-private-note-creation.mjs --allow-fictional-cookie-note-create-test --project=fngauurauwvbawlfzbbe --run=NEW_UUID --fixtures=1`.

Starts isolated staging 5313 with a separate browser cookie; owner 5312 stays open. Creates two temporary logins for existing development A/B. Exact named-ID precheck; review of one fictional note is verified non-writing; B approval, unapproved save and replay denied. Exactly one private note is inserted through actual review/approval, verified by exact reread and title-only Brief, then soft-deleted/reread. Wrapper restricts full rereads/insertion to the named new ID and rejects all existing note-body opens. Closes both logins and staging even on failure; lost acknowledgement never retries insertion and triggers exact cleanup. No existing app-record writes, provider/backups/keys/schema/security/live changes. Offline full fake success/collision/wrong-target/uncertain-save tests and fictional browser proof pass; actual drill has not run.


### Approved reviewed note-creation acceptance passed · November 9

Named run `e658579e-4b8a-439e-859c-13d8af32f78f` passed: review created nothing; one fictional private note inserted after explicit approval; B visibility zero and approval denied; replay blocked; exact fixture soft-deleted/reread. Existing-note writes zero, both temporary logins closed, staging 5313 stopped, provider reads zero. Owner 5312 process remains untouched. No existing records, providers/backups/keys/schema/live changes. Bounded creation-test approval complete.


## Prepared title-search acceptance and combined activation · awaiting approval

Read-only command: `node tools/verify-private-cookie-sessions.mjs --allow-private-cookie-test --project=fngauurauwvbawlfzbbe --verify-title-search`.

Separate staging 5313/cookie, two temporary existing A/B logins, exactly one supported private task/note/event title-metadata list read each using query QA/type all/section all. Validate whitelisted results and signed-out access denial; count-only report, both logins closed/staging stopped. No note-body/provider/preference/backup/key access, app writes or schema/live changes. This mode cannot combine preference/Brief/note-body modes. Fake acceptance passes.

If separately approved and this check passes, stop only current owner runtime 1772, restart the same configured owner preview with `--allow-private-title-search --allow-private-note-create-reviewed` plus its existing flags, privately sign owner back in and verify controls/load without executing search, opening note bodies or approving writes. Restart closes old login and clears temporary drafts; owner must confirm readiness first. Original/gateway/live app remain untouched. New runtime should be left running/retained for owner use.


### Approved title-search test and owner activation completed · November 9

Search test passed: two temporary A/B logins, two logical metadata reads, match counts seven/one, signed-out denial, no note bodies/app writes/provider reads. Both test logins closed/staging stopped. Owner then received the approved private preview restart/sign-in with Search/Add a note enabled; controls/load verified by booleans without note-body opens or mutation approval. Runtime 61372 stays running for owner use, replacing 1772. No original/gateway/live app, backup/key or schema changes. Bounded test/restart authorization complete; future automatic record changes require appropriate approval.


## Prepared search-note workflow acceptance · awaiting approval

After approval only: `node tools/verify-private-search-notes.mjs --allow-fictional-search-note-test --project=fngauurauwvbawlfzbbe --run=NEW_UUID --fixtures=1`.

On staging 5313, create one new marked private fictional note. A exact-title search returns one title-only result/capability; B search returns zero and opening A's capability is denied. A explicitly opens only that fixture, reviews/approves one title/text edit, verifies preserved extension fields and replay denial, then exact soft-delete/reread. Full-note reads and updates are wrapped to the new fixture ID. Existing-ID collisions stop before overwrite/cleanup; lost edit acknowledgements do not retry and trigger exact cleanup. Both temporary logins/staging close. No existing-note text access or existing-record writes, providers/backups/keys/schema/live changes. Fake success/collision/wrong-target/uncertain-save tests and fictional browser proof pass.

If separately approved in the same readiness decision and the test passes, restart only owner runtime 61372 with its existing combined feature flags, privately restore configured account A, verify loaded UI/controls without opening existing note bodies or approving record changes, retain owner tab/service. This activation closes its current login and clears unsaved drafts; owner readiness is required first.


### Approved search-note test and activation completed · November 9

Named run `268b9092-f842-46e0-a1d8-f8e21159ba59` passed: one fictional fixture created/searched/opened/reviewed/edited/soft-deleted with privacy, explicit approval, replay and payload-preservation checks. B could neither find nor open it. Both temporary logins closed, staging stopped; no existing-note reads/writes or provider reads. Approved owner preview restart/sign-in then completed without opening note bodies or mutating records. Runtime 56746 remains open, replacing 61372. Original/gateway/live app, backups/keys and schema untouched. Bounded test/restart approval complete.


## Prepared searched-task edit/completion acceptance · awaiting approval

After approval only: `node tools/verify-private-search-tasks.mjs --allow-fictional-search-task-test --project=fngauurauwvbawlfzbbe --run=NEW_UUID --fixtures=1`.

Staging 5313, two temporary existing A/B logins. Create exactly one new marked private fictional task with subtasks. A exact-title search supplies edit/completion actions; B cannot find it or use its handles. Review/approve at most one title/date/section edit; reject stale completion; fresh search and review/approve at most one completion. Verify preserved subtasks/source/fixture fields, explicit approval and replay denial, then exact soft-delete/reread. Full reads/updates are wrapped to the one new ID. Cleanup accepts only known original/edited/completed payloads and versions 1–4; identity collision stops before insertion or cleanup. Lost edit/completion acknowledgement never retries and triggers exact cleanup. Both temporary logins/staging close. No existing app-record edits, note bodies, providers/backups/keys/schema/live changes. Fake success/collision/wrong-target/lost-ack cleanup and fictional browser flow passed.

If separately approved and the drill passes, restart only owner runtime 56746 with the same combined flags to load searched-task actions, privately sign account A back in, verify controls/load without opening note bodies or approving existing-record changes, and retain the owner preview. Readiness approval must acknowledge clearing unsaved drafts/current login first.


### Approved searched-task workflow and activation completed · November 9

Named run `f3732c8e-7927-4b04-958d-544c733440c6` passed: one fictional task created/searched/edited/completed/soft-deleted with B search/action denial, explicit approvals, replay/stale-handle protection and payload preservation. Both temporary logins/staging closed; existing-task writes/provider reads zero. Approved owner restart/sign-in then completed without searches, note-body opens or existing-record mutation approvals. Runtime 4798 remains open, replacing 56746. No original/gateway/live app, backup/key or schema changes. Bounded approval complete.


## Prepared saved-appearance acceptance · awaiting access/readiness approval

After approval: `node tools/verify-private-cookie-sessions.mjs --allow-private-cookie-test --project=fngauurauwvbawlfzbbe --verify-appearance-read`.

Staging 5313/separate cookie; two temporary existing A/B logins; exactly one supported task/event/note-title Brief read and one minimal palette/density/scope-marker read per account. Verify read-only available appearance and signed-out/independent-account/cookie/CSRF/origin behavior; no actual palette/density values in logs. Close both logins/staging. Zero note-body/settings-write/provider/preference-full-payload/backup/key access, no schema/live changes. An appearance outage/invalid scope stops acceptance safely. Offline fake success/failure and fictional browser apply/reset passed.

If separately approved and the read-only check passes, restart only owner runtime 4798 with its existing flags plus `--allow-private-appearance-read`, privately restore A, verify Brief/appearance-applied state without printing choices, opening note bodies or approving record changes, retain owner tab/service. Save/discard unsaved drafts first; restart closes the old login and clears temporary drafts. No saved setting value is changed by applying its display choice.


### Approved appearance test and activation completed · November 9

Staging read-only check passed: two temporary A/B logins, four logical record reads (two minimal appearance/two Brief metadata), two supported saved appearances, signed-out/privacy/origin/CSRF checks. No values printed, note bodies/app/settings writes/provider reads zero. Both test logins/staging closed. Owner-approved preview restart/sign-in then completed and saved appearance applied without changing its values. Runtime 78603 remains open, replacing 4798. Original/gateway/live app, providers/backups/keys/schema untouched. Bounded authorization complete.
