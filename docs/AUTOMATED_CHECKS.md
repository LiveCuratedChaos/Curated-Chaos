# Automated browser tests and GitHub checks

Prepared November15,2026. Latest local acceptance:1,717 Node tests plus46 Playwright tests pass. The latest local follow-up is recorded below; the published GitHub run still reflects the earlier snapshot. The complete candidate source was copied into a clean temporary Git folder with no .env.local, .local directory, credentials or recovery files; npm ci --ignore-scripts, check:offline and test:browser passed there too. GitHub execution now passes; completed evidence is recorded below.

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

### November17 local hosted-run reduction

The local candidate now runs automatically for pull requests and pushes to `main`, with explicit manual dispatch retained for unpublished branches. Feature-branch pushes no longer start a second copy of the same three-job suite alongside the PR run. All PR targets remain supported, including the existing development-to-development review branches. No path exclusions were introduced, so a documentation-only PR still receives check results rather than leaving required checks pending. Existing concurrency still cancels superseded runs for the same PR/ref.

Removed the automatic second full `npm test` run after any offline-job failure; `check:offline` already runs the full portable test suite and reports its counts and failing gate. Investigate locally or rerun only a failed hosted job when needed. All three jobs, action pins, read-only permissions and manual dispatch remain intact. No publication, hosted run, billing setting or paid usage change was performed.

Read-only remote inspection on November17 verified the repository remains private and PR2 is already merged. Its last head `14e691b811ffd9b1527491c9ddf46627eb65f00e` has successful PR runs43953389915 (App checks) and43953389991 (Disposable project concurrency). The latter workflow exists in the newer remote work, outside this older checkout, and should be preserved when reconciling source. These successful run results do not establish current remaining Actions minutes: connected read tools do not expose billing/quota. No quota-exhaustion conclusion or paid fallback is claimed. The trigger changes above remain local until deliberately published; remote workflows have not changed.

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

## November15 household/recovery follow-up

Four new offline checks apply every numbered migration and verify current household section rights, departure/private retention, session revocation and a full isolated-engine snapshot restored into a different engine. The restore tests actual RLS, grants, triggers, functions and unique protections, then invalidates restored old sessions before testing fresh access. No hosted database/configuration or real data is used. Offline total1,666; browser code remains the previously verified32 cases. These new checks are not yet included in the published review run recorded above. See DATABASE_RECOVERY_ACCEPTANCE.md for the remaining hosted recovery gate.

## November15 keyboard/cross-tab checkpoint

All36 local browser cases pass. Four new desktop/narrow-screen cases verify keyboard focus/shortcuts, read-only Escape behavior, retained unsaved note text and cross-tab sign-out clearing an open private note. No application logic changes were required. Household/recovery source45ef99cf501f19f41d0a5c11aca089dfe707c978 passed all three GitHub jobs in run43791154499, before these four browser cases were added. Offline total remains1,666. No physical-device/screen-reader certification is implied.

