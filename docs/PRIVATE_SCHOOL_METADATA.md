# Reviewed saved School metadata

The separate default-off `--allow-private-school-edit-reviewed` scope requires saved School reading and the private Brief dashboard. The owner launcher stays unchanged. Explicit selected School reading is followed by opening an editor, reviewing exact differences and approving a one-use save. Read capabilities alone do not grant write authority.

Degree fields: title, progress metric, total credits, total terms and optional target date. Course fields: title, code, term, academic status, credits, official order, study order, optional target date and notes. This workflow never changes degreeId/program association, assessment/checklist arrays, saved study sessions, source markers or unknown extensions. The proposal clones the complete current payload and overlays only the explicit validated metadata. Ordinary project status remains independent of academic status.

The server revalidates ownership, source/schema, exact canonical microsecond metadata, version and the complete original payload before review, authorization and the single optimistic update. The acknowledgement must contain the exact proposal at version+1; a fresh source read must match it. The same private owner/session and CSRF protections apply to every route. Concurrent writes are guarded. Source refresh, revocation, cancellation and late replies cannot revive a review. Pending or uncertain saves retain a copyable draft and are never automatically retried.

Known public academic fields are projected for viewing while unknown extensions stay in the original source. Future schemas and malformed known fields fail closed. The legacy schoolPayload serializer is not used for existing-record saves because it rebuilds nested arrays. Saved text and its leading newlines remain exact in notes, review and the editor.

## Verified November17 checkpoint

All2,365 local tests pass with no failures, skips or cancellations, plus privacy/content/whitespace/launcher checks. Tests cover model/service/REST adapter, exact nested and unknown-extension preservation, one-use approval, timestamp/version drift, uncertain acknowledgement, pending-write rejection, offline/reset/late replies, scope/CLI/public assets and HTTPS integration. Independent review fixes were integrated.

Fictional interactive browser accepted opening an existing course, reviewing notes/study order, approval and refreshed source, unchanged official order/assessments/steps/study agenda, exact leading-newline/literal note preservation, reopening saved fields, cancellation of an unsaved title,390px layout (375px document) and sign-out clearing.116 automated desktop/narrow browser cases are prepared/discovered; standalone Chromium execution remains restricted and is not claimed. Temporary fictional servers/sessions/tabs were cleaned up and viewport overrides reset.

No real/private/provider/schema/production change, owner restart, hosted CI, branch switch/reset/publication, spending or deployment occurred.

## Recovery and remaining release gates

Disabling the new scope removes editing while keeping source records and the read-only School viewer. Development acceptance changes only disposable in-memory fixtures. Existing real records have not been edited. A confirmed metadata change can be reversed by a fresh explicit review of the previous field values; an uncertain result requires a fresh source read before any further review.

Encrypted workspace archives retain complete School payloads, but the ordinary restore foundation still refused missing School records at this metadata checkpoint. The following recovery milestone extends server-only eligibility with exact academic dependencies; see PRIVATE_SCHOOL_RECOVERY.md. Export success does not establish executable recovery. Dedicated School degree/course dependency validation and transactional restore acceptance remain required before full recovery readiness; no production restore is enabled. Protected creation, academic associations, stable nested task identities, attempts/rubrics/milestones, calendar/planner/library and the rest of the approved School release remain in RELEASE_CHECKLIST.md.
