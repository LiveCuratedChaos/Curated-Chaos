# Architecture and delivery contracts

Date: November 9, 2026. Status: implementation contracts for review, not a deployment or migration authorization.

This document keeps the full approved blueprint binding. It defines interfaces that parallel implementation branches can share without rebuilding accepted components or repeatedly changing the integration layer. Historical completion evidence stays in `COMPLETION_PLAN.md`; a passing development test is not production certification.

## 1. Architecture principle and ownership

Use one application service boundary for all workspaces, with domain modules behind it. Browser controllers call a same-origin application client; they do not hold provider renewal credentials or construct privileged database requests. Reuse the current pure models and tested review/version/privacy primitives. Compose the existing saved-source and private-workspace read models instead of creating another disconnected Brief.

Prefer a modular application and durable worker boundary over separate miniature servers for each feature. Hosting must support the selected session, secret, scheduling and job durability requirements. This principle does not select, purchase or establish access to a hosting product. A persistent Node service and a serverless design with external durable state are possible implementation choices; the current in-memory loopback servers are not production deployment artifacts.

The integration lead owns authentication, shared record contracts, database migrations, route composition and final integration tests. Workers own assigned domain modules, adapters, controllers and tests. Changes to a shared contract require lead review before dependent branches implement competing versions. Each batch records its baseline commit, owned paths, dependencies, acceptance scenarios and integration commit.

## 2. Shared authentication and authorization

### Browser/application client

- Expose typed operations such as `session.status`, `records.list`, `tasks.update`, `documents.prepareUpload` and `approvals.execute`. Avoid an arbitrary REST/SQL proxy.
- Return safe identity/session metadata and authorized domain data only. Provider tokens, refresh credentials, service keys and internal vault handles stay server-side.
- Preserve exact-origin/request protection, CSRF validation, no-store rules, cancellation generations and cross-tab clearing. Production transport requires HTTPS and appropriate Secure cookie configuration; loopback HTTP behavior is not copied unchanged.
- Provide one consistent result/error format. A failed background session check clears private views without extending idle time or replaying writes.

### Server actor

The server derives an actor from a verified session: account identifier, session identifier, authentication time/strength, device context where supported, and current authorization state. Client-provided owner, household, role, guardian or lock-state fields never establish authority. Every service validates permissions at execution, not merely when a page or review was opened. Database RLS remains an independent enforcement layer.

Private records belong to their adult account owner. Household ownership never confers access to another adult's private records. Household grants, item exceptions, section locks and child restrictions must apply to list/detail reads, search, Briefs, widgets, jobs, notifications, files and exports through the same authorization service. Visibility filtering in a controller is defense in depth only.

### Durable sessions

Reuse `private-workspace-sessions.mjs` verification, renewal coalescing, idle/absolute deadlines, cancellation and uncertain-write behavior. Replace process-local state as the sole production authority with a defined durable session store. Its interface must support create, inspect, atomic renewal/version change, per-session revocation, account-wide revocation, expiry and device/session inventory. Store renewal material encrypted under managed server-side key custody with a documented restore/rotation process. Never log it.

Restart and concurrent-worker tests must prove revocation, renewal races and deadlines behave consistently. Add stronger reauthentication contracts for critical actions and the approved recovery protection period. A valid access JWT alone is insufficient where the app requires immediate session revocation enforcement.

## 3. Typed record contract

Define a versioned domain envelope before migrating every workspace:

| Field | Contract |
|---|---|
| `id` | Stable server-assigned identity; importing an original identity requires an explicitly authorized mapping. |
| `kind`, `schemaVersion` | Registered domain schema and validator, with explicit compatibility/migration rules. |
| `ownerId`, `householdId`, `visibility` | Server-validated scope; scope transfers use dedicated workflows, not ordinary patches. |
| `section` | Supported workspace classification; changing it rechecks relevant permissions and locks. |
| `revision` | Monotonic optimistic concurrency token controlled by storage. |
| `createdAt`, `updatedAt`, `deletedAt` | Verified timestamps and tombstone state; restoration is a distinct action. |
| `payload` | Validated typed fields; ordinary updates preserve unrelated fields and extensions. |
| `provenance` | Origin and source links described below; not a grant of access. |

