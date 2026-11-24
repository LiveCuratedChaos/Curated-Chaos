# Database recovery acceptance

Updated November 15, 2026. This document records release requirements and fictional offline evidence. It is not an executable hosted recovery procedure.

## Verified offline checkpoint

`tests/full-database-recovery.test.mjs` builds an isolated PostgreSQL-compatible PGlite database from every numbered repository migration. It contains fictional users, sessions, private records, household memberships, section grants and a preferences record. It exports the complete in-memory engine data directory, closes the source engine, and starts a different engine using only that snapshot. No migration replay or record reseeding is used on the restored engine.

The test verifies exact record metadata/payloads and policy definitions, actual private/household read isolation, blocked membership escalation, section-write restrictions, record identity/version triggers, unique active-settings protection, the session-check function and anonymous denial. This proves recovery of this isolated engine and its fixture security model. It does not prove Supabase Auth, managed roles/extensions, hosted storage, files, deployment secrets, or a hosted PostgreSQL backup/restore path.

A complete authentication snapshot can contain sign-in sessions that were revoked after the snapshot was taken. The drill first confirms the restored session function works, then invalidates all fictional restored sessions while the environment is quarantined. All three old identities/sessions are denied; only a newly created fictional session regains authorized access. Production session invalidation must use the supported identity-provider process and must be verified before reopening. This test does not implement that production process.

`tests/household-current-policies.test.mjs` additionally tests every current migration together: write permission implies read only within its section; read-only sections cannot be edited; household ownership does not expose another adult's private records; members cannot elevate grants; departing members lose access even to records they contributed to the household; their independent private records remain theirs; reactivated membership with empty grants restores no old section rights; missing/revoked/wrong-owner sessions cannot read records or membership metadata.

## Hosted recovery release gate

Before treating database recovery as complete:

1. Identify the backup source, exact app/database revision, recovery point, integrity checks and compatibility requirements. Keep encryption-key recovery separate from encrypted data archives. Existing selected-record archives are not full database backups.
2. Prepare an isolated restore destination with no outbound email, provider refresh, scheduled jobs, public traffic or production credentials. Preserve the existing database. Review storage/cost/access choices before provisioning.
3. Restore using a supported hosted procedure, including necessary schema, policies, functions, triggers, indexes, roles/grants and required file storage. Determine which identity components are restored independently. Do not assume repository migrations or selected-record exports cover managed services.
4. Invalidate restored sign-in/recovery sessions and one-time grants before reopening. Confirm old credentials/cookies cannot regain a revoked session, and separately verify fresh authorized sign-in/recovery. Do not disable the app's session guard to make a restore appear functional.
5. Run owner/account/household privacy checks, section write-denial checks, anonymous denial, version protection and duplicate protection against disposable fictional records in the restored environment. Verify deleted records remain deleted and real row counts/metadata reconcile without exposing their contents in logs.
6. Confirm required encryption keys can decrypt an explicitly authorized sample; verify provider secrets and scheduled work remain disabled until separately reviewed. Never include plaintext keys in test output or the repository.
7. Record measured recovery point/time, failed checks, rollback route and acceptance. Promotion/cutover is a distinct live change. Keep the old environment until owner acceptance and retention requirements are satisfied.

## Still outstanding

No hosted full restore, production session invalidation, managed Auth/storage restore, real-key decryption acceptance, measured disaster recovery objective or cutover has been performed. Existing iCloud copies and selected-record recovery drills remain useful separate protections. The new offline tests do not close these hosted release gates.


## November 17 linked recurring-task engine acceptance

`tests/project-recovery-engine.test.mjs` additionally creates a fictional recurring task linked to two projects, completes it atomically, and reviews an unlink on its successor. A full embedded-engine snapshot is restored without migration replay. Exact rows, task text, reset checklist, active and retired memberships, unique retired-link slots, stale-version protection and replay without reconnection are verified. Restored old sessions are invalidated; a fresh authorized session regains access while another account remains denied. Ten combined engine/storage tests pass. This uses no real accounts, keys, hosted databases or network listeners and does not close the hosted restore gate.

## November17 single-master full-engine recovery acceptance

