# Curated Chaos development handoff

Resume from `codex/verification-followup` in the private repository `LiveCuratedChaos/Curated-Chaos`. This review branch builds on the Cloud verification checkpoint and the November 23 School Favorites branch. The local handoff snapshot and that GitHub commit had the same file tree. The original Mac development checkout is on `codex/browser-checks`.

## Completed November 23

- **R13:** School and search result details now offer reviewed favorites for programs and courses. Named collections reopen the original, including after a rename. Selection checks the current owner, access, record kind, revision and expiry. Removing a collection keeps the original favorites. Encrypted recovery reopened both a program and course with identical titles from the same collection.
- **R18:** The optional Favorites widget includes programs and courses when School reads are enabled. School-area filtering and opening the current course notes passed in the signed-in Curation controller.
- **R13:** “Find School records about leadership” previews the program and course title filters. Applying the preview uses the existing protected search. The parser rejects unsupported dates and task status filters for School.

## Completed November 24

- **R13:** Save a private document to Favorites and assign it to named collections from the Document Library. Favorites lists reopen the current original through the existing document reader, including after a rename. Unavailable originals are omitted, and stale, expired and cross-session choices are rejected. Removing the favorite keeps the file. Encrypted recovery into isolated PostgreSQL preserved the document, its collection and the original bytes.
- **R18:** The Favorites widget opens saved private documents in the original reader from its all-areas view. The area-specific views omit documents because the library has no document area field. The widget rejects outdated selections and refreshes after a favorite is removed.
- **Verification:** All 48 focused Favorites, document and School-link tests passed. All 353 controller, static and search-intent checks passed. The widget follow-up passed 354 focused tests. Playwright discovered two new desktop and phone-size cases for the document collection and widget handoff. Browser assertions remain pending.

## Verification follow-up

- **R01:** The document Favorites checkpoint passed all 3,481 portable Node tests on Linux. The macOS-native Calendar transfer test was excluded. Offline verification reports allowlisted test filenames on failure. Six regression checks passed. A fictional subprocess failure confirmed the report omits test names, failure messages and absolute paths.
- **R02:** The direct-TLS candidate remains local. The hosting decision pauses staging and deployment, so hosted acceptance requires an approved staging environment and ingress contract.
- **R03:** A full isolated database snapshot retained a fictional encrypted document byte-for-byte. The restored engine denies an unrelated account and old revoked sessions, then opens the file through the original decryptor for a freshly authenticated owner. Hosted and separate-device recovery remain pending.
- **R04:** All 10 fictional household policy and isolation tests passed. Route coverage and release invitation acceptance remain open.
- **R12:** An explicit task-history action proposes earlier text and due date in the original current editor. The normal approval still governs changes. Scheduled recurring chores keep their series date. Browser verification is pending.
- **R13:** Local interpretation recognizes “Calendar events,” including the existing date and literal title syntax. All 24 intent parser, review-panel and protected search tests passed. A subsequent update previews a document name, folder and tag search for phrases such as “find documents about warranty.” Apply opens the existing authorized Document Library search. All 337 focused parser, controller and document tests passed. Calendar also previews an exact category plus date phrase such as `Calendar events in category "Work Shift" this week` and applies it through the protected Calendar route only after review. All 328 focused intent and controller checks passed. A subsequent update added event-kind and source constraints, exercised through the same protected Calendar route. All 329 focused checks passed.
- **R14:** The shared program/project browser now clears a selected record and its nested editor at the earliest source expiry, including when a browser delays the timer. All 65 focused panel and original-source HTTP tests passed.
- **R15:** Project hierarchy clears child names, progress and approvals at list/review expiry and requires a fresh structure fetch. All 110 hierarchy checks passed before the update and 23 panel checks passed afterward.
- **R16:** Stale optional Project or School inputs no longer suppress verified Daily Brief narrative facts. Their details and counts are omitted and the narrative offers a refresh. All 330 focused checks passed.
- Chromium still aborts at its process-singleton socket before opening a page. A runner that launches the pinned browser is required for the pending desktop and phone assertions.

## November 24 Cloud verification

The Cloud copy matched the Git tree of `d4df3d077097338647db5f2c64190b7de91d2a44`. All 40 focused Favorites and search-intent tests passed. The fictional fixture started on loopback. The pinned Chromium download failed, and the installed Chromium 156 aborted at its process-singleton socket with `Operation not permitted`. All six desktop and phone-size cases stopped at browser launch before page assertions. On the pre-document baseline, the full Linux suite passed 3,424 of 3,428 checks. The report provides counts without names for the four failures. Privacy, whitespace and launcher checks passed on that baseline.

## Earlier verification

The 538 focused tests passed on Node 24.22.3 in a clean copy of the handoff with the review changes applied. The full macOS suite passed 3,447 of 3,482 tests. All 35 failures reported `listen EPERM`. The privacy content scan, whitespace check and launcher syntax check passed.

Playwright 1.65.1 discovered 230 cases. Six relevant cases are pending across desktop and phone-size Chromium. The fictional fixture could not bind `127.0.0.1:5316`, so browser assertions did not run. They cover the Calendar day handoff, removing an original from the Favorites widget, and interpreting a School title search and reopening its favorite after reload. All checks used fictional records and local dependencies.

## Where to resume

1. On a Node 24 runner that permits loopback and can launch the pinned Chromium build, run the two commands below. Use the pinned lockfile and matching Chromium. Record the results under R13, R18 and R21 and in the [local verification record](verification/LOCAL_RELEASE_CHECKS.json).
2. Verify the document Favorites workflow in a browser that can launch the fixture. Open the Document Library, manage a favorite, assign it to a named collection, then reopen the original from that collection. Continue the next ready checklist row independently of the browser blocker.
3. Continue remaining R13 search source and category coverage, then R14 canonical project/task workflows. The next independent slice is R17 Daily Brief controls and history. Verify that a selected earlier date states that it uses current records before adding any protected historical snapshot behavior. Resume R15 browser acceptance on a runner that can launch Chromium. Record browser results once the pinned runner can launch. Keep the [release checklist](RELEASE_CHECKLIST.md) authoritative. Spending stays at $0. Production deployment, owner activation and live provider changes require separate authorization.

```sh
npm run check:offline
npm run test:browser -- --grep 'calendar favorite hands off|Favorites widget opens|School title search previews|document Favorites reopens'
```

Earlier Calendar and Favorites contributions passed 432 focused tests. The previous full attempt passed 3,441 of 3,476. Historical logs under `/tmp` belong to the originating Mac. Linux omits the macOS-native Calendar transfer check.