Keep the existing generic records table where useful. Add relational constraints/tables for identities, memberships, jobs, approvals, files and other lifecycle entities where required; do not assume arbitrary JSON provides those invariants. Domain migrations need preview, validation, rollback and the existing approval gates.

Retain fictional fixtures and QA markers. Several current normalizers intentionally require `fictional === true`; do not simply remove these guards or relabel development records as real. Introduce a validated production data classification and adapter/migration contract, while preserving fixture-only tests. The shared transport migration must preserve completed business validation, source identities and record relationships.

## 4. Provenance, freshness and inference

Each externally derived record or suggestion carries its connection/source identity, external item identity, source version/cursor where available, fetched-at time, relevant source event time, imported-at time, permission scope and derivation references. Store only fields the consented capability requires. Source consent and app-record ownership are separate checks.

Distinguish provider freshness, saved-copy time and successful app-record reads. A recent database read does not mean a bank or calendar refreshed. Unknown, stale, disconnected and incomplete states remain visible. Inferred dates, amounts, matches and predictions are labeled as such.

Brief/narrative generation consumes authorized read models with supporting record references. Generated assertions must retain their supporting sources and uncertainty. Do not authorize an external model to receive private source content merely because an adapter or metadata import exists. Source data, attachment text and model output are untrusted input, never instructions granting actions.

Reuse the provider import plans, stable source identities, sealed repositories, `snapshot-freshness.mjs`, `saved-source-brief.mjs` and local-day/DST handling. Add durable refresh orchestration, consent revocation, cursor reconciliation and a shared source registry around those modules.

## 5. Commands, revisions, idempotency and errors

Every mutation defines its actor, target scope, allowed field changes, expected revision, authorization strength and retry semantics. A successful response identifies the authoritative resulting revision. Optimistic conflicts return a conflict result with a safe path to compare/reload; they never silently overwrite newer state.

Use a durable operation identifier for retryable commands. The idempotency key is scoped to actor and operation, bound to the normalized request fingerprint, and returns the original outcome for a matching replay. Reusing the same key for different content fails. A new intentionally duplicated item is a separate user operation; do not deduplicate solely by title or date.

Review nonces are short-lived, single-use authorization artifacts bound to actor/session, target snapshot, proposed fields and expiry. They complement durable operation idempotency; they are not its substitute. Revalidate scope/revision/session immediately before execution. Where an operation creates both a record and approval/audit history, commit them atomically. Queue downstream effects through a transactional outbox rather than assuming an external call shares the database transaction.

Normalize errors to a small contract: unauthenticated, reauthentication-required, forbidden/locked, invalid-input, conflict, review-expired, rate-limited, dependency-unavailable and outcome-unknown. Include a safe operation identifier and whether an explicit read/reconciliation is required. Exclude credentials, private payload fragments and another tenant's existence. An uncertain response must not claim rollback or trigger an automatic repeat insert/update.

Reuse accepted task/note/preferences review services and acknowledgement/reread tests. Consolidate shared mechanisms in measured batches without weakening domain-specific invariants or replacing tested behavior wholesale.

## 6. Direct user editing versus AI/provider actions

The approved product distinguishes ordinary user editing from consequential automation:

| Action origin | Intended product behavior |
|---|---|
| Direct user routine field edits | Autosave after validation, with visible saving/error/conflict state, Undo and version history. User intent and authorization must be explicit in the command. |
| Direct user high-risk or irreversible action | Confirmation and stronger reauthentication where required; never treated as an ordinary autosave. |
| AI/provider-derived modification | Default Ask Before Applying; show sources, proposed changes, uncertainty and approve/edit/dismiss options. |
| Explicitly authorized low-risk automation | Automatic only for its defined capability/scope; authorization is checked again at execution. |
| Email-derived task/event/job-application changes | Approval remains mandatory under the current blueprint. |
| Ownership/guardian transfer, permission escalation, account deletion, sensitive sharing/export | Dedicated verified workflow, strong reauthentication and protected audit; never eligible for generic Automatic execution. |

