import test from 'node:test';
import assert from 'node:assert/strict';
import {makeManualProject,makeManualTask,changeManualProject,changeManualTask,normalizeProjectWorkspace,projectWorkspaceView,MANUAL_WORKSPACE_ORIGIN} from '../src/project-workspace-model.mjs';
import {changeTask as changeFictionalTask,PROJECT_STATUSES,TASK_STATUSES,TASK_PRIORITIES} from '../src/dev-organize-model.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',P='11111111-1111-4111-8111-111111111111',Q='22222222-2222-4222-8222-222222222222',T='33333333-3333-4333-8333-333333333333',S='44444444-4444-4444-8444-444444444444';
const persisted=(record,id)=>({...structuredClone(record),id,version:1,deleted_at:null,created_at:'2026-11-12T12:00:00Z',updated_at:'2026-11-12T12:00:00Z'});
const project=(id=P,owner=A,section='Work')=>persisted(makeManualProject({title:'Fictional delivery project',section},owner),id);
const task=(id=T,extra={},projects=[project()])=>persisted(makeManualTask({title:'Fictional next action',section:'Work',project_id:P,...extra},A,projects),id);

test('manual project/task/subtasks completion and reopening derive progress without mutating inputs',()=>{
 const p=project(),t=task(T,{day:'2026-11-12',subtasks:[{id:S,title:'Check fictional draft',done:false}]},[p]),before=structuredClone(t);
 const edited=changeManualTask(t,{title:'Edited fictional action',subtasks:[{id:S,title:'Check draft',done:true}],status:'Completed'},A,[p]);
 assert.equal(edited.done,true);assert.equal(edited.subtasks[0].done,true);assert.deepEqual(t,before);
 const complete={...t,payload:edited,version:2};let result=projectWorkspaceView([p,complete],A,{day:'2026-11-12'});
 assert.equal(result.tasks.length,0);assert.equal(result.counts.total,0);assert.deepEqual(result.counts.projectCounts.map(({total,completed})=>({total,completed})),[{total:1,completed:1}]);
 const reopened={...complete,payload:changeManualTask(complete,{status:'In Progress'},A,[p]),version:3};result=projectWorkspaceView([p,reopened],A,{day:'2026-11-12',view:'today',projectId:P});
 assert.equal(result.tasks[0].payload.done,false);assert.deepEqual(result.counts.projectCounts.map(({total,completed})=>({total,completed})),[{total:1,completed:0}]);assert.equal(result.tasks[0].payload.subtasks[0].done,true);
});

test('manual discriminator is explicit; generated record envelope never invents server identities or changes fictional guards',()=>{
 const created=makeManualTask({title:'Safe manual task'},A);assert.equal(created.origin,MANUAL_WORKSPACE_ORIGIN);assert.deepEqual({schemaVersion:created.payload.schemaVersion,source:created.payload.source,fictional:created.payload.fictional},{schemaVersion:1,source:'manual',fictional:false});
 assert.equal(created.owner_id,A);assert.equal(created.household_id,null);assert.equal(created.visibility,'private');for(const field of ['id','version','created_at','updated_at'])assert.equal(Object.hasOwn(created,field),false);
 assert.throws(()=>changeFictionalTask(persisted(created,T),{title:'Changed'},A,[]),/fictional/);
 const fixture={...task(),origin:'m2c-fictional',payload:{...task().payload,fictional:true,source:'M2C_QUICK_ADD'}};assert.throws(()=>changeManualTask(fixture,{},A,[project()]));assert.deepEqual(normalizeProjectWorkspace([fixture],A),{projects:[],tasks:[]});
});

