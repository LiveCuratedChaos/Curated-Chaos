// Fictional in-memory transactions only; no configuration, real archives or keys.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createPrivateWorkspaceRestoreExecutor} from '../server/private-workspace-restore-executor.mjs';
import {sealPrivateWorkspace} from '../server/private-workspace-backup.mjs';
import {privateWorkspaceRestoreDigest as digest} from '../server/private-workspace-restore-contract.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',key=Buffer.alloc(32,12),projectRef='fictionalrecovery';
const note=(patch={})=>({id:randomUUID(),owner_id:owner,household_id:null,visibility:'private',section:'Personal Life',item_type:'note',origin:'PRIVATE_COOKIE_NOTE_CREATE',version:7,created_at:'2026-11-01T12:00:00.000123Z',updated_at:'2026-11-02T12:00:00.000456Z',deleted_at:null,payload:{fictional:true,title:'Fictional archived note',body:'Exact\n<literal>',source:'M0C_DEV_LOGIN_TEST'},...patch});
function setup(t,{archive=[note()],existing=[],authorize=true,insert=rows=>rows,afterInsert,afterCommit,commitLost=false,allowManualFinanceRestore=false}={}){
 let rows=structuredClone(existing),clock=Date.parse('2026-11-17T12:00:00Z'),session={ownerId:owner,sessionBinding:'fictional-session-binding',expiresAt:clock+600000},inserts=0,transactions=0;
 const repository={projectRef,async readPrivateRows(){return structuredClone(rows);},async withLockedWorkspace(actor,id,callback){transactions++;let working=structuredClone(rows);const result=await callback({async readPrivateRows(){return structuredClone(working);},async insertMany(value){inserts++;working.push(...structuredClone(value));await afterInsert?.();return insert(structuredClone(value));}});rows=working;await afterCommit?.();if(commitLost)throw Error('Fictional lost commit acknowledgement');return result;}};
 const executor=createPrivateWorkspaceRestoreExecutor({repository,projectRef,key,allowManualFinanceRestore,resolveActor:async()=>session,authorizeWrite:async()=>authorize,now:()=>clock});t.after(()=>executor.dispose());
 const bytes=sealPrivateWorkspace({ownerId:owner,projectRef,key,rows:archive}).bytes;
 return{executor,repository,bytes,archive,get rows(){return rows;},get inserts(){return inserts;},get transactions(){return transactions;},set rows(value){rows=structuredClone(value);},set session(value){session=value;},get session(){return session;},advance(ms){clock+=ms;}};
}
test('reviewed insertion preserves exact microseconds and every newer/current-only record; replay never writes',async t=>{
 const archived=note(),unchanged=note(),newer={...unchanged,version:9,updated_at:'2026-11-16T09:00:00.123456Z'},currentOnly=note({payload:{fictional:true,title:'Current-only untouched',body:'Keep me',source:'M0C_DEV_LOGIN_TEST'}}),deleted=note({deleted_at:'2026-11-03T12:00:00Z'});
 const s=setup(t,{archive:[archived,unchanged,deleted],existing:[newer,currentOnly]});const review=await s.executor.prepare({},s);
 assert.equal(review.canRestore,true);assert.equal(review.insertCount,1);assert.equal(review.unchangedCount,1);assert.equal(review.archivedDeletedCount,1);assert.equal(review.currentOnlyCount,1);assert.match(review.reviewId,/^[A-Za-z0-9_-]{43}$/);assert.doesNotMatch(JSON.stringify(review),/Exact|literal|payload|Current-only|owner_id/);
 const saved=await s.executor.execute({},{reviewId:review.reviewId,approved:true});assert.equal(saved.restored,1);assert.equal(saved.skippedArchivedDeleted,1);assert.equal(saved.preservedTombstones,undefined);assert.equal(digest(s.rows),digest([newer,currentOnly,archived]));assert.equal(s.inserts,1);
 await assert.rejects(s.executor.execute({},{reviewId:review.reviewId,approved:true}),/expired or used/);assert.equal(s.inserts,1);
});
test('restore review detects same-millisecond changes to original creation and removal times',async t=>{
 const archived=note(),deleted=note({deleted_at:'2026-11-03T12:00:00.000121Z'}),missing=note();
 const s=setup(t,{archive:[archived,deleted,missing],existing:[
  {...archived,created_at:'2026-11-01T07:00:00.000124-05:00'},
  {...deleted,deleted_at:'2026-11-03T07:00:00.000122-05:00'}
 ]});
 const review=await s.executor.prepare({},s);
 assert.equal(review.blockedCount,1);
 assert.equal(review.conflictCount,1);
 assert.equal(review.canRestore,false);
 assert.equal(review.reviewId,undefined);
 assert.equal(s.inserts,0);
 s.rows=[{...archived,created_at:'2026-11-01T07:00:00.000123-05:00'},
  {...deleted,deleted_at:'2026-11-03T07:00:00.000121-05:00'}];
 const equivalent=await s.executor.prepare({},s);
 assert.equal(equivalent.unchangedCount,2);
 assert.equal((await s.executor.execute({},{reviewId:equivalent.reviewId,approved:true})).restored,1);
});
test('approval binds exact inventory including microseconds and unrelated records',async t=>{
 const existing=note(),s=setup(t,{existing:[existing]});const r=await s.executor.prepare({},s);s.rows=[{...existing,updated_at:'2026-11-02T12:00:00.000457Z'}];
 await assert.rejects(s.executor.execute({},{reviewId:r.reviewId,approved:true}),/stopped before insertion/);assert.equal(s.inserts,0);
});
test('wrong owner, changed binding, missing approval, expiry and default-denied writes never insert',async t=>{
 for(const kind of ['owner','binding','approval','expiry','denied']){const s=setup(t,{authorize:kind!=='denied'}),r=await s.executor.prepare({},s);
  if(kind==='owner')s.session={...s.session,ownerId:foreign};if(kind==='binding')s.session={...s.session,sessionBinding:'other-fictional-session'};if(kind==='expiry')s.advance(300001);
  await assert.rejects(s.executor.execute({},{reviewId:r.reviewId,approved:kind!=='approval'}));assert.equal(s.inserts,0);
 }
});
test('conflicting payloads, deletion changes and unknown or dependency-bearing record types cannot obtain approval',async t=>{
 const original=note();for(const options of [{archive:[original],existing:[{...original,payload:{...original.payload,body:'Later text'}}]},{archive:[original],existing:[{...original,deleted_at:'2026-11-03T12:00:00Z'}]},{archive:[note({item_type:'future_type'})]},{archive:[note({item_type:'task',origin:'PRIVATE_COOKIE_TASK_CREATE',section:'Home',payload:{fictional:true,title:'Recurring history',done:false,source:'M0D_DEV_BRIEF_TEST',recurrence:{frequency:'daily'}}})]},{archive:[note({item_type:'task',origin:'PRIVATE_COOKIE_TASK_CREATE',section:'Home',payload:{fictional:true,title:'Approval-linked',done:false,source:'M1A_APPROVED_fictional'}})]}]){
  const s=setup(t,options),r=await s.executor.prepare({},s);assert.equal(r.canRestore,false);assert.equal(r.reviewId,undefined);assert.equal(s.inserts,0);
 }
});
test('missing active task/project relationships stay blocked rather than touching existing target revisions',async t=>{
 const project=note({item_type:'project',section:'Work',origin:'PRIVATE_COOKIE_PROJECT',payload:{fictional:true,schemaVersion:1,title:'Fictional project',description:'',status:'Active'}}),task=note({item_type:'task',origin:'PRIVATE_COOKIE_TASK_CREATE',section:'Home',payload:{fictional:true,title:'Task',done:false,source:'M0D_DEV_BRIEF_TEST'}});
 const link=note({item_type:'project_task_link',origin:'PRIVATE_COOKIE_PROJECT_TASK_LINK',payload:{fictional:true,schemaVersion:1,taskId:task.id,projectId:project.id}});
 const s=setup(t,{archive:[project,task,link],existing:[project,task]}),r=await s.executor.prepare({},s);assert.equal(r.canRestore,false);assert.equal(r.unsupportedRelationshipCount,1);assert.equal(r.reviewId,undefined);assert.deepEqual(s.rows,[project,task]);
});
test('bad acknowledgement and permission loss after insertion roll back before committing',async t=>{
 for(const kind of ['ack','revoked']){let s;s=setup(t,{insert:rows=>kind==='ack'?rows.map(r=>({...r,version:r.version+1})):rows,afterInsert:()=>{if(kind==='revoked')s.executor.forgetSession(s.session.sessionBinding);}});const r=await s.executor.prepare({},s);await assert.rejects(s.executor.execute({},{reviewId:r.reviewId,approved:true}),/could not be confirmed/);assert.deepEqual(s.rows,[]);assert.equal(s.inserts,1);}
});
test('lost commit acknowledgement consumes approval and requires inspection without automatic retry',async t=>{
 const s=setup(t,{commitLost:true}),r=await s.executor.prepare({},s);await assert.rejects(s.executor.execute({},{reviewId:r.reviewId,approved:true}),/Inspect current copies/);assert.equal(s.rows.length,1);await assert.rejects(s.executor.execute({},{reviewId:r.reviewId,approved:true}));assert.equal(s.inserts,1);const fresh=await s.executor.prepare({},s);assert.equal(fresh.insertCount,0);assert.equal(fresh.unchangedCount,1);
});
test('session revocation and disposal invalidate pending preparation and wipe owned buffers without altering caller key',async t=>{
 const s=setup(t),r=await s.executor.prepare({},s);s.executor.forgetSession(s.session.sessionBinding);await assert.rejects(s.executor.execute({},{reviewId:r.reviewId,approved:true}));s.executor.dispose();await assert.rejects(s.executor.prepare({},s));assert.deepEqual(key,Buffer.alloc(32,12));assert.equal(s.inserts,0);
});
test('inventory digest preserves six fractional digits and equates only the same instant across offsets',()=>{
 const a=note(),b={...a,updated_at:'2026-11-02T07:00:00.000456-05:00'};assert.equal(digest([a]),digest([b]));assert.notEqual(digest([a]),digest([{...a,updated_at:'2026-11-02T12:00:00.000457Z'}]));assert.throws(()=>digest([{...a,deleted_at:undefined}]));
});

