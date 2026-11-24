# Curated Chaos development handoff

Use the private repository `LiveCuratedChaos/Curated-Chaos` and select `codex/cloud-handoff-20261123` for the Cloud task. The source came from the Mac checkout of `codex/browser-checks` at `718596e1cf72f6087c2d887a1458f93b0287287b`, plus its on-disk changes. GitHub's copy of `codex/browser-checks` was at `25f7d65451929df870fbf8015cbeb6d339087f17` when the handoff was prepared.

## Where to resume

Use [the fixed release checklist](RELEASE_CHECKLIST.md) for approved scope and status. The latest entry in [the completion plan](COMPLETION_PLAN.md) describes the Calendar and Favorites work. [Local release evidence](verification/LOCAL_RELEASE_CHECKS.json) records the results. Paths under `/tmp` in earlier reports refer to the originating Mac.

The Favorites widget opens private notes, tasks, projects and Calendar events through their original readers. Opening a favorite from a Calendar day closes the drawer after the event opens successfully. Closing the event returns focus to the same date. The day stays available after a failed read.

1. Verify the four new desktop and phone-size Chromium cases, then record the result under R13, R18 and R21.
2. Continue R13 by adding School programs and courses to Favorites. Reuse the selected School reader and the existing collection membership workflow. Verify reopening a renamed original, rejecting an inaccessible or expired original, and preserving memberships through recovery.
3. Update the fixed checklist and the local verification record with what actually ran. Use fictional records for local development. Keep production deployment, paid services and live provider connections off.

## Run the checks

Use Node 24 and the pinned npm lockfile. From the repository root, install dependencies with `npm ci --ignore-scripts` if the environment needs them. Full offline checks use zsh. The browser tests use the locked Playwright version, its matching Chromium install, and a fictional HTTP fixture on loopback port 5316.

```sh
npm run check:offline
npm run test:browser -- --grep 'calendar favorite hands off|Favorites widget opens'
```

These checks require no account credentials. Linux omits the macOS-native Calendar transfer test. Run native acceptance on macOS when that workflow changes.

## Starting evidence

All 432 focused checks passed. The final Mac offline run passed 3,441 of 3,476 tests. All 35 failures in the diagnostic run involved a denied loopback listener. Privacy, whitespace and launcher syntax passed. Playwright discovered 228 cases, including the four new cases. The fixture could not start for those four in the managed Mac session. A fresh Cloud browser run is still due.

The handoff covers the development source, tests, SQL drafts and migrations, native helpers, and release documentation. Local credentials, provider snapshots, installed dependencies and 22 unreferenced generated PNGs were excluded.
