// Server only. Inject the existing privileged {data,error} RPC executor for the
// public.cc_durable_sync_job wrapper over cc_sync_private functions. Never use a
// browser client/service key here. Hosted grants/migration require separate approval.
// No HTTP client, credential loading, browser grants or in-memory fallback.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kinds=new Set(['gmail_metadata','google_calendar','plaid_readonly']);
const states=new Set(['pending','leased','complete','canceled','failed']);
const errors=new Set(['transient','invalid_result','unsupported','consent_revoked','timeout']);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const validId=v=>typeof v==='string'&&uuid.test(v);
const checkpoint=v=>v===null||(typeof v==='string'&&v.startsWith('sealed:v1:')&&v.length>10&&Buffer.byteLength(v)<=16384);
const fail=()=>{throw Error('Durable job request could not be verified.');};
function job(v){
 if(!v||!validId(v.id)||!validId(v.owner_id)||!validId(v.connection_id)||!validId(v.idempotency_key)||!kinds.has(v.kind)||!states.has(v.state)||!integer(v.grant_epoch,1,2147483647)||!integer(v.attempts,0,20)||!integer(v.max_attempts,1,20)||!integer(v.lease_token,0,Number.MAX_SAFE_INTEGER)||!checkpoint(v.checkpoint))fail();
 if(v.state==='leased'&&(!validId(v.lease_owner)||!Number.isFinite(Date.parse(v.lease_until))))fail();
 return Object.freeze({id:v.id,owner_id:v.owner_id,connection_id:v.connection_id,idempotency_key:v.idempotency_key,kind:v.kind,state:v.state,grant_epoch:v.grant_epoch,attempts:v.attempts,max_attempts:v.max_attempts,lease_token:v.lease_token,lease_owner:v.lease_owner??null,lease_until:v.lease_until??null,checkpoint:v.checkpoint});
}
export function createDurableJobRepository({rpc,rpcTimeoutMs=2000}={}){
 if(typeof rpc!=='function'||!integer(rpcTimeoutMs,10,5000))throw Error('Privileged durable job RPC executor required.');
 async function call(name,args){let timer;const controller=new AbortController();try{const result=await Promise.race([Promise.resolve().then(()=>rpc('cc_durable_sync_job',{operation:name,input:args},{signal:controller.signal})),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error());},rpcTimeoutMs);})]);if(!result||result.error||!Object.hasOwn(result,'data'))throw Error();return result.data;}catch{throw Error('Durable job storage unavailable.');}finally{clearTimeout(timer);controller.abort();}}
 const fence=v=>{if(!v||!validId(v.id)||!validId(v.workerId)||!integer(v.token,1,Number.MAX_SAFE_INTEGER))fail();return{p_id:v.id,p_worker:v.workerId,p_token:v.token};};
 return Object.freeze({
  async enqueue({ownerId,connectionId,kind,idempotencyKey,maxAttempts=5}={}){
   if(!validId(ownerId)||!validId(connectionId)||!kinds.has(kind)||!validId(idempotencyKey)||!integer(maxAttempts,1,20))fail();
   const v=job(await call('enqueue',{p_owner:ownerId,p_connection:connectionId,p_kind:kind,p_key:idempotencyKey,p_max_attempts:maxAttempts}));
   if(v.owner_id!==ownerId||v.connection_id!==connectionId||v.kind!==kind||v.idempotency_key!==idempotencyKey||v.max_attempts!==maxAttempts)fail();return v;
  },
  async claim({workerId,leaseMs=30000}={}){
   if(!validId(workerId)||!integer(leaseMs,1000,60000))fail();const raw=await call('claim',{p_worker:workerId,p_lease_ms:leaseMs});if(raw===null)return null;const v=job(raw);if(v.state!=='leased'||v.lease_owner!==workerId)fail();return v;
  },
  async authorized(value){const v=await call('authorized',fence(value));if(typeof v!=='boolean')fail();return v;},
  async settle(value){
   const args=fence(value),{outcome,checkpoint:next=null,errorCode=null}=value;
   if(!['complete','continue','retry','cancel','fail'].includes(outcome)||!checkpoint(next)||(errorCode!==null&&!errors.has(errorCode)))fail();
   const v=await call('settle',{...args,p_outcome:outcome,p_checkpoint:next,p_error:errorCode});if(typeof v!=='boolean')fail();return v;
  }
 });
}
