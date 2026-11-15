// Server-only session foundation. Not wired to the workspace UI or a public endpoint.
import {randomBytes,createHash} from 'node:crypto';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),opaque=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value),hash=value=>createHash('sha256').update(value).digest('hex');
export function createPrivateWorkspaceSessions({api,now=Date.now,idleMs=30*60000,absoluteMs=12*3600000,maxSessions=100}={}){
 if(!api||['signIn','getUser','isSessionActive','refreshSession','signOutLocal'].some(name=>typeof api[name]!=='function')||!Number.isInteger(idleMs)||idleMs<100||idleMs>30*60000||!Number.isInteger(absoluteMs)||absoluteMs<idleMs||absoluteMs>12*3600000||!Number.isInteger(maxSessions)||maxSessions<1||maxSessions>100)throw Error('Bounded server session configuration required.');
 const sessions=new Map();let disposed=false;
 const validToken=token=>typeof token?.accessToken==='string'&&token.accessToken.length>0&&!/[\s\u007f]/.test(token.accessToken)&&typeof token.refreshToken==='string'&&token.refreshToken.length>0&&Number.isFinite(token.expiresAt)&&token.expiresAt>now();
 const alive=s=>!disposed&&sessions.get(s.key)===s&&now()<s.absoluteAt&&now()<s.idleAt;
 async function revoke(token){if(typeof token?.accessToken!=='string'||!token.accessToken)return false;try{await api.signOutLocal(token.accessToken);return true;}catch{return false;}}
 function drop(s){if(sessions.get(s.key)===s)sessions.delete(s.key);clearTimeout(s.timer);}
 function schedule(s){clearTimeout(s.timer);s.timer=setTimeout(()=>{drop(s);void revoke(s.token);},Math.max(1,Math.min(s.absoluteAt,s.idleAt)-now()));s.timer.unref?.();}
 function find(id){if(!opaque(id))return null;const s=sessions.get(hash(id));if(!s)return null;if(!alive(s)){drop(s);void revoke(s.token);return null;}return s;}
 function view(s){return{user:{...s.user},expiresAt:Math.min(s.absoluteAt,s.idleAt),absoluteExpiresAt:s.absoluteAt};}
 async function verify(token,expected){if(!validToken(token))throw Error('Server session token invalid.');const user=await api.getUser(token.accessToken);if(!uuid(user?.id)||typeof user.email!=='string'||!user.email||user.email.length>320||expected&&user.id!==expected||!await api.isSessionActive(token.accessToken)||!validToken(token))throw Error('Server session could not be verified.');return{id:user.id,email:user.email};}
 async function signIn(email,password){
  if(disposed)throw Error('Server sessions closed.');if(typeof email!=='string'||!email.trim()||email.length>320||typeof password!=='string'||!password||password.length>1024)throw Error('Valid sign-in fields required.');
  for(const s of sessions.values())if(!alive(s)){drop(s);void revoke(s.token);}if(sessions.size>=maxSessions)throw Error('Server session capacity reached.');let candidate;
  try{candidate=await api.signIn(email.trim(),password);const user=await verify(candidate);if(disposed||sessions.size>=maxSessions)throw Error('Server sign-in cancelled.');const id=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url'),time=now(),s={key:hash(id),csrf,user,token:candidate,absoluteAt:time+absoluteMs,idleAt:time+idleMs,pending:null,timer:null};sessions.set(s.key,s);schedule(s);return{sessionId:id,csrf,...view(s)};}
  catch{await revoke(candidate);throw Error('Server sign-in could not be completed.');}
 }
 async function checked(id,{touch=true}={}){
  const s=find(id);if(!s)throw Error('Sign in again.');if(s.pending){const verified=await s.pending;if(touch&&alive(verified)){verified.idleAt=Math.min(verified.absoluteAt,now()+idleMs);schedule(verified);}return verified;}
  const pending=(async()=>{let candidate=null;try{
   if(s.token.expiresAt-now()<60000){candidate=await api.refreshSession(s.token.refreshToken);if(!alive(s))throw Error();const user=await verify(candidate,s.user.id);if(!alive(s))throw Error();s.token=candidate;s.user=user;candidate=null;}
   else{const user=await verify(s.token,s.user.id);if(!alive(s))throw Error();s.user=user;}
   return s;
  }catch{if(candidate)await revoke(candidate);drop(s);await revoke(s.token);throw Error('Your server session ended. Sign in again.');}})();
  s.pending=pending;try{const verified=await pending;if(touch&&alive(verified)){verified.idleAt=Math.min(verified.absoluteAt,now()+idleMs);schedule(verified);}return verified;}finally{if(s.pending===pending)s.pending=null;}
 }
 async function inspect(id,options={}){const s=await checked(id,options);if(!alive(s))throw Error('Server session ended.');return view(s);}
 function checkCsrf(id,csrf){const s=find(id);return Boolean(s&&typeof csrf==='string'&&csrf.length===s.csrf.length&&hash(csrf)===hash(s.csrf));}
 async function readWithAccess(id,read){if(typeof read!=='function')throw Error('Server read callback required.');const s=await checked(id);if(!alive(s))throw Error('Server session ended before read.');const result=await read({accessToken:s.token.accessToken,ownerId:s.user.id});if(!alive(s))throw Error('Server session ended during read.');await checked(id);if(!alive(s))throw Error('Server session ended during verification.');return result;}
 async function writeWithAccess(id,authorize,write){if(typeof authorize!=='function'||typeof write!=='function')throw Error('Explicit server write authorization required.');const s=await checked(id),actor={accessToken:s.token.accessToken,ownerId:s.user.id};if(!alive(s)||await authorize(actor)!==true||!alive(s))throw Error('Reviewed write authorization ended.');await checked(id);if(!alive(s))throw Error('Reviewed write authorization ended.');const result=await write({accessToken:s.token.accessToken,ownerId:s.user.id});if(!alive(s))throw Error('Write may have completed before sign-out. Reload and check before retrying.');await checked(id);if(!alive(s))throw Error('Write could not be confirmed after session change.');return result;}
 async function signOut(id){const s=find(id);if(!s)return{signedOut:true,remoteRevoked:false};drop(s);const remoteRevoked=await revoke(s.token);if(s.pending)try{await s.pending;}catch{}return{signedOut:true,remoteRevoked};}
 async function dispose(){disposed=true;const all=[...sessions.values()];for(const s of all)drop(s);const results=await Promise.all(all.map(async s=>{const revoked=await revoke(s.token);if(s.pending)try{await s.pending;}catch{}return revoked;}));return{closed:true,remoteRevoked:results.every(Boolean)};}
 return{signIn,inspect,checkCsrf,readWithAccess,writeWithAccess,signOut,dispose};
}
