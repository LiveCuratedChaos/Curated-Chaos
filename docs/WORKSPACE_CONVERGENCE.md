# Source convergence preflight contract

The authoritative release checklist is RELEASE_CHECKLIST.md. This describes an engineering preflight, not a production migration or a completed autosave feature.

## Reuse and current boundaries

Read-only model/relationship foundations were reused from a6a7f33d0086cf739d8e4963ea61eac65854b6d0 and adapted to the approved one-master PROJECT rule. TASKS may retain several project memberships. The original native reviewed provenance and first-party CC_MANUAL_WORKSPACE provenance remain separate; no fictional-data guard is removed. Exact source blobs and local hashes are recorded in verification/REMOTE_SOURCE_AUDIT.json.

Pinned project-workspace-service/repository and manual-autosave integration tests were reviewed. The manual repository uses durable operation identities, replay intents, version guards, atomic history and guarded Undo. It accepts only explicit manual provenance. Native services use their existing review/current-source/CAS authority. These are different protocols: do not pass native records into the manual engine or treat a lost acknowledgement as proof of failure. The old draft009 schema was inspected only; it was not installed or reused by assumption. Full payload/history/receipt compatibility and migration/rollback acceptance remain open.

## Protected preview

POST /auth/workspace/convergence/preview requires the separately default-off server option allowConvergencePreview, original Brief/project scopes, an explicit source adapter and a verified original cookie session. The original factory forwards this option, but no owner launcher, CLI flag or public configuration was enabled. Requests require exact same origin, valid CSRF and an empty JSON object. Browser-supplied owner, record, approval and conversion fields are refused. This does not create a new authentication system.

The adapter reads owner-private active project/task/project_task_link/project_project_link/common_task_link rows only, in stable bounded pages. It does not request note, event, School-body, financial or provider records. At most2,000 covered rows may be reported; overflow or uncertain completeness refuses the view. Two complete scoped fingerprints must match. This is optimistic read stability, not proof of serializable migration or true concurrent PostgreSQL acceptance.

The response contains counts, covered types, required contracts, freshness/expiry and explicit blockers. It contains no raw source identities, titles, descriptions, capabilities or credentials. It always reports recordWrites:0, automaticConversionAllowed:false, migrationReady:false, fullPayloadCompatibilityValidated:false and historyCompatibilityValidated:false. completeWithinCoveredTypes does not mean a complete database inventory or completed release scope. Canonical common-task links explicitly report pending owned School/source relationship compatibility; they are not silently omitted or declared valid.

Extra project parents and cycles remain distinguishable safe blockers. No relationship is unlinked, no source is relabeled, no unsupported status or extension is dropped. Unknown provenance remains unsupported. Changing sources, invalid scope, duplicate/deleted records, expired parent context or sign-out suppress the report. The read-only preview does not clear existing common-task picker authority or extend source tokens. Upstream diagnostics are not returned.

## Verification and recovery

Fictional model, transport, original app-factory request-handler and auth/cancellation/error tests verify these boundaries without owner configuration or live API access. The request-handler fixture opens no sockets. Browser execution and real database migration/concurrency acceptance remain unverified.

Default-off is the recovery protection for this feature: leave allowConvergencePreview disabled to make the route unavailable. No schema or records were changed, so this increment requires no database rollback or user-data cleanup. Test controllers/fixtures dispose in teardown. Do not reset the working checkout to reverse code; preserve inherited work and use a bounded reviewed source change if needed.

Before any future activation, retain the existing records/IDs/versions/owners, task memberships, one-master project hierarchy, recurrence successors, progress options and extensions. Prove the chosen receipt/history bridge and rollback in isolated development. A preflight response cannot authorize migration, deployment or a live schema change.

## Native/manual operation-intent contract — November21

`server/private-operation-bridge-contract.mjs` is a pure, unmounted contract candidate. It accepts only reviewed task/project edits with the same original owner, record ID, source provenance, private visibility, section and exact next version. It records hashes of complete before/after rows and the relationship snapshot, not record contents. Task membership snapshots are canonicalized as a set of up to50 reusable projects; smaller-project master snapshots allow at most one parent. Task completion, recurrence changes, checklist/lifecycle changes, source relabeling, creation/deletion and other operation kinds are refused. Recurrence facts, project progress settings, checklist identities/states, extensions and memberships must remain unchanged for these edit intents.

Manual records are revalidated through the existing `normalizeProjectWorkspace`; native rows remain under their existing native provenance checks. Receipt verification binds operation ID, owner, source, record, result version and intent/before/after/relationship/recurrence digests, and only exposes bounded receipt metadata. A replay is accepted only for the same intent. No service, HTTP route, SQL function, schema or application runtime consumes this contract yet. Existing native review/approval/CAS and the separately scoped manual engine remain independent; this candidate does not yet provide atomic persistence or close the bridge/migration gate.

Five focused fictional unit tests pass. The latest full offline gate attempt (before adding this contract/test file) is inconclusive in the managed sandbox: it reports3,106/3,136 tests passing, with listener-dependent failures including local startup rejected as `EPERM`; privacy, whitespace and launcher checks pass. A separate direct diagnostic run showed the same listener error, but did not classify every failed test. No platform restriction was bypassed. No live schema, record, provider, owner runtime or workflow setting changed.
