# Canonical School recovery

The server-only workspace restore executor now recognizes supported private saved School programs/courses. It is not enabled through HTTP, CLI, the owner launcher or a hosted database adapter. Its write authorization defaults to denied. This foundation is verified with fictional encrypted archives and isolated embedded PostgreSQL; no owner archive, records, credentials or database were changed.

## Eligibility and exact dependencies

Restore retains existing cc_records IDs, ownership, versions, creation/update microseconds and complete payloads. Known saved School fields must validate under the existing M2E_SCHOOL_QA private/fictional source contract. Absent legacy schema or schema1 is accepted; future schema, malformed data, deletion or archived state is refused. Unknown payload/nested extensions are preserved verbatim without normalization.

An inserting course whose degreeId is empty remains explicitly unassigned. A nonempty degreeId must resolve to an active supported private degree belonging to the same owner, either already present or in the exact insertion batch. A similarly named degree is never substituted. Foreign, deleted, malformed and non-degree targets are refused. Existing rows are never relinked or repaired. The preview reports unsupportedAcademicAssociationCount and cannot issue executable approval when that count is nonzero.

Existing archive conflict, tombstone, revision, unsupported-type and relationship gates remain intact. Missing ordinary project/task or project/project relationship rows remain blocked because their insertion triggers can change existing target revisions. School support does not authorize those relationships.

## Concrete review and recovery procedure

1. Use a verified authenticated destination for the same archive owner and target project. The trusted connection adapter must verify the target, authenticated JWT owner and active session. Administrator/service-role connections remain refused. Production activation requires a separate review and approval.
2. Prepare the bounded encrypted archive against the complete current private inventory. Review missing insertions, unchanged/newer/current-only rows, archived deletions and all blocked counts. No unsupported/conflicting/dependency-bearing archive receives executable approval. The default archive bound is250 records and the configured maximum is2000; larger recovery remains a separate release gate.
3. Explicitly approve the short-lived, session-bound one-use review. Inside one transaction, take the conflicting table lock, re-read the entire inventory and recheck its exact digest and academic associations. Revalidate session and write authorization before insertion.
4. Insert only reviewed missing rows. Verify the exact returned records, then the complete resulting inventory. Every pre-existing row must remain exact, including unrelated current-only records and tombstones. Recheck authentication before commit.
5. A failed transaction rolls back the insertions and trigger side effects. An uncertain or lost commit acknowledgement consumes approval and never retries. Inspect current records and prepare a fresh review; do not claim that a possibly committed insertion rolled back.

Disabling this additive eligibility path prevents School insertion without modifying existing records. Recovery tests use temporary in-memory encrypted archives and embedded databases closed after each test. No archive/key material should be printed, committed or placed in browser fixtures.

## Verified November17 checkpoint

All2,380 local tests pass, with zero failures/skips/cancellations, plus privacy/content/whitespace/launcher checks. Six focused eligibility/dependency checks and nine isolated embedded PostgreSQL workflow checks cover same-batch course-before-degree and existing-degree recovery, exact entire-inventory digests, missing/foreign/deleted/non-degree/title-only target refusal, malformed/future data, expired/replaced sessions, denied writes, stale inventory, bad acknowledgement, one-use approval and rollback of actual inserts plus trigger side effects. Existing ordinary relationship gates remain blocked. Independent review found no required fixes.

No browser workflow is applicable because this executor has no exposed interface. The116 existing automated desktop/narrow browser cases are unchanged and not claimed executed here. Embedded databases and temporary fixture archives close with their tests. No actual/provider/schema/production change, owner restart, hosted CI, branch switch/reset/publication, spending or deployment occurred.

This bounded foundation does not establish full disaster-recovery readiness. Real authenticated destination wiring, complete domain/relationship recovery, external storage/Auth/session recovery and separate-device acceptance remain required by RELEASE_CHECKLIST.md.
