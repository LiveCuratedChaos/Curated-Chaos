// Fictional in-process HTTP acceptance; no listeners, configuration or providers.
import test from 'node:test';import assert from 'node:assert/strict';
import {createPrivateSessionHttp} from '../server/private-workspace-session-http.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now=Date.parse('2026-11-17T12:00:00Z'),origin='http://127.0.0.1:5312';
const id=n=>'11111111-1111-4111-a111-'+String(n).padStart(12,'0');
const row=n=>({id:id(n),owner_id:owner,household_id:null,visibility:'private',section:'Calendar',item_type:'event',version:1,created_at:'2026-11-01T12:00:00Z',updated_at:'2026-11-02T12:00:00Z',deleted_at:null,payload:{fictional:true,title:'Fictional event '+String(n).padStart(2,'0'),day:'2026-11-17',time:'10:00',description:'PRIVATE_DESCRIPTION',location:'PRIVATE_LOCATION'}});
const controls={day:'2026-11-17',query:'',offset:0};
async function setup(t,{enabled=true,signed=true}={}){
 const state={active:true,reads:0,selected:0,writes:0,rows:[row(1)]};
 const api={signIn:async()=>({accessToken:'FICTIONAL_ACCESS_TOKEN',refreshToken:'FICTIONAL_REFRESH_TOKEN',expiresAt:now+3600000}),getUser:async()=>({id:owner,email:'demo@example.test'}),isSessionActive:async()=>state.active,signOutLocal:async()=>{},refreshSession:async()=>{throw Error('Unexpected refresh');},listPrivateBriefRecords:async()=>{state.reads++;return structuredClone(state.rows);},getPrivateEvent:async(_token,selected,who)=>{assert.equal(who,owner);state.selected++;return structuredClone(state.rows.filter(r=>r.id===selected));},addFictionalEvent:async()=>{state.writes++;throw Error('Unexpected insert');},updatePrivateEvent:async()=>{state.writes++;throw Error('Unexpected write');}};
 const router=createPrivateSessionHttp({origin,api,now:()=>now,allowBriefRead:true,allowSearch:true,allowSearchDates:true,allowEventCreate:true,allowEventEdit:true,allowEventDetails:true,allowCalendarWorkspace:true,allowCalendarDayRead:enabled});t.after(()=>router.dispose());let cookie='',csrf='';
 async function call(path,body,extra={},method=body===undefined?'GET':'POST'){
  const req={url:'/auth/workspace/'+path,method,headers:{host:'127.0.0.1:5312',origin,cookie,'content-type':'application/json','x-cc-request':'workspace-session','x-cc-csrf':csrf,...extra},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},res={writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(body){this.body=body;}};
  assert.equal(await router.handle(req,res),true);const data=JSON.parse(res.body);if(res.headers['Set-Cookie'])cookie=res.headers['Set-Cookie'].split(';')[0];if(data.csrf)csrf=data.csrf;return{status:res.status,data,text:res.body};
 }
 await call('status');if(signed)assert.equal((await call('login',{email:'demo@example.test',password:'fictional-only'})).status,200);
 return{api,state,call,list:(patch={})=>call('calendar-day/list',{...controls,...patch}),read:eventReadToken=>call('calendar-day/read',{eventReadToken})};
}
test('day schedule is default-off, requires full Calendar scope and authentication',async t=>{
 assert.throws(()=>createPrivateSessionHttp({origin,api:{},allowCalendarDayRead:true}),/Calendar/);
 const off=await setup(t,{enabled:false});assert.equal((await off.list()).status,404);assert.equal(off.state.reads,0);
 const guest=await setup(t,{signed:false});assert.equal((await guest.list()).status,401);assert.equal(guest.state.reads,0);
});
test('day schedule rejects cross-origin, CSRF and malformed controls before inventory reads',async t=>{
 const s=await setup(t);for(const headers of [{origin:'https://outside.example.test'},{host:'outside.test'},{'x-cc-csrf':'bad'},{'x-cc-request':undefined},{'content-type':'text/plain'}])assert.equal((await s.call('calendar-day/list',controls,headers)).status,403);
 assert.equal((await s.call('calendar-day/list',undefined)).status,404);
 for(const body of [null,{},[],{...controls,day:'2026-02-30'},{...controls,day:'1999-12-31'},{...controls,query:null},{...controls,offset:-1},{...controls,offset:0.5},{...controls,owner_id:owner},{...controls,description:'PRIVATE_EXTRA'}])assert.equal((await s.call('calendar-day/list',body)).status,409);
 for(const body of [{},{eventReadToken:'bad'},{eventReadToken:'a'.repeat(43),id:id(1)}])assert.equal((await s.call('calendar-day/read',body)).status,409);
 assert.equal(s.state.reads,0);assert.equal(s.state.selected,0);
});
test('day list reads one inventory per page, keeps bodies selected-only and grants no edit authority',async t=>{
 const s=await setup(t);s.state.rows=Array.from({length:53},(_,i)=>row(i+1));const before=structuredClone(s.state.rows),first=await s.list();assert.equal(first.status,200);assert.equal(first.data.events.length,50);assert.equal(first.data.matchCount,53);assert.equal(first.data.readOnly,true);assert.equal(first.data.providerRead,false);assert.equal(s.state.reads,1);assert.equal(s.state.selected,0);assert.doesNotMatch(first.text,/PRIVATE_|description|location|owner_id|payload|eventEditToken|recordToken|11111111/);
 const token=first.data.events[0].eventReadToken;assert.match(token,/^[A-Za-z0-9_-]{43}$/);
 assert.equal((await s.call('events/edit-read',{editToken:token})).status,409);assert.equal((await s.call('events/edit-review',{editToken:token,title:'Unauthorized edit',day:controls.day,time:'11:00'})).status,409);assert.equal(s.state.selected,0);
 const selected=await s.read(token);assert.equal(selected.status,200);assert.equal(selected.data.readOnly,true);assert.equal(selected.data.description,'PRIVATE_DESCRIPTION');assert.equal(selected.data.location,'PRIVATE_LOCATION');assert.equal(s.state.selected,1);
 const next=await s.list({offset:50});assert.equal(next.status,200);assert.equal(next.data.events.length,3);assert.equal(s.state.reads,2);assert.equal((await s.read(token)).status,409);assert.equal(s.state.writes,0);assert.deepEqual(s.state.rows,before);
});
test('day reads preserve the independent main Calendar selected-event capability',async t=>{
 const s=await setup(t),main=await s.call('calendar',{type:'event',section:'Calendar',status:'all',query:'',dateFrom:controls.day,dateTo:controls.day,offset:0});assert.equal(main.status,200);const token=main.data.results[0].eventEditToken;assert.match(token,/^[A-Za-z0-9_-]{43}$/);
 const listed=await s.list();assert.equal(listed.status,200);assert.equal((await s.read(listed.data.events[0].eventReadToken)).status,200);
 const still=await s.call('events/edit-read',{editToken:token});assert.equal(still.status,200);assert.equal(still.data.description,'PRIVATE_DESCRIPTION');assert.equal(s.state.writes,0);
});
test('empty day succeeds distinctly from unavailable, duplicate or foreign sources',async t=>{
 const s=await setup(t);s.state.rows=[];const empty=await s.list();assert.equal(empty.status,200);assert.deepEqual(empty.data.events,[]);assert.equal(empty.data.matchCount,0);
 for(const invalid of [null,[row(1),row(1)],[{...row(1),owner_id:other}]]){s.api.listPrivateBriefRecords=async()=>invalid;const result=await s.list();assert.equal(result.status,409);assert.doesNotMatch(result.text,/PRIVATE_|Fictional event|11111111|events|payload/);}
 s.api.listPrivateBriefRecords=async()=>{throw Error('PRIVATE_SOURCE_FAILURE');};assert.equal((await s.list()).status,409);assert.equal(s.state.writes,0);
});
test('selected day details reject deleted, foreign, or version-changed records without leaking bodies',async t=>{
 for(const patch of [{deleted_at:'2026-11-17T12:00:00Z'},{owner_id:other},{version:2}]){
  const s=await setup(t),listed=await s.list();assert.equal(listed.status,200);Object.assign(s.state.rows[0],patch);const result=await s.read(listed.data.events[0].eventReadToken);assert.equal(result.status,409);assert.doesNotMatch(result.text,/PRIVATE_|Fictional event|11111111/);assert.equal(s.state.writes,0);
 }
});
test('logout and explicit selection replacement suppress late day details',async t=>{
 for(const mode of ['logout','replace','revoked']){
  const s=await setup(t),listed=await s.list(),token=listed.data.events[0].eventReadToken;let release;s.api.getPrivateEvent=()=>new Promise(resolve=>release=()=>resolve([row(1)]));const pending=s.read(token);while(!release)await new Promise(resolve=>setImmediate(resolve));
  if(mode==='logout')assert.equal((await s.call('logout',{})).status,200);else if(mode==='replace')assert.equal((await s.list()).status,200);else s.state.active=false;release();const result=await pending;assert.equal(result.status,409);assert.doesNotMatch(result.text,/PRIVATE_|Fictional event|11111111/);assert.equal(s.state.writes,0);
 }
});
test('logout suppresses a late inventory response and its new day capabilities',async t=>{
 const s=await setup(t);let release;s.api.listPrivateBriefRecords=()=>new Promise(resolve=>release=()=>resolve([row(1)]));const pending=s.list();while(!release)await new Promise(resolve=>setImmediate(resolve));assert.equal((await s.call('logout',{})).status,200);release();const result=await pending;assert.equal(result.status,409);assert.doesNotMatch(result.text,/PRIVATE_|Fictional event|eventReadToken|11111111/);
});
test('a new parent Calendar query retires its earlier day-detail capabilities',async t=>{
 const s=await setup(t),day=await s.list();assert.equal(day.status,200);const token=day.data.events[0].eventReadToken;assert.equal((await s.read(token)).status,200);assert.equal((await s.call('calendar',{query:'',type:'event',section:'Calendar',status:'all',dateFrom:'2026-11-01',dateTo:'2026-11-30',offset:0})).status,200);const old=await s.read(token);assert.equal(old.status,409);assert.doesNotMatch(old.text,/PRIVATE_DESCRIPTION|PRIVATE_LOCATION/);
});

