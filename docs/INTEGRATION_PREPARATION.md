# First real-source integration work package

Prepared November 8, 2026. This is implementation preparation, not a claim of a connected account or a production-ready integration.

## Calendar increment completed locally

`server/google-calendar.mjs` is a server-only read adapter, outside the local static-server allowlist. Nothing calls it automatically. No OAuth app, endpoint, token store, database persistence, provider account, or deployment was created or changed.

The adapter accepts a verified app owner, an explicitly granted calendar identifier, and a server-held access token. It makes GET requests only to Google's fixed Calendar API origin, rejects redirects, reads every page before accepting a snapshot, bounds the window/page/event counts, and rejects inconsistent duplicates or partial failures. Output contains only private source identity, title, status, and timing; credentials, attendee details, descriptions, conference information, and provider error bodies are excluded.

Timed events use explicit RFC3339 offsets and are normalized to UTC instants. All-day events preserve date-only values and the exclusive end date. Offset-less times are deliberately rejected; interpreting timezone-only local event times is not implemented. Recurrences are expanded by the provider within the bounded query window. This is a full-window reader, not incremental sync or a webhook implementation. An eventual sync coordinator must replace only the successfully read selected-calendar/window snapshot, handle removed/cancelled events, and record freshness after persistence succeeds.

Eight mocked adapter tests cover authorization gates, nonpublic source code, daylight-saving offsets, all-day boundaries, owner/calendar-scoped deduplication, pagination, minimal output, provider errors, inconsistent reads, and invalid/oversized time ranges. No real Google account was accessed.

The implementation follows Google's [Events list reference](https://developers.google.com/workspace/calendar/api/v3/reference/events/list) and [event resource reference](https://developers.google.com/workspace/calendar/api/v3/reference/events). Initial permission is `calendar.events.readonly`; any later calendar write capability needs its own explicit consent and approval design.

## Integration boundary to implement next

1. Verify the Curated Chaos user on the server; never trust an owner ID or calendar grant supplied solely by the browser.
2. Bind an OAuth consent attempt to that user with a short-lived, single-use state value and an allowlisted callback. Recheck current identity when completing it.
3. Keep provider tokens in server-only encrypted storage with per-user authorization. Do not reuse the development browser session storage pattern for provider tokens, and do not expose administrative Supabase keys to the browser.
4. Let the owner explicitly select calendars and email capabilities. A display preference is not provider consent.
5. Show disconnected, connecting, loading, current, stale, permission-denied, and reconnect-required states accurately. A failed refresh must not advance last-successful-sync or publish a partial snapshot.
6. Keep imported facts separate from suggestions. Email-derived tasks/events require review; finance remains read-only. Untrusted provider text is data, never executable instructions.
7. Test with fictional provider responses, then obtain approval for isolated OAuth settings, credential storage/schema changes, test hosting, and one real account connection. The original app and provider grants remain untouched.

## Email provider selected

The owner selected **Gmail**. This chooses the implementation priority; it does not authorize a live mailbox connection or OAuth scopes.

- Gmail/Google Workspace: Google's [Gmail scope documentation](https://developers.google.com/workspace/gmail/api/auth/scopes) classifies `gmail.readonly` and `gmail.metadata` as restricted. Requirements for the intended private/personal deployment must be evaluated before transmitting or storing mailbox data. A narrow application filter does not itself narrow the underlying OAuth permission.
- Outlook/Microsoft 365: Microsoft's [Graph permission reference](https://learn.microsoft.com/en-us/graph/permissions-reference) documents delegated `Mail.Read` for the signed-in user's mailbox, including personal Microsoft accounts. Work/school tenants may impose additional administrator restrictions.
- iCloud Mail: provider feasibility and supported authorization must be researched if selected; no support is claimed yet.

No email scopes, mailbox access, provider fees, or live-source sharing have been approved by choosing an implementation priority. Those stay separate, concrete approval gates. Supported read-only finance integration and advanced cross-app intelligence remain in the first-release scope; neither is silently removed by starting with Calendar.

## Gmail implementation prepared locally

