import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allowedPublicPath,makeHandler} from '../tools/local-server.mjs';
import {createDevApi} from '../src/dev-api.mjs';
import {makeTask,makeProject,normalizeOrganizerRows,changeTask,changeProject,readSubtasks,addSubtask,toggleSubtask,projectCounts,getTaskPriority,getTaskStatus,pickOrganizerTasks} from '../src/dev-organize-model.mjs';
import {toggledTaskPayload} from '../src/dev-brief-model.mjs';
import {renderConnectedShell} from '../src/dev-cloud-shell.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const P='11111111-1111-4111-8111-111111111111';
const T='22222222-2222-4222-8222-222222222222';
const SUB='33333333-3333-4333-8333-333333333333';
const wrap=(entry,id,owner=A,version=1)=>({...entry,id,version,updated_at:'2026-10-31T01:00:00Z',created_at:'2026-10-31T00:00:00Z',deleted_at:null,owner_id:owner});
const project=()=>wrap(makeProject({title:'QA renovation',section:'Home',status:'Active',summary:'Sample project'},A),P);
const task=()=>wrap(makeTask({title:'QA get supplies',section:'Home',day:'2026-11-01',priority:'High',project_id:P,description:'A fictional task'},A,[project()]),T);
test('M2C task and project records use owner-private fictional records in existing table',()=>{
 const p=project(),t=task();assert.equal(p.household_id,null);assert.equal(t.visibility,'private');assert.equal(t.item_type,'task');assert.equal(p.item_type,'project');
 assert.equal(t.payload.project_id,P);assert.equal(t.payload.priority,'High');assert.equal(t.payload.done,false);
 assert.doesNotMatch(JSON.stringify([p,t]),/password|access.token|service_role/);
});
test('M2C private read filters ownership, household, deleted and nonfictional records',()=>{
 const p=project(),t=task();const result=normalizeOrganizerRows([p,t,{...t,id:'44444444-4444-4444-8444-444444444444',owner_id:B},{...p,id:'55555555-5555-4555-8555-555555555555',deleted_at:'2026-10-31'},{...p,id:'66666666-6666-4666-8666-666666666666',household_id:B},{...t,id:'77777777-7777-4777-8777-777777777777',payload:{...t.payload,fictional:false}}],A);
 assert.equal(result.projects.length,1);assert.equal(result.tasks.length,1);assert.deepEqual(normalizeOrganizerRows([p,t],B),{tasks:[],projects:[]});
});
test('M2C invalid input rejected before any cloud write',()=>{
 assert.throws(()=>makeTask({title:'',day:'2026-11-01'},A));
 assert.throws(()=>makeTask({title:'Test',day:'2026-02-30'},A));
 assert.throws(()=>makeTask({title:'Test',day:'2026-11-01',section:'Finances'},A));
 assert.throws(()=>makeTask({title:'Test',day:'2026-11-01',project_id:P},A,[project()]));
 assert.throws(()=>makeTask({title:'Test',day:'2026-11-01',section:'Work',project_id:P},A,[project()]));
 assert.throws(()=>makeProject({title:'x'.repeat(150),section:'Home'},A));
 assert.throws(()=>makeProject({title:'yes',status:'Approved'},A));
});
test('M2C task editing preserves previously approved source and any valid subtasks',()=>{
 const t=task();t.payload.source='M1A_APPROVED_EMAIL_FIXTURE';t.payload.subtasks=[{id:SUB,title:'old subtask',done:true}];
 const edited=changeTask(t,{title:'QA updated',status:'Completed',day:'2026-11-02'},A,[project()]);
 assert.equal(edited.source,'M1A_APPROVED_EMAIL_FIXTURE');assert.equal(edited.title,'QA updated');assert.equal(edited.done,true);assert.equal(edited.subtasks.length,1);
 assert.throws(()=>changeTask({...t,owner_id:B},{title:'Wrong account'},A,[project()]));
});
test('M2C project edit preserves private source and updates name and status',()=>{
 const p=project();const edited=changeProject(p,{title:'QA improvement',status:'Completed'},A);
 assert.equal(edited.status,'Completed');assert.equal(edited.title,'QA improvement');assert.equal(edited.source,'M2C_PROJECT');
 assert.throws(()=>changeProject({...p,visibility:'household'},{title:'Oops'},A));
});
test('M2C subtasks add/toggle without mutating original record',()=>{
 const r=task();const first=addSubtask(r,'QA order material',SUB);
 assert.equal(first.subtasks[0].done,false);assert.equal(readSubtasks(r.payload.subtasks).length,0);
 const second=toggleSubtask({...r,payload:first},SUB);assert.equal(second.subtasks[0].done,true);
 assert.throws(()=>addSubtask(r,'',SUB));assert.throws(()=>toggleSubtask(r,SUB));
});
test('M2C project progress counts linked tasks only',()=>{
 const p=project(),t=task();const another={...t,id:SUB,payload:{...t.payload,project_id:null}};
 assert.deepEqual(projectCounts([p],[t,another]).map(x=>[x.total,x.completed]),[[1,0]]);
 const done={...t,payload:{...t.payload,status:'Completed',done:true}};
 assert.equal(projectCounts([p],[done])[0].completed,1);
});
test('M2C task filtering prioritizes status, area and priority, including M1 tasks without new metadata',()=>{
 const t=task(),old={...t,id:SUB,section:'School',payload:{title:'Legacy',day:'2026-11-01',fictional:true,done:true}};
 assert.equal(getTaskStatus(old),'Completed');assert.equal(getTaskPriority(old),'Normal');
 assert.equal(pickOrganizerTasks([t,old],{section:'Home',priority:'High'}).length,1);
 assert.equal(pickOrganizerTasks([t,old],{status:'Completed'}).length,1);
});
test('M2C legacy toggles preserve metadata without changing earlier legacy response',()=>{
 const t=task();const result=toggledTaskPayload(t);
 assert.equal(result.priority,'High');assert.equal(result.project_id,P);assert.equal(result.status,'Completed');assert.equal(result.done,true);
 const old={...t,payload:{title:'Legacy',day:'2026-11-01',fictional:true,done:false,source:'M0D_DEV_BRIEF_TEST'}};
 assert.deepEqual(toggledTaskPayload(old),{...old.payload,done:true});
});
test('M2C cloud API owner-scoped reads and version guarded writes',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,text:async()=>JSON.stringify([{id:T}])};};
 const api=createDevApi({supabaseUrl:'https://aaaaaaaaaaaa.supabase.co',projectRef:'aaaaaaaaaaaa',publishableKey:'sb_publishable_test'},fetcher);
 await api.listOrganization('token',A);
 await api.addOrganizationRecord('token',task());
 await api.updateOrganizationRecord('token',{id:T,version:4},A,'task',task().payload,'Home');
 assert.match(calls[0].url,/owner_id=eq\.aaaaaaaa/);assert.match(calls[0].url,/item_type=in\.\(task,project\)/);
 assert.match(calls[2].url,/version=eq\.4/);assert.match(calls[2].url,/owner_id=eq\.aaaaaaaa/);
 assert.equal(calls[2].options.method,'PATCH');assert.equal(JSON.parse(calls[2].options.body).section,'Home');
 assert.throws(()=>api.updateOrganizationRecord('token',{id:T,version:0},A,'task',task().payload,'Home'));
 assert.throws(()=>api.addOrganizationRecord('token',{...task(),visibility:'household'}));
});
test('M2C private Quick Add navigation available in shell and all new routes explicitly allowlisted',()=>{
 const html=renderConnectedShell('',{active:'organize'});assert.match(html,/href="\/dev-organize\.html#quick-add"/);
 assert.match(html,/Tasks &amp; Projects/);assert.match(html,/aria-label="Quick Add"/);
 for(const route of ['/dev-organize.html','/src/dev-organize.mjs','/src/dev-organize-model.mjs'])assert.equal(allowedPublicPath(route),true);
 for(const route of ['/.env.local','/tests/dev-organize.test.mjs','/tools/local-server.mjs'])assert.equal(allowedPublicPath(route),false);
 assert.match(readFileSync(new URL('../dev-organize.html',import.meta.url),'utf8'),/src="\/src\/dev-organize\.mjs"/);
});
