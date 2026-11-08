# CURATED CHAOS
## Master Product & Implementation Blueprint

**Version:** 1.0 — October 29, 2026  
**Status:** Consolidated design baseline; implementation not yet authorized  
**Launch model:** Private, invitation-only; personal and family use first  
**Design principle:** Functionality and reliability first; detailed visual polish before private launch  
**First end-to-end milestone:** Intelligent Daily Brief

> **Reading guide.** “Approved” records design decisions already made. “Build gate” is a condition to be satisfied through implementation and testing, not a claim that the feature exists. “To validate” indicates a dependency, feasibility question, or detail that must be settled during technical design. This document consolidates the agreed vision; it does not change the existing application or authorize deployment.

# 1. Executive Direction

## 1.1 Product promise

Curated Chaos is a unified, Apple-first personal and household life-management application. It makes schedules, tasks, projects, school, work, money, documents, and family responsibilities easier to understand and coordinate. Its personality is organized, sophisticated, warm, and customizable rather than clinical or cluttered. The opening experience is a personalized “A Glimpse of Your Day.”

## 1.2 Agreed priorities

- **Private first:** Build primarily for the owner and invited family. Keep account and household isolation flexible enough for future public availability; do not make marketing, subscriptions, or app-store distribution first-release dependencies.
- **First release:** Personal features plus family essentials, together with calendar, email, and supported read-only financial connections. The first release also prioritizes advanced, permission-aware cross-app intelligence.
- **First workflow:** Make the Intelligent Daily Brief the first complete, testable vertical slice; it must bring together real authorized data from relevant areas, not merely display unrelated sample cards.
- **Approval is fundamental:** Automation modes can be Automatic, Ask Before Applying, or Disabled per supported automation. Sensitive actions always require explicit approval and strong reauthentication as applicable.
- **Build sequence:** Agree requirements → isolated foundation → functional workflows → visual refinement → acceptance testing → approved staged launch. Architect flexible layouts/themes up front to avoid a costly redesign.
- **Existing app protection:** Preserve the current Netlify/Supabase application and data. Develop in isolated infrastructure, use fictional data first, selectively migrate approved real data, and launch only with explicit owner approval and rollback protections.

## 1.3 Current implementation status (user-reported, not reverified here)

- Existing Curated Chaos prototype: v19, currently hosted on a Netlify preview URL; account authentication, Supabase row-level-security work, and Google Calendar OAuth integration were previously reported as working.
- iCloud calendar, email, banking, and investment connections are **not yet established as live working Curated Chaos integrations**.
- The extensive requirements below are **future design commitments**, not claims about completed features.

# 2. Visual Identity & Responsive Experience

## 2.1 Brand and themes — approved

- Brand: **Curated Chaos**; subtitle **“A beautifully organized life.”** Brand selection returns to Daily Brief.
- Four baseline themes: **Romantic Dark Academia** (deep forest green, antique gold, warm paper, ornate/library influences), **Clean Neutrals**, **Blush & Bloom** (pink), and **Modern Heritage** (masculine). Users may customize and save additional themes.
- Personal themes and display preferences follow the user across devices as appropriate. The **Household Owner alone** selects the theme of shared household spaces; individual members retain their personal app theme.
- Visual architecture must support themes, typographic scale, spacing, widget chrome, decorative treatments, and responsive breakpoints from the start. Fine art direction follows functional implementation and precedes launch.

## 2.2 Desktop, iPad, and iPhone — approved

- Desktop: full sidebar. Phone: four customizable and reorderable bottom tabs plus permanent **More**, with optional collapsible sidebar preference. iPad: sidebar in landscape, bottom navigation in portrait by default; allow per-profile overrides where practical.
- Responsive logic uses available viewport width rather than device labels alone. Each profile can maintain separate desktop/tablet/phone dashboard arrangements and display density (Spacious, Balanced, Compact).
- Respect system accessibility font size initially; allow accessible profile-level overrides. Motion follows Reduce Motion by default, with Full/Subtle/Minimal settings. Optional sounds and haptics are independently configurable; both default off.
- Support MacBook, iPhone, and iPad as a progressive web app; verify browser and platform limitations for biometric authentication, push notifications, offline document storage, and background work.