Current preview screens deliberately require review for ordinary saves. Do not silently change that behavior in the running preview. Implement and validate the production autosave/Undo contract as a coherent UX/storage batch, then activate it through the applicable owner acceptance process. Preserve reviewed flows for AI/provider-origin commands. An editor must not disguise a suggestion as a direct-user command to bypass approval.

Undo is a new authorized, revision-guarded operation, not an unrestricted restoration of old bytes. If another edit or external effect intervenes, show a conflict or explain why undo is unavailable. Preserve previous versions and the approved Recently Deleted policy; retention jobs and privacy deletion exceptions are explicit lifecycle operations.

## 7. Durable jobs, integrations and notifications

Define a job envelope with actor/owner scope, capability, normalized input or protected references, consent version, idempotency key, not-before time, lease/attempt state, expiry and safe error metadata. Workers acquire bounded leases, validate current authorization and consent, and record progress durably. Recovery after a crash must not repeat an acknowledged effect.

Use separate interfaces for `source.refresh`, `suggestion.generate`, `approval.execute`, `notification.deliver`, `export.build`, backup verification and retention. A scheduler requests work; it does not bypass a review requirement. Provider writes require their own supported API capability and exact consent, regardless of internal record permissions. Financial connections remain read-only.

Notification delivery rechecks recipient rights, locks, quiet hours and private-preview settings. Store delivery deduplication and support channel-specific failure/retry behavior. Test actual browser/device constraints rather than assuming push, background scheduling or email delivery exists because an event can be queued.

Reuse Google, Gmail, Chase and Mac Calendar adapters and their existing provenance/encryption tests. The Mac Calendar helper remains Mac-dependent under the owner's current choice; independent updates while it is off are not promised. Production OAuth verification, supported bank/broker access, licensed data and provider costs remain external dependencies.

## 8. Offline cache and cross-device synchronization

Define separate interfaces for authorized snapshots, per-device document cache policy and queued direct-user mutations. A queued mutation records operation identity, originating device/session, base revision, source/user intent and dependencies. Reconnect validates current session/permissions before execution. Automatically merge only proven non-conflicting edits; otherwise retain the draft and surface a comparison/conflict workflow. Never turn an offline AI/provider suggestion into an approved command.

Cache metadata includes account/device scope, schema/revision, encryption/key version where supported, expiry, lock requirements and offline-selection policy. No plaintext renewal credentials in browser storage. Device-bound key handling, app/section locks and supported browser storage protections need an explicit implementation and platform tests. Do not promise remote deletion of a device that remains offline or independent copies downloaded to Files/Finder.

The manifest and snapshot freshness model are reusable but do not implement a service worker, durable mutation queue, document cache or realtime subscription. Deliver these as a distinct contract-driven batch with two-client conflict and revocation scenarios.

## 9. Household and guardian interfaces

Define commands for invitation issue/accept/revoke, permission changes, membership removal, ownership transfer, guardian appointment/removal/transfer, shared-task/reward approval and account transition. Invitations are expiring and one-use; joining/rejoining does not restore previous elevated grants automatically.

Separate Household Owner, Household Approver and Primary/Designated Guardian capabilities. None implies another adult's private-data access. Guardian transitions and ownership transfers require the approved verified parties, reauthentication and audit. Removing a member revokes server access and schedules permitted client cleanup; it does not erase that adult's personal records.

Store reward/points changes in a transactionally protected ledger with operation identity, approval, reversal references and anti-double-counting constraints. A visible balance is not evidence of authorization to redeem or donate it.

Reuse current household RLS/isolation tests as a foundation; the present owner/adult membership constraint is not a child/guardian implementation. Real child enrollment waits for the required privacy/consent/compliance gates. No claim that AI implementation alone establishes legal compliance is made.

## 10. Documents, import/export and recovery interfaces

### Documents and imports