`server/gmail.mjs` implements a metadata-first read adapter. It requires a trusted grant bound to the app owner and connection, the Gmail read scope, and an explicit nonempty selection of approved labels. Its initial window is bounded to 31 days and 250 messages. Label filters intersect (all selected labels must match). Every detail read rechecks labels, excludes Spam/Trash/Drafts, and enforces exact received-time bounds.

The adapter requests only Subject/From headers and message identity/time/labels. Bodies, snippets, attachments, raw messages, and tokens are excluded. It cannot send, modify, mark read, or delete mail. Full-content appointment/bill/receipt parsing is a later opt-in stage, not claimed complete by this metadata reader. All content remains untrusted data. A failed page or message read rejects the result rather than publishing partial results.

The implementation follows Google's [message-list reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list), [message-get reference](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get), [format definitions](https://developers.google.com/workspace/gmail/api/reference/rest/v1/Format), and [filtering guidance](https://developers.google.com/workspace/gmail/api/guides/filtering). Read-only scope is used because the bounded search query is not available with `gmail.metadata`; requesting metadata format still minimizes the data returned, but does not narrow the underlying OAuth scope.

## Authorization handling prepared locally

`server/google-connection-flow.mjs` orchestrates Google's official OAuth2Client interface, supplied by a future server bootstrap. It does not implement token exchange or ID-token signature verification itself. It uses single-use, five-minute encrypted state bound to an app owner and server session; PKCE; a separate nonce checked against the verified Google identity; exact requested read scopes; and a second session check before saving credentials. The verified library must validate issuer, audience, signature and token lifetime.

`server/token-sealer.mjs` provides AES-256-GCM envelopes with fresh IVs and owner/connection-specific associated data. This protects stored token content from disclosure/swapping; it does not replace authorization or secret management. A future server must obtain the encryption key from secret storage and support key rotation/backup before production use. No key was generated into an environment file or persisted by this work.

There are intentionally no default OAuth client, routes, durable state store, connection store, credentials, or deployment. The state store's consume operation must be atomic across server instances; the in-memory test double is not production storage. Connection completion returns no tokens and requires label/calendar selection before import. Consent can cover a wider mailbox than those application filters; the consent screen must explain that distinction.

Seven Gmail adapter tests and six authorization/encryption tests pass with fictional data. No Gmail message, Google credential, or real OAuth code was read. Existing Google Calendar/production grants were not changed.

## Current external setup gate

The Google Cloud console currently shows initial account setup with country and service terms, before its project list. The owner must review that agreement (or switch to the correct existing Cloud account). No agreement was accepted and no Cloud project, API, OAuth client, scope, billing setting, or redirect was changed. This user action is required before inspecting the available development project setup.

### Setup progress after owner review

The owner completed the initial Google Cloud terms step. Created the separate project **Curated Chaos Development**, project ID `curated-chaos-development`, with no organization. The new project showed no API keys, OAuth clients, or service accounts. No billing/trial activation or changes to the original app's project were performed.

Prepared the app-registration form with the development app name, the signed-in account as support/notification contact, and External **testing** audience (Internal is unavailable for this personal account). The registration has not been submitted. The final form requires a separate agreement to the **Google API Services User Data Policy**; this is left unchecked for owner review. No OAuth client, permission scopes, test-user access, mailbox connection, or redirect has been created.

### Registration verified; OAuth client prepared

The owner completed the separate User Data Policy step, and the console confirmed OAuth configuration creation. Prepared (but did not submit) a Web application client named **Curated Chaos Local Development**, with only `http://127.0.0.1:5301/auth/google/callback` as its redirect. JavaScript origins are empty; the AI-agent option is unchecked. The owner must approve/create the credential and download its JSON without sharing its contents in chat. No client secret was generated/read by the agent, and no Gmail permission has been granted.

Installed and pinned Google's official `google-auth-library` 11.3.3 and its lockfile. It requires Node 22+, reflected in package metadata. The dependency audit reported zero known vulnerabilities at this check.

Implemented `tools/connections-server.mjs`, a separate loopback-only gateway on port 5301. Port 5215 was already occupied; its existing app server was left untouched. The gateway uses a server-verified development app session, short-lived HttpOnly/SameSite cookies, origin/Host checks, CSRF checks, atomic local authorization-state consumption, and private encrypted connection files. It returns sanitized connection status only after rechecking app identity. The public page can sign into an existing fictional development account and initiate a separate Google consent flow; it cannot import source data.

