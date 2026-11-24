// Offline fictional PostgreSQL only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {actor, administrator, createIsolatedDevelopmentDatabase, identities} from './fixtures/isolated-development-database.mjs';
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
