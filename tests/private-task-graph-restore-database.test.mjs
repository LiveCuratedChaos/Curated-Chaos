// Actual embedded graph restore. Input view stores nothing; no hosted data or credentials.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createIsolatedDevelopmentDatabase,actor,administrator,identities as i} from './fixtures/isolated-development-database.mjs';
import {fixture,link,meta,id,owner,recoveryGraph as graph} from './fixtures/common-task-memberships.mjs';
import {prepareCommonTaskMembership} from '../server/private-common-task-memberships.mjs';
import {privateWorkspaceRestoreDigest as digest} from '../server/private-workspace-restore-contract.mjs';
const scripts=await Promise.all(['private_school_records','private_school_academic_recovery','private_school_records_ready','private_school_academic_recovery_ready','private_common_task_memberships_forward'].map(v=>readFile(new URL('../supabase/drafts/'+v+'.sql',import.meta.url),'utf8')));
async function setup(t){const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());for(const sql of scripts)await db.exec(sql);await actor(db,i.a,i.sa);return{db,async restore(records){return(await db.query('insert into cc_private.restore_new_task_graph(payload) values($1::jsonb) returning payload',[JSON.stringify({records})])).rows[0].payload.records;},async all(){return(await db.query('select to_jsonb(r) r from public.cc_records r order by id')).rows.map(v=>v.r);},async get(key){return(await db.query('select to_jsonb(r) r from public.cc_records r where id=$1',[key])).rows[0]?.r;}};}
test('fresh task graph restore preserves original IDs, payloads, microsecond times and all revisions',async t=>{
 const s=await setup(t),g=graph(),before=await s.all(),saved=await s.restore(g.records);assert.equal(saved.length,7);assert.equal(digest(saved),digest(g.records));const after=await s.all();for(const original of before)assert.deepEqual(after.find(r=>r.id===original.id),original);assert.equal((await s.get(g.f.task.id)).version,7);assert.equal((await s.get(g.f.course.id)).version,9);assert.equal((await s.db.query('select * from cc_private.restore_new_task_graph')).rows.length,0);await assert.rejects(s.restore(g.records));assert.deepEqual(await s.all(),after);
});
test('existing task sources cannot bypass revision invalidation through the recovery input',async t=>{
 const s=await setup(t),g=graph();await s.restore([g.f.degree,g.f.task]);const before=await s.get(g.f.task.id);await assert.rejects(s.restore([g.task]),/Existing task sources require/);assert.deepEqual(await s.get(before.id),before);assert.equal(await s.get(g.task.id),undefined);
 const p=g.task.payload,result=(await s.db.query('select public.cc_set_common_task_link($1::jsonb,$2,$3::jsonb,$4,0,true) result',[JSON.stringify(p.task),before.version,JSON.stringify(p.project),g.f.degree.version])).rows[0].result;assert.equal(result.taskVersion,before.version+1);
});
test('fresh academic sources may reference an unchanged existing owned project target',async t=>{
 const s=await setup(t),g=graph();await s.restore([g.f.project]);const before=await s.get(g.f.project.id),saved=await s.restore([g.step,g.f.course,g.f.degree]);assert.equal(saved.length,3);assert.deepEqual(await s.get(before.id),before);assert.equal((await s.get(g.f.course.id)).version,9);assert.equal((await s.get(g.step.id)).version,6);
});
test('late membership validation failure rolls back source inserts and leaves no persistent recovery input',async t=>{
 const s=await setup(t),g=graph(),before=await s.all();g.step.payload.project.recordId=id(9999);await assert.rejects(s.restore(g.records));assert.deepEqual(await s.all(),before);assert.equal(await s.get(g.f.course.id),undefined);assert.equal((await s.db.query('select * from cc_private.restore_new_task_graph')).rows.length,0);
});
test('private recovery input rejects anon, foreign owner graphs and foreign project targets',async t=>{
 const s=await setup(t),g=graph();await s.db.exec('set role anon');await assert.rejects(s.restore(g.records));await actor(s.db,i.b,i.sb);await assert.rejects(s.restore(g.records));await actor(s.db,i.a,i.sa);await s.restore([g.f.project]);await actor(s.db,i.b,i.sb);const b=graph();b.f.degree.owner_id=i.b;b.f.course.owner_id=i.b;b.step.owner_id=i.b;await assert.rejects(s.restore([b.f.degree,b.f.course,b.step]));await administrator(s.db);assert.equal(await s.get(g.f.course.id),undefined);assert.equal((await s.get(g.f.project.id)).owner_id,owner);
});
test('recovery input bounds and metadata checks fail atomically before accepting malformed graphs',async t=>{
 const s=await setup(t);for(const mutate of [g=>g.records.push(g.records[0]),g=>g.f.task.deleted_at='2026-11-19T12:00:00Z',g=>g.f.task.owner_id=i.b,g=>g.f.task.household_id=i.home,g=>g.f.task.version=0,g=>g.f.task.extra=true,g=>g.f.task.item_type='unsupported',g=>g.f.task.id=g.f.task.id.toUpperCase()]){const g=graph(),before=await s.all();mutate(g);await assert.rejects(s.restore(g.records));assert.deepEqual(await s.all(),before);}
});
