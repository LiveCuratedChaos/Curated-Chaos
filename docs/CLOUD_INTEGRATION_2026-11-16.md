# Cloud integration checkpoint — November 16, 2026

Full approved product scope remains in force. The current priority is projects/tasks and centralized view-only Apple Calendar, without new provider access or hosted writes.

## Source and environment

The selected managed Cloud environment reported running, connected, current observations and no failure. Git read access independently resolved `codex/release-readiness` to `d0354685a7c6b884d40e5c9391b4e55740361543`. Connected GitHub confirmed PR 1 open, draft and unmerged against `codex/browser-checks`. Remote head was checked again after implementation and remained unchanged.

The original `/workspace/Curated-Chaos` checkout remains clean at `25f7d65451929df870fbf8015cbeb6d339087f17`. Work is isolated in `/workspace/Curated-Chaos-integration`, branch `codex/cloud-integration-20261116`. No AGENTS.md was found in the workspace or repository. Read the approved blueprint, completion evidence, project progress and automated-check instructions before implementation. The unrelated unpublished Mac experiments were not used.

Original dependency cache was preserved. It lacked the release's axe browser dependency; an initial browser attempt stopped at import. `npm ci --ignore-scripts` installed the release lockfile in the isolated worktree. Node v24.22.1; npm 11.9.0; system Chromium 156.0.8078.79. The untracked `cloud-playwright.config.mjs` imports the repository configuration and changes only the browser executable to `/usr/bin/chromium`.

## Integrated reliability changes

Source commit: `2db459c5295ac830f05f9797523a444fbfad7640`.

Typing a different project-task search and then choosing Next or Previous previously applied the old results' offset to the new search. It could omit the first 50 matching tasks. Pagination now restarts at zero when the requested search differs from the displayed list. Three synthetic controller regressions cover Next, Previous from page three, and normal trimmed-query pagination. A fictional browser case covers the same journey on desktop and narrow viewports. Its synthetic volume response does not represent persisted memberships or server authorization acceptance; existing real fixture workflows cover those contracts.

Cloud umask 0077 exposed a test setup defect: requesting mkdir mode 0755 created a private directory, so a protection test expected rejection of a safe directory. The synthetic test now explicitly chmods its disposable directory to 0755 before asserting rejection. Runtime backup protections are unchanged. Only fictional encrypted test snapshots were created; no actual backup/key/config was accessed.

## Startup evidence

The retained `/workspace/curated-chaos-cloud-setup/start.py` asserts the old baseline SHA and branch and binds port 5316 only after checking it is free. It was inspected and preserved, not repointed or presented as current-source startup. Playwright launched the current checkout's fictional fixture server with `reuseExistingServer:false`, then stopped it. This verifies manual test startup, not automatic Start-skill invocation, reboot behavior or preview forwarding. No occupied port was cleared. The environment was not republished.

## Hierarchy decision and next implementation

The owner answered in this cloud chat: a subproject may belong to **several larger projects**. This supersedes the pending one-versus-several question; do not ask it again. Hierarchy itself is not implemented by this batch. Preserve private task identity and existing memberships. Next batch should implement explicit reviewed project-to-project memberships, self/cycle rejection, bounded complete traversal and deduplicated roll-ups with synthetic tests. Any required migration stays unapplied pending a separately reviewed hosted-change approval. Workers must not independently redesign shared auth/router/schema contracts.

## Boundaries and remaining gates

No push, PR update, merge, deployment, hosted database change, account login or provider refresh occurred. Existing auth, approval, Undo/history and full release gates remain. Linux excludes `mac-calendar-native-transfer.test.mjs`; Mac native permissions, physical Safari/iPhone/iPad, full recovery and production acceptance remain unverified here. Existing Apple read-only freshness/provenance, remembered-calendar consent and Pause behavior were preserved.

To resume: use the isolated integration worktree and inspect its status first. Reuse its locked dependencies; run `npm run check:offline` and `npm run test:browser -- --config cloud-playwright.config.mjs`. Do not reset the prepared baseline or use the stale wrapper to certify current source. Publishing this local branch or updating PR 1 needs concrete owner approval; no approval is implied by local commits.

