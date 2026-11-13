import {createHash} from 'node:crypto';
import {createPrivateSessionHttp} from './private-workspace-session-http.mjs';
import {privateSessionCss,privateSessionScript} from './private-workspace-session-ui.mjs';
const innerOrigin='http://127.0.0.1:5312',outerCookie='__Host-cc_workspace',innerCookie='cc_workspace_staging';
const readPaths=new Set(['/auth/workspace/','/auth/workspace/ui.css','/auth/workspace/ui.mjs','/auth/workspace/status','/auth/workspace/check']);
const writePaths=new Set(['/auth/workspace/login','/auth/workspace/logout']);
export const passwordSignInHtml=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Curated Chaos</title><link rel="stylesheet" href="/auth/workspace/ui.css"><main><p class="brand">CURATED CHAOS</p><h1>Welcome back</h1><p class="deck">Sign in with your email and password.</p><p id="status" role="status">Checking sign-in…</p><p id="error" role="alert" hidden></p><form id="login"><fieldset id="fields" disabled><legend>Sign in</legend><label>Email<input name="email" type="email" autocomplete="username" required maxlength="320"></label><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="1024"></label><button type="submit">Sign in</button></fieldset></form><button id="logout" type="button" hidden>Sign out</button><button id="session-recheck" type="button">Recheck sign-in</button><p class="note">This separate sign-in preview does not open app records or connect email, calendars or banks. Account creation and password recovery are not enabled here.</p></main><script type="module" src="/auth/workspace/ui.mjs"></script></html>`;
// Candidate direct-TLS transport only. No listener, proxy trust, provider configuration or deployment.
export function createHttpsPasswordSessionPreview({origin,api,now=Date.now}={}){
 let allowed;try{allowed=new URL(origin);}catch{throw Error('An exact HTTPS app origin is required.');}
 if(typeof origin!=='string'||allowed.origin!==origin||allowed.protocol!=='https:'||allowed.username||allowed.password||allowed.port||allowed.pathname!=='/'||allowed.search||allowed.hash||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(allowed.hostname)||allowed.hostname.endsWith('.localhost'))throw Error('An exact dedicated HTTPS app origin is required.');
 if(typeof now!=='function')throw Error('A server clock is required.');
 const inner=createPrivateSessionHttp({origin:innerOrigin,api,now,cookieName:innerCookie,loginAttemptScope:'browser-context',ui:passwordSignInHtml,css:privateSessionCss,script:privateSessionScript});
 const attempts=new Map();let disposed=false;
 const secureHeaders={'Cache-Control':'no-store','Strict-Transport-Security':'max-age=31536000','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
 function deny(res,status=403,message='Use the configured secure sign-in page.'){res.writeHead(status,{...secureHeaders,'Content-Type':'application/json; charset=utf-8',...(status===429?{'Retry-After':'60'}:{})});res.end(JSON.stringify({error:message}));return true;}
 function permitAttempt(req){const time=now();for(const[key,value]of attempts)if(value.until<=time)attempts.delete(key);const address=req.socket?.remoteAddress;if(typeof address!=='string'||!address)return false;const key=createHash('sha256').update(address).digest('hex'),entry=attempts.get(key);if(entry){if(entry.count>=5)return false;entry.count++;return true;}if(attempts.size>=1024)return false;attempts.set(key,{until:time+60000,count:1});return true;}
 return{
  async handle(req,res){
   if(disposed)return deny(res,503,'Sign-in preview is closed.');
   // Forwarding headers never establish HTTPS, host, origin or a trusted client address.
   if(req.socket?.encrypted!==true||req.headers.host!==allowed.host||Object.keys(req.headers).some(k=>['forwarded','x-forwarded-host','x-forwarded-proto','x-forwarded-for'].includes(k.toLowerCase()))||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))return deny(res);
   const path=req.url;if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||path.includes('?')||path.includes('#'))return deny(res);
   if(!(req.method==='GET'&&readPaths.has(path)||req.method==='POST'&&writePaths.has(path)))return deny(res,404,'Sign-in route is not available.');
   if(req.method==='POST'&&req.headers.origin!==origin)return deny(res);
   if(path==='/auth/workspace/login'&&!permitAttempt(req))return deny(res,429,'Too many sign-in attempts. Wait a minute and try again.');
   const cookies=String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(outerCookie+'='));if(cookies.length>1)return deny(res);
   const headers={...req.headers,host:new URL(innerOrigin).host};delete headers.cookie;if(cookies.length)headers.cookie=innerCookie+cookies[0].slice(outerCookie.length);if(headers.origin)headers.origin=innerOrigin;
   const forwarded={url:path,method:req.method,headers,async *[Symbol.asyncIterator](){yield*req;}};
   const response={writeHead(status,original){const result={...original,...secureHeaders};if(result['Set-Cookie']){const cookie=result['Set-Cookie'];if(typeof cookie!=='string'||!cookie.startsWith(innerCookie+'=')||cookie.includes('Domain=')||!cookie.includes('Path=/auth/workspace'))throw Error('Secure session cookie could not be verified.');result['Set-Cookie']=outerCookie+cookie.slice(innerCookie.length).replace('Path=/auth/workspace','Path=/')+'; Secure';}res.writeHead(status,result);return this;},end(value){res.end(value);}};
   return inner.handle(forwarded,response);
  },
  async dispose(){disposed=true;attempts.clear();return inner.dispose();}
 };
}
