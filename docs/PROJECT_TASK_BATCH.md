# Projects and tasks daily-use batch

November 12, 2026. Owner priority: projects/tasks first; Apple Calendar viewing is sufficient for the first milestone. Full blueprint retained. No calendar writes, bank access, provider refresh, real-record reads, hosted SQL or preview restart authorized by this batch.

## Shared contract

Reuse `public.cc_records` identity/scope/version/timestamps and organizer status/priority/section/subtask conventions. Do not weaken existing fictional model guards. New manual records have origin `CC_MANUAL_WORKSPACE`, payload `schemaVersion:1,source:'manual',fictional:false`. This is an explicit discriminator, not a conversion of QA records. First-party user entries are private, household_id:null, owner derived from the authenticated server session. Existing records stay untouched.

Project payload: title (1–140), summary (0–1000), status from existing PROJECT_STATUSES. Task payload: title (1–140), description (0–1000), day (valid YYYY-MM-DD or null), existing TASK_STATUSES and TASK_PRIORITIES, project_id (nullable UUID), subtasks (unique UUID/title/boolean done, maximum40), done derived consistently from status. Unknown extension fields survive updates; scope/provenance fields are not writable. A task's assigned project must be live, manual, private, same owner and section. Project section changes with linked tasks are blocked; do not silently cascade/delete. Initial UI keeps project section fixed after creation.

Model API in `src/project-workspace-model.mjs`: `makeManualProject(form,owner)`, `makeManualTask(form,owner,projects)`, `changeManualProject(record,patch,owner)`, `changeManualTask(record,patch,owner,projects)` returning complete record for creation and complete payload for edits; `normalizeProjectWorkspace(rows,owner)` -> `{projects,tasks}`; `projectWorkspaceView(rows,owner,{day,view,projectId})` -> `{projects,tasks,counts}`. View all/today/upcoming/undated/completed; all excludes completed tasks; today includes overdue; counts consistent with filtered scope. Reuse validDay, status/priority/sections/readSubtasks and derived project counts where safe.

Repository API in `server/project-workspace-repository.mjs`: constructor `{rpc}` standard `{data,error}`; methods `list({ownerId})` -> record array; `create({ownerId,operationId,record})`, `update({ownerId,operationId,id,expectedVersion,payload})`, `undo({ownerId,operationId,targetOperationId})` -> `{record,operationId,replayed:boolean}`; `history({ownerId,id})` -> bounded summaries. RPC `cc_project_workspace(operation text,input jsonb)`, EXECUTE service_role only; no browser/service direct table grants added. Backend derives owner and record IDs. SQL validates discriminator, links and allowed fields too; CAS/version check, atomic mutation/history/operation identity, no automatic retry after uncertain result. Exact duplicate operation IDs return same receipt, reuse with different intent rejects. Undo only when record is still at that operation's resulting version; inverse is a new version/history entry and never overwrites intervening edits. Reusing existing cc_records triggers must increment exactly once. New inserts and edits affect only discriminator-matching records.

First batch supports create/edit projects, create/edit/complete/reopen tasks, subtasks and project assignment, filtered lists, progress and guarded Undo/history. No hard deletion or sharing. Routine edits save directly with explicit save status/Undo; no mandatory approval popup for ordinary manual entries. Sensitive/AI/provider actions remain on their own reviewed paths. Durable offline autosave is a later explicit gate, not implied by a form or page-memory draft.

UI uses injected client methods `list()`, `create({operationId,record})`, `update({operationId,id,expectedVersion,payload})`, `undo({operationId,targetOperationId})`, `history({id})`. Browser drafts never supply authoritative owner/scope/origin. Lead HTTP assembly reconstructs validated records/payload through model, then uses authenticated actor for repository calls. Server creates IDs for new records unless an operation receipt already exists. UI read records use same public cc_records shape. No renewal/server credentials or persistent private browser cache.

## Ownership

- Model worker: new model and its tests only.
- Store worker: new repository + SQL draft009 + embedded SQL tests only.
- UI worker: separate new project workspace controller, static HTML/CSS and browser tests only. Lead owns routing/client/session/assembly and final review/testing.
- All workers branch from this published contract; isolated commits integrated by lead. No owner checkout, private files, DB/provider or live preview changes.

## Acceptance

Meaningful model/SQL/controller tests; whole fictional project→task→subtasks→complete→progress→Undo workflow; cross-account and foreign project denial, duplicate operation mismatch, stale version/Undo conflict, protected extensions, script injection and session clearing; browser journey in separate ephemeral staging where supported. Run full local release gate. Prepare exact bounded development acceptance package before asking to apply draft009 or restart/open owner's real preview. Until approved, hosted readiness remains open.