## Final verification

At source commit `2db459c5295ac830f05f9797523a444fbfad7640`:

- `npm run check:offline`: 1,766 tests passed, zero failures/cancellations/skips; privacy, whitespace and zsh launcher checks passed. Linux explicitly excludes the Mac-native transfer file (three platform-specific tests); the earlier Mac checkpoint's 1,766 is not the same test inventory as this Linux run plus three new regressions.
- `npm run test:browser -- --config cloud-playwright.config.mjs`: 64 passed, zero failures/skips, desktop and narrow Chromium. Fixture-only localhost startup and shutdown succeeded. Includes keyboard navigation, stale reviews, cross-tab sign-out, HTTPS session transport, recurring memberships, project progress and the new paging regression.
- `node --test tests/provider-snapshot-backup.test.mjs tests/private-project-task-pagination.test.mjs`: 12 passed, zero failures/skips.
- `node tools/check-repository-privacy.mjs --scan-content`: safe, zero findings/blocked sources. `git diff --check` passed after handoff preparation.

Initial offline attempts truthfully failed one synthetic permissions test before its umask-independent setup correction. The first new browser regression attempt failed because its test response inherited a real empty-list offset rejection; corrected it to a wholly fictional, complete paged response. Both failures were fixed and final suites passed. No fixture guard was weakened.

The evidence-only commit after the tested source adds this document; it does not change runtime code. The untracked cloud browser override is retained for reproduction and is not part of the source publication package.

## Resumed autonomous development — several-parent projects and Calendar privacy

This section supersedes the earlier “hierarchy not implemented” checkpoint. The owner explicitly resumed autonomous local development and confirmed that subprojects can have several larger projects; no further hierarchy-number decision is pending. Parallel workers used isolated worktrees with disjoint model, UI, routes, storage and tests ownership. The lead integrated and independently reviewed changes on `codex/cloud-integration-20261116`.

The complete fictional workflow is now integrated: Project structure browsing in both directions, reviewed canonical link/unlink/relink, cycle/self/scope rejection, opaque session-bound actions, stale/one-use save protections, full descendant rollups and shared-task deduplication under the selected project's recurring-progress option. Returning from structure refreshes project tokens. No project status or task content is changed by hierarchy. Fake-key archive/restore comparison validates both individual and combined graph changes; restore remains unavailable. See PROJECT_HIERARCHY.md for storage scope and activation limits.

The independent Calendar review also found and fixed standalone one-time previews retaining prior-account event titles after cross-tab sign-out. They now listen to the established session channel, clear/abort immediately and reject late responses. Six synthetic regressions and two browser-tab tests use injected fictional events only, not a native Calendar or provider call. The integrated Calendar page's parent-session handling remains intact.

Verified checkpoints:

| Source | Command | Result |
| --- | --- | --- |
| `93f07018ce780be797e879dd30ef60bb14d888c4` | `npm run check:offline` | 1,832 passed; zero failed/cancelled/skipped; privacy, whitespace and launcher syntax passed |
| Same runtime source | `npm run test:browser -- --config cloud-playwright.config.mjs` | 70 passed; zero failures/skips |
| `29b119782bbb8d115888564c3319565dfe457c4f` | `npm run check:offline` | 1,838 passed; zero failed/cancelled/skipped; all offline gates passed |
| Same runtime source | `npm run test:browser -- --config cloud-playwright.config.mjs` | 72 passed; zero failures/skips |
| `506e64efa5205d7a1d186c02bee28708d6e7c5ce` | `npm run check:offline` | 1,842 passed; zero failed/cancelled/skipped; all offline gates passed |

