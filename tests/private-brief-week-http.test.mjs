// In-process router acceptance only; no listener, provider, real record or config.
import test from 'node:test';import assert from 'node:assert/strict';
import {createPrivateSessionHttp} from '../server/private-workspace-session-http.mjs';
import {verifyPrivateBriefWeek} from '../src/private-brief-week.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now=Date.parse('2026-11-17T12:00:00Z'),origin='http://127.0.0.1:5312',values={anchor:'2026-11-17',range:'rolling',weekStart:1};
const id=n=>'11111111-1111-4111-a111-'+String(n).padStart(12,'0');
const row=(n,type,payload)=>({id:id(n),owner_id:owner,household_id:null,visibility:'private',section:type==='event'?'Calendar':type==='note'?'Personal Life':'Home',item_type:type,version:1,created_at:'2026-11-01T12:00:00Z',updated_at:'2026-11-02T12:00:00Z',deleted_at:null,payload:{fictional:true,...payload}});
const fixtures=()=>[row(1,'task',{title:'Fictional week task',day:'2026-11-17',done:false,description:'PRIVATE_TASK_BODY',subtasks:[{title:'PRIVATE_CHECKLIST',done:true}]}),row(2,'event',{title:'Fictional week event',day:'2026-11-18',time:'10:00',description:'PRIVATE_EVENT_BODY',location:'PRIVATE_LOCATION'}),row(3,'note',{title:'PRIVATE_NOTE_TITLE',body:'PRIVATE_NOTE_BODY'})];
async function setup(t,{dates=true,layout=true,signed=true,noteRead=false}={}){
 const state={active:true,reads:0,writes:0,closed:0,rows:fixtures()},api={
  signIn:async()=>({accessToken:'FICTIONAL_ACCESS_TOKEN',refreshToken:'FICTIONAL_REFRESH_TOKEN',expiresAt:now+3600000}),getUser:async()=>({id:owner,email:'demo@example.test'}),isSessionActive:async()=>state.active,refreshSession:async()=>{throw Error('Unexpected refresh');},signOutLocal:async()=>{state.closed++;},
  listPrivateBriefRecords:async(token,who)=>{assert.equal(who,owner);state.reads++;return structuredClone(state.rows);},
  listBriefPreferences:async()=>[],addBriefPreferences:async()=>{state.writes++;throw Error('Unexpected preferences insert');},updateBriefPreferences:async()=>{state.writes++;throw Error('Unexpected preferences update');},
  getPrivateNote:async(token,selected,who)=>{assert.equal(who,owner);return structuredClone(state.rows.filter(r=>r.item_type==='note'&&r.id===selected));}
 },router=createPrivateSessionHttp({origin,api,now:()=>now,allowBriefRead:true,allowBriefDates:dates,allowBriefLayout:layout,allowNoteRead:noteRead});t.after(()=>router.dispose());let cookie='',csrf='';
 async function call(path,body,extra={},method=body===undefined?'GET':'POST'){
  const req={url:'/auth/workspace/'+path,method,headers:{host:'127.0.0.1:5312',origin,cookie,'content-type':'application/json','x-cc-request':'workspace-session','x-cc-csrf':csrf,...extra},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},res={writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(body){this.body=body;}};
  assert.equal(await router.handle(req,res),true);const result=JSON.parse(res.body);if(res.headers['Set-Cookie'])cookie=res.headers['Set-Cookie'].split(';')[0];if(result.csrf)csrf=result.csrf;return{status:res.status,data:result,text:res.body};
 }
 await call('status');if(signed)assert.equal((await call('login',{email:'demo@example.test',password:'fictional-only'})).status,200);
 return{state,api,call,week:(patch={})=>call('brief-week',{...values,...patch})};
}
test('saved-week HTTP endpoint requires both date/layout flags and an authenticated session',async t=>{
 for(const flags of [{dates:false,layout:false},{dates:false},{layout:false}]){const s=await setup(t,flags);assert.equal((await s.week()).status,404);assert.equal(s.state.reads,0);}
 const s=await setup(t,{signed:false});assert.equal((await s.week()).status,401);assert.equal(s.state.reads,0);
});
test('saved-week requests require same-origin, exact CSRF and POST before reading records',async t=>{
 const s=await setup(t);for(const headers of [{origin:'https://outside.example.test'},{host:'outside.test'},{'x-cc-csrf':'bad'},{'x-cc-request':undefined},{'content-type':'text/plain'}])assert.equal((await s.call('brief-week',values,headers)).status,403);
 assert.equal((await s.call('brief-week',undefined)).status,404);assert.equal(s.state.reads,0);assert.equal(s.state.writes,0);
});
test('malformed or surplus date controls fail before any inventory read',async t=>{
 const s=await setup(t);for(const patch of [{anchor:'2026-02-30'},{anchor:'1999-12-31'},{anchor:null},{range:'month'},{weekStart:7},{weekStart:-1},{weekStart:1.5},{weekStart:'1'},{owner_id:owner},{extra:'PRIVATE_UNEXPECTED'}])assert.equal((await s.week(patch)).status,409);
 for(const body of [null,{},[],{anchor:values.anchor,range:'rolling'}])assert.equal((await s.call('brief-week',body)).status,409);assert.equal(s.state.reads,0);assert.equal(s.state.writes,0);
});
test('one source read produces current seven-day summaries without details, record IDs or action capabilities',async t=>{
 const s=await setup(t),before=structuredClone(s.state.rows),response=await s.week();assert.equal(response.status,200);assert.equal(s.state.reads,1);assert.equal(s.state.writes,0);assert.equal(response.data.sourceRecords,3);assert.equal(response.data.days.length,7);assert.equal(response.data.days[0].dueTasksCount,1);assert.equal(response.data.days[1].eventsCount,1);assert.equal(response.data.currentRecords,true);assert.equal(response.data.readOnly,true);assert.equal(response.data.providerRead,false);assert.equal(response.data.expiresAt,now+300000);
 assert.equal(verifyPrivateBriefWeek(response.data,{anchor:values.anchor,dateView:values,now}),response.data);assert.doesNotMatch(response.text,/PRIVATE_|11111111|owner_id|payload|Token|description|location|subtasks/);assert.deepEqual(s.state.rows,before);
 const calendar=await s.week({range:'calendar',weekStart:0});assert.equal(calendar.status,200);assert.equal(calendar.data.range.from,'2026-11-15');assert.equal(calendar.data.range.to,'2026-11-21');assert.equal(s.state.reads,2);
});
test('empty saved week differs from an unavailable or malformed source',async t=>{
 const s=await setup(t);s.state.rows=[];const empty=await s.week();assert.equal(empty.status,200);assert.equal(empty.data.available,true);assert.equal(empty.data.sourceRecords,0);assert.ok(empty.data.days.every(d=>d.dueTasksCount===0&&d.eventsCount===0));
 for(const invalid of [null,[{...fixtures()[0],owner_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}],[fixtures()[0],fixtures()[0]]]){s.api.listPrivateBriefRecords=async()=>invalid;const result=await s.week();assert.equal(result.status,200);assert.deepEqual(result.data,{available:false});assert.doesNotMatch(result.text,/PRIVATE_|Fictional|counts|days|owner/);}
 s.api.listPrivateBriefRecords=async()=>{throw Error('PRIVATE_UPSTREAM_ERROR');};const unavailable=await s.week();assert.equal(unavailable.status,200);assert.deepEqual(unavailable.data,{available:false});assert.equal(s.state.writes,0);
});
test('source revocation or logout suppresses late saved-week titles instead of returning unavailable success',async t=>{
 for(const kind of ['logout','revoked']){
  const s=await setup(t);let release;s.api.listPrivateBriefRecords=()=>new Promise(resolve=>release=()=>resolve(fixtures()));const pending=s.week();while(!release)await new Promise(resolve=>setImmediate(resolve));
  if(kind==='logout')assert.equal((await s.call('logout',{})).status,200);else s.state.active=false;release();const result=await pending;assert.equal(result.status,409);assert.doesNotMatch(result.text,/Fictional week|PRIVATE_|11111111|days/);assert.equal(s.state.writes,0);
 }
});
test('read-only week requests preserve already displayed selected-note capabilities',async t=>{
 const s=await setup(t,{noteRead:true}),brief=await s.call('brief');assert.equal(brief.status,200);const noteToken=brief.data.notes[0].noteToken;assert.match(noteToken,/^[A-Za-z0-9_-]{43}$/);const readsBefore=s.state.reads;
 assert.equal((await s.week()).status,200);assert.equal(s.state.reads,readsBefore+1);assert.equal((await s.week({range:'unsupported'})).status,409);
 const details=await s.call('notes/read',{noteToken});assert.equal(details.status,200);assert.equal(details.data.body,'PRIVATE_NOTE_BODY');assert.equal(s.state.writes,0);
});
