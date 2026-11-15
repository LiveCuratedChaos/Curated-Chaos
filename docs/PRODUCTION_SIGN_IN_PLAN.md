# Private release sign-in preparation

Reviewed November 11, 2026. This is a local implementation plan, not authorization to deploy, change providers or databases, create accounts, invite family or migrate existing users.

## Current evidence

The running private preview deliberately accepts only an exact HTTP loopback origin in server/private-workspace-session-http.mjs. Its HttpOnly, SameSite=Strict cookie is scoped to /auth/workspace; upstream tokens remain in the server session vault. Existing request-origin, CSRF, account-isolation, revocation, timeout and late-response protections are regression tested. These safeguards do not make the current Mac-only server a production service. The static asset snapshot preserves a running preview while files are edited.

The existing live prototype remains authoritative until separately approved cutover. Do not reuse the development test-account login interface or its credentials as public onboarding. No live auth configuration was read for this plan.

## Owner choice · November 11, 2026

Owner selected email and password for everyday adult sign-in. This choice concerns entry to Curated Chaos, not permission to read Gmail or Google Calendar. Keep provider-data consent separate. Do not assume a Google account or email delivery configuration is available. Stronger verification for sensitive operations and compatible recovery remain required by the approved blueprint regardless of the everyday entry method.

## Common implementation after the choice

1. Prepare a separate production-capable HTTPS adapter with Secure cookies, exact origin/redirect allowlists, CSRF/request protections, explicit callback transaction binding if needed, and server-side token storage. Preserve loopback-only development mode rather than weakening its origin restrictions.
2. Build fictional tests for successful/failed/expired entry, cross-account changes, callback replay if applicable, logout/revocation and absent/misconfigured provider service. Keep saved-record APIs unavailable before verified identity.
3. Design onboarding and recovery without exposing account existence, changing credentials in chat, or silently linking identities by an unverified email address. Never treat a social login as consent to read its provider data.
4. Inventory deployment, provider, email-delivery and database prerequisites using only approved configuration. Present exact changes for approval. Do not add production redirects, create accounts, send sign-in mail, grant scopes or update production auth until authorized.
5. Use disposable development identities for a separately approved end-to-end check; verify existing saved records and account ownership stay intact. No live migration by implication.
6. Complete session/device management, required stronger reauthentication and recovery protections; test iPhone/iPad and rollback before proposed release. External recovery copies remain an independent release gate.

## Current gate

Calendar navigation fixes are local/private-preview work. Email/password is selected. The new candidate adapter is prepared locally, not deployed. No production authentication is enabled or certified by this document. Do not request addresses, passwords, tokens, client secrets or recovery codes in chat.


## Prepared direct-TLS candidate

server/https-password-session-preview.mjs is an auth-only adapter with no listener or provider configuration. It accepts one exact dedicated HTTPS origin and only an actually encrypted socket. Forwarding headers never establish a trusted host, client identity or TLS connection; reverse-proxy hosting is not yet supported. The envelope verifies host/origin/fetch metadata and routes before delegating to the still-loopback-only session handler. It translates only the scoped opaque browser cookie into a Secure, HttpOnly, SameSite=Strict, Path=/, no-Domain __Host-cc_workspace cookie; upstream authentication tokens remain server-side. Existing preview defaults remain unchanged.

Only sign-in/status/passive check/logout and their UI assets are exposed. App records, account creation, recovery mail, providers and database mutation routes are absent. The new UI supports password-manager username/current-password fields without storing credentials in app code. Critical operations, recovery controls and production onboarding are not implemented by this candidate.

A bounded in-memory direct-client attempt limit (five/minute,1024 client keys) complements per-browser-context throttling; raw passwords/emails/addresses are not retained in the limiter. The default Mac preview retains its existing global attempt policy. Distributed throttling, durable session state, deployment origin/certificate management, proxy policy if needed, recovery and physical-device checks remain release gates; do not expose this candidate as a public service yet.

Eight candidate regressions cover exact origin/TLS rejection, secure cookies, secret-free responses, CSRF/foreign origin/forwarded headers, auth-only routes, attempt windows and cookie-reset bypass, independent clients, sign-out during pending login and a native verified TLS handshake. That handshake creates only an ephemeral fictional certificate/key, trusts that exact test certificate (verification stays enabled), and removes the temporary files afterward. Three acceptance-runner regressions cover offline default/exact flags, two fictional accounts with complete closure, wrong-target denial and cleanup after a partial failure.

## Next approved-access gate