# 3. Information Architecture & Cross-App Features

## 3.1 Navigation — approved

- The brand leads to **Daily Brief**. The sidebar permanently includes **The Curation** (customizable dashboard), then a configurable **Chaos** group with **Home, Calendar, Personal Life, Work, School, Finances**. Items in the Chaos group may be reordered and optionally hidden from the navigation without deleting data.
- **My Account** at the bottom exposes Settings, Integrations, Categories & Colors, Household, Privacy & Security, Data & Recovery, and related account tools.
- Each core page supports an overview composed of reusable, configurable widgets and deeper detail views; widgets may appear more than once with independent filters and settings.

## 3.2 Global tools — approved

- **Quick Add (+):** available anywhere for events, tasks, notes, groceries, projects, and routines. Destination is private by default; allow per-record-type preferred destination. Fast entry plus expandable details, with remembered field layout.
- Interpret natural-language dates, categories, and priorities and **show a review step before saving**. Allow typed entry and voice transcription; prefer on-device recognition, require consent for cloud transcription, and discard raw audio after transcription while saving only confirmed text.
- **Universal Search:** icon, `Command-K`, and optional compact/interactive Search widget; keyword or natural-language queries; filters by category, date, profile, and household. Search only authorized records already imported, synchronized, or saved **inside Curated Chaos**, not every item in linked third-party accounts.
- **Saved Searches:** optional personal saved queries and filters. **Favorites:** selected pages/items and named collections plus automatically grouped categories. They are separate from saved search history.
- **Recently Viewed** and **search history** are optional, off by default, with profile-managed retention and deletion. Sensitive/locked/unauthorized content must never leak through search, suggestions, previews, or history.
- **Pending Suggestions:** central approval queue with optional fully interactive widget and Daily Brief summary; not a permanent global header button. **Household Approvals:** separate interactive approval queue with optional widget.
- Global categories and colors are controlled centrally and inherited by Calendar, widgets, automation, and reports; per-item overrides are supported.

## 3.3 The Curation widget library — approved

Baseline supported widget types include: Today's Calendar; Clock; Weather; Coming Up; To-Do Lists; Priority Tasks; Degree Progress; Courses & Assessments; Routines; Cleaning; Groceries; Bills; Maintenance; Budget; Investments; Notes; Deliveries; Projects/Master Projects. Additional optional widgets: Pending Suggestions, Household Approvals, Search, Favorites, and relevant summary/control widgets. Users can add multiple instances, resize/reorder, and configure every instance via a contextual menu. Each widget must handle empty, loading, locked, stale, and disconnected states.

# 4. Intelligent Daily Brief — First End-to-End Workflow

## 4.1 Brief content — approved

- Default landing page opens **today** with a generated, personalized narrative titled **“A Glimpse of Your Day.”** The owner's default tone is Elegant & Warm; profile controls adjust length, detail, and style separately from the theme.
- The summary may include: verified calendar events and work shifts; priorities, tasks, and routines; relevant email insights and pending approvals; approaching bills and selected financial observations; school assessments/study recommendations; household tasks, groceries, approvals, and maintenance.
- Each profile chooses which categories and accessible households contribute; source identity must be visible where ambiguity matters. Never imply disconnected, stale, inferred, or predicted information is confirmed real-time fact.
- Brief sections are individually reorderable, expandable, collapsible, and hideable. Inline actions may complete permitted tasks, review suggestions, or open full records. Completed items can be Hidden, Visible, or placed in a collapsible Completed section per area.

## 4.2 Dates, refresh, history — approved

- Browse any date using date controls, arrows, and Today shortcut. Include optional compact seven-day date strip or detailed seven-day view; choose rolling seven-day period or calendar week and configurable week start.
- Per-profile summary generation options: morning schedule, meaningful source changes, and manual refresh. Refresh should convey status, timing, and the sources used.
- Past-date view shows historical activity; optional preserved read-only Daily Brief snapshots may be manual, scheduled, both, or off. Per-profile retention can include indefinite preservation, with favorited snapshots protected from routine expiration subject to deletion/privacy rules.

## 4.3 First workflow acceptance criteria — build gates

