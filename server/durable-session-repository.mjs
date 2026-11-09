// Server-only RPC adapter. Transport must use a privileged server identity; never a browser key.
const key = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function createDurableSessionRepository({rpc} = {}) {
 if (typeof rpc !== 'function') throw Error('Server RPC transport required.');
 async function call(action, input) {
  if (!key(input.key)) throw Error('Hashed session key required.');
  let result;
  try { result = await rpc('cc_durable_session', {operation: action, input}); }
  catch { throw Error('Session storage unavailable.'); }
  if (result?.error) throw Error('Session storage unavailable.');
  const value = Object.hasOwn(result || {}, 'data') ? result.data : result;
  return value ?? null;
 }
 return {
  create: row => call('create', row),
  read: key => call('read', {key}),
  acquire: (key, lease, leaseMs) => call('acquire', {key, lease, leaseMs}),
  commit: (key, revision, lease, patch) => call('commit', {key, revision, lease, ...patch}),
  revoke: key => call('revoke', {key})
 };
}