The final source after guarded rollback review is `c2dd16c3d557a664cca5e18d22012730955d1ba0`. The rollback correction closes a concurrent-write gap by locking cc_records before the emptiness check, refusing repeatable-read transactions and refusing table owners whose FORCE RLS visibility could hide retained relationships. Six embedded rollback cases passed independently; the final complete offline gate is recorded below when finished. The app runtime and browser-test files are byte-identical to the 72-case browser-tested source: `git diff 29b119782bbb8d115888564c3319565dfe457c4f c2dd16c3d557a664cca5e18d22012730955d1ba0 -- src server tools tests/browser` returns no differences. Later commits in that range add only unapplied rollback SQL and embedded tests, so no additional browser rerun was needed.

All Linux offline runs explicitly exclude `mac-calendar-native-transfer.test.mjs`; zero skips does not mean Mac-native coverage. Fixtures/embedded PostgreSQL only. True simultaneous multi-connection database contention, hosted installation, Mac Calendar native permission, physical Safari/iPhone/iPad, automatic/reboot startup and preview forwarding remain gates. The retained old wrapper and saved environment configuration were not republished or repointed. No occupied port was cleared: a second browser attempt once refused while the prior owned suite was still running, then ran after that suite shut down normally.

At resume and again after implementation, remote `codex/release-readiness` remained `d0354685a7c6b884d40e5c9391b4e55740361543`; the original checkout stayed clean at `25f7d65451929df870fbf8015cbeb6d339087f17`. Nothing was pushed or merged. All local commits and the untracked system-Chromium config are retained. Public docs fetch/CLI access were unavailable; SQL drafts are not migration-ledger entries and must not be blindly applied with older migrations.

Phone notification tests 1, 2 and 3 all received actual negative owner answers. Creating the questions did not demonstrate push delivery; no product approval was inferred.

Next boundary: real development-database installation/acceptance requires separate explicit approval of the bounded package in PROJECT_HIERARCHY.md, including target identity verification and synthetic-only rollback QA. No hosted test login, schema/security change, real record/provider/key/.env/.local/backup read, account grant, purchase, deployment or owner Mac preview action has occurred in this task. Source publication remains a separate approval. A running cloud test was not represented as deployment or perpetual background execution.

Final complete offline result at `c2dd16c3d557a664cca5e18d22012730955d1ba0`: `npm run check:offline` passed 1,844 tests, zero failures/cancellations/skips; privacy/whitespace/launcher syntax all passed. The separately excluded Mac-native file remains excluded. The 72-case full browser run at runtime-identical `29b119782bbb8d115888564c3319565dfe457c4f` passed with zero failures/skips. `node tools/check-repository-privacy.mjs --scan-content` reported safe, zero findings/blocked sources; `git diff --check` passed after evidence preparation. Port5316 has no listener after normal suite shutdown. No test failure remains; the only interrupted integration attempt was a missing not-yet-integrated API module, fixed by integrating its worker commit. No privacy/auth guard was disabled.

The final evidence-only commit adds/updates these handoff documents; it does not modify the tested runtime or SQL. Pending owner approval is for the isolated-development schema/rollback-only fictional QA package only, not source publication or owner preview activation. Until an actual response authorizes that scope, keep both drafts unapplied. Continue from the current integration branch without resetting the original prepared checkout, replaying older migrations or treating the failed phone notification tests as reliable alerts.


## Owner-approved isolated-development installation completed

After asking what the pending question meant, the owner explicitly answered “Approve” to applying only the reviewed hierarchy database change to the isolated development database and running fictional rollback-only QA. This supersedes the pending approval above; source publication, deployment, owner Mac preview activation and original/live database changes remain unauthorized.

Confirmed target `fngauurauwvbawlfzbbe` / `curated-chaos-dev-isolated`, ACTIVE_HEALTHY, PostgreSQL17, expected three baseline migrations, correct cc_records structure/RLS/session and task-link functions, no existing hierarchy functions and zero other active transactions. Approved forward definitions were installed with lock/statement timeouts and NOWAIT table locking as migration `20261116131454/private_project_hierarchy`. No older baseline migration or mixed ledger was replayed. The original reviewed draft remains byte-identical with SHA256 e44ce2b098fb3d15fdffd8dedf00a680dd737a3dd3e98985a51ea7efc398375a; the draft header is historical, not a claim that it remains unapplied remotely. The inverse rollback remains unapplied.