Credential JSON is loaded only from `.local/google-oauth.json` and must contain the exact callback. It is not served by the static allowlist. The local encrypted store initializes new key/record files exclusively with private permissions; existing keys/records are not overwritten. It remains a local development implementation, not production infrastructure or a replacement for durable distributed storage.

Seven new gateway/storage/library tests pass. The full suite passes 301 automated tests. Browser-verified that the unconfigured gateway reports missing credentials accurately. No new database writes, Google API scopes, mailbox access, or deployment occurred during this stage.

### Credential installed and remaining permission gate

The owner created/downloaded the development Web-client credential. One matching download was validated internally against the development project and exact callback, then copied exclusively to `.local/google-oauth.json`; the destination did not previously exist. Both the protected copy and the original download now have owner-only permissions. Credential contents were not printed. Git confirms that the credential and provider encryption key are ignored.

Restarted the separate local gateway with the installed credential. Its configured sign-in page was browser-verified. No Google authorization or data import was initiated.

Google Audience was refreshed after the owner's latest update and still showed Testing with zero test users. Prepared the signed-in account as the sole test-user entry, leaving Save unclicked. In a separate Data Access form, prepared only `openid`, primary-account email, `calendar.events.readonly`, and `gmail.readonly`, leaving the scope update/save unsubmitted. No profile, send, modify, delete, or Cloud-wide scopes are selected. Await explicit approval before saving these access-related settings or enabling the required Gmail/Calendar APIs.

Registering these requested scopes is not account consent. Gmail's underlying read scope is mailbox-wide even though this implementation initially limits imports to selected labels/date windows and metadata. The owner must separately consent to each real account connection; there is still no permission to import live messages or events.

### Approved configuration saved

The owner explicitly approved saving the sole development tester, registering the four requested scopes, and enabling Gmail/Calendar APIs. The Audience save succeeded with one test user. Data Access showed “Data access changes saved!” with only `openid`, `userinfo.email`, `calendar.events.readonly`, and `gmail.readonly`. The app remains in Testing.

Gmail API activation succeeded; its development-project service details showed Status **Enabled**. Calendar API remains disabled: its product page explicitly states that use agrees to Google API and Calendar-specific terms. Those newly surfaced terms are left for owner review before activation. No billing activation, Google account consent, source-data import, live-app change, or database write occurred.

### Calendar activation verified

After the owner reviewed and enabled Calendar, the development-project Google Calendar API service-details page showed Status **Enabled**. Both required APIs are now enabled. This is infrastructure configuration only; no real Google account has been connected, and source-data import remains unapproved.

### Owner completed both Google consent flows

The owner signed into the local gateway using the development app account, then personally reviewed and completed separate Calendar and Gmail Google consent flows. The gateway returned to its sanitized status page and displayed both `google_calendar` and `gmail` as **Authorized; source selection still required**. Provider credentials remain in the private encrypted local store, not in browser-visible status or Git.

No messages or calendar events were imported. Real source selection, import approval, and integration into the app remain outstanding; account authorization alone does not authorize database writes or source-data ingestion.

### Source-selection controls prepared

Added local selection forms for the primary calendar and Inbox, with explicit unchecked source choices and inclusive-start/exclusive-end UTC dates. Server validation rejects impossible dates and windows longer than 366 calendar days or 31 Gmail days. Selection records are appended exclusively, encrypted with owner-specific associated data, and restricted to the verified connection owner. Same-origin/CSRF checks and a fresh app-session verification protect saving. Browser input cannot set import approval; selections always record `importApproved: false`. There is still no import endpoint.

The full suite passes 303 tests, including source validation, cross-owner rejection, CSRF/session revocation, encryption and private file permissions. Browser verification exposed and fixed a stale connection list after server restart: the page now reloads sanitized status after restoring its verified session. Both saved connections and both unchecked source-selection forms were verified afterward. No real source choices have been saved and no Google data has been read.

### Initial source choices saved with owner approval

The owner approved saving the primary calendar for the next 30 days and Inbox metadata for the past seven days, explicitly without reading or importing data. Saved via the authenticated local forms on 2026-11-08:

