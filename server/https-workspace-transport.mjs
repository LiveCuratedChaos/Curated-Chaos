import {createHash} from 'node:crypto';
const outerCookie='__Host-cc_workspace';
export function exactHttpsOrigin(origin){
 let allowed;try{allowed=new URL(origin);}catch{throw Error('An exact HTTPS app origin is required.');}
 if(typeof origin!=='string'||allowed.origin!==origin||allowed.protocol!=='https:'||allowed.username||allowed.password||allowed.port||allowed.pathname!=='/'||allowed.search||allowed.hash||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(allowed.hostname)||allowed.hostname.endsWith('.localhost'))throw Error('An exact dedicated HTTPS app origin is required.');
 return allowed;
}
export function createHttpsWorkspaceTransport({origin,innerOrigin,cookieName,handleInner,disposeInner,routeAllowed,now=Date.now,recovery=null}){
 const allowed=exactHttpsOrigin(origin);
 if(!['http://127.0.0.1:5312','http://127.0.0.1:5313'].includes(innerOrigin)||!['cc_workspace_staging','cc_workspace_preview'].includes(cookieName)||[handleInner,disposeInner,routeAllowed,now].some(v=>typeof v!=='function'))throw Error('Explicit private workspace bridge required.');
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
   if(recovery&&path.startsWith('/auth/recovery/'))return recovery.handle(req,res);
   if(!routeAllowed(req.method,path))return deny(res,404,'Sign-in route is not available.');
   if(req.method==='POST'&&req.headers.origin!==origin)return deny(res);
   if(path==='/auth/workspace/login'&&!permitAttempt(req))return deny(res,429,'Too many sign-in attempts. Wait a minute and try again.');
   const cookies=String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(outerCookie+'='));if(cookies.length>1)return deny(res);
   const headers={...req.headers,host:new URL(innerOrigin).host};delete headers.cookie;if(cookies.length)headers.cookie=cookieName+cookies[0].slice(outerCookie.length);if(headers.origin)headers.origin=innerOrigin;
   const forwarded={url:path,method:req.method,headers,async *[Symbol.asyncIterator](){yield*req;}};
   const response={writeHead(status,original){const result={...original,...secureHeaders};if(result['Set-Cookie']){const cookie=result['Set-Cookie'];if(typeof cookie!=='string'||!cookie.startsWith(cookieName+'=')||cookie.includes('Domain=')||!cookie.includes('Path=/auth/workspace'))throw Error('Secure session cookie could not be verified.');result['Set-Cookie']=outerCookie+cookie.slice(cookieName.length).replace('Path=/auth/workspace','Path=/')+'; Secure';}res.writeHead(status,result);return this;},end(value){res.end(value);}};
   return handleInner(forwarded,response);
  },
  async dispose(){disposed=true;attempts.clear();await recovery?.dispose();return disposeInner();}
 };
}
