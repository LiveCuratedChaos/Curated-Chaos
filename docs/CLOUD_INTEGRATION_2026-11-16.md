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
