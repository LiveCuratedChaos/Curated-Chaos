# Curated Chaos development handoff

Resume from `codex/private-workflow-checkpoints` in the private repository `LiveCuratedChaos/Curated-Chaos`. Its immediate base is `codex/school-favorites-review` at `d4df3d077097338647db5f2c64190b7de91d2a44`. The original Mac development checkout is on `codex/browser-checks`.

## Completed November 23

- **R16 / R17** now include an optional Bills due section for the selected Daily Brief date. It reads current payment status only after opening and omits amounts. Concealment, sign-out, expiry and date changes retire the view. Older saved layouts retain their ordering and start with Bills hidden. The focused run passed 482 out of 488 with the default transport. The six listener-blocked cases passed using the existing in-process handler.

- **R13 / R18** now include the optional compact Search widget. Each visible instance opens the protected title search for its configured area. A Calendar widget opens universal search on the Daily Brief. The widget waits for an explicit submission. All 409 focused checks passed, including layout recovery.

- **R13** now supports separate School course and program searches. Choosing a type or reviewing “find courses about leadership” narrows counts, pages and readable selections to that kind. Named shortcuts preserve the distinction through reload and encrypted restoration. All 483 focused checks passed, and the expanded recovery case passed.

- **R12** now offers the earlier due date by itself in task history. The current editor retains the title, description, section, priority and checklist. A date change still requires review and approval. Isolated database tests verified the saved date, the audit record and rejection for an active recurring chore. All 364 related checks passed.

- **R13** now interprets inclusive task and event date ranges. The preview displays both dates and saved searches retain them when reopened on a later day. All 424 related checks passed.

- **R01:** The offline gate reports counts for denied local listeners, assertions that received a listener denial, and unclassified failures. Six runner tests passed. A targeted run of 68 session guard tests classified 12 direct denials and eight wrapped denials. These still count as failed tests.

- **R13 / R18:** Private Document Library files can be favorited, grouped in collections, and reopened from another page or the all-area Favorites widget. Opening inspects current metadata. Reading text and downloading use the original file on request. Renaming, stale views, owner isolation, removal, expiration and encrypted recovery were checked. The 435 related Node tests passed.

- **R13:** School and search result details now offer reviewed favorites for programs and courses. Named collections reopen the original, including after a rename. Selection checks the current owner, access, record kind, revision and expiry. Removing a collection keeps the original favorites. Encrypted recovery reopened both a program and course with identical titles from the same collection.
- **R18:** The optional Favorites widget includes programs and courses when School reads are enabled. School-area filtering and opening the current course notes passed in the signed-in Curation controller.
- **R13:** “Find School records about leadership” previews the program and course title filters. Applying the preview uses the existing protected search. The parser rejects unsupported dates and task status filters for School.

## Verification and blockers

The latest full macOS check passed 3,479 of 3,503 tests with Node 24.22.3 and `CC_TEST_HTTP_TRANSPORT=handler`. Sixteen failures directly reported a denied local listener and eight assertions received that denial. No failures were unclassified. Privacy, whitespace and launcher checks passed. The earlier default-transport run through School search passed 3,460 of 3,495 and reported 35 listener-related failures.

Playwright 1.65.1 discovered 236 cases. Twelve selected desktop and phone-size cases are pending. The fictional fixture cannot bind `127.0.0.1:5316` in this session. The selection covers Calendar, Favorites, School search, original documents, the compact Search widget and Daily Brief bills. All local acceptance used fictional records.

## Where to resume

1. On a Node 24 runner that permits loopback listeners, run the two commands below. Use the pinned lockfile and matching Chromium. Record the results under R13, R18 and R21 and in the [local verification record](verification/LOCAL_RELEASE_CHECKS.json).
2. Continue R16 by letting a selected bill in the Brief open its original schedule for that date. Use the current owner and revision, distinguish same-named bills, and preserve any open review. Amounts stay concealed until the original detail is explicitly opened.
3. Keep the [release checklist](RELEASE_CHECKLIST.md) authoritative. Spending stays at $0. Production deployment, owner activation and live provider changes require separate authorization.

```sh
npm run check:offline
npm run test:browser -- --grep 'calendar favorite hands off|Favorites widget opens|School title search previews|a favorite document reopens|compact Search widget|Daily Brief bills show'
```

Earlier Calendar and Favorites contributions passed 432 focused tests. The previous full attempt passed 3,441 of 3,476. Historical logs under `/tmp` belong to the originating Mac. Linux omits the macOS-native Calendar transfer check.
