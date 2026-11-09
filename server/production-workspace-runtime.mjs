// Composition only, not a Netlify entrypoint. All secrets and authorized adapters
// are explicitly supplied by the future server bootstrap. Never import in a browser.
import {createTokenSealer} from './token-sealer.mjs';
import {createServerOnlyRpcClient} from './server-only-rpc-client.mjs';
import {createDurableSessionRepository} from './durable-session-repository.mjs';
import {createDurableWorkspaceSessions} from './durable-workspace-sessions.mjs';
import {createProductionWorkspaceHttp} from './production-workspace-http.mjs';
import {createDurableJobRepository} from './durable-job-repository.mjs';
import {createDurableSyncWorker} from './durable-sync-jobs.mjs';

export function createProductionWorkspaceRuntime({origin, supabaseOrigin, expectedProjectRef,
  serviceRoleKey, sessionKey, keyVersion, fetchImpl, authApi, allowSignIn, readBrief,
  jobHandlers, now = Date.now} = {}) {
  const transport = createServerOnlyRpcClient({supabaseOrigin, expectedProjectRef, serviceRoleKey, fetchImpl});
  const sessions = createDurableWorkspaceSessions({api: authApi,
    repository: createDurableSessionRepository(transport), sealer: createTokenSealer(sessionKey), keyVersion, now});
  const handleRequest = createProductionWorkspaceHttp({origin, sessions, allowSignIn, readBrief, now});
  // No implicit scheduler or provider refresh. A separately authenticated scheduler
  // entrypoint is required; this internal method must never be an open HTTP route.
  const worker = jobHandlers ? createDurableSyncWorker({repository: createDurableJobRepository(transport), handlers: jobHandlers}) : null;
  return Object.freeze({handleRequest, async dispatchSync() {
    if (!worker) throw Error('Authorized synchronization adapters are not configured.');
    return worker.dispatch();
  }});
}