- Uses correctly permissioned real or fictional records without invented events or amounts; identifies stale/unavailable sources.
- Correctly merges and summarizes across domains, avoids duplicate suggested actions, and links every meaningful insight to its supporting record when permitted.
- Honors approval modes, confidential/locked display settings, household source filters, and individual profile preferences.
- Supports common daily actions from the brief and synchronized updates across target devices.
- Gracefully degrades if Google Calendar, email, or financial provider is unavailable, without misleading the user.

# 5. Core Workspace Domains

## 5.1 Home — household operations

- Shared household dashboard of cleaning schedules by room, assignee, recurrence, and rollover; recurring routines/habits with progress/streak options; grocery lists, quantities, favorites, and templates; maintenance of possessions/vehicles with dates, mileage, usage, warranties, and receipts; deliveries, returns, and refunds.
- **Household Hub**: contacts, tasks, documents, and reference information with granular sharing by item/section; **private by default**. Condensed interactive overview and full detail views.

## 5.2 Calendar

- Month default; day/week/agenda optional. Detailed calendar items or minimal color dots in month view; select a day to open its schedule drawer.
- Filter by connected source, category, and household. Events have default destination calendar with per-event override; category-specific automatic internal display from school/projects/bills/maintenance, with optional authorized external write synchronization and deduplication.
- Reminders by category plus per-event override; intended channels in-app, device push, and email, with configurable quiet hours and platform support verification.

## 5.3 Personal Life

- Modular overview; personal projects drawn from the shared cross-app project system irrespective of category; configurable goals (manual or linked progress); custom lists and reusable templates.
- Do not impose permanent People/Relationships, Celebrations, Hobbies, or Journal sections as fixed top-level navigation.

## 5.4 Work

- Work overview, shifts, tasks across multiple lists/combined views, statuses and subtasks; shared project engine; linked notes; customizable job application pipeline; career goals (including target compensation), skills and certifications.
- Email-derived job-application changes are **suggestions requiring approval**. Include guidance and permissions that discourage storing employer-confidential or restricted material in personal accounts.

## 5.5 School

- Support multiple programs. First configured program: **WGU B.S. Business Management**, starting November 1, 2026, with accelerated February 2027 target and March contingency.
- Distinguish the **official institutional course plan** from any **user-defined accelerated sequence**; the agreed official Term 1 placement has **D253 Values-Based Leadership in fourth position**. Do not silently promote an older draft tracker into the official plan.
- Track completed/transferred credits, courses, degree progress, assessments (PA/OA), attempts, rubrics, program milestones, syllabus/course-guide documents and version changes.
- Extract possible changes from uploaded guides with preview, provenance, deduplication, and **explicit approval before editing the degree plan**.
- Smart Study Planner proposes time blocks from schedule availability, priorities, and deadlines; does **not** silently reschedule existing commitments. Provide School Library and academic calendar.

## 5.6 Finances

- Organize bank, credit, loan, and investment accounts. Visibility of an account and its inclusion in aggregate totals are separate preferences.
- Monthly and pay-period budgets, category and zero-based budgeting, category-specific rollovers/overspending, and comparisons to actual cash flows. Smart Budget Planner offers two to three proposals for review and approval.
- Bills: recurring/one-off, amount estimates labeled, due dates, status from manual confirmation or reviewed transaction matching. Transactions: provider-synced and manual, categorized/split, receipts, reconciliation and review of uncertain matches.
- Investments: holdings/market views where licensed data is available; dividend history, appropriately labeled projections, return and reinvestment without double-counting.
- Income scheduling: weekly, biweekly, semi-monthly, monthly, custom; expected versus actual and optional paystub gross/tax/net details.
- Privacy: global hide-dollar-amounts shortcut and per-widget amount/percentage visibility options; avoid including sensitive totals in notifications unless explicitly permitted.
- External financial integration must remain **read-only**: no transfers, trades, bill payments, or access to third-party account credentials beyond supported authorization flows.

# 6. Connected Integrations & Automations

## 6.1 Integration hub

- My Account → Integrations is the authoritative hub, with shortcuts from applicable pages. Group by Calendar (Google/iCloud as supported), Email, Banking, Investments, and Other.
- Separate **syncing internal Curated Chaos records across devices** from **refreshing an external source**; each connection supports current status, error details, consented access scopes, manual refresh, and per-service automatic sync if supported.
- Preserve and revalidate current Google Calendar OAuth integration. Other providers, including iCloud, email services, and individual banks/brokerages, are subject to provider-specific technical availability, approvals, scopes, and potential costs; they cannot be assumed connected.

