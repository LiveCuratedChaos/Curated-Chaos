// Fictional in-process HTTP acceptance; no listeners, configuration or providers.
import test from 'node:test';import assert from 'node:assert/strict';
import {createPrivateSessionHttp} from '../server/private-workspace-session-http.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now=Date.parse('2026-11-17T12:00:00Z'),origin='http://127.0.0.1:5312';
const id=n=>'11111111-1111-4111-a111-'+String(n).padStart(12,'0');

async function setup(t,{projects=true,school=true,signed=true,editing=false}={}){
 const state={clock:now,active:true,reads:0,selected:0,writes:0,rows:fixtures(),projects:[project()]};
 const api={signIn:async()=>({accessToken:'FICTIONAL_ACCESS_TOKEN',refreshToken:'FICTIONAL_REFRESH_TOKEN',expiresAt:now+3600000}),getUser:async()=>({id:owner,email:'demo@example.test'}),isSessionActive:async()=>state.active,signOutLocal:async()=>{},refreshSession:async()=>{throw Error('Unexpected refresh');},listPrivateBriefRecords:async()=>[],listPrivateSchoolSummaries:async()=>{state.reads++;return structuredClone(state.rows).map(r=>{for(const key of ['notes','assessments','studySessions'])delete r.payload[key];return r;});},getPrivateSchoolRecord:async(_token,selected,who)=>{assert.equal(who,owner);state.selected++;return structuredClone(state.rows.filter(r=>r.id===selected));}};
 Object.assign(api,{listPrivateProjects:async()=>{state.reads++;return structuredClone(state.projects);},getPrivateProject:async(_token,key)=>{state.selected++;return structuredClone(state.projects.filter(r=>r.id===key));},addPrivateProject:async()=>{state.writes++;throw Error('Unexpected insert');},updatePrivateProject:async()=>{state.writes++;throw Error('Unexpected update');}});
 if(editing){api.updatePrivateSchoolMetadata=async(_token,prior,who,payload)=>{assert.equal(who,owner);const index=state.rows.findIndex(r=>r.id===prior.id&&r.version===prior.version);if(index<0)return[];state.writes++;state.rows[index]={...state.rows[index],payload:structuredClone(payload),version:prior.version+1};return[structuredClone(state.rows[index])];};api.updatePrivateProject=async(_token,prior,who,proposed)=>{assert.equal(who,owner);const index=state.projects.findIndex(r=>r.id===prior.id&&r.version===prior.version);if(index<0)return[];state.writes++;state.projects[index]={...state.projects[index],section:proposed.section,payload:structuredClone(proposed.payload),version:prior.version+1};return[structuredClone(state.projects[index])];};}
 const router=createPrivateSessionHttp({origin,api,now:()=>state.clock,allowBriefRead:true,allowSchoolRead:school,allowSchoolEdit:editing,allowProjects:projects});t.after(()=>router.dispose());let cookie='',csrf='';
 async function call(path,body,extra={},method=body===undefined?'GET':'POST'){
  const req={url:'/auth/workspace/'+path,method,headers:{host:'127.0.0.1:5312',origin,cookie,'content-type':'application/json','x-cc-request':'workspace-session','x-cc-csrf':csrf,...extra},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},res={writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(body){this.body=body;}};
  assert.equal(await router.handle(req,res),true);const data=JSON.parse(res.body);if(res.headers['Set-Cookie'])cookie=res.headers['Set-Cookie'].split(';')[0];if(data.csrf)csrf=data.csrf;return{status:res.status,data,text:res.body};
 }
 await call('status');if(signed)assert.equal((await call('login',{email:'demo@example.test',password:'fictional-only'})).status,200);
 return{api,state,call,list:(patch={})=>call('projects/references-list',{query:'',kind:'all',section:'all',offset:0,...patch}),read:referenceReadToken=>call('projects/references-read',{referenceReadToken})};
}
import {makeSchoolDegree,makeSchoolCourse} from '../src/dev-school-model.mjs';
const stamp='2026-11-17T12:00:00.000001Z';
function fixtures(){const meta=(r,n)=>({...r,id:id(n),version:1,deleted_at:null,created_at:stamp,updated_at:stamp});return [meta(makeSchoolDegree(owner,{title:'Fictional degree',progressMetric:'terms'}),1),meta(makeSchoolCourse(owner,{title:'First course',degreeId:id(1),term:'Term 1',status:'Completed',credits:3,officialOrder:4,studyOrder:1,notes:'PRIVATE_NOTES',assessments:[{title:'PRIVATE_ASSESSMENT',tasks:[{title:'PRIVATE_STEP',done:true}]}],studySessions:[{day:'2026-11-17',time:'10:00',title:'PRIVATE_STUDY'}]}),2),meta(makeSchoolCourse(owner,{title:'Second course',degreeId:id(1),term:'Term 1',status:'In Progress',credits:4,officialOrder:1,studyOrder:4}),3)];}
function project(){return{id:id(20),owner_id:owner,household_id:null,visibility:'private',section:'Home',item_type:'project',origin:'PRIVATE_COOKIE_PROJECT',version:1,deleted_at:null,created_at:stamp,updated_at:stamp,payload:{fictional:true,schemaVersion:1,title:'Fictional common project',status:'Active',description:'PRIVATE_PROJECT_BODY',separateRecurring:false}};}
test('common references require both explicit source scopes and sign-in',async t=>{
 for(const flags of [{projects:false},{school:false},{projects:false,school:false}]){const s=await setup(t,flags);assert.equal((await s.list()).status,404);assert.equal(s.state.reads,0);}const s=await setup(t,{signed:false});assert.equal((await s.list()).status,401);assert.equal(s.state.reads,0);
});
test('common references enforce exact controls, POST, same-origin and CSRF before source access',async t=>{
 const s=await setup(t),body={query:'',kind:'all',section:'all',offset:0};for(const headers of [{origin:'https://outside.example.test'},{host:'outside.test'},{'x-cc-csrf':'bad'},{'x-cc-request':undefined},{'content-type':'text/plain'}])assert.equal((await s.call('projects/references-list',body,headers)).status,403);assert.equal((await s.call('projects/references-list',undefined)).status,404);
 for(const patch of [{kind:'task'},{section:'Calendar'},{offset:-1},{offset:0.5},{owner_id:owner},{query:null}])assert.equal((await s.list(patch)).status,409);
 for(const value of [{},{referenceReadToken:'bad'},{referenceReadToken:'a'.repeat(43),id:id(20)}])assert.equal((await s.call('projects/references-read',value)).status,409);assert.equal(s.state.reads,0);assert.equal(s.state.selected,0);
});
test('common reference lists preserve source-specific status without exposing or combining bodies',async t=>{
 const s=await setup(t),before=structuredClone([s.state.projects,s.state.rows]),list=await s.list();assert.equal(list.status,200);assert.equal(list.data.matchCount,4);assert.equal(list.data.readOnly,true);assert.equal(list.data.providerRead,false);assert.equal(s.state.selected,0);assert.doesNotMatch(list.text,/PRIVATE_|description|notes|assessments|studySessions|owner_id|payload|11111111/);
 const ordinary=list.data.records.find(r=>r.sourceKind==='project'),course=list.data.records.find(r=>r.sourceKind==='school-course'),degree=list.data.records.find(r=>r.sourceKind==='school-degree');assert.equal(ordinary.manualStatus,'Active');assert.equal(ordinary.academicStatus,null);assert.equal(course.manualStatus,null);assert.equal(course.academicStatus,'Completed');assert.equal(degree.manualStatus,null);assert.equal(degree.academicStatus,null);
 const body=await s.read(ordinary.referenceReadToken);assert.equal(body.status,200);assert.equal(body.data.record.description,'PRIVATE_PROJECT_BODY');assert.equal(body.data.readOnly,true);assert.equal(body.data.sourceKind,'project');
 const school=await s.read(course.referenceReadToken);assert.equal(school.status,200);assert.equal(school.data.record.notes,'PRIVATE_NOTES');assert.equal(school.data.sourceKind,'school-course');assert.equal(s.state.writes,0);assert.deepEqual([s.state.projects,s.state.rows],before);
});
test('common references filter kind, section and title with no invented record copies',async t=>{
 const s=await setup(t);for(const [patch,count]of [[{kind:'project'},1],[{kind:'school-degree'},1],[{kind:'school-course'},2],[{section:'Home'},1],[{query:'First course'},1],[{query:'PRIVATE_NOTES'},0]]){const list=await s.list(patch);assert.equal(list.status,200);assert.equal(list.data.matchCount,count);}assert.equal(s.state.selected,0);assert.equal(s.state.writes,0);
});
test('common capability cannot authorize ordinary project or School reads and reverse handles cannot authorize common reads',async t=>{
 const s=await setup(t),list=await s.list(),token=list.data.records.find(r=>r.sourceKind==='project').referenceReadToken;assert.equal((await s.call('projects/read',{projectToken:token})).status,409);assert.equal((await s.call('projects/review',{action:'edit',projectToken:token,fields:{title:'Unauthorized',description:'',section:'Home',status:'Active',separateRecurring:false}})).status,409);assert.equal((await s.call('school/read',{schoolReadToken:token})).status,409);
 const projects=await s.call('projects/list',{});assert.equal(projects.status,200);assert.equal((await s.read(projects.data.projects[0].projectToken)).status,409);
 const school=await s.call('school/overview',{});assert.equal(school.status,200);assert.equal((await s.read(school.data.courses[0].schoolReadToken)).status,409);assert.equal(s.state.writes,0);
});
test('common source empty is distinct from unavailable, foreign and deleted records',async t=>{
 const s=await setup(t);s.state.projects=[];s.state.rows=[];const empty=await s.list();assert.equal(empty.status,200);assert.equal(empty.data.matchCount,0);assert.deepEqual(empty.data.records,[]);
 for(const source of ['projects','rows'])for(const patch of [{owner_id:other},{deleted_at:stamp}]){s.state.projects=[project()];s.state.rows=fixtures();Object.assign(s.state[source][0],patch);const invalid=await s.list();assert.equal(invalid.status,409);assert.doesNotMatch(invalid.text,/PRIVATE_|Fictional|11111111/);}
 s.api.listPrivateSchoolSummaries=async()=>{throw Error('PRIVATE_FAILURE');};assert.equal((await s.list()).status,409);
});
test('common selected reads refuse source version, microsecond, scope or schema changes',async t=>{
 for(const sourceKind of ['project','school-course'])for(const change of [r=>r.version++,r=>r.updated_at='2026-11-17T12:00:00.000002Z',r=>r.owner_id=other,r=>r.deleted_at=stamp,r=>r.payload.schemaVersion=2]){const s=await setup(t),list=await s.list();assert.equal(list.status,200);const token=list.data.records.find(r=>r.sourceKind===sourceKind).referenceReadToken;change(sourceKind==='project'?s.state.projects[0]:s.state.rows[1]);const invalid=await s.read(token);assert.equal(invalid.status,409);assert.doesNotMatch(invalid.text,/PRIVATE_|Fictional|11111111/);assert.equal(s.state.writes,0);}
});
test('common late selected replies cannot survive replaced list, ordinary project refresh, revocation or logout',async t=>{
 for(const mode of ['replace','project','revoke','logout']){const s=await setup(t),list=await s.list(),token=list.data.records.find(r=>r.sourceKind==='project').referenceReadToken;let release;s.api.getPrivateProject=()=>new Promise(resolve=>release=()=>resolve([project()]));const pending=s.read(token);while(!release)await new Promise(resolve=>setImmediate(resolve));if(mode==='replace')assert.equal((await s.list()).status,200);else if(mode==='project')assert.equal((await s.call('projects/list',{})).status,200);else if(mode==='logout')assert.equal((await s.call('logout',{})).status,200);else s.state.active=false;release();const invalid=await pending;assert.equal(invalid.status,409);assert.doesNotMatch(invalid.text,/PRIVATE_|Fictional|11111111/);}
});
test('common reference tokens expire and late inventories cannot resurrect after logout',async t=>{
 const s=await setup(t),view=await s.list();assert.equal(view.status,200);s.state.clock+=300001;const expired=await s.read(view.data.records[0].referenceReadToken);assert.equal(expired.status,409);assert.doesNotMatch(expired.text,/PRIVATE_|Fictional|11111111/);
 const q=await setup(t);let release;q.api.listPrivateProjects=()=>new Promise(resolve=>release=()=>resolve([project()]));const pending=q.list();while(!release)await new Promise(resolve=>setImmediate(resolve));assert.equal((await q.call('logout',{})).status,200);release();const late=await pending;assert.equal(late.status,409);assert.doesNotMatch(late.text,/PRIVATE_|Fictional|referenceReadToken|11111111/);
});
test('common source reads cannot run while an ordinary project save is pending',async t=>{
 const s=await setup(t),list=await s.call('projects/list',{});assert.equal(list.status,200);const projectToken=list.data.projects[0].projectToken,review=await s.call('projects/review',{action:'edit',projectToken,fields:{title:'Fictional edited project',description:'PRIVATE_PROJECT_BODY',section:'Home',status:'Active',separateRecurring:false}});assert.equal(review.status,200);
 let release;s.api.updatePrivateProject=()=>new Promise(resolve=>release=()=>{s.state.writes++;resolve([]);});const pending=s.call('projects/save',{reviewId:review.data.reviewId,approved:true});while(!release)await new Promise(resolve=>setImmediate(resolve));const before=s.state.reads;assert.equal((await s.list()).status,409);assert.equal((await s.read('a'.repeat(43))).status,409);assert.equal(s.state.reads,before);release();assert.equal((await pending).status,503);assert.equal(s.state.writes,1);
});

