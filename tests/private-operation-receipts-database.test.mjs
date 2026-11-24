import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createIsolatedDevelopmentDatabase,actor,administrator,identities as i} from './fixtures/isolated-development-database.mjs';

const historySql=await readFile(new URL('../supabase/drafts/private_record_versions.sql',import.meta.url),'utf8');
const hierarchySql=await readFile(new URL('../supabase/drafts/private_project_hierarchy.sql',import.meta.url),'utf8');
const parentSql=await readFile(new URL('../supabase/drafts/private_project_single_master.sql',import.meta.url),'utf8');
const receiptsSql=await readFile(new URL('../supabase/drafts/private_operation_receipts.sql',import.meta.url),'utf8');
const idA='66666666-6666-4666-8666-666666666666',idB='77777777-7777-4777-8777-777777777777',idC='88888888-8888-4888-8888-888888888888',idD='99999999-9999-4999-8999-999999999999';
const opA='aaaaaaaa-0000-4000-8000-000000000001',opB='aaaaaaaa-0000-4000-8000-000000000002';
async function setup(t){
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());
 await db.exec(historySql);await db.exec(hierarchySql);await db.exec(parentSql);
 await administrator(db);await db.exec('create role service_role bypassrls');await db.exec(receiptsSql);
 return db;
}
async function seed(db){
 await administrator(db);
 await db.query("insert into public.cc_records(id,owner_id,household_id,visibility,section,item_type,origin,payload) values($1,$2,null,'private','Work','task','PRIVATE_COOKIE_TASK_CREATE',$3),($4,$2,null,'private','Work','project','PRIVATE_COOKIE_PROJECT',$5),($6,$2,null,'private','Work','project','PRIVATE_COOKIE_PROJECT',$7),($8,$2,null,'private','Work','project','PRIVATE_COOKIE_PROJECT',$9)",[idA,i.a,JSON.stringify({fictional:true,schemaVersion:1,title:'Old task',done:false,subtasks:[{id:'step-id',title:'Keep exact',done:false}],recurrence:{frequency:'weekly',interval:1},extension:{x:1}}),idB,JSON.stringify({fictional:true,schemaVersion:1,title:'Master',description:'',status:'Active',separateRecurring:true}),idC,JSON.stringify({fictional:true,schemaVersion:1,title:'Child',description:'',status:'Planned',separateRecurring:false}),idD,JSON.stringify({fictional:true,schemaVersion:1,title:'Second master',description:'',status:'Planned'})]);
 await actor(db,i.a,i.sa);
 await db.query('select public.cc_set_task_project_link($1,1,$2,1,0,true) r',[idA,idB]);
 await db.query('select public.cc_set_task_project_link($1,2,$2,1,0,true) r',[idA,idC]);
 await db.query('select public.cc_set_project_hierarchy_link($1,1,$2,1,0,true) r',[idB,idC]);
 return await db.query('select to_jsonb(r) r from public.cc_records r where id=any($1::uuid[]) order by id',[[idA,idB,idC,idD]]);
}
async function commit(db,input){
 await db.exec('set role service_role');
 try{return(await db.query('select public.cc_commit_private_operation($1) result',[JSON.stringify(input)])).rows[0].result;}
 finally{await administrator(db);}
}
async function relationships(db,type,record){
 await administrator(db);
 return(await db.query('select cc_private.operation_relationship_snapshot($1,$2,$3) v',[i.a,type,record])).rows[0].v;
}
function input(record,operationId,kind,payload,expectedRelationships){return{ownerId:i.a,sessionId:i.sa,operationId,kind,recordId:record.id,expectedVersion:record.version,section:record.section,payload,expectedRelationships};}

