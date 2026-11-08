# Security and accuracy boundaries — Development starter

**This demo is not a secure data vault.** It contains only fictional records and keeps changes in browser `localStorage`. No server-side authorization is present or implied.

- The demo's `isVisibleRecord` logic illustrates access filtering, but cannot enforce real household privacy. Real access must be authorized by **Supabase RLS plus server-side checks** and verified with independent authenticated test accounts.
- All displayed service names are **fixtures**, not connected integrations or live data. No connector SDK, credentials or tokens are bundled.
- Every email-created task/event requires an explicit user review. The demo explicitly blocks an Automatic setting for those and financial-record changes.
- The financial account shown is fictional; no transfers, payments, trades, or banking operations exist.
- Real documents should not be added, since offline cache encryption, access revocation, and backup guarantees are not implemented.
- The eventual app must not promise immediate wiping of data on a lost offline device. Revocation protects the server immediately; cache deletion can run only if that PWA reconnects and executes it.
- Auth recovery, guardian security, 48-hour protection, household ownership transfer, export privacy and child compliance require a separate audited implementation.
- Server-side automation must validate requested actions independently of client-selected modes and check actor authorization at execution time.

## Security test scenarios to run in M0B (not yet performed)

1. Adult A cannot read or edit Adult C private records (including owner of same household).
2. Adult A cannot access Household C regardless of guessed UUIDs.
3. Member without section grant cannot query shared bills, even through search, brief, exports, or underlying REST API.
4. After membership removal, shared records become inaccessible immediately on the server.
5. Changing client JSON or forging an owner/member ID cannot escalate permissions.
6. User cannot directly mark a suggestion approved without an authorized and audited action.
7. Child accounts receive no data outside guardian-approved scopes.
8. OAuth tokens are never returned to browser or exposed in downloaded exports.
9. Stale disconnected source metadata is obvious and insights do not claim freshness.
10. Development Supabase and the existing project have distinct database, project ID, OAuth callbacks, storage and provider credentials.

## Known implementation questions

The draft SQL is **not production ready**. Multi-tenant policies, verified invitations, ownership transition, soft deletion/versioning, item-level exceptions, and child-specific rules require further design and adversarial tests before applying it anywhere. Do not run it in the existing Supabase project.


## M0E note
The connected QA Daily Brief now stores a development refresh token in per-tab sessionStorage to restore sign-in after a refresh. This is for fictional development data only and must be replaced or hardened before using real information.
