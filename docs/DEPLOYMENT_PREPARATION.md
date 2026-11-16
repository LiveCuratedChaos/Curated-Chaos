# Deployment preparation — blocked pending production acceptance

This repository contains working local development components, not an approved public hosting package. Preparation checks, new draft adapters and passing offline tests do not establish production readiness. Preserve the original Netlify site and Supabase project. No deployment or migration is authorized by this document.

## Safe local setup

Use Node.js 22 or newer and the locked dependencies: `google-auth-library` for authentication and development-only `@electric-sql/pglite` for offline SQL tests. On an authorized connected development machine, install from the lockfile with `npm ci`. Dependency installation may require network access; the offline checker does not install anything.

`.env.example` is a deliberately invalid placeholder template. If `.env.local` already exists, preserve it; do not copy over it. For a new setup only, create configuration privately and replace placeholders using the separate development project and two dedicated development accounts. The development and original project references must differ. After independently checking the target, the required confirmation value is `I_CHECKED_THIS_IS_NOT_MY_EXISTING_PROJECT`. Do not paste credentials into chat, commit them, or put private account passwords in browser assets. The development publishable key is not a service-role or secret key. Production configuration needs a separately reviewed contract; do not reuse test accounts or this template as production credentials.

The ignore rules protect `.env.local` through `.env.*`, while allowing the sanitized `.env.example`. `.local/`, recovery archives and dependency files remain private. OAuth client files, provider encryption keys and provider storage are not included in this example. Their private setup and any new provider scope require the applicable owner approval.

`npm run check:release` performs offline regressions and repository privacy/whitespace checks. `node tools/check-deployment-readiness.mjs` reads only the example and package manifest and prints a bounded preparation report. It always exits nonzero because production acceptance is blocked. It does not read environment credentials, start servers, verify installations, authenticate, contact providers, inspect actual deployment settings or approve a release. A successful preparation report describes only those two metadata checks. `check:setup` reads private development configuration; `test:rls` contacts the development database. Keep both outside the offline gate.

## Existing runtime boundaries

The local static server binds to `127.0.0.1`; connected pages obtain scoped development configuration locally. The private workspace uses exact loopback origin rules and temporary local sessions. The connection gateway uses local encrypted files, in-memory sessions and a local OAuth callback. These protections are intentional. Merely changing a hostname, listening address or cookie flag does not create a production service. Netlify static hosting does not run these long-lived local Node processes.

Do not publish the repository root. `tools/`, `server/`, `docs/`, tests, native sources, SQL migrations, configuration and private artifacts must not become public assets. A production build needs an explicit asset allowlist and a verified output artifact, with separately packaged backend code. Existing prototype assets may remain deployed under their original arrangement; that does not validate publishing this checkout wholesale.

## Production dependencies and release gates

1. Lead selects and reviews the hosting adapter and backend topology, publishes shared interfaces, and defines an allowlisted public build artifact. Inspect actual Netlify site/build settings privately before proposing changes; this offline inventory cannot establish them. No speculative Netlify configuration or auto-publishing CI is introduced here.
2. Prepare separate staging targets, database/storage policies, server-only secrets, durable encrypted provider storage and key recovery/rotation. Keep account passwords, OAuth secrets and service credentials out of client configuration. Secret names and injection interfaces need adapter-specific review; no production secret inventory is asserted complete here.
3. Accept HTTPS origin/cookie/CSRF behavior, durable sessions and remote revocation across restarts/instances, callback allowlists, owner-selected provider scopes, retry/rate limits, scheduled sync and freshness. Local adapters and draft transport interfaces require real staged tests before promotion.
4. Review production migrations against ownership/provenance contracts. Produce bounded migration preview, verified backup/restore, rollback and compatibility evidence. Local SQL tests do not authorize applying a migration or prove recovery from host/Mac loss.
5. Run integrated browser workflows, security/accessibility checks and physical Mac/iPhone/iPad acceptance. Verify outages, stale saves, duplicate clicks, restart behavior, offline conflicts and cleanup. Complete the release's scope-ledger evidence, including explicit unresolved limitations.
6. Present the concrete artifact, target, migration diff, acceptance evidence, rollback and cutover plan for owner approval. Deploy or migrate only after that approval. New provider scopes, paid services, account actions and household invitations retain their own approval boundaries.

The offline checker deliberately reports production as blocked even if a hosting configuration or draft adapter is added. Updating readiness requires reviewed acceptance evidence and an explicit release process, not detecting that filenames exist.
