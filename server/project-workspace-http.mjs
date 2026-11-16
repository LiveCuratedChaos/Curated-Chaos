// Optional actor/CSRF-bound routes. Not mounted or enabled by default.
export function createProjectWorkspaceHttp({origin, sessions, workspace, bodyTimeoutMs = 5000} = {}) {
  const allowed = new URL(origin);
  if (allowed.protocol !== 'https:' || allowed.origin !== origin || !sessions ||
      ['readWithAccess','writeWithAccess','checkCsrf'].some(k => typeof sessions[k] !== 'function') || !workspace ||
      ['list','create','update','undo','history'].some(k => typeof workspace[k] !== 'function') ||
      !Number.isInteger(bodyTimeoutMs) || bodyTimeoutMs<1 || bodyTimeoutMs>10000) throw Error('Explicit secure workspace dependencies required.');
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'};
  const send = (status, data) => new Response(JSON.stringify(data), {status,headers});
  return async request => {
    const url = new URL(request.url), prefix = '/api/workspace/projects/';
    if (!url.pathname.startsWith(prefix)) return null;
    if (url.origin !== origin || request.headers.get('origin') && request.headers.get('origin') !== origin ||
        request.headers.get('sec-fetch-site') && !['same-origin','none'].includes(request.headers.get('sec-fetch-site'))) return send(403,{error:'Same-origin workspace required.'});
    const action = url.pathname.slice(prefix.length), read = action === 'list';
    if (url.search || !['list','create','update','undo','history'].includes(action)) return send(404,{error:'Not found.'});
    if (request.method !== (read ? 'GET' : 'POST')) return send(405,{error:'Method not allowed.'});
    const cookies = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith('__Host-cc_workspace='));
    const id = cookies.length === 1 ? cookies[0].slice('__Host-cc_workspace='.length) : '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return send(401,{error:'Sign in again.'});
    if (request.signal.aborted) return send(409,{error:'Request ended.'});
    try {
      if (read) return send(200, await sessions.readWithAccess(id, actor => workspace.list(actor)));
      if (request.headers.get('origin') !== origin || !await sessions.checkCsrf(id, request.headers.get('x-cc-csrf'))) return send(403,{error:'Request verification failed.'});
      const input = await readCommand(request, bodyTimeoutMs);
      const result = action === 'history' ? await sessions.readWithAccess(id, actor => workspace.history(actor,input)) :
        await sessions.writeWithAccess(id, async () => true, actor => workspace[action](actor,input));
      return send(200,result);
    } catch(error) {
      if (error?.code === 'SESSION_ENDED') return send(401,{error:'Sign in again.'});
      if (error?.code === 'SESSION_BUSY' || error?.code === 'SESSION_UNAVAILABLE') return send(503,{error:'Workspace busy. Try again.'});
      return send(409,{error:'The save or read could not be confirmed. Keep your draft and refresh before making another change.'});
    }
  };
}
async function readCommand(request, timeoutMs) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw Error();
  const reader = request.body?.getReader(); if (!reader) throw Error();
  let bytes = 0, timer, abort; const chunks = [];
  const ended = new Promise((_, reject) => {
    abort = () => { void reader.cancel().catch(() => {}); reject(Error()); };
    timer = setTimeout(abort, timeoutMs); request.signal.addEventListener('abort',abort,{once:true});
  });
  try {
    while (true) { const {value,done} = await Promise.race([reader.read(),ended]); if(done) break;
      bytes += value.byteLength; if(bytes > 32768 || request.signal.aborted) throw Error(); chunks.push(value); }
    const text = new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)); const input = JSON.parse(text);
    if (!input || Object.getPrototypeOf(input) !== Object.prototype) throw Error(); return input;
  } catch { void reader.cancel().catch(() => {}); throw Error(); }
  finally {clearTimeout(timer);request.signal.removeEventListener('abort',abort);reader.releaseLock();}
}
