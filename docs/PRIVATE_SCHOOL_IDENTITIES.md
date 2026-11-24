# Reviewed stable academic identities

The independent default-off `--allow-private-school-identities-reviewed` scope requires protected School metadata editing and reading. The owner launcher remains unchanged. This workflow prepares identities for saved assessments, assessment steps and study sessions without creating task/project copies or changing existing record IDs, content, order or program association.

From a clean selected course editor, explicitly prepare a count review and approve a one-use save. The server generates random UUIDs under the namespaced academicId key and marks the course academicIdentityVersion1. Generic existing id fields and unknown nested extensions remain exact. Identifiers are not derived from titles or array positions, and raw identifiers do not enter the review or read-only detail DTOs. Dirty metadata must first be saved or discarded. Empty/already identified courses require no write or regenerated IDs.

Legacy reserved-key collisions, partial/duplicate/invalid/future identities and stale source snapshots fail closed. The existing review engine verifies complete source metadata/payload before review, authorization and optimistic write, demands the exact version+1 acknowledgement and rereads the result. A used or uncertain approval never retries. Metadata-only writes cannot adopt/change identifiers; the identity adapter refuses any other payload changes.

Sparse metadata binds the identity version while selected reads validate complete adopted structures. Encrypted archive and recovery eligibility preserve and validate adopted IDs. The legacy School creation/update adapter refuses identity-bearing payloads so its normalizing serializer cannot silently discard assigned identities. No existing owner record has been adopted during development.

## Verified November19 checkpoint

All2,441 local tests pass with zero failures/skips/cancellations, plus privacy/content/whitespace/launcher checks. Model/service/SDK/HTTP/HTTPS, public scope/CLI/client, legacy-writer, encrypted archive/restore and editor checks cover preservation, collision/default-off boundaries, stale revisions, one-use approval, uncertain acknowledgements, review replacement and no-op behavior. Independent review fixes were integrated.

Fictional browser verified dirty draft refusal and visible button state transitions, exact counts, explicit additive approval, unchanged official/study order and notes, repeated no-op preparation,390px layout (375px document) and sign-out cleanup. A stale button display and fictional summary-marker parity issue were corrected before final acceptance.120 automated desktop/narrow browser cases are prepared/discovered, not claimed executed; standalone Chromium remains restricted. Temporary fixture servers/sessions/tabs were cleaned up and viewport overrides reset.

## Recovery and remaining release work

Disabling the scope stops further adoption and leaves saved identifiers intact. Do not strip adopted IDs to downgrade a record; future references must remain recoverable. Preserve encrypted archives containing the full marker and nested values. The unexposed transactional restore foundation validates exact adopted records and course/program dependencies; production/full-domain recovery is not activated.

No actual/provider/schema/production change, owner app restart, hosted CI, branch switch/reset/publication, spending or deployment occurred. Stable identities are a dependency, not completion of shared academic task editing or polymorphic project links. Protected academic field/step editing, creation/associations, attempts/rubrics/milestones, planner/library/calendar and all approved release scope remain required in RELEASE_CHECKLIST.md.