Separate document metadata from protected object bytes. Metadata carries owner/household scope, object identity, verified type/size, content/version identity, source/provenance, links to records, retention and per-device offline policy. Access to a linked record does not automatically authorize its attachment; metadata, original bytes, OCR, thumbnails, search and AI classification all enforce the effective permissions.

Uploads have bounded prepare/transfer/finalize operations. Finalization verifies object identity/size/type and access before exposing it. OCR/classification produces suggestions rather than silently changing records or degree plans. Import interfaces provide preview, duplicate/merge decisions, provenance and a revision-aware rollback plan that preserves intervening edits.

### Exports and sharing

An export request specifies eligible scope/filters, format and independent attachment/comment/completion-history/previous-version options. Recheck rights and locks at request, job execution and download. Provide direct download or the approved temporary Export Center, with 24-hour/7-day/30-day retention options and earlier deletion. Expiry removes the prepared export, not source records or previously downloaded copies.

External sharing defaults off. Use explicit expiry/revocation and recipient rules; bearer links do not prove identity and downloaded bytes cannot be remotely controlled. Critical sharing/export actions use the required strong authentication and protected audit.

### Recovery and migration

Reuse encrypted archive, authenticated reread, inventory comparison and insert-only recovery primitives. Extend coverage explicitly to schema, auth identity mapping, profiles, memberships, shared records, attachment bytes and original key custody; current private-record archives do not cover them all. Test off-device recovery and complete restore into isolated infrastructure before describing disaster recovery as complete.

Migration is a dedicated reviewed plan: source inventory, identity mapping, schema compatibility, duplicates/conflicts, selective scopes, dry-run results, final backup and rollback rules for post-cutover edits. Existing app/provider identities and OAuth grants are not ordinary JSON records that can simply be copied. Applying migrations, restoring actual records and live cutover retain their explicit approval gates.

## 11. Delivery batches, decisions and acceptance

| Dependency | Substantial batch | Acceptance before integration |
|---|---|---|
| Secret-checked current baseline | Capture completed public source, contract schemas and test fixtures in isolated branches. | Completed work is present; no credentials/private data included; active owner preview unchanged. |
| Hosting and durable-state design | Shared auth/client/service/error/idempotency layer and durable session/job adapters. | Restart/concurrency/revocation tests; typed domain contract tests; no browser renewal tokens. |
| Shared transport and typed records | Migrate existing workspace cohorts; compose saved-source Brief and reusable widgets/search. | Multi-workspace workflows, provenance/freshness, cross-account/lock tests and preserved accepted behavior. |
| Identity/permission contracts | Household/guardian/document/export lifecycles and offline interfaces. | Adversarial synthetic accounts, atomic transitions, cache/conflict/export rights tests. |
| Source/job interfaces | Durable provider refresh and defined cross-domain intelligence/approval/Undo workflows. | Consented connector acceptance, crash/idempotency tests, no invented data or silent sensitive writes. |
| Integrated features | Responsive/accessibility/device QA, complete recovery and migration rehearsal. | Physical-device scenarios, restore/rollback evidence and explicit owner release acceptance. |

Request owner decisions only where preferences, access, cost or consequential authority cannot be inferred: hosting/service accounts and budget; any additional provider/model data consent; real member/child enrollment; external backup destination/key recovery; and final migration/live deployment. Existing blueprint choices remain binding. The lead may resolve routine implementation details within those choices rather than asking the owner to choose every module or field.

Batch development-database acceptance into a concrete reviewed plan listing fixture count/types, permitted reads/writes, exact cleanup, rollback limits and session closure. This is more efficient than one permission prompt per field, but it does not infer unlimited database authority from a coding request. Offline implementation, synthetic tests and branch integration can proceed independently. Never use a shared live database as a parallel-agent scratchpad.

Each integrated batch provides: changed behavior, reused components, contract/migration differences, automated and browser/device evidence, known limits, rollback/cleanup status, and remaining gates. Test totals alone do not measure feature completion. The lead maintains a scope-to-evidence ledger so accepted modules are reused, unimplemented commitments stay visible, and no parallel branch can silently reduce the agreed product.
