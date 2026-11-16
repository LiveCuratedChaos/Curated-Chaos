import test from 'node:test';
import assert from 'node:assert/strict';
import {mountProjectWorkspace} from '../src/project-workspace-controller.mjs';
class Node{
 constructor(tag,document){this.tag=tag;this.ownerDocument=document;this.children=[];this.attributes={};this.listeners={};this.textContent='';this.value='';}
 setAttribute(key,value){this.attributes[key]=value;}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;this.textContent='';}
 addEventListener(type,callback){(this.listeners[type]||=[]).push(callback);}
 async fire(type){for(const action of this.listeners[type]||[])await action({preventDefault(){}});await new Promise(resolve=>setTimeout(resolve,0));}
}
const nodes=node=>[node,...node.children.flatMap(nodes)];
const text=node=>node.textContent+node.children.map(text).join(' ');
const find=(root,label)=>nodes(root).find(node=>node.attributes['aria-label']===label)||nodes(root).find(node=>node.textContent===label);
const change=async(root,label,value)=>{const node=find(root,label);node.value=value;await node.fire('input');await node.fire('change');};
const project={id:'project-one',version:1,deleted_at:null,item_type:'project',section:'Personal Life',payload:{title:'Project',summary:'',status:'Planned'}};
const task={id:'task-one',version:1,deleted_at:null,item_type:'task',section:'Personal Life',payload:{title:'Task',description:'',status:'Not Started',priority:'Normal',day:null,project_id:'project-one',subtasks:[]}};
const model={
 normalizeProjectWorkspace:rows=>({projects:rows.filter(row=>row.item_type==='project'),tasks:rows.filter(row=>row.item_type==='task')}),
 projectWorkspaceView(rows,_owner,{view,projectId}){const all=this.normalizeProjectWorkspace(rows);return {...all,projects:all.projects.filter(project=>!projectId||project.id===projectId),tasks:all.tasks.filter(row=>(!projectId||row.payload.project_id===projectId)&&(view==='completed'?row.payload.status==='Completed':view==='all'?row.payload.status!=='Completed':true)),counts:{}};},
 makeManualProject:form=>{assert.deepEqual(Object.keys(form).sort(),['section','status','summary','title']);return {item_type:'project',section:form.section,payload:{title:form.title,summary:form.summary,status:form.status}};},
 makeManualTask:form=>({item_type:'task',section:form.section,payload:{...form}}),
 changeManualProject:(record,patch)=>({...record.payload,...patch}),changeManualTask:(record,patch)=>({...record.payload,...patch})
};
async function setup(overrides={},rows=[project,task]){
 const doc={createElement:tag=>new Node(tag,doc)};const root=new Node('main',doc);const calls=[];
 const client={list:async()=>structuredClone(rows),create:async input=>{calls.push(['create',input]);return {record:{...input.record,id:'new-record',version:1,deleted_at:null},operationId:input.operationId};},update:async input=>{calls.push(['update',input]);return {record:{...rows.find(row=>row.id===input.id),payload:input.payload,version:2},operationId:input.operationId};},undo:async input=>{calls.push(['undo',input]);return {record:{...task,version:3},operationId:input.operationId};},history:async()=>[{action:'Updated',createdAt:'2026-11-12'}],...overrides};
 const controller=await mountProjectWorkspace({root,client,ownerId:'owner',day:'2026-11-12',model});return {root,controller,calls};
}
test('routine project creation saves directly with unique intent and guarded undo',async()=>{
 const {root,calls}=await setup();await find(root,'New project').fire('click');await change(root,'Title','<img src=x onerror=alert(1)>');const form=nodes(root).find(node=>node.tag==='form');await form.fire('submit');
 assert.equal(calls.length,1);assert.equal(calls[0][0],'create');assert.equal(calls[0][1].record.payload.title,'<img src=x onerror=alert(1)>');assert.match(calls[0][1].operationId,/^[a-f0-9-]{36}$/);assert.ok(text(root).includes('<img src=x onerror=alert(1)>'));assert.ok(!nodes(root).some(node=>node.tag==='img'));
 await find(root,'Undo last save').fire('click');assert.equal(calls[1][1].targetOperationId,calls[0][1].operationId);assert.notEqual(calls[1][1].operationId,calls[0][1].operationId);
});
test('complete, progress, completed filter and reopen use versioned payload updates',async()=>{
 const {root,calls}=await setup();await find(root,'Complete').fire('click');assert.equal(calls[0][1].expectedVersion,1);assert.equal(calls[0][1].payload.status,'Completed');assert.ok(text(root).includes('1 of 1 tasks complete'));
 await find(root,'Completed').fire('click');await find(root,'Reopen').fire('click');assert.equal(calls[1][1].payload.status,'Not Started');assert.equal(calls[1][1].expectedVersion,2);
});
test('uncertain save retains draft, prevents repeated intent and allows read-only refresh',async()=>{
 let writes=0;const {root}=await setup({create:async()=>{writes++;throw Error('private upstream details');}});await find(root,'New task').fire('click');await change(root,'Title','Retained draft');await nodes(root).find(node=>node.tag==='form').fire('submit');
 assert.ok(text(root).includes('outcome unknown'));assert.equal(find(root,'Title').value,'Retained draft');assert.equal(find(root,'Save').disabled,true);await nodes(root).find(node=>node.tag==='form').fire('submit');assert.equal(writes,1);await find(root,'Refresh').fire('click');assert.equal(find(root,'Save').disabled,true);assert.ok(!text(root).includes('private upstream'));
});
test('session clearing removes private DOM and ignores pending responses and future refresh',async()=>{
 let resolve;let lists=0;const {root,controller}=await setup({list:async()=>{lists++;if(lists===1)return [project,task];return new Promise(done=>{resolve=done;});}});
 const pending=controller.refresh();controller.clear();resolve([project,task]);await pending;assert.equal(root.children.length,0);await controller.refresh();assert.equal(lists,2);assert.equal(root.children.length,0);
});
test('task editing preserves date, subtasks and project while section stays fixed',async()=>{
 const {root,calls}=await setup();await find(root,'Edit task').fire('click');assert.equal(find(root,'Section'),undefined);await change(root,'Due date','2026-11-14');await find(root,'Add subtask').fire('click');await change(root,'Subtask title 1','First step');await nodes(root).find(node=>node.tag==='form').fire('submit');
 const input=calls[0][1];assert.equal(input.payload.day,'2026-11-14');assert.equal(input.payload.subtasks[0].title,'First step');assert.equal(input.payload.subtasks[0].done,false);assert.equal(input.payload.project_id,'project-one');assert.equal(input.payload.section,undefined);
});
test('in-flight write blocks double submission and form edits until response',async()=>{
 let finish,writes=0;const {root}=await setup({create:input=>{writes++;return new Promise(resolve=>{finish=()=>resolve({record:{...project,id:'created'},operationId:input.operationId});});}});
 await find(root,'New project').fire('click');await change(root,'Title','One intent');const form=nodes(root).find(node=>node.tag==='form');await form.fire('submit');assert.equal(find(root,'Title').disabled,true);await nodes(root).find(node=>node.tag==='form').fire('submit');assert.equal(writes,1);finish();await new Promise(resolve=>setTimeout(resolve,0));assert.ok(text(root).includes('Saved.'));
});
test('local validation fails before transport and keeps editable draft',async()=>{
 const doc={createElement:tag=>new Node(tag,doc)};const root=new Node('main',doc);let writes=0;
 await mountProjectWorkspace({root,ownerId:'owner',day:'2026-11-12',model:{...model,makeManualProject(){throw Error('validation');}},client:{list:async()=>[],create:async()=>{writes++;},update:async()=>{},undo:async()=>{},history:async()=>[]}});
 await find(root,'New project').fire('click');await change(root,'Title','Draft title');await nodes(root).find(node=>node.tag==='form').fire('submit');assert.equal(writes,0);assert.equal(find(root,'Title').value,'Draft title');assert.equal(find(root,'Save').disabled,false);assert.ok(text(root).includes('has not been sent'));
});

