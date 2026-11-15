# Automated browser tests and GitHub checks

Prepared November15,2026. Local acceptance:1,653 Node tests plus10 Playwright tests pass. The complete candidate source was copied into a clean temporary Git folder with no .env.local, .local directory, credentials or recovery files; npm ci --ignore-scripts, check:offline and test:browser passed there too. Linux/GitHub execution has not run yet.

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