- Primary calendar: 2026-11-08 00:00 UTC included through 2026-12-08 00:00 UTC excluded.
- Gmail Inbox: 2026-11-01 00:00 UTC included through 2026-11-08 00:00 UTC excluded; subject/sender metadata only.

Both forms confirmed “Selection saved privately on this Mac. No data has been read or imported.” These are fixed UTC day windows, not rolling sync schedules. Import approval remains false, and no Google resource requests or database writes were made.

### Read-only preview prepared; not executed on real sources

The local gateway now restores source selections from encrypted storage after refresh/restart. It shows the saved dates and separates saving preferences from an explicit **Read selected source preview** action. The browser was refreshed and both original saved choices were verified; no preview button was clicked. An additional unselected Calendar authorization is present and has not been selected or removed.

The preview pipeline loads only the verified owner's exact saved selection, refreshes authorization server-side using an isolated official OAuth client, and calls the bounded read adapters. It rechecks app identity before and after reading and rejects a result if the saved selection changed. Preview output is escaped text, not executable provider content. It returns sanitized metadata/events to the owner in the browser without storing source content or writing to the app database. Tokens stay server-side. This is not an importer, automatic sync, or production deployment.

307 tests pass with fictional data, including restored encrypted choices, cross-owner rejection, explicit-preview approval, stale selections and sessions revoked during a read. No real message or event request has been made. Await owner permission for the first read-only previews of the approved date/source windows.

### First real read-only previews verified

After explicit owner approval for both saved source/date windows, ran each preview via the local browser controls. Calendar completed with **0 matching events**; Gmail completed with **9 matching messages**. Both displayed “Nothing saved to the app database.” The selected windows were unchanged. No source body/attachment reads, Google edits, app-database writes, deployment, or automatic sync occurred. Message subjects/senders and event details were not copied into chat or repository documentation. Saved only a cropped count/status screenshot as evidence.

The successful Gmail preview verifies the first metadata read path against the authorized account; the empty Calendar result verifies a successful bounded request, not real-event rendering. Fictional adapter tests cover nonempty calendar results. The next implementation phase is integrating reviewed source items into the app, with persistence and any database change still requiring a concrete owner-approved plan.

### Local app navigation and pure import planning

My Account and Integration now offer **Manage Google connections** only on local HTTP app origins. The link never probes the gateway or reads provider state. The connection page uses the existing app palette/forms, restores saved choices, and links back to the app. Browser-verified the link from both pages on the connection server and from the already-running app on port 5215. That original app server was not restarted. All 11 route checks passed on the connection server; these are availability checks, not end-to-end persistence acceptance.

`server/google-import-plan.mjs` is a pure, unwired review planner. It requires an explicit item-key selection from a complete owner-bound preview. It produces separate private `provider_email` / `provider_event` proposals, never tasks or inferred actions. Bodies, attachments and credentials are excluded. Deterministic record identities allow repeat-import comparison; conflicts cannot overwrite manual/unrelated records, updates require a known revision, and nothing is deleted automatically. All-day calendar boundaries are preserved. No planner route, database executor, real-content persistence or schema migration is enabled.

312 automated tests pass. The original fictional email/calendar screens intentionally retain their fictional-record guards. Provider records will need separate consumers and an approved persistence design before they appear in those workspaces.

### Connection pause and selection ordering

Added an owner-bound, CSRF/session-protected **Pause connection** / **Resume connection** control for the local gateway. Pausing writes a private local marker and blocks selection saves and preview credential loading, including the rechecks surrounding a read. It preserves encrypted credentials and choices. This is not Google-side revocation or credential deletion; the interface explicitly explains that distinction. Resuming archives the pause marker without deleting previous state. Actual Google-side disconnect/revocation remains unimplemented and has not been performed.

Selection mutations are serialized in the running local server and saved timestamps advance monotonically; rapid saves no longer select a random older record when timestamps tie. This is a single-process development guarantee, not distributed storage locking. Previews now show their read time and state that they are snapshots, not a live feed.

