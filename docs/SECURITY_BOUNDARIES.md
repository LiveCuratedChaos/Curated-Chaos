# Current development security status — November 8, 2026

The isolated development app now contains nine explicitly approved Gmail metadata snapshots and 32 explicitly approved encrypted Chase snapshots (three accounts and 29 transactions). These are real private records, not fictional fixtures. Other workspace planning screens and QA fixtures remain development data. The original live app and database have not been changed. The historical milestone notes below describe earlier states and must not be used to infer current data contents or production readiness.

The local connection gateway holds app tokens in server memory behind an expiring HttpOnly/SameSite cookie. Provider credentials and financial payloads use authenticated encryption with the private key on this Mac. Database owner isolation for the approved financial records was independently checked using the other development account, which could see none. The older fictional workspace session manager still uses per-tab refresh-token storage; that limitation has not been solved app-wide.

Reopening saved financial snapshots does not call Chase. Initial-save approval does not authorize automatic refresh, updated records, sharing, broader imports, payments or trading. Amounts are hidden by default, but transaction and account labels are private too; avoid whole-page screenshots or logs of these views.

## Key loss and recovery

The original private encryption key is required to read existing provider grants and financial ciphertext. The local provider store now refuses to generate a replacement key if other files remain in its directory. Invalid or linked key files are rejected without replacement. Tests use fictional temporary keys and verify restoration with the original key. This guard cannot detect every loss scenario: if all local storage disappears, remote encrypted financial records may still exist. Never treat a newly empty directory as proof there is no previous encrypted data.

No key backup or recovery guarantee is implemented. Do not rotate, delete, copy to chat, commit, or replace the real key as a recovery attempt. A future backup/recovery workflow must protect both the database records and their original key, verify restore using fictional data first, and obtain approval before sending secrets or private records to any new destination. Production secret management, cross-device access, household security and release acceptance remain outstanding.

---

## Historical milestone notes

> November 8 integration update: separately consented Google connections and bounded read-only previews are available through the local gateway. Workspace database records remain fictional. Google credentials are kept in private encrypted local storage; real source content has not been persisted to the app database. These development previews do not establish production readiness. See INTEGRATION_PREPARATION.md for the current approvals, tests, and limits.

> Current status: M3D Phase 2 includes connected, private fictional records in a separately configured Supabase development project. The local-only descriptions and early milestone checklists below are historical, not a statement that current cloud isolation has been verified. Sessions retain a development refresh token in per-tab sessionStorage. Live providers and production security remain unfinished. See ../M3D_PHASE2_START_HERE.md for current local usage.

# Security and accuracy boundaries — Development starter

**This demo is not a secure data vault.** It contains only fictional records and keeps changes in browser `localStorage`. No server-side authorization is present or implied.

- The demo's `isVisibleRecord` logic illustrates access filtering, but cannot enforce real household privacy. Real access must be authorized by **Supabase RLS plus server-side checks** and verified with independent authenticated test accounts.
- All displayed service names are **fixtures**, not connected integrations or live data. No connector SDK, credentials or tokens are bundled.
- Every email-created task/event requires an explicit user review. The demo explicitly blocks an Automatic setting for those and financial-record changes.
- The financial account shown is fictional; no transfers, payments, trades, or banking operations exist.
- Real documents should not be added, since offline cache encryption, access revocation, and backup guarantees are not implemented.
- The eventual app must not promise immediate wiping of data on a lost offline device. Revocation protects the server immediately; cache deletion can run only if that PWA reconnects and executes it.
- Auth recovery, guardian security, 48-hour protection, household ownership transfer, export privacy and child compliance require a separate audited implementation.
- Server-side automation must validate requested actions independently of client-selected modes and check actor authorization at execution time.

## Security test scenarios to run in M0B (not yet performed)

1. Adult A cannot read or edit Adult C private records (including owner of same household).
2. Adult A cannot access Household C regardless of guessed UUIDs.
3. Member without section grant cannot query shared bills, even through search, brief, exports, or underlying REST API.
4. After membership removal, shared records become inaccessible immediately on the server.
5. Changing client JSON or forging an owner/member ID cannot escalate permissions.
6. User cannot directly mark a suggestion approved without an authorized and audited action.
7. Child accounts receive no data outside guardian-approved scopes.
8. OAuth tokens are never returned to browser or exposed in downloaded exports.
9. Stale disconnected source metadata is obvious and insights do not claim freshness.
10. Development Supabase and the existing project have distinct database, project ID, OAuth callbacks, storage and provider credentials.

## Known implementation questions

The draft SQL is **not production ready**. Multi-tenant policies, verified invitations, ownership transition, soft deletion/versioning, item-level exceptions, and child-specific rules require further design and adversarial tests before applying it anywhere. Do not run it in the existing Supabase project.


