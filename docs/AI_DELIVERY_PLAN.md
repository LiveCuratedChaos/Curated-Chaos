> Current reconciliation: see [CONSOLIDATED_BASELINE.md](CONSOLIDATED_BASELINE.md), November 16, 2026. Historical counts and pending entries below are dated evidence, not present status.

# Full-scope AI delivery plan

November 12 priority update: owner chose projects/tasks first and read-only Apple Calendar viewing for initial daily use. Local implementation and 1,671-test evidence are in `PROJECT_TASK_PROGRESS.md`; browser control/access and hosted gates remain open. Source checkpoint `c021ce6` and merge `6ecc004` supersede the older main-source snapshot for this branch. The next step is browser acceptance, not a purchase or live deployment. Full retained scope is unchanged.

Reviewed November 9, 2026. Integration lead: this delivery chat. This plan does not narrow the approved product or authorize deployment/migration.

## Repository findings

The source contains substantial reusable development infrastructure: task/project/subtask and school models; private cookie sessions; reviewed task/note/preferences mutations; bounded metadata search; RLS/session migrations; Gmail/Google Calendar/Chase/Mac Calendar adapters; encrypted source/workspace archives and fictional recovery tests. Keep these investments.

The accepted private preview is a useful slice, not the complete product. Many broader domain screens still represent fictional labels/projects/tasks. Production auth across every workspace, durable jobs/sync, general document storage, offline operation, full household/guardian lifecycle and several finance/domain engines are materially unfinished. A manifest is not a working offline PWA. Saved provider snapshots are not continuous synchronization, and the new private Brief does not yet compose the separate connected-source Brief.

Three parallel read-only audits reached this conclusion independently. The captured repository has 200 changed entries (51 modified, 149 untracked); its original HEAD is `8d3e8a9`. Starting feature worktrees from that old HEAD would omit completed server/provider/private-client code. A privacy-checked local checkpoint, `3acff57b2bc1f352943998a2f088413b00d5eff6`, captures 368 current source files without changing the original checkout's HEAD/index or publishing anything. It includes the parent's newer appearance work and its 901-test recorded baseline. The old completion-plan header still says 888; the newer accepted evidence supersedes it.

Current status belongs in the [scope ledger](PRODUCT_SCOPE_LEDGER.md), not in a percentage derived from test count. Shared interfaces and ownership belong in the [delivery contracts](ARCHITECTURE_DELIVERY_CONTRACTS.md).

## Acceleration changes

1. **Keep one product and one integration lead.** Converge the legacy workspace and private preview through a reusable authenticated application transport. Avoid a new framework rewrite and avoid separate bespoke handlers for each small control.
2. **Branch from accepted current source.** Workers receive isolated worktrees based on the sanitized checkpoint/integration branch, not stale main. The parent remains untouched. Reconcile any later parent commits/working edits before adopting this branch.
3. **Deliver whole workflows.** Examples: tasks/projects/notes lifecycle including Undo/history; settings/layout/navigation across devices; one complete connected-source ingestion-to-approved-action workflow; one complete household invitation/permission lifecycle. Do not equate one button with a release milestone.
4. **Separate everyday editing from automation approval.** The blueprint requires routine autosave with Undo/history. Reuse one-use reviewed writes for AI/provider/sensitive changes, without making per-field development approvals the permanent everyday UX.
5. **Preserve functioning models/tests.** Extend real domain behavior where absent; do not rebuild school ordering/credits, subtask preservation, source freshness, encryption or access controls already implemented.
6. **Use one evidence gate.** The first foundation batch adds a local release command for the full offline suite, content privacy and whitespace checks. Browser/device, production security, provider and migration gates remain distinct until actually demonstrated.
7. **Batch external acceptance.** Before a database/provider/preview action, prepare exact environment, schema changes, maximum fictional fixtures, fields read, cleanup and rollback. Request one approval for the coherent package. Live migration and production switch remain separately approved final actions.

## Dependencies and ownership

The critical path is **current-source checkpoint → shared identity/record/provenance contracts → production runtime/durable storage/jobs → full application transport and domain integration → connected/family/document/offline workflows → device/security/restore/migration acceptance**.

