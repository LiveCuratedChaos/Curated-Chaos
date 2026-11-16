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