test('shared editing exchange requires existing explicit editing scope, sign-in, exact controls and current reference',async t=>{
 const off=await setup(t);assert.equal((await off.call('projects/references-manage',{referenceReadToken:'a'.repeat(43)})).status,404);
 const guest=await setup(t,{editing:true,signed:false});assert.equal((await guest.call('projects/references-manage',{referenceReadToken:'a'.repeat(43)})).status,401);
 const s=await setup(t,{editing:true}),listing=await s.list(),token=listing.data.records[0].referenceReadToken;
 for(const headers of [{origin:'https://outside.example.test'},{'x-cc-csrf':'bad'},{'content-type':'text/plain'}])assert.equal((await s.call('projects/references-manage',{referenceReadToken:token},headers)).status,403);
 for(const values of [{},{referenceReadToken:'bad'},{referenceReadToken:token,owner_id:owner}])assert.equal((await s.call('projects/references-manage',values)).status,409);
 assert.equal(s.state.selected,0);assert.equal(s.state.writes,0);
});
test('shared editing exchange saves only the original manual project, degree or course after existing explicit approval',async t=>{
 for(const kind of ['project','school-degree','school-course']){const s=await setup(t,{editing:true}),before=structuredClone([...s.state.projects,...s.state.rows]),listing=await s.list(),reference=listing.data.records.find(r=>r.sourceKind===kind),opened=await s.call('projects/references-manage',{referenceReadToken:reference.referenceReadToken});assert.equal(opened.status,200);assert.equal(opened.data.sourceKind,kind);assert.doesNotMatch(opened.text,/owner_id|11111111|degreeId|PRIVATE_ASSESSMENT/);
 const edit=opened.data.edit,fields=kind==='project'?{title:'Edited original',description:edit.description,status:edit.status,section:edit.section,separateRecurring:edit.separateRecurring}:{...edit.fields,title:'Edited original'},review=await s.call(kind==='project'?'projects/review':'school/edit-review',kind==='project'?{action:'edit',projectToken:edit.projectToken,fields}:{editToken:edit.editToken,fields});assert.equal(review.status,200);assert.equal(s.state.writes,0);
 assert.equal((await s.call(kind==='project'?'projects/save':'school/edit-save',{reviewId:review.data.reviewId,approved:true})).status,200);assert.equal(s.state.writes,1);
 const after=[...s.state.projects,...s.state.rows],changed=after.filter((r,i)=>JSON.stringify(r)!==JSON.stringify(before[i]));assert.equal(changed.length,1);const prior=before.find(r=>r.id===changed[0].id);assert.deepEqual(changed[0],{...prior,version:prior.version+1,payload:{...prior.payload,title:'Edited original'}});assert.equal(after.length,before.length);
 }
});
test('newer source editors, cancellation and replacement suppress delayed shared editing exchanges',async t=>{
 for(const mode of ['new-project','new-school','cancel','replace']){const s=await setup(t,{editing:true}),listing=await s.list(),reference=listing.data.records.find(r=>r.sourceKind==='school-course'),read=s.api.getPrivateSchoolRecord;let release;s.api.getPrivateSchoolRecord=(...args)=>new Promise(resolve=>release=async()=>resolve(await read(...args)));
 const pending=s.call('projects/references-manage',{referenceReadToken:reference.referenceReadToken});while(!release)await new Promise(resolve=>setImmediate(resolve));
 if(mode==='new-project')assert.equal((await s.call('projects/list',{})).status,200);
 if(mode==='new-school'){s.api.getPrivateSchoolRecord=read;const overview=await s.call('school/overview',{});assert.equal((await s.call('school/edit-read',{schoolReadToken:overview.data.courses[1].schoolReadToken})).status,200);}
 if(mode==='cancel')assert.equal((await s.call('school/edit-cancel',{})).status,200);
 if(mode==='replace')await s.list();await release();const late=await pending;assert.equal(late.status,409);assert.doesNotMatch(late.text,/editToken|projectToken|PRIVATE_|11111111/);assert.equal(s.state.writes,0);
 }
});
test('starting a shared editing exchange retires the old School approval before its source read returns',async t=>{
 const s=await setup(t,{editing:true}),overview=await s.call('school/overview',{}),opened=await s.call('school/edit-read',{schoolReadToken:overview.data.courses[0].schoolReadToken}),review=await s.call('school/edit-review',{editToken:opened.data.editToken,fields:{...opened.data.fields,title:'Retired approval'}}),listing=await s.list(),reference=listing.data.records.find(r=>r.sourceKind==='school-course'),read=s.api.getPrivateSchoolRecord;let release;s.api.getPrivateSchoolRecord=(...args)=>new Promise(resolve=>release=async()=>resolve(await read(...args)));
 const pending=s.call('projects/references-manage',{referenceReadToken:reference.referenceReadToken});while(!release)await new Promise(resolve=>setImmediate(resolve));assert.equal((await s.call('school/edit-save',{reviewId:review.data.reviewId,approved:true})).status,409);assert.equal(s.state.writes,0);await release();assert.equal((await pending).status,200);
});