test('new editor actions preserve unsaved draft until explicit discard',async()=>{
 const {root}=await setup();await find(root,'New project').fire('click');assert.equal(find(root,'Section').value,'Personal Life');await change(root,'Title','Unsaved project');assert.equal(find(root,'New task').disabled,true);assert.equal(find(root,'Edit task').disabled,true);assert.equal(find(root,'Complete').disabled,true);await find(root,'New task').fire('click');assert.equal(find(root,'Title').value,'Unsaved project');await find(root,'Discard draft').fire('click');await find(root,'New task').fire('click');assert.equal(find(root,'Title').value,'');
});
test('project filter options retain the full project list while a project is selected',async()=>{
 const {root}=await setup({},[project,{...project,id:'project-two',payload:{...project.payload,title:'Second project'}},task]);await change(root,'Project filter','project-one');assert.ok(find(root,'Project filter').children.some(node=>node.attributes.value==='project-two'));
});

test('real model workflow creates assigned task, completes/reopens, edits subtasks and Undoes creation tombstone',async()=>{
 const realModel=await import('../src/project-workspace-model.mjs');const owner='10000000-0000-4000-8000-000000000001';
 const doc={createElement:tag=>new Node(tag,doc)};const root=new Node('main',doc);let records=[];const operations=new Map();
 const client={list:async()=>structuredClone(records),history:async()=>[],create:async input=>{
  const record={...structuredClone(input.record),id:crypto.randomUUID(),version:1,deleted_at:null};records.push(record);operations.set(input.operationId,{before:null,record});return {record,operationId:input.operationId};
 },update:async input=>{const before=records.find(row=>row.id===input.id);assert.equal(input.expectedVersion,before.version);const record={...before,payload:input.payload,version:before.version+1};records=records.map(row=>row.id===record.id?record:row);operations.set(input.operationId,{before,record});return {record,operationId:input.operationId};},undo:async input=>{
  const operation=operations.get(input.targetOperationId);const current=records.find(row=>row.id===operation.record.id);const record=operation.before?{...operation.before,version:current.version+1}:{...current,version:current.version+1,deleted_at:'2026-11-12T12:00:00Z'};records=records.filter(row=>row.id!==record.id);if(record.deleted_at===null)records.push(record);return {record,operationId:input.operationId};
 }};
 await mountProjectWorkspace({root,client,ownerId:owner,day:'2026-11-12',model:realModel});
 await find(root,'New project').fire('click');await change(root,'Title','Real model project');await nodes(root).find(node=>node.tag==='form').fire('submit');assert.equal(records.length,1);assert.ok(text(root).includes('Saved.'));
 const projectId=records[0].id;await find(root,'New task').fire('click');await change(root,'Title','Real model task');await change(root,'Assigned project',projectId);await change(root,'Due date','2026-11-12');await find(root,'Add subtask').fire('click');await change(root,'Subtask title 1','First subtask');await nodes(root).find(node=>node.tag==='form').fire('submit');assert.equal(records.length,2);assert.equal(records[1].payload.project_id,projectId);assert.equal(records[1].payload.subtasks.length,1);
 await find(root,'Complete').fire('click');assert.ok(text(root).includes('1 of 1 tasks complete'));await find(root,'Completed').fire('click');await find(root,'Reopen').fire('click');assert.ok(text(root).includes('0 of 1 tasks complete'));await find(root,'All').fire('click');
 await find(root,'Edit task').fire('click');await change(root,'Subtask title 1','Edited subtask');await nodes(root).find(node=>node.tag==='form').fire('submit');assert.equal(records[1].payload.subtasks[0].title,'Edited subtask');await find(root,'Undo last save').fire('click');assert.equal(records[1].payload.subtasks[0].title,'First subtask');
 // New unlinked task makes the last operation a creation; Undo returns a tombstone.
 await find(root,'New task').fire('click');await change(root,'Title','Disposable task');await nodes(root).find(node=>node.tag==='form').fire('submit');assert.equal(records.length,3);await find(root,'Undo last save').fire('click');assert.equal(records.length,2);assert.ok(!text(root).includes('Disposable task'));assert.ok(!text(root).includes('could not be displayed'));
});
test('malformed receipt version or deletion marker fails closed without corrupting visible records',async()=>{
 for(const patch of [{version:1},{version:2,deleted_at:'not-a-date'},{version:2,deleted_at:undefined}]){
  const {root}=await setup({update:async input=>({record:{...task,...patch},operationId:input.operationId})});await find(root,'Complete').fire('click');assert.ok(text(root).includes('outcome unknown'));assert.ok(text(root).includes('Task'));assert.ok(!text(root).includes('could not be displayed'));
 }
});
test('replayed creation receipt never resurrects a record removed from the current live list',async()=>{
 const realModel=await import('../src/project-workspace-model.mjs');const owner='10000000-0000-4000-8000-000000000001';const doc={createElement:tag=>new Node(tag,doc)};const root=new Node('main',doc);let lists=0;
 const record={...realModel.makeManualProject({title:'Old removed project'},owner),id:crypto.randomUUID(),version:1,deleted_at:null};
 const client={list:async()=>{lists++;return [];},create:async input=>({record,operationId:input.operationId,replayed:true}),update:async()=>{},undo:async()=>{},history:async()=>[]};
 await mountProjectWorkspace({root,client,ownerId:owner,day:'2026-11-12',model:realModel});await find(root,'New project').fire('click');await change(root,'Title','Old removed project');await nodes(root).find(node=>node.tag==='form').fire('submit');assert.equal(lists,2);assert.ok(!text(root).includes('Old removed project'));assert.ok(!text(root).includes('could not be displayed'));assert.ok(text(root).includes('Saved.'));
});
test('replay refresh failure retains draft and does not trust stale receipt',async()=>{
 const realModel=await import('../src/project-workspace-model.mjs');const owner='10000000-0000-4000-8000-000000000001';const doc={createElement:tag=>new Node(tag,doc)};const root=new Node('main',doc);let lists=0;
 const record={...realModel.makeManualProject({title:'Old removed project'},owner),id:crypto.randomUUID(),version:1,deleted_at:null};
 const client={list:async()=>{if(++lists>1)throw Error();return [];},create:async input=>({record,operationId:input.operationId,replayed:true}),update:async()=>{},undo:async()=>{},history:async()=>[]};
 await mountProjectWorkspace({root,client,ownerId:owner,day:'2026-11-12',model:realModel});await find(root,'New project').fire('click');await change(root,'Title','Kept draft');await nodes(root).find(node=>node.tag==='form').fire('submit');assert.equal(find(root,'Title').value,'Kept draft');assert.ok(text(root).includes('outcome unknown'));assert.ok(!nodes(root).some(node=>node.tag==='h3'&&node.textContent==='Old removed project'));
});

