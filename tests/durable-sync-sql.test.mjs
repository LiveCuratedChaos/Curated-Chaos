import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {createDurableJobRepository} from '../server/durable-job-repository.mjs';
import {createDurableSyncWorker} from '../server/durable-sync-jobs.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connection='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',key='cccccccc-cccc-4ccc-8ccc-cccccccccccc',worker='dddddddd-dddd-4ddd-8ddd-dddddddddddd',other='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const spec={enqueue:['p_owner','p_connection','p_kind','p_key','p_max_attempts'],claim:['p_worker','p_lease_ms'],authorized:['p_id','p_worker','p_token'],settle:['p_id','p_worker','p_token','p_outcome','p_checkpoint','p_error']};
async function fixture(t){
 const db=await PGlite.create();t.after(()=>db.close());await db.exec('create role anon; create role authenticated; create role service_role;');
 await db.exec(readFileSync(new URL('../supabase/drafts/008_durable_sync_jobs.sql',import.meta.url),'utf8'));
 await db.query("insert into cc_sync_private.connection_grants values($1,$2,'gmail_metadata',1,true,clock_timestamp()+interval '1 hour')",[owner,connection]);
 const rpc=async(name,args)=>{assert.equal(name,'cc_durable_sync_job');assert.ok(Object.hasOwn(spec,args.operation));return {data:(await db.query('select public.cc_durable_sync_job($1,$2::jsonb) as value',[args.operation,JSON.stringify(args.input)])).rows[0].value,error:null};};
 return {db,rpc,repo:createDurableJobRepository({rpc})};
}
const enqueue=repo=>repo.enqueue({ownerId:owner,connectionId:connection,kind:'gmail_metadata',idempotencyKey:key});
const fence=row=>({id:row.id,workerId:row.lease_owner,token:row.lease_token});
const makeWorker=(repo,handler,extra={})=>createDurableSyncWorker({repository:repo,handlers:{gmail_metadata:handler},workerId:worker,...extra});

test('SQL atomic idempotency survives simultaneous callers and reconstructed repository',async t=>{
 const {db,rpc,repo}=await fixture(t);const rows=await Promise.all(Array.from({length:8},()=>enqueue(createDurableJobRepository({rpc}))));
 assert.equal(new Set(rows.map(r=>r.id)).size,1);assert.equal((await db.query('select count(*)::int as n from cc_sync_private.jobs')).rows[0].n,1);
 assert.equal((await enqueue(createDurableJobRepository({rpc}))).id,rows[0].id);
 await assert.rejects(repo.enqueue({ownerId:owner,connectionId:connection,kind:'gmail_metadata',idempotencyKey:key,maxAttempts:7}),/storage unavailable/);
 // PGlite serializes connections: this exercises concurrent callers, not a hosted
 // multi-connection lock proof. Hosted SKIP LOCKED acceptance remains unapplied.
});

test('SQL leases exclude another worker; expiry reclaims with fencing and preserves checkpoint',async t=>{
 const {db,repo}=await fixture(t);await enqueue(repo);const first=await repo.claim({workerId:worker});assert.equal(await repo.claim({workerId:other}),null);
 assert.equal(await repo.settle({...fence(first),outcome:'continue',checkpoint:'sealed:v1:synthetic-cursor'}),true);
 await db.exec("update cc_sync_private.jobs set next_run_at=clock_timestamp()-interval '1 second'");const page=await repo.claim({workerId:worker});
 await db.exec("update cc_sync_private.jobs set lease_until=clock_timestamp()-interval '1 second'");assert.equal(await repo.authorized(fence(page)),false);
 const recovered=await repo.claim({workerId:other});assert.ok(recovered.lease_token>page.lease_token);assert.equal(recovered.checkpoint,'sealed:v1:synthetic-cursor');
 assert.equal(await repo.settle({...fence(page),outcome:'complete',checkpoint:null}),false);assert.equal(await repo.settle({...fence(recovered),outcome:'complete',checkpoint:recovered.checkpoint}),true);
 assert.equal(await repo.settle({...fence(recovered),outcome:'complete',checkpoint:null}),false);
});

test('SQL retry is delayed, bounded and eventually terminal, including crashed final leases',async t=>{
 const {db,repo}=await fixture(t);await repo.enqueue({ownerId:owner,connectionId:connection,kind:'gmail_metadata',idempotencyKey:key,maxAttempts:2});
 let row=await repo.claim({workerId:worker});await repo.settle({...fence(row),outcome:'retry',checkpoint:null,errorCode:'transient'});assert.equal(await repo.claim({workerId:other}),null);
 assert.equal((await db.query("select next_run_at>clock_timestamp()+interval '3 seconds' as delayed from cc_sync_private.jobs")).rows[0].delayed,true);
 await db.exec("update cc_sync_private.jobs set next_run_at=clock_timestamp()-interval '1 second'");row=await repo.claim({workerId:other});assert.equal(row.attempts,2);
 await db.exec("update cc_sync_private.jobs set lease_until=clock_timestamp()-interval '1 second'");assert.equal(await repo.claim({workerId:worker}),null);
 assert.equal((await db.query('select state from cc_sync_private.jobs')).rows[0].state,'failed');
});

test('SQL consent epoch, expiry and revoke/regrant prevent old work from reviving',async t=>{
 const {db,repo}=await fixture(t);await enqueue(repo);const row=await repo.claim({workerId:worker});
 await db.exec('update cc_sync_private.connection_grants set active=false,epoch=2');assert.equal(await repo.authorized(fence(row)),false);
 await repo.settle({...fence(row),outcome:'complete',checkpoint:'sealed:v1:new-result'});assert.deepEqual((await db.query('select state,checkpoint from cc_sync_private.jobs')).rows,[{state:'canceled',checkpoint:null}]);
 await assert.rejects(enqueue(repo),/storage unavailable/);await db.exec('update cc_sync_private.connection_grants set active=true,epoch=3');
 const newJob=await enqueue(repo);assert.notEqual(newJob.id,row.id);assert.equal(newJob.grant_epoch,3);
 await db.exec("update cc_sync_private.connection_grants set expires_at=clock_timestamp()-interval '1 second'");assert.equal(await repo.claim({workerId:other}),null);
});

