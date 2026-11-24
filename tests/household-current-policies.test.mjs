import test from 'node:test';import assert from 'node:assert/strict';
import {createIsolatedDevelopmentDatabase,identities as i,actor,administrator,visibleLabels} from './fixtures/isolated-development-database.mjs';
async function setup(t){const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());return db;}
test('all current migrations preserve household section rights without granting adult private or finance access',async t=>{
 const db=await setup(t);await actor(db,i.b,i.sb);assert.deepEqual(await visibleLabels(db),['private-b','shared-by-b','shared-home','shared-school']);assert.equal((await db.query("update public.cc_records set payload=payload||'{\"edited\":true}' where payload->>'label'='shared-home' returning id")).rows.length,0);assert.equal((await db.query("update public.cc_records set payload=payload||'{\"edited\":true}' where payload->>'label'='shared-school' returning version")).rows[0].version,8);await assert.rejects(db.query("update public.cc_records set section='Finances' where payload->>'label'='shared-school'"),/row-level security/);await assert.rejects(db.query("update public.cc_household_memberships set role='owner',write_sections=array['Finances'] where user_id=$1",[i.b]),/permission denied/);await actor(db,i.a,i.sa);assert.ok(!(await visibleLabels(db)).includes('private-b'));await actor(db,i.c,i.sc);assert.deepEqual(await visibleLabels(db),['other-home']);
});
test('membership departure removes access to own shared records while preserving independent private records',async t=>{
 const db=await setup(t);await db.query("update public.cc_household_memberships set status='removed' where household_id=$1 and user_id=$2",[i.home,i.b]);await actor(db,i.b,i.sb);assert.deepEqual(await visibleLabels(db),['private-b']);assert.equal((await db.query("select id from public.cc_households where id=$1",[i.home])).rows.length,0);assert.equal((await db.query("update public.cc_records set payload=payload where household_id=$1 returning id",[i.home])).rows.length,0);await administrator(db);await db.query("update public.cc_household_memberships set status='active',read_sections='{}',write_sections='{}' where household_id=$1 and user_id=$2",[i.home,i.b]);await actor(db,i.b,i.sb);assert.deepEqual(await visibleLabels(db),['private-b']);await actor(db,i.a,i.sa);assert.ok((await visibleLabels(db)).includes('shared-by-b'));
});
test('revoked, missing and wrong-owner sessions cannot use valid household grants or read membership metadata',async t=>{
 const db=await setup(t);await db.query('delete from auth.sessions where id=$1',[i.sb]);for(const session of [i.sb,i.sa,undefined]){await actor(db,i.b,session);for(const table of ['cc_profiles','cc_households','cc_household_memberships','cc_records'])assert.equal((await db.query('select * from public.'+table)).rows.length,0,table);await assert.rejects(db.query("insert into public.cc_records(owner_id,household_id,visibility,section,item_type,payload) values($1,$2,'household','School','note','{}')",[i.b,i.home]),/row-level security/);}await actor(db,i.a,i.sa);assert.ok((await visibleLabels(db)).includes('shared-home'));
});

test('an existing session immediately loses old section permissions after a household grant changes',async t=>{
 const db=await setup(t);
 const edit=async label=>(await db.query(
  "update public.cc_records set payload=payload||'{\"edited\":true}' where payload->>'label'=$1 returning version",[label])).rows;
 await actor(db,i.b,i.sb);
 assert.equal((await edit('shared-school')).length,1);
 await administrator(db);
 await db.query("update public.cc_household_memberships set read_sections=array['Home'],write_sections='{}' where household_id=$1 and user_id=$2",[i.home,i.b]);
 await actor(db,i.b,i.sb);
 assert.deepEqual(await visibleLabels(db),['private-b','shared-by-b','shared-home']);
 assert.deepEqual(await edit('shared-school'),[]);
 assert.deepEqual(await edit('shared-home'),[]);
 assert.deepEqual(await edit('shared-by-b'),[]);
 assert.equal((await edit('private-b')).length,1);
 await actor(db,i.a,i.sa);
 assert.ok((await visibleLabels(db)).includes('shared-school'));
});
