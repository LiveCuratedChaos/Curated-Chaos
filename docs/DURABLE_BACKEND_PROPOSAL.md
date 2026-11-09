# Durable backend and initial operating budget

Reviewed November 9, 2026. Local implementation/proposal only; no spending, provider access, hosted schema changes, deployment or migration is authorized by this document. Full approved product scope remains binding.

## Existing setup: verified versus unknown

The owner confirmed that both Supabase and Netlify are currently Free. Repository evidence shows an original live/prototype environment and a separate Supabase development target, six development migrations, a static app and loopback Node gateways. No active root `netlify.toml`, Supabase CLI config, deployment workflow or production server bootstrap was present in the captured source. Existing dashboard settings can still exist without repository configuration.

No credential contents were inspected or copied. Dashboard access was not completed: browser control encountered concurrent user interaction. Actual organization/project count, region, Netlify legacy-versus-credit billing, linked branch/build settings, current usage and account-specific upgrade quote therefore remain unverified. Do not claim that public prices are an account checkout quote. Do not change plans merely to inspect a quote.

## Recommended architecture: retain Netlify and Supabase

Use Netlify static hosting for an explicit public asset bundle, and Node Functions as a same-origin backend-for-frontend. Supabase supplies Auth, PostgreSQL with RLS/transactional RPCs, private Storage and eventually Realtime. Keep the existing database records, pure domain/read models, encryption primitives, source adapters and safe mutations. Do not deploy `tools/connections-server.mjs` or `tools/private-session-preview-server.mjs`.

1. **Browser boundary:** HTTPS, Secure/HttpOnly host cookie, same-origin/CSRF checks, no-store responses. Never deliver provider tokens, server keys or privileged RPCs to browser code.
2. **Durable sessions:** encrypted upstream token/CSRF bundle in server-only PostgreSQL records; hashed browser session identifiers, idle/absolute deadlines, transactional refresh leases, revision fencing and persistent revocation. Recover CSRF after page reload. Refresh uncertainty fails closed rather than replaying a rotated credential.
3. **Durable connection state:** migrate nonce consumption, provider grants/renewal material, review receipts and operation identities into separately approved server stores. Existing local files and process Maps do not meet this requirement. Grants require explicit source/scope consent and key custody/rotation/recovery design.
4. **Background sync:** persisted jobs/outbox, consent epochs, atomic enqueue deduplication, expiring leases, retry/backoff and encrypted checkpoints. Netlify Scheduled Functions wake bounded dispatch; retries and worker restarts recover from database state. No exactly-once provider-effect claim. Each write needs its own atomic authorization/idempotency guard.
5. **Source reuse:** wrap the current Gmail/calendar/finance adapters as bounded, cancellable pages. Preserve approved metadata/read-only scopes. Saved snapshots remain visibly distinct from refreshed data. The Apple Calendar helper still requires the Mac; cloud hosting cannot remove that accepted platform limit.
6. **Files:** private object storage, permission checks on metadata/bytes/derived OCR/exports, direct authorized object transfers rather than large file bodies through Functions, and separate object backup/restore.