Prepared source commit `e4f5f2c7c32fa0b0506eb5efa4fc8916a3339258` adds only a bounded SQL QA generator and two tests. The exact generator passed both embedded tests before hosted execution. Hosted result: hierarchy_checks=passed, fictional_record_bound=10, temporary_session_bound=2, no_qa_records_saved=true, no_qa_sessions_saved=true. A separate follow-up query independently confirmed absence of all fresh QA records/links and sessions. The generator uses established development identities as prior accepted QA, fresh simulated session rows/claims and authenticated roles, not credentials or usable login tokens. All queries with payloads are restricted to newly generated fictional identities. No successful full-owner snapshot read was performed on hosted data. Simulated roles do not certify JWT/login transport.

Installed five function-body MD5 hashes exactly match reviewed local source. Invoker flags, empty search paths, three triggers, valid partial unique index, existing RLS and client grant boundaries verified. Existing management default EXECUTE grants remain, not new service-role credentials. Security advisor retains only the earlier leaked-password-protection warning; no auth setting was changed. Live/original project was not accessed.

A coordinated advisory-lock-only probe used a synthetic non-account key and rolled back all transactions. The contender acquired its lock, so overlapping execution was not established and true multi-connection graph-write acceptance remains unverified. No application record was involved; this is not reported as successful concurrency certification.

The previous 72 browser cases and app source are unchanged. No Mac preview/launcher activation, real Calendar/provider reads, private configuration/key/archive access, source push/PR merge or deployment occurred. The running test server was not left as a deployed app. Resume from the current cloud integration HEAD, preserve the baseline and worktrees, and consult PROJECT_HIERARCHY.md for remaining activation/concurrency/release gates.

Post-approval final local verification at `e4f5f2c7c32fa0b0506eb5efa4fc8916a3339258`: `npm run check:offline` passed1,846 tests with zero failures/cancellations/skips; privacy/whitespace/launcher all passed. Linux still excludes the Mac-native transfer test file. `node tools/check-repository-privacy.mjs --scan-content` is safe with zero findings/blocked sources. No browser runtime change was made in this approval step, so the previously passing72 fictional browser cases were not unnecessarily rerun. The following evidence-only commit records these results and the installed ledger state without altering tested source.

## Autonomous project-task navigation and keyboard recovery batch

The owner again asked to continue autonomously. Preserved HEADffdef13, the untracked system-Chromium config, all original/worktree caches and the clean prepared baseline. Remote release-readiness remainedd0354685a7c6b884d40e5c9391b4e55740361543. Selected environment reported running/current. No additional hosted action or real data/config/key/backup/provider access occurred in this batch.

Source `58710d3a69db69dfb35620d772d688ceb1f06c91` completes explicit read-only task opening inside Projects using the existing selected-task read permission and `/tasks/read` route. A separate per-page50-token reader context carries exact identity/version/day and is cleared on relevant project actions, refresh/sign-out/disposal. Browsing stays sparse; descriptions/checklists load only on Open task. The panel rejects unverified fields/counts/dates/expiry, escapes text, clears on expiry/offline/reset and ignores late account responses. Duplicate-title dated/undated tasks open their distinct original contents. Background expiry preserves a currently edited project title-search query and cursor. This adds no task copies, editing authority, mutation endpoint, schema or hosted change.

Expired task-link choices now explain explicit fetch recovery instead of silently ignoring actions. Project and membership saves distinguish an acknowledged save from an unavailable verification refresh, keep uncertainty visible and never retry automatically. Programmatic list/review/error targets receive keyboard focus. Calendar Pause restores focus after isolated DOM replacement only for its original focused control, current owner/generation and unchanged body focus; newer draft focus, account changes, sign-out and disposal suppress restoration.