| Workstream | Reuse | Substantial deliverable | Depends on |
|---|---|---|---|
| Lead: platform and integration | Cookie vault, safe writes, RLS, existing API/models | Durable production auth/runtime; typed/versioned ownership and provenance contracts; all-screen transport; integration/release gate | Current checkpoint; hosting/state decision |
| Worker A: personal domains | Organizer, school hierarchy/order/credits, existing shell/layouts | Complete tasks/projects/notes lifecycle, Quick Add/search/widgets, then Home/Work/School/Finance domain behaviors | Published platform contracts; storage/policy interfaces |
| Worker B: connected workflows | Gmail/Calendar/Chase/Mac adapters, encryption, imports, freshness, source Brief | Durable bounded refresh/cursor jobs; one composed Brief; audited cross-domain suggestions/actions and safe Undo | Runtime/jobs/secrets; provenance/approval contracts; provider access |
| Worker C: household and protected content | Adult/private RLS, archive/recovery primitives | Invitations/memberships/guardian transitions and tests; document/import/export lifecycle; offline/cache/version recovery interfaces | Identity/permission/storage contracts |
| Rotating QA/reviewer | Existing unit, SQL/RLS and synthetic acceptance tests | Browser journeys, failure cases, adversarial permission matrix, accessibility/performance and real-device evidence | Each integrated batch; owner devices/access for external checks |

With four available agent slots, run one lead plus three workers. Rotate reviewers and later workstreams rather than assigning four agents the same central router/controller. Computer-use verification, merge gates, schemas and owner decisions serialize some work; four slots do not imply a fourfold delivery speedup.

## Work packages

### Batch 0 — reproducible current-source foundation (completed locally in this review)

- Sanitized immutable source checkpoint and separate integration/worker branches.
- Full-scope capability/evidence/dependency ledger, leaving the approved blueprint unchanged.
- Shared architecture contracts and file ownership.
- One local release gate with tests; no real-service access or owner-preview restart.
- Lead reviews and integrates worker commits; all local checks pass on the integration branch.

### Batch 1 — production execution and shared application spine (local foundation implemented; hosted gates open)

November 9 follow-through: latest main-source checkpoint `3212bea` reconciled at `b7de6fa` with 926 passing tests. See `DELIVERY_BASELINE.md`. Three isolated workers delivered durable encrypted sessions, leased consent-aware jobs, unapplied SQL, safe RPC transport and deployment preparation. The lead added HTTPS request handling/runtime composition and whole synthetic session/job workflows using embedded PostgreSQL. See `DURABLE_BACKEND_PROPOSAL.md` for the concrete Netlify Functions + Supabase design, $55 published-price/$60 conservative two-project infrastructure estimate and owner-only account checklist. Neither hosted persistence nor provider refresh has been activated; production adapters, durable approval/OAuth/limiter stores and acceptance remain dependencies.

- Choose a production execution model that supports durable sessions, encrypted grants, jobs and scheduling. The current in-memory loopback gateway is explicitly not deployable as production.
- Define identity/household/record revision/provenance/idempotency/error contracts, fixture-versus-production boundaries and storage interfaces.
- Build and test the shared transport and migrate a complete domain cohort; retain existing validation and failure semantics.
- Design the ordinary-user autosave/Undo/history path and the separate approval path for automation/sensitive actions.

This is the main dependency gate. Do not let workers choose incompatible auth/schema designs while waiting for it.

### Batch 2 — complete daily personal workflows, in parallel with Batch 3

- Projects/tasks/subtasks/notes lifecycle, search/favorites/saved searches, Quick Add, shared categories, layouts/navigation/preferences and core widgets.
- Home recurrence/assignees/quantities/maintenance/returns; Work shifts/applications/skills; School official-plan provenance, assessments/library/planner; actual finance budget/pay-period/bill/transaction/investment calculations.
- Complete accepted models where possible rather than replacing them. Model labels or fictional fixtures are not equivalent to these engines.

### Batch 3 — connected Brief and defined intelligence workflows

- Compose the existing private and saved-source Briefs into one permission-aware product.
- Durable source refresh/cursors, provenance, freshness/disconnection/error UI, deduplication and approval history.
- Implement an explicit, finite catalog of agreed advanced cross-domain workflows with rule-based and consented AI components; evaluate their correctness and supporting records.
- Preserve Gmail/email approval exceptions, read-only finance and the accepted Mac-based calendar limitation until a separately approved independent connection is available.

### Batch 4 — family essentials and account lifecycle

- Secure invitation/adult membership and granular sharing, then synthetic child/guardian/approver lifecycle and transitions.
- Strong reauthentication, Devices & Sessions, section locks, recovery methods/protection period, deletion/retention and audit policies.
- No real family invitations or child enrollment before the corresponding acceptance gates.

