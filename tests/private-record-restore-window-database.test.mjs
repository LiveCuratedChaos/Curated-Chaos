// Offline fictional PostgreSQL only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {actor, administrator, createIsolatedDevelopmentDatabase, identities} from './fixtures/isolated-development-database.mjs';
import {privateWorkspaceRestoreDigest} from '../server/private-workspace-restore-contract.mjs';
import {withinPrivateRecoveryWindow} from '../src/private-record-retention.mjs';

const draft = name => readFile(new URL('../supabase/drafts/'+name+'.sql', import.meta.url),'utf8');

test('the installed restore predicate agrees with the app across the exact anniversary and daylight saving',async t=>{
 const db=await createIsolatedDevelopmentDatabase();
 t.after(()=>db.close());
 await db.exec(await draft('private_record_restore_window'));
 await actor(db,identities.a,identities.sa);
 await db.exec("set time zone 'America/New_York'");
 const removed='2026-02-01T12:00:00.123456Z',start=Date.parse(removed);
 for(const elapsed of [-1,0,90*86400000-1,90*86400000,90*86400000+1]){
  const now=start+elapsed;
  const {rows}=await db.query('select cc_private.within_record_restore_window($1,$2) as eligible',[removed,new Date(now).toISOString()]);
  assert.equal(rows[0].eligible,withinPrivateRecoveryWindow(removed,now));
 }
});

test('ordinary updates enforce the original removal time for every protected private type and rollback preserves rows',async t=>{
 const db=await createIsolatedDevelopmentDatabase();
 t.after(()=>db.close());
 await db.exec(await draft('private_record_restore_window'));
 await actor(db,identities.a,identities.sa);
 const payload={fictional:true,title:'Fictional recovery timing'};
 async function insert(type,section){
  const id=randomUUID();
  await db.query("insert into public.cc_records (id,owner_id,visibility,section,item_type,payload,deleted_at) values ($1,$2,'private',$3,$4,$5,clock_timestamp()-interval '91 days')",[id,identities.a,section,type,JSON.stringify(payload)]);
  return id;
 }
 const ids=[];
 for(const [type,section] of [['task','Work'],['note','Personal Life'],['event','Calendar'],['project','Work'],['saved_search','Personal Life']]){
  const id=await insert(type,section);
  ids.push(id);
  const read=async()=>(await db.query('select to_jsonb(r) row from public.cc_records r where id=$1',[id])).rows[0].row;
  const before=await read();
  await assert.rejects(db.query('update public.cc_records set deleted_at=null where id=$1',[id]),/outside its 90-day/);
  await assert.rejects(db.query('update public.cc_records set deleted_at=clock_timestamp() where id=$1',[id]),/original removed/);
  await assert.rejects(db.query("update public.cc_records set item_type='other' where id=$1",[id]),/original removed/);
  assert.deepEqual(await read(),before);
 }
 const active=randomUUID();
 await db.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,payload) values($1,$2,'private','Work','task',$3)",[active,identities.a,JSON.stringify(payload)]);
 await db.query('update public.cc_records set deleted_at=clock_timestamp() where id=$1',[active]);
 await actor(db,identities.b,identities.sb);
 assert.equal((await db.query('update public.cc_records set deleted_at=null where id=$1 returning id',[active])).rows.length,0);
 await actor(db,identities.a,identities.sa);
 assert.equal((await db.query('update public.cc_records set deleted_at=null where id=$1 returning payload',[active])).rows[0].payload.title,payload.title);
 const count=async()=>(await db.query('select count(*)::int n from public.cc_records where id=any($1::uuid[]) and deleted_at is not null',[ids])).rows[0].n;
 assert.equal(await count(),5);
 await administrator(db);
 await db.exec(await draft('private_record_restore_window_rollback'));
 assert.equal(await count(),5);
 assert.equal((await db.query("select to_regprocedure('cc_private.guard_record_restore_window()') as guard")).rows[0].guard,null);
 await db.exec(await draft('private_record_restore_window'));
});

