import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as search from '../src/dev-search-model.mjs';
import * as widgets from '../src/dev-widget-layout-model.mjs';
import {escapeHtml} from '../src/core.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function harness(name,globals){
 const handlers={},root={innerHTML:'',addEventListener(event,fn){(handlers[event]??=[]).push(fn);}};
 const source=readFileSync(new URL(`../src/dev-${name}.mjs`,import.meta.url),'utf8').replace(/^import .*;\n/gm,'').split(name==='search'?'\n(async()=>{try{const res=await fetch':'\n(async()=>{\n  try{')[0];
 const c=vm.createContext({...globals,e:escapeHtml,escapeHtml,URLSearchParams,document:{getElementById:()=>root,body:{dataset:{}}},window:{innerWidth:1280,addEventListener(){}},location:{search:'?page=curation'},renderConnectedShell:s=>s,crypto:{randomUUID:()=>id}});
 vm.runInContext(source,c);
 vm.runInContext(`user={id:'${owner}',email:'fictional@example.test'};auth={getAccessToken:async()=> 'fixture',signOut:async()=>{}}`,c);
 return {c,root,handlers};
}
function searchScreen(){return harness('search',search);}
function widgetScreen(){
 const s=harness('workspace',{...widgets,safeWorkspacePage:()=> 'curation',workspaceHeading:()=>({title:'The Curation',description:'Fixture'}),normalizeCloudRecords:()=>({}),normalizeFictionalLife:()=>({}),normalizeFictionalEmails:()=>[],normalizeOrganizerRows:()=>({projects:[]}),readOwnerBriefPreferences:()=>({preferences:{hideAmounts:true,palette:'neutral',density:'balanced'}})});
 vm.runInContext(`show=()=>{};snapshot={};layoutDirty=true;api={};`,s.c);
 return s;
}
test('Search clears unverified results after failed refresh and keeps the query for retry',async()=>{
 const s=searchScreen();s.c.fixture={id,owner_id:owner,visibility:'private',household_id:null,section:'Work',item_type:'project',payload:{title:'Sample project',fictional:true}};
 vm.runInContext(`records=[fixture];query='Sample';verified=true;api={listOrganization:async()=>{throw Error('offline')},listSchoolCourses:async()=>[]};`,s.c);
 await vm.runInContext('load()',s.c);
 assert.equal(vm.runInContext('records.length',s.c),0);
 assert.equal(vm.runInContext('verified',s.c),false);
 assert.equal(vm.runInContext('query',s.c),'Sample');
 assert.match(s.root.innerHTML,/Search data could not be verified/);
 assert.doesNotMatch(s.root.innerHTML,/<strong>Sample project<\/strong>/);
});
test('Search sign-out during a pending refresh clears busy and ignores the old response',async()=>{
 const s=searchScreen();let resolve;
 s.c.pending=new Promise(r=>{resolve=r;});
 vm.runInContext(`api={listOrganization:()=>pending,listSchoolCourses:async()=>[]};query='Old query';section='Work';`,s.c);
 const loading=vm.runInContext('load()',s.c);await turn();
 s.handlers.click[0]({target:{id:'search-signout'}});
 assert.equal(vm.runInContext('busy',s.c),false);
 assert.equal(vm.runInContext('section',s.c),'all');
 resolve([]);await loading;
 assert.equal(vm.runInContext('user',s.c),null);
 assert.equal(vm.runInContext('verified',s.c),false);
 assert.match(s.root.innerHTML,/Sign in to Search QA/);
});
test('Search honestly labels the displayed result limit and removes obsolete fetch caps',()=>{
 const s=searchScreen();s.c.fixtures=Array.from({length:81},(_,i)=>({id:String(i),owner_id:owner,visibility:'private',household_id:null,section:'Work',item_type:'project',payload:{title:'Sample '+i,fictional:true}}));
 vm.runInContext(`records=fixtures;query='Sample';verified=true;render();`,s.c);
 assert.match(s.root.innerHTML,/Showing first 80 matching records/);
 assert.doesNotMatch(s.root.innerHTML,/250 organization records/);
});
test('Widget refresh is blocked while a layout save is in progress',async()=>{
 const s=widgetScreen();vm.runInContext(`layoutBusy=true;requestGeneration=4;api.listBriefRecords=async()=>{throw Error('must not fetch')}`,s.c);
 await vm.runInContext('load()',s.c);
 assert.equal(vm.runInContext('requestGeneration',s.c),4);
 assert.equal(vm.runInContext('layoutBusy',s.c),true);
});
test('Widget sign-out clears save state and prevents a pending token from starting requests',async()=>{
 const s=widgetScreen();let resolve;
 s.c.pending=new Promise(r=>{resolve=r;});
 vm.runInContext(`auth.getAccessToken=()=>pending;api.listWidgetLayouts=async()=>{throw Error('Must not send old-account request')}`,s.c);
 const saving=vm.runInContext('saveLayout()',s.c);await turn();
 s.handlers.click[0]({target:{closest:selector=>selector==='#workspace-signout'?{}:null}});
 assert.equal(vm.runInContext('layoutBusy',s.c),false);
 resolve('fixture');await saving;
 assert.equal(vm.runInContext('layoutMessage',s.c),'');
 assert.equal(vm.runInContext('user',s.c),null);
});
test('An acknowledged widget save with a missing or newer reread retains the draft',async()=>{
 for(const changed of [false,true]){
  const s=widgetScreen();s.c.confirmed={id,version:1,...widgets.makeWidgetLayoutRecord(widgets.defaultWidgetLayouts(),owner)};
  vm.runInContext(`let reads=0;api={listWidgetLayouts:async()=>++reads===1?[]:${changed?'[{...confirmed,version:2}]':'[]'},addWidgetLayout:async()=>[confirmed]};`,s.c);
  await vm.runInContext('saveLayout()',s.c);
  assert.equal(vm.runInContext('layoutDirty',s.c),true);
  assert.equal(vm.runInContext('layoutBusy',s.c),false);
  assert.match(vm.runInContext('layoutMessage',s.c),/draft is retained/);
 }
});
test('A verified widget reread accepts the confirmed revision and clears the draft',async()=>{
 const s=widgetScreen();s.c.confirmed={id,version:1,...widgets.makeWidgetLayoutRecord(widgets.defaultWidgetLayouts(),owner)};
 vm.runInContext(`let reads=0;api={listWidgetLayouts:async()=>++reads===1?[]:[confirmed],addWidgetLayout:async()=>[confirmed]};`,s.c);
 await vm.runInContext('saveLayout()',s.c);
 assert.equal(vm.runInContext('layoutDirty',s.c),false);
 assert.equal(vm.runInContext('layoutBusy',s.c),false);
 assert.equal(vm.runInContext('layoutRecord.version',s.c),1);
});
test('uncertain widget writes keep the draft and block repeat saves until a verified latest load',async()=>{
 const s=widgetScreen();let writes=0;s.c.fixtureApi={listWidgetLayouts:async()=>[],addWidgetLayout:async()=>{writes++;throw Error('Fictional lost acknowledgement');}};vm.runInContext('api=fixtureApi',s.c);
 await vm.runInContext('saveLayout()',s.c);await vm.runInContext('saveLayout()',s.c);assert.equal(writes,1);assert.equal(vm.runInContext('layoutDirty',s.c),true);assert.equal(vm.runInContext('layoutNeedsReview',s.c),true);
});
test('widget acknowledgement with different content cannot discard the submitted draft',async()=>{
 const s=widgetScreen(),different=widgets.defaultWidgetLayouts();different.desktop=[];s.c.confirmed={id,version:1,...widgets.makeWidgetLayoutRecord(different,owner)};vm.runInContext('api={listWidgetLayouts:async()=>[],addWidgetLayout:async()=>[confirmed]}',s.c);
 await vm.runInContext('saveLayout()',s.c);assert.equal(vm.runInContext('layoutDirty',s.c),true);assert.equal(vm.runInContext('layoutNeedsReview',s.c),true);assert.match(vm.runInContext('layoutMessage',s.c),/did not match/);
});
test('workspace sign-out while obtaining a load token prevents every old-account read',async()=>{
 const s=widgetScreen();let release,reads=0;s.c.fixtureAuth={getAccessToken:()=>new Promise(resolve=>release=resolve),signOut:async()=>{}};s.c.fixtureApi=new Proxy({},{get:()=>async()=>{reads++;return[];}});vm.runInContext('auth=fixtureAuth;api=fixtureApi',s.c);const pending=vm.runInContext('load()',s.c);await turn();
 // Sign-out is intentionally disabled during a load; an external session clear invalidates this generation.
 vm.runInContext('requestGeneration++;user=null;loading=false;snapshot=null',s.c);release('fixture');await pending;assert.equal(reads,0);
});
