// Request-scoped HTTPS boundary for a future Netlify Node Function. No listener,
// environment loading, deployment entrypoint, development gateway or default store.
const cookieName = '__Host-cc_workspace';
const opaque = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const security = {
  'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'Vary': 'Cookie', 'X-Frame-Options': 'DENY'
};
function sessionCookie(id, seconds) {
  return `${cookieName}=${id}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${seconds}`;
}
function cookieId(request) {
  const raw = request.headers.get('cookie') || '';
  if (raw.length > 8192) return null;
  const values = raw.split(';').map(s => s.trim()).filter(s => s.startsWith(cookieName + '='));
  if (values.length !== 1) return null;
  const id = values[0].slice(cookieName.length + 1);
  return opaque(id) ? id : null;
}
async function credentials(request, bodyTimeoutMs) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw Error();
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 8192)) throw Error();
  const reader = request.body?.getReader();
  if (!reader) throw Error();
  const chunks = []; let size = 0;
  let timer, abort;
  const interrupted = new Promise((_, reject) => {
    const stop = () => { void reader.cancel().catch(() => {}); reject(Error()); };
    timer = setTimeout(stop, bodyTimeoutMs);
    abort = stop; request.signal.addEventListener('abort', abort, {once: true});
  });
  try {
    while (true) {
      const {value, done} = await Promise.race([reader.read(), interrupted]); if (done) break;
      size += value.byteLength;
      if (size > 8192 || request.signal.aborted) throw Error();
      chunks.push(value);
    }
  } catch { void reader.cancel().catch(() => {}); throw Error(); }
  finally { clearTimeout(timer); request.signal.removeEventListener('abort', abort); reader.releaseLock(); }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!body || Object.keys(body).sort().join(',') !== 'email,password' ||
      typeof body.email !== 'string' || !body.email.trim() || body.email.length > 320 ||
      typeof body.password !== 'string' || !body.password || body.password.length > 1024) throw Error();
  return body;
}
export function createProductionWorkspaceHttp({origin, sessions, allowSignIn, readBrief, now = Date.now, bodyTimeoutMs = 5000} = {}) {
  let allowed;
  try { allowed = new URL(origin); } catch { throw Error('Exact production HTTPS origin required.'); }
  if (allowed.protocol !== 'https:' || allowed.origin !== origin || allowed.username || allowed.password ||
      allowed.hostname === 'localhost' || allowed.hostname.endsWith('.localhost') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(allowed.hostname) || allowed.hostname.startsWith('[')) throw Error('Exact production HTTPS origin required.');
  if (!sessions || ['signIn', 'inspect', 'checkCsrf', 'readWithAccess', 'signOut'].some(k => typeof sessions[k] !== 'function') ||
      typeof allowSignIn !== 'function' || typeof readBrief !== 'function' || typeof now !== 'function' ||
      !Number.isInteger(bodyTimeoutMs) || bodyTimeoutMs < 1 || bodyTimeoutMs > 10000) throw Error('Explicit durable session, sign-in limiter and authorized read dependencies required.');
  const send = (status, data, extra = {}) => new Response(JSON.stringify(data), {status, headers: {...security, ...extra}});
  return async function handle(request) {
    const url = new URL(request.url), method = request.method, site = request.headers.get('sec-fetch-site');
    if (url.origin !== origin || request.headers.get('origin') && request.headers.get('origin') !== origin ||
        site && !['same-origin', 'none'].includes(site)) return send(403, {error: 'Use the workspace address.'});
    if (url.search || !['/api/workspace/session', '/api/workspace/login', '/api/workspace/logout', '/api/workspace/brief'].includes(url.pathname)) return send(404, {error: 'Not found.'});
    const expected = url.pathname.endsWith('/login') || url.pathname.endsWith('/logout') ? 'POST' : 'GET';
    if (method !== expected) return send(405, {error: 'Method not allowed.'}, {Allow: expected});
    if (method === 'POST' && request.headers.get('origin') !== origin) return send(403, {error: 'Same-origin request required.'});
    if (request.signal.aborted) return send(409, {error: 'Request ended.'});
    const id = cookieId(request);
    if (url.pathname.endsWith('/login')) {
      if (id) return send(409, {error: 'Sign out before changing accounts.'});
      let signed;
      try {
        if (await allowSignIn() !== true) return send(429, {error: 'Sign-in temporarily unavailable.'}, {'Retry-After': '60'});
        const body = await credentials(request, bodyTimeoutMs);
        signed = await sessions.signIn(body.email, body.password);
        if (!opaque(signed?.sessionId) || !opaque(signed.csrf) || !Number.isFinite(signed.expiresAt) || signed.expiresAt <= now() ||
            !Number.isFinite(signed.absoluteExpiresAt) || signed.absoluteExpiresAt < signed.expiresAt || request.signal.aborted) throw Error();
        return send(200, {signedIn: true, csrf: signed.csrf, user: signed.user, expiresAt: signed.expiresAt, absoluteExpiresAt: signed.absoluteExpiresAt},
          {'Set-Cookie': sessionCookie(signed.sessionId, Math.max(1, Math.min(43200, Math.floor((signed.absoluteExpiresAt - now()) / 1000))))});
      } catch {
        if (signed?.sessionId) await sessions.signOut(signed.sessionId).catch(() => {});
        return send(401, {error: 'Sign-in could not be completed.'});
      }
    }
    if (!id) return send(401, {error: 'Sign in again.'}, {'Set-Cookie': sessionCookie('', 0)});
    try {
      if (url.pathname.endsWith('/logout')) {
        if (!await sessions.checkCsrf(id, request.headers.get('x-cc-csrf'))) {
          // Distinguish an ended session from an active session with invalid CSRF.
          await sessions.inspect(id, {touch: false});
          return send(403, {error: 'Request verification failed.'});
        }
        const result = await sessions.signOut(id);
        return send(200, {signedOut: true, remoteRevoked: result.remoteRevoked === true}, {'Set-Cookie': sessionCookie('', 0)});
      }
      const data = url.pathname.endsWith('/session') ? {signedIn: true, ...await sessions.inspect(id, {touch: false})} :
        await sessions.readWithAccess(id, readBrief);
      if (request.signal.aborted) return send(409, {error: 'Request ended.'});
      return send(200, data);
    } catch (error) {
      if (error?.code === 'SESSION_ENDED') return send(401, {error: 'Sign in again.'}, {'Set-Cookie': sessionCookie('', 0)});
      // Contention or uncertain storage/read failures must not delete a valid cookie.
      return send(503, {error: 'Workspace temporarily unavailable. Try again.'}, {'Retry-After': '2'});
    }
  };
}
