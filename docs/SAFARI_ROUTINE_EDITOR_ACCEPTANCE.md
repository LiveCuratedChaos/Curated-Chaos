# Physical Safari routine-editor acceptance

Tested source: **2dd49c8e5bad705c6c652b4465db400c40b301f6**, the editor implementation in PR22. This report is a later documentation change, not a claim that a different implementation checkpoint was tested.

Environment: Safari27.2 (22625.2.8.11.9), macOS27.2.1 (26B131), separate **Curated Chaos Fictional Test** profile. Desktop window; exact viewport was not measured. Native Safari accessibility/keyboard interaction was used, not Chromium emulation. The owner made the blank fictional profile available before testing.

Source ran from an immutable source-only archive with existing compatible dependency references, no copied configuration, on ephemeral loopback origin `http://127.0.0.1:51943`. The visible fictional-preview notice was verified before creating one synthetic task and one synthetic project. The factory used disposable in-memory SQL records, no owner/provider data or Apple Calendar access.

| Journey | Actual observation |
| --- | --- |
| Task creation and focus | Existing explicit Save created the synthetic task; entering its details editor focused Title. |
| Text/date/priority saving | Multiline details, November17,2026 due date and High priority saved. Done returned to a verified list showing the date/priority; reopening showed the multiline text. |
| Done and refreshed list | A revised title followed by Done returned to a fresh list with that title and focus on New task. Exact debounce timing at the click was not independently instrumented. |
| History and Undo | Recent changes showed created/updated versions. One acknowledged title change enabled Undo; Undo restored the previous title and disabled a second Undo of that operation. |
| Invalid draft protection | Empty Title showed validation and explicit discard controls. Keep editing retained the invalid draft and focused Title. Explicit discard returned to the unchanged saved task. |
| Project summary | Existing explicit Save created the project. Summary autosaved; reopening preserved the two leading/trailing spaces and newline in the synthetic text. |
| Cross-tab sign-out | With the project editor open in the first fixture tab, sign-out in a second tab cleared the first editor and showed the sign-in message in both. |

An initial native-AX textarea click did not move focus from Title, so the first synthetic details text landed in Title. The synthetic title was corrected and keyboard Tab explicitly focused the textarea before the multiline journey. Extra saved versions reflect those test/operator edits; no claim is made about a single debounced operation across the whole manual session. This was not reproduced as an application keyboard-focus defect.

## Limits

No lost-response, unavailable-module or network-failure injection was performed in physical Safari. Those cases retain the separate automated SQL/HTTP/Chromium evidence. Physical iPhone/iPad, mobile Safari, hosted authentication, real-data migration, provider refresh, persistent offline operation and disaster recovery are unverified. Desktop Safari acceptance does not certify them. The source's automated evidence remains 2,089 Mac offline tests and126 desktop/narrow Chromium cases passed; narrow emulation is not physical-device evidence.

## Cleanup and preservation

The extra fixture tab was closed, and the original fictional test window was returned to `about:blank`. Only the fixture PID47714 was stopped after checking its command and archived-source working directory. It exited successfully; its loopback listener was removed and the in-memory records were discarded. Other Safari windows/settings were not operated. No owner checkout, existing preview, database, provider scope, credential, permission or Calendar refresh was changed.

The previously recorded owner preview on5313 was already observed stopped before this Safari run. It was not restarted. That is an observed availability limitation, not a claim that the old preview remains running.
