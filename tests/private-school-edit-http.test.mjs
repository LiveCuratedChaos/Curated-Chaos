// Fictional in-process HTTP acceptance; no listeners, configuration or providers.
import test from 'node:test';import assert from 'node:assert/strict';
import {createPrivateSessionHttp} from '../server/private-workspace-session-http.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now=Date.parse('2026-11-17T12:00:00Z'),origin='http://127.0.0.1:5312';
const id=n=>'11111111-1111-4111-a111-'+String(n).padStart(12,'0');

async function setup(t,{enabled=true,signed=true,read=true}={}){
 const state={clock:now,active:true,reads:0,selected:0,writes:0,rows:fixtures()};
 const api={signIn:async()=>({accessToken:'FICTIONAL_ACCESS_TOKEN',refreshToken:'FICTIONAL_REFRESH_TOKEN',expiresAt:now+3600000}),getUser:async()=>({id:owner,email:'demo@example.test'}),isSessionActive:async()=>state.active,signOutLocal:async()=>{},refreshSession:async()=>{throw Error('Unexpected refresh');},listPrivateBriefRecords:async()=>[],listPrivateSchoolSummaries:async()=>{state.reads++;return structuredClone(state.rows).map(r=>{for(const key of ['notes','assessments','studySessions'])delete r.payload[key];return r;});},getPrivateSchoolRecord:async(_token,selected,who)=>{assert.equal(who,owner);state.selected++;return structuredClone(state.rows.filter(r=>r.id===selected));}};
 api.updatePrivateSchoolMetadata=async(_token,prior,who,payload)=>{assert.equal(who,owner);state.writes++;const index=state.rows.findIndex(r=>r.id===prior.id&&r.version===prior.version);if(index<0)return[];state.rows[index]={...state.rows[index],payload:structuredClone(payload),version:prior.version+1,updated_at:'2026-11-17T12:00:01.000001Z'};return[structuredClone(state.rows[index])];};
 const router=createPrivateSessionHttp({origin,api,now:()=>state.clock,allowBriefRead:true,allowSchoolRead:read,allowSchoolEdit:enabled});t.after(()=>router.dispose());let cookie='',csrf='';
 async function call(path,body,extra={},method=body===undefined?'GET':'POST'){
  const req={url:'/auth/workspace/'+path,method,headers:{host:'127.0.0.1:5312',origin,cookie,'content-type':'application/json','x-cc-request':'workspace-session','x-cc-csrf':csrf,...extra},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},res={writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(body){this.body=body;}};
  assert.equal(await router.handle(req,res),true);const data=JSON.parse(res.body);if(res.headers['Set-Cookie'])cookie=res.headers['Set-Cookie'].split(';')[0];if(data.csrf)csrf=data.csrf;return{status:res.status,data,text:res.body};
 }
 await call('status');if(signed)assert.equal((await call('login',{email:'demo@example.test',password:'fictional-only'})).status,200);
 return{api,state,call,overview:()=>call('school/overview',{}),open:schoolReadToken=>call('school/edit-read',{schoolReadToken}),review:(editToken,fields)=>call('school/edit-review',{editToken,fields}),save:reviewId=>call('school/edit-save',{reviewId,approved:true})};
}
import {makeSchoolDegree,makeSchoolCourse} from '../src/dev-school-model.mjs';
const stamp='2026-11-17T12:00:00.000001Z';
function fixtures(){const meta=(r,n)=>({...r,id:id(n),version:1,deleted_at:null,created_at:stamp,updated_at:stamp});return [meta(makeSchoolDegree(owner,{title:'Fictional degree',progressMetric:'terms'}),1),meta(makeSchoolCourse(owner,{title:'First course',degreeId:id(1),term:'Term 1',status:'Completed',credits:3,officialOrder:4,studyOrder:1,notes:'PRIVATE_NOTES',assessments:[{title:'PRIVATE_ASSESSMENT',tasks:[{title:'PRIVATE_STEP',done:true}]}],studySessions:[{day:'2026-11-17',time:'10:00',title:'PRIVATE_STUDY'}]}),2),meta(makeSchoolCourse(owner,{title:'Second course',degreeId:id(1),term:'Term 1',status:'In Progress',credits:4,officialOrder:1,studyOrder:4}),3)];}
test('School edits are default-off and require explicitly enabled School read scope',async t=>{
 assert.throws(()=>createPrivateSessionHttp({origin,api:{},allowBriefRead:true,allowSchoolEdit:true}),/School/);
 const s=await setup(t,{enabled:false});assert.equal((await s.call('school/edit-read',{schoolReadToken:'a'.repeat(43)})).status,404);assert.equal(s.state.reads,0);assert.equal(s.state.selected,0);
 const guest=await setup(t,{signed:false});assert.equal((await guest.call('school/edit-read',{schoolReadToken:'a'.repeat(43)})).status,401);assert.equal(guest.state.selected,0);
});
test('School edit HTTP protects every action with POST, same-origin, CSRF and exact fields',async t=>{
 const s=await setup(t);for(const path of ['school/edit-read','school/edit-review','school/edit-save','school/edit-cancel']){
  for(const headers of [{origin:'https://outside.example.test'},{host:'outside.test'},{'x-cc-csrf':'bad'},{'x-cc-request':undefined},{'content-type':'text/plain'}])assert.equal((await s.call(path,{},headers)).status,403);assert.equal((await s.call(path,undefined)).status,404);
 }
 for(const [path,values]of [['school/edit-read',{}],['school/edit-read',{schoolReadToken:'bad'}],['school/edit-read',{schoolReadToken:'a'.repeat(43),id:id(2)}],['school/edit-review',{editToken:'a'.repeat(43),fields:{},owner_id:owner}],['school/edit-save',{reviewId:'a'.repeat(43),approved:false}],['school/edit-save',{reviewId:'a'.repeat(43),approved:true,payload:{}}],['school/edit-cancel',{extra:true}]])assert.equal((await s.call(path,values)).status,409);assert.equal(s.state.reads,0);assert.equal(s.state.selected,0);assert.equal(s.state.writes,0);
});
async function editable(s,index=0){const list=await s.overview();assert.equal(list.status,200);const opened=await s.open(list.data.courses[index].schoolReadToken);assert.equal(opened.status,200);return opened.data;}
test('School reviewed metadata save changes only approved fields and preserves exact nested source records',async t=>{
 const s=await setup(t),original=structuredClone(s.state.rows),view=await editable(s),fields={...view.fields,title:'Edited fictional course',notes:'\nSaved literal notes\n',officialOrder:2};const review=await s.review(view.editToken,fields);assert.equal(review.status,200);assert.equal(s.state.writes,0);assert.deepEqual(review.data.changes.map(c=>c.field).sort(),['notes','officialOrder','title']);const saved=await s.save(review.data.reviewId);assert.equal(saved.status,200);assert.deepEqual(saved.data,{saved:true});assert.equal(s.state.writes,1);assert.equal(s.state.rows[1].version,2);
 assert.deepEqual(s.state.rows[1].payload,{...original[1].payload,...fields});assert.deepEqual(s.state.rows[0],original[0]);assert.deepEqual(s.state.rows[2],original[2]);assert.equal(s.state.rows[1].id,original[1].id);assert.equal(s.state.rows[1].created_at,original[1].created_at);assert.equal((await s.save(review.data.reviewId)).status,409);assert.equal(s.state.writes,1);
});
test('School read capability cannot bypass an explicit edit exchange and fields cannot alter associations or nested records',async t=>{
 const s=await setup(t),list=await s.overview(),token=list.data.courses[0].schoolReadToken;const invalid=await s.review(token,{});assert.equal(invalid.status,409);const view=await editable(s);for(const patch of [{degreeId:other},{program:'Other program'},{assessments:[]},{studySessions:[]},{owner_id:other},{kind:'degree'},{schemaVersion:2},{status:'Deleted'}]){const result=await s.review(view.editToken,{...view.fields,title:'Changed fictional course',...patch});assert.equal(result.status,409);}assert.equal(s.state.writes,0);
});
test('School no-change and cancellation perform no write and invalidate cancelled reviews',async t=>{
 const s=await setup(t),view=await editable(s),unchanged=await s.review(view.editToken,view.fields);assert.equal(unchanged.status,200);assert.deepEqual(unchanged.data,{noChanges:true});const review=await s.review(view.editToken,{...view.fields,title:'Changed fictional course'});assert.equal(review.status,200);assert.equal((await s.call('school/edit-cancel',{})).status,200);assert.equal((await s.save(review.data.reviewId)).status,409);assert.equal(s.state.writes,0);
});
test('School edits revalidate version, microseconds, ownership and nested source before approval writes',async t=>{
 for(const change of [r=>r.version++,r=>r.updated_at='2026-11-17T12:00:00.000002Z',r=>r.owner_id=other,r=>r.deleted_at=stamp,r=>r.payload.assessments[0].tasks[0].done=false]){const s=await setup(t),view=await editable(s),review=await s.review(view.editToken,{...view.fields,title:'Changed fictional course'});assert.equal(review.status,200);change(s.state.rows[1]);const result=await s.save(review.data.reviewId);assert.equal(result.status,409);assert.equal(s.state.writes,0);assert.doesNotMatch(result.text,/PRIVATE_|First course|11111111/);}
});
test('lost or invalid School save acknowledgements remain uncertain and cannot retry the same review',async t=>{
 for(const mode of ['lost','double-version','payload']){const s=await setup(t),view=await editable(s),review=await s.review(view.editToken,{...view.fields,title:'Changed fictional course'}),write=s.api.updatePrivateSchoolMetadata;s.api.updatePrivateSchoolMetadata=async(...args)=>{const rows=await write(...args);if(mode==='lost')throw Error('PRIVATE_LOST_ACK');if(mode==='double-version')rows[0].version++;else rows[0].payload.notes='PRIVATE_UNAPPROVED_CHANGE';return rows;};const result=await s.save(review.data.reviewId);assert.equal(result.status,503);assert.equal(s.state.writes,1);assert.doesNotMatch(result.text,/PRIVATE_|First course|11111111/);assert.equal((await s.save(review.data.reviewId)).status,409);assert.equal(s.state.writes,1);}
});
test('one pending School write blocks concurrent source reads and duplicate approval',async t=>{
 const s=await setup(t),view=await editable(s),review=await s.review(view.editToken,{...view.fields,title:'Changed fictional course'}),write=s.api.updatePrivateSchoolMetadata;let release;s.api.updatePrivateSchoolMetadata=(...args)=>new Promise(resolve=>release=async()=>resolve(await write(...args)));const pending=s.save(review.data.reviewId);while(!release)await new Promise(resolve=>setImmediate(resolve));const before=s.state.reads;assert.equal((await s.overview()).status,409);assert.equal((await s.call('brief',undefined)).status,409);assert.equal((await s.save(review.data.reviewId)).status,409);assert.equal(s.state.reads,before);assert.equal(s.state.writes,0);await release();assert.equal((await pending).status,200);assert.equal(s.state.writes,1);
});
test('logout and replaced School selection suppress late edit openings and reviews',async t=>{
 for(const mode of ['logout','replace']){const s=await setup(t),list=await s.overview(),token=list.data.courses[0].schoolReadToken,read=s.api.getPrivateSchoolRecord;let release;s.api.getPrivateSchoolRecord=(...args)=>new Promise(resolve=>release=async()=>resolve(await read(...args)));const pending=s.open(token);while(!release)await new Promise(resolve=>setImmediate(resolve));if(mode==='logout')assert.equal((await s.call('logout',{})).status,200);else assert.equal((await s.overview()).status,200);await release();const late=await pending;assert.equal(late.status,409);assert.doesNotMatch(late.text,/PRIVATE_|First course|editToken|11111111/);assert.equal(s.state.writes,0);}
});
test('School metadata edits preserve unknown nested extensions without exposing them or normalizing bodies',async t=>{
 const s=await setup(t);s.state.rows[1].payload.extension={keep:'PRIVATE_EXTENSION'};s.state.rows[1].payload.assessments[0].extension={keep:'PRIVATE_ASSESSMENT_EXTENSION'};s.state.rows[1].payload.assessments[0].tasks[0].extension={keep:'PRIVATE_TASK_EXTENSION'};s.state.rows[1].payload.studySessions[0].extension={keep:'PRIVATE_SESSION_EXTENSION'};const original=structuredClone(s.state.rows[1].payload),view=await editable(s),fields={...view.fields,title:'Edited extension-safe course'};assert.doesNotMatch(JSON.stringify(view),/PRIVATE_.*EXTENSION/);const review=await s.review(view.editToken,fields);assert.equal(review.status,200);const saved=await s.save(review.data.reviewId);assert.equal(saved.status,200);assert.deepEqual(s.state.rows[1].payload,{...original,...fields});assert.equal(s.state.writes,1);
});