### Batch 5 — documents, offline, exports/imports and recovery

- Attachments/document versioning, scan/OCR/classification review, sharing and controlled exports/import merge/rollback.
- Protected offline queue/cache/document behavior, reconnect conflicts/history, real-time online updates and notification delivery with Apple-platform fallbacks.
- Recently Deleted/restore, off-device and full-database backup, actual restoration rehearsal and dependency-aware recovery.

### Batch 6 — intended visual finish and release acceptance

- Approved four-theme direction/custom themes, full widget library, responsive accessibility and performance.
- Mac/iPhone/iPad real-use testing and security/failure/provider/restore evidence.
- Migration inventory/mapping/preview and rehearsals, final verified backups, owner acceptance, separately approved staged cutover and rollback that preserves post-launch edits.

Retained deeper rewards/guardian transfers, advanced scanning/history/predictive planning and additional approved providers remain in the ledger. They are not silently removed to make an earlier milestone look complete.

## Revised estimate

These are engineering planning ranges, not measured AI throughput or a promise of autonomous calendar time. Assume sustained sessions most weekdays, one active integration lead plus two or three workers, prompt necessary decisions and access, and no prolonged provider/hosting/platform blocker.

| Milestone | Provisional elapsed time from organized execution | Meaning |
|---|---:|---|
| Dependable owner daily-use milestone | 4–8 weeks | An accepted daily workflow set with reliable auth, source status and recovery; not a declaration that the full product is complete |
| Entire agreed first private release | 12–24 weeks | Personal + family essentials, supported calendar/email/read-only finance, advanced defined intelligence and release gates |
| All currently specified retained blueprint commitments | 6–12 months | Includes the retained later-release capabilities; no scope waiver |
| High-risk elapsed-time band | 12–18 months | If provider approvals, device constraints, architecture rework or intermittent access dominate |

The three audits estimated roughly 120–240 focused engineering person-days (about 1,000–1,900 reference effort hours) for the whole retained specification. That expresses complexity, not a model-billing estimate and not a claim that AI operates like a human-hour meter. Estimates are low-confidence, with at least ±50% uncertainty until the first two substantial batches establish actual integration/rework velocity. Re-estimate against accepted requirement IDs after those batches, without dropping uncompleted features. Open-ended future providers/features cannot receive a meaningful fixed completion date until enumerated.

## Essential decisions and limits

- **Proposed execution model:** Netlify Node Functions + Supabase durable state/jobs; no demonstrated need for a third runtime. The owner confirmed both accounts are Free. Account-specific quotes/project inventory and the operating-cost boundary remain to confirm before any purchase. See `DURABLE_BACKEND_PROPOSAL.md`; do not upload the development in-memory gateway.
- AI can perform implementation, local reviews/tests and integration, but cannot supply provider approval, licensed market-data rights, account/OS consent, payment authorization or real-device acceptance on the owner's behalf.
- Mac-based calendar updates still require the Mac to run; independent updates remain a separately authorized provider capability.
- Current encrypted archives do not cover full identities/households/schema/attachments or prove whole-system disaster recovery. The external-drive/off-device gap remains.
- Agent execution depends on active sessions/tool availability and usage limits. No claim of unattended continuous completion is made.
- This branch is isolated and unpublished. The existing preview/database/live deployment and the parent chat's ongoing work are not redirected or changed by this review. Adoption/reconciliation should occur before the next implementation wave to avoid two competing leads.

## Evidence and definition of batch done

The captured baseline was independently rerun: 901/901 tests passed. The integrated release gate adds six runner/failure tests, bringing the verified suite to 907/907, with content privacy and pending-whitespace checks also passing. The scope ledger covers 74 stable requirement IDs. Worker commits were reviewed and integrated by the lead; this foundation batch is complete locally and unpublished. Existing browser and hosted development acceptance evidence remains valuable but does not certify missing capabilities. Many controller tests use VM/mocked APIs; they do not replace browser/device journeys. The full source privacy scan detects recognized patterns in working/index text and bounded ZIPs, with binary skips explicitly disclosed.

For each batch record: requirement IDs, reused components, implemented behavior, positive/negative tests, integration/browser/device evidence as applicable, source/data scopes, remaining limits, cleanup/rollback and approval status. Pass the local release gate before integration, then perform any separately approved external acceptance. Only the lead marks the integrated batch accepted.
