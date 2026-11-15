import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderImportExecutor} from '../server/provider-import-executor.mjs';
import {createDevProviderRepository} from '../server/dev-provider-repository.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',selectionId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function fixture(){
 const state={rows:[],writes:0,valid:true,time:100,loseAcknowledgement:false};
 const actor={accessToken:'fixture-token',binding:'fixture-session-binding'};
 const repository={readByIds:async(_actor,owner,ids)=>structuredClone(state.rows.filter(r=>r.owner_id===owner&&ids.includes(r.id))),insertMany:async(_actor,owner,records)=>{state.writes++;assert.equal(owner,ownerId);if(records.some(r=>state.rows.some(x=>x.id===r.id)))throw Error('Conflict');const saved=records.map(r=>({...structuredClone(r),version:1,deleted_at:null}));state.rows.push(...saved);if(state.loseAcknowledgement)throw Error('Lost response');return saved;}};
 const executor=createProviderImportExecutor({repository,authorizeWrite:async()=>true,validateSourceSelection:async()=>{if(state.sourceValid===false)throw Error('Source paused or changed');},now:()=>state.time,resolveActor:async a=>state.valid?{ownerId,sessionBinding:a.binding}:null});
 const args={connectionId,selectionId,fixtureRunId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',selectedKeys:['fixture-key'],preview:{previewOnly:true,persisted:false,selectionId,result:{ownerId,connectionId,provider:'gmail',content:'metadata-only',complete:true,messages:[{key:'fixture-key',ownerId,connectionId,provider:'gmail',visibility:'private',messageId:'fixture-message',threadId:'fixture-thread',subject:'QA fictional import',sender:'fixture@example.test',receivedAt:'2026-11-03T12:00:00Z'}]}}};
 return {state,actor,executor,args,repository};
}
test('import preparation performs no writes; execution requires approval and is idempotent',async()=>{
 const f=fixture(),review=await f.executor.prepare(f.actor,f.args);assert.equal(f.state.writes,0);assert.equal(review.insertCount,1);
 await assert.rejects(f.executor.execute(f.actor,{reviewId:review.reviewId,approved:false}));assert.equal(f.state.writes,0);
 const saved=await f.executor.execute(f.actor,{reviewId:review.reviewId,approved:true});assert.equal(saved.inserted,1);assert.equal(f.state.rows[0].payload.fictional,true);assert.equal(f.state.rows[0].origin,'google_import_qa');
 const repeat=await f.executor.prepare(f.actor,f.args);assert.equal(repeat.unchangedCount,1);const next=await f.executor.execute(f.actor,{reviewId:repeat.reviewId,approved:true});assert.equal(next.inserted,0);assert.equal(f.state.writes,1);
});
test('double submission can execute only once and foreign sessions cannot claim approval',async()=>{
 const f=fixture(),review=await f.executor.prepare(f.actor,f.args);
 await assert.rejects(f.executor.execute({...f.actor,binding:'other-session-binding'},{reviewId:review.reviewId,approved:true}));
 const results=await Promise.allSettled([f.executor.execute(f.actor,{reviewId:review.reviewId,approved:true}),f.executor.execute(f.actor,{reviewId:review.reviewId,approved:true})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.state.writes,1);
});
test('expired reviews and changed records never start an insertion',async()=>{
 const f=fixture(),review=await f.executor.prepare(f.actor,f.args);f.state.time+=300000;await assert.rejects(f.executor.execute(f.actor,{reviewId:review.reviewId,approved:true}));assert.equal(f.state.writes,0);
 const g=fixture(),old=await g.executor.prepare(g.actor,g.args);g.state.valid=false;await assert.rejects(g.executor.execute(g.actor,{reviewId:old.reviewId,approved:true}));assert.equal(g.state.writes,0);
});
test('lost insert acknowledgement is uncertain; rereview prevents duplicate retry',async()=>{
 const f=fixture(),review=await f.executor.prepare(f.actor,f.args);f.state.loseAcknowledgement=true;
 await assert.rejects(f.executor.execute(f.actor,{reviewId:review.reviewId,approved:true}),/not confirmed/);assert.equal(f.state.rows.length,1);
 f.state.loseAcknowledgement=false;const retry=await f.executor.prepare(f.actor,f.args);assert.equal(retry.insertCount,0);await f.executor.execute(f.actor,{reviewId:retry.reviewId,approved:true});assert.equal(f.state.writes,1);
});
test('changed or deleted source records require review and cannot be overwritten',async()=>{
 const f=fixture();let review=await f.executor.prepare(f.actor,f.args);await f.executor.execute(f.actor,{reviewId:review.reviewId,approved:true});
 const changed=structuredClone(f.args);changed.preview.result.messages[0].subject='Changed fictional subject';review=await f.executor.prepare(f.actor,changed);assert.equal(review.conflictCount,1);await assert.rejects(f.executor.execute(f.actor,{reviewId:review.reviewId,approved:true}),/conflict/);assert.equal(f.state.writes,1);
 f.state.rows[0].deleted_at='2026-11-08T00:00:00Z';await assert.rejects(f.executor.prepare(f.actor,f.args),/conflicts/);assert.equal(f.state.writes,1);
});
test('development repository reads bounded batches and uses a single atomic insert without upsert',async()=>{
 const calls=[],config={supabaseUrl:'https://fixturedev.supabase.co',projectRef:'fixturedev',publishableKey:'sb_publishable_fixture'};
 const repo=createDevProviderRepository(config,{expectedProjectRef:'fixturedev',fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>[]};}});
 await repo.readByIds({accessToken:'fixture-token'},ownerId,Array.from({length:51},(_,i)=>'00000000-0000-4000-a000-'+String(i).padStart(12,'0')));assert.equal(calls.length,2);
 await repo.insertMany({accessToken:'fixture-token'},ownerId,[{id:connectionId,owner_id:ownerId,household_id:null,visibility:'private',section:'Personal Life',item_type:'provider_email',origin:'google_import_qa',payload:{fictional:true}}]);
 assert.equal(calls[2].options.method,'POST');assert.equal(calls[2].options.redirect,'error');assert.doesNotMatch(calls[2].url,/on_conflict/);assert.equal(calls[2].options.headers.Prefer,'return=representation');
 assert.throws(()=>createDevProviderRepository(config,{expectedProjectRef:'other'}));
});
test('database JSON object-key order does not create false import conflicts',async()=>{
 const f=fixture(),review=await f.executor.prepare(f.actor,f.args);await f.executor.execute(f.actor,{reviewId:review.reviewId,approved:true});
 const payload=f.state.rows[0].payload;f.state.rows[0].payload=Object.fromEntries(Object.entries(payload).reverse());f.state.rows[0].payload.content=Object.fromEntries(Object.entries(payload.content).reverse());
 const again=await f.executor.prepare(f.actor,f.args);assert.equal(again.conflictCount,0);assert.equal(again.unchangedCount,1);await f.executor.execute(f.actor,{reviewId:again.reviewId,approved:true});assert.equal(f.state.writes,1);
});
test('write authorization defaults to denied and a changed source blocks execution',async()=>{
 const f=fixture(),disabled=createProviderImportExecutor({repository:f.repository,resolveActor:async actor=>({ownerId,sessionBinding:actor.binding})});
 const review=await disabled.prepare(f.actor,f.args);await assert.rejects(disabled.execute(f.actor,{reviewId:review.reviewId,approved:true}),/not been approved/);assert.equal(f.state.writes,0);
 const pending=await f.executor.prepare(f.actor,f.args);f.state.sourceValid=false;await assert.rejects(f.executor.execute(f.actor,{reviewId:pending.reviewId,approved:true}),/paused or changed/);assert.equal(f.state.writes,0);
});
test('expiry or sign-out during asynchronous write authorization cannot start an insertion',async()=>{
 for(const expire of [false,true]){const f=fixture();let time=100,valid=true;const executor=createProviderImportExecutor({repository:f.repository,resolveActor:async()=>valid?{ownerId,sessionBinding:f.actor.binding}:null,now:()=>time,authorizeWrite:async()=>{if(expire)time+=300000;else valid=false;return true;}});const review=await executor.prepare(f.actor,f.args);await assert.rejects(executor.execute(f.actor,{reviewId:review.reviewId,approved:true}),/session|review/);assert.equal(f.state.writes,0);}
});
test('forgotten sessions discard pending reviews and expired cached reviews are actively cleared',async()=>{
 const f=fixture(),review=await f.executor.prepare(f.actor,f.args);f.executor.forgetSession(f.actor.binding);await assert.rejects(f.executor.execute(f.actor,{reviewId:review.reviewId,approved:true}),/expired or already used/);assert.equal(f.state.writes,0);
 const short=await f.executor.prepare(f.actor,{...f.args,previewExpiresAt:f.state.time+10});await new Promise(resolve=>setTimeout(resolve,30));await assert.rejects(f.executor.execute(f.actor,{reviewId:short.reviewId,approved:true}),/expired or already used/);assert.equal(f.state.writes,0);
});
