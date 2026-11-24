# Curated Chaos development handoff

Resume from `codex/private-workflow-checkpoints` in the private repository `LiveCuratedChaos/Curated-Chaos`. Its immediate base is `codex/school-favorites-review` at `d4df3d077097338647db5f2c64190b7de91d2a44`. The original Mac development checkout is on `codex/browser-checks`.

## November 24 development

- **R16 / R17** the local Daily Brief summary now accepts the optional Routines section. It describes due and completed counts for the selected date without repeating routine titles. The summary still renders when the optional source is absent. All 347 related checks passed.

- **R16 / R17** Detailed week shows due and completed counts for saved routines on each exact date when Routines is enabled, including when task and event sections are hidden. Select the date to open its Daily Brief. All 356 focused checks passed, including a layout with Routines as its only visible week section.

- **R16 / R17** added an optional Routines section to the Daily Brief. It shows saved recurring tasks due on the selected date, distinguishes completed occurrences, and opens the original task through the existing reader. Older layouts retain their order and start with Routines hidden. All 436 focused checks passed.

- **R16 / R17 / R18** after a bill save settles, the Daily Brief and Bills widgets drop their old results in the current tab and other open workspace tabs. This includes an uncertain save, since the write may have reached storage. The tab notice carries no bill names or amounts. All 329 related checks passed, including a late Bills response after invalidation and preservation of an open Budget widget.

- **R16 / R17** the Daily Brief announces loading for requested bill schedules. Expiry of a daily schedule clears only its own names and details, so a separately verified weekly summary remains visible until its own deadline. All 325 related checks passed.

- **R19** Calendar event title interpretation accepts the date and category suffixes in either order, including multiword categories. Empty and duplicate fields leave the draft intact. All 323 focused checks passed.

- **R19** extended the new Calendar event title action with an explicit date phrase. It accepts today, tomorrow in New York, or an exact calendar date before the optional category. Invalid dates keep the draft intact. All 323 focused checks passed.

- **R19** added explicit event title category interpretation in the new event editor. A trailing category phrase fills the editable Calendar category and leaves the date and time fields intact. The existing review and approval still apply. All 323 focused checks passed.

- **R19** Quick Add recognizes explicit category phrases for Home, Personal Life, Work and School as existing task areas. The parsed choice appears in the original reviewed editor. Unknown or duplicate phrases are rejected, and ordinary title text is preserved. All 322 focused checks passed.

- **R03 / R32 / R33** recovered two overlapping pay periods across a year boundary. Browsing their original dates reopened distinct expenses recorded on the same day. A reviewed expense updated only its selected period, and replaying the older encrypted archive preserved that change. The budget cursor also normalizes supported timestamp offsets while retaining PostgreSQL microseconds. All 39 related checks passed.

- **R32 / R33** added Browse saved periods to Finances. It lists monthly budgets and exact custom pay periods by creation time, ten per page, with separate links to the original budget and transactions. Overlapping dates and identical database timestamps kept distinct records, older and newer paging worked, and amounts stayed concealed. All 349 related checks passed, followed by the two final paging and panel checks.

- **R32 / R33** added Find saved months to the budget period chooser. A year lookup reads only the twelve possible record IDs. It returns saved months in descending order and opens the chosen original budget or transaction list on request. The 346 related checks passed, including owner isolation, empty years, malformed responses, expired selections and preserving a pending approval.

- **R32 / R33** added Previous month and Next month to the monthly budget and transaction history. Moving to another month hides amounts and keeps the current view type. Pay periods keep their exact chosen dates. The 331 related checks passed, including leap February, year boundaries and active edits or approvals. Desktop and phone-size browser cases are prepared.

- **R03 / R32 / R33** recovered a reconciled monthly budget into a second database. Its split expense counted once at the original manual amount, the posted debit retained its difference, and the budget widget reopened with the original totals. An immediate replay wrote zero rows. After a later expense, the old archive could not overwrite the newer budget. All 42 related checks passed.

- **R03 / R16 / R33** verified that an encrypted backup restores a recurring bill and its confirmed payment. The weekly counts and original daily schedule reopened correctly. Replaying the backup preserved a later payment. A bank-matched payment required the same saved transaction and amount at the destination. All 38 related checks passed, followed by the expanded bank-match check.

- **R12** added separate earlier-title and earlier-description actions for tasks. Each starts in the current editor, retains the other current fields and requires explicit approval. All 359 related checks passed, including a later rename, unchanged checklist and loss of acknowledgment.

- **R03 / R12** verified Undo after encrypted shortcut recovery with PostgreSQL’s version and restore-window triggers installed together. The prior name and filters reopened, the removal time matched its archived version, all three imported entries stayed intact and the earlier archive could not reverse later changes. All 32 related checks passed.

- **R16 / R17** added on-demand paid and unpaid counts in the Detailed week’s Bills section, using the configured rolling or calendar week. Opening a date uses its original Daily Brief. The summary omits bill names and amounts and clears when financial details are hidden. All 334 related checks passed.
- **R12 / R13** added Undo for a confirmed saved-search removal. It selects the exact removed revision in the same tab and opens an ordinary restore review. A newer removal, a lost acknowledgment or an expired selection cannot be used. All 29 panel and HTTP checks passed.
- **R01 / R13** corrected two stale School tests. With School access disabled, active and removed shortcut counts omit School shortcuts, and an earlier selection cannot run. All 22 School search checks passed.

