import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {makeHandler} from '../tools/local-server.mjs';
import {createDevApi} from '../src/dev-api.mjs';
import * as model from '../src/dev-organize-model.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const config={supabaseUrl:'https://aaaaaaaaaaaa.supabase.co',projectRef:'aaaaaaaaaaaa',publishableKey:'sb_publishable_test'};
const response=data=>({ok:true,text:async()=>JSON.stringify(data)});
test('static homepage and assets work without opening local configuration',async()=>{
 for(const url of ['/','/src/core.mjs','/public/manifest.webmanifest']){
  const result={writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(body){this.body=body;}};
  await makeHandler()({url,method:'GET'},result);
  assert.equal(result.status,200,url);
  assert.match(result.headers['Content-Security-Policy'],/connect-src 'self';/);
 }
});
test('legacy task completion guards the exact revision and rejects missing versions',async()=>{
 const calls=[];const api=createDevApi(config,async(url,options)=>{calls.push({url,options});return response([]);});
 assert.throws(()=>api.toggleFictionalTask('test',id,owner,{done:true}),/Fetch latest/);
 assert.equal(calls.length,0);
 assert.deepEqual(await api.toggleFictionalTask('test',id,owner,{done:true},4),[]);
 assert.match(calls[0].url,/version=eq.4/);assert.match(calls[0].url,/deleted_at=is.null/);
});
test('record lists paginate beyond the previous organizer limit and reject partial failures',async()=>{
 const data=Array.from({length:275},(_,i)=>({id:String(i)}));const calls=[];
 const api=createDevApi(config,async url=>{const q=new URL(url).searchParams;calls.push(q);const offset=Number(q.get('offset'));return response(data.slice(offset,offset+100));});
 assert.deepEqual(await api.listOrganization('test',owner),data);
 assert.deepEqual(calls.map(q=>q.get('offset')),['0','100','200']);
 assert.equal(calls[0].get('order'),'created_at.desc,id.asc');
 const failing=createDevApi(config,async url=>{if(new URL(url).searchParams.get('offset')==='100')throw Error('offline');return response(data.slice(0,100));});
 await assert.rejects(failing.listOrganization('test',owner),/Could not reach/);
});
function organizer(){
 const source=readFileSync(new URL('../src/dev-organize.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').split('(async()=>{try{const res=await fetch')[0];
 const context=vm.createContext({...model,document:{getElementById:()=>({querySelector:()=>null,addEventListener(){}})},location:{hash:'#tasks'},window:{scrollY:240,scrollTo(x,y){context.scroll=y;}},requestAnimationFrame:fn=>fn(),renderConnectedShell:x=>x,e:String,dayString:()=>'',FormData:class{},crypto:{randomUUID:()=>id}});
 vm.runInContext(source,context);
 vm.runInContext(`user={id:'${owner}'};ready=true;records={tasks:[{id:'${id}',version:1,owner_id:'${owner}',visibility:'private',household_id:null,section:'Home',item_type:'task',payload:{title:'Test task',fictional:true,subtasks:[]}}],projects:[]};editor={type:'task',id:'${id}'};auth={getAccessToken:async()=> 'test'};drafts={'org-add-subtask':{entries:[['subtask_title','Keep this']]},'org-edit-task':{entries:[['title','Unsaved title']]}};show=()=>{};`,context);
 return context;
}
test('failed multi-subtask update retains drafts and editor; success clears only submitted subtasks',async()=>{
 const c=organizer();
 vm.runInContext(`api={listOrganization:async()=>{throw Error('offline')}}`,c);
 await vm.runInContext(`writeUpdate('task','${id}',r=>({payload:r.payload}),{keepEditor:true})`,c);
 assert.equal(vm.runInContext(`drafts['org-add-subtask'].entries[0][1]`,c),'Keep this');
 assert.equal(vm.runInContext('editor.id',c),id);
 vm.runInContext(`api={listOrganization:async()=>records.tasks,updateOrganizationRecord:async()=>[{id:'${id}'}]};load=async()=>{};`,c);
 await vm.runInContext(`writeUpdate('task','${id}',r=>({payload:r.payload}),{keepEditor:true})`,c);
 assert.equal(vm.runInContext(`drafts['org-add-subtask']`,c),undefined);
 assert.equal(vm.runInContext(`drafts['org-edit-task'].entries[0][1]`,c),'Unsaved title');
 assert.equal(c.scroll,240);
});
test('multi-subtask calculation preserves existing flags and rejects overflow before PATCH',async()=>{
 const c=organizer();
 vm.runInContext(`records.tasks[0].payload.subtasks=Array.from({length:39},()=>({id:'${id}',title:'Existing',done:true}));api={listOrganization:async()=>records.tasks,updateOrganizationRecord:async()=>{throw Error('PATCH must not run')}};`,c);
 await vm.runInContext(`writeUpdate('task','${id}',r=>{let payload=r.payload;for(const title of ['One','Two'])payload=addSubtask({...r,payload},title,'${id}');return {payload};},{keepEditor:true})`,c);
 assert.match(vm.runInContext('issue',c),/Subtask limit/);
 assert.equal(vm.runInContext('records.tasks[0].payload.subtasks.length',c),39);
 assert.equal(vm.runInContext('records.tasks[0].payload.subtasks[0].done',c),true);
});
test('completion and rename saves retain unrelated drafts and the open editor',async()=>{
 const c=organizer();
 vm.runInContext(`drafts['org-edit-subtasks']={entries:[['subtask_title','Renamed draft']]};api={listOrganization:async()=>records.tasks,updateOrganizationRecord:async()=>[{id:'${id}'}]};load=async()=>{};`,c);
 await vm.runInContext(`writeUpdate('task','${id}',r=>({payload:r.payload}),{keepEditor:true,clearDrafts:[]})`,c);
 assert.equal(vm.runInContext(`drafts['org-add-subtask'].entries[0][1]`,c),'Keep this');
 assert.equal(vm.runInContext(`drafts['org-edit-subtasks'].entries[0][1]`,c),'Renamed draft');
 await vm.runInContext(`writeUpdate('task','${id}',r=>({payload:r.payload}),{keepEditor:true,clearDrafts:['org-edit-subtasks']})`,c);
 assert.equal(vm.runInContext(`drafts['org-edit-subtasks']`,c),undefined);
 assert.equal(vm.runInContext(`drafts['org-add-subtask'].entries[0][1]`,c),'Keep this');
 assert.equal(vm.runInContext(`drafts['org-edit-task'].entries[0][1]`,c),'Unsaved title');
 assert.equal(vm.runInContext('editor.id',c),id);
});
test('stale subtask edits never issue an update and retain drafts',async()=>{
 const c=organizer();
 vm.runInContext(`api={listOrganization:async()=>records.tasks.map(r=>({...r,version:2})),updateOrganizationRecord:async()=>{throw Error('PATCH must not run')}};`,c);
 await vm.runInContext(`writeUpdate('task','${id}',r=>({payload:r.payload}),{keepEditor:true,clearDrafts:['org-edit-subtasks']})`,c);
 assert.match(vm.runInContext('issue',c),/changed since editing began/);
 assert.equal(vm.runInContext(`drafts['org-add-subtask'].entries[0][1]`,c),'Keep this');
});
test('organizer delayed tokens cannot start reads or writes after an account change',async()=>{
 for(const operation of ['load()','writeCreate(records.tasks[0])',`writeUpdate('task','${id}',r=>({payload:r.payload}))`]){
  const c=organizer();let release,calls=0;c.wait=new Promise(resolve=>release=resolve);c.apiCall=async()=>{calls++;return[];};vm.runInContext('auth.getAccessToken=()=>wait;api={listOrganization:apiCall,addOrganizationRecord:apiCall,updateOrganizationRecord:apiCall}',c);const pending=vm.runInContext(operation,c);vm.runInContext('serial++;user=null',c);release('old-fixture');await pending;assert.equal(calls,0);
 }
});
test('organizer acknowledged save followed by failed reload preserves truthful error and disables editing',async()=>{
 const c=organizer();vm.runInContext("api={addOrganizationRecord:async()=>[{}],listOrganization:async()=>{throw Error('fictional reload failure')}}",c);await vm.runInContext('writeCreate(records.tasks[0])',c);assert.match(vm.runInContext('issue',c),/save was acknowledged/);assert.match(vm.runInContext('issue',c),/fictional reload failure/);assert.doesNotMatch(vm.runInContext('issue',c),/Nothing has been changed/);assert.equal(vm.runInContext('message',c),'');assert.equal(vm.runInContext('ready',c),false);assert.equal(vm.runInContext('busy',c),false);
});
test('organizer open editor keeps its starting revision after refresh instead of silently rebasing old edits',async()=>{
 const c=organizer();let writes=0;c.write=async()=>{writes++;return[];};vm.runInContext(`editor.version=1;records.tasks[0].version=2;api={listOrganization:async()=>records.tasks,updateOrganizationRecord:write}`,c);await vm.runInContext(`writeUpdate('task','${id}',r=>({payload:r.payload}))`,c);assert.equal(writes,0);assert.match(vm.runInContext('issue',c),/close and reopen/);assert.equal(vm.runInContext(`drafts['org-edit-task'].entries[0][1]`,c),'Unsaved title');
});
test('organizer preserves newer quick-add text typed while a create is awaiting confirmation',async()=>{
 const c=organizer();let release;c.wait=new Promise(resolve=>release=resolve);vm.runInContext("drafts['org-add']={entries:[['title','Submitted fixture']]};api={addOrganizationRecord:()=>wait};load=async()=>{}",c);const pending=vm.runInContext('writeCreate(records.tasks[0])',c);await Promise.resolve();vm.runInContext("drafts['org-add']={entries:[['title','Newer fixture draft']]}",c);release([{}]);await pending;assert.equal(vm.runInContext("drafts['org-add'].entries[0][1]",c),'Newer fixture draft');
});
test('organizer sign-out stays available while busy and cancels pending old-account work',async()=>{
 const listeners={},source=readFileSync(new URL('../src/dev-organize.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').split('(async()=>{try{const res=await fetch')[0];const c=vm.createContext({...model,document:{getElementById:()=>({querySelector:()=>null,addEventListener:(name,fn)=>listeners[name]=fn})},location:{hash:'#tasks'},window:{},e:String,dayString:()=>'',renderConnectedShell:x=>x});vm.runInContext(source,c);vm.runInContext(`user={id:'${owner}'};busy=true;ready=true;drafts={'org-add':{entries:[['title','Private fixture']]}};auth={signOut:async()=>{}};show=()=>{}`,c);listeners.click({target:{closest:selector=>selector==='#org-signout'?{}:null}});assert.equal(vm.runInContext('user',c),null);assert.equal(vm.runInContext('busy',c),false);assert.equal(vm.runInContext('Object.keys(drafts).length',c),0);
});
