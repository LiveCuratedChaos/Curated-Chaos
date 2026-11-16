import test from 'node:test';
import assert from 'node:assert/strict';
import {createDurableJobRepository} from '../server/durable-job-repository.mjs';
import {createDurableSyncWorker} from '../server/durable-sync-jobs.mjs';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',worker='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const row={id,owner_id:id,connection_id:id,idempotency_key:id,kind:'gmail_metadata',state:'leased',grant_epoch:1,attempts:1,max_attempts:5,lease_token:1,lease_owner:worker,lease_until:'2030-01-01T00:00:00Z',checkpoint:null};
test('repository has no implicit store and rejects unsupported kinds and plaintext checkpoints before RPC',async()=>{
 assert.throws(()=>createDurableJobRepository(),/executor required/);let calls=0;const repo=createDurableJobRepository({rpc:async()=>{calls++;return {data:true,error:null};}});
 await assert.rejects(repo.enqueue({ownerId:id,connectionId:id,kind:'email_send',idempotencyKey:id}));
 await assert.rejects(repo.settle({id,workerId:worker,token:1,outcome:'complete',checkpoint:'plaintext message content'}));
 await assert.rejects(repo.claim({workerId:worker,leaseMs:60001}));assert.equal(calls,0);
});
test('repository validates acknowledgements, never unwraps twice or leaks RPC error content',async()=>{
 for(const raw of [{data:{data:row},error:null},{data:{...row,lease_owner:id},error:null},{data:row,error:{message:'private-token'}},true]){
  const repo=createDurableJobRepository({rpc:async(name,args)=>{assert.equal(name,'cc_durable_sync_job');assert.equal(args.operation,'claim');return raw;}});
  await assert.rejects(repo.claim({workerId:worker}),error=>!error.message.includes('private-token'));
 }
 const stalled=createDurableJobRepository({rpcTimeoutMs:10,rpc:async(_name,_args,{signal})=>{assert.ok(signal);return new Promise(()=>{});}});await assert.rejects(stalled.claim({workerId:worker}),/storage unavailable/);
});
test('worker enforces job count, rejects unexpected payload results and never logs them',async()=>{
 let claims=0;const outcomes=[];const repo={claim:async()=>{claims++;return row;},authorized:async()=>true,settle:async value=>{outcomes.push(value);return true;}};
 const result=await createDurableSyncWorker({repository:repo,handlers:{gmail_metadata:async()=>({done:true,checkpoint:null,messageBody:'private message'})},workerId:worker,maxJobs:2}).dispatch();
 assert.equal(claims,2);assert.equal(result.failed,2);assert.ok(outcomes.every(v=>v.errorCode==='invalid_result'));assert.doesNotMatch(JSON.stringify(outcomes),/private message|messageBody/);
 assert.throws(()=>createDurableSyncWorker({repository:repo,handlers:{unsupported:async()=>{}},maxJobs:11}));
});
test('dispatch deadline includes a stalled storage request and cannot start a late provider callback',async()=>{
 let calls=0,release;const repo={claim:()=>new Promise(resolve=>{release=resolve;}),authorized:async()=>true,settle:async()=>true};
 const runner=createDurableSyncWorker({repository:repo,handlers:{gmail_metadata:async()=>{calls++;return {done:true,checkpoint:null};}},workerId:worker,maxRunMs:100,callbackTimeoutMs:10,leaseMs:1000+100});
 const pending=runner.dispatch();await assert.rejects(runner.dispatch(),/already active/);await assert.rejects(pending,/deadline reached/);release(row);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,0);
});
test('an ambiguous settlement is not followed by another settlement or replayed provider call',async()=>{
 let calls=0,settles=0;const repo={claim:async()=>row,authorized:async()=>true,settle:async()=>{settles++;throw Error('storage unavailable');}};
 await assert.rejects(createDurableSyncWorker({repository:repo,handlers:{gmail_metadata:async()=>{calls++;return {done:true,checkpoint:null};}},workerId:worker}).dispatch(),/storage unavailable/);assert.equal(calls,1);assert.equal(settles,1);
});
test('unsupported callbacks fail closed without provider execution and storage errors stay errors',async()=>{
 const outcomes=[];let reads=0;const repo={claim:async()=>reads++?null:row,authorized:async()=>true,settle:async value=>{outcomes.push(value);return true;}};
 const result=await createDurableSyncWorker({repository:repo,handlers:{},workerId:worker}).dispatch();assert.equal(result.failed,1);assert.equal(outcomes[0].errorCode,'unsupported');
 const broken={...repo,claim:async()=>row,authorized:async()=>{throw Error('storage unavailable');}};await assert.rejects(createDurableSyncWorker({repository:broken,handlers:{gmail_metadata:async()=>assert.fail('must not run')},workerId:worker}).dispatch(),/storage unavailable/);
});
