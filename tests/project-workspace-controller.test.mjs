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
const project={id:'project-one',version:1,item_type:'project',section:'Personal Life',payload:{title:'Project',summary:'',status:'Planned'}};
const task={id:'task-one',version:1,item_type:'task',section:'Personal Life',payload:{title:'Task',description:'',status:'Not Started',priority:'Normal',day:null,project_id:'project-one',subtasks:[]}};
const model={
 normalizeProjectWorkspace:rows=>({projects:rows.filter(row=>row.item_type==='project'),tasks:rows.filter(row=>row.item_type==='task')}),
 projectWorkspaceView(rows,_owner,{view,projectId}){const all=this.normalizeProjectWorkspace(rows);return {...all,projects:all.projects.filter(project=>!projectId||project.id===projectId),tasks:all.tasks.filter(row=>(!projectId||row.payload.project_id===projectId)&&(view==='completed'?row.payload.status==='Completed':view==='all'?row.payload.status!=='Completed':true)),counts:{}};},
 makeManualProject:form=>{assert.deepEqual(Object.keys(form).sort(),['section','status','summary','title']);return {item_type:'project',section:form.section,payload:{title:form.title,summary:form.summary,status:form.status}};},
 makeManualTask:form=>({item_type:'task',section:form.section,payload:{...form}}),
 changeManualProject:(record,patch)=>({...record.payload,...patch}),changeManualTask:(record,patch)=>({...record.payload,...patch})
};
async function setup(overrides={},rows=[project,task]){
 const doc={createElement:tag=>new Node(tag,doc)};const root=new Node('main',doc);const calls=[];
 const client={list:async()=>structuredClone(rows),create:async input=>{calls.push(['create',input]);return {record:{...input.record,id:'new-record',version:1},operationId:input.operationId};},update:async input=>{calls.push(['update',input]);return {record:{...rows.find(row=>row.id===input.id),payload:input.payload,version:2},operationId:input.operationId};},undo:async input=>{calls.push(['undo',input]);return {record:{...task,version:3},operationId:input.operationId};},history:async()=>[{action:'Updated',createdAt:'2026-11-12'}],...overrides};
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
