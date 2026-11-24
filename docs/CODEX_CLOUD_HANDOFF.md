# Curated Chaos development handoff

Resume from `codex/private-workflow-checkpoints` in the private repository `LiveCuratedChaos/Curated-Chaos`. This review branch builds on `codex/cloud-handoff-20261123` at `b88f7dd0b9351310bfa0fcea89351502b955e72e`. The local handoff snapshot and that GitHub commit had the same file tree. The original Mac development checkout is on `codex/browser-checks`.

## Completed November 23

- **R01:** The offline gate reports counts for denied local listeners, assertions that received a listener denial, and unclassified failures. Six runner tests passed. A targeted run of 68 session guard tests classified 12 direct denials and eight wrapped denials. These still count as failed tests.

- **R13 / R18:** Private Document Library files can be favorited, grouped in collections, and reopened from another page or the all-area Favorites widget. Opening inspects current metadata. Reading text and downloading use the original file on request. Renaming, stale views, owner isolation, removal, expiration and encrypted recovery were checked. The 435 related Node tests passed.

- **R13:** School and search result details now offer reviewed favorites for programs and courses. Named collections reopen the original, including after a rename. Selection checks the current owner, access, record kind, revision and expiry. Removing a collection keeps the original favorites. Encrypted recovery reopened both a program and course with identical titles from the same collection.
- **R18:** The optional Favorites widget includes programs and courses when School reads are enabled. School-area filtering and opening the current course notes passed in the signed-in Curation controller.
- **R13:** “Find School records about leadership” previews the program and course title filters. Applying the preview uses the existing protected search. The parser rejects unsupported dates and task status filters for School.

## Verification and blockers

The 538 focused tests passed on Node 24.22.3 in a clean copy of the handoff with the review changes applied. The full macOS suite passed 3,447 of 3,482 tests. All 35 failures reported `listen EPERM`. The privacy content scan, whitespace check and launcher syntax check passed.

Playwright 1.65.1 discovered 232 cases. Eight relevant cases are pending across desktop and phone-size Chromium. The fictional fixture could not bind `127.0.0.1:5316`, so browser assertions did not run. They cover the Calendar day handoff, removing an original from the Favorites widget, and interpreting a School title search and reopening its favorite after reload, and opening a favorite document on another page. All checks used fictional records and local dependencies.

## Where to resume

1. On a Node 24 runner that permits loopback listeners, run the two commands below. Use the pinned lockfile and matching Chromium. Record the results under R13, R18 and R21 and in the [local verification record](verification/LOCAL_RELEASE_CHECKS.json).
2. Next finish the reviewed natural-language date-range search for tasks and events, then continue with the next ready release workflow.
3. Keep the [release checklist](RELEASE_CHECKLIST.md) authoritative. Spending stays at $0. Production deployment, owner activation and live provider changes require separate authorization.

```sh
npm run check:offline
npm run test:browser -- --grep 'calendar favorite hands off|Favorites widget opens|School title search previews|a favorite document reopens'
```

Earlier Calendar and Favorites contributions passed 432 focused tests. The previous full attempt passed 3,441 of 3,476. Historical logs under `/tmp` belong to the originating Mac. Linux omits the macOS-native Calendar transfer check.
