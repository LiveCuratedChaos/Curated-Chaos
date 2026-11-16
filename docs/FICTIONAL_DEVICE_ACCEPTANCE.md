# Prepared Mac fictional-device acceptance handoff

**Prepared only; not executed or authorized by cloud-development approval.** Cloud code/tests and the approved private draft review are separate milestones. Physical Mac/Safari behavior remains a distinct acceptance gate that Linux and GitHub's isolated Mac runner cannot certify. This package asks for bounded execution in the owner's existing Mac-side chat; it does not grant access to real Calendar or other private data.

## Proposed scope requiring owner approval

Run isolated Safari/UI and native-fixture checks on the owner's Mac using the tested source from draft PR2: https://github.com/LiveCuratedChaos/Curated-Chaos/pull/2. Preserve the running app, original checkout, tabs, drafts, sessions, existing ports and caches. Do not update or restart the owner preview, merge code, deploy, change a database or grant permissions. Do not open .env/.local/configuration/keys/backups or any real Calendar/mail/finance/note panels. Stop at missing access, an occupied test port, a native permission prompt, a real-data response or an unapproved network/device requirement.

A Mac-side execution chat must first verify its actual device/workspace and local AGENTS.md/start instructions without disclosing private contents. Confirm the existing originating Mac-side chat and its actual device before sending a handoff; do not assume that any cloud chat has access to the Mac. No message to another chat is authorized until the owner approves this handoff.

## Bounded preparation

1. Read PR2's current description for the exact published/tested SHA and passing checks; verify remote refs rather than using the saved old cloud baseline. Create a fresh source-only clone in an exclusively named temporary test folder using existing authorized Git access. Do not change the original Mac checkout or copy its private configuration. If existing Git access is unavailable, report the access blocker; never print credentials or use a token-bearing URL.
2. Inspect prepared Node/dependencies first. Reuse installed compatible tools/caches; if necessary, use the locked `npm ci --ignore-scripts` in the new source-only folder. No subscriptions, paid add-ons, new accounts or provider grants. Do not run setup/reuse scripts or launchers that load real app configuration.
3. Run `npm run check:offline`. On a Mac this includes the native transfer fixture file; report the actual count and all skips/failures. `node --test tests/mac-calendar-native-transfer.test.mjs` may run separately only after confirming it still uses explicit synthetic fixture mode and no actual EventKit account read or permission request.
4. Inspect port5316 ownership without disturbing any listener. If free, start only `node tools/browser-fixture-server.mjs` from the new source folder and retain its exact child PID/cwd/command. It uses in-memory fictional records and configuration/API construction guards. Never start a real-config server or clear an occupied port. The existing owner app on its normal port is outside this package.

## Fictional Safari journeys

Use a new disposable Safari profile or another independently isolated browser context that cannot share the owner’s cookies/storage. A new tab in the owner profile is insufficient because cookies are shared across ports; existing private windows may share their own storage too. If safe isolation is unavailable, stop. The guarded fixture port uses its own `cc_workspace_fictional` cookie as additional collision protection; normal/staging cookie names remain unchanged. Then open a new fixture tab to `http://127.0.0.1:5316/dev-tasks.html`; use only `demo@example.test` / `fictional-only`. Verify that the app visibly contains fictional records. Never reuse the owner's real sign-in.

- Create two larger projects and a shared subproject. Review linking the same subproject to both. Reject self/indirect cycle attempts without a save. Keep project statuses manual.
- Link one fictional task to a subproject and, separately, its larger project. In the larger project's task panel, direct links remain the default. Explicitly Include subproject tasks; a shared task appears once even if reachable through several paths. Remove only its direct link and confirm its inherited membership remains visible. Search/page filtering must not alter complete progress counts.
- Open task details explicitly, including two tasks with identical titles and different dates/descriptions. Verify the exact selected record, literal markup, keyboard focus and clearing after close/sign-out. Do not infer copy/edit authority from the read-only project detail view.
- Verify keyboard review/cancel/save recovery with fictional data. Any failure injection must target this fixture server only. An acknowledged save plus unavailable list refresh must not repeat the write or claim verification. Preserve draft/search focus when background details expire.
- Visit the fixture Calendar workspace and verify saved fictional event date/filter journeys. Default fixtures do not enable real Mac Calendar access. Do not enable a native on-open source to test Pause; use only an explicit injected fictional client/response if repeating the automated Pause/freshness checks. The remembered real calendar selection is outside this scope.
- Verify sign-out and a second fixture tab clear private fictional details. Record actual Safari/macOS version, viewport, source SHA and keyboard behavior. Screenshots, if needed, must contain only the new fictional tab, never the desktop or existing real app.

## Cleanup and reporting

Stop only the fixture child whose PID/cwd/command were recorded by this run. Close only newly created fixture tabs. Preserve all original tabs, apps, previews, caches and worktrees. Report exact commands/counts, zero/nonzero skips, observed failures and any unverified native/provider/device behavior. Do not describe these fictional checks as real Calendar permission acceptance, owner-data migration, app activation or deployment.

Actual iPhone/iPad access may need an existing approved secure connection; this package does not create tunnels, publish a preview, expose a new network listener or approve new device/provider access. Stop and ask for that separate essential decision instead of treating desktop emulation as physical-device evidence. Full approved product scope remains retained.
