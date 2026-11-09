# Curated Chaos — M3D Phase 2

This is a local, fictional-data development app. Current startup instructions and acceptance checks are in [M3D_PHASE2_START_HERE.md](M3D_PHASE2_START_HERE.md).

- Requires Node 18 or newer; no external package dependencies are declared.
- From this folder, use `PORT=5215 npm start`, then open `http://localhost:5215/dev-organize.html`.
- `npm test` runs local tests using fixtures and mocked cloud responses.
- `npm run check:setup` reads local credentials. `npm run setup:reuse` can copy configuration. `npm run test:rls` accesses the development cloud. These are separate from the offline tests.
- Existing local configuration is required for connected pages. Never share its contents.
- The static homepage is a separate fictional preview. Connected pages use the configured Supabase development project; no live provider integrations are implemented.
- No database migration or Netlify deployment is required for these local fixes.

## Historical milestone notes

The following M2C/M2D instructions are retained as history. Folder names, ports, and feature limitations may be outdated; use the M3D instructions above.

# Milestone 2D — Calendar (fictional development only)

**New:** `/dev-calendar.html` is the Calendar page in both desktop sidebar and mobile navigation. It provides Month (default), Week and Day views; tap a date to inspect its day schedule, add/edit private fictional events, filter calendar/category visibility and display due tasks, and save account-private preferences. New events store a selected reminder preference **without actually delivering any reminder or push notification**. No Apple Calendar, Google Calendar, finance, email or school provider is connected.

**Start:** Move the `Curated_Chaos_Development_Starter_M2D` folder to Desktop, then run:

```bash
cd "$HOME/Desktop/Curated_Chaos_Development_Starter_M2D" && npm run setup:reuse && npm run check:setup
PORT=5197 npm start
```

Open `http://localhost:5197/dev-calendar.html` using Development Test Account A. Earlier M2C Fixed backups should be kept; this version uses the same private isolated Supabase development database with no SQL changes. The prior `Active` project status now appears as `In Progress`; records remain compatible without migration. Follow `M2D_TEST_PLAN.md` for acceptance. All records are fictional.

---

## Milestone 2C — corrected visible subtasks

This version fixes a UI issue in 2C: saved subtasks now display directly on their parent task cards with completion checkboxes and a progress count. **Edit task** is only needed for adding a new subtask or editing task details. It uses the same private cloud records, so previously added subtasks remain saved. No database migration.

# Curated Chaos — Milestone 2C: Quick Add, Tasks & Projects

**Fictional-data development only.** Builds on tested M2B widget library. No original app, genuine bank, email, WGU, Apple Calendar, or actual household accounts are changed.

## What this step adds

- A **+ Quick Add** link in the common app header; create test tasks, projects, notes, and calendar events from one place
- A dedicated **Tasks** view with saved tasks, due dates, status and priority filters and task-edit forms
- A separate **Projects** view with personal projects, project status, optional details and calculated linked-task progress
- Create tasks attached to projects in the same area; edit task titles, sections, due dates, priorities, statuses, descriptions and linked projects
- Add and complete subtasks. Changes save to existing `public.cc_records` with the same authenticated owner and RLS policies.
- **Optimistic version checks** for edits. If another tab updated the same record, a stale save is refused, and the user is directed to refresh.
- Existing Milestone 1 and M2A–2B widgets, approval history, school/bill/household summaries and saved preferences continue to work.
- A new optional **Projects** widget can be added in My Curation. Existing dashboard layouts are preserved and are not automatically modified.

## Setup (Mac desktop)

1. Download the ZIP, unzip it and move the new `Curated_Chaos_Development_Starter_M2C` folder to Desktop.
2. Keep the old working `Curated_Chaos_Development_Starter_M2B` folder until you finish acceptance testing.
3. Open a **new** Terminal window and run:

   ```bash
   cd "$HOME/Desktop/Curated_Chaos_Development_Starter_M2C"
   npm run setup:reuse && npm run check:setup
   PORT=5195 npm start
   ```

4. Open <http://localhost:5195/dev-organize.html#quick-add> and sign in with Development Test Account A.
5. Stop this server with `Control+C` in its Terminal window whenever you finish. Cloud records persist.

`setup:reuse` only looks in known local previous **development** folders (M2B, M2A Fixed, M2A, M1H Fixed) for an already verified `.env.local`. It does not replace existing configuration or print your credentials. **No SQL migration needed**.

## Guided acceptance checklist