## 6.2 Email and financial source boundaries

- Email supports selective opt-in features such as parsing appointments, bills, deliveries, receipts, or job application updates. Manual import or forwarding is supported where feasible. Do not automatically send/delete email; do not scan unrelated linked mail outside opted-in capabilities.
- Email suggestions that **create or change tasks, calendar events, or job application records require approval**, regardless of the general Automatic setting, unless a future explicit user decision changes this rule.
- Banking and investments use supported read-only authorization; show provider-sync freshness and transaction provenance. Never imply a successful direct bank connection without testing the actual institution.

## 6.3 Automation control — approved

- Every supported automation has three modes: **Automatic**, **Ask Before Applying**, **Disabled**. Default to **Ask Before Applying** for automations that modify saved information.
- Automatic is available only for actions explicitly classified as low-risk and authorized by the user. Sensitive actions (e.g., guardian/owner changes, account deletion, external sharing escalation, sensitive permissions, money movement if ever contemplated) are not eligible for automatic execution.
- Each suggestion shows source, proposed changes, confidence/uncertainty, and options to approve, edit, or dismiss. Actions have a protected audit history with Undo when safe and version history when applicable.
- Examples of connected intelligence: email appointment → proposed event; receipt → suggested transaction association; calendar availability + school → suggested study slots; bills + income → cash-flow highlights; household chores + scheduling → proposed coordination.
- **Implementation boundary:** “advanced cross-app intelligence in first release” requires a tested core set of useful automations across calendar, email, finance, and app data. It does not mean every hypothetical integration or full autonomous agent must ship at once.

# 7. Identity, Households & Children

## 7.1 Personal accounts, multiple households, and profile aggregation

- Every adult owns an independent personal account with private default records and personal theme. Adults may belong to multiple households, each with separate ownership, members, themes, and data; last-used household reopens across devices where supported.
- Daily Brief and widgets may aggregate the user's personal records and their selected authorized households; source and ownership must remain unambiguous.
- Notification settings are independently configurable per household and notification type (immediate/digest/off, quiet hours, private previews).

## 7.2 Household ownership and invitations

- The designated Household Owner exclusively controls shared household theme, overall permissions, membership, and external-sharing permissions. Adult invitations use expiring, single-use secure links or verified email, with minimal access by default and editable permissions before/after joining.
- The owner establishes the default Home layout. Members may customize their own view; new owner-added shared widgets are offered, not silently inserted into existing personalized layouts.
- Member permissions apply by section and sometimes item; default private. An adult may separately be named **Household Approver** for chores/rewards without automatically receiving child guardian rights or finance access.
- Shared comments and @mentions are permitted where authorized, including photos/files with owner-controlled attachment visibility at the source record.

## 7.3 Transfers, departures, and separation of duties

- Household ownership transfers require verified consent from outgoing and incoming eligible adult, with an audit trail. Outgoing owner may remain a member or leave. The transfer never automatically transfers private adult data or primary guardianship.
- When an adult leaves, revoke household access promptly. Keep authorized shared records in the household, retain departing person's private records with them, and prompt reassignment of chores, events, and other owned responsibilities.
- Rejoining requires a fresh invitation and minimum permissions; prior elevated rights are not silently restored.

## 7.4 Child access and guardianship

- Supported modes: independent age-appropriate child sign-in where permitted, or parent-managed access on a shared device; switching to adult profile must require adult authentication.
- Child view may be simplified or use the regular interface subject to guardian controls. Child customization levels: Parent Controlled, Guided, Independent Within Allowed Bounds. Guardians also configure child notification behavior and data visibility.
- Each child has one **Primary Guardian**, the only person authorized to add/remove other designated guardians; designated guardians receive expressly allowed management rights. Verified primary-guardian transfer requires both parties' acceptance and audit.
- Eligible children may transition to an independent adult account through a verified, accepted process: keep existing eligible personal profile/history or create a new one with selected transfer. Household Owner independently decides adult membership continuation or fresh invitation. Guardian authority ends as required.
- **Build gate:** Underage enrollment, data collection, consent, account transition, and notifications require age-appropriate privacy/compliance review before inviting real child users. The existence of a design does not establish legal compliance.

