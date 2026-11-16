import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createProductionWorkspaceHttp} from '../server/production-workspace-http.mjs';
import {createProductionWorkspaceRuntime} from '../server/production-workspace-runtime.mjs';
import {createDurableJobRepository} from '../server/durable-job-repository.mjs';
import {createServerOnlyRpcClient} from '../server/server-only-rpc-client.mjs';
const origin = 'https://workspace.example.test', id = 'a'.repeat(43), csrf = 'b'.repeat(43);
function request(path, {method = 'GET', cookie = id, headers = {}, body, signal} = {}) {
  return new Request(origin + '/api/workspace/' + path, {method, headers: {
    ...(method === 'POST' ? {Origin: origin, 'Content-Type': 'application/json'} : {}),
    ...(cookie ? {Cookie: '__Host-cc_workspace=' + cookie} : {}), ...headers
  }, ...(body !== undefined ? {body: typeof body === 'string' ? body : JSON.stringify(body)} : {}), ...(signal ? {signal} : {})});
}
function fixture(overrides = {}) {
  const calls = [], time = Date.now();
  const sessions = {
    async signIn() { calls.push('login'); return {sessionId: id, csrf, user: {id: 'synthetic'}, expiresAt: time + 1800000, absoluteExpiresAt: time + 43200000}; },
    async inspect(_, options) { calls.push(options); return {csrf, user: {id: 'synthetic'}, expiresAt: time + 1800000}; },
    async checkCsrf(_, token) { return token === csrf; },
    async readWithAccess(_, read) { return read({ownerId: 'synthetic', accessToken: 'NEVER_EXPOSE_ACCESS'}); },
    async signOut() { calls.push('logout'); return {signedOut: true, remoteRevoked: true}; }, ...overrides
  };
  return {sessions, calls, make: extra => createProductionWorkspaceHttp({origin, sessions, allowSignIn: async () => true, readBrief: async actor => ({owner: actor.ownerId, count: 0}), ...extra})};
}
test('production boundary requires exact HTTPS and all explicit dependencies', () => {
  const f = fixture();
  for (const value of ['http://127.0.0.1:5312', 'https://localhost', origin + '/', origin + '/path', 'https://user:secret@example.test']) assert.throws(() => f.make({origin: value}));
  assert.throws(() => f.make({allowSignIn: undefined}));
});
test('login returns only safe metadata and a secure host cookie lasting at most absolute lifetime', async () => {
  const response = await fixture().make()(request('login', {method: 'POST', cookie: null, body: {email: 'synthetic@example.invalid', password: 'fictional'}}));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=43\d{3}/);
  const data = await response.json(); assert.equal(data.csrf, csrf); assert(!('sessionId' in data));
  assert.doesNotMatch(JSON.stringify(data), /NEVER_EXPOSE|accessToken|refreshToken|fictional/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('cross-origin, wrong methods, queries and malformed/oversized credentials never sign in', async () => {
  const f = fixture(), handle = f.make();
  for (const input of [
    request('login', {method: 'POST', cookie: null, headers: {Origin: 'https://evil.example'}, body: {}}),
    request('login', {cookie: null}), request('login?extra=1', {method: 'POST', cookie: null}),
    request('login', {method: 'POST', cookie: null, body: {email: 'x', password: 'p', owner: 'spoof'}}),
    request('login', {method: 'POST', cookie: null, body: 'x'.repeat(8193)})
  ]) assert((await handle(input)).status >= 400);
  assert.equal(f.calls.length, 0);
});
test('passive session restores CSRF without touching idle and logout requires same-origin CSRF', async () => {
  const f = fixture(), handle = f.make();
  assert.equal((await (await handle(request('session'))).json()).csrf, csrf);
  assert.deepEqual(f.calls, [{touch: false}]);
  assert.equal((await handle(request('logout', {method: 'POST'}))).status, 403);
  assert(!f.calls.includes('logout'));
  const signedOut = await handle(request('logout', {method: 'POST', headers: {'x-cc-csrf': csrf}}));
  assert.equal(signedOut.status, 200); assert.match(signedOut.headers.get('set-cookie'), /Max-Age=0/);
});
test('busy/storage failures retain cookies; confirmed ended logout clears stale cookie', async () => {
  for (const code of ['SESSION_BUSY', 'SESSION_UNAVAILABLE', 'SESSION_ENDED']) {
    const handle = fixture({async inspect() { throw Object.assign(Error('NEVER_EXPOSE_STORAGE'), {code}); }}).make();
    const response = await handle(request('logout', {method: 'POST'}));
    assert.equal(response.status, code === 'SESSION_ENDED' ? 401 : 503);
    assert.equal(response.headers.has('set-cookie'), code === 'SESSION_ENDED');
    assert.doesNotMatch(await response.text(), /NEVER_EXPOSE/);
  }
});
test('sign-in limiter and stalled/aborted body fail bounded without invoking auth', async () => {
  const f = fixture();
  assert.equal((await f.make({allowSignIn: async () => false})(request('login', {method: 'POST', cookie: null}))).status, 429);
  for (const mode of ['timeout', 'abort', 'blocked-cancel']) {
    let cancelled = false; const controller = new AbortController();
    const req = new Request(origin + '/api/workspace/login', {method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json'},
      body: new ReadableStream({cancel() { cancelled = true; if (mode === 'blocked-cancel') return new Promise(() => {}); }}), duplex: 'half', signal: controller.signal});
    const pending = f.make({bodyTimeoutMs: 20})(req);
    if (mode === 'abort') setTimeout(() => controller.abort(), 5);
    assert.equal((await pending).status, 401); assert(cancelled);
  }
  assert.equal(f.calls.length, 0);
});
test('HTTPS session workflow persists across request instances using actual offline PostgreSQL draft', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(await readFile(new URL('../supabase/drafts/007_durable_sessions.sql', import.meta.url), 'utf8'));
    const fetchImpl = async (url, options) => {
      assert.equal(url, 'https://syntheticproject1234.supabase.co/rest/v1/rpc/cc_durable_session');
      assert(!('Authorization' in options.headers));
      const args = JSON.parse(options.body);
      const data = (await db.query('select public.cc_durable_session($1,$2::jsonb) as result', [args.operation, JSON.stringify(args.input)])).rows[0].result;
      return new Response(JSON.stringify(data), {headers: {'Content-Type': 'application/json'}});
    };
    const ownerId = '11111111-1111-4111-8111-111111111111'; let revoked = false;
    const api = {async signIn() { return {accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh', expiresAt: Date.now() + 3600000}; },
      async getUser() { return {id: ownerId, email: 'synthetic@example.invalid'}; }, async isSessionActive() { return !revoked; },
      async refreshSession() { throw Error('Unexpected refresh'); }, async signOutLocal() { revoked = true; }};
    const runtime = () => createProductionWorkspaceRuntime({origin, authApi: api,
      supabaseOrigin: 'https://syntheticproject1234.supabase.co', expectedProjectRef: 'syntheticproject1234',
      serviceRoleKey: 'sb_secret_' + 'synthetic_'.repeat(4), fetchImpl,
      sessionKey: Buffer.alloc(32, 7), keyVersion: 'synthetic-v1',
      allowSignIn: async () => true, readBrief: async actor => ({ownerId: actor.ownerId, taskCount: 2})});
    const make = () => runtime().handleRequest;
    await assert.rejects(runtime().dispatchSync(), /not configured/);
    const login = await make()(request('login', {method: 'POST', cookie: null, body: {email: 'synthetic@example.invalid', password: 'fictional'}}));
    assert.equal(login.status, 200); const cookie = login.headers.get('set-cookie').split(';')[0].split('=')[1];
    const status = await (await make()(request('session', {cookie}))).json(); assert.equal(status.signedIn, true); assert.equal(typeof status.csrf, 'string');
    const brief = await make()(request('brief', {cookie})); assert.deepEqual(await brief.json(), {ownerId, taskCount: 2});
    const logout = await make()(request('logout', {method: 'POST', cookie, headers: {'x-cc-csrf': status.csrf}})); assert.equal(logout.status, 200); assert(revoked);
    assert.equal((await make()(request('brief', {cookie}))).status, 401);
    const stored = JSON.stringify((await db.query('select row_data from cc_server.workspace_sessions')).rows);
    assert.doesNotMatch(stored, /synthetic-access|synthetic-refresh|fictional/);
  } finally { await db.close(); }
});

test('composed durable worker consumes a consented fictional job through the real RPC transport contract', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(await readFile(new URL('../supabase/drafts/008_durable_sync_jobs.sql', import.meta.url), 'utf8'));
    const ownerId = '11111111-1111-4111-8111-111111111111', connectionId = '22222222-2222-4222-8222-222222222222';
    await db.query("insert into cc_sync_private.connection_grants values ($1,$2,'gmail_metadata',1,true,clock_timestamp()+interval '1 hour')", [ownerId, connectionId]);
    const config = {origin, supabaseOrigin: 'https://syntheticproject1234.supabase.co', expectedProjectRef: 'syntheticproject1234',
      serviceRoleKey: 'sb_secret_' + 'synthetic_'.repeat(4), sessionKey: Buffer.alloc(32, 7), keyVersion: 'synthetic-v1',
      fetchImpl: async (url, options) => {
        assert.equal(url, 'https://syntheticproject1234.supabase.co/rest/v1/rpc/cc_durable_sync_job');
        const args = JSON.parse(options.body), data = (await db.query('select public.cc_durable_sync_job($1,$2::jsonb) as result', [args.operation, JSON.stringify(args.input)])).rows[0].result;
        return new Response(JSON.stringify(data), {headers: {'Content-Type': 'application/json'}});
      },
      authApi: Object.fromEntries(['signIn','getUser','isSessionActive','refreshSession','signOutLocal'].map(k => [k, async () => { throw Error('Auth must not run during sync'); }])),
      allowSignIn: async () => false, readBrief: async () => { throw Error('No record reads'); }};
    const queue = createDurableJobRepository(createServerOnlyRpcClient(config));
    await queue.enqueue({ownerId, connectionId, kind: 'gmail_metadata', idempotencyKey: '33333333-3333-4333-8333-333333333333'});
    let calls = 0;
    const make = () => createProductionWorkspaceRuntime({...config, jobHandlers: {gmail_metadata: async job => {
      await job.assertAuthorized(); assert.equal(job.ownerId, ownerId); assert.equal(job.connectionId, connectionId);
      calls++; return {done: true, checkpoint: null};
    }}});
    assert.equal((await make().dispatchSync()).completed, 1);
    assert.equal((await make().dispatchSync()).claimed, 0); assert.equal(calls, 1);
    assert.equal((await db.query('select state from cc_sync_private.jobs')).rows[0].state, 'complete');
  } finally { await db.close(); }
});
