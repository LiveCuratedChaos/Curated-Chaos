import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {escapeHtml} from '../src/core.mjs';
import * as home from '../src/dev-home-model.mjs';
import * as personal from '../src/dev-personal-model.mjs';
import * as finances from '../src/dev-finances-model.mjs';
import * as work from '../src/dev-work-model.mjs';
import {MOBILE_TABS} from '../src/dev-navigation-model.mjs';
import {renderConnectedShell,renderSavedFinanceEntry} from '../src/dev-cloud-shell.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const definitions={home:{model:home,kind:'cleaning'},personal:{model:personal,kind:'goal'},finances:{model:finances,kind:'budget'},work:{model:work,kind:'project'}};
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function screen(name){
 const listeners={},alert={textContent:''};
 const root={innerHTML:'',addEventListener(name,fn){listeners[name]=fn;},querySelectorAll:()=>[],querySelector:()=>alert,prepend(){}};
 const source=readFileSync(new URL(`../src/dev-${name}.mjs`,import.meta.url),'utf8').replace(/^import .*;\n/gm,'').split('(async()=>{try{const res=await fetch')[0];
 const c=vm.createContext({...definitions[name].model,escapeHtml,e:escapeHtml,renderSavedFinanceEntry,location:{href:'http://127.0.0.1:5301/dev-finances.html'},document:{getElementById:()=>root},renderConnectedShell:s=>s,FormData:class{constructor(form){this.values=form.values;}entries(){return Object.entries(this.values);}}});
 vm.runInContext(source,c);
 vm.runInContext(`user={id:'${owner}',email:'fictional@example.test'};auth={getAccessToken:async()=> 'fixture',signOut:async()=>{}};api={listOrganization:async()=>[]};`,c);
 const kind=definitions[name].kind;
 vm.runInContext(name==='work'?`editor='${kind}'`:`editor={kind:'${kind}',projectId:null}`,c);
 const input=title=>listeners.input({target:{form:{id:name==='work'?'work-quick':`${name}-add`},name:'title',value:title}});
 const create=v=>vm.runInContext(name==='work'?'create':'createItem',c)(v);
 const click=action=>listeners.click({target:{closest:()=>({dataset:{action}})}});
 return {c,root,alert,listeners,input,create,click};
}
for(const name of Object.keys(definitions)){
 test(`${name}: failed and unconfirmed creates preserve drafts across refresh; cancel clears them`,async()=>{
  for(const outcome of [`throw Error('offline')`,`return []`]){
   const s=screen(name);s.input('Draft <name>');
   vm.runInContext(`api.addOrganizationRecord=async()=>{${outcome}};render()`,s.c);
   assert.match(s.root.innerHTML,/Draft &lt;name&gt;/);
   await vm.runInContext('load()',s.c);
   assert.match(s.root.innerHTML,/Draft &lt;name&gt;/);
   await s.create({title:'Draft <name>'});
   assert.match(s.root.innerHTML,/Draft &lt;name&gt;/);
   assert.ok(vm.runInContext('error.length>0',s.c));
   assert.equal(vm.runInContext('busy',s.c),false);
   s.click('cancel');
   assert.equal(vm.runInContext(name==='work'?'quickDraft.title':'quickDraft',s.c),'');
  }
 });
 test(`${name}: confirmed create clears draft; failed reload keeps the error visible`,async()=>{
  const s=screen(name);s.input('Submitted draft');
  vm.runInContext(`api.addOrganizationRecord=async()=>[{}];api.listOrganization=async()=>{throw Error('reload offline')}`,s.c);
  await s.create({title:'Submitted draft'});
  assert.equal(vm.runInContext(name==='work'?'quickDraft.title':'quickDraft',s.c),'');
  assert.match(vm.runInContext('error',s.c),/reload offline/);
  assert.equal(vm.runInContext('notice',s.c),'');
  assert.equal(vm.runInContext('busy',s.c),false);
 });
}
for(const name of ['home','personal','work']){
 test(`${name}: completion failure stays visible and retains the add draft`,async()=>{
  const s=screen(name);s.input('Keep this draft');
  s.c.fixture={id,version:1,item_type:'task',payload:{title:'Sample step',done:false}};
  vm.runInContext(`${name==='work'?'tasks':'records'}=[fixture];api.updateOrganizationRecord=async()=>{throw Error('Version conflict')};api.listOrganization=async()=>{throw Error('must not erase save error with reload')}`,s.c);
  const input={checked:true,dataset:name==='work'?{taskId:id}:{stepId:id}};
  await vm.runInContext(name==='work'?'toggleTask':'toggleStep',s.c)(input);
  assert.match(vm.runInContext('error',s.c),/Version conflict/);
  assert.match(s.root.innerHTML,/Keep this draft/);
  assert.equal(vm.runInContext('busy',s.c),false);
 });
}
test('finances: a late failed completion cannot add an error to the signed-out screen',async()=>{
 const s=screen('finances');let reject;
 s.c.pending=new Promise((_,r)=>{reject=r;});
 s.c.fixture={id,version:1,item_type:'task',payload:{title:'Sample step',done:false}};
 vm.runInContext(`records=[fixture];api.updateOrganizationRecord=()=>pending;`,s.c);
 const input={checked:true,disabled:false,dataset:{stepId:id},matches:()=>true,closest:()=>null};
 s.listeners.change({target:input});await turn();
 assert.equal(input.disabled,true);
 s.click('signout');const signedOut=s.root.innerHTML;
 reject(Error('Late response from old account'));await turn();
 assert.equal(vm.runInContext('error',s.c),'');
 assert.equal(s.root.innerHTML,signedOut);
 assert.equal(vm.runInContext('records.length',s.c),0);
});
test('finances: a late successful completion cannot mutate a newer account snapshot',async()=>{
 const s=screen('finances');let resolve;
 s.c.pending=new Promise(r=>{resolve=r;});
 s.c.fixture={id,version:1,item_type:'task',payload:{title:'Old account step',done:false}};
 vm.runInContext(`records=[fixture];api.updateOrganizationRecord=()=>pending;`,s.c);
 s.listeners.change({target:{checked:true,disabled:false,dataset:{stepId:id},matches:()=>true,closest:()=>null}});await turn();
 s.click('signout');
 vm.runInContext(`user={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};records=[{id:'new-account-record',payload:{title:'New account'}}]`,s.c);
 resolve([{...s.c.fixture,version:2,payload:{...s.c.fixture.payload,done:true}}]);await turn();
 assert.equal(vm.runInContext('records[0].id',s.c),'new-account-record');
 assert.equal(vm.runInContext('error',s.c),'');
});
test('Work rejects impossible dates and accepts valid leap-year dates',()=>{
 for(const day of ['2026-02-30','2026-02-29','2026-13-01','not-a-day'])assert.throws(()=>work.workQuickRecord('task','Test task',owner,{day}));
 assert.equal(work.workQuickRecord('task','Test task',owner,{day:'2028-02-29'}).payload.day,'2028-02-29');
});
test('mobile Home opens the working workspace and Finances marks its own navigation item',()=>{
 assert.equal(MOBILE_TABS.find(t=>t.id==='home').href,'/dev-home.html');
 const s=screen('finances');s.c.renderConnectedShell=renderConnectedShell;vm.runInContext('render()',s.c);
 assert.match(s.root.innerHTML,/aria-current="page" href="\/dev-finances.html"/);
 assert.doesNotMatch(s.root.innerHTML,/aria-current="page" href="\/dev-home.html"/);
});