test('new School editor intent retires old approval before its selected source returns',async t=>{
 const s=await setup(t),list=await s.overview(),view=(await s.open(list.data.courses[0].schoolReadToken)).data,review=await s.review(view.editToken,{...view.fields,title:'Old approval'}),read=s.api.getPrivateSchoolRecord;
 let release;s.api.getPrivateSchoolRecord=(...args)=>new Promise(resolve=>release=async()=>resolve(await read(...args)));
 const pending=s.open(list.data.courses[1].schoolReadToken);while(!release)await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await s.save(review.data.reviewId)).status,409);assert.equal(s.state.writes,0);
 await release();const opened=await pending;assert.equal(opened.status,200);assert.equal(opened.data.fields.title,'Second course');
 s.api.getPrivateSchoolRecord=read;assert.equal((await s.review(opened.data.editToken,{...opened.data.fields,title:'Current proposal'})).status,200);
});

test('older delayed School editor cannot replace a newer editor or its approved save',async t=>{
 const s=await setup(t),list=await s.overview(),read=s.api.getPrivateSchoolRecord;let release;
 s.api.getPrivateSchoolRecord=(...args)=>args[1]===id(2)?new Promise(resolve=>release=async()=>resolve(await read(...args))):read(...args);
 const pending=s.open(list.data.courses[0].schoolReadToken);while(!release)await new Promise(resolve=>setImmediate(resolve));
 const current=await s.open(list.data.courses[1].schoolReadToken);assert.equal(current.status,200);
 const review=await s.review(current.data.editToken,{...current.data.fields,title:'Newer editor wins'});assert.equal(review.status,200);
 await release();const late=await pending;assert.equal(late.status,409);assert.doesNotMatch(late.text,/PRIVATE_|First course|editToken|11111111/);
 assert.equal((await s.save(review.data.reviewId)).status,200);assert.equal(s.state.rows[2].payload.title,'Newer editor wins');assert.equal(s.state.rows[1].payload.title,'First course');assert.equal(s.state.writes,1);
});

test('cancelling a pending School editor prevents its late source from reviving edit authority',async t=>{
 const s=await setup(t),list=await s.overview(),read=s.api.getPrivateSchoolRecord;let release;
 s.api.getPrivateSchoolRecord=(...args)=>new Promise(resolve=>release=async()=>resolve(await read(...args)));
 const pending=s.open(list.data.courses[0].schoolReadToken);while(!release)await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await s.call('school/edit-cancel',{})).status,200);await release();assert.equal((await pending).status,409);assert.equal(s.state.writes,0);
});
