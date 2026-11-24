// Full isolated-engine snapshot acceptance, not a hosted Supabase/pg_dump recovery claim.
import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
import {createIsolatedDevelopmentDatabase,identities as i,actor,administrator,visibleLabels} from './fixtures/isolated-development-database.mjs';
test('an offline full database snapshot restores data, RLS, grants, triggers, functions and unique protections',async t=>{
 const source=await createIsolatedDevelopmentDatabase();let restored,closed=false;t.after(async()=>{if(!closed)await source.close();await restored?.close();});
 await source.query("insert into public.cc_records(owner_id,visibility,section,item_type,payload) values($1,'private','Personal Life','brief_preferences','{\"fictional\":true}')",[i.a]);const before=(await source.query('select * from public.cc_records order by id')).rows;
 const policies=(await source.query("select tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname")).rows;
 const snapshot=await source.dumpDataDir('none');assert.ok(snapshot.size>0);await source.close();closed=true;
 // Start a different engine solely from the snapshot: no migrations or reseeding here.
 restored=await PGlite.create({loadDataDir:snapshot});assert.deepEqual((await restored.query('select * from public.cc_records order by id')).rows,before);assert.deepEqual((await restored.query("select tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname")).rows,policies);
 await actor(restored,i.b,i.sb);assert.deepEqual(await visibleLabels(restored),['private-b','shared-by-b','shared-home','shared-school']);await assert.rejects(restored.query("update public.cc_household_memberships set write_sections=array['Finances']"),/permission denied/);const updated=await restored.query("update public.cc_records set payload=payload||'{\"restored_edit\":true}' where payload->>'label'='shared-school' returning version");assert.equal(updated.rows[0].version,8);await assert.rejects(restored.query("update public.cc_records set section='Finances' where payload->>'label'='shared-school'"),/row-level security/);
 await actor(restored,i.a,i.sa);await assert.rejects(restored.query("insert into public.cc_records(owner_id,visibility,section,item_type,payload) values($1,'private','Personal Life','brief_preferences','{}')",[i.a]),/unique constraint/);await assert.rejects(restored.query("update public.cc_records set owner_id=$1 where payload->>'label'='private-a'",[i.b]),/identity and sharing scope/);assert.equal((await restored.query('select public.cc_development_session_active() as active')).rows[0].active,true);
 // A full auth snapshot also restores old session rows. Quarantine recovery:
 // invalidate all restored sessions before any reopened user access.
 await administrator(restored);await restored.exec('delete from auth.sessions');
 for(const [owner,session]of [[i.a,i.sa],[i.b,i.sb],[i.c,i.sc]]){await actor(restored,owner,session);assert.deepEqual(await visibleLabels(restored),[]);assert.equal((await restored.query('select public.cc_development_session_active() as active')).rows[0].active,false);}
 await administrator(restored);const fresh='66666666-6666-4666-8666-666666666666';await restored.query('insert into auth.sessions values($1,$2)',[fresh,i.a]);await actor(restored,i.a,fresh);assert.ok((await visibleLabels(restored)).includes('private-a'));await actor(restored,i.a,i.sa);assert.deepEqual(await visibleLabels(restored),[]);
 await administrator(restored);await restored.exec('set role anon');await assert.rejects(restored.query('select * from public.cc_records'),/permission denied/);
});