## 7.5 Chores, points, and rewards

- Task-level choice whether completion self-confirms or requires authorized adult approval. Optional rewards: points/stars, badges, privileges, tracked allowance (no cash transfer), or none.
- Reward redemption requires authorized adult approval; deduct points only once approved. Support child-specific and optional collective family rewards. Family points may be earned from dedicated tasks or donated by a child subject to adult approval; avoid double counting and refund canceled donations correctly.
- Each family goal controls children’s visibility: family total only (default), individual contributions, or everyone’s balances, independently from household record permissions.

# 8. Documents, Information Portability & Search Privacy

## 8.1 Document Library

- Unified Library displays each profile's own documents and explicitly permitted household documents, visibly distinguishing ownership. Support folders, tags, automatic smart collections, and links to related records without duplicating file bytes.
- Upload PDF/images, mobile multipage scan and searchable text where supported. AI-assisted classification, tags, expiry detection, and record association are **recommendations reviewed before applying**.
- Per file/folder select offline availability **per device**. Preserve original cloud copy when removing local cache. Support device-level storage limits and cleanup rules; protected always-offline files are exempt where allowed.
- **External sharing off by default.** Select secure time-limited links or verified recipients for individual shares; optional passwords/download caps, revocation, basic or detailed per-link access logging where available. Owner explicitly grants household members external-share permission. A link does not prove recipient identity, and downloaded files cannot be remotely controlled.

## 8.2 Import and preservation

- Onboarding and later imports: spreadsheets, documents, calendars, tasks, projects, and supported structured data. Show an import preview with extracted candidates and approval; perform exact/fuzzy duplicate checks and side-by-side merge, skip, or keep-both decisions.
- Maintain import provenance/history with safe partial or full rollback that does not silently overwrite edits made after import. Retain or discard original import files **per import**, with per-profile preferred default; keep only metadata genuinely necessary for rollback/audit when original file is discarded.

## 8.3 Exports and the Export Center — approved

- Offer **complete eligible personal data export** and **selective export** filtered by section, date range, category, or individual records. Formats appropriate to content: CSV, JSON, PDF, and original attachment bytes; preserve relationships and provenance where supported.
- Each export individually selects whether to include **attachments, comments, completion history, and previous versions**, always respecting data ownership and household export rights.
- Delivery per export: **direct download** or **secure temporary Export Center**. Each profile can select per-export expiration of **24 hours, 7 days (default), or 30 days**. Prepared files can be manually deleted sooner. Export expiry never deletes source records, backups, or files already downloaded outside the app.
- Strong reauthentication and restricted-access storage for sensitive exports; exclude another adult's private content and any household records for which export permission is absent.

# 9. Data Protection, Sessions, Offline Work & Recovery

## 9.1 Security baseline — approved

- Default private access with server-enforced identity and record-level authorization (including multi-tenant household isolation). UI hiding alone never confers security.
- App lock and optional individual section locks with supported device authentication and timeouts. A locked section may show nothing or a nonsensitive preview by per-section choice; **fully hidden is default**. Apply the same restrictions to widgets, summaries, search, notification previews, and exports.
- Autosave routine edits with Undo and version history; confirm high-risk and irreversible actions. Recently Deleted retains eligible deleted items for **90 days** unless explicit account-deletion/privacy rules require earlier removal.
- Encrypted backups as supported, restore tests, and protected security-sensitive action logs. Routine activity logs may have per-type retention and visibility, while owner/security logs are access-restricted.

## 9.2 Sessions and sign-in protection — approved

- Per-account **Devices & Sessions** displays active sessions and available sign-in history; allow remote individual revocation or sign-out everywhere. Optional alerts for unfamiliar sign-ins. Strong authentication for sensitive account changes.
- **Adaptive security:** optional additional sign-in verification for everyday entry; mandatory stronger reauthentication on critical actions including household ownership/guardian transfers, account deletion, and permission escalation. Prefer supported passkeys/authenticator methods, with compatible recovery options.
- **Recovery:** one-time backup codes, previously registered alternative methods, and carefully verified fallback recovery. Protect recovery requests with owner-facing notifications and audit records. No guardian, household owner, or approver automatically gains another adult's account access.
- **After fallback recovery:** restore everyday access, but enforce a **48-hour protection period** on high-risk account/household changes, with clear countdown and audit. Ordinary sign-ins and use of standard backup credentials should not trigger this restriction automatically unless explicitly warranted.

