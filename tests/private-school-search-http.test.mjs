// Fictional in-process HTTP acceptance; no listeners, configuration or providers.
import test from 'node:test';import assert from 'node:assert/strict';
import {createPrivateSessionHttp} from '../server/private-workspace-session-http.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now=Date.parse('2026-11-17T12:00:00Z'),origin='http://127.0.0.1:5312';
const id=n=>'11111111-1111-4111-a111-'+String(n).padStart(12,'0');

async function setup(t,{projects=false,school=true,search=true,signed=true,saved=false}={}){
 const state={clock:now,active:true,reads:0,selected:0,writes:0,briefReads:0,rows:fixtures(),projects:[project()]};
 const api={signIn:async()=>({accessToken:'FICTIONAL_ACCESS_TOKEN',refreshToken:'FICTIONAL_REFRESH_TOKEN',expiresAt:now+3600000}),getUser:async()=>({id:owner,email:'demo@example.test'}),isSessionActive:async()=>state.active,signOutLocal:async()=>{},refreshSession:async()=>{throw Error('Unexpected refresh');},listPrivateBriefRecords:async()=>{state.briefReads++;return structuredClone(state.briefRows??[]);},listPrivateSchoolSummaries:async()=>{state.reads++;return structuredClone(state.rows).map(r=>{for(const key of ['notes','assessments','studySessions'])delete r.payload[key];return r;});},getPrivateSchoolRecord:async(_token,selected,who)=>{assert.equal(who,owner);state.selected++;return structuredClone(state.rows.filter(r=>r.id===selected));}};
 Object.assign(api,{listPrivateProjects:async()=>{state.reads++;return structuredClone(state.projects);},getPrivateProject:async(_token,key)=>{state.selected++;return structuredClone(state.projects.filter(r=>r.id===key));},addPrivateProject:async()=>{state.writes++;throw Error('Unexpected insert');},updatePrivateProject:async()=>{state.writes++;throw Error('Unexpected update');}});
 if(saved){for(const name of ['getPrivateTask','completePrivateTask','getPrivateTaskDetails','addFictionalTask','updatePrivateTask','reopenPrivateTask','addPrivateSavedSearch','updatePrivateSavedSearch','setPrivateSavedSearchDeletedAt'])api[name]=async()=>{throw Error('Unexpected unrelated operation');};api.listPrivateSavedSearches=async()=>structuredClone(state.savedRows??[]);api.getPrivateSavedSearch=async(_token,key)=>structuredClone((state.savedRows??[]).filter(r=>r.id===key));}
 const router=createPrivateSessionHttp({origin,api,now:()=>state.clock,allowBriefRead:true,allowSchoolRead:school,allowSearch:search,allowProjects:projects,allowSavedSearches:saved,...(saved?{allowTaskPriorityLists:true,allowSearchDates:true,allowUndatedTasks:true,allowTaskCreate:true,allowTaskRead:true,allowTaskDescriptionEdit:true,allowTaskEdit:true,allowTaskCompletion:true,allowTaskReopen:true}:{})});t.after(()=>router.dispose());let cookie='',csrf='';
 async function call(path,body,extra={},method=body===undefined?'GET':'POST'){
  const req={url:'/auth/workspace/'+path,method,headers:{host:'127.0.0.1:5312',origin,cookie,'content-type':'application/json','x-cc-request':'workspace-session','x-cc-csrf':csrf,...extra},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},res={writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(body){this.body=body;}};
  assert.equal(await router.handle(req,res),true);const data=JSON.parse(res.body);if(res.headers['Set-Cookie'])cookie=res.headers['Set-Cookie'].split(';')[0];if(data.csrf)csrf=data.csrf;return{status:res.status,data,text:res.body};
 }
 await call('status');if(signed)assert.equal((await call('login',{email:'demo@example.test',password:'fictional-only'})).status,200);
 return{api,state,call,list:(patch={})=>call('search',{query:'',type:'school',section:'all',status:'all',offset:0,...patch}),read:schoolReadToken=>call('search/school-read',{schoolReadToken})};
}
import {makeSchoolDegree,makeSchoolCourse} from '../src/dev-school-model.mjs';
const stamp='2026-11-17T12:00:00.000001Z';
function fixtures(){const meta=(r,n)=>({...r,id:id(n),version:1,deleted_at:null,created_at:stamp,updated_at:stamp});return [meta(makeSchoolDegree(owner,{title:'Fictional degree',progressMetric:'terms'}),1),meta(makeSchoolCourse(owner,{title:'First course',degreeId:id(1),term:'Term 1',status:'Completed',credits:3,officialOrder:4,studyOrder:1,notes:'PRIVATE_NOTES',assessments:[{title:'PRIVATE_ASSESSMENT',tasks:[{title:'PRIVATE_STEP',done:true}]}],studySessions:[{day:'2026-11-17',time:'10:00',title:'PRIVATE_STUDY'}]}),2),meta(makeSchoolCourse(owner,{title:'Second course',degreeId:id(1),term:'Term 1',status:'In Progress',credits:4,officialOrder:1,studyOrder:4}),3)];}
function project(){return{id:id(20),owner_id:owner,household_id:null,visibility:'private',section:'Home',item_type:'project',origin:'PRIVATE_COOKIE_PROJECT',version:1,deleted_at:null,created_at:stamp,updated_at:stamp,payload:{fictional:true,schemaVersion:1,title:'Fictional common project',status:'Active',description:'PRIVATE_PROJECT_BODY',separateRecurring:false}};}
test('School search requires explicit School and search scopes, with no hidden source reads when disabled',async t=>{
 const off=await setup(t,{school:false});assert.equal((await off.list()).status,409);assert.equal((await off.read('a'.repeat(43))).status,404);assert.equal(off.state.reads,0);const all=await off.list({type:'all',query:'Fictional'});assert.equal(all.status,200);assert.equal(off.state.reads,0);
 const noSearch=await setup(t,{search:false});assert.equal((await noSearch.list()).status,404);assert.equal((await noSearch.read('a'.repeat(43))).status,404);assert.equal(noSearch.state.reads,0);
 const guest=await setup(t,{signed:false});assert.equal((await guest.list()).status,401);assert.equal(guest.state.reads,0);
});
test('School search and selected reads enforce CSRF, exact token body and no scope injection',async t=>{
 const s=await setup(t);for(const path of ['search','search/school-read'])for(const headers of [{origin:'https://outside.example.test'},{host:'outside.test'},{'x-cc-csrf':'bad'},{'x-cc-request':undefined},{'content-type':'text/plain'}])assert.equal((await s.call(path,{},headers)).status,403);
 for(const patch of [{owner_id:owner},{payload:{}},{type:'school_fixture'},{section:'Calendar'},{offset:6000}])assert.equal((await s.list(patch)).status,409);
 for(const body of [{},{schoolReadToken:'bad'},{schoolReadToken:'a'.repeat(43),id:id(2)}])assert.equal((await s.call('search/school-read',body)).status,409);assert.equal(s.state.reads,0);assert.equal(s.state.selected,0);
});
test('explicit School title search returns source summaries only and opens private bodies only after selection',async t=>{
 const s=await setup(t),before=structuredClone(s.state.rows),result=await s.list({query:'First course'});assert.equal(result.status,200);assert.equal(result.data.matchCount,1);const row=result.data.results[0];assert.equal(row.type,'school');assert.equal(row.title,'First course');assert.equal(row.section,'School');assert.match(row.schoolReadToken,/^[A-Za-z0-9_-]{43}$/);assert.equal(s.state.reads,1);assert.equal(s.state.briefReads,0);assert.equal(s.state.selected,0);assert.doesNotMatch(result.text,/PRIVATE_|notes|assessments|studySessions|owner_id|payload|degreeId|11111111/);
 const body=await s.read(row.schoolReadToken);assert.equal(body.status,200);assert.equal(body.data.notes,'PRIVATE_NOTES');assert.equal(body.data.readOnly,true);assert.equal(s.state.selected,1);assert.equal(s.state.writes,0);assert.deepEqual(s.state.rows,before);
});
test('typed ordinary searches do not fetch School and title matching does not inspect course bodies',async t=>{
 const s=await setup(t);assert.equal((await s.list({type:'task',query:'Fictional'})).status,200);assert.equal(s.state.reads,0);const bodyOnly=await s.list({query:'PRIVATE_NOTES'});assert.equal(bodyOnly.status,200);assert.equal(bodyOnly.data.matchCount,0);assert.equal(s.state.selected,0);assert.equal(s.state.writes,0);
});
test('School title source empty is distinct from foreign, duplicate and future-schema failure',async t=>{
 const s=await setup(t);s.state.rows=[];const empty=await s.list();assert.equal(empty.status,200);assert.equal(empty.data.matchCount,0);for(const invalid of [[{...fixtures()[0],owner_id:other}],[fixtures()[0],fixtures()[0]],[{...fixtures()[0],payload:{...fixtures()[0].payload,schemaVersion:2}}]]){s.state.rows=invalid;const bad=await s.list();assert.equal(bad.status,409);assert.doesNotMatch(bad.text,/PRIVATE_|Fictional degree|11111111/);}s.api.listPrivateSchoolSummaries=async()=>{throw Error('PRIVATE_SOURCE_FAILURE');};assert.equal((await s.list()).status,409);
});
test('School search capability has no overview-edit or ordinary project authority and reverse handles are rejected',async t=>{
 const s=await setup(t),result=await s.list({query:'First course'}),token=result.data.results[0].schoolReadToken;for(const [path,body]of [['school/read',{schoolReadToken:token}],['school/edit-read',{schoolReadToken:token}],['projects/read',{projectToken:token}],['tasks/read',{taskReadToken:token}]])assert.ok([404,409].includes((await s.call(path,body)).status));const overview=await s.call('school/overview',{});assert.equal(overview.status,200);assert.equal((await s.read(overview.data.courses[0].schoolReadToken)).status,409);assert.equal(s.state.writes,0);
});
test('School search selected reads reject exact source drift and expired handles without body leaks',async t=>{
 for(const change of [s=>s.state.rows[1].version++,s=>s.state.rows[1].updated_at='2026-11-17T12:00:00.000002Z',s=>s.state.rows[1].owner_id=other,s=>s.state.rows[1].deleted_at=stamp,s=>s.state.clock+=300001]){const s=await setup(t),result=await s.list({query:'First course'});assert.equal(result.status,200);change(s);const bad=await s.read(result.data.results[0].schoolReadToken);assert.equal(bad.status,409);assert.doesNotMatch(bad.text,/PRIVATE_|First course|11111111/);assert.equal(s.state.writes,0);}
});
test('later searches, revocation and logout suppress late selected School bodies',async t=>{
 for(const mode of ['search','logout','revoke']){const s=await setup(t),list=await s.list({query:'First course'});assert.equal(list.status,200);let release;s.api.getPrivateSchoolRecord=()=>new Promise(resolve=>release=()=>resolve([fixtures()[1]]));const pending=s.read(list.data.results[0].schoolReadToken);while(!release)await new Promise(resolve=>setImmediate(resolve));if(mode==='search')assert.equal((await s.list({type:'note',query:'Different'})).status,200);else if(mode==='logout')assert.equal((await s.call('logout',{})).status,200);else s.state.active=false;release();const bad=await pending;assert.equal(bad.status,409);assert.doesNotMatch(bad.text,/PRIVATE_|First course|11111111/);}
});
test('School search does not clear project save authority when source requests are blocked during a pending write',async t=>{
 const s=await setup(t,{projects:true}),list=await s.call('projects/list',{});assert.equal(list.status,200);const projectToken=list.data.projects[0].projectToken,review=await s.call('projects/review',{action:'edit',projectToken,fields:{title:'Fictional edited project',description:'PRIVATE_PROJECT_BODY',section:'Home',status:'Active',separateRecurring:false}});assert.equal(review.status,200);let release;s.api.updatePrivateProject=()=>new Promise(resolve=>release=()=>{s.state.writes++;resolve([]);});const pending=s.call('projects/save',{reviewId:review.data.reviewId,approved:true});while(!release)await new Promise(resolve=>setImmediate(resolve));const before=s.state.reads;assert.equal((await s.list()).status,409);assert.equal((await s.read('a'.repeat(43))).status,409);assert.equal(s.state.reads,before);release();assert.equal((await pending).status,503);assert.equal(s.state.writes,1);
});
test('School search issues at most the displayed fifty capabilities and invalidates replaced pages',async t=>{
 const s=await setup(t),template=fixtures()[1];s.state.rows=Array.from({length:53},(_,index)=>({...structuredClone(template),id:id(100+index),payload:{...structuredClone(template.payload),title:'Fictional paged course '+String(index).padStart(2,'0')}}));const first=await s.list();assert.equal(first.status,200);assert.equal(first.data.results.length,50);assert.equal(first.data.matchCount,53);const token=first.data.results[0].schoolReadToken;const next=await s.list({offset:50});assert.equal(next.status,200);assert.equal(next.data.results.length,3);assert.equal((await s.read(token)).status,409);assert.equal(s.state.selected,0);assert.equal(s.state.writes,0);
});
test('an older slow search cannot invalidate a newer displayed School capability',async t=>{
 const s=await setup(t),read=s.api.listPrivateSchoolSummaries;let release,first=true;s.api.listPrivateSchoolSummaries=(...args)=>{if(first){first=false;return new Promise(resolve=>release=async()=>resolve(await read(...args)));}return read(...args);};const old=s.list({query:'First course'});while(!release)await new Promise(resolve=>setImmediate(resolve));const newer=await s.list({query:'Second course'});assert.equal(newer.status,200);const token=newer.data.results[0].schoolReadToken;await release();const stale=await old;assert.equal(stale.status,409);const details=await s.read(token);assert.equal(details.status,200);assert.equal(details.data.title,'Second course');
});
test('saved School shortcut cannot be loaded or run when School source scope is disabled',async t=>{
 const s=await setup(t,{school:false,saved:true});s.state.savedRows=[{id:id(300),owner_id:owner,household_id:null,visibility:'private',section:'Personal Life',item_type:'saved_search',origin:'PRIVATE_COOKIE_SAVED_SEARCH',version:1,created_at:stamp,updated_at:stamp,deleted_at:null,payload:{fictional:true,source:'PRIVATE_SAVED_SEARCH_V1',schemaVersion:1,title:'Fictional School shortcut',filters:{query:'course',type:'school',section:'School',status:'all',priority:'all',dateFrom:'',dateTo:'',dateStatus:'all'}}}];const list=await s.call('saved-searches/list',{});assert.equal(list.status,200);assert.equal(list.data.records.length,1);const denied=await s.call('saved-searches/load',{savedSearchToken:list.data.records[0].savedSearchToken});assert.equal(denied.status,409);assert.equal((await s.call('search',s.state.savedRows[0].payload.filters)).status,409);assert.equal(s.state.reads,0);assert.equal(s.state.selected,0);assert.equal(s.state.writes,0);
});
test('a Brief refresh supersedes pending School search before new capabilities are issued',async t=>{
 const s=await setup(t);let release;s.api.listPrivateSchoolSummaries=()=>new Promise(resolve=>release=()=>resolve(fixtures()));const pending=s.list({query:'course'});while(!release)await new Promise(resolve=>setImmediate(resolve));assert.equal((await s.call('brief')).status,200);release();const late=await pending;assert.equal(late.status,409);assert.doesNotMatch(late.text,/PRIVATE_|First course|schoolReadToken|11111111/);assert.equal(s.state.selected,0);assert.equal(s.state.writes,0);
});