Netlify currently documents request Functions at 60 seconds, Scheduled Functions at 30 seconds and Background Functions at 15 minutes. The prepared worker defaults to 20 seconds, maximum 25 seconds, with checkpoints and bounded RPCs. A scheduler is a wake-up mechanism, not the queue authority. [Function limits](https://docs.netlify.com/build/functions/configuration/).

**No third runtime is currently necessary for this design.** That is an architectural conclusion, not hosted proof. Reconsider an always-on worker only if measured jobs cannot be divided safely within these limits, or actual requirements demand durable long-lived compute. Supabase Edge Functions are an alternative execution boundary, but moving current Node crypto/Google code to Deno is extra compatibility work without demonstrated benefit. Retain one durable data authority rather than buying a second database.

## Exact proposed plans and budget assumptions

Propose **Supabase Pro organization**, with **Micro compute** for each active project, and **Netlify Pro base 3,000-credit tier**. No paid Agent Runners/AI inference, extra build slots, preview servers, database branches, replicas, custom-domain addons, PITR or log drains are included.

| Item | Published basis | Initial two-project estimate |
|---|---|---:|
| Supabase Pro organization | $25/month; $10 monthly compute credit | $25 |
| Two Micro databases total | $0.01344/project-hour, approximately $10/project-month; one covered by compute credit | approximately $10 extra |
| Netlify Pro base tier | public page currently shows $20/month; account quote must confirm tier and billing model | $20 |
| **Infrastructure subtotal** | two Micro projects in one paid Supabase organization | **approximately $55/month before tax** |
| Conservative Netlify price allowance | pricing research also encountered account/variant displays up to $25; not a verified charge | **budget $60 total** |
| Remaining room within $75 target | before taxes, usage variance or outside services | approximately $15–20 |

Supabase compute varies with hours; the formula is $25 + sum(project hourly compute) minus up to $10 compute credit. More organizations may add another base subscription. If preserving the old live project while maintaining separate staging and a new release candidate requires **three** paid Micro projects, allow approximately **$65 published-price total / $70 conservative total**, before tax. Inventory projects before approving a purchase; do not delete, transfer or downsize the original to force the budget. [Supabase pricing](https://supabase.com/pricing), [compute billing](https://supabase.com/docs/guides/platform/compute-and-disk), [Netlify pricing](https://www.netlify.com/pricing/).

Netlify Personal may be cheaper for a personally owned repository, but Pro is the proposed tier for private organization-repository support, multiple concurrent builds and broader operational visibility. Local AI workers do not require paid Netlify agents. If the existing Free account has legacy pricing, do not switch billing models just to match this table: some switches cannot be reversed. [Credit-plan eligibility and plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).

### Included usage and stop/overage behavior

| Service | Proposed included allowance | Beyond allowance / practical boundary |
|---|---|---|
| Supabase database | 8 GB disk per project | $0.125/GB; compute upgrades billed separately |
| Supabase Auth | 100,000 MAU | $0.00325/additional MAU |
| Supabase file storage | 100 GB | $0.0213/additional GB |
| Supabase transfer | 250 GB uncached plus 250 GB cached egress | $0.09/$0.03 per additional GB respectively |
| Supabase backups/logs | daily database backups, seven-day retention; seven-day logs | Storage object bytes are excluded from database backups |
| Supabase Realtime | 5 million messages, 500 peak connections | $2.50/million messages; $10/1,000 additional peak connections |
| Supabase Edge Functions, if later used | 2 million invocations | $2/additional million package; not required by the recommended Node execution path |
| Netlify Pro | 3,000 pooled team credits/month at base tier | production deploy 15 credits; compute 10/GB-hour; bandwidth 20/GB; web requests 2/10,000 |

Supabase non-disk usage is generally organization-pooled rather than a fresh allowance per project. Keep the Supabase spend cap enabled, but it excludes compute and several opt-in addons and is not a $75 invoice ceiling. Keep Netlify auto recharge off initially; exceeding pooled credits can pause all team projects, including other projects. Additional Netlify Pro recharge is $10/1,500 credits if separately enabled. Preview/branch deployment creation is zero credits, but its traffic/compute still consumes credits. [Supabase cost controls](https://supabase.com/docs/guides/platform/cost-control), [Realtime billing](https://supabase.com/docs/guides/realtime/pricing), [Edge billing](https://supabase.com/docs/guides/functions/pricing), [Netlify credit mechanics](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/), [backup exclusions](https://supabase.com/docs/guides/platform/backups).

Example planning load, not a usage prediction: eight production releases (120 credits), 200,000 requests (40), 5 GB delivered bandwidth (100) and 10 GB-hours of Functions (100) total **360 credits**. Source rate limits, attachment transfer and scheduler/provider work must still be measured; 3,000 credits are shared, not 3,000 for each category.

The $75 target is feasible for initial infrastructure under these assumptions. **It is not yet a full-product all-inclusive quote.** AI inference/development subscriptions, bank-provider production charges/approval, transactional email, domains, licensed data, external-drive/off-device backup and taxes are outside this subtotal. Keep unpriced integrations disabled until their exact provider quote and data scopes are approved. Feature commitments remain; these are access/cost dependencies, not deleted scope. Establish application-level AI budgets and hard opt-in before enabling paid processing.

## Local implementation and remaining acceptance

Prepared modules: durable sessions/RPC and SQL draft007; durable queue/worker and SQL draft008; bounded server-only RPC transport; HTTPS Fetch request boundary and runtime composition; sanitized development configuration and offline readiness inventory. SQL lives in `supabase/drafts`, not automatic migrations. No public deploy entrypoint or schedule is activated.

Synthetic acceptance exercises actual embedded PostgreSQL SQL, request-instance recreation, encrypted credentials, passive idle deadlines, CSRF recovery, concurrent refresh, revoked access, job deduplication, lease fencing, consent changes, capped retries, checkpoint boundaries, cancellation and permission denial. This does not substitute for actual hosted multi-connection/HTTPS/provider testing.

Final integrated evidence: **986/986 tests passed, zero skips**, after the last captured main-source delta; content-pattern privacy and whitespace checks passed. Logs contain only fictional test diagnostics and counts. Local SQL tests do not use the owner's installed Supabase database, credentials or saved records.

Before staged activation, finish durable pre-login rate limiting, provider/OAuth/review stores, production record/provenance adapters, restricted static bundle, selected-source job callbacks and authoritative consent integration. The runtime deliberately requires injected rate-limit/auth/read/source dependencies instead of enabling permissive defaults. Supabase server secret keys stay in the `apikey` header; legacy service-role JWT headers follow the supported format. [Key transport contract](https://supabase.com/docs/guides/getting-started/api-keys).

Then prepare one bounded development acceptance package: exact target, unapplied schema diff, synthetic fixture counts, secret names (no values), staged request origin, cleanup and rollback. Obtain approval before touching that database or publishing a staged service. Live migration/cutover remain separate, after full recovery and device acceptance. Plans can remain Free while local work continues; no purchase is needed to run these local checks.

## Owner-only account steps, in order

1. **Read only now:** Supabase dashboard → organization → Billing/Subscription and Projects. Record project count, region and compute sizes; label which is original/live versus development. No keys or records needed.
2. **Read only now:** Netlify team → Billing/Plan details and the existing site's build settings. Record exact current plan model, base Pro 3,000-credit monthly quote, linked branch, build command and publish directory. Do not switch plans, trigger deploys or reveal environment values.
3. **Before any purchase:** confirm whether the monthly target includes AI/provider costs, count all projects affected by an organization upgrade, and review taxes and recharge/spend settings. The lead then presents the exact charge and resource list for explicit approval. Nothing in this plan authorizes payment.
4. **Only after approval:** the owner completes billing/terms/payment steps, retaining spend protections and declining unapproved addons. Do not create a new project simply because a template mentions one.
5. **Only when implementation and staged acceptance are prepared:** privately set server-only deployment secrets with environment scoping; no secrets in chat, Git or browser bundles. Confirm staging callback/origin changes separately. Source-provider scopes, real grants, live deployment and migration each retain their approval boundaries.

The lead handles code, fixtures, integration and local tests. The owner is needed for account billing/terms, secret entry, provider/OS consent and final acceptance rather than terminal-by-terminal development instructions.
