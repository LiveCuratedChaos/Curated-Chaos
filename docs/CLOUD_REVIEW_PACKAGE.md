# Private review delivery package

Prepared locally for the owner's source-publication decision. Nothing in this package authorizes a push, pull request, merge, deployment, database change or owner Mac preview action.

## Proposed delivery

Publish only the current `codex/cloud-integration-20261116` branch to the existing private `LiveCuratedChaos/Curated-Chaos` repository, then open a new **draft** pull request against `codex/release-readiness`. Keep existing PR1, its head, the accepted release branch, main, all deployments and the owner's Mac app unchanged. No force push or branch replacement. The current remote release head is `d0354685a7c6b884d40e5c9391b4e55740361543`; no remote cloud-integration branch exists as of preparation. Verify refs again immediately before any approved publication.

The existing App checks workflow would run its offline/privacy, fictional browser and isolated Mac-native test jobs. It was inspected and is unchanged: pinned checkout/setup actions, read-only repository permissions, no persisted checkout credentials, no application secrets, no provider/database/deploy steps, no screenshot/archive upload. These CI jobs are not physical-device/permission acceptance. No new workflow, access grant or paid add-on is proposed.

## Proposed review title

Complete private project hierarchy and safe task/Calendar workflows

## Proposed review description

Private projects can now reference one subproject from several larger projects without copying projects or tasks. The structure view reviews each relationship, rejects cycles and invalid scopes, and counts shared descendants/tasks once using the selected project's recurring-progress option. Project task rows now open exact selected task details on demand; browsing stays sparse and the detail view clears on expiry or session changes.

Project/link saves distinguish acknowledgement from an unavailable verification refresh and avoid automatic retries. Keyboard focus survives project reviews/errors and Calendar Pause updates without stealing newer editor focus. Standalone Calendar previews clear on cross-tab session changes, and both Calendar previews reject stale/future check times or an extended cache lifetime.

The hierarchy schema was separately approved and installed only in the isolated development project as migration20261116131454; rollback-only hosted QA left no fictional records or sessions. Retained forward/guarded rollback SQL are review artifacts, not instructions to replay the mixed local/hosted migration ledger. The inverse rollback remains unapplied. No new hosted change is part of this review publication.

Validation: exact final source, full offline/browser commands and zero/nonzero skip/platform-exclusion details are recorded in CLOUD_INTEGRATION_2026-11-16.md. Tests use fictional records and embedded PostgreSQL. Mac permissions/physical devices, true overlapping graph-write acceptance and remaining recovery/production gates are not certified. Full approved product scope remains in force. No real provider/Calendar data, private configuration, keys or recovery files are included.

## Resume and remaining boundaries

The tested runtime checkpoint is `8471d0b9c99683a711d813c4577373ddc2144608`; later evidence-only commits must not alter it. Use `/workspace/Curated-Chaos-integration` and inspect status first. Preserve the original baseline and isolated worker worktrees. Untracked `cloud-playwright.config.mjs` is an environment-specific system-Chromium override and is excluded from the publication package. There are no new dependencies or binary artifacts in the code diff.

After any approved publication, attach the created PR to this cloud chat and verify the actual checks; do not infer CI success from local tests. Owner Mac preview update/restart, actual device acceptance, source merge and deployment each retain their applicable approval boundary. The three failed phone notification tests do not establish reliable delivery of future questions.