test('date views include overdue today, exclude completed, and keep selected-project counts coherent',()=>{
 const p=project(),q=project(Q),rows=[p,q,task(T,{day:'2026-11-11'}),task(S,{day:'2026-11-12'}),task('55555555-5555-4555-8555-555555555555',{day:'2026-11-13'}),task('66666666-6666-4666-8666-666666666666',{day:null}),task('77777777-7777-4777-8777-777777777777',{status:'Completed',day:'2026-11-11'}),task('88888888-8888-4888-8888-888888888888',{project_id:Q,day:null},[p,q])];
 for(const [view,total] of [['all',4],['today',2],['upcoming',1],['undated',1],['completed',1]]){const v=projectWorkspaceView(rows,A,{day:'2026-11-12',view,projectId:P});assert.equal(v.tasks.length,total);assert.equal(v.counts.total,total);assert.equal(v.counts.projectCounts[0].total,5);assert.equal(v.counts.projectCounts[0].completed,1);assert.equal(v.projects.length,1);assert.ok(v.tasks.every(t=>t.payload.project_id===P));}
 assert.throws(()=>projectWorkspaceView(rows,A,{day:'2026-02-30'}));assert.throws(()=>projectWorkspaceView(rows,A,{day:'2026-11-12',view:'overdue_only'}));assert.throws(()=>projectWorkspaceView(rows,A,{day:'2026-11-12',projectId:B}));
 assert.equal(makeManualTask({title:'Leap day',day:'2028-02-29'},A).payload.day,'2028-02-29');assert.throws(()=>makeManualTask({title:'Bad leap',day:'2027-02-29'},A));assert.throws(()=>makeManualTask({title:'Bad empty date',day:''},A));
});

test('payload and subtask extension fields survive ordinary edits as independent copies',()=>{
 const p=project();p.payload.future={nested:['kept']};const nextP=changeManualProject(p,{summary:'Changed summary'},A);assert.deepEqual(nextP.future,p.payload.future);nextP.future.nested.push('new');assert.deepEqual(p.payload.future.nested,['kept']);
 const t=task(T,{subtasks:[{id:S,title:'One',done:false}]},[p]);t.payload.future={linkedNotes:[Q]};t.payload.approval_state={protected:true};t.payload.subtasks[0].future={protected:true};
 const changed=changeManualTask(t,{description:'A description',subtasks:[{id:S,title:'Renamed',done:true}]},A,[p]);assert.deepEqual(changed.future,t.payload.future);assert.deepEqual(changed.approval_state,t.payload.approval_state);assert.deepEqual(changed.subtasks[0].future,{protected:true});assert.equal(changed.subtasks[0].title,'Renamed');
 assert.throws(()=>changeManualTask(t,{future:{linkedNotes:[]}},A,[p]));assert.throws(()=>changeManualTask(t,{subtasks:[{...t.payload.subtasks[0],future:{protected:false}}]},A,[p]));
});

test('protected owner/scope/provenance/version/status-derived fields cannot be patched or supplied by forms',()=>{
 const p=project(),t=task();for(const field of ['owner_id','household_id','visibility','origin','id','version','created_at','updated_at','deleted_at','schemaVersion','source','fictional','done','approval_state']){
  assert.throws(()=>changeManualTask(t,{[field]:'injected'},A,[p]));assert.throws(()=>changeManualProject(p,{[field]:'injected'},A));assert.throws(()=>makeManualTask({title:'Task',[field]:'injected'},A));assert.throws(()=>makeManualProject({title:'Project',[field]:'injected'},A));
 }
 assert.throws(()=>changeManualProject(p,{section:'School'},A));assert.throws(()=>changeManualTask(t,{section:'School'},A,[p]));assert.equal(changeManualProject(p,{section:'Work'},A).title,p.payload.title);
});

test('foreign, deleted, household, legacy and malformed project links cannot be assigned',()=>{
 const p=project();for(const candidate of [{...p,owner_id:B},{...p,deleted_at:'2026-11-12T12:00:00Z'},{...p,household_id:Q},{...p,visibility:'household'},{...p,origin:'m2c-fictional'},{...p,section:'School'},{...p,payload:{...p.payload,fictional:true}},{...p,version:0}])assert.throws(()=>makeManualTask({title:'Blocked',section:'Work',project_id:P},A,[candidate]));
 assert.throws(()=>makeManualTask({title:'Blocked',section:'Work',project_id:P},A,[]));assert.throws(()=>makeManualTask({title:'Blocked',section:'Work',project_id:P},A,[p,p]));assert.throws(()=>makeManualTask({title:'Blocked',project_id:'invalid'},A,[p]));
 const detached=changeManualTask(task(),{project_id:null},A,[p]);assert.equal(detached.project_id,null);
});