test('SQL browser roles cannot read or invoke, dedicated worker can execute but cannot forge consent',async t=>{
 const {db,repo}=await fixture(t);await enqueue(repo);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from cc_sync_private.jobs'),/permission denied/);await assert.rejects(db.query('select cc_sync_private.claim($1,30000)',[worker]),/permission denied/);await assert.rejects(repo.claim({workerId:worker}),/storage unavailable/);await db.exec('reset role');}
 await db.exec('set role cc_sync_worker');assert.ok((await db.query('select cc_sync_private.claim($1,30000) as job',[worker])).rows[0].job);await assert.rejects(db.exec('update cc_sync_private.connection_grants set active=true'),/permission denied/);await assert.rejects(db.exec('select * from cc_sync_private.jobs'),/permission denied/);await db.exec('reset role');
 await db.exec('set role service_role');assert.equal(await repo.claim({workerId:other}),null);await assert.rejects(db.exec('select * from cc_sync_private.jobs'),/permission denied/);await db.exec('reset role');
});

test('worker rechecks revocation during callback and never accepts its returned cursor',async t=>{
 const {db,repo}=await fixture(t);await enqueue(repo);let calls=0;
 const result=await makeWorker(repo,async context=>{calls++;await context.assertAuthorized();await db.exec('update cc_sync_private.connection_grants set active=false,epoch=2');return {done:true,checkpoint:'sealed:v1:discarded'};}).dispatch();
 assert.equal(calls,1);assert.equal(result.canceled,1);assert.deepEqual((await db.query('select state,checkpoint from cc_sync_private.jobs')).rows,[{state:'canceled',checkpoint:null}]);
});

test('worker processes bounded pages and restarts from durable checkpoint',async t=>{
 const {db,rpc,repo}=await fixture(t);await enqueue(repo);let cursor;
 const first=await makeWorker(repo,async()=>({done:false,checkpoint:'sealed:v1:page-two'}),{maxJobs:1}).dispatch();assert.equal(first.continued,1);
 await db.exec("update cc_sync_private.jobs set next_run_at=clock_timestamp()-interval '1 second'");
 const second=await makeWorker(createDurableJobRepository({rpc}),async ctx=>{cursor=ctx.checkpoint;await ctx.assertAuthorized();return {done:true,checkpoint:null};},{maxJobs:1}).dispatch();assert.equal(cursor,'sealed:v1:page-two');assert.equal(second.completed,1);
});

test('worker timeout aborts, rejects late authorization, and redacts adapter failures',async t=>{
 const {db,repo}=await fixture(t);await enqueue(repo);let context;
 const timeout=await makeWorker(repo,async ctx=>{context=ctx;await new Promise(()=>{});},{callbackTimeoutMs:10}).dispatch();assert.equal(timeout.retried,1);assert.equal(context.signal.aborted,true);await assert.rejects(context.assertAuthorized(),/timeout/);
 assert.equal((await db.query('select error_code from cc_sync_private.jobs')).rows[0].error_code,'timeout');
 await db.exec("update cc_sync_private.jobs set next_run_at=clock_timestamp()-interval '1 second'");
 const retry=await makeWorker(repo,async()=>{throw Error('private@email.invalid secret-provider-token');}).dispatch();assert.equal(retry.retried,1);assert.doesNotMatch(JSON.stringify((await db.query('select * from cc_sync_private.jobs')).rows),/private@email|secret-provider/);
});

test('fresh database instance recovers leased job from persisted synthetic database image',async t=>{
 const {db,repo}=await fixture(t);await enqueue(repo);let row=await repo.claim({workerId:worker});await repo.settle({...fence(row),outcome:'continue',checkpoint:'sealed:v1:persisted-page'});
 await db.exec("update cc_sync_private.jobs set next_run_at=clock_timestamp()-interval '1 second'");row=await repo.claim({workerId:worker});await db.exec("update cc_sync_private.jobs set lease_until=clock_timestamp()-interval '1 second'");
 const restored=await PGlite.create({loadDataDir:await db.dumpDataDir()});t.after(()=>restored.close());
 const restarted=createDurableJobRepository({rpc:async(name,args)=>({data:(await restored.query('select public.cc_durable_sync_job($1,$2::jsonb) as value',[args.operation,JSON.stringify(args.input)])).rows[0].value,error:null})});
 const recovered=await restarted.claim({workerId:other});assert.equal(recovered.id,row.id);assert.equal(recovered.checkpoint,'sealed:v1:persisted-page');assert.ok(recovered.lease_token>row.lease_token);assert.equal(await restarted.settle({...fence(row),outcome:'complete',checkpoint:null}),false);
});

test('revocation between final check and settlement fences completion acknowledgement',async t=>{
 const {db,repo}=await fixture(t);await enqueue(repo);
 const guarded={...repo,settle:async value=>{await db.exec('update cc_sync_private.connection_grants set active=false,epoch=2');return repo.settle(value);}};
 const summary=await makeWorker(guarded,async()=>({done:true,checkpoint:'sealed:v1:discarded-page'}),{maxJobs:1}).dispatch();assert.equal(summary.completed,0);assert.equal(summary.fenced,1);assert.deepEqual((await db.query('select state,checkpoint from cc_sync_private.jobs')).rows,[{state:'canceled',checkpoint:null}]);
});