- **R13** supports “open Work tasks due by tomorrow” and other one-sided task and event searches. The preview shows an exact cutoff. A named shortcut retains that date when reopened later. All 28 interpretation and protected search checks and 11 signed-in shortcut checks passed.

- **R03 / R12** A signed-in owner reopened the original shortcut after an encrypted restore, read its earlier name, filters, capture time and recovery time, and used the ordinary approval to rename it. The restored archive had started at revision 8. The rename created one native history entry and preserved all three imported entries. Replaying the old archive offered no write. All 92 related service, history and recovery tests passed on Node 24.22.3.

## Completed November 23

- **R12 / R13** added an editable rename draft from a selected earlier shortcut name. It rechecks the current source and keeps its current filters. Reusing a name makes no write until the ordinary rename approval. All 381 related checks passed, including changes of name, duplicate activation, offline drafts and stale sources.

- **R12 / R13** added Run search with earlier filters to a selected shortcut version. It rechecks the active shortcut and submits its historical filters to the current workspace search. It preserves original dates and the current shortcut. A duplicate click, expired detail, changed source, offline transition or unavailable document scope cannot start a second or unauthorized search. All 71 saved-search and shared panel checks and 309 signed-in controller checks passed.

- **R12 / R13** added View versions on an active named shortcut. Selecting one earlier version reveals its name and exact filters. Reopening a stale selection or using it from a different tab fails. The optional School and document scopes now apply to active and removed list counts as well as version reads. All 477 integration checks passed. All 64 saved-search checks passed with the additional scope coverage.

- **R03 / R12 / R13** added protected history for explicitly named saved shortcuts. Rename, removal and restoration produced the three expected versions. Running or offering an unsaved query produced none. An encrypted archive restored all three with verified provenance. The database and archive refused unrelated results. All 148 related checks passed, followed by the expanded archive case.

- **R01** added local lookup codes for unexpected failures. The offline summary still withholds paths, test names and error contents. On the same checkout, `node tools/check-offline.mjs --locate <entry>` resolves a code to a file and line without rerunning checks. All seven runner tests passed.

- **R03 / R12** verified the removal and Undo audit trail with both PostgreSQL triggers installed. Tasks, notes, events and projects each retained the exact prior active and removed versions. An expired restore left the source and ledger intact, even with a stale application clock. All three database scenarios passed.

- **R12** added Undo removal for a verified private task, note, event or project removal. An explicit Undo opens the ordinary restore review for that exact version. The latest action survives the acknowledgment refresh for up to five minutes. All 382 targeted checks passed, including duplicate note titles, a newer deletion, same-account tab isolation, sign-out and lost acknowledgments.

- **R12** bound the restoration review to the selected Recently Deleted row and its original deadline. A delayed response, a different title or record type, a switched action, or an expired approval prevents any write. All 333 related checks passed, plus four final timer and approval checks.

- **R12** added separate earlier-title and earlier-body actions for notes. Copying just the body preserved the current title in embedded PostgreSQL, and a lost acknowledgment retained the selected draft. All 377 related checks passed. Ten panel checks also passed after clarifying the combined action label.

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

The November 24 full macOS check passed 3,533 of 3,557 tests with Node 24.22.3 and `CC_TEST_HTTP_TRANSPORT=handler`. Of the 24 listener-related failures, 16 directly reported a binding denial and eight received the same denial inside an assertion. Privacy, whitespace and launcher checks passed. The subsequent overlapping-pay-period recovery and timestamp change passed 39 focused checks. Two obsolete School shortcut expectations had failed on the first run and passed after correction.

Playwright 1.65.1 discovered 242 cases. The 24 selected desktop and phone-size cases are pending. This session cannot bind the fictional fixture to loopback, and macOS also denied launch of the pinned headless Chromium. The selection covers Calendar, Favorites, School search, original documents, the compact Search widget, Daily Brief bills, historical note and task text, Undo, saved shortcut history and monthly budget navigation. Local acceptance used fictional records.

## Where to resume

1. On a Node 24 runner that permits loopback listeners, run the two commands below. This session cannot open a loopback listener, and a free hosted runner could not be verified. Use the pinned lockfile and matching Chromium. Record the results under R13, R18, R21 and R32 and in the [local verification record](verification/LOCAL_RELEASE_CHECKS.json).
2. For R03, the separate-device restore still needs a verified private destination and authenticated sessions. For R19, run the two prepared event category cases from the signed-in Calendar workflow on a runner that permits loopback. The browser fixture could not start on this Mac.
3. Keep the [release checklist](RELEASE_CHECKLIST.md) authoritative. Spending stays at $0. Production deployment, owner activation and live provider changes require separate authorization.

```sh
npm run check:offline
npm run test:browser -- --grep 'Calendar day schedule preserves its month|calendar favorite hands off|Favorites widget opens|School title search previews|a favorite document reopens|compact Search widget|Daily Brief bills show|note saved versions remain|Undo removal returns|saved task shortcuts retain|an earlier task description|monthly budget navigation'
```

Earlier Calendar and Favorites contributions passed 432 focused tests. The previous full attempt passed 3,441 of 3,476. Historical logs under `/tmp` belong to the originating Mac. Linux omits the macOS-native Calendar transfer check.