test('every manual edit validates authenticated owner, live identity and optimistic version metadata',()=>{
 const p=project(),t=task();for(const owner of [B,'',null,{},'not-an-id']){assert.throws(()=>changeManualProject(p,{},owner));assert.throws(()=>changeManualTask(t,{},owner,[p]));}
 for(const patch of [{owner_id:B},{visibility:'household'},{household_id:Q},{deleted_at:'2026-11-12T12:00:00Z'},{version:0},{version:1.5},{version:Number.MAX_SAFE_INTEGER+1},{id:'invalid'},{payload:{...t.payload,schemaVersion:2}},{payload:{...t.payload,done:true}}])assert.throws(()=>changeManualTask({...t,...patch},{},A,[p]));
});

test('subtasks reject duplicate/malformed/over-limit entries rather than silently dropping or truncating',()=>{
 const form={title:'Task'};const s={id:S,title:'Step',done:false};for(const value of [null,{},[s,s],[{...s,title:''}],[{...s,title:'x'.repeat(141)}],[{...s,done:'yes'}],[{...s,id:'bad'}],[{...s,remove:true}],Array.from({length:41},(_,i)=>({...s,id:(i+1).toString(16).padStart(8,'0')+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}))])assert.throws(()=>makeManualTask({...form,subtasks:value},A));
 const tasks=Array.from({length:40},(_,i)=>({...s,id:(i+1).toString(16).padStart(8,'0')+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}));assert.equal(makeManualTask({...form,subtasks:tasks},A).payload.subtasks.length,40);
 const t=task();t.payload.subtasks=[s,{...s}];assert.throws(()=>changeManualTask(t,{title:'Changed'},A,[project()]));
});

test('normalization ignores unrelated rows but rejects malformed manual rows and graphs without data loss',()=>{
 const p=project(),t=task(),unrelated=[null,{item_type:'note',origin:MANUAL_WORKSPACE_ORIGIN,owner_id:B},{item_type:'event',origin:'apple_readonly'},{...t,origin:'m2c-fictional',payload:{fictional:true}}];
 assert.deepEqual(normalizeProjectWorkspace([p,t,...unrelated],A),{projects:[p],tasks:[t]});
 for(const rows of [[p,{...t,owner_id:B}],[p,{...t,payload:{...t.payload,day:'bad'}}],[p,{...t,payload:{...t.payload,subtasks:null}}],[p,t,t],[t],[{...p,version:0}]])assert.throws(()=>normalizeProjectWorkspace(rows,A));
 assert.throws(()=>normalizeProjectWorkspace(null,A));assert.throws(()=>normalizeProjectWorkspace([],B.slice(0,5)));
 const result=normalizeProjectWorkspace([t,p],A);result.tasks[0].payload.title='Local display mutation';assert.equal(t.payload.title,'Fictional next action');
});

test('existing enumerations are reused exactly and invalid types never become strings or fallback statuses',()=>{
 for(const status of PROJECT_STATUSES)assert.equal(makeManualProject({title:'Project',status},A).payload.status,status);
 for(const status of TASK_STATUSES){const result=makeManualTask({title:'Task',status},A);assert.equal(result.payload.status,status);assert.equal(result.payload.done,status==='Completed');}
 for(const priority of TASK_PRIORITIES)assert.equal(makeManualTask({title:'Task',priority},A).payload.priority,priority);
 for(const patch of [{title:0},{title:' '},{title:'x'.repeat(141)},{description:null},{description:'x'.repeat(1001)},{status:'Active'},{status:null},{priority:null},{section:null},{day:0}])assert.throws(()=>makeManualTask({title:'Task',...patch},A));
 assert.equal(makeManualProject({title:'  Trimmed  '},A).payload.title,'Trimmed');assert.throws(()=>makeManualProject({title:'Project',summary:null},A));
});
