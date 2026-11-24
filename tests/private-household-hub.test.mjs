import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createIsolatedDevelopmentDatabase,identities as i,actor,administrator,visibleLabels} from './fixtures/isolated-development-database.mjs';

const draft=name=>readFile(new URL('../supabase/drafts/'+name+'.sql',import.meta.url),'utf8');
async function setup(t){
 const db=await createIsolatedDevelopmentDatabase();
 t.after(()=>db.close());
 await db.exec(await draft('private_household_hub'));
 return db;
}

test('the active household picker and selected totals expose only current grants and ownership counts',async t=>{
 const db=await setup(t);
 const choices=async()=>(await db.query('select * from public.cc_household_hub_choices()')).rows;
 const totals=async home=>(await db.query('select * from public.cc_household_hub_totals($1)',[home])).rows;
 await actor(db,i.b,i.sb);
 assert.deepEqual(await choices(),[{household_id:i.home,name:'Fictional home',is_owner:false}]);
 assert.deepEqual(await totals(i.home),[
  {section:'Home',item_type:'note',total:2,owned:1},{section:'School',item_type:'note',total:1,owned:0}
 ]);
 assert.deepEqual(await totals(i.other),[]);
 await administrator(db);
 await db.query("update public.cc_records set deleted_at=now() where payload->>'label'='shared-home'");
 await db.query("update public.cc_household_memberships set write_sections='{}' where user_id=$1",[i.b]);
 await actor(db,i.b,i.sb);
 assert.deepEqual(await totals(i.home),[{section:'Home',item_type:'note',total:1,owned:1}]);
 await administrator(db);
 await db.query("update public.cc_household_memberships set status='removed' where user_id=$1",[i.b]);
 await actor(db,i.b,i.sb);
 assert.deepEqual(await choices(),[]);
 assert.deepEqual(await totals(i.home),[]);
 assert.deepEqual(await visibleLabels(db),['private-b']);
 await actor(db,i.a,i.sa);
 assert.deepEqual(await choices(),[{household_id:i.home,name:'Fictional home',is_owner:true}]);
});

test('anonymous access is denied, revoked sessions get no totals, and rollback preserves records',async t=>{
 const db=await setup(t);
 const before=await visibleLabels(db);
 await db.exec('set role anon');
 await assert.rejects(db.query('select * from public.cc_household_hub_choices()'),/permission denied/);
 await assert.rejects(db.query('select * from public.cc_household_hub_totals($1)',[i.home]),/permission denied/);
 await administrator(db);
 await db.query('delete from auth.sessions where id=$1',[i.sb]);
 await actor(db,i.b,i.sb);
 assert.deepEqual((await db.query('select * from public.cc_household_hub_choices()')).rows,[]);
 assert.deepEqual((await db.query('select * from public.cc_household_hub_totals($1)',[i.home])).rows,[]);
 await administrator(db);
 await db.exec(await draft('private_household_hub_rollback'));
 assert.deepEqual(await visibleLabels(db),before);
 await assert.rejects(db.query('select * from public.cc_household_hub_choices()'),/does not exist/);
});
