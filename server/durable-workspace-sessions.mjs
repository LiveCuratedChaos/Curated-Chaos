// Durable server session foundation. No HTTP routes or hosted configuration.
import {randomBytes, createHash} from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
const opaque = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function createDurableWorkspaceSessions({api, repository, sealer, keyVersion, now = Date.now, idleMs = 1800000, absoluteMs = 43200000, leaseMs = 15000} = {}) {
 if (!api || ['signIn','getUser','isSessionActive','refreshSession','signOutLocal'].some(k => typeof api[k] !== 'function') || !repository || ['create','read','acquire','commit','revoke'].some(k => typeof repository[k] !== 'function') || !sealer?.seal || !sealer?.unseal || !/^[A-Za-z0-9_-]{1,64}$/.test(keyVersion || '') || !Number.isInteger(idleMs) || idleMs < 100 || idleMs > 1800000 || !Number.isInteger(absoluteMs) || absoluteMs < idleMs || absoluteMs > 43200000 || !Number.isInteger(leaseMs) || leaseMs < 100 || leaseMs > 60000) throw Error('Bounded durable session configuration required.');
 const context = row => `workspace-session:${row.ownerId}:${row.key}:${row.keyVersion}`;
 const alive = row => row && !row.revokedAt && now() < row.idleAt && now() < row.absoluteAt;
 const view = row => ({user:{...row.user}, expiresAt:Math.min(row.idleAt,row.absoluteAt), absoluteExpiresAt:row.absoluteAt});
 const validToken = token => typeof token?.accessToken === 'string' && token.accessToken.length > 0 && !/[\s\u007f]/.test(token.accessToken) && typeof token.refreshToken === 'string' && token.refreshToken.length > 0 && Number.isFinite(token.expiresAt) && token.expiresAt > now();
 async function remoteRevoke(token) {try {if (token?.accessToken) {await api.signOutLocal(token.accessToken);return true;}} catch {} return false;}
 async function verify(token, owner) {if (!validToken(token)) throw Error(); const user = await api.getUser(token.accessToken);if (!uuid(user?.id) || owner && owner !== user.id || typeof user.email !== 'string' || !user.email || user.email.length > 320 || !await api.isSessionActive(token.accessToken) || !validToken(token)) throw Error();return {id:user.id,email:user.email};}
 async function signIn(email,password) {
  if (typeof email !== 'string' || !email.trim() || email.length > 320 || typeof password !== 'string' || !password || password.length > 1024) throw Error('Valid sign-in fields required.');
  let token;try {token=await api.signIn(email.trim(),password);const user=await verify(token), sessionId=randomBytes(32).toString('base64url'), csrf=randomBytes(32).toString('base64url'), time=now();const row={key:hash(sessionId),ownerId:user.id,user,keyVersion,csrfHash:hash(csrf),absoluteAt:time+absoluteMs,idleAt:time+idleMs};row.encrypted=sealer.seal(token,context(row));const saved=await repository.create(row);if(!alive(saved)) throw Error();return {sessionId,csrf,...view(saved)};}catch {await remoteRevoke(token);throw Error('Server sign-in could not be completed.');}
 }
 async function checked(id,{touch=true}={}) {
  if(!opaque(id)) throw Error('Sign in again.');const key=hash(id), lease=randomBytes(32).toString('base64url');
  const row=await repository.acquire(key,lease,leaseMs);if(!row) throw Error('Session busy or ended. Retry after checking sign-in.');
  let token,candidate;
  try {
   if(!alive(row) || row.keyVersion!==keyVersion) throw Error();token=sealer.unseal(row.encrypted,context(row));
   if(token.expiresAt-now()<60000) {candidate=await api.refreshSession(token.refreshToken);token=candidate;}
   const user=await verify(token,row.ownerId);const patch={user,encrypted:sealer.seal(token,context(row)),idleAt:touch?Math.min(row.absoluteAt,now()+idleMs):row.idleAt};
   const saved=await repository.commit(key,row.revision,lease,patch);if(!alive(saved)) throw Error();return {row:saved,token};
  } catch {await repository.revoke(key);await remoteRevoke(candidate || token);throw Error('Your server session ended. Sign in again.');}
 }
 async function inspect(id,options={}) {return view((await checked(id,options)).row);}
 async function checkCsrf(id,csrf) {if(!opaque(id)||!opaque(csrf))return false;const row=await repository.read(hash(id));return Boolean(alive(row)&&row.csrfHash===hash(csrf));}
 async function readWithAccess(id,read) {if(typeof read!=='function')throw Error('Read callback required.');const {row,token}=await checked(id);const result=await read({ownerId:row.ownerId,accessToken:token.accessToken});await checked(id,{touch:false});return result;}
 async function writeWithAccess(id,authorize,write) {if(typeof authorize!=='function'||typeof write!=='function')throw Error('Explicit write authorization required.');const first=await checked(id);if(await authorize({ownerId:first.row.ownerId,accessToken:first.token.accessToken})!==true)throw Error('Write not authorized.');const current=await checked(id,{touch:false});const result=await write({ownerId:current.row.ownerId,accessToken:current.token.accessToken});try {await checked(id,{touch:false});}catch {throw Error('Write may have completed. Reload and check before retrying.');}return result;}
 async function signOut(id) {if(!opaque(id))return {signedOut:true,remoteRevoked:false};const row=await repository.revoke(hash(id));let token;try{if(row?.keyVersion===keyVersion)token=sealer.unseal(row.encrypted,context(row));}catch {}return {signedOut:true,remoteRevoked:await remoteRevoke(token)};}
 // Disposing a request-scoped adapter must never sign out unrelated durable sessions.
 return {signIn,inspect,checkCsrf,readWithAccess,writeWithAccess,signOut};
}