test('filtered month and day agree across pages with manual, saved and all-day events on the same date',async t=>{
 const s=await setup(t);
 const manual=n=>({...row(n),origin:'PRIVATE_COOKIE_EVENT_CREATE',payload:{...row(n).payload,calendarCategory:'Work Shift'}});
 const otherCategory=manual(62),allDay=manual(63),differentTitle=manual(64);
 otherCategory.payload.calendarCategory='Appointment';
 Object.assign(allDay.payload,{time:'00:00',all_day:true});
 differentTitle.payload.title='Some other title';
 s.state.rows=[...Array.from({length:51},(_,i)=>manual(i+1)),{...manual(61),origin:'google_readonly'},otherCategory,allDay,differentTitle];
 const filters={query:'Fictional',eventKind:'timed',eventSource:'manual',eventCategory:'Work Shift'};
 const month=await s.call('calendar',{...filters,type:'event',section:'Calendar',status:'all',dateFrom:controls.day,dateTo:controls.day});
 assert.equal(month.status,200);assert.equal(month.data.matchCount,51);
 const first=await s.list(filters);assert.equal(first.status,200);assert.equal(first.data.matchCount,51);
 assert.deepEqual(first.data.events.map(r=>r.title),month.data.results.map(r=>r.title));
 const next=await s.list({...filters,offset:50});assert.equal(next.status,200);
 assert.deepEqual(next.data.events.map(r=>r.title),['Fictional event 51']);
 assert.deepEqual(Object.fromEntries(Object.keys(filters).map(k=>[k,next.data[k]])),filters);
 const selected=await s.read(next.data.events[0].eventReadToken);
 assert.equal(selected.data.title,'Fictional event 51');assert.equal(s.state.writes,0);
 for(const change of [{eventSource:'unknown'},{eventCategory:' '},{eventKind:null}])assert.equal((await s.list({...filters,...change})).status,409);
});
