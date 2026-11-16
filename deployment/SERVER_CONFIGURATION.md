# Server-only configuration preparation

These are proposed bootstrap inputs, not active environment settings. Existing local files stay intact. Do not copy local provider keys or OAuth grants into hosted settings. No new credential is generated, saved or transmitted by this preparation.

| Proposed server setting | Purpose | Scope |
|---|---|---|
| `CC_APP_ORIGIN` | Exact HTTPS origin, no trailing slash/path/wildcard | Distinct staging/release value |
| `CC_SUPABASE_ORIGIN` | Exact HTTPS standard project origin | Must match project reference |
| `CC_PROJECT_REF` | Expected target; prevents accidental cross-environment operations | Distinct target per environment |
| `CC_SERVER_SUPABASE_SECRET` | Server-only secret key or approved legacy service-role JWT | Function runtime only; never browser/build output |
| `CC_SESSION_KEY_VERSION` | Version bound into session encryption context | Explicit approved custody/version policy |
| `CC_SESSION_ENCRYPTION_KEY` | A separately generated 32-byte server key, decoded privately by future bootstrap | Function runtime only; backed up separately from ciphertext |

No `PUBLIC_`, `VITE_` or `NEXT_PUBLIC_` credential names. Restrict secret availability to exact approved site/environment/function contexts. Preview builds must not inherit live secrets. Server secret keys use `apikey`; legacy service-role JWT header handling is tested separately. The runtime constructor requires explicit configuration and never reads `.env`, `.local` or process environment itself.

`server/production-workspace-runtime.mjs` composes a Fetch handler compatible with the planned Node Functions boundary and an internal bounded sync dispatcher. A future bootstrap must supply the authoritative auth API, durable sign-in limiter, permission-checked Brief adapter and separately authorized source handlers. There are no permissive defaults or public scheduling endpoints. The existing development APIs/models retain their guards.

`netlify.toml.example` is inert and its build command intentionally exits blocked. The production public bundle, entrypoints, deployment secrets and scheduler are not activated. Before enabling them, review target identity, record/provenance compatibility, durable review/OAuth stores, consent, key rotation/recovery, rate limiting, secure headers, cleanup and rollout. Obtain approval for staged deployment/database acceptance and separately for live migration/cutover.
