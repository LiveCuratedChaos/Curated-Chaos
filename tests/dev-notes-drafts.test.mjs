import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {makeFictionalNote} from '../src/dev-api.mjs';
import {normalizeCloudRecords} from '../src/dev-brief-model.mjs';
import {escapeHtml} from '../src/core.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function screen(){
 const listeners={},count={textContent:''},list={outerHTML:''};
 const root={innerHTML:'',addEventListener(name,fn){listeners[name]=fn;},querySelector(selector){return selector==='#notes-match-count'?count:list;}};
 const source=readFileSync(new URL('../src/dev-notes.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').split('(async()=>{\n try{const response=')[0];
 const c=vm.createContext({document:{getElementById:()=>root},renderConnectedShell:s=>s,e:escapeHtml,makeFictionalNote,normalizeCloudRecords,FormData:class{constructor(form){this.data=form.values;}get(key){return this.data[key];}}});
 vm.runInContext(source,c);
 vm.runInContext(`session={};user={id:'${owner}',email:'fictional@example.test'};auth={get:()=>session,getAccessToken:async()=> 'fixture'};api={listBriefRecords:async()=>[]};`,c);
 const submit=values=>listeners.submit({target:{id:'notes-add',values},preventDefault(){}});
 return {c,root,count,list,submit,listeners};
}
test('failed or unconfirmed note saves retain escaped draft text and permit retry',async()=>{
 for(const operation of [`throw Error('offline')`,`return []`]){
  const s=screen();vm.runInContext(`api.addNote=async()=>{${operation}}`,s.c);
  await s.submit({title:'Trip <draft>',body:'Keep & review'});
  assert.equal(vm.runInContext('noteDraft.title',s.c),'Trip <draft>');
  assert.equal(vm.runInContext('noteDraft.body',s.c),'Keep & review');
  assert.match(s.root.innerHTML,/Trip &lt;draft&gt;/);
  assert.match(s.root.innerHTML,/Keep &amp; review/);
  assert.match(vm.runInContext('error',s.c),/before retrying/);
  assert.equal(vm.runInContext('busy',s.c),false);
 }
});
test('confirmed save clears draft but a failed reload remains visibly failed',async()=>{
 const s=screen();vm.runInContext(`api.addNote=async()=>[{}];api.listBriefRecords=async()=>{throw Error('reload offline')}`,s.c);
 await s.submit({title:'Saved title',body:'Saved body'});
 assert.equal(vm.runInContext('noteDraft.title',s.c),'');
 assert.match(vm.runInContext('error',s.c),/reload offline/);
 assert.equal(vm.runInContext('notice',s.c),'');
 assert.equal(vm.runInContext('busy',s.c),false);
});
test('validation and refresh preserve drafts while sign-out clears them',async()=>{
 const s=screen();
 await s.submit({title:'',body:'Keep invalid draft'});
 assert.equal(vm.runInContext('noteDraft.body',s.c),'Keep invalid draft');
 await vm.runInContext('refresh()',s.c);
 assert.equal(vm.runInContext('noteDraft.body',s.c),'Keep invalid draft');
 vm.runInContext('clearLocal();render()',s.c);
 assert.equal(vm.runInContext('noteDraft.body',s.c),'');
 assert.doesNotMatch(s.root.innerHTML,/Keep invalid draft/);
});
test('typing search updates matching count and list without replacing the form',()=>{
 const s=screen();vm.runInContext(`notes=[{payload:{title:'Train',body:'Tickets'},created_at:'2026-11-08'},{payload:{title:'Groceries',body:'Sample'},created_at:'2026-11-08'}];render();`,s.c);
 const before=s.root.innerHTML;
 s.listeners.input({target:{id:'notes-search',value:'Train'}});
 assert.equal(s.count.textContent,'1');
 assert.match(s.list.outerHTML,/Train/);assert.doesNotMatch(s.list.outerHTML,/Groceries/);
 assert.equal(s.root.innerHTML,before);
});
