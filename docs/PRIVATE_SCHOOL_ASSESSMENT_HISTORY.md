# Private assessment attempt logs and rubric versions

Prepared local workflow for R27 and R12. The full release remains unfinished. The new SQL package is uninstalled in hosted environments; no owner feature activation or live schema change is authorized by this document.

## Existing workflow reused

The selected original course opens through the existing School editor. The academic editor uses its existing opaque assessment/view/edit selections, explicit change review, one-use approval, optimistic source revision and post-save reread. Metadata, official/study order, credits, course/assessment status, steps, program association and unknown source fields remain independent of the log and rubric. Result text is a user-entered fact, not an official grade or an instruction to complete a course. The optional attempt date differs from the application's recorded timestamp.

Existing attempts are retained. A follow-up log entry can clarify an earlier result without replacing it. Its server-resolved reference must point to an earlier entry in the same assessment; browser requests use opaque attempt selections, and read-only replies show the original position/label without UUIDs. Rubric changes append a version; earlier text remains readable. Reusing an earlier version fills a draft and requires a fresh review/approval, producing a new revision while preserving later history. Draft-only attempts can be removed before approval. No saved attempt or rubric revision is permanently removed by this workflow. General correction/Undo, retention cleanup, document-based rubric imports, program milestones and broader release history remain required work, not features deferred outside the release.

## Additive source contract

An assessment may contain `learningRecord` with `version: 1`, `rubricVersions` and `attempts`. Each stored entry has a server-generated UUID and canonical `recordedAt`. Attempts store label, optional date, result text and notes. Rubric versions store exact text. Existing source IDs and unknown outer fields are preserved. The common identity inventory reserves history IDs across active and archived assessments.

Bounds: 20 attempt entries and 20 rubric versions per assessment; rubric text 12,000 UTF-16 units; attempt label/result 120 each; notes 2,000; complete course payload bounded to 512 KiB. Capacity refuses additional writes without discarding records. Exact duplicate attempt facts are refused. A different result, date, label or clarification is a distinct log entry.

Public selected-course replies expose history fields without stored UUIDs. Editing views issue opaque attempt tokens for immutable existing entries and allow null tokens only for new draft attempts. Title search and progress discovery remain sparse. Read-only School/common project/original-course views escape the selected history. Rubric/attempt controls are enabled only when the server verifies the history protections. Missing/unverified protections leave the existing academic edit workflow available, without pretending history editing is ready.

## Storage and rollback protections

Prepared package: `supabase/drafts/private_school_assessment_history.sql`; inverse: `supabase/drafts/private_school_assessment_history_rollback.sql`.

Installation requires the reviewed recovery guard, bounded table locks and existing School prerequisites. The package adds no table and rewrites no data. History validation covers active assessments and complete removed-assessment snapshots. Existing entries must remain an exact prefix, under the original assessment. Current source updates accept only fresh appended log timestamps. Historical inserts remain supported for exact authenticated recovery; inserts are still subject to existing School/RLS/source validation. Encrypted workspace recovery explicitly blocks history-bearing courses until destination protections verify, repeats the proof under its table lock and refuses direct insertion without them. Historical attempts and multiple rubric versions retain exact IDs, text and timestamps.

The dedicated `update_private_school_assessment_history` operation obtains a table lock before verifying readiness, confirms the active owner/session and exact original source revision, preserves all fields outside the academic whitelist and writes within the same transaction. This closes the gap between a separate readiness probe and a later REST patch. Old versions, unrelated metadata, foreign records and malformed history are refused. Existing ordinary academic edits continue through their current writer.

Readiness binds the newly installed function bodies, execution permissions, volatility/search path and enabled trigger to the reviewed package, plus existing School recovery readiness. The inverse refuses while any stored record depends on assessment history. It never deletes records or strips protections from surviving history. Closing an isolated test database is its cleanup; do not run either script against a live database without explicit approval and the release recovery procedure.

## Verification boundaries

Acceptance includes model/identity/source-preservation checks, actual isolated PostgreSQL trigger/RPC/RLS/version tests, existing assessment removal/restoration, rollback refusal, schema drift, CSRF/session HTTP review/save/reread, UI review and uncertain-save draft retention. The authoritative latest totals and evidence are maintained in `RELEASE_CHECKLIST.md` and `verification/LOCAL_RELEASE_CHECKS.json` after the milestone suite finishes.

Prepared desktop/narrow browser cases are not fresh executed browser acceptance. True simultaneous PostgreSQL connections, hosted installation, real-data adaptation and physical Apple-device acceptance remain unverified. Do not infer release completion or a new completion percentage from passing tests.