test('simultaneous approval clicks claim one review and never insert twice',async t=>{
 const s=setup(t),r=await s.executor.prepare({},s),results=await Promise.allSettled([s.executor.execute({},{reviewId:r.reviewId,approved:true}),s.executor.execute({},{reviewId:r.reviewId,approved:true})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(s.inserts,1);assert.equal(s.rows.length,1);
});
test('revocation during actor resolution cannot issue a later usable preparation',async t=>{
 const s=setup(t);let release;const gate=new Promise(resolve=>{release=resolve;}),binding='fictional-resolution-binding';
 const executor=createPrivateWorkspaceRestoreExecutor({repository:s.repository,projectRef,key,resolveActor:async()=>{await gate;return{ownerId:owner,sessionBinding:binding,expiresAt:Date.now()+600000};}});t.after(()=>executor.dispose());
 const pending=executor.prepare({},s);executor.forgetSession(binding);release();await assert.rejects(pending,/Active recovery owner/);assert.equal(s.inserts,0);
});
test('a changing inventory, incomplete metadata or wrong repository target never produces a restore review',async t=>{
 const s=setup(t),ordinary=s.repository.readPrivateRows;let calls=0;s.repository.readPrivateRows=async(...args)=>++calls===1?ordinary(...args):[note()];await assert.rejects(s.executor.prepare({},s),/changed during review/);
 const incomplete=note();delete incomplete.deleted_at;const q=setup(t,{archive:[incomplete]});await assert.rejects(q.executor.prepare({},q),/Complete archived metadata/);
 assert.throws(()=>createPrivateWorkspaceRestoreExecutor({repository:{...s.repository,projectRef:'otherfictional'},projectRef,key,resolveActor:async()=>s.session}),/context required/);
});
test('revocation during commit reports uncertainty and never claims that a saved insertion rolled back',async t=>{
 let s;s=setup(t,{afterCommit:()=>s.executor.forgetSession(s.session.sessionBinding)});const r=await s.executor.prepare({},s);
 await assert.rejects(s.executor.execute({},{reviewId:r.reviewId,approved:true}),/could not be confirmed.*Inspect current copies/);assert.equal(s.rows.length,1);assert.equal(s.inserts,1);await assert.rejects(s.executor.execute({},{reviewId:r.reviewId,approved:true}));assert.equal(s.inserts,1);
});

test('manual finance restores the exact sealed revision only with owner approval and a valid row binding',async t=>{
 const {createTokenSealer}=await import('../server/token-sealer.mjs');
 const row=note({section:'Finances',item_type:'manual_finance_account',origin:'PRIVATE_MANUAL_FINANCE'});
 const plain={ownerId:owner,fictional:true,version:1,account:{type:'checking',label:'Private account',balanceMinor:2847,showInAccountList:false,includeInBudget:true}};
 row.payload={scheme:'manual-finance-v1',encrypted:createTokenSealer(key).seal(plain,['manual-finance-v1',owner,row.id,row.version].join(':'))};
 for(const [candidate,enabled,expected] of [[row,false,false],[{...row,version:42},true,false],[row,true,true]]){
  const s=setup(t,{archive:[candidate],allowManualFinanceRestore:enabled});
  const review=await s.executor.prepare({},s);
  assert.equal(review.canRestore,expected);assert.doesNotMatch(JSON.stringify(review),/Private account|2847|encrypted/);
  if(expected){await s.executor.execute({},{reviewId:review.reviewId,approved:true});assert.deepEqual(s.rows,[row]);}
  else assert.equal(s.inserts,0);
 }
});