Validation at `58710d3a69db69dfb35620d772d688ceb1f06c91`: `npm run check:offline` passed1,881 tests, zero failures/cancellations/skips, privacy/whitespace/launcher gates passed. `npm run test:browser -- --config cloud-playwright.config.mjs` passed82 desktop/narrow Chromium cases, zero failures/skips. These include exact duplicate-title selected reads, lazy details, sign-out clearing, expiry while typing with cursor preservation, acknowledged-save/failed-refresh recovery without repeated writes, keyboard review targets and Calendar Pause. All source events/data are fictional; Calendar responses are intercepted in the browser and never invoke a native helper/provider. Linux still excludes the separate Mac-native transfer file and cannot certify physical-device permissions or behavior.

The approved hierarchy database installation20261116131454 remains unchanged; inverse rollback was not executed. No source push, PR merge, deployment or owner Mac preview action occurred. Selected task editing/completion still uses the established Tasks workspace; the new project view is explicitly read-only. Full agreed product scope and remaining Undo/offline/production gates remain in force. PROJECT_TASK_LINKING.md describes the workflow and limitations. The previously failed phone notification tests are not treated as working alerts.

## Final Calendar freshness contract correction

Independent audit reproduced acceptance of a one-day-old or future checkedAt with a newly minted future expiry. The server already mints expiry at preparation plus at most five minutes, sets checkedAt only after successful native completion, and reuses cached results unchanged. Source `8471d0b9c99683a711d813c4577373ddc2144608` now requires checkedAt<=now and expiresAt<=checkedAt+300000, in addition to the existing positive bounded remaining lifetime. This rejects stale/future/inconsistent previews without inventing a clock-skew policy or issuing any new read. Nine new boundary/cache/slow-completion/session-expiry/GUI-rejection tests pass;243 relevant tests passed in the isolated worker before integration. Both integrated and standalone UIs suppress invalid event titles and do not retry them.

Final offline verification at `8471d0b9c99683a711d813c4577373ddc2144608`: `npm run check:offline` passed1,890 tests with zero failures/cancellations/skips; privacy/whitespace/launcher syntax passed. Linux still excludes the separate Mac-native file. The final full82-case desktop/narrow browser result is appended after completion. No hosted change, actual Calendar/provider read or private configuration was needed.

The local milestone is prepared for review delivery; docs/CLOUD_REVIEW_PACKAGE.md defines the bounded prospective private branch/draft PR action. The existing repository was reconfirmed private, the proposed remote cloud branch absent, and the release head unchanged. Existing CI was inspected and remains test-only with no application secrets/provider/database/deploy steps. Source publication needs explicit owner approval under the existing task boundary; no push/PR update/merge/deployment or owner Mac change has occurred. This is a review boundary for moving the tested milestone toward device acceptance, not cancellation of remaining product scope.

Final full browser result at `8471d0b9c99683a711d813c4577373ddc2144608`: `npm run test:browser -- --config cloud-playwright.config.mjs` passed82 cases, zero failures/skips. Combined with1,890 passing offline checks, this is the final tested runtime for this local delivery milestone. `git diff --check` and repository privacy content scan passed after evidence preparation, with zero findings/blocked sources. Subsequent evidence-only commit does not modify runtime. Both suites exited normally; their fictional listener is stopped. Source remains unpublished pending the explicitly bounded private draft-review decision.

## Approved private draft publication and hosted-check correction

The owner explicitly approved publishing the cloud branch to the existing private repository and creating a new draft PR against release-readiness. Published initial evidence HEADe6f240d8a5b0ec1d7dac00680a958ffd5d0e8824 and created https://github.com/LiveCuratedChaos/Curated-Chaos/pull/2, draft/unmerged againstd0354685a7c6b884d40e5c9391b4e55740361543. Existing PR1 was separately rechecked: still draft/open/unmerged with its original head/base unchanged. The app attachment call was attempted but the host reported no handler; the normal PR link is usable.

PR workflow run43886052886 passed Tests and privacy and Mac Calendar native checks, but Browser workflows failed one desktop Calendar Pause assertion (81 passed/1 failed). Only sanitized failure names/assertion summaries were displayed. The CI timing exposed a real focus race: an initial preview result could replace a focused Pause control before Enter reached it. Commit8f09189f6b5344083b136b0244282fb41cef6d60 preserves that focused control during an isolated initial update, without stealing newer input focus. Two new controller regressions cover initial-result preservation and non-stealing behavior. The browser fixture now holds and explicitly releases the initial result after the workspace is idle, verifies focus survives that replacement, then uses Enter to Pause. This strengthens the race assertion rather than weakening it or retrying failed saves.

