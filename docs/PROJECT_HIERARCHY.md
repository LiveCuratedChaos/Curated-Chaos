# Private project hierarchy — single master

Owner decision, November17: each smaller project has at most one active master project. Tasks can still belong to several projects. Moving a smaller project requires an explicit reviewed unlink, followed by a separately reviewed link. No automatic choice of a master, task copies or manual-status changes.

## Implementation and boundaries

`src/project-hierarchy.mjs` validates complete private graphs, cycles and single-parent identity, preserving retired relationship history. Progress traverses descendants and deduplicates task identities. The root project's repeating-chore option governs its roll-up; task content/status and each project's manual status remain unchanged.

The reviewed server service, explicit API adapter and Project structure panel use owner/session/context-bound opaque selections and five-minute expiry. Writes require exact-origin CSRF, one-use approval, successful current-version preflight and a server-verified acknowledgement/reread. Unknown writes are never retried. A verified hierarchy save advances selected endpoint revisions so the same open panel can fetch its new state without weakening stale-selection checks.

This is a private-project workflow. Household projects and other cross-area placement remain separate release requirements. The owner launcher is unchanged; the hierarchy gate defaults off and is enabled only in fictional browser fixtures during this acceptance.

## Database preparation

Read-only connected metadata identified `curated-chaos-dev-isolated` as the isolated target. Its historical several-parent hierarchy migration is20261116131454. Do not replay the historical base draft on that database. No production project was queried or modified for this work.

`supabase/drafts/private_project_single_master.sql` is an additive tightening of that base schema. It checks all retained active relationships under an exclusive NOWAIT table lock, with three-second lock/twenty-second statement bounds, and refuses existing conflicting masters without changing records. A partial unique index enforces one active parent per owner/child, while the trigger preserves the owner advisory lock and READ COMMITTED rule. Canonical historical parent-child pairs remain retained.

The readiness RPC checks the exact valid unique index shape and predicate, plus enabled single-parent, cycle, endpoint-version and target-protection trigger identities. It is security-invoker with empty search path and authenticated-only execution, and requires an active development session. The API checks literal readiness before every snapshot/write, refusing an older or drifted schema. There are no new tables, provider grants, authentication settings or financial actions.

Before installation, compare the actual existing base schema, verify no conflicts and no active owner transactions, review the exact additive source, run embedded tests and rollback-only synthetic QA, then apply only to the named isolated target. Recheck installed guards/grants and independent cleanup. Actual deployment and owner-app restart remain approval-bound.

## Recovery and rollback

Project removal is refused while any incoming/outgoing hierarchy edge or task membership is active. Explicit unlink preserves projects/tasks and retires only the chosen relationship. Restoring project content does not reactivate retired relationships. Archives validate the single-master graph; an archived or combined restore candidate introducing a second active master is blocked rather than silently rewritten. Original archive bytes remain preserved for reviewed reconciliation.

The additive inverse draft refuses every retained hierarchy relationship, including retired history, before removing any protections. It requires an administrative role, READ COMMITTED isolation and bounded NOWAIT exclusive locking. A stale repeatable-read snapshot must never authorize rollback. The historical base inverse is separate and must not run before safely handling the additive objects. Neither inverse runs automatically.

If retained relationships exist, keep schema protections, disable the feature gate in the application and prepare reviewed recovery rather than dropping guards or deleting history. Preserve earlier uncommitted Calendar/recovery edits when reverting source; never restore whole shared files indiscriminately.

## Acceptance evidence and remaining gates

The previous frozen local run passed1,925 tests plus privacy/content, whitespace and launcher checks. Interactive fictional browser acceptance verified reviewed linking, second-master refusal, explicit unlink/reparent, same-token refreshed structure, task deduplication, cycle refusal,390px no-overflow layout and sign-out clearing. Temporary fictional browser sessions/tabs/server were closed. Standalone Chromium remains sandbox-denied; configured browser tests are prepared but are not claimed passed by discovery/manual checks.

Review then identified rollback isolation and readiness schema-drift hardening; those fixes are now being tested. A rollback-only synthetic QA generator and actual isolated database acceptance are still pending. No hosted migration or owner launcher change has occurred at this checkpoint. Final evidence must supersede this paragraph before promoting the release checklist row.

## Completed isolated development installation — November17

After all1,930 frozen local tests and privacy/content/whitespace/launcher checks passed, applied only the reviewed additive source to `curated-chaos-dev-isolated` (`fngauurauwvbawlfzbbe`). Hosted migration:20261117192954 `private_project_single_master`. Reviewed source SHA256:ec51beba6081e96a76f702ccd9425c1bf5659760027111c447322c078ef875a0. The historical base migration was not replayed. Source remains in drafts as the reviewed deployment input; the ledger entry and this checkpoint identify its actual isolated installation.

Before applying: existing base function body digests matched local reviewed source; RLS enabled; zero conflicting masters and no other active transactions. Installation used NOWAIT exclusive locking with3s/20s bounds. No relationship or personal record was rewritten.

`projectSingleMasterPolicyCheck()` passed first in embedded PostgreSQL, then on that isolated target. It used exactly10 fresh fictional records and2 temporary session rows under the two established development identities, no passwords or usable login tokens. It asserted API/direct single-parent refusal, cycle/self/stale/foreign/missing-session boundaries, explicit unlink/reparent/canonical history, parent/child removal protection, shared-task deduplication and unchanged task/direct membership/manual-status snapshots. A deliberate nested success rollback plus outerROLLBACK and separate cleanup query confirmed remaining_qa_records=0 and remaining_qa_sessions=0. Existing private record bodies and provider data were not read.

Post-install metadata: unique active-parent index valid, all hierarchy guards enabled, record RLS still on. New function digests matched reviewed source (readiness ffc8481fbe0859073b0759e38a4f1c1c; trigger a786a59b41b730203e4e4001760b7872). Both are invoker with empty search path; readiness grants only authenticated client execution, internal trigger is not client-callable. Security advisor reports only its pre-existing leaked-password-protection warning; no Auth settings changed.

This completes the bounded isolated schema/rollback-only acceptance, not final release. Actual JWT/device/browser use, genuine simultaneous multi-connection contention and standalone automated browser execution remain separate gates. The owner launcher and app runtime were not activated/restarted; no production, provider refresh, credentials/backup read, GitHub run/publication, purchase or deployment occurred. The inverse rollback was not run on hosted data.

## Canonical task browsing integration — November17

The task panel now offers explicit inclusive subproject browsing using a complete validated sparse graph. Direct-only remains the default. Shared tasks count once; inherited-source counts are visible, while membership reviews only alter the selected root. Selected task details reuse the existing protected read service on demand without task copies. Full local acceptance is1,973/1,973 plus privacy/content/whitespace/launcher. Fictional browser verified inheritance, exact detail read, root link/unlink preserving child links, search-independent progress,390px layout and sign-out clearing. See PROJECT_TASK_LINKING.md for boundaries and remaining device/automated-browser gates. No further database migration or owner launcher activation.
