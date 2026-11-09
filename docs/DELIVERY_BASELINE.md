# Single AI delivery baseline

November 9, 2026. Lead: this delivery workflow. Canonical local integration branch: `codex/ai-delivery-integration-20261109-5bc130`; worktree: `/Users/sam/.codex/worktrees/ai-delivery-integration/Curated-Chaos`.

## Reconciliation receipt

- Original main HEAD remains `8d3e8a9`. Its accepted working files were not staged, reset, committed or overwritten in the owner checkout.
- First public-source checkpoint: `3acff57b2bc1f352943998a2f088413b00d5eff6` (368 files), plus full-scope delivery foundation through `4047c22`.
- Latest main-source checkpoint for this reconciliation: `3212bea1a5570736e29f06d0c1c5554fc13fe734`, captured through a separate temporary Git index. Capture verified source stability and unchanged original HEAD/index; protected files were excluded and content scan passed.
- Merge receipt: `b7de6fa`. Preserves both histories and 14 changed main-source files: keyboard/accessibility, upcoming-events, acceptance tools/tests and historical evidence. Fifteen textual/add-add conflicts were resolved by comparing the original captured baseline: incoming main content retained wherever delivery had not independently changed it; package scripts retain the delivery release gate.
- The reconciled baseline independently passed **926/926 tests**, privacy and whitespace checks before new durable-backend work began.
- Final source-delta checkpoint `4289489fc4c2decacd6300f3b72cda0b6787de50` imports later main acceptance/search reliability work through merge `92827ee`. Its parent is the prior captured source, so the second merge preserves the incremental history without repeating add/add conflicts. No original checkout files/index/HEAD were changed.
- After composing all three workers and the lead's request/runtime workflows, the integrated gate passed **986/986 tests, zero skips**, content privacy and whitespace checks. SQL was exercised only in embedded PostgreSQL with fictional data. No hosted database, provider or browser/device acceptance was performed in this batch.

The owner checkout remains intact and another chat may continue editing it. This document defines a time-bounded captured baseline, not a claim that other execution has stopped. Any subsequent owner-checkout delta must be imported as a new source checkpoint and verified before adoption; never force-copy one checkout over another or run competing integrations against the same live preview.

## Operating rules

One lead owns this integration branch, shared auth/router/schema contracts, merge order and final evidence. Workers branch from its named accepted baseline in separate worktrees, own disjoint paths, test/commit, then hand commits to the lead for review. Do not branch feature work from the old main HEAD or separately reimplement completed providers/controllers.

First parallel implementation lanes: durable sessions; durable sync jobs; deployment/RPC preparation. Lead composes and tests them together as one foundation workflow. Local success never activates schedules, applies SQL, deploys or enables providers. Future lanes follow `AI_DELIVERY_PLAN.md` and requirement IDs in `PRODUCT_SCOPE_LEDGER.md`.

Use Node22+ and the locked dependency versions; `npm run check:release` runs offline regressions, content-pattern privacy checks and pending whitespace checks. The local checkout used the existing installed dependency packages without network installation. A clean-machine install/CI and hosted multi-connection/browser/device evidence remain separately recorded gates.

The full approved scope and estimates remain unchanged pending measured substantial-batch throughput. Purchases, new provider access, actual database changes, staged/live publication and migration remain explicitly approved actions. No remote push or owner-preview restart was performed by this foundation work.
