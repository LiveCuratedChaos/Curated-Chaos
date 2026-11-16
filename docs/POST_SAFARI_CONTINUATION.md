# Post-Safari continuation — November 16, 2026

Base: PR #2 head 25c99365a18d0be2caeaf0a753797ad0cf9820ce. Read owner-posted Safari evidence at https://github.com/LiveCuratedChaos/Curated-Chaos/pull/2#issuecomment-6923345165. It closes the named fictional Safari cases; it does not certify native permissions, physical phones, concurrent graph writes or production/recovery gates.

The owner requested autonomous continuation with full permission. Existing Mac runtime, original checkout, earlier Safari checkout and all other worktrees remain preserved. This continuation uses an independent checkout and review branch; no real data, provider, database, key/config, deployment or merge action was needed.

## Saved Calendar freshness

Saved workspace Calendar viewing now has a five-minute display lifetime from the server check timestamp, capped earlier by sign-in expiry. The server keeps the original session lifetime/cookie; only Calendar response expiry is shortened. Ordinary title searches retain their session expiry behavior. Browser verification rejects non-string, invalid, future or stale check timestamps and extended expiries. Existing view clearing and explicit Fetch latest handle expiry; no automatic retry or provider request is added. This is a new bounded freshness policy for saved events, aligned with native preview behavior; the earlier server contract used the whole sign-in lifetime.

Local targeted acceptance: 256 tests passed, zero failures/skips/cancellations, including Calendar transport/model/controller, month summary, project task details and hierarchy panel. Added a desktop/narrow browser case for stale-response suppression and explicit-fetch recovery. That browser case requires hosted CI because this sandbox rejects even an ephemeral fictional loopback listener with EPERM. Full local suite likewise cannot pass its existing listener/native sandbox cases; do not count these failures as regressions or claim full acceptance. Final CI outcome belongs in the draft PR description after verification.

## Next work and boundaries

Real overlapping project-graph writes still need a genuine multi-connection PostgreSQL test with isolated fictional fixtures and cleanup. Embedded tests do not establish that property. No SQL is changed by this batch. Task/project editing, history/undo/offline, recovery, production and physical-device acceptance remain in the full product scope. Do not replace or restart the owner's running Mac app as a side effect of source publication. Keep review branches unmerged until an explicit release decision.