## 9.3 Lost devices, cache control, and offline caveats

- On session revocation, immediately deny server access; instruct the PWA to delete cached account records and offline documents **when the revoked app/device successfully reconnects and executes the cleanup**.
- Remote deletion cannot be promised on a device that stays offline or does not run the app; files independently downloaded to Files/Finder are outside the app's revocation control. Use supported browser/device storage protections, short-lived secrets, lock screens, and encryption to reduce exposure.
- Offline access/editing must record pending operations and their origin. On reconnect, merge non-conflicting edits, surface meaningful conflicts for review, retain previous versions, and never silently overwrite authoritative changes. Show states such as local saved, sync pending, sync conflict, and sync failed.
- Real-time online updates should keep multiple household members in sync without assuming all devices are constantly connected.

## 9.4 Account deletion — approved

- An adult may request **standard deletion with a 30-day cancellation window** or an explicitly confirmed **immediate-start deletion** after stronger identity verification.
- Review household ownership, child guardian responsibilities, record ownership, permitted legal retention, and other affected users before account deletion. Explain what private data is erased versus what authorized shared household data remains.
- “Immediate” means skipping the voluntary recovery period and beginning deletion, **not** guaranteeing instantaneous removal of all backups, compliance records, or external downloads. Account deletion is separate from the normal 90-day Recently Deleted mechanism.

# 10. Onboarding & Personal Configuration

- Offer **Guided Setup** and **Quick Start**, with skip/resume options; no fabricated personal tasks or financial records.
- Quick Start: choose relevant life domains and top one to three current priorities. Place associated widgets and shortcuts prominently. For the owner, initialize Romantic Dark Academia as the preferred theme, without forcing it on other users.
- Profile preferences include categories/colors, source selection, household aggregation, widget layouts, theme, display density, sound/haptics, accessibility, notification privacy, and integration permissions; synchronize settings across devices where technically possible.
- Child onboarding must use age-appropriate entry and guardian settings, and should not be opened to actual children until required privacy and consent controls are verified.

# 11. Proposed Engineering Foundation (To Validate)

## 11.1 Environments and ownership

- Keep **existing production/prototype Netlify deployment + Supabase project** intact during development. Use separate Netlify test deployment, separate Supabase project/database, isolated storage, and separate integration credentials/redirects whenever supported.
- Preserve a distinct local-development mode and fictional seed data. Never reuse real production keys, records, or OAuth grants in public demonstration fixtures. Keep secrets server-side, with least-privilege authorization.

## 11.2 Core data entities and consistency

- Proposed major entities: accounts/profiles; households/memberships/roles/permissions; records and category labels; tasks/routines/events/projects/goals; programs/courses/assessments; accounts/transactions/budgets/bills; files and record attachments; integrations and sync cursors; suggestions/approvals/automation rules; comments/activity/version history; exports/imports; device sessions; notification preferences; snapshots.
- Every shared record needs explicit owner, household membership context, creator, permission policy, timestamps, status, and sync/version identifiers as appropriate. Child and financial data require especially strict separation.
- Use server-side provider sync jobs, event ingestion and deduplication where applicable; show source IDs and freshness. External integration access does not imply permission to send data to unapproved automation/AI providers.

## 11.3 Performance and operability

- Implement accessible loading/empty/error/stale states, retry and rate-limit handling, telemetry without sensitive payloads, migration/version compatibility, and documented backup/restore procedures.
- Validate actual browser-level feasibility of scheduled summaries, push reminders, background sync, offline encryption, biometric locks, scanning/OCR, and remote cache deletion on each target platform; provide accurate fallback behavior rather than claiming universal support.

# 12. Phased Delivery Roadmap

## Stage 0 — Isolated, secure foundation

