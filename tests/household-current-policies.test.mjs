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

test('rollback-only household policy check verifies current sessions and leaves fictional state intact',async t=>{
 const {householdPolicyCheck}=await import('../server/household-policy-check.mjs');
 const db=await setup(t),before=await visibleLabels(db);
 const identities={ownerA:i.a,ownerB:i.b,sessionA:i.sa,sessionB:i.sb};
 assert.throws(()=>householdPolicyCheck({...identities,sessionB:undefined}));
 assert.throws(()=>householdPolicyCheck({...identities,ownerB:i.a}));
 assert.throws(()=>householdPolicyCheck({...identities,ownerA:"';select 1;--"}));
 const check=householdPolicyCheck(identities);
 const output=await db.exec(check.sql);
 assert.deepEqual(output.at(-1).rows[0],{policy_checks:'passed',no_qa_households_saved:true,no_qa_memberships_saved:true,no_qa_records_saved:true});
 assert.deepEqual(await visibleLabels(db),before);
 await db.query('delete from auth.sessions where id=$1',[i.sb]);
 await assert.rejects(db.exec(check.sql),/Member session expired/);
 await db.exec('rollback');
 assert.deepEqual(await visibleLabels(db),before);
});

test('signed-in household directory uses the session identity and returns only active membership names and roles',async t=>{
 const {privateWorkspaceFixture}=await import('./support/private-workspace-fixture.mjs');
 const db=await setup(t);
 let readActor;
 const app=privateWorkspaceFixture(t,{fixtureHouseholdDirectory:async actorData=>{
  assert.match(actorData.ownerId,/^[a-f0-9-]{36}$/i);
  readActor=actorData.ownerId;
  await actor(db,readActor,i.sa);
  return (await db.query(`select h.name,m.role,m.user_id from public.cc_household_memberships m
   join public.cc_households h on h.id=m.household_id
   where m.user_id=$1 and m.status='active' order by h.name,h.id`,[readActor])).rows;
 }});
 const tab=app.tab();
 await assert.rejects(tab.client.householdDirectory());
 await tab.login();
 const listing=await tab.client.householdDirectory();
 assert.deepEqual(listing.households,[{name:'Fictional home',role:'owner'}]);
 assert.ok(listing.expiresAt>Date.now()&&listing.expiresAt<=Date.now()+60000);
 assert.equal((await (await tab.fetcher('/dev-config.json')).json()).privateHouseholdDirectory,true);
 await administrator(db);
 await db.query("update public.cc_household_memberships set status='removed' where user_id=$1",[readActor]);
 assert.deepEqual((await tab.client.householdDirectory()).households,[]);
 const disabled=privateWorkspaceFixture(t).tab();
 await disabled.login();
 await assert.rejects(disabled.client.householdDirectory());
});

test('Household Hub escapes names and releases private listing state on expiry and close',async t=>{
 const {createHouseholdDirectoryPanel}=await import('../src/private-household-directory-panel.mjs');
 let now=1,complete;
 const panel=createHouseholdDirectoryPanel({clock:()=>now,client:{
  householdDirectory:()=>new Promise(resolve=>{complete=resolve;}),
 }});
 t.after(()=>panel.reset());
 const click=action=>panel.click({target:{closest:()=>({dataset:{householdDirectory:action}})}});
 const turn=()=>new Promise(resolve=>setImmediate(resolve));
 click('open');
 complete({households:[{name:'Fictional <home>',role:'owner'}],expiresAt:60001});await turn();
 assert.match(panel.render(),/Fictional &lt;home&gt; · Owner/);
 now=60001;
 assert.doesNotMatch(panel.render(),/Fictional/);
 click('open');click('close');
 complete({households:[{name:'Fictional late home',role:'adult'}],expiresAt:120001});await turn();
 assert.doesNotMatch(panel.render(),/Fictional/);
});