1. Quick Add a fictional project called **QA M2C — Home Reset** in the Home area, status Planned; save and refresh Projects. Confirm it stays saved.
2. Add fictional task **QA M2C — Check kitchen supplies**, area Home, due date today or tomorrow, priority High, and link it to that project. Confirm the task appears in Tasks and project shows 1 linked task.
3. Edit the task status to In Progress, add a subtask **QA M2C — Count supplies**, mark it complete. Refresh and confirm all values persist.
4. Mark the main task Completed and confirm project progress shows 1 of 1 linked tasks completed.
5. Navigate to The Curation, add optional Projects widget to the desktop layout, save and reload; verify its fictional project appears. Old task widgets and Dashboard layouts remain unchanged.
6. Sign in with Test Account B and verify it cannot see Account A's tasks or projects. Sign back into A; the data returns.
7. Optional: narrow Chrome window, confirm Quick Add remains accessible and forms are readable. True phone/tablet tests occur later.

## Intentional limits

- No real work or family data. This isolated test app is **not** safe for confidential employer records or real financial credentials.
- Tasks and projects are personal/private only; shared/household permissions are scheduled for 2K.
- Quick Add supports notes and fictional events; grocery items and routines will be added in 2H. Natural-language parsing, voice, and external calendar write-back are not implemented.
- A project’s progress is computed from its linked tasks; project **status** itself is manually controlled. An archived or deleted record flow is not implemented.
- Task completion changes saved from older Milestone 1 QA views preserve 2C metadata, but older QA views do not yet display those metadata fields. Use the new Tasks & Projects page to edit the richer fields.
- Same-record saves compare versions. Two concurrent first-time creates with identical titles can still create distinct records; database-level uniqueness and transactional cross-record operations are future work. Do not repeatedly click Save after an uncertain network response.
- Test login uses temporary browser-tab QA sessions. A production-grade identity/session, comprehensive accessibility audits, and real mobile-device QA are later work.

## Developer tests

```bash
npm test
```

**Do not deploy this local development server to a public host.**
# Local Google connection setup

The optional local connection gateway requires Node.js 22 or newer and the pinned Google authentication library (`npm ci` installs the locked dependencies). Start it with `npm run start:connections`, then open `http://127.0.0.1:5301/auth/google/`.

Register only this local callback in the separate development OAuth client:

`http://127.0.0.1:5301/auth/google/callback`

After explicit owner approval and client creation, keep the downloaded Web-client JSON only at `.local/google-oauth.json`, outside Git. Never paste its contents into a chat or copy it into public assets. Existing files must not be overwritten. The gateway starts in an honest unconfigured state when this file is absent.

Encrypted local connection data and the encryption key live in `.local/provider-storage/` with private filesystem permissions. This loopback gateway is development-only, with in-memory app sessions and local files; do not deploy it as production authentication. Google authorization alone does not import records: owner-approved label/calendar selection and sync are separate work.

The local Google connection area now uses its own server-held development session (up to 30 minutes). Sign in there with the existing development test account; the page does not retain app access/refresh tokens in browser storage. Server restarts require signing in again, while encrypted Google grants and source selections remain on this Mac. The original fictional workspace sign-in remains separate. **View saved source items** reads saved private snapshots without contacting Google. Real-content database imports remain disabled.


## Open the private workspace on this Mac

After the owner approves using the combined development preview, double-click `tools/Open-Private-Workspace.command`. It opens the private Daily Brief in the browser and keeps its local service in that Terminal window. Use the existing development account; never paste a password or key into chat. Keep the window open while using the preview; Control-C stops it and closes its server-held sign-ins.

This separate preview can show saved task/event display fields and note titles. Open a note to read its text. Adding/editing/completing tasks and editing notes requires an explicit review and approval in the interface. Temporary drafts clear when hidden or signed out. It does not refresh connected accounts, access backups/keys, migrate other workspaces or change the live app. Settings and connected-source snapshots remain in their separate flows. The launcher validates the exact development project and stops if its port is occupied; it never replaces a running service. Node 22+ is preferred, with the existing app-bundled runtime as a local fallback. The launcher does not install software, alter configuration or sign in automatically.


The optional local content check is `node tools/check-repository-privacy.mjs --scan-content`. It checks working candidates, staged copies and bounded ZIP contents without uploading or printing matches. It reports skipped binary copies explicitly and detects only recognized credential patterns; a clean result is not an exhaustive secret audit. The default filename-only check remains available without the flag.
