> November 8 current checkpoint: the latest verified implementation, approvals and outstanding release gates are summarized at the top of COMPLETION_PLAN.md. The milestone notes below are historical. The isolated development app now contains approved real Gmail metadata and encrypted Chase snapshots in addition to fictional records; it is not production-ready. The original live app/database remain unchanged.

> Current status: M3D Phase 2 includes connected, private fictional records in a separately configured Supabase development project. The local-only descriptions and early milestone checklists below are historical, not a statement that current cloud isolation has been verified. Sessions retain a development refresh token in per-tab sessionStorage. Live providers and production security remain unfinished. See ../M3D_PHASE2_START_HERE.md for current local usage.

# Curated Chaos — Milestone Plan (living)

## Completed during this session — M0A

- [x] Created entirely separate working folder for local development.
- [x] Included approved blueprint and legacy **icon artwork only** (no old application source or environment credentials).
- [x] Added isolated fictional fixtures with no network request logic or provider SDK.
- [x] Implemented working Daily Brief, six area previews, Curation widgets, Quick Add, review queue, search, currency masking, and device-responsive foundation.
- [x] Added basic cross-domain logic tests; all passed locally.
- [x] Added proposed schema and sample RLS access model as **unexecuted draft**.
- [ ] Verify physical iPhone/iPad/MacBook browser compatibility — user-side testing required.
- [ ] Validate an actual isolated Supabase development project — not created.

## M0B — Isolated backend, before any real data

1. User creates/authorizes a **new dev Supabase project**, distinct from the existing one. Never ask for service-role keys to paste into client code or chat.
2. Review draft schema for per-section/per-record sharing, guardian/child constraints, tenant isolation, and privileged action procedures.
3. Execute approved migration **only in new development project** after backup and naming verification.
4. Establish separate fictional test user accounts A/B/C and two households; assert no cross-user or cross-household data access at the database API level.
5. Implement auth adapter, session handling, and verified profiles; use client-side anonymous fixtures only while not authenticated.
6. Add synchronization semantics: record versions, deduplication, offline conflict review, and data-freshness labels.

**Exit gate:** RLS multi-tenant isolation tests pass, no existing deployment changed, and no real integrations enabled.

## M1 — First complete Intelligent Daily Brief

1. Authenticated, permission-filtered task, calendar, email-insight, financial-bill, and school/household source interfaces.
2. Each source must have `status`, `last_successful_sync`, record identifiers, and visible error/stale states.
3. Create server-side suggestions and approval APIs with audit logs; automatic mode cannot bypass mandatory approvals.
4. Dedup event/receipt/bill cross-source matches and avoid silently modifying records.
5. Test with fictional data first, then authorize Google Calendar, email, and supported read-only finances individually after security validation.
6. Validate on iPhone, iPad and MacBook before adding family members.

**Exit gate:** owner-approved end-to-end workflow using verified authorized records; disconnected data never shown as real-time truth.

## Later milestones

- M2: all core pages, widget system, Quick Add and search, household essential experiences and owner settings.
- M3: approved calendar/email/read-only finance integrations and audited cross-app automations.
- M4: fully refine all four themes, typography, responsive widget layouts, accessibility.
- M5: selective migration preview, final backups, explicit owner acceptance, staged launch and tested rollback.

**Scope note:** Phase 1 private release includes calendar, email, financial integrations **and** advanced approved automations; the M0A mockup alone does not satisfy that commitment. If a provider is unavailable or costly, obtain an explicit scope decision rather than silently removing it.


## M0E note
The connected QA Daily Brief now stores a development refresh token in per-tab sessionStorage to restore sign-in after a refresh. This is for fictional development data only and must be replaced or hardened before using real information.

## M0F checkpoint

Connected private-record Daily Brief now shares the navigation shell with the fictional preview via an isolated dev-dashboard route. Other pages are explicitly local/demo. No live integrations.
