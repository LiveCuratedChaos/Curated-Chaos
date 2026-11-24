# Curated Chaos development handoff

Resume from `codex/private-workflow-checkpoints` in the private repository `LiveCuratedChaos/Curated-Chaos`. Its immediate base is `codex/school-favorites-review` at `d4df3d077097338647db5f2c64190b7de91d2a44`. The original Mac development checkout is on `codex/browser-checks`.

## Completed November 23

- **R12** corrected a reproduced daylight-saving error in the School SQL guard. The inclusive boundary is 2,160 elapsed hours in every database time zone. Readiness checks for academic history and common task memberships still require the exact reviewed functions. All 217 focused checks passed.

- **R03 / R12 / R13** recovered a removed School shortcut from an encrypted archive into isolated PostgreSQL with the restore-window guard installed. Only the original reviewed shortcut action returned it to active use. Its filters were exact, an expired shortcut stayed absent, and replaying the archive preserved the newer state. All 16 repository drills passed.

- **R12** prepared a PostgreSQL restore-window guard for private tasks, notes, events, projects and saved searches. It checks elapsed time when the database processes the row and protects its original removal timestamp. All 24 related checks passed, including installation and rollback on fictional data. Hosted installation is pending.

- **R12** bounded School assessment and step restore approvals to their original removal times. The original course history still shows expired entries, with restoration unavailable. All 149 academic recovery and editing checks passed.

- **R12 / R13** aligned removed saved searches with the inclusive 90-day deadline. An expiring shortcut on another page retires its old total and selections. A suspended panel drops an expired restore approval before it can send a write. All 61 related checks passed.

- **R03 / R12** aligned Recently Deleted, widget selections and encrypted recovery on the inclusive 90-day boundary. Removed titles and counts expire with their earliest source. A selected widget action cannot extend its original deadline through approval. All 185 focused checks passed, including exact-anniversary encrypted restoration in isolated PostgreSQL.

- **R16** pages days with more than ten bills. The eleven-bill fixture opened the last bill’s own schedule, returned to the first page and refused to mix pages after an edit. All 369 related checks passed.

- **R16** now opens an individual bill’s original schedule from the Brief. Same-named bills retain separate selections. The original schedule shows its dates, frequency and current payment status. A changed occurrence requires a refresh, and looking at it preserves a pending payment review. All 490 related checks passed with the in-process HTTP transport.

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

The latest full macOS check, through the private database restore-window guard, passed 3,493 of 3,517 tests with Node 24.22.3 and `CC_TEST_HTTP_TRANSPORT=handler`. The subsequent removed-shortcut archive drill passed in the 16-test repository suite. Sixteen failures directly reported a denied local listener and eight assertions received that denial. No failures were unclassified. Privacy, whitespace and launcher checks passed. The earlier default-transport run through School search passed 3,460 of 3,495 and reported 35 listener-related failures.

Playwright 1.65.1 discovered 236 cases. Twelve selected desktop and phone-size cases are pending. The fictional fixture cannot bind `127.0.0.1:5316` in this session. The selection covers Calendar, Favorites, School search, original documents, the compact Search widget and Daily Brief bills. All local acceptance used fictional records.

## Where to resume

1. On a Node 24 runner that permits loopback listeners, run the two commands below. Use the pinned lockfile and matching Chromium. Record the results under R13, R18 and R21 and in the [local verification record](verification/LOCAL_RELEASE_CHECKS.json).
2. Continue R12 by letting a person take just the earlier title or just the earlier body from a note into its original editor. Preserve the other current field and require the normal reviewed save. Exercise old editor limits and the authenticated source checks.
3. Keep the [release checklist](RELEASE_CHECKLIST.md) authoritative. Spending stays at $0. Production deployment, owner activation and live provider changes require separate authorization.

```sh
npm run check:offline
npm run test:browser -- --grep 'calendar favorite hands off|Favorites widget opens|School title search previews|a favorite document reopens|compact Search widget|Daily Brief bills show'
```

Earlier Calendar and Favorites contributions passed 432 focused tests. The previous full attempt passed 3,441 of 3,476. Historical logs under `/tmp` belong to the originating Mac. Linux omits the macOS-native Calendar transfer check.
