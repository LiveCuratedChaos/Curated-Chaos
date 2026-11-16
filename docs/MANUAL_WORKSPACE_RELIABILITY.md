# Retained manual-workspace reliability preparation

Local follow-up after approved PR13 merge and draft PR14 publication. Existing owner checkouts, candidate runtime and Apple Calendar refresh OFF are preserved.

The controller formerly normalized/validated/cloned the full workspace separately for every project card and again for several selects. It now computes the normalized view once per render and reuses it. Existing versioned mutation paths and scope checks are unchanged. An80-project controller regression counts normalization calls across refresh (four calls total including the view model's own work), preventing the previous per-card amplification. It also checks all project cards remain rendered; no pagination or complete counters are silently dropped.

The manual normalizer now rejects inventories above the established2,000-record bound before cloning or rendering. Repository completeness checks remain authoritative; this is an additional UI/model bound, not permission to truncate records. Duplicate/foreign/shared/provenance guards remain intact.

The convergence report's description requirement is now wording-correct after PR13's limit alignment: full-length text and exact formatting still need preservation, without claiming the manual editor retains the older1,000-character maximum. Report fields and privacy behavior remain unchanged.

Final local validation:32 targeted model/controller/preflight tests passed; full Mac offline suite2,043 passed, zero failures/cancellations/skips, privacy/whitespace/launcher checks passed. Six relevant desktop/narrow manual browser workflows passed (project/task/checklist, completion/Undo, uncertain save, long-text save/reopen). The private workspace runtime and its88 browser cases are unchanged from prior passing runs; no new full94-case run is claimed for this batch.

No database draft/schema, real records, providers, credentials, live UI or owner preview changed. This remains separate local source, pending publication approval. It does not complete unified several-parent production writes, autosave, protected offline editing, deployment or real-device acceptance.
