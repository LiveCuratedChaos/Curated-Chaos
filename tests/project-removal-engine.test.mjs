// Fictional embedded PostgreSQL only; no provider, real account or listener access.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createIsolatedDevelopmentDatabase,actor,administrator,identities as i} from './fixtures/isolated-development-database.mjs';

const read=async(db,id)=>(await db.query('select * from public.cc_records where id=$1',[id])).rows[0];
async function setup(t){
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());
 const project=randomUUID(),task=randomUUID(),payload={fictional:true,schemaVersion:1,title:'Fictional removable project',description:'  Preserve exact details\n<literal> 中文  ',status:'On hold',separateRecurring:false};
 await db.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values($1,$2,'private','Work','project','PRIVATE_COOKIE_PROJECT',$3)",[project,i.a,JSON.stringify(payload)]);
 await db.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,payload) values($1,$2,'private','Home','task',$3)",[task,i.a,JSON.stringify({fictional:true,title:'Fictional preserved task',done:false,description:'Task body stays unchanged',subtasks:[{title:'Preserved step',done:true}]})]);
 await actor(db,i.a,i.sa);
 async function link(linked,linkVersion=0){return(await db.query('select public.cc_set_task_project_link($1,$2,$3,$4,$5,$6) as result',[task,(await read(db,task)).version,project,(await read(db,project)).version,linkVersion,linked])).rows[0].result;}
 async function remove(version){if(version===undefined)version=(await read(db,project)).version;return(await db.query("update public.cc_records set deleted_at=statement_timestamp() where id=$1 and version=$2 and deleted_at is null returning *",[project,version])).rows;}
 async function restore(version){if(version===undefined)version=(await read(db,project)).version;return(await db.query("update public.cc_records set deleted_at=null where id=$1 and version=$2 and deleted_at is not null returning *",[project,version])).rows;}
 return{db,project,task,payload,link,remove,restore};
}

test('unlinked project removal/restoration preserves exact contents, tasks and retired links',async t=>{
 const s=await setup(t),linked=await s.link(true);await s.link(false,linked.linkRecord.version);
 const before=await read(s.db,s.project),unchanged=(await s.db.query("select * from public.cc_records where item_type<>'project' order by id")).rows;
 const retired=await read(s.db,linked.linkRecord.id);assert.notEqual(retired.deleted_at,null);
 const removed=await s.remove();assert.equal(removed.length,1);assert.equal(removed[0].version,before.version+1);assert.notEqual(removed[0].deleted_at,null);assert.deepEqual(removed[0].payload,s.payload);
 const restored=await s.restore();assert.equal(restored.length,1);assert.equal(restored[0].version,before.version+2);assert.equal(restored[0].deleted_at,null);assert.deepEqual(restored[0].payload,s.payload);assert.equal(restored[0].section,before.section);assert.equal(restored[0].owner_id,before.owner_id);assert.equal(restored[0].origin,before.origin);
 assert.deepEqual((await s.db.query("select * from public.cc_records where item_type<>'project' order by id")).rows,unchanged);
 assert.deepEqual(await read(s.db,linked.linkRecord.id),retired);
});

test('active task membership atomically refuses project removal even after a prior unlinked review',async t=>{
 const s=await setup(t),reviewed=await read(s.db,s.project);await s.link(true);
 // Adding a membership advances the task, not the project; the target trigger
 // must catch this race even when the reviewed project version still matches.
 assert.equal((await read(s.db,s.project)).version,reviewed.version);
 const before=(await s.db.query('select * from public.cc_records order by id')).rows;
 await assert.rejects(s.remove(reviewed.version),/Unlink tasks before removing a project/);
 assert.deepEqual((await s.db.query('select * from public.cc_records order by id')).rows,before);
 assert.equal((await read(s.db,s.project)).deleted_at,null);
});

test('foreign and revoked sessions cannot remove or restore another private project',async t=>{
 const s=await setup(t),before=await read(s.db,s.project);
 await actor(s.db,i.b,i.sb);assert.equal(await read(s.db,s.project),undefined);assert.equal((await s.remove(before.version)).length,0);
 await actor(s.db,i.a,i.sa);assert.deepEqual(await read(s.db,s.project),before);const [removed]=await s.remove();
 await actor(s.db,i.b,i.sb);assert.equal((await s.restore(removed.version)).length,0);
 await administrator(s.db);await s.db.query('delete from auth.sessions where id=$1',[i.sa]);await actor(s.db,i.a,i.sa);assert.equal(await read(s.db,s.project),undefined);assert.equal((await s.restore(removed.version)).length,0);
 await administrator(s.db);assert.deepEqual(await read(s.db,s.project),removed);
});

test('stale project removal/restoration versions cannot overwrite newer owner edits',async t=>{
 const s=await setup(t),reviewed=await read(s.db,s.project);
 await s.db.query("update public.cc_records set payload=payload||'{\"title\":\"Fictional newer project title\"}' where id=$1",[s.project]);
 assert.equal((await s.remove(reviewed.version)).length,0);const current=await read(s.db,s.project);assert.equal(current.payload.title,'Fictional newer project title');
 const [removed]=await s.remove(current.version);assert.equal((await s.restore(current.version)).length,0);assert.deepEqual(await read(s.db,s.project),removed);
});