314 tests pass, including rapid-save ordering, obsolete-selection rejection, pause persistence across store reopening, cross-owner/CSRF/session rejection, blocked reads while paused, and credential preservation on resume. Browser-verified the new controls and restored existing choices. No real connection was paused/resumed, and no additional Google source read, database write or deployment occurred.

### Item review implemented without an import executor

Added explicit unchecked item choices and **Review selected items** after a successful preview. The server keeps only a five-minute encrypted in-memory preview, bound to the current verified app session, owner, connection and exact source selection. Review accepts item keys from that cached result, not browser-supplied source records. It rechecks connection/selection/session state and returns only a review summary. Sign-out/session replacement forgets associated previews. The bounded cache expires automatically and is not written to disk or the app database.

The review clearly reports that database comparison and approval are still required; it does not claim items have been saved or checked for database duplicates. The planner is now used by this read-only review route, but no import executor is enabled. Up to 250 selected items are accepted within a bounded request size.

317 automated tests pass, covering session/owner binding, expiry, changed/paused sources, invented item keys and no execution. Browser-tested the complete preview → unchecked item → selected item → review-summary sequence on an isolated port-5302 fixture server with fictional credentials/data and no real provider/database access. Literal script-like source text displayed as text. The fixture server was stopped afterward. No additional real Google reads, connection changes, real-content persistence, database writes or deployment occurred.

### Insert-only persistence prepared behind an unexecuted database gate

Added an unwired persistence executor with separate prepare/approval, five-minute single-use session-bound reviews, fresh comparison before insertion, deterministic source identities, and exact acknowledgement/reread verification. A repeat import is a no-op. Manual/unrelated records and tombstones are never overwritten. Changed source records are returned for review; updates and deletes are not executed. A lost response is reported as uncertain and requires a fresh review instead of automatic retry. Object-key order is compared canonically to match PostgreSQL JSONB semantics.

The development repository uses the caller's authenticated token and exact expected project, batches bounded ID lookups, and performs one atomic bulk insert without upsert. No public route or real-content import UI is wired to this executor. Multiple kinds of insertion and existing-record reads are not represented as one database transaction; an uncertain final reread requires inspection rather than a claim of rollback.

Prepared `tools/verify-provider-import.mjs` as plan-only by default. The proposed approved run would create three labeled fictional provider fixtures and test idempotence/all-day fidelity/account isolation in the separately configured development database. It has not been executed. See DEVELOPMENT_DATABASE_TEST.md for the exact actions and boundary.

### Approved fictional import run and saved-item view

After explicit owner approval, the bounded development import verification passed all 11 checks. Audit run `365ff45c-70b2-4f45-9ddd-ee740e1a4fc9` created three private fictional provider records, verified repeat-import idempotence and all-day boundaries, and confirmed Test Account B could not read or modify them. Fixtures remain for audit; see DEVELOPMENT_DATABASE_TEST.md. No real Google data was saved.

Added a separate **View saved source items** control. It reads only owner-private, undeleted provider snapshots from the development database, validates their identity/type/fictional marker and timing, and returns whitelisted display fields. It makes no Google request and never presents the saved snapshot as live. Bounded pagination rejects partial results. Browser verification displayed the three approved fictional fixtures with explicit fictional labels and preserved exclusive end dates.

### Connection-area app sessions moved server-side

The local connection UI now signs into the development backend through a same-origin server endpoint. The server verifies identity and keeps the short-lived app access token only in memory. The browser receives an opaque HttpOnly/SameSite session cookie and CSRF value, not app access/refresh tokens. Session lifetime is the earlier of token expiry and 30 minutes. Sign-out and expiry remove the server session and associated preview reviews; the UI clears displayed private content at session expiry. Login attempts are bounded. Gateway CSP now allows only same-origin browser connections.

The connection page removes only its exact legacy per-tab development refresh-token entry without reading its contents. This does not change the original fictional workspace session manager, which still needs production hardening. The gateway remains loopback-only development software; no claim of production-ready identity, recovery, persistent session infrastructure, or full app-wide token protection is made.

331 automated tests pass, including whitelisted saved-item display, private/snapshot guards, server-held login, missing/cross-origin/session failures, expiry, rate limits, no app tokens in responses, and same-origin CSP. Browser-tested sign-in/sign-out on an isolated fictional server without real service requests. The updated actual gateway now requires a fresh development-account sign-in before its new session path can be verified with the owner. Google grants and saved source choices are retained; Google re-consent is not requested.