test('confirmed removal and its explicit Undo preserve exact payloads, source identity and both prior versions',async t=>{
 const {createPrivateRecordRecovery,privateRecoveryState}=await import('../server/private-record-recovery.mjs');
 const db=await createIsolatedDevelopmentDatabase();
 t.after(()=>db.close());
 await db.exec(await draft('private_record_restore_window'));
 await db.exec(await draft('private_record_versions'));
 const owner=identities.a,viewer={ownerId:owner,accessToken:'fictional'};
 await actor(db,owner,identities.sa);
 const row=async id=>(await db.query('select to_jsonb(r) value from public.cc_records r where id=$1',[id])).rows[0].value;
 const versions=async id=>(await db.query('select snapshot,source_version,operation,recovery from cc_private.record_versions where record_id=$1 order by source_version',[id])).rows;
 const sparse=record=>privateRecoveryState(record,owner,{allowProjects:true});
 let clock=Date.now();
 const api={
  listPrivateDeletedRecords:async()=>[],
  getPrivateRecordState:async(_token,id)=>[sparse(await row(id))],
  setPrivateRecordDeletedAt:async(_token,record,ownerId,deletedAt)=>(await db.query(
   'update public.cc_records r set deleted_at=$1 where id=$2 and owner_id=$3 and version=$4 and deleted_at is not distinct from $5 returning to_jsonb(r) value',
   [deletedAt,record.id,ownerId,record.version,record.deleted_at]
  )).rows.map(result=>sparse(result.value))
 };
 const recovery=createPrivateRecordRecovery({api,now:()=>clock,allowProjects:true});
 t.after(()=>recovery.dispose());
 async function approve(token,onRemoved){
  const review=await recovery.prepare('audit',viewer,token),claim=recovery.claim('audit',owner,review.reviewId);
  assert.equal(await recovery.authorize(claim,viewer),true);
  return recovery.save(claim,viewer,onRemoved);
 }
 async function insert(type,section,deletedAt=null){
  const id=randomUUID(),payload={fictional:true,title:'Same fictional title',extension:{original:id},...(type==='project'?{schemaVersion:1}:{})};
  await db.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload,deleted_at) values($1,$2,'private',$3,$4,$5,$6,$7)",
   [id,owner,section,type,type==='project'?'PRIVATE_COOKIE_PROJECT':'manual-test',JSON.stringify(payload),deletedAt]);
  return row(id);
 }
 const untouched=await insert('note','Personal Life');
 for(const [type,section] of [['note','Personal Life'],['task','Work'],['event','Calendar'],['project','Work']]){
  const original=await insert(type,section);
  const remove=recovery.begin('audit',owner,clock+300000)(sparse(original)).recordToken;
  let acknowledged;
  assert.deepEqual(await approve(remove,r=>{acknowledged=r;}),{saved:true,restored:false});
  const removed=await row(original.id);
  assert.equal(removed.version,original.version+1);
  assert.equal(Date.parse(removed.deleted_at),clock);
  const undo=recovery.add('audit',owner,clock+300000,acknowledged);
  assert.deepEqual(await approve(undo.recordToken),{saved:true,restored:true});
  const restored=await row(original.id);
  assert.equal(restored.deleted_at,null);
  assert.equal(restored.version,original.version+2);
  assert.deepEqual(restored.payload,original.payload);
  const history=await versions(original.id);
  assert.deepEqual(history.map(({snapshot,...entry})=>entry),[original,removed].map(r=>({source_version:r.version,operation:'UPDATE',recovery:null})));
  assert.deepEqual(history.map(entry=>privateWorkspaceRestoreDigest([entry.snapshot])),[original,removed].map(r=>privateWorkspaceRestoreDigest([r])));
 }
 assert.deepEqual(await row(untouched.id),untouched);
 assert.deepEqual(await versions(untouched.id),[]);
 // A stale application clock cannot override the database deadline or create a misleading audit entry.
 const expired=await insert('note','Personal Life',new Date(clock-91*86400000).toISOString());
 clock=Date.parse(expired.deleted_at)+86400000;
 const denied=recovery.add('audit',owner,clock+300000,sparse(expired));
 await assert.rejects(approve(denied.recordToken),/outside its 90-day/);
 assert.deepEqual(await row(expired.id),expired);
 assert.deepEqual(await versions(expired.id),[]);
});