test('manual recurring-progress display uses the root project saved option without altering records',async()=>{const model=await import('../src/project-workspace-model.mjs'),owner='10000000-0000-4000-8000-000000000001',pid='20000000-0000-4000-8000-000000000001',tid='30000000-0000-4000-8000-000000000001';const p={...model.makeManualProject({title:'Fictional recurring project'},owner),id:pid,version:1,deleted_at:null},t={...model.makeManualTask({title:'Fictional recurring task',status:'Completed',project_id:pid},owner,[p]),id:tid,version:1,deleted_at:null};t.payload.recurrence={anchorDay:'2026-11-01',frequency:'weekly',interval:1,seriesId:'40000000-0000-4000-8000-000000000001',ordinal:0};let writes=0;const data=[p,t],before=structuredClone(data),doc={createElement:tag=>new Node(tag,doc)},root=new Node('main',doc),controller=await mountProjectWorkspace({root,ownerId:owner,day:'2026-11-12',model,client:{list:async()=>data,create:()=>writes++,update:()=>writes++,undo:()=>writes++,history:async()=>[]}});assert.match(text(root),/0 of 0 tasks complete/);assert.match(text(root),/1 of 1 repeating occurrences complete.*shown separately; kept linked/);await find(root,'Today').fire('click');assert.match(text(root),/0 of 0 tasks complete/);assert.equal(writes,0);assert.deepEqual(data,before);controller.dispose();});