test('service-only atomic task edit captures exact prior history, receipt, replay and memberships',async t=>{
 const db=await setup(t);await seed(db);let task=(await db.query('select to_jsonb(r) r from public.cc_records r where id=$1',[idA])).rows[0].r;
 const relations=await relationships(db,'task',idA);
 const historyBefore=(await db.query('select count(*)::int n from cc_private.record_versions where record_id=$1',[idA])).rows[0].n;
 const next={...task.payload,title:'New task'};
 assert.equal((await db.query("select has_function_privilege('authenticated','public.cc_commit_private_operation(jsonb)','EXECUTE') v")).rows[0].v,false);
 const command=input(task,opA,'task.edit',next,relations),first=await commit(db,command);
 assert.equal(first.resultVersion,task.version+1);assert.equal(first.replayed,false);
 const row=(await db.query('select to_jsonb(r) r from public.cc_records r where id=$1',[idA])).rows[0].r;
 assert.equal(row.payload.title,'New task');assert.equal(row.payload.recurrence.frequency,'weekly');assert.deepEqual(row.payload.subtasks,task.payload.subtasks);
 const prior=(await db.query('select snapshot from cc_private.record_versions where id=$1',[first.historyId])).rows[0].snapshot;
 assert.deepEqual(prior.payload,task.payload);
 assert.equal((await db.query("select count(*)::int n from public.cc_records where item_type='project_task_link' and payload->>'taskId'=$1 and deleted_at is null",[idA])).rows[0].n,2);
 assert.equal((await commit(db,command)).replayed,true);
 await assert.rejects(commit(db,{...command,payload:{...next,title:'Different replay'}}),/conflicts|differs/);
 assert.equal((await db.query('select count(*)::int n from cc_private.operation_receipts')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from cc_private.record_versions where record_id=$1',[idA])).rows[0].n,historyBefore+1);
 await assert.rejects(db.query('update cc_private.operation_receipts set operation=\'project.edit\' where operation_id=$1',[opA]));
 await assert.rejects(db.query('delete from cc_private.operation_receipts where operation_id=$1',[opA]));
});

test('project edit preserves its single master relationship, progress mode and extension fields atomically',async t=>{
 const db=await setup(t);await seed(db);const project=(await db.query('select to_jsonb(r) r from public.cc_records r where id=$1',[idC])).rows[0].r;
 const relations=await relationships(db,'project',idC);
 assert.equal(relations.length,2);const next={...project.payload,title:'Renamed child'};
 const result=await commit(db,input(project,opA,'project.edit',next,relations));assert.equal(result.resultVersion,project.version+1);
 const saved=(await db.query('select payload from public.cc_records where id=$1',[idC])).rows[0].payload;assert.equal(saved.title,'Renamed child');assert.equal(saved.separateRecurring,false);
 assert.equal((await db.query("select count(*)::int n from public.cc_records where item_type='project_project_link' and payload->>'childProjectId'=$1 and deleted_at is null",[idC])).rows[0].n,1);
 const fresh=(await db.query('select to_jsonb(r) r from public.cc_records r where id=$1',[idC])).rows[0].r;
 const drift={...fresh,payload:{...fresh.payload,separateRecurring:true}};
 const driftInput=input(fresh,opB,'project.edit',drift.payload,relations);
 await assert.rejects(commit(db,driftInput),/progress|extension changed/);
 assert.equal((await db.query('select count(*)::int n from cc_private.operation_receipts')).rows[0].n,1);
});

test('stale, foreign, relationship-drift, lifecycle and cross-provenance commands roll back without receipts',async t=>{
 const db=await setup(t);await seed(db);const task=(await db.query('select to_jsonb(r) r from public.cc_records r where id=$1',[idA])).rows[0].r;
 const relations=await relationships(db,'task',idA);
 const next={...task.payload,title:'Updated'};
 await assert.rejects(commit(db,input({...task,version:task.version-1},opA,'task.edit',next,relations)),/changed/);
 await assert.rejects(commit(db,{...input(task,opA,'task.edit',next,relations),ownerId:i.b,sessionId:i.sb}),/source|session|owner/i);
 await assert.rejects(commit(db,input(task,opA,'task.edit',{...next,done:true},relations)),/lifecycle/);
 await assert.rejects(commit(db,input(task,opA,'task.edit',{...next,recurrence:{frequency:'daily'}},relations)),/recurrence/);
 await assert.rejects(commit(db,input(task,opA,'task.edit',next,[])),/relationships changed/);
 assert.equal((await db.query('select payload from public.cc_records where id=$1',[idA])).rows[0].payload.title,'Old task');
 assert.equal((await db.query('select count(*)::int n from cc_private.operation_receipts')).rows[0].n,0);
});
