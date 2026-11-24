# Curated Chaos development handoff

Resume from `codex/school-favorites-review` in the private repository `LiveCuratedChaos/Curated-Chaos`. This review branch builds on `codex/cloud-handoff-20261123` at `b88f7dd0b9351310bfa0fcea89351502b955e72e`. The local handoff snapshot and that GitHub commit had the same file tree. The original Mac development checkout is on `codex/browser-checks`.

## Completed November 23

- **R13:** School and search result details now offer reviewed favorites for programs and courses. Named collections reopen the original, including after a rename. Selection checks the current owner, access, record kind, revision and expiry. Removing a collection keeps the original favorites. Encrypted recovery reopened both a program and course with identical titles from the same collection.
- **R18:** The optional Favorites widget includes programs and courses when School reads are enabled. School-area filtering and opening the current course notes passed in the signed-in Curation controller.
- **R13:** “Find School records about leadership” previews the program and course title filters. Applying the preview uses the existing protected search. The parser rejects unsupported dates and task status filters for School.

## November 24 Cloud verification

The Cloud copy matched the Git tree of `d4df3d077097338647db5f2c64190b7de91d2a44`. All 40 focused Favorites and search-intent tests passed. The fictional fixture started on loopback. The pinned Chromium download failed, and the installed Chromium 156 aborted at its process-singleton socket with `Operation not permitted`. All six desktop and phone-size cases stopped at browser launch before page assertions.

## Earlier verification

The 538 focused tests passed on Node 24.22.3 in a clean copy of the handoff with the review changes applied. The full macOS suite passed 3,447 of 3,482 tests. All 35 failures reported `listen EPERM`. The privacy content scan, whitespace check and launcher syntax check passed.

Playwright 1.65.1 discovered 230 cases. Six relevant cases are pending across desktop and phone-size Chromium. The fictional fixture could not bind `127.0.0.1:5316`, so browser assertions did not run. They cover the Calendar day handoff, removing an original from the Favorites widget, and interpreting a School title search and reopening its favorite after reload. All checks used fictional records and local dependencies.

## Where to resume

1. On a Node 24 runner that permits loopback and can launch the pinned Chromium build, run the two commands below. Use the pinned lockfile and matching Chromium. Record the results under R13, R18 and R21 and in the [local verification record](verification/LOCAL_RELEASE_CHECKS.json).
2. The next independent R13 workflow is favoriting saved private documents. Use the current authorized document reader, reviewed collection membership and the original document after a rename. Cover loss of access, deletion, and encrypted recovery before marking it verified.
3. Keep the [release checklist](RELEASE_CHECKLIST.md) authoritative. Spending stays at $0. Production deployment, owner activation and live provider changes require separate authorization.

```sh
npm run check:offline
npm run test:browser -- --grep 'calendar favorite hands off|Favorites widget opens|School title search previews'
```

Earlier Calendar and Favorites contributions passed 432 focused tests. The previous full attempt passed 3,441 of 3,476. Historical logs under `/tmp` belong to the originating Mac. Linux omits the macOS-native Calendar transfer check.
