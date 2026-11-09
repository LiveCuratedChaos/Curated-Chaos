import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as intelligence from '../src/dev-intelligence-model.mjs';
import {dayString,escapeHtml} from '../src/core.mjs';
import * as brief from '../src/dev-brief-model.mjs';
import * as preferences from '../src/dev-preferences-model.mjs';
import * as decisions from '../src/dev-decision-model.mjs';
import {lifeSuggestions,normalizeFictionalLife} from '../src/dev-life-model.mjs';
import {emailSuggestions,normalizeFictionalEmails} from '../src/dev-email-model.mjs';
import {cloudFreshness} from '../src/dev-sync-model.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function screen(){
 const listeners={},root={addEventListener:(name,fn)=>listeners[name]=fn};
 const source=readFileSync(new URL('../src/dev-brief.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').split('// M1G: best-effort')[0];
 const context=vm.createContext({dayString,e:escapeHtml,...intelligence,...brief,...preferences,...decisions,lifeSuggestions,normalizeFictionalLife,emailSuggestions,normalizeFictionalEmails,cloudFreshness,document:{getElementById:()=>root,body:{dataset:{}}},window:{},sessionStorage:{removeItem(){},setItem(){}},FormData:class{constructor(form){this.values=form.values;}get(key){return this.values[key];}entries(){return Object.entries(this.values);}},Date});
 vm.runInContext(source,context);vm.runInContext(`render=()=>{};user={id:'${owner}'};session={};auth={get:()=>session,getAccessToken:async()=>'fixture'};api={listBriefRecords:async()=>[],listSuggestionDecisions:async()=>[],listFictionalEmails:async()=>[],listFictionalLife:async()=>[],listBriefPreferences:async()=>[]};lastSuccessAt=Date.now();`,context);
 return{context,listeners};
}
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};};
test('brief refresh cancelled during token retrieval starts no old-account reads',async()=>{
 const s=screen(),wait=deferred();let reads=0;s.context.wait=wait;s.context.read=()=>{reads++;return[];};vm.runInContext('auth.getAccessToken=()=>wait.promise;api.listBriefRecords=read',s.context);
 const pending=vm.runInContext('load()',s.context);vm.runInContext('blank()',s.context);wait.resolve('fixture-old');await pending;assert.equal(reads,0);assert.equal(vm.runInContext('lastSuccessAt',s.context),0);
});
test('brief task save cannot start after sign-out during token retrieval',async()=>{
 const s=screen(),wait=deferred();let writes=0;s.context.wait=wait;s.context.write=()=>{writes++;return[{}];};vm.runInContext('auth.getAccessToken=()=>wait.promise;api.addFictionalTask=write',s.context);
 const pending=s.listeners.submit({target:{id:'brief-add-task',values:{title:'Fictional',day:'2026-11-08',section:'School'}},preventDefault(){}});vm.runInContext('blank()',s.context);wait.resolve('old-fixture');await pending;assert.equal(writes,0);
});
test('confirmed brief task save retains a subsequent reload error',async()=>{
 const s=screen();vm.runInContext("api.addFictionalTask=async()=>[{}];api.listBriefRecords=async()=>{throw Error('reload fixture failed')}",s.context);
 await s.listeners.submit({target:{id:'brief-add-task',values:{title:'Fictional',day:'2026-11-08',section:'School'}},preventDefault(){}});
 assert.match(vm.runInContext('error',s.context),/reload fixture failed/);assert.equal(vm.runInContext('notice',s.context),'');assert.equal(vm.runInContext('busy',s.context),false);assert.equal(vm.runInContext('canWrite()',s.context),false);
});
test('offline replacement refresh clears busy and failed normalization never partially replaces prior snapshot',async()=>{
 const s=screen();vm.runInContext('busy=true;simulateOutage=true',s.context);await vm.runInContext('load()',s.context);assert.equal(vm.runInContext('busy',s.context),false);
 vm.runInContext("simulateOutage=false;records={tasks:[{id:'previous-fixture'}],notes:[],events:[]};readOwnerBriefPreferences=()=>({preferences:{palette:'changed-fixture'}});normalizeFictionalEmails=()=>{throw Error('invalid fixture')}",s.context);await vm.runInContext('load()',s.context);
 assert.equal(vm.runInContext('records.tasks[0].id',s.context),'previous-fixture');assert.notEqual(vm.runInContext('preferences.palette',s.context),'changed-fixture');assert.equal(vm.runInContext('refreshFailed',s.context),true);
});
test('brief quick-add retains drafts across validation, uncertain saves and refresh; sign-out clears them',async()=>{
 const s=screen(),values={title:'   ',day:'',section:'School'};await s.listeners.submit({target:{id:'brief-add-task',values},preventDefault(){}});assert.equal(vm.runInContext('taskDraft.day',s.context),'');await vm.runInContext('load()',s.context);assert.equal(vm.runInContext('taskDraft.title',s.context),'   ');
 vm.runInContext('api.addFictionalTask=async()=>[]',s.context);await s.listeners.submit({target:{id:'brief-add-task',values:{title:'Keep <draft>',day:'2026-11-08',section:'School'}},preventDefault(){}});assert.equal(vm.runInContext('taskDraft.title',s.context),'Keep <draft>');assert.match(vm.runInContext('error',s.context),/Check Tasks before retrying/);vm.runInContext('blank()',s.context);assert.equal(vm.runInContext('taskDraft.title',s.context),'');
});
test('confirmed brief task save clears only the submitted draft and preserves edits typed while waiting',async()=>{
 for(const edit of [false,true]){
  const s=screen(),wait=deferred();s.context.wait=wait;vm.runInContext('api.addFictionalTask=()=>wait.promise',s.context);const pending=s.listeners.submit({target:{id:'brief-add-task',values:{title:'Submitted fixture',day:'2026-11-08',section:'School'}},preventDefault(){}});await Promise.resolve();
  if(edit)s.listeners.input({target:{name:'title',value:'New draft while waiting',closest:()=>({id:'brief-add-task'})}});
  wait.resolve([{}]);await pending;assert.equal(vm.runInContext('taskDraft.title',s.context),edit?'New draft while waiting':'');
 }
});
function openReview(s){s.context.suggestion={id:'fixture-review',emailId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',sourceVersion:1,source:'email',rule:'email_to_task',title:'Original fixture',day:'2026-11-09',section:'School',reason:'Fictional source'};vm.runInContext('allSuggestions=()=>[suggestion]',s.context);return s.listeners.click({target:{closest:selector=>selector==='[data-review]'?{dataset:{review:'fixture-review'}}:null}});}
test('suggestion review retains edited fields through refresh and failed approval',async()=>{
 const s=screen();await openReview(s);s.listeners.input({target:{name:'title',value:'Edited <fixture>',closest:()=>({id:'sample-approve'})}});await vm.runInContext('load()',s.context);assert.equal(vm.runInContext('reviewDraft.title',s.context),'Edited <fixture>');assert.match(vm.runInContext('renderReviewModal({suggestions:[suggestion]})',s.context),/Edited &lt;fixture&gt;/);
 vm.runInContext("api.addFictionalTask=async()=>{throw Error('fictional approval offline')}",s.context);await s.listeners.submit({target:{id:'sample-approve',values:{suggestionId:'fixture-review',title:'Edited <fixture>',day:'2026-11-09',section:'School'}},preventDefault(){}});assert.equal(vm.runInContext('reviewDraft.title',s.context),'Edited <fixture>');assert.match(vm.runInContext('error',s.context),/approval offline/);
});
test('changed suggestion source blocks approval until review is reopened; close clears review edits',async()=>{
 const s=screen();await openReview(s);let writes=0;s.context.write=()=>{writes++;return[];};vm.runInContext("suggestion.title='Changed source fixture';api.addFictionalTask=write",s.context);await s.listeners.submit({target:{id:'sample-approve',values:{suggestionId:'fixture-review',title:'Edited fixture',day:'2026-11-09',section:'School'}},preventDefault(){}});assert.equal(writes,0);assert.match(vm.runInContext('error',s.context),/suggestion changed/);assert.match(vm.runInContext('renderReviewModal({suggestions:[suggestion]})',s.context),/source changed/);
 await s.listeners.click({target:{closest:selector=>selector==='#sample-cancel'?{}:null}});assert.equal(vm.runInContext('reviewDraft',s.context),null);
});
test('cleared review date or section cannot silently fall back to suggested values',()=>{
 const suggestion={rule:'email_to_task',day:'2026-11-09',section:'School'};for(const draft of [{title:'Fixture',day:'',section:'School'},{title:'Fixture',day:'2026-11-09',section:''}])assert.throws(()=>intelligence.validateSuggestedTask(suggestion,draft),/Check/);
});
test('enabled atomic approval calls only the transaction endpoint and never falls back after an error',async()=>{
 for(const succeeds of [false,true]){
  const s=screen();await openReview(s);let calls=0,legacy=0;s.context.approve=async args=>{calls++;assert.equal(args.sourceId,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');assert.equal(args.expectedVersion,1);if(!succeeds)throw Error('Atomic fixture unavailable');return{task_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',already_saved:false};};s.context.legacy=()=>{legacy++;throw Error('Legacy write must never run');};vm.runInContext('config={atomicFictionalApprovals:true};api.approveFictionalSuggestion=(_token,args)=>approve(args);api.addFictionalTask=legacy;api.addSuggestionDecision=legacy',s.context);
  await s.listeners.submit({target:{id:'sample-approve',values:{suggestionId:'fixture-review',title:'Edited fixture',day:'2026-11-09',section:'School'}},preventDefault(){}});assert.equal(calls,1);assert.equal(legacy,0);assert.equal(vm.runInContext('reviewDraft===null',s.context),succeeds);if(!succeeds)assert.match(vm.runInContext('error',s.context),/Atomic fixture unavailable/);
 }
});