## M0E note
The connected QA Daily Brief now stores a development refresh token in per-tab sessionStorage to restore sign-in after a refresh. This is for fictional development data only and must be replaced or hardened before using real information.


## Repository privacy guard

Run `npm run check:privacy` from the repository root before preparing a GitHub upload. This read-only, offline check verifies ignore coverage for expected environment/provider/key/dependency locations and rejects currently tracked environment files or private directories, even if ignore rules now cover them. It prints counts only and does not open credentials, stage files, change Git, or upload anything. `.env.example` remains allowed. The current repository passed with zero unprotected probe paths and zero tracked private files.

This is a path/ignore check, not a secret-content scan or backup verifier. It cannot certify arbitrary source files, archives, old Git history, remote repository visibility, or a future upload as credential-free. Review those separately before publishing; do not assume `.gitignore` removes previously committed secrets.


## Prepared password-protected local recovery copy

`tools/Create-Recovery.command` opens the offline recovery creation tool in a local Terminal. `tools/private-recovery.mjs` defaults to a plan and accepts only interactive hidden password input for creation/verification. No actual recovery archive has been created during preparation. It requires at least 16 characters and confirmation; the password must be kept separately by the owner and never put in chat, environment variables or command arguments.

The kit protects the existing local key and provider/development credentials with scrypt-derived AES-256-GCM encryption. It does not back up database rows or create a new encryption key. It verifies a decrypted round trip and exact disk bytes, writes only a new private file outside the repository, and never overwrites or restores active files. Source files must be private and unlinked; sizes/paths/counts are bounded. Wrong passwords/tampered files fail authentication. `--verify <file>` checks a private original kit without restoring anything.

The default destination is this Mac's private `Library/Application Support/Curated Chaos/Recovery` folder. This local copy does not protect against loss/failure of the Mac or losing its password. Separate protected storage, database backup, disaster recovery and production key management remain incomplete. Keep kit and password separate; do not upload either without an explicit destination/approval.


### Recovery creation status update

The owner created the local encrypted recovery copy. A metadata-only check confirmed one nonempty owner-private original archive in the expected directory. Its contents/password were not opened or requested by the agent. This supersedes the earlier preparation-only status. It remains on the same Mac; it is not a database backup or off-device disaster-recovery solution. A separate later password-based verification remains available through the local tool.


### Saved-provider backup boundary

`tools/backup-saved-providers.mjs` is offline by default. One 46-copy creation was separately owner-approved and verified on November 8, as recorded below. Its explicit approval is limited to one encrypted Mac-local backup of 46 existing owner-private provider copies (9 email metadata, 3 accounts, 29 transactions, 5 Mac events) in the private recovery folder. It excludes login credentials, provider connection grants, email bodies, deleted/QA rows and all other app records. It does not refresh providers, mutate databases, restore records or upload files. Complete payload whitelists and authenticated nested envelopes reject unexpected credential/body fields before export. The existing provider key is reused without rotation; the password-protected key recovery archive must be retained separately with the snapshot. Same-Mac copies do not protect against losing that Mac. Backup archives are ignored by Git and detected if already tracked. Automated tests use invented records only; another real backup requires a fresh approval.


The approved real archive `badc7990-6c0c-4718-a9c0-74408aec5f5d.ccsnapshot` was created under the private recovery folder's ProviderSnapshots directory and exact-reread verified with 46 records. A metadata-only follow-up confirmed a nonempty regular file owned by this user with mode 600. The operation made no provider refreshes, database writes, restores, key rotations or external uploads and did not include login credentials or connection grants. This is a narrow Mac-local saved-provider backup; retain the separately password-protected key recovery archive and do not describe it as a complete database/app backup or external-device copy.


### Read-only restore preview

`tools/preview-provider-restore.mjs` defaults offline and accepts only the exact same-owner/development-project backup identity and bounded record count. Its explicit preview reads existing records by archived IDs and reports missing, matching, conflicting or blocked copies without restoring anything. Deleted or moved records are not silently resurrected; a newer revision with unchanged content is preserved. Re-encryption alone does not create a false conflict. The tool has no write/apply route or executor. Canonical private file checks and authenticated archive/source payload checks precede any result; output contains counts only.

The real 46-copy archive was authenticated and compared read-only on November 8: all 46 already present, zero missing/conflicts/blocked, zero database/file writes or provider refreshes. This is comparison/recovery-read evidence only. An actual insert-only restore, new-project identity mapping, broader app backup and disaster-recovery exercise remain unimplemented or unverified and require their applicable separate approvals.


### Prepared insert-only recovery boundary

A separate server-only recovery executor is now implemented but not exposed by a user-facing restore endpoint or the read-only preview CLI. It requires explicit write authorization, a one-use owner/session review and current-copy revalidation; it never updates, upserts, undeletes or hard-deletes records. Any conflict/block stops the entire batch. Original revisions and save timestamps are checked in acknowledgements and rereads. Late session forgetting/expiry cancels pending insertion, and uncertain writes are never automatically retried.