### Updated actual sign-in verified; scoped save flow prepared

The owner signed into the updated connection area. Browser verification showed app sign-in verified, both original source selections retained, and all three approved fictional database fixtures still readable through the server-held session. No additional Google request or database write was made by this check.

Calendar and fictional Email now link to the separate connection/snapshot area rather than falsely claiming Google is wholly unavailable. Their sample editors and record guards remain fictional; provider snapshots are not silently mixed into the calendar grid or sample suggestions.

Prepared the full cached-preview → explicit item selection → fresh database comparison → approved insert flow. Preparation reports new/unchanged/conflicting counts without writing. Changing item choices clears the displayed approval control. Execution is default-denied on the server and requires both an exact server-approved source-selection UUID and an explicit per-run item cap; the browser cannot enable its own writes. Paused/changed selections and session expiry are rechecked before insertion. Prepared save reviews cannot outlive their originating preview. Changed records remain blocked; no update/delete executor is added.

333 automated tests pass, including default-denied writes, changed sources and end-to-end handler checks showing comparison alone cannot save. An isolated fictional browser server verified database comparison and the disabled-save explanation; it was stopped afterward. No actual Google data has been persisted. The actual gateway has not been restarted to enable reviewed writes; it remains running without an approved import scope.

Next requested owner decision: whether to permit the first real metadata-only import for the original Gmail Inbox selection (November 1–7 UTC), at most nine items. This would send subject, sender, received timestamp and source identifiers to the owner's private records in the isolated development Supabase database. Bodies, snippets and attachments remain excluded; no Google modification, Calendar import, automatic sync, schema change or production deployment is included. A fresh preview and review must precede the write; changed counts or selection require review. Do not enable that scope or save content until the owner explicitly approves.

### First real metadata import approved and verified

The owner explicitly approved saving metadata for at most nine original Gmail Inbox messages from November 1–7 UTC to their private development database. Executed the bounded `tools/import-reviewed-gmail.mjs` command with the exact development project, maximum nine items, start `2026-11-01` and exclusive end `2026-11-08`. The tool uses existing development-account credentials privately, avoiding an unnecessary extra browser sign-in. It requires a unique active saved Inbox selection with matching dates, verifies owner/grant/current selection, reads metadata only, stops on excessive counts or update conflicts, prepares fresh database comparison and performs the single approved insert.

Result verified at `2026-11-08T20:34:46.705Z`: **9 matched, 9 inserted, 0 previously saved**. Insert acknowledgements and owner-private database rereads were verified. Subjects, senders, credentials, message identifiers and content were not printed or copied into chat/docs. No body, snippet or attachment reads, Google changes, Calendar import, schema changes, automatic sync or deployment occurred.

A browser attempt to refresh the saved-item panel encountered an expired development session; the updated actual UI list of twelve items was therefore not verified. The database verification succeeded independently. Reauthentication is required only when the owner wants to view the saved results; no further writes or retry were attempted.

335 automated tests pass. The import CLI defaults to a network/credential-free plan and validates the explicit project, item cap and valid bounded dates. Its authorization is not a blanket approval for future imports, different windows or additional sources. The running gateway remains without a general real-write scope; preparing a review does not enable saves. UI capability reporting preserves read-only review compatibility with an already-running older gateway.

### Finance institution selected: Chase

The owner selected Chase. Researched Chase's secure sharing flow and Plaid's current OAuth/trial requirements using official sources. Prepared an unwired server-only read adapter and nine fictional tests; the full suite passes 344. No Plaid developer account, trial/paid plan, bank connection, credential installation, financial-data read, new database write or deployment was performed. FINANCE_INTEGRATION_PREPARATION.md records supported behavior, current access requirements, initial USD/account/window bounds and the next developer-account setup gate. Choosing a bank does not authorize financial data sharing.


## Saved-source Daily Brief available locally

