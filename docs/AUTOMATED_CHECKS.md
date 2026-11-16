# Automated browser tests and GitHub checks

Prepared November15,2026. Latest local acceptance:1,662 Node tests plus32 Playwright tests pass. The latest local follow-up is recorded below; the published GitHub run still reflects the earlier snapshot. The complete candidate source was copied into a clean temporary Git folder with no .env.local, .local directory, credentials or recovery files; npm ci --ignore-scripts, check:offline and test:browser passed there too. GitHub execution now passes; completed evidence is recorded below.

## Run locally

```
npm ci --ignore-scripts
npx --no-install playwright install chromium
npm run check:offline
npm run test:browser
```

Playwright1.65.1 is pinned in package.json and package-lock.json. The suite runs five workflows at desktop and390px mobile viewport sizes in Chromium: sign-out/privacy/overflow, reviewed task creation and completion, multiline literal-markup note creation, reviewed all-day event creation, and manually opened/hidden saved-source panels. This is browser emulation, not physical-device or Safari certification. Browser errors fail tests. External browser requests are blocked and fail the suite. Failure screenshots contain fictional data only and remain in ignored test-results; traces/videos are off.

The test server is exclusively fictional, in memory, bound to127.0.0.1:5316. That port cannot be used by the real development-account factory. Each test resets this isolated fixture only, preserving sign-in rate protections in the actual app. Config/API dependency guards reject real config/API construction. Test startup refuses an occupied server instead of reusing it. It does not open the actual workspace, access credentials/providers/backups, or write a database.

## GitHub workflow

.github/workflows/checks.yml defines separate Tests and privacy and Browser workflows jobs on push, pull_request and manual dispatch. Uses Ubuntu24.04, Node24, fixed verified commit SHAs for checkout v6 and setup-node v7, read-only repository permissions, no persisted checkout credential, no application secrets, no deployment and15-minute job timeouts. Installs zsh for Mac launcher syntax verification. Dependencies use locked npm ci with lifecycle scripts disabled. Browser job installs Chromium and runs the same fictional tests. No screenshot/archive upload configured. Key-recovery files and browser reports are ignored; the privacy scanner now rejects tracked .cckeyrecovery files too.

Reviewed official references: https://playwright.dev/docs/ci , https://playwright.dev/docs/test-webserver , https://github.com/actions/setup-node . Action commit identities were checked against official repositories.

## Publication gate

GitHub Desktop fetched origin successfully. Browser confirmed LiveCuratedChaos/Curated-Chaos is private and Actions is available with no existing workflows. Remote main is still initial8d3e8a9 (November8 original project). The newer app server and much of its tested source remain uncommitted locally. Publishing the workflow alone would leave its dependencies missing. No files were staged, committed, pushed or merged, and no repository permissions/settings changed. Owner decision required for the larger current privacy-checked app snapshot: save it on codex/browser-checks and publish to the existing private repo, then verify actual Actions results; keep main/live app/database unchanged. Do not claim hosted checks active before successful publication and a real run. Local proof: /private/tmp/curated-browser-github-checks-prepared.png.

## Published and verified

Owner explicitly approved publication of the whole privacy-checked current app snapshot. Created codex/browser-checks, committed425 changed files as283ee32, and published through the already authenticated GitHub Desktop. Staged privacy scan also passed with zero private paths/findings. Main and origin/main remain8d3e8a9. No merge, deployment, database change, real provider call, credential grant or app restart.

Actual Linux acceptance revealed two Mac-specific temporary-directory assumptions and three intentionally skipped macOS-native tests. Fixed temp storage to use node:os tmpdir, explicitly excludes only mac-calendar-native-transfer.test.mjs on non-macOS (report lists that exclusion and still rejects unexpected skips), and runs those three tests in a separate macos-15 job. Corrected an initially retired macos-14 runner label after checking GitHub runner-image documentation. Failure-only diagnostics run fictional tests only; no app secrets exist on runners.

Final published commit25f7d65451929df870fbf8015cbeb6d339087f17 passed run43678356748:
https://github.com/LiveCuratedChaos/Curated-Chaos/actions/runs/43678356748
Tests and privacy: success (1m40s); Browser workflows: success (43s,10 passing tests); Mac Calendar native checks: success (12s,three native tests). Portable suite has1,651 tests; all1,654 including native tests pass locally on the Mac. Screenshot /private/tmp/curated-github-checks-passed.png. Branch workflow runs automatically on subsequent pushes and pull requests. It is not installed on main until a separately approved merge. Final evidence documentation updated locally after the successful run; no extra documentation-only test run was triggered.

## November15 local core-workflow/accessibility follow-up

Browser suite expanded to26 passing cases: reviewed task editing/checklist preservation, edited-note removal/restoration, multi-day calendar editing, uncertain-save draft copying, two-session stale-note protection, core-page/editor accessibility and all seven theme palettes. @axe-core/playwright4.14.0 is pinned and runs inside the existing no-external-request fictional tests. Automated WCAG A/AA scans detect common issues only; no rule exclusions, no claim of full certification. Fixed actual contrast/disclosure-size/calendar-label problems. All1,654 local offline checks also pass. These follow-up changes are local and have not yet run in GitHub or the pinned Cloud environment. No hosted/live/DB changes.

## November15 full-workspace HTTPS candidate

All1,662 local offline tests and28 browser checks pass. The full-workspace HTTPS adapter reuses the existing sign-in boundary without expanding the old auth-only adapter. Node tests cover protected core reads/reviewed writes, strict TLS/host/origin checks, source route exclusion and optional separately scoped password recovery. One test starts a real TLS listener with an ephemeral fictional certificate and verifies the certificate; temporary files are removed. Two new desktop/narrow-screen browser cases use intercepted fictional HTTPS responses to verify secure HttpOnly cookies, reviewed saves, no browser-stored tokens and sign-out denial. The browser interception is not a real TLS handshake; the separate Node check supplies that evidence. No real credentials, database or provider access. These follow-ups remain local until publication; existing successful GitHub evidence above is unchanged.

## November15 recovery and restart acceptance

Four additional desktop/narrow-screen cases verify full-workspace recovery navigation, focus progression, mismatch rejection, one fictional approved password change, recovery-cookie separation/cleanup, and fresh sign-in after server restart rejects the old cookie. All32 browser checks and1,662 offline checks pass. Browser responses are intercepted fictional HTTPS; no email or external API calls, no database writes and no claim of persistent server sessions. Current policy requires sign-in after a restart.

## November15 published review checks

Published13 code/dependency files as remote53d76110888862fc5394bdb41e0c62f7ddf5ec30 on codex/release-readiness. Draft PR1 targets codex/browser-checks, not main: https://github.com/LiveCuratedChaos/Curated-Chaos/pull/1 . All three jobs passed in run43790161507: https://github.com/LiveCuratedChaos/Curated-Chaos/actions/runs/43790161507 . Tests and privacy, Browser workflows and Mac Calendar native checks each report success. The current source includes32 browser cases; local Mac acceptance remains1,662 offline tests. Documentation checkpoints remain local; no credentials/private files, merge, deployment, database change or pinned Cloud revision update. Local5397620 includes the same code plus documentation and was not rewritten to the service-created remote snapshot commit.
