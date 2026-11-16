# Disposable PostgreSQL project contention acceptance

The earlier embedded checks and sequential hosted advisory-lock probe do not establish actual concurrent graph-write behavior. This candidate adds a separate test-only PostgreSQL 17 GitHub service and an explicit runner. No application runtime, schema definition, hosted project, provider or configuration is changed.

Ordinary `node tools/verify-disposable-project-concurrency.mjs` prints a plan and opens no connection. Execution requires `--disposable-ci-only`, `GITHUB_ACTIONS=true` and `CC_DISPOSABLE_POSTGRES=true`. The runner accepts no host, database, password or URL argument. It uses only a fixed job-network hostname `postgres`, port 5432, database `cc_disposable_qa`, and a synthetic CI service credential. It refuses a database containing any public/auth tables before bootstrap. Application environment files, account credentials, backups and hosted connections are never loaded.

The disposable service receives the existing migration files and the unchanged reviewed hierarchy SQL, plus one fictional identity/session and four distinct groups of four fictional projects. These committed fixtures exist only inside the job service and disappear with that service; this is not rollback-only hosted QA. The runner never drops or cleans up unknown database objects. Job teardown owns disposal.

Each case holds a real leader transaction open after a graph mutation, launches an independent contender and observes its advisory-lock wait in `pg_stat_activity`, with `pg_blocking_pids` identifying the leader. It then commits or rolls back the leader and checks the contender's result and exact final edge counts:

- Disjoint RPC edge additions that would jointly form a cycle: the second write must reject the cycle after the first commits.
- Disjoint direct inserts through the existing trigger protection: the second write must reject the same cycle.
- Leader rollback: the waiting contender must succeed after the first proposed edge disappears.
- Shared-endpoint stale RPC review: the contender must reject the changed project version after waiting.

Connection, statement, lock, observation and process deadlines bound failures. Ordinary tests cover the offline default and execution guard. The CI result is acceptance for this disposable PostgreSQL engine and unchanged SQL; it does not certify hosted poolers, real JWT/API transport, production configuration, physical devices or owner data. Final passing head/run belongs in the draft PR description.

Implementation references: PostgreSQL 17 explicit locking documentation, https://www.postgresql.org/docs/17/explicit-locking.html . No relevant Supabase SDK or CLI behavior is introduced; the changelog was checked and no SDK/CLI upgrade is part of this batch.

The workflow runs inside a dedicated job container and publishes no PostgreSQL host port. Each service is reachable only within that job's Docker network, so concurrent jobs cannot collide on a shared host port.
