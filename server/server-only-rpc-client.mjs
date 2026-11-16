// Draft server-only transport. Explicit injected configuration; no environment or credential-file access.
const rpcNames=new Set(['cc_durable_session','cc_durable_sync_job','cc_project_workspace']);
const maxBytes=64*1024;
const failure=()=>new Error('Server operation unavailable.');
function targetOrigin(value,expectedProjectRef){
 if(typeof value!=='string'||typeof expectedProjectRef!=='string'||!/^[a-z0-9]{10,32}$/.test(expectedProjectRef))throw failure();
 let url;try{url=new URL(value);}catch{throw failure();}
 if(url.protocol!=='https:'||url.hostname!==expectedProjectRef+'.supabase.co'||url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash||value!==url.origin&&value!==url.origin+'/')throw failure();
 return url.origin;
}
function serverHeaders(key){
 // Shape checking is not signature verification: Supabase validates the actual credential.
 if(/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(key))return {'Content-Type':'application/json',apikey:key};
 try{
  const parts=key.split('.');
  if(parts.length!==3||parts.some(part=>!part||!/^[A-Za-z0-9_-]+$/.test(part)))throw failure();
  const parse=part=>{const bytes=Buffer.from(part,'base64url');if(bytes.toString('base64url')!==part)throw failure();return JSON.parse(bytes.toString('utf8'));};
  const header=parse(parts[0]),payload=parse(parts[1]);
  if(header.alg!=='HS256'||header.typ!=='JWT'||payload.role!=='service_role')throw failure();
  return {'Content-Type':'application/json',Authorization:'Bearer '+key,apikey:key};
 }catch{throw failure();}
}
function encode(value){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)throw failure();
 let text;try{text=JSON.stringify(value,(_key,item)=>{
  if(item===undefined||typeof item==='function'||typeof item==='symbol'||typeof item==='bigint'||typeof item==='number'&&!Number.isFinite(item))throw failure();
  if(item&&typeof item==='object'&&!Array.isArray(item)&&Object.getPrototypeOf(item)!==Object.prototype)throw failure();
  return item;
 });}catch{throw failure();}
 if(new TextEncoder().encode(text).byteLength>maxBytes)throw failure();return text;
}
async function readJson(response,responseLimit=maxBytes){
 if(!response?.ok||!/^application\/json(?:\s*;|$)/i.test(response.headers?.get('content-type')||''))throw failure();
 const declared=response.headers.get('content-length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>responseLimit))throw failure();
 const reader=response.body?.getReader();if(!reader)throw failure();
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;if(!(value instanceof Uint8Array))throw failure();size+=value.byteLength;if(size>responseLimit)throw failure();chunks.push(value);}}
 catch{try{await reader.cancel();}catch{}throw failure();}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw failure();}
}
export function createServerOnlyRpcClient({supabaseOrigin,serviceRoleKey,expectedProjectRef,fetchImpl,timeoutMs=5000}={}){
 const origin=targetOrigin(supabaseOrigin,expectedProjectRef);
 if(typeof serviceRoleKey!=='string'||!serviceRoleKey.trim()||serviceRoleKey!==serviceRoleKey.trim()||serviceRoleKey.length>8192||/[\x00-\x1f\x7f]/.test(serviceRoleKey)||typeof fetchImpl!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw failure();
 const headers=serverHeaders(serviceRoleKey);
 return Object.freeze({async rpc(name,parameters,{signal}={}){
  if(!rpcNames.has(name)||signal!==undefined&&!(signal instanceof AbortSignal)||signal?.aborted)throw failure();const body=encode(parameters);const controller=new AbortController();let timer,onAbort;
  try{
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(failure());},timeoutMs);});
   const cancelled=new Promise((_,reject)=>{onAbort=()=>{controller.abort();reject(failure());};signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)onAbort();});
   const operation=(async()=>{
    const response=await fetchImpl(origin+'/rest/v1/rpc/'+name,{method:'POST',headers:{...headers},body,signal:controller.signal,redirect:'error',cache:'no-store'});
    return {data:await readJson(response,name==='cc_project_workspace'?512*1024:maxBytes),error:null};
   })();
   return await Promise.race([operation,timeout,cancelled]);
  }catch{throw failure();}finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);controller.abort();}
 }});
}
