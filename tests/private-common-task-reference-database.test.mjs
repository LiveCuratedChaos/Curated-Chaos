// Actual embedded PostgreSQL; no credentials, network, listeners or hosted installation.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {commonTaskMembershipKey} from '../server/private-common-task-memberships.mjs';
import {createIsolatedDevelopmentDatabase,actor,administrator,identities as i} from './fixtures/isolated-development-database.mjs';
const sql=await readFile(new URL('../supabase/drafts/private_common_task_reference_contract.sql',import.meta.url),'utf8'),rollback=await readFile(new URL('../supabase/drafts/private_common_task_reference_contract_rollback.sql',import.meta.url),'utf8');
const id=n=>'abcdabcd-abcd-4bcd-8bcd-'+String(n).padStart(12,'0');
const tasks=[{kind:'task',recordId:id(1)},{kind:'school-step',recordId:id(2),assessmentId:id(3),academicId:id(4)}],projects=[{kind:'project',recordId:id(5)},{kind:'school-degree',recordId:id(6)},{kind:'school-course',recordId:id(7)},{kind:'school-assessment',recordId:id(8),academicId:id(9)}];
async function setup(t){const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());await db.exec(sql);await actor(db,i.a,i.sa);const key=async(t,p)=>(await db.query('select cc_private.common_task_membership_key($1::jsonb,$2::jsonb) k',[JSON.stringify(t),JSON.stringify(p)])).rows[0].k;return{db,key};}
test('PostgreSQL and JavaScript membership keys agree across supported target kinds, case and field order',async t=>{
 const s=await setup(t);for(const task of tasks)for(const project of projects){if(task.kind==='task'&&project.kind==='project'){assert.equal(await s.key(task,project),null);assert.throws(()=>commonTaskMembershipKey(task,project));continue;}
 const expected=commonTaskMembershipKey(task,project);assert.equal(await s.key(task,project),expected);const reorder=v=>Object.fromEntries(Object.entries(v).reverse().map(([k,value])=>[k,k==='kind'?value:value.toUpperCase()]));assert.equal(await s.key(reorder(task),reorder(project)),expected);}
});
test('malformed, future and cross-kind reference shapes fail closed in both contracts',async t=>{
 const s=await setup(t),task=tasks[1],project=projects[1];
 for(const invalid of [null,[],false,{},'reference',{...task,kind:'future-task'},{...task,recordId:null},{...task,recordId:'bad'},{...task,extra:true},{...task,assessmentId:undefined},{...task,academicId:undefined},{...task,academicId:id(4).replace('-4bcd-','-0bcd-')},{...task,academicId:id(4).replace('-8bcd-','-0bcd-')},project]){assert.equal(await s.key(invalid,project),null);assert.throws(()=>commonTaskMembershipKey(invalid,project));}
 for(const invalid of [null,[],{},tasks[0],{...project,academicId:id(1)},{...projects[3],academicId:undefined},{...project,kind:'future-project'}]){assert.equal(await s.key(task,invalid),null);assert.throws(()=>commonTaskMembershipKey(task,invalid));}
});
test('reference contract installs no writer, trigger, table, index or record and exposes only invoker pure functions',async t=>{
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());const inventory=async()=>(await db.query("select (select count(*) from public.cc_records)::int records,(select count(*) from pg_catalog.pg_trigger where not tgisinternal)::int triggers,(select count(*) from pg_catalog.pg_class where relkind in ('r','i'))::int storage")).rows[0],before=await inventory();await db.exec(sql);assert.deepEqual(await inventory(),before);
 const rows=(await db.query("select proname,prosecdef,provolatile,proconfig,has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated from pg_catalog.pg_proc where pronamespace='cc_private'::regnamespace and proname like 'common_task_%' order by proname")).rows;assert.equal(rows.length,2);for(const r of rows){assert.equal(r.prosecdef,false);assert.equal(r.provolatile,'i');assert.ok(r.proconfig.includes('search_path=""'));assert.equal(r.anon,false);assert.equal(r.authenticated,true);}
 await db.exec(rollback);assert.deepEqual(await inventory(),before);assert.equal((await db.query("select count(*)::int n from pg_catalog.pg_proc where pronamespace='cc_private'::regnamespace and proname like 'common_task_%'")).rows[0].n,0);
});
test('reference-contract inverse refuses retained membership reservations without deleting source data',async t=>{
 const s=await setup(t);await administrator(s.db);await s.db.query("insert into public.cc_records(owner_id,section,item_type,origin,payload,deleted_at) values($1,'Personal Life','common_task_link','PRIVATE_COOKIE_COMMON_TASK_LINK',$2,statement_timestamp())",[i.a,JSON.stringify({fictional:true,schemaVersion:1,task:tasks[1],project:projects[0]})]);await assert.rejects(s.db.exec(rollback));await s.db.exec('rollback');assert.equal((await s.db.query("select count(*)::int n from public.cc_records where item_type='common_task_link'")).rows[0].n,1);assert.equal(await s.key(tasks[1],projects[0]),commonTaskMembershipKey(tasks[1],projects[0]));
});

test('reference-contract inverse cannot cascade through a later dependent uniqueness index',async t=>{
 const s=await setup(t);await administrator(s.db);await s.db.exec("create unique index fictional_common_pair_dependency on public.cc_records(owner_id,cc_private.common_task_membership_key(payload->'task',payload->'project')) where item_type='common_task_link'");await assert.rejects(s.db.exec(rollback));await s.db.exec('rollback');assert.equal((await s.db.query("select count(*)::int n from pg_catalog.pg_class where relname='fictional_common_pair_dependency'")).rows[0].n,1);assert.equal(await s.key(tasks[1],projects[0]),commonTaskMembershipKey(tasks[1],projects[0]));
});