Prepared tools/verify-https-password-sessions.mjs defaults to plan only. After separate owner approval, run with --allow-development-https-password-test --project=fngauurauwvbawlfzbbe. It performs exactly two temporary configured development sign-ins through in-process HTTPS adapter requests, verifies cookies/origin/CSRF/account independence/signed-out denial, and closes both. The actual upstream connection is the existing development authentication API; this is not a hosted deployment or another browser certificate test. It constructs only auth API methods, binds no listening port and reads/writes no app records or providers. No actual run has occurred yet. Existing owner workspace remains open and untouched. All1516 offline checks pass.


## HTTPS password authentication acceptance passed · November 11, 2026

Owner approved exactly two temporary existing-development-account sign-ins. First invocation failed during API construction before any network/authentication: verifier passed internal config key names instead of the public API projection. Corrected to {supabaseUrl,projectRef,publishableKey}, excluding user credentials, and strengthened fictional factory tests to call real public-config validation and assert the exact three keys. No sign-ins existed to clean up from that initial failure.

Reran tools/verify-https-password-sessions.mjs --allow-development-https-password-test --project=fngauurauwvbawlfzbbe successfully. Aggregate report: verified=true,temporarySignIns=2,closedTemporarySignIns=2,secureHostCookies=true,csrfAndOriginVerified=true,independentAccountUnaffected=true,signedOutAccessBlocked=true,inProcessOnly=true,appRecordReads=0,appRecordWrites=0,providerReads=0,productionChanges=0. Upstream development authentication was real; incoming browser-envelope requests remained in process. This was not a hosted HTTPS deployment or phone-browser test. No app records, providers, backups/keys, recovery emails, account creation, live settings or database changes occurred.

All1516 offline tests and privacy/whitespace/launcher checks pass after the fix. Owner workspace runtime36467/tab2 remains unchanged and marked deliverable. The two-login approval is consumed. Candidate stays prepared locally, not enabled as production authentication. Next engineering work remains durable multi-process sessions, deployment/proxy trust design, account recovery and physical-device acceptance; require concrete separate approval before any real hosting/auth/database changes.


## Hosting decision reached · November 11, 2026

Reviewed the current Node-only architecture and direct-TLS candidate against managed-host requirements. No deploy manifests or hosted credentials exist in the reviewed repository configuration. The active Mac session maps and login throttles are memory-only; they must not be described as durable/multi-instance. A single-instance authentication-only test may intentionally require re-entry after restart, but that is not full-release session readiness. Mac Calendar EventKit access remains on the Mac and must not be promised from hosted infrastructure.

Checked current primary vendor documentation: Render web services support Node hosting and managed public HTTPS but terminate TLS at their load balancer and forward HTTP to the service (https://render.com/docs/web-services). Therefore the direct-TLS-only candidate MUST NOT be deployed unchanged or have its encrypted-socket check removed. A provider-specific validated ingress/proxy design and tests are required first. Render free web services spin down after15 idle minutes, taking about a minute to wake; paid compute does not idle-sleep (https://render.com/docs/free and https://render.com/docs/faq). Filesystems are ephemeral without separate persistent storage; do not place durable sessions or app backups there. Current pricing lists free compute and paid web compute from$7/month before extras (https://render.com/pricing and https://render.com/articles/render-vs-netlify); recheck exact total before any purchase. No costs incurred or accounts opened.

Essential owner budget/design choice before host-specific work: free hosted testing with wake-up delays and sign-in resets after service restart, or plan always-on paid hosting (base compute currently from$7/month; final total requires separate review). This is planning only, not authorization to purchase, publish, grant repository access, provision databases or migrate live auth. Existing live prototype must remain untouched.

After choice: prepare exact auth-only staging package and dedicated origin/ingress contract with no existing app-data routes, no provider grants, no local keys/backups, no uploaded test passwords, no automatic sign-up or recovery mail. Verify the proxy trust boundary and sleep/restart behavior offline, define cleanup and complete a concrete deployment review before asking permission to publish. Production session persistence, recovery, stronger auth and eventual full workspace exposure remain separate gates. Existing1516 passing offline checks remain latest evidence; no code changed in this audit.


## Owner hosting choice · November 11, 2026

Owner chose: Keep development on this Mac for now. Pause hosted staging/deployment work. Do not create hosting accounts, link GitHub repositories, configure domains/redirects/proxy trust or incur costs. Prepared email/password HTTPS work remains local and its completed two-account auth acceptance remains documented; it is not production deployment authorization. Continue existing private Mac app work. External-drive backup work also remains deferred until hardware is available.
