# Protected saved School reading

Verified at the current November17 development checkpoint. RELEASE_CHECKLIST.md is authoritative. This is a bounded read-only R27 foundation over existing private School practice records, not completion of protected School editing, institutional integration, canonical assessment/task writes or the full approved School workflow.

## Reuse and authority

The reader reuses existing `school_fixture` records with origin/source `M2E_SCHOOL_QA`, preserving their IDs and payloads. It creates, edits, deletes and migrates nothing. The independent default-off `--allow-private-school-read` requires the private Brief/dashboard; the owner launcher remains unchanged. Only the enabled Daily Brief offers View saved School, and no School source is read before that choice unless the profile has explicitly included School in its Daily Brief. The Brief integration shares one verified sparse snapshot; selected bodies remain explicit-only. Typed workspaces do not open it.

A new sparse read adapter requests only known metadata using bounded100-row UUID keyset pages, up to2,000 records. Notes, assessment/checklist bodies and saved study sessions are excluded from the overview projection. Existing null official/study order values remain null; future schema markers survive projection and fail closed. One exact selected-record endpoint requests full payload only after explicit choice. The protected reader verifies owner/private/active/source/version and exact PostgreSQL microsecond metadata, including timezone-equivalent timestamps, before returning known detail fields. IDs, relationship IDs and capability internals are not disclosed in the presentation.

## Verified workflow

Saved programs show progress from the full linked saved-course inventory; classes, credits and terms remain separate metrics. The existing School model and new reader now share one calculation. A term counts complete only when every saved linked course in that nonempty term is Completed, correcting the earlier any-course calculation. Forged class/credit/term counters are rejected against the full course metadata. This is saved-course progress, not an official transcript or degree-completion certification.

Official order and study order remain independent. Course lists filter by owned program, unassigned or unavailable association and page50 at a time without changing full totals. Missing program references never auto-link by a matching title. Explicit details show exact notes, assessment types/statuses/checklist steps and saved study agenda; they do not create main-calendar commitments. Labelled controls and wrapping record buttons support the narrow view. Leading newlines and literal markup remain escaped text in CSP-compatible preformatted notes.

Loading, verified-empty, error, expired, disconnected, unauthorized, stale/replaced source and pending-read states are covered. Five-minute/session-bounded views and details, reset/hide, drafts, source refresh, offline and sign-out suppress late private replies. No editing capability or provider access is created by these read handles.

## Acceptance

All2,290 local tests pass with zero failures/skips/cancellations, plus privacy/content, whitespace and launcher syntax checks. New coverage includes sparse API pagination/null/schema compatibility, adapter-to-reader integration, model/service/HTTP/HTTPS/panel/controller/CLI, exact timestamp precision, full progress reconciliation, malformed/foreign/deleted/future source refusal, selected-only bodies, lifecycle and canonical order separation. Independent review found no remaining required fixes.

Fictional browser acceptance verified1of2terms complete with a partially finished first term,4courses, D253fourth in official order and first only in study order, explicit notes/assessments/steps/agenda reads, hide/sign-out clearing and accessible filters. A long School record button initially caused457px document width at390px; scoped wrapping fixed it, and re-acceptance verified375px document width with exact notes. Temporary sessions/tabs/server were cleaned up and viewport reset.110 desktop/narrow browser cases are prepared/discovered, not claimed executed. Physical devices and actual enabled-account acceptance remain.

## Recovery and remaining dependencies

Disable the School-read flag to remove the new reader without touching saved records. Preserve existing School IDs/payloads and all earlier shared controller changes. The common progress-helper source fix needs no data rewrite. Do not replace entire shared files from an old checkpoint.

Before mutable School workflows, finish stable assessment/task identity and shared project/task adapters. Existing legacy assessment arrays do not provide durable IDs; index/title-derived identities would break on reorder or duplicate titles. Existing project/link/hierarchy validators accept ordinary project records only. The shared adapter must reference the same School source ID, avoid shadow live projects/titles and preserve backup/recovery and approval boundaries. These are internal implementation dependencies, not an owner product decision or approved scope reduction.

No actual record, schema, provider, credential, archive/key, production, owner runtime/launcher restart, hosted CI, branch/publication or spending change occurred. Full approved School, cross-domain and release scope remains required.