The targeted nine controller checks and two desktop/narrow browser cases passed. Complete local and subsequent hosted outcomes are recorded in PR2's review description after verification. Existing runtime/data/database/provider/owner Mac boundaries remain: no merge, deployment, new database change, source-panel read, native provider access or Mac restart. The initial hosted Mac-native test success is isolated CI evidence, not owner's physical-device permissions. The guarded inverse SQL remains unapplied.

Post-CI-fix local verification at8f09189f6b5344083b136b0244282fb41cef6d60: `npm run check:offline` passed1,892 tests, zero failures/cancellations/skips and all privacy/whitespace/launcher gates; `npm run test:browser -- --config cloud-playwright.config.mjs` passed82 cases, zero failures/skips. The Mac-native file remains separately excluded on Linux. Repository content privacy scan and diff check passed. The subsequent documentation commit adds this evidence only. Final hosted status for the approved draft branch is maintained in PR2's description to avoid creating new source commits just to report CI status.

## Optional inherited tasks and fixture-session isolation

Preserved the prepared baseline25f7d65451929df870fbf8015cbeb6d339087f17 and accepted release-readinessd0354685a7c6b884d40e5c9391b4e55740361543. Continued the existing approved draft branch without resetting concurrent work. Source ffec003b43f99634721cc37736fa9c8b7f02678e includes optional descendant-task browsing, direct-only membership reviews and fixture-cookie isolation. Direct links remain the default; inclusive results deduplicate diamond/shared paths, retain sparse date/identity consistency with the stable hierarchy snapshot, preserve the root recurring-progress policy and reject missing/null inclusive metadata. Removing a root link preserves inherited membership. No new schema or hosted/provider operation was needed.

The guarded fictional port5316 now uses cc_workspace_fictional rather than the normal preview cookie. Cookies share hosts across ports; the dedicated name plus origin guard prevents fictional sign-in/out from replacing a simulated owner session. Three synthetic regressions verify separate normal/staging/fixture names, shared-host jar isolation and refusal on real-config/normal-origin paths. The physical-device handoff additionally requires a disposable browser profile.

Validation: `npm run check:offline` passed1,916 tests, zero failures/cancellations/skips; privacy/whitespace/launcher gates passed. Linux separately excludes mac-calendar-native-transfer.test.mjs. `npm run test:browser -- --config cloud-playwright.config.mjs` completed successfully: all84 configured desktop/narrow cases, no failed tests or configured skips. The final Playwright last-run artifact records passed/empty failedTests. Privacy content scan had zero findings/blocked sources. The system-Chromium override remains untracked.

Earlier source1c88e032208f6dbe564a8a92afa2a462a18ebdbf passed1,913 offline checks and84 browser cases. A previous in-flight browser run picked up an intermediate invalid metadata edit during fixture reset (83 passed/1 failed); that mixed-source run was discarded, the edit corrected and a frozen committed-source full run passed before the cookie batch. No failing or mixed-source run is counted as acceptance.

FICTIONAL_DEVICE_ACCEPTANCE.md is a concrete prepared-only Mac/Safari handoff, requiring separate owner approval. No owner Mac action, real account/provider read, hosted DB change, deployment or merge occurred. Approved private draft publication continues on PR2 only; final published SHA and hosted results are maintained in its description. Physical Safari/iPhone, real native permissions, actual overlapping graph writes, automatic startup/preview forwarding and full recovery/offline/production gates remain open. Phone alerts remain unverified after three negative owner responses.

Resume from this branch's current HEAD, preserve all worktrees/caches and the original checkout, read PR2 for exact published/CI evidence, and use the bounded device package only after its separate approval. Do not replay installed hierarchy migration20261116131454 or apply the inverse without explicit authorization.