Latest review acceptance: remote7ed77da768f82c09fc127bc55ba06b41e9a53aed passed all three jobs in run43791968090 (https://github.com/LiveCuratedChaos/Curated-Chaos/actions/runs/43791968090), including the36-case browser suite and new household/full-engine recovery tests. Draft PR1 remains unmerged; no deployment.

## November15 recurrence preparation

Fifteen new pure-model/draft tests verify anchored schedule calculations and unchanged source views, including UTC/New York/Apia child-process checks for a civil date skipped by a historical local timezone. Offline total1,681. No UI imports/routes were added, so existing36-case browser evidence remains applicable without a new browser run for these dormant helpers. Recurrence activation still requires atomic database and browser acceptance; see TASK_RECURRENCE.md.

## November15 reviewed recurring saving

All1701 offline tests and40 browser cases pass. New real offline PostgreSQL tests cover atomic completion/successor insertion, exact and conflicting replays, rollback on successor collision, stale/expired/cancelled reviews, competing requests, wrong account/revoked-session denial, SQL/calendar-model agreement, corrupted acknowledgements and unchanged successor after historical reopening/recompletion. API transport is opt-in, fixed-RPC-only and never retries. Browser recurrence is enabled only in the fictional fixture, with review/approval/cancel and reopening checks at both viewport sizes; its review passes axe checks. Source API/UI changes required full offline and browser reruns. Migration007 is prepared only; no hosted execution. Test loader now strips all top-level import lines rather than assuming one; all204 controller tests pass.

## November15 hosted recurring acceptance

Supabase connection verified and migration007 installed only in the exact development project (ledger20261116025549). A separately offline-tested rollback script verified atomic/duplicate/rollback/history/account/session behavior using three fictional task rows and two temporary session rows; final result passed with no QA rows or sessions persisted. All1702 local offline checks and40 browser cases pass. The launcher now opts in on its next ordinary launch; no open service/tab was restarted. Source5f5ef5de16ba8e2f75cc9e3549e488c0269a84cb passed all three GitHub jobs in run43794779343 before the final launcher/script follow-up. No real app records, credentials/providers or production changed.

Final recurring review polish: source-progress assertions now distinguish the completed occurrence's remaining steps from the successor's fresh open steps. All1702 offline and40 browser checks pass after that correction. Activation source06e640e passed all three jobs in run43795588494 (https://github.com/LiveCuratedChaos/Curated-Chaos/actions/runs/43795588494); the final UI/count follow-up is published separately. No migration changed after hosted verification.

Final recurring source024f3d7b11f91c9b7a8b5c619b9a85a9a4243d62 passed all three jobs in run43795931718: https://github.com/LiveCuratedChaos/Curated-Chaos/actions/runs/43795931718 . Local acceptance1702 offline/40 browser cases. Final narrow recurring review visually inspected, correctly shows current progress and fits horizontally. Hosted development rollback acceptance/cleanup passed; enabled on the next ordinary private-workspace launch, with no owner browser restart. No production change.

## November15 reviewed stop-repeat follow-up

All1709 offline checks and44 browser cases pass. Seven new model/service tests cover reviewed stop preservation, completion/reopening without a successor, stale/expired/wrong-owner and conflicting reviews, lost acknowledgement, competing stop saves and ordinary editing after stopping. Four desktop/narrow browser cases verify stop approval/cancel and the absence of another successor. Active-series editing is constrained to the existing next-copy limits to prevent breaking recurrence; stopped tasks keep ordinary limits.

Extended rollback SQL verifies version-filtered stopping, stale-update rejection, exact retained payload/series identity and cross-account denial. It passed offline and in the exact development database, with no QA records/session rows left saved. No migration or existing-data change. Source privacy and launcher checks pass. Owner UI/service was not restarted; next ordinary launch picks up the new controls.

Final stop-repeat source207c66d3d251f471d37ff822cad54a473f73a915: all1709 local checks and44 browser cases pass. The initial repeat setup has no Stop action until a recurring occurrence is saved. Mobile stop review visually inspected; no horizontal overflow. Temporary fixture cancelled/signed out/stopped. Hosted development rollback passed and cleaned up all QA rows/sessions. All three jobs passed in GitHub run43798044296: https://github.com/LiveCuratedChaos/Curated-Chaos/actions/runs/43798044296 . Draft PR1 remains unmerged.

## November15 full-match Calendar month summaries

All1717 offline and46 browser checks pass. Eight new tests verify paging-independent counts/two-title previews, no identifiers/details or hidden action handles, range/title filters, overnight/midnight/all-day semantics, malformed-summary rejection, leap/2100 boundaries, legacy partial fallback and fixture isolation. Two desktop/narrow browser cases seed120 fictional events, page50/50/20 results, verify invariant full month counts and accessible review/grid controls. The scenario is restricted to the fictional5316 factory/fixture, never real config or owner/staging ports. No database/provider/schema/dependency changes or owner service restart.

Final Calendar summary source d11ec2724601db24fa972795fdf73b2676a76742 passed all three GitHub jobs in run43800360199: https://github.com/LiveCuratedChaos/Curated-Chaos/actions/runs/43800360199 . Earlier run43799702528 and its retry failed at repository checkout, not app execution. Read-only API access diagnostics print only HTTP status using the existing ephemeral runner token; action pins, contents:read and no-persist cleanup remain unchanged. Checkout recovered on the next run; cause unproven. Local1717/46 acceptance remains valid. Mobile month summary visually inspected and temporary fixture stopped. No owner/app/database/provider/production changes or Cloud pin update.

## November15 private project acceptance

Current local acceptance:1,732 offline checks and52 desktop/narrow-screen browser cases; privacy, whitespace and launcher checks pass. Project tests include reviewed create/edit, sparse listing, exact text, stale versions, cancelled late responses, one-use approval, uncertain-save retention, account privacy, protected HTTPS paths, encrypted fictional backup round-trip and rollback-only database QA. The development QA left no project/session test rows. Source publication and CI verification pending; prior run43800360199 covers the preceding Calendar source only.

Project text-boundary follow-up: all1,732 offline checks pass after aligning project review request size with the10,000-character editor contract. Added full-length Unicode/no-write transport coverage. Existing52 browser checks passed before this server-boundary-only correction; the final GitHub run will verify the combined source.

Final project source1be01bbdaf920b5fc80a681f9934555394810a61 passed all three GitHub jobs in run43804598198: https://github.com/LiveCuratedChaos/Curated-Chaos/actions/runs/43804598198 . This supersedes the earlier pending publication/CI notes for the project checkpoint. Local1,732 checks/52 browser cases; Linux portable suite excludes the three native Mac checks, which run in their separate successful Mac job. No rerun of tests is required for this evidence-only documentation update.

## November15 project membership acceptance

All1,755 local checks and58 desktop/narrow-screen browser cases pass. New coverage includes private membership transport, one-use reviews, source preservation, target/owner/version checks, canonical pair restoration,50-project limit, atomic rollback on inheritance failure, both-project successor inheritance and backup/restore dependency guards. Hosted development rollback QA verified8 fictional records/two temporary sessions with none persisted. A separate helper-permission test proves automatic RLS remains active after removing client EXECUTE. Final source publication/CI is pending; run43804598198 covers the preceding project-basics checkpoint only.

November16 final membership source818dfb7817bd4b8ead63a77324dc5d635f1dbd9b passed Tests/privacy, Browser workflows and Mac Calendar native checks in run43807165653: https://github.com/LiveCuratedChaos/Curated-Chaos/actions/runs/43807165653 . This supersedes the pending CI note above. Final local acceptance1,755 tests/58 browser cases; no additional code changes after verification.

## November16 optional progress and project browsing

Current local acceptance:1,766 offline checks and62 desktop/narrow browser cases, with privacy/whitespace/launcher checks passing. Added saved progress option tests, sparse recurrence metadata transport, complete60-task filtered/paged summaries, empty/invalid/stopped recurrence and native progress accessibility, exact task/link preservation, archive round-trip and read-only project filters. Extended rollback-only QA passed in development with no QA records/sessions persisted. The local QA first caught an ambiguous SQL test alias; it was corrected and passed before any hosted QA execution. No production/schema changes. Current source publication/CI pending; run43807165653 covers the preceding membership checkpoint only.

Final optional-progress source d0354685a7c6b884d40e5c9391b4e55740361543 passed all three GitHub jobs in run43809845419: https://github.com/LiveCuratedChaos/Curated-Chaos/actions/runs/43809845419 . This supersedes the pending source/CI note above. Local1,766 tests/62 browser checks; portable Linux excludes the three native Mac cases covered by the separate successful Mac job. No additional code changes after verification.

## November21 read-only source/CI recheck

Repository metadata still reports private. Connected tools expose workflow metadata/status but no billing/quota endpoint; remaining Actions allowance is unverified. No hosted runs, publication, workflow dispatch or spending changes were triggered. Local checks.yml retains offline/browser/Mac-native checks and feature push/PR deduplication. The separately useful remote project-concurrency.yml must be preserved when source is reconciled; do not copy its workflow without its disposable verifier/dependencies or infer that it accepts current local source.

Newer remote source was pinned read-only at a6a7f33d0086cf739d8e4963ea61eac65854b6d0. Durable/manual autosave modules there are explicitly unmounted foundations, absent from this original working checkout. Their reported earlier browser/SQL results are inherited evidence only. See verification/REMOTE_SOURCE_AUDIT.json for exact source blobs and constraints. No shared source or Git history was overwritten.

Browser environment guidance was also checked for an isolated alternative. No environment-status/desktop-control/preview tools are exposed. Configured Chromium previously failed before page execution under macOS bootstrap permission1100; it was not retried unchanged or bypassed. No installed local PostgreSQL server/client/container commands were found in the checked standard locations; true concurrent PostgreSQL acceptance remains unverified. No installation or database changes were attempted.

### November21 managed-sandbox offline-check attempt

After the convergence-preview checkpoint, `npm run check:offline` was run in the managed workspace. The local test subprocess reported3,106/3,136 passing,30 failing, with failing listener-based cases including `listen EPERM: operation not permitted 127.0.0.1`; the checker intentionally suppresses detailed test output. Privacy/content, whitespace and launcher checks passed. A direct spec-reporter run confirmed the listener error but is not evidence that every failing test shares that cause. The full gate is therefore **inconclusive in this sandbox**. Do not request or attempt a permission bypass. The five new contract tests pass independently. The prior3,144/3,144 result remains historical evidence only.


## November 22 local CI efficiency follow-up

Removed the duplicated GitHub repository-contents API preflight from the offline, browser and Mac-native jobs. The already-pinned `actions/checkout` step performs the required repository fetch and fails directly if access is unavailable, so the extra authenticated `curl` requests added no distinct verification. All three jobs, triggers, action pins, timeouts, read-only permissions, locked dependency installation and test commands remain. Local Ruby YAML parsing and `git diff --check` pass. No hosted workflow was dispatched, and Actions quota remains unverified; no paid usage or publication occurred.

## November 22 local verification

On macOS, `npm run check:offline` passed all 3,363 tests, privacy/content scanning, whitespace and launcher syntax. The runner uses up to five workers, bounded by available processors. Native Calendar tests compile with a temporary Swift module cache and remove it at teardown. The release evidence JSON records the counts. No hosted job was triggered.