function workList(n,name,filters={}){
 return{id:id(n),owner_id:owner,household_id:null,visibility:'private',section:'Personal Life',item_type:'saved_search',origin:'PRIVATE_COOKIE_SAVED_SEARCH',version:1,created_at:stamp,deleted_at:null,payload:{fictional:true,source:'PRIVATE_SAVED_SEARCH_V1',schemaVersion:1,title:name,filters:{query:'',type:'task',section:'Work',status:'all',priority:'all',dateFrom:'',dateTo:'',dateStatus:'all',...filters}}};
}
function workTask(n,title,changes={}){
 return{id:id(n),owner_id:owner,household_id:null,visibility:'private',section:'Work',item_type:'task',origin:'PRIVATE_COOKIE_TASK',version:1,created_at:stamp,deleted_at:null,payload:{fictional:true,title,done:false,description:'Private original '+n,...changes}};
}
test('named Work lists combine overlapping original tasks, keep separate tasks with equal titles and open exact originals',async t=>{
 const s=await setup(t,{school:false,saved:true});
 s.state.savedRows=[workList(1,'Open',{status:'open'}),workList(2,'Follow-ups',{query:'follow'}),workList(3,'Home',{section:'Home'}),workList(4,'Notes',{section:'all',type:'note'})];
 s.state.briefRows=[workTask(10,'Follow up'),workTask(11,'Follow up',{done:true}),workTask(12,'Check schedule',{day:'2026-11-18'}),workTask(13,'Completed paperwork',{done:true}),{...workTask(14,'Follow home'),section:'Home'}];
 s.api.getPrivateTaskDetails=async(_token,key,who)=>{assert.equal(who,owner);return structuredClone(s.state.briefRows.filter(r=>r.id===key));};
 const catalog=await s.call('saved-searches/work-lists',{});assert.equal(catalog.status,200);assert.deepEqual(catalog.data.lists.map(x=>x.name),['Follow-ups','Open']);assert.doesNotMatch(catalog.text,/11111111|Private original|filters/);
 const request={choices:catalog.data.lists.map(r=>r.choice),expiresAt:catalog.data.expiresAt};
 const result=await s.call('search/work-tasks',request);assert.equal(result.status,200);assert.equal(result.data.matchCount,3);assert.equal(result.data.workListCount,2);assert.equal(result.data.saveSearchToken,undefined);assert.doesNotMatch(result.text,/Private original|11111111/);
 const followups=result.data.results.filter(r=>r.title==='Follow up');assert.equal(followups.length,2);assert.notEqual(followups[0].taskReadToken,followups[1].taskReadToken);
 const detail=await s.call('tasks/read',{taskReadToken:followups[1].taskReadToken});assert.equal(detail.status,200);assert.equal(detail.data.description,'Private original 11');assert.equal(s.state.writes,0);
 s.state.savedRows[0].version++;assert.equal((await s.call('search/work-tasks',request)).status,409);
});
test('Work list pages retain choices across pages and expire with the view and session',async t=>{
 const s=await setup(t,{school:false,saved:true});s.state.savedRows=Array.from({length:52},(_,i)=>workList(i+1,'List '+String(i).padStart(2,'0'),{priority:'High',dateFrom:'2026-11-01',dateTo:'2026-11-30'}));
 s.state.briefRows=Array.from({length:54},(_,i)=>workTask(100+i,'Task '+i,{day:'2026-11-18',priority:'High'}));s.state.briefRows.push(workTask(201,'Undated high',{priority:'High'}),workTask(202,'Earlier high',{priority:'High',day:'2026-10-12'}),workTask(203,'Normal',{day:'2026-11-18'}));
 const first=(await s.call('saved-searches/work-lists',{})).data;assert.equal(first.lists.length,50);
 const second=(await s.call('saved-searches/work-lists',{offset:50,expiresAt:first.expiresAt})).data;assert.equal(second.lists.length,2);
 const selection={choices:[first.lists[0].choice,second.lists[0].choice],expiresAt:first.expiresAt};
 const combined=await s.call('search/work-tasks',selection);assert.equal(combined.status,200);assert.equal(combined.data.matchCount,54);assert.equal(combined.data.results.length,50);
 const last=await s.call('search/work-tasks',{...selection,offset:50});assert.equal(last.status,200);assert.equal(last.data.results.length,4);
 for(const invalid of [{choices:[]},{choices:[selection.choices[0],selection.choices[0]]},{choices:[id(1)]},{expiresAt:first.expiresAt+1},{section:'Home'}])assert.equal((await s.call('search/work-tasks',{...selection,...invalid})).status,409);
 s.state.clock=first.expiresAt;assert.equal((await s.call('search/work-tasks',selection)).status,409);
 const off=await setup(t,{saved:false});assert.equal((await off.call('saved-searches/work-lists',{})).status,404);assert.equal((await off.call('search/work-tasks',selection)).status,404);
});
