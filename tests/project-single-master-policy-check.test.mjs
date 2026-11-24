// Offline embedded PostgreSQL only; no configuration, provider or hosted access.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {projectSingleMasterPolicyCheck} from '../server/project-single-master-policy-check.mjs';
import {createIsolatedDevelopmentDatabase} from './fixtures/isolated-development-database.mjs';
const base=await readFile(new URL('../supabase/drafts/private_project_hierarchy.sql',import.meta.url),'utf8'),single=await readFile(new URL('../supabase/drafts/private_project_single_master.sql',import.meta.url),'utf8');
async function setup(t){const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());await db.exec(base);await db.exec(single);return db;}
const records=async db=>(await db.query('select * from public.cc_records order by id')).rows;
const sessions=async db=>(await db.query('select * from auth.sessions order by id')).rows;
test('single-master QA manifest is fresh, bounded, rollback-only and does not request real metadata',()=>{
 const a=projectSingleMasterPolicyCheck(),b=projectSingleMasterPolicyCheck();assert.equal(a.rollbackOnly,true);assert.equal(a.records,10);assert.equal(a.sessions,2);assert.equal(a.recordIds.length,5);assert.equal(a.projectIds.length,4);assert.equal(a.sessionIds.length,2);assert.equal(new Set([...a.recordIds,...a.sessionIds,...b.recordIds,...b.sessionIds]).size,14);
 assert.match(a.sql,/exception when sqlstate 'P7777' then null;end;/);assert.match(a.sql,/rollback;\nselect 'passed'/);assert.doesNotMatch(a.sql,/\bcommit\b|select \*|cc_project_hierarchy_snapshot|auth\.users.*email|provider|access_token|refresh_token/i);assert.doesNotMatch(a.cleanupSql,/\b(delete|update|insert)\b/i);
});
test('single-master QA passes against both drafts and leaves every existing record/session unchanged',async t=>{
 const db=await setup(t),qa=projectSingleMasterPolicyCheck(),before=await records(db),beforeSessions=await sessions(db);
 const result=await db.exec(qa.sql),report=result.at(-1).rows;assert.deepEqual(report,[{single_master_checks:'passed',fictional_record_bound:10,temporary_session_bound:2,no_qa_records_saved:true,no_qa_sessions_saved:true}]);
 assert.deepEqual(await records(db),before);assert.deepEqual(await sessions(db),beforeSessions);assert.deepEqual((await db.query(qa.cleanupSql)).rows,[{remaining_qa_records:0,remaining_qa_sessions:0}]);
});
test('readiness failure aborts synthetic QA without accepting old several-parent schema or retaining fixtures',async t=>{
 const db=await setup(t),qa=projectSingleMasterPolicyCheck(),before=await records(db),beforeSessions=await sessions(db);await db.exec('alter table public.cc_records disable trigger cc_validate_single_project_parent');
 await assert.rejects(db.exec(qa.sql),/guards are not ready/);await db.exec('rollback');assert.deepEqual(await records(db),before);assert.deepEqual(await sessions(db),beforeSessions);assert.deepEqual((await db.query(qa.cleanupSql)).rows,[{remaining_qa_records:0,remaining_qa_sessions:0}]);
});
test('fresh-identity collision refuses QA before replacing an existing record',async t=>{
 const db=await setup(t),qa=projectSingleMasterPolicyCheck();await db.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,payload) select $1,id,'private','Home','note','{\"fictional\":true,\"title\":\"Fictional collision preserved\"}' from auth.users order by id limit 1",[qa.recordIds[0]]);
 const before=await records(db),beforeSessions=await sessions(db);await assert.rejects(db.exec(qa.sql),/identity collision/);await db.exec('rollback');assert.deepEqual(await records(db),before);assert.deepEqual(await sessions(db),beforeSessions);
});
