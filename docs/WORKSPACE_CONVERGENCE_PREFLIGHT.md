# Workspace convergence preflight

Local follow-up to consolidation84972cb. It is not a migration, UI switch, new record origin or activation.

`server/workspace-convergence-plan.mjs` accepts an explicitly complete, active, owner-private inventory of at most2,000 project/task/membership/hierarchy rows. It returns counts and constant required-contract descriptions only. Record IDs, titles, descriptions, project targets and checklist text are not returned. It has no network/filesystem/client/schema dependency and is not mounted into any route. No real inventory was supplied or newly authorized by this work.

The preflight distinguishes current reviewed development provenance from CC_MANUAL_WORKSPACE first-party provenance. Unknown provenance is reported as unsupported, never silently relabeled. Shared/foreign/deleted/incomplete/duplicate or invalid identity/version inventories fail closed. It deliberately does not certify domain/graph validity, export completeness, Recently Deleted/history coverage or migration readiness: `domainValidationPerformed:false`, `automaticConversionAllowed:false`, `recordWrites:0` remain explicit.

## Contracts identified before any unification

- Canonical many-project task links and several-parent hierarchy must replace neither engine's records with a single project_id interpretation.
- Preserve recurrence series/history, successor memberships and per-project separate/include progress preferences, including explicit false values.
- Preserve archive visibility and all relationships, without changing manually chosen status.
- Current reviewed project descriptions support10,000 characters; the earlier manual form permits1,000. Do not truncate descriptions in a bridge.
- Manual tasks have Waiting/In Progress/On Hold states beyond binary completion. Existing reviewed task edits must not erase them.
- Unknown payload/subtask extensions require compatibility review; a whitelist cannot silently strip them.
- Explicit identity/provenance mapping, version-preserving receipts/history, atomic preview and rollback remain prerequisites. This preflight does not authorize SQL draft009 or any hosted call.

Four synthetic regressions cover combined-engine preservation and non-disclosing reports, unsupported provider provenance, incomplete/foreign/shared/removed/duplicate/oversized inventories, explicit progress choices and unchanged source objects. No runtime/UI file was changed. Full local offline suite passed2,036 tests, zero failures/cancellations/skips, with privacy/whitespace/launcher checks passing. The previous92 browser cases exercised unchanged runtime code; no further browser rerun is needed for this unmounted pure module plus tests/documentation.

PR11 contains the frozen reviewed baseline84972cb. This follow-up is deliberately retained on separate local branch codex/convergence-plan-20261116 until publication scope is approved. The original checkouts and candidate runtime remain untouched; Apple Calendar refresh remains off.
