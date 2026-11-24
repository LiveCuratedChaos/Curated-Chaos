# Reviewed academic additions and ordering

Status: integrated and verified with fictional data, behind an independent default-off scope. R27 remains Partial. Removal/recovery, shared targets, attempts/rubrics/milestones, academic calendar/Library/planner and all frozen release requirements remain required.

## Workflow

The existing selected School metadata editor opens an explicit “Add or reorder academic records” child. Each review proposes exactly one appended assessment, appended step, adjacent assessment move or adjacent step move within its original assessment. Program/course notes, association, official/study order, study sessions, existing completion values, canonical nested identities and unknown extensions remain intact. No shadow tasks/projects or calendar commitments are created. Duplicate titles are valid: numbered choices and source/destination positions identify the exact operation without exposing saved IDs. Assessment additions review title, type, status and position; steps review the parent ordinal and new position.

An entirely empty legacy course can receive its first assessment and identity-version marker together. Other unadopted courses require the existing reviewed identity workflow first. New IDs are generated only server-side and cannot collide, including case variations, with existing assessment/step/study-session IDs. The existing bounds remain25 assessments/course and20 steps/assessment. Boundary/no-op moves, removals, simultaneous edits, replacement IDs and unrelated source changes fail closed.

The server extends the existing School review engine and shared one-use save/approval path. Opaque assessment/step choices are bound to the current parent and source generation. Exact source preflight, optimistic version, exact version+1/full payload acknowledgement and fresh reread guard the mutation. The SDK independently reconstructs the single legal operation and compares the complete payload. Browser selections never supply canonical IDs. Old views/reviews, wrong-parent steps, future schemas and concurrent source changes cannot authorize a save.

## Integration and safety

`--allow-private-school-structure-reviewed` requires existing academic content/identity/School edit/read scopes. Public configuration exposes only the boolean; browser assets are pure and SDK transport stays private. The owner launcher is unchanged. Cookie routes `/school/structure-read` and `/school/structure-review` retain POST, CSRF, origin, active session and exact-key checks; approval uses the existing School edit-save route. Pending-save guards block source refresh and other mutation paths.

Back-to-draft retains the proposal. Discard is explicit and obtains a fresh parent editor. Loading, empty, unavailable, expired, offline and unauthorized replies cannot revive old drafts. Uncertain saves retain a human-readable draft and never retry; fetching current saved state is necessary before another change. An implementation rollback disables the new scope and reverts its interface/server code only. Preserve saved academic identities/arrays; never run legacy normalization against adopted source or delete records to undo code. Existing encrypted recovery retains complete canonical payloads.

## Verification — November19,2026

2,551/2,551 local tests pass, zero failures/skips/cancellations, plus privacy/content/whitespace/launcher checks. Targeted model, SDK, actual embedded PostgreSQL, service/HTTP, panel, root-controller and protected asset/flag checks cover all four operations, empty first assessment, collisions/caps, literal unknown contents, stale views/source/approval, wrong-parent choices, draft recovery and malformed acknowledgements. Actual isolated PostgreSQL confirms exact source preservation and version increments through add/add/move/move, then refuses a stale mutation.

Actual fictional browser acceptance verified identity prerequisite/adoption, assessment and step additions, exact review/revision, duplicate-title assessment2→1 and step2.2→2.1 moves,390px layout (document375px), exact notes, retained study agenda, independent official4/study1, reload persistence, sign-out and tab/viewport cleanup.126 browser cases are prepared/discovered, not claimed executed as a standalone suite. The temporary fictional server was stopped and listener5316 is absent. No owner app restart, new hosted schema/data change, provider/production change, publication, hosted CI or spending occurred in this milestone. Existing isolated School association concurrency acceptance remains an independent unresolved gate.

RELEASE_CHECKLIST.md is the authoritative dependency checklist. Next: recoverable academic removal/history foundation, preserving the complete approved release scope.