test('render normalization count stays bounded as project count grows',async()=>{let normalizations=0;const many=Array.from({length:80},(_,i)=>({...project,id:'project-'+i,payload:{...project.payload,title:'Fictional project '+i}}));const fixtureModel={...model,normalizeProjectWorkspace(rows){normalizations++;return model.normalizeProjectWorkspace(rows);}},doc={createElement:tag=>new Node(tag,doc)},root=new Node('main',doc),controller=await mountProjectWorkspace({root,ownerId:'owner',day:'2026-11-12',model:fixtureModel,client:{list:async()=>many,create:async()=>{throw Error('No writes');},update:async()=>{throw Error('No writes');},undo:async()=>{throw Error('No writes');},history:async()=>[]}});normalizations=0;await controller.refresh();assert.equal(normalizations,4);assert.equal(nodes(root).filter(n=>n.tag==='article').length,80);controller.dispose();});

const savedHistory=(id,kind='create',version=1)=>({operationId:'90000000-0000-4000-8000-000000000001',recordId:id,kind,resultVersion:version,createdAt:'2026-11-12T12:00:00Z',targetOperationId:null});
test('a late older history selection cannot replace the newer chosen record',async()=>{const pending={};const {root}=await setup({history:({id})=>new Promise(resolve=>pending[id]=resolve)});const first=find(root,'Project history').fire('click');await new Promise(r=>setImmediate(r));const second=find(root,'Task history').fire('click');await new Promise(r=>setImmediate(r));pending[task.id]([savedHistory(task.id)]);await second;assert.match(text(root),/Change history: Task/);pending[project.id]([savedHistory(project.id,'update')]);await first;assert.match(text(root),/Change history: Task/);assert.doesNotMatch(text(root),/Change history: Project|Updated · Version/);assert.match(text(root),/Created · Version 1/);});
test('starting a newer draft retires pending history without losing typed fields',async()=>{let release;const {root}=await setup({history:()=>new Promise(resolve=>release=resolve)});const pending=find(root,'Project history').fire('click');await new Promise(r=>setImmediate(r));await find(root,'New task').fire('click');await change(root,'Title','Fictional kept draft');release([savedHistory(project.id)]);await pending;assert.equal(find(root,'Title').value,'Fictional kept draft');assert.doesNotMatch(text(root),/Saved change history|Change history:/);});
test('history rejects wrong-record, oversized or payload-bearing responses without exposing contents',async()=>{for(const result of [[savedHistory(task.id)],[{...savedHistory(project.id),payload:'PRIVATE_UNEXPECTED_BODY'}],Array(101).fill(savedHistory(project.id)),[{...savedHistory(project.id),resultVersion:2}]]){const {root}=await setup({history:async()=>result});await find(root,'Project history').fire('click');assert.match(text(root),/History unavailable/);assert.doesNotMatch(text(root),/PRIVATE_UNEXPECTED_BODY|Change history:/);}});
test('refresh and session clearing prevent delayed history from returning',async()=>{for(const clear of [false,true]){let release;const {root,controller}=await setup({history:()=>new Promise(resolve=>release=resolve)});const pending=find(root,'Project history').fire('click');await new Promise(r=>setImmediate(r));if(clear)controller.clear();else await controller.refresh();release([savedHistory(project.id)]);await pending;assert.doesNotMatch(text(root),/Change history:|Saved change history/);if(clear)assert.equal(root.children.length,0);}});
test('bounded history reports displayed versus returned counts and closes explicitly',async()=>{const result=Array.from({length:60},(_,i)=>({...savedHistory(project.id),operationId:'90000000-0000-4000-8000-'+String(i+1).padStart(12,'0')}));const {root,calls}=await setup({history:async()=>result});await find(root,'Project history').fire('click');assert.match(text(root),/Showing 50 of 60 returned changes/);assert.equal(nodes(root).filter(n=>n.textContent.startsWith('Created · Version')).length,50);await find(root,'Close history').fire('click');assert.doesNotMatch(text(root),/Change history:/);assert.equal(calls.length,0);});