A new QA archive mode requires an exact matching fixture run and QA payload/origin markers. Default real backup inspection and restore preview reject it. The two-record hosted drill is prepared only; it uses an in-memory fictional archive, preserves unrelated records and cleans only its own verified fixtures. Existing real backups were neither opened nor modified, and actual restoration of personal copies remains separately gated. No production recovery or full database disaster-restore claim is made.


The separately approved hosted recovery drill `8ffd7e21-70b5-44c0-afce-dbec519c6993` passed on November 8 and both fictional records were reversibly removed with reread verification. Encryption, original save times, independent-account privacy, duplicate-free retry and changed-copy blocking were verified in the isolated development database. No real archive was read and no actual personal-data restore was performed. This bounded acceptance does not establish full database or cross-project disaster recovery.


### Prepared active-session check (not applied)

Supabase access tokens can remain valid after sign-out until expiration. Following the official [session guidance](https://supabase.com/docs/guides/auth/sessions), migration 004 checks whether the verified JWT's session_id and sub still match auth.sessions. It returns only a boolean. The security-definer helper has an empty search path, validates UUID text before casts and exposes no arbitrary lookup parameters. Public/anonymous execution and direct authenticated table access are not granted. The exposed invoker wrapper is authenticated-only. No record policies or existing records are changed.

The local private-connection gateway can opt in using --require-active-development-session and --session-check-project=EXACT_DEV_PROJECT, only after the migration and separately approved hosted acceptance pass. All login/bootstrap and existing protected-route checks then consult the helper; missing/failed checks deny access. Existing post-await session-map/expiry checks prevent late responses after local sign-out. This option remains disabled; it does not retrofit all development screens, alter session timeout settings, revoke every device or establish production authentication. A session row that still exists is not proof of every possible timeout policy.

Account preference drafts now stay only in memory through failed/uncertain saves. Sign-out clears drafts and appearance/navigation state, and generation checks discard late responses. Unconfirmed writes require an explicit latest-load review before another save. No production preference authorization or unique owner-row constraint is claimed.


### Actual session-check acceptance / prepared database enforcement

Migration 004 was separately approved, applied and accepted on November 8. Both new temporary test logins were closed; the revoked session was denied while the other remained active. Local private connections now run with the active-session and exact-project flags. This does not yet require the check on direct workspace/database requests.

Prepared migration 005 adds restrictive ALL policies to cc_profiles, cc_households, cc_household_memberships and cc_records. These combine with existing permissive owner/household policies rather than replacing them; lack of a matching session denies authenticated access. No table grants, existing records or source refreshes are added. The helper's SECURITY DEFINER function reads authentication sessions; privileged database administrators/service roles still bypass application RLS by design and are not used by these browser clients. Local synthetic SQL tests pass, but hosted policy application/acceptance remains pending a new approval. Production authentication, per-device management, maximum-timeout enforcement and removal of per-tab refresh tokens remain release gates.


### Database session enforcement acceptance · November 8

The separately approved migration 005 and hosted two-login read-only acceptance passed. Revoked-session direct record access is now blocked by restrictive policies on the four app tables, in addition to existing owner/household rules. Both temporary logins closed. No existing records or live policies changed. A positive B login status and unchanged bounded record identifiers were verified; this is not a complete positive read/write test for every endpoint or a production session-management certification.

Dashboard layout reads/models/updates now exclude tombstones and shared scope. Uncertain saves retain drafts, block repeat writes until explicit latest-load review, and require matching normalized content in acknowledgements and rereads. The separately gated one-row hosted widget test remains prepared only. Fictional layout test cleanup must match its exact ID/owner/type/origin/run marker/version; it never edits unrelated rows or hard-deletes anything.


### Widget hosted acceptance and settings draft boundaries

The separately approved one-layout development test passed (run d626cc20-eae0-49aa-b3ad-df202c60c48a); its exact fictional row was soft-deleted and both temporary logins closed. Daily Brief Settings now preserves account navigation rather than resetting omitted controls, retains drafts on errors, blocks uncertain repeat writes until explicit latest-load review and ignores late responses after logout. A one-record fictional preferences acceptance is prepared offline only and requires fresh approval; no real preference update has been made.


### Preferences acceptance and prepared uniqueness boundary

The separately approved one-record preferences acceptance passed (b401cffd-6dc6-45b2-a5d5-6e07ac0e78a6); its exact fixture was reversibly removed and both new temporary logins closed. A later aggregate read-only check found no active private settings/layout duplicate groups, without exposing owner IDs or payloads.

Prepared migration 006 adds only a partial unique index for one active owner-private settings row per supported type. It is not applied. This guards concurrent first creation; browser version checks still protect subsequent edits. It grants no access, changes no row policies and does no duplicate cleanup. Restoring a deleted settings row while another active copy exists will be rejected; no automatic replacement/overwrite is intended. Offline PostgreSQL tests pass. Future fixture writes must respect this uniqueness rule rather than bypass it.


### Active private settings uniqueness installed

The separately approved migration 006 was applied November 8 and verified read-only as unique/valid with the intended owner/type and active-private predicate. No records were changed or removed, and no fixtures/logins were created. This closes concurrent first-save duplication at the isolated development database boundary; version checks remain necessary for later edits. Restoring an older deleted settings copy alongside an active one is intentionally rejected. Production database untouched.


### Prepared owner-private workspace archive · November 9

The new .ccworkspace format is separate from .ccsnapshot: it may contain arbitrary saved owner-private cc_records payloads, including notes, tasks, layouts/settings, source ciphertext/metadata and tombstones. No household-shared rows or other accounts are accepted. Owner/project identity and all record content are encrypted under AES-256-GCM with distinct authenticated context; key rotation is not performed. It preserves original revisions/timestamps and has a 2000-row/5-MB plaintext/8-MB file cap. File creation is exclusive mode 600 under canonical private directories; exact authenticated reread is required and no prior file is overwritten. Git privacy checks cover its suffix.

The prepared CLI defaults offline and requires a new explicit approval/exact development project. It makes read-only keyset-paginated record requests twice and refuses mismatches; matching reads are not a transactional full database snapshot. It verifies an active temporary owner login before export and closes it afterward, wiping the operation's key buffer even on failure. No record writes, real-provider refreshes, external uploads or restore endpoint exist. It does not read credential files/connection grants, but ordinary user record payloads are copied without a secret-content detector. Excluded profiles, memberships, auth accounts, storage/schema and other users require separate backup strategies. Actual export is unapproved/unexecuted; all tests use fictional data.


### Actual private-workspace backup result · November 9

The separately approved export completed: 129 owner-private records (including tombstones and saved source copies) encrypted in archive 2116bd95-0964-4fc0-84dd-dae3d2a8dc89.ccworkspace under the Mac's private Recovery/WorkspaceSnapshots folder. Exact authenticated disk reread and mode 600 passed; temporary login closed, key file unchanged, database/provider writes/refreshes zero. No restore was attempted. This does not establish full-database recovery, broader workspace restoration or protection from losing the Mac. The one-export approval is finished.


### Read-only workspace recovery comparison · November 9

The real 129-record archive was authenticated and compared read-only: 129 unchanged, no missing/conflicts/blocked/current-only, zero app-record/file writes or provider refreshes. Temporary login closed. This uses the existing authorized private-record review scope and does not execute a restore. Comparison output is counts only; missing items need review, archived deleted items are never revived, and current-only items are never removed. Nested provider ciphertext changes are conservatively treated as conflicts.

The new two-record workspace drill is prepared only. It has no real-archive input or real-key loader, accepts only exact development project/run/two-fixture flags, and generates fixed fictional task/note rows with a new in-memory key. Writes require separate owner approval. Insert acknowledgement/reread checks preserve original metadata; privacy is checked under account B, then exact QA rows are soft-deleted with reread verification and both temporary logins close. It is not a production restore executor or proof of broader app dependencies, shared records, cross-project identity mapping, unique settings recovery or full database disaster recovery. Offline PostgreSQL and fake-network tests pass; hosted execution is pending.


### Workspace fictional recovery acceptance completed

Separately approved hosted run 8e3ef286-dcfb-4086-80c7-df81c7503240 passed November 9. Original metadata, second-account privacy, unchanged repeat comparison and changed/deleted-copy protections verified. Both fictional fixtures were reversibly removed with reread verification and both temporary logins closed. Real backup/key/provider reads zero; existing records/security rules/live app untouched. No actual personal-record restore or full-database recovery certification is implied.


### Prepared server-held workspace sessions · November 9

The new in-memory server component retains upstream tokens in the trusted server process and returns only opaque handles/CSRF metadata/safe user fields. Hashed handle lookup, bounded capacity/lifetimes, active-session verification, single-flight renewal and post-await session checks prevent tested resurrection/read-disclosure races. Logout/disposal locally invalidates first and attempts upstream local-scope revocation; late renewed credentials are separately revoked. JavaScript memory clearing cannot guarantee byte erasure of immutable token strings. Backend outages fail closed; no write callback is offered.

There is no HTTP adapter, cookie, browser integration or new public endpoint yet. Therefore this does not remove existing per-tab browser refresh tokens, enforce HTTP CSRF by itself, provide multi-process durable sessions or certify production auth. The CSRF check is a server primitive for a future transport to invoke. Protected-read callbacks are trusted server code, not arbitrary browser-supplied functions or a proxy for unapproved writes. The authentication-only hosted verifier is prepared offline; two new existing-account logins/one actual renewal/closure require a fresh approval. It accesses no app records, real source, backups or encryption keys.


### Actual server-session authentication acceptance

Separately approved hosted test passed November 9: two temporary existing-account logins, one coalesced upstream renewal, revoked login blocked and independent login active; both logins closed. No app records read/written, real source or backup/key access, public endpoint, UI or live app changes. Browser token handling remains unchanged until a separately verified transport/browser integration exists. Approval is consumed.


### Isolated loopback cookie transport · prepared real acceptance

The separate private-session preview serves only login/status/logout and its fixed HTML/JS/CSS under /auth/workspace on exact loopback 5312. HttpOnly Strict context cookies are opaque, host-only, path-scoped and bounded; upstream credentials/vault handles are absent from response JSON. POST requires exact Origin, JSON, a custom request header and bound context CSRF. Rebinding Host, cross-site/same-site-but-not-same-origin Fetch Metadata and other Origin values are rejected. Responses are no-store, frame-denied and use self-only script/style/connect CSP. Login attempt/context caps and expiry timers bound state.

Logout/cancel invalidates pending login sequence before asynchronous work; late authenticated vault sessions are revoked without response-cookie issuance. A context CSRF binding stays stable through login to avoid a completion/cancel race; vault session handles are separate. This is not a production fixation/rotation design certification. Inactive/ambiguous browser contexts cannot mutate active sessions. There is no generic data proxy, credential-file route or app record endpoint.

HTTP without Secure cookies is permitted only for this exact loopback-only development adapter. Production requires HTTPS/Secure transport, deployment/session durability and review; none is deployed. The current workspace still uses its legacy per-tab session because this adapter is isolated. Fictional browser proof passes; the real two-login HTTP acceptance requires new approval and is unexecuted. The fictional preview process was stopped after testing.


### Actual private cookie transport acceptance

Separately approved hosted HTTP test passed November 9: cookie attributes and origin/CSRF checks verified, logout cleared the browser context, independent login stayed active, upstream credentials not returned. Both new temporary logins closed and preview service stopped. No app-record/provider/backup/key access, existing UI integration or live app changes. This does not complete production authentication or remove legacy workspace per-tab tokens. Approval consumed.


### Opt-in private settings read over isolated cookie transport

Only GET preferences is added, default disabled. Owner ID/access credentials come exclusively from the server session. Foreign/shared/tombstoned rows reject the response; supported settings are normalized and whitelisted without raw record identity/payload or secret fields. Active-session checks surround the read and context/sequence checks prevent late disclosure. POST preferences and generic record/proxy routes remain unavailable. No display preference is treated as permission or OAuth authorization.

The optional browser panel loads on explicit click, inserts values via textContent, clears data on logout/pagehide/expiry and ignores stale responses. No browser-storage credential/record cache is added. Browser fictional read/clear proof passes. The current app's legacy auth/screens remain unchanged; this is a separate loopback-only read bridge with no writes or production deployment. Real two-account preferences-read acceptance remains unexecuted pending new authorization; fake HTTP failures close both new sessions.


### Actual private settings read acceptance

Separately approved hosted test passed November 9: two authenticated owner-scoped preferences reads with supported saved rows in both accounts, signed-out access denied, credential fields absent from responses and cookie/origin/CSRF/logout checks passed. Both temporary logins closed and service stopped. No record writes/provider/backup/key access or existing workspace/live app changes. This remains a read-only isolated bridge, not full app authentication integration.


### Reviewed preferences writes · prepared real acceptance

Only explicit save-enabled cookie preview instances accept review/save POSTs, behind the existing Origin/CSRF/JSON/Host protections. Proposed edits are limited to palette/density/hideAmounts display fields. Other supported settings and unknown payload extension fields are preserved. HMAC base tags bind current owner/record metadata/content; one-use five-minute reviews bind to the cookie context. Approval uses the server-only write primitive with pre-write authorization/session checks and database owner/version/tombstone/uniqueness guards; no arbitrary data proxy or browser token return is added.

Late logout before write authorization cancels it. A write already sent may have completed; the implementation does not promise rollback and reports uncertainty without automatic retries. The UI retains drafts and requires explicit discard/latest-load before another save after uncertainty. Review/acknowledgement/reread fields and payloads must match before success. Default transport is still read-only and the old workspace is not migrated.

The new hosted density acceptance is prepared only. It intentionally modifies one EXISTING development test-A preference row twice, restoring the density VALUE but advancing version/save metadata. It cannot create new settings and caps its update attempts at two on the same owner/record. Restoration refuses unexpected concurrent preference changes; if it fails, inspection is required and the temporary density may remain. Both temporary logins/service are closed in finally. Real execution needs a new approval; all current write demonstrations use fictional data.


### Actual reviewed density save result

Separately approved hosted test passed November 9: two guarded updates on one existing development A settings row, original density VALUE restored and reread verified, B unchanged and used review replay blocked. Normal version/save-time increments remain. Both temporary logins closed and service stopped. No provider/backup/key/security-rule/live app changes. This accepts the isolated reviewed-save bridge only; existing workspace authentication remains unmigrated. Approval consumed.


### Opt-in cookie Daily Brief read

Default-disabled GET /auth/workspace/brief has no write counterpart or arbitrary query proxy. The owner comes from server auth, with checks before/after the read and context checks after verification. Its REST request explicitly restricts owner/private/null household/undeleted/task-note-event types and projects only required JSON fields, excluding note bodies and whole payloads at the database response boundary. Up to 2000 records may be scanned with keyset pagination; out-of-order/repeated IDs or an exceeded cap fail closed.

The read model rejects foreign/shared/deleted/duplicate identities, counts unsupported development rows, caps each displayed group at 20 with full counts and strips record IDs/payload/credential fields. New York calendar date and saved-read checkedAt are explicit; no provider refresh or real connected-source inclusion is implied. The UI uses textContent, explicit load and clears private items on logout/pagehide/expiry. Fictional browser clearing and late logout/upstream revocation tests pass. Real two-account read acceptance is pending new approval; existing workspace legacy auth remains unchanged.


### Actual private Daily Brief read acceptance

Separately approved hosted test passed November 9: two authenticated owner-scoped list reads (37 and one saved task/note/event records), signed-out denial and cookie/origin/CSRF/logout protections verified; note bodies not requested, upstream credentials not returned. Both new temporary logins closed and preview stopped. No writes, preference/provider/backup/key access, schema changes or live deployment. Existing app auth remains unmigrated; approval consumed.


### Opt-in private dashboard task completion

The private dashboard server can separately enable reviewed task completion; default remains read-only. Browser capabilities contain no record identifiers or upstream credentials and are bound to the current private account/context. Reviews expire after five minutes and are one-use. Fresh targeted reads and optimistic version guards prevent stale saves; only the completion fields change while unrelated payload fields survive. Success requires an exact acknowledgement and reread. Revocation after a write begins cannot undo a committed update; uncertain results instruct a fresh read and never trigger automatic retry. No general task editing API or live deployment is introduced. Hosted completion acceptance requires separate database-write approval.


### Optional selected-note reading in private dashboard

`--allow-private-note-read` requires the isolated private dashboard/Brief and defaults off. Display-list queries remain body-free. Server-memory capabilities authorize only displayed supported private notes for the same context/owner/version, expire within five minutes and are cleared by a new Brief or logout. A selected read checks exact note identity, scope, version, title, fictional marker and a 100,000-character body bound. Only title/plain text/read-only status/expiry reach the browser; text is escaped. Both upstream session and capability are rechecked before response. No arbitrary IDs, full-payload reads, note edits, provider access or AI processing. Browser close/offline/pagehide/hidden-tab/sign-out/expiry clears text; visibility restoration rechecks the session without reopening note text. Actual note-body acceptance is separately authorized and capped at one A note, with B/signed-out denial, count-only logs and two-login cleanup.


### Reviewed private note edits (default off)

`--allow-private-note-edit-reviewed` additionally requires note reading and the isolated dashboard. The server resolves only a current owner/context-bound displayed-note capability, then fetches its full private snapshot to preserve unrelated payload fields. Browser proposals contain only capability/title/body and are bounded to existing editor limits. The displayed version/title must still match; one-use review, current capability, active session, exact preflight snapshot and owner/private/section/type/version PATCH guards precede any write. A matching acknowledgement and reread precede success. Late sign-out cannot undo an already committed write; uncertain outcomes are disclosed and never automatically retried. Existing drafts remain in page memory after failures, locked until discard/latest; hidden tabs, sign-out and note-view expiry erase drafts. No real hosted writes are enabled by preparing this feature. The gated acceptance tool can write only one newly marked fictional note, checks exact cleanup and refuses fixture identity collisions; it requires explicit database-write approval.


### Reviewed private task creation (default off)

`--allow-private-task-create-reviewed` requires the isolated dashboard and Brief. Proposals accept only title/date/section. Server-owned UUID/owner/private scope/type/origin/fictional payload cannot be supplied by the browser. Preparation is non-writing; reviews are context/owner-bound, one-use and expire within five minutes. Approval rechecks upstream session and uses INSERT only, then validates exact private scope/payload and rereads the same record before reporting success. Primary-key collisions fail without overwrite; no upsert or automatic retry exists. A late logout cannot undo an already committed insert, so uncertain responses are explicit and lock the retained browser draft pending latest-record review. Hidden tabs/sign-out erase drafts. The gated verifier assigns a named server-only fixture ID through dependency injection, refuses existing identities, permits one exact fictional insertion and reversibly cleans only its known private origin/payload/version. It requires a new database-write approval; existing task completion approvals do not authorize this new hosted creation drill.


### Reviewed private task edits (default off)

`--allow-private-task-edit-reviewed` requires the isolated dashboard/Brief. Only displayed supported incomplete tasks receive opaque owner/context/version-bound edit capabilities (at most 40 displayed due/upcoming rows; five-minute lifetime). A proposal accepts only capability/title/date/section. Fresh private-record reads validate displayed revision and fields; the exact full snapshot is retained server-side for optimistic preflight and unrelated-payload preservation. A one-use review changes payload title/date and section only; completion, subtasks and extension fields are preserved. Active-session checks, owner/private/type/version guards, exact acknowledgement and reread are required. Changed/deleted/shared/completed tasks, arbitrary IDs/fields and review replay fail closed. Late sign-out cannot undo an already committed update; uncertain responses lock and retain browser drafts without retry until discard/latest. Hidden tabs/sign-out clear drafts. Hosted acceptance is separately approved and permits only one newly marked fictional task, with exact cleanup and two-login closure; prior completion/create approvals do not authorize an edit drill on existing records.


### Passive checks and cross-tab clearing

Private dashboard tabs use a same-origin BroadcastChannel carrying only ended/changed event types. A peer event clears account content/drafts/reviews immediately and invalidates pending client generations; it neither transfers credentials/identities nor revokes a different login. Recheck is explicit. Unsupported channels fall back to visibility restoration and visible/not-busy 60-second passive checks. Passive `/auth/workspace/check` does not create anonymous contexts, access app records, issue a replacement cookie or extend idle time. It verifies the existing vault owner/session and returns safe metadata/deadline; failures retire the context and expire its cookie. Verification coalescing allows concurrent active work to extend idle time, while passive checks alone cannot keep a session alive. Slow checks cannot bypass idle/absolute expiry. A failed/changed-owner check clears private UI and drafts without replaying writes or fetching records. No production session transport or original app migration is implied.


### Shared preview screens and explicit local launcher

The separate sign-in/settings preview now participates in the same event-only BroadcastChannel and passive verification as the dashboard. Peer/hidden/expired/failed checks clear sensitive UI and pending drafts, while explicit retry verifies current sign-in. No account identity, credential or record content is broadcast. The Mac launcher starts a new exact-project loopback service only; it cannot attach to or replace an occupied service. Browser opening is a separately explicit startup flag after successful bind. It enables reviewed controls but performs no automatic app-record mutation, provider refresh, backup/key access or sign-in. Actual owner use/sign-in/display of saved records is an access decision; every manual record save remains subject to its visible review and explicit approval. This is development preview access, not a live deployment or a completed production authentication migration.


### Local repository content guard

`node tools/check-repository-privacy.mjs --scan-content` checks working Git candidates and index blobs locally without uploading or changing Git. Protected credential/recovery paths are counted by the existing filename guard and never opened by the content scanner. Symlinks, unsupported/encrypted/malformed archives and size limits block successful certification. ZIPs are inspected in memory with depth/entry/expanded-byte bounds, not extracted. Results contain counts/categories only; matched credentials and private archive entry names are excluded. Recognized token/key/JWT patterns are deliberately limited; skipped binary files, encoded/obfuscated data, unknown credential formats and outside-repository copies are not certified secret-free. No claim of exhaustive secret detection is made.

### Stable public preview assets

A newly started private preview captures only the explicit public static asset allowlist once. It cannot serve subsequent source edits, newly added assets or credentials through that snapshot. Host/Origin/CSP/no-store and startup symlink checks remain in place. This is a consistency boundary, not production deployment/version management. Activating it in an already-running owner preview requires a coordinated restart; current drafts/sign-in must be handled with owner readiness first. Current owner process remains untouched until approval.


### Reviewed note creation and separate staging cookies

`--allow-private-note-create-reviewed` requires private dashboard/Brief/note reading and defaults off. Browser proposals contain only title/text; server supplies identity/ownership/private scope/origin/type. Non-writing review, active-session checks and one-use five-minute approval precede INSERT only; exact acknowledgement and same-ID reread precede success. No upsert, overwrite, generic fields or automatic retry. Uncertain responses retain and lock temporary drafts; sign-out/hidden tabs clear them. Existing note reading/editing remain separate authorities.

Only optional `--preview-port=5313` is allowed besides default 5312. Staging uses `cc_workspace_staging` rather than the owner cookie, since HTTP cookies are not port-scoped. The staging process ignores the owner cookie and never replaces/expires it. Origin/Host checks and BroadcastChannels are still exact-origin, so staging events do not clear owner tabs. This prevents local QA from interrupting the delivered preview. Actual database QA still needs explicit bounded approval and cannot be inferred from fixture-mode isolation.


### Private title search (default off)

`--allow-private-title-search` requires the isolated dashboard/Brief. POST `/auth/workspace/search` accepts only a bounded nonempty query and whitelisted type/section filters under existing CSRF/origin/session checks. It reads only the established private task/note/event metadata projection. Search matches normalized titles only and returns whitelisted display fields with full match count and a 50-result limit. Unsupported records are disclosed; the 2000-record source limit fails closed. No note bodies, generic payloads, IDs, provider reads or writes are enabled by search. Active explicit queries update idle expiry; background checks remain passive. Late/failed/foreign/signed-out results are withheld/cleared. A separate read-only A/B acceptance uses staging cookies and never alters the owner preview. Enabling the new UI in the existing owner service requires coordinated restart readiness.


### Search-note read capabilities

Search metadata remains body-free. With note reading enabled, only displayed note results receive opaque read capabilities from a separate 50-entry pool; the Brief retains its own default 20-entry pool. Both are owner/context/version/title-bound and five-minute bounded. A new search clears its old pool; Brief refresh/logout clears both. A composite server-only resolver selects the current pool for note reads and reviewed edits; no browser IDs or arbitrary read targets are accepted. Session/capability checks withhold late text after invalidation, and existing optimistic edit checks/payload preservation remain required. Search does not itself load bodies or grant a write. Bounded hosted acceptance creates/reads/edits/removes only one newly marked fictional note, never existing note text, and requires separate approval. This behavior is not active in the existing frozen owner process until a coordinated restart.


### Reviewed actions on searched tasks

With existing task edit/completion authorities enabled, only incomplete displayed search tasks receive short-lived opaque actions from separate 50-entry search pools. Brief pools retain default 40-entry bounds. Token/review resolution selects the originating pool server-side, then enforces owner/context/revision/current snapshot and existing one-use approval/preflight/version/acknowledgement/reread requirements. Completed results receive no actions. A new search invalidates older search handles; Brief refresh/logout clears both. Search is blocked while a save is being verified. Edits cannot silently change completion/subtasks/extension payload; stale completion handles after an edit reject. No automatic write retries or arbitrary record IDs/fields are added. Hosted combined acceptance is capped to one newly marked fictional task, one edit/one completion and exact cleanup; it requires explicit approval. Current frozen owner runtime is unchanged until coordinated restart.


### Read-only private appearance

`--allow-private-appearance-read` requires the private dashboard/Brief and defaults off. It projects palette/density plus exact owner/private/undeleted/type/section/version/source markers, not the full preferences payload. The read model allows one supported row or explicit defaults, rejects foreign/shared/deleted/duplicate rows and sanitizes palette/density to fixed allowlists. API unavailability produces a marked default only if final session verification succeeds; unknown private scope is never silently accepted. Browser application is generation-bound, write-free and reset on sign-out/hidden/session clearing. No source permissions, navigation, amounts or quiet-hour settings are read/applied through this path. Dedicated A/B acceptance prints counts/booleans only and cannot combine with write/body/provider modes. Activating appearance in an existing frozen preview requires owner-ready restart/sign-in.


Reviewed appearance editor checkpoint (911 local tests): browser-visible preferences are limited to palette/density; unrelated raw settings remain server-side and are preserved exactly. Review/cancel do not write, approval is expiring and single-use, and uncertain saves are not retried. Fictional browser review/save/sign-out passed. The prepared two-login development acceptance toggles and restores only existing account A density, advancing its version/save time; concurrent changes halt restoration. Hosted execution and current private preview restart remain pending explicit approval.


Upcoming workspace events (920 local tests): same owner-private Brief projection, only future title/day/time, first 20 sorted with full count; no provider snapshots, event descriptions, note bodies or source identities. Fictional browser and fake two-account acceptance passed; real read-only staging acceptance and private-preview activation remain pending approval. Current owner runtime 93764 stays unchanged.


Saved-title browsing checkpoint (923 tests): explicit task/note/event type may browse without query; all-type blank query denied. Same private owner projection, capped 50 display results, no automatic note text. Prepared `--verify-title-search` acceptance now performs eight minimal metadata lists across two temporary logins (one query and three browse types per account), closes both, and writes nothing. Hosted run and private-preview restart remain pending fresh approval; historical two-read scope is superseded for this tool. Owner runtime 75695 unchanged.


Completed-task display (926 local tests): same private Brief projection, completed title/day/section only, capped 20 with full count, no action handles. Local expansion preference clears on account/session clearing. Fictional browser accepted; real staging read-only validation (two Brief lists plus two appearance reads/two temporary logins) and owner-preview restart remain pending explicit approval. Current owner runtime 6576 stays untouched. No new record writes/schema/provider scope.


Task status filters / clear checkpoint (929 tests): explicit tasks may filter all/open/completed before counts/caps; non-task status filters fail. No additional payload fields or completed-task write handles. Clear search is local display clearing, not record deletion or a provider operation. Prepared title-search acceptance now uses 12 metadata lists (six per temporary account) and closes both logins. No appearance/preferences/note text/providers/backups/writes. Real run and owner-preview restart are pending fresh approval; runtime 24984 remains untouched.