Extended the existing snapshot recovery drill to install the exact hierarchy base/additive sources in an isolated fictional engine, create active and retired master relationships plus one task shared by master/child, export the complete engine and restore into a different engine without migration replay or reseeding. Exact rows, graph snapshot, deduplicated progress and single-master readiness survive. After quarantining all restored sessions, old sessions are denied; a fresh owner session can read and a fresh foreign session sees no private graph. Restored guards refuse second-master relinking and linked-project removal. Explicit unlink/reparent preserves canonical relationship identity/creation time, retired history, exact task contents and stale-version refusal.

Latest frozen local acceptance: **1,974/1,974 tests passed**, zero failures/skips/cancellations; privacy/content, whitespace and launcher checks pass. This adds embedded-engine recovery evidence only. It does not create a selected-record restore executor or complete hosted Auth/storage restore, genuine concurrent connections, physical-device acceptance or cutover. No hosted database, owner app, real records, providers, credentials, backups or spending were touched by this recovery drill. R03/R15 remain Partial. The approved full release remains unfinished; the authoritative workflow rows retain all remaining scope.

## November17 bounded atomic archive-restore foundation

Added a server-only restore executor, conservative ordinary-record contract and authenticated SQL transaction adapter, reusing existing encrypted archive inspection and comparison. Supported missing notes, manual nonrecurring/nonapproval tasks and private projects can be restored with exact payloads, original revisions and creation/update timestamps, including PostgreSQL microseconds. Two complete inventories bind review; one-use owner/session authorization, default-denied destination verification/write permission, conflicting NOWAIT table lock, bounded SQL/idle timeouts, exact acknowledgement and full reread protect existing records and reject stale/uncertain/revoked actions. No upsert, overwrite, automatic retry or trigger bypass exists.

Existing active links update target revisions on insertion, so missing relationship recovery remains explicitly blocked. Missing archived tombstones are skipped and reported as skipped, never claimed restored. Unknown/dependency-bearing types remain unsupported; no feature is removed from the approved release. No owner UI/CLI, actual connection factory or real-archive access was enabled. This is an integrated encrypted-review/transaction foundation verified with a fictional engine, not a complete user-facing/full-archive restore workflow.

Read-only independent review found no critical integrity defect in the bounded path; its reporting correction and destination-verifier hardening are incorporated. Genuine concurrent connections, actual destination identification, short noninteractive authorization/connection lifecycle, relationship/history restoration, review UI and hosted Auth/storage recovery remain release gates. See PRIVATE_WORKSPACE_RESTORE.md for the concrete contract and recovery/rollback boundaries.

**Final frozen acceptance:1,993/1,993 local tests passed**, zero failures/skips/cancellations, plus privacy/content, whitespace and launcher checks.19 focused executor/repository tests include complete embedded-PostgreSQL encrypted preparation/insertion/reread/commit, exact six-digit timestamps, rollback after induced trigger side effects, preservation of newer/current-only records, foreign/expired/admin denial, lock lifetime, unknown/missing target verification, duplicate clicks, preparation/save/commit revocation and lost acknowledgement without retry. No new UI needs browser acceptance in this batch; earlier standalone browser restrictions and device gates remain.

No hosted schema/data, actual private record/archive/key/credential/provider access, app restart/launcher activation, branch switch/reset/publication, CI run, purchase or deployment occurred. Source rollback removes only the three unreferenced restore server modules and two new tests; existing records and shared Calendar work require no reversal. R03 remains Partial. Next independent dependency: extend protected universal search beyond its currently supported task/note/event types using existing project foundations, while keeping full recovery gates explicit.

## November 22 private documents and receipts

A document-inclusive workspace archive uses the existing key and a versioned encrypted envelope. The optional backup flag is `--include-documents`. The counts-only comparison requires `--documents=COUNT`. Each archive is bounded to 100 documents and 23 MiB of file-envelope text. Existing record-only archives retain their original size and format.

In isolated PostgreSQL, the separately enabled restore executor compared authenticated originals twice, required exact owner and source permissions, rechecked its plan in the destination transaction, and restored original ciphertext, metadata revisions and record links together. Tests covered conflicts, missing bank sources, rollback after a file insert and denial to another owner. Hosted recovery and an owner-controlled separate-device drill are still pending.