**Deliver:** separate environments; identity and household permission model; base schemas; protected offline-cache strategy; core cross-device sync; themes/layout primitives; backup/restore approach; test fixtures; minimal navigation.  
**Gate:** production untouched, access isolation tested with multiple accounts, development data clearly fictional, secrets configured safely.

## Stage 1 — First complete vertical slice: Intelligent Daily Brief

**Deliver:** functional Daily Brief (not final artistic polish), core records and actions, calendar source, email insight flow, finance insight flow or verified connector fixtures, permissions, approval queue, source freshness, and Daily Brief settings.  
**Gate:** realistic end-to-end test scenarios pass; no invented current data, cross-source duplicates, permission leaks, or silent sensitive changes.

## Stage 2 — Personal workspace and essential household foundation

**Deliver:** The Curation, Quick Add, global search, Home, Calendar, Personal Life, Work, School, Finances, categories/colors, core widgets, shared tasks/groceries, adult invitations, household owner/access rights, and protected cross-device preferences.  
**Gate:** owner can reliably use the core app solo; household model passes separate fictional-account tests before real invitations.

## Stage 3 — First-release connected intelligence

**Deliver:** validated Google Calendar connection plus supported email and read-only financial connectors; supported cross-app automation rules, suggestion approvals, audit/Undo, data freshness and disconnection handling.  
**Gate:** each real connector is individually permission-reviewed and tested; no provider advertised as supported solely from a prototype or mock data. Advanced automation is delivered as a defined, audited set of cross-domain workflows.

## Stage 4 — Stabilization and intended visual polish

**Deliver:** finalize the four themes and saved custom themes, refine typography and romantic Dark Academia styling, responsive spacing and layouts, accessibility and interaction states, device QA, performance and failure handling.  
**Gate:** visual finish on approved first-release functionality plus WCAG-aligned usability checks and platform-specific validation.

## Stage 5 — Private release and staged transition

**Deliver:** selective migration preview, final backups, migration verification, owner acceptance, production switch after explicit approval, and a working rollback process.  
**Gate:** acceptance checklist complete, production data preservation confirmed, responsible rollback rules for any post-launch edits established.

## Later releases — Retained commitments

Expand document scanning/classification, sophisticated historical summaries and exports, deeper family rewards/guardian transfers, advanced predictive planning, additional providers and automations, and other approved features that cannot safely or realistically ship in the first slice. **Later release** means staged implementation, not cancellation of prior design decisions.

# 13. Test Strategy & Definition of Ready

## 13.1 Gradual real-data approach — approved

- **First:** fictional email/calendar/banking/household/school fixtures in isolated development systems.
- **Then:** technical/security checks: tenant isolation, consent scopes, duplicate handling, sync fidelity, sensitive-data protection, audit and undo, error recovery.
- **Next:** reauthorize Google Calendar and connect supported real email and financial providers **one at a time with explicit owner consent**. Validate each source before using its real information in intelligence features.
- **Finally:** owner-only day-to-day tests on MacBook, iPhone, and iPad. No family invitations until the personal core meets owner acceptance. Test household role sharing with fictional accounts first.

## 13.2 Acceptance checklist — build gates

- [ ] Existing deployment and database remain unchanged throughout development; rollback backups are verified.
- [ ] Individual profiles and households have proven server-side isolation; locked data never appears through search, widgets, brief, notifications, or exports.
- [ ] Brief accurately cites/links permitted source records; reports stale/disconnected sources and suppresses duplicates.
- [ ] Approved integrations handle authorization, refresh, revocation, source freshness, and errors without leaking credentials.
- [ ] Every automation honors Automatic/Ask/Disabled, mandated approval exceptions, audit, and safe undo.
- [ ] School official-plan ordering and custom accelerated-plan ordering remain distinct; financial totals and transaction matching reconcile correctly.
- [ ] Household permission, approver, and guardian rules pass multi-user tests prior to inviting real household members/children.
- [ ] Offline edits, conflict resolution, version history, remote session revocation, and cache handling are tested against documented platform limitations.
- [ ] Responsive navigation and the selected theme display properly across target devices with readable contrast and accessible controls.
- [ ] Migration preview, duplicate checks, full backup, partial-selection verification, and rollback have been rehearsed.
- [ ] Owner explicitly accepts the new release and authorizes the staged cutover.

