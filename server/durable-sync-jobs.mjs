// Bounded, at-least-once scheduler foundation; not provider consent or exactly-once effects.
// Callbacks are trusted server adapters, must honor signal and recheck assertAuthorized
// immediately before each provider call/effect. Any writes also need their own atomic
// consent/version/idempotency guard. A revoked in-flight network request cannot be recalled.
// Default dispatch deadline is 20s (maximum 25s) for a 30s scheduled-function slot;
// trusted adapters must not block the JS event loop and must pass AbortSignal on.
// This module does not schedule itself or enable a provider connection or import.
import {randomUUID} from 'node:crypto';
const supported=new Set(['gmail_metadata','google_calendar','plaid_readonly']);
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const validCheckpoint=v=>v===null||(typeof v==='string'&&v.startsWith('sealed:v1:')&&v.length>10&&Buffer.byteLength(v)<=16384);
export function createDurableSyncWorker({repository,handlers,workerId=randomUUID(),now=()=>performance.now(),maxJobs=5,maxRunMs=20000,callbackTimeoutMs=5000,leaseMs=30000}={}){
 if(!repository||['claim','authorized','settle'].some(k=>typeof repository[k]!=='function')||!handlers||typeof handlers!=='object'||Object.keys(handlers).some(k=>!supported.has(k)||typeof handlers[k]!=='function')||!int(maxJobs,1,10)||!int(maxRunMs,100,25000)||!int(callbackTimeoutMs,10,10000)||!int(leaseMs,1000,60000)||leaseMs<maxRunMs+1000)throw Error('Bounded durable worker configuration required.');
 let running=false;
 return Object.freeze({async dispatch(){
  if(running)throw Error('Durable worker dispatch already active.');running=true;
  const started=now(),summary={claimed:0,completed:0,continued:0,retried:0,canceled:0,failed:0,fenced:0};let stopped=false,activeController;
  // Bound storage as well as callbacks. Late RPC acknowledgements are discarded;
  // their transaction may have committed, so recovery must use the lease fence.
  async function bounded(fn){let timer;const remaining=maxRunMs-(now()-started);if(stopped||remaining<=0)throw Error('Durable dispatch deadline reached.');try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>{stopped=true;activeController?.abort();reject(Error('Durable dispatch deadline reached.'));},remaining);})]);}finally{clearTimeout(timer);}}
  try{while(summary.claimed<maxJobs&&now()-started+callbackTimeoutMs<maxRunMs){
   const row=await bounded(()=>repository.claim({workerId,leaseMs}));if(!row)break;summary.claimed++;
   const fence={id:row.id,workerId,token:row.lease_token};
   const assertAuthorized=async()=>{if(!await bounded(()=>repository.authorized(fence)))throw Error('consent_revoked');};
   const settle=async(outcome,next=null,errorCode=null)=>{const ok=await bounded(()=>repository.settle({...fence,outcome,checkpoint:next,errorCode}));if(!ok)summary.fenced++;else summary[({complete:'completed',continue:'continued',retry:'retried',cancel:'canceled',fail:'failed'})[outcome]]++;};
   if(!supported.has(row.kind)||typeof handlers[row.kind]!=='function'){await settle('fail',null,'unsupported');continue;}
   if(!await bounded(()=>repository.authorized(fence))){await settle('cancel',null,'consent_revoked');continue;}
   const controller=new AbortController();activeController=controller;let timer,outcome,next=row.checkpoint,errorCode=null;
   const guardedAuthorization=async()=>{if(controller.signal.aborted)throw Error('timeout');await assertAuthorized();if(controller.signal.aborted)throw Error('timeout');};
   try{
    const timedOut=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('timeout'));},callbackTimeoutMs);});
    // Only opaque encrypted cursor material crosses the queue boundary. No provider
    // identifiers/content, access tokens or error messages enter diagnostics/SQL errors.
    const result=await bounded(()=>Promise.race([Promise.resolve().then(()=>handlers[row.kind](Object.freeze({jobId:row.id,ownerId:row.owner_id,connectionId:row.connection_id,grantEpoch:row.grant_epoch,idempotencyKey:row.idempotency_key,checkpoint:row.checkpoint,signal:controller.signal,assertAuthorized:guardedAuthorization}))),timedOut]));
    await assertAuthorized();
    if(!result||typeof result.done!=='boolean'||!validCheckpoint(result.checkpoint)||Object.keys(result).some(k=>!['done','checkpoint'].includes(k))){outcome='fail';errorCode='invalid_result';}
    else{outcome=result.done?'complete':'continue';next=result.checkpoint;}
   }catch(error){
    const code=controller.signal.aborted?'timeout':error?.message==='consent_revoked'?'consent_revoked':'transient';
    outcome=code==='consent_revoked'?'cancel':'retry';errorCode=code;
   }finally{clearTimeout(timer);controller.abort();}
   // A failed/ambiguous acknowledgement is never followed by a second mutation.
   // Leave the lease for fenced recovery; the caller receives a generic storage error.
   await settle(outcome,next,errorCode);
  }return Object.freeze(summary);}finally{running=false;}
 }});
}