The authenticated local connection page now offers View saved-source Brief. It reads existing private saved snapshots only: overlapping calendar events for the current UTC day, up to five recent email subjects, and financial snapshot counts with no amounts. Actual development acceptance verified nine saved Gmail records and three accounts/29 transactions, excluding QA fixtures. It does not refresh any provider, infer unread/required actions, create tasks or reconcile budgets. A separate private development sign-in is required after gateway restart/expiry. No new provider consent or repeat bank import is needed to view these saved records.


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


### Temporary Mac calendar transfer prepared

Mac-based refresh is the current owner choice. The new transfer build and local gateway routes are opt-in and have only fictional automated transfer evidence. Native snapshots can be explicitly handed to the owner-bound local Brief for no longer than five minutes; the bridge does not persist records or contact an AI service. Calendar selection, local dates, time zone and event cap must match the server-approved scope. The standard helper build has no transfer configuration, and the running gateway remains disabled for this feature. A fresh real preview and explicit owner approval are required before enabling the one-use handoff. Neither ongoing refresh nor cloud iCloud access is implemented by this temporary bridge.


### Bounded real Mac preview acceptance

After owner approval, the initial transfer was rejected for all-day boundaries and no snapshot was accepted. The native helper now converts all-day spans to covered local dates while retaining an already-exclusive midnight endpoint; timed events are unchanged. Compiled checks cover both daylight-saving transitions and final-second endpoints. The owner recreated the five-calendar/five-event selection and the explicit transfer succeeded. The local Brief displayed the temporary snapshot for November 8, with zero events overlapping that day. This verifies the bounded handoff, not month-wide visual accuracy, persistence, unattended refresh or production readiness. Preview expiry and returning the gateway to its default disabled state are the final cleanup checks for this acceptance.


Cleanup confirmed: native and browser preview expiry messages were observed, the private handoff file disappeared, and the local gateway was restarted with real-calendar transfer disabled. A status check confirms the disabled state. No calendar snapshot remains available through this completed one-time session.


### Encrypted storage accepted; real identifier review remains gated

The separately approved two-fictional-record development test succeeded and both QA rows were reversibly removed; see the development database test log. The native helper and local UI now have a separately opt-in temporary identifier-review mode. Raw calendar/event IDs and optional recurrence anchors remain in the local server review, while the browser receives only event display fields and opaque selection keys. Review can compare existing encrypted private development records but exposes no saving endpoint or save button. No real identity-bearing preview has been collected yet. That requires fresh bounded owner approval; actual real-calendar database persistence remains a further approval gate. The original one-message/metadata-only temporary preview approval has already been consumed and is not reused for this wider metadata capture.


### Real review accepted; encrypted real save still awaiting approval

The approved real identifier-review transfer and private saved-copy comparison succeeded for five events: five new, zero already saved, zero conflicts. Browser review expiry, handoff-file removal and server-state clearing were verified. macOS native-window inspection failed at the final expiry check, so native expiry was not independently observed in this run. No real event was saved.

The separately gated real-save path, saved-copy read panel and Daily Brief support are now prepared and tested with invented events in memory. One successful batch of at most five is allowed only with explicit review/save flags and an exact confirmed development project; default mode remains write-disabled. All personal event content and native identities are encrypted together before database insertion; the browser gets display fields only. Future source edits are conflicts, not silent updates; source deletion/moves/recreated identifiers are not an ongoing sync mechanism. Persistent saving of real event copies still requires separate owner approval and a fresh reviewed transfer because the prior five-minute preview expired.


### Five real encrypted calendar copies accepted

The owner separately approved persistent saving of up to five freshly reviewed events in the same bounded selection. Owner completed the native transfer manually when macOS native controls were unavailable. Real review returned five new, zero existing and zero conflicts; the explicit save returned five saved-and-verified copies, then the saved panel reread five.

Read-only raw storage verification confirmed five owner-private encrypted Mac payloads and zero visibility from the second account even with account A's exact IDs and owner scope. No original calendar content or source identifiers were printed. The consumed handoff was removed, the gateway restarted in default transfer/save-disabled mode, and the authenticated saved-copy panel still returned five. No real-calendar save permission remains active for another batch. No source Calendar edits, existing-record overwrite, schema/policy change or production deployment occurred. Automatic refresh is still unimplemented; copies remain snapshots.