# 14. Migration, Cutover & Rollback

- Original version remains authoritative until owner authorizes cutover. Build the redesign in a separate test environment with a documented mapping from old to new fields.
- Preview eligible records and preferences by category; flag incompatibilities and exact/fuzzy duplicates; offer merge, skip, keep both where appropriate; exclude fictional test data from the live import.
- Take a verified final backup of the original app/database and the destination just before the cutover. Freeze or otherwise reconcile writes during migration to avoid two conflicting authoritative versions.
- Compare record counts, ownership, associations, sample records, and integration status after import. Require explicit final approval for the production switch. OAuth integrations may require fresh authorization.
- Retain original app and data safely for rollback. Define how new edits made after launch will be exported or reconciled if rollback is required; do not silently discard those edits or leave both versions writable with ambiguous authority.

# 15. Design Reconciliation & Open Technical Questions

**The following are not requests for more aesthetic decisions. They are decisions to clarify or feasibility checks to complete before the related feature is built.**

1. **First-release scope vs. development order.** The owner explicitly chose calendar, email, and financial integrations **and** advanced cross-app intelligence for the first private release. Our roadmap must preserve that commitment while shipping a narrow tested Daily Brief first internally. If particular providers prove unavailable or costly, communicate that blocker and obtain an explicit revised launch decision rather than silently reducing scope.
2. **Automation exception.** The latest per-automation Automatic setting is limited by prior stronger rules: email-derived tasks/events and sensitive actions require approval; financial connections cannot transact. Classify risk and exception rules in a published capability matrix before coding.
3. **Child features vs. solo-first testing.** The first private release targets family essentials, but the owner will test alone first. Use synthetic adult and child accounts for authorization tests, then invite adult household members only on owner approval. No real child enrollment until guardian, privacy, and compliance gates pass.
4. **Offline access vs. remote wipe.** Reconnect-triggered clearing is best-effort and depends on device/app execution. Define cache encryption, device lock, storage boundaries, and what downloaded files fall outside the app; disclose limitations in the UI.
5. **Theme work timing.** Detailed styling happens after functional workflows, but the design-token, responsive, layout, and accessibility architecture must exist in Stage 0 to avoid refactoring the entire app.
6. **Financial data and AI.** Decide which email and finance fields can be used by any optional AI service, under what consent and retention rules; default to minimal data and local/rule-based handling when possible. Validate institution/provider support, fees, and developer-app approval requirements before claiming Phase 1 readiness.
7. **PWA platform differences.** Some offline, biometric, notification, OCR, and background sync features may differ by iOS/iPadOS/macOS/browser. Define tested fallback paths and never equate a product promise with a platform guarantee.
8. **Migration of auth and permissions.** User accounts, sessions, and third-party OAuth grants cannot simply be copied as ordinary records. Determine verified identity mapping, household role continuity, encryption keys, and safe reauthorization pathways.
9. **Operational data retention.** Confirm precise operational policies for security logs, backups, user-requested deletion, and 48-hour recovery restrictions against infrastructure capabilities and applicable laws before enabling real users.

# 16. Next Concrete Work Package (Requires Owner Approval Before Building)

**Deliverable A — Architecture and data model:** produce actual Supabase schema/RLS proposal for profiles, households, roles, core records, integrations, versions, and approvals, with a threat-model checklist.  
**Deliverable B — Screen map and user flows:** functional wireframes for Daily Brief, The Curation, six pages, Integrations, automation approvals, and My Account. Do not spend time on ornate detail yet.  
**Deliverable C — First milestone test cases:** fixture examples for an email appointment, calendar conflict, upcoming bill, school assessment, household chore, stale connection, denied household access, and reconnect conflict.  
**Deliverable D — Integration feasibility audit:** document actual supported calendar, email, banking/brokerage APIs, access requirements, fees, scope restrictions, and deployment credentials before using real information.  
**Deliverable E — Step-by-step build order:** break Stage 0 and Stage 1 into small testable increments, each with owner-visible acceptance results.

**Decision requested:** Review and approve this consolidated blueprint as the working design baseline, or note corrections. No app rebuild, database changes, OAuth reconfiguration, or production migration should begin solely because this document was produced.
