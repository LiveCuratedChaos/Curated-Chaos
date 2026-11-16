# Consolidated isolated development baseline — November 16, 2026

This is the lead-owned current reconciliation record. Full scope remains in APPROVED_BLUEPRINT.md and PRODUCT_SCOPE_LEDGER.md. Historical test counts and pending decisions do not override this record.

## Captured sources

| Source | Exact checkpoint | Treatment |
| --- | --- | --- |
| Latest published cloud candidate | 14e691b811ffd9b1527491c9ddf46627eb65f00e | Canonical private reviewed-workspace implementation; includes post-Safari Calendar lifetime, archive/status work and disposable concurrency verifier. |
| Release-readiness | ee868748301dccd0ec3baed3c982d05be887b3e7 | Captured remote ref; not merged/published by this local task. |
| Owner Mac checkout | 718596e (captured/mac) | Clean source captured read-only; accepted project progress/filter/membership functionality is in the cloud lineage through equivalent published commits. Newer cloud features retained rather than overwritten by older Mac files. Mac completion report retained under docs/history. |
| Earlier isolated integration | 2ef9ee178c62ee7f9b4816b236c3b0bf2e30f2f7 | Imported as merge parent, preserving its complete history. Retained unique durable sessions/jobs/RPC/runtime/deployment and manual workspace/Undo files/tests. Shared private-workspace paths use the newer cloud implementation. |
| Earlier physical Safari acceptance | 25c99365a18d0be2caeaf0a753797ad0cf9820ce | Owner-approved report posted on PR2, comment6923345165. Exact evidence for that pinned source only; not automatically acceptance of subsequent archive/freshness/consolidation changes. |

Original checkout and prior integration checkout were not staged, reset, switched, committed or overwritten. The prepared candidate on5313 remains bound to its existing source snapshot; no process/preview changes were made by consolidation. No private configuration, node_modules copies, keys, provider stores, native app binaries or backups were imported. Existing compatible installed package entries were referenced only for local verification.

## Conflict and compatibility decisions

45 shared-path conflicts were resolved against the newer cloud implementation. Earlier integration-only engine modules and regression tests remain alongside it. package.json retains both browser and local-release commands; current lockfile/dependency versions and stronger private-artifact ignore rules are retained. Historical completion/finance/security reports are separately retained in docs/history. The immutable integration merge parent is the source-level record of every conflicting earlier implementation; preserving history does not claim that both incompatible handlers run at once.

The retained manual workspace (CC_MANUAL_WORKSPACE, fictional:false) has explicit save, operation receipts, guarded Undo/history and its own fixture. The reviewed private workspace uses its established development provenance and supports several-parent hierarchy. These are not silently cross-wired: manual tasks currently have a single project_id, whereas private projects use multiple memberships. No existing records are converted and no fictional guard is removed. Durable production session/job adapters and manual SQL remain unactivated foundations, not hosted readiness.

The initial combined suite exposed a safety-test false positive: the test filename deployment-readiness.test.mjs matched the old blanket /deploy/ regex. The assertion now verifies node --test plus safe direct test paths and separately forbids service/setup commands. Runtime/offline command guards are unchanged.

## Evidence and current limits

Current exact results are recorded in CONSOLIDATION_ACCEPTANCE.json after execution. Initial dependency-free targeted run could not import embedded PostgreSQL and skipped dependency-gated checks; it is not acceptance. After compatible package references were supplied, the first combined full run passed2031/2032, failed only the assertion described above, skipped0. Corrected combined offline run passed2032/2032, zero failed/cancelled/skipped; privacy, whitespace and launcher syntax passed.

Existing private-workspace browser suite passed88/88 on this combined source. Additional desktop/narrow manual-workspace browser journeys cover SQL-backed project/task/checklist creation, completion, guarded Undo, sign-out clearing and uncertain-save draft preservation without retry. All four new cases passed (two desktop, two narrow). These exercise both retained engines without claiming unified production record support.

## Next substantial delivery batch

1. Keep one canonical baseline; do not resume feature work from stale original HEADs or count missing legacy features as new work.
2. Define and test an explicit record/provenance bridge and migration preview between manual Undo/history foundations and reviewed private project memberships, preserving several-parent links, recurrence, project progress preferences and all supported extensions. Ordinary autosave/Undo/history remains open until implemented across that contract; explicit Save is not autosave.
3. Prepare a disposable, rollback-only development acceptance package for any new atomic history/receipt schema after combined offline and conflict/replay tests. Do not apply old draft009 or mixed migration ledgers by assumption.
4. Preserve Apple Calendar refresh OFF. Calendar saved-event freshness tests are app-storage behavior, not a provider refresh. Any real helper/source activation requires its own bounded approval.
5. Complete physical Safari acceptance for changed archive/freshness flows and physical iPhone/iPad at separately available access boundaries. Existing running preview and daily candidate must never be replaced as a consolidation side effect.

Publishing this baseline, updating PR source, merging remote branches, applying schema, reading further real records/providers, starting a new real-data candidate or changing the owner's active app requires its applicable explicit approval. Nothing in passing local checks grants those actions.
