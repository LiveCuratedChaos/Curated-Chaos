// Fictional in-process HTTP acceptance; no listeners, configuration or providers.
import test from 'node:test';import assert from 'node:assert/strict';
import {createPrivateSessionHttp} from '../server/private-workspace-session-http.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now=Date.parse('2026-11-17T12:00:00Z'),origin='http://127.0.0.1:5312';
const id=n=>'11111111-1111-4111-a111-'+String(n).padStart(12,'0');
const row=n=>({id:id(n),owner_id:owner,household_id:null,visibility:'private',section:'Calendar',item_type:'event',version:1,created_at:'2026-11-01T12:00:00Z',updated_at:'2026-11-02T12:00:00Z',deleted_at:null,payload:{fictional:true,title:'Fictional event '+String(n).padStart(2,'0'),day:'2026-11-17',time:'10:00',description:'PRIVATE_DESCRIPTION',location:'PRIVATE_LOCATION'}});

async function setup(t,{dates=true}={}){
 const state={active:true,reads:0,selected:0,writes:0,rows:[row(1)]};
 const api={signIn:async()=>({accessToken:'FICTIONAL_ACCESS_TOKEN',refreshToken:'FICTIONAL_REFRESH_TOKEN',expiresAt:now+3600000}),getUser:async()=>({id:owner,email:'demo@example.test'}),isSessionActive:async()=>state.active,signOutLocal:async()=>{},refreshSession:async()=>{throw Error('Unexpected refresh');},listPrivateBriefRecords:async()=>{state.reads++;return structuredClone(state.rows);},getPrivateEvent:async(_token,selected,who)=>{assert.equal(who,owner);state.selected++;return structuredClone(state.rows.filter(r=>r.id===selected));},addFictionalEvent:async()=>{state.writes++;throw Error('Unexpected insert');},updatePrivateEvent:async()=>{state.writes++;throw Error('Unexpected write');}};
 const router=createPrivateSessionHttp({origin,api,now:()=>now,allowBriefRead:true,allowSearch:true,allowSearchDates:dates});t.after(()=>router.dispose());let cookie='',csrf='';
 async function call(path,body,extra={},method=body===undefined?'GET':'POST'){
  const req={url:'/auth/workspace/'+path,method,headers:{host:'127.0.0.1:5312',origin,cookie,'content-type':'application/json','x-cc-request':'workspace-session','x-cc-csrf':csrf,...extra},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},res={writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(body){this.body=body;}};
  assert.equal(await router.handle(req,res),true);const data=JSON.parse(res.body);if(res.headers['Set-Cookie'])cookie=res.headers['Set-Cookie'].split(';')[0];if(data.csrf)csrf=data.csrf;return{status:res.status,data,text:res.body};
 }
 await call('status');assert.equal((await call('login',{email:'demo@example.test',password:'fictional-only'})).status,200);
 return{api,state,call};
}

import {parsePrivateSearchIntent} from '../src/private-search-intent.mjs';
const task=(n,title='Fictional matching task',patch={})=>({...row(n),section:'Work',item_type:'task',payload:{fictional:true,title,day:'2026-11-17',done:false,...patch}});
const compile=text=>parsePrivateSearchIntent(text,{now,allowDates:true}).fields;
test('compiled open Work tasks due on a date use the existing protected search and narrow real rows',async t=>{
 const s=await setup(t);s.state.rows=[task(1),task(2,'Completed',{done:true}),task(3,'Wrong day',{day:'2026-11-18'}),{...task(4,'Wrong section'),section:'Home'},row(5)];const before=structuredClone(s.state.rows),fields=compile('open work tasks due 2026-11-17');assert.equal(s.state.reads,0);
 const result=await s.call('search',fields);assert.equal(result.status,200);assert.equal(result.data.matchCount,1);assert.deepEqual(result.data.results.map(r=>r.title),['Fictional matching task']);assert.equal(s.state.reads,1);assert.equal(s.state.selected,0);assert.equal(s.state.writes,0);assert.deepEqual(s.state.rows,before);assert.doesNotMatch(result.text,/PRIVATE_|payload|owner_id|description|location/);
});
test('compiled date filters include saved overlapping events without reading their bodies',async t=>{
 const s=await setup(t);s.state.rows=[{...row(1),payload:{...row(1).payload,day:'2026-11-16',end_day:'2026-11-18',end_time:'11:00'}},{...row(2),payload:{...row(2).payload,day:'2026-11-19'}}];const result=await s.call('search',compile('calendar events on 2026-11-17'));assert.equal(result.status,200);assert.equal(result.data.matchCount,1);assert.equal(result.data.results[0].title,row(1).payload.title);assert.equal(s.state.selected,0);assert.equal(s.state.writes,0);
});
test('quoted date words in note intent and ordinary title search remain literal',async t=>{
 const s=await setup(t);s.state.rows=[{...row(1),item_type:'note',section:'Personal Life',payload:{fictional:true,title:'tomorrow work tasks',body:'PRIVATE_NOTE_BODY'}},{...row(2),item_type:'note',section:'Personal Life',payload:{fictional:true,title:'Different note',body:'tomorrow work tasks'}}];
 const quoted=await s.call('search',compile('notes about "tomorrow work tasks"'));assert.equal(quoted.status,200);assert.equal(quoted.data.matchCount,1);assert.equal(quoted.data.query,'tomorrow work tasks');
 const literal=await s.call('search',{query:'tomorrow work tasks',type:'note',section:'all',status:'all',dateFrom:'',dateTo:''});assert.equal(literal.status,200);assert.equal(literal.data.matchCount,1);assert.doesNotMatch(literal.text,/PRIVATE_NOTE_BODY|payload|body/);assert.equal(s.state.writes,0);
});
test('compiled filters cannot widen disabled server date or project permissions',async t=>{
 const s=await setup(t,{dates:false});const denied=await s.call('search',compile('tasks due 2026-11-17'));assert.equal(denied.status,409);assert.equal(s.state.reads,0);
 const project=parsePrivateSearchIntent('projects',{now,allowProjects:true}).fields;assert.equal((await s.call('search',project)).status,409);assert.equal(s.state.reads,0);
 for(const phrase of ['delete all tasks','tasks except completed','projects','tasks due tomorrow'])assert.throws(()=>parsePrivateSearchIntent(phrase,{now}));assert.equal(s.state.reads,0);assert.equal(s.state.writes,0);
});
test('compiled searches retain private owner boundaries and suppress invalid sources',async t=>{
 const s=await setup(t);for(const changed of [{owner_id:other},{visibility:'household',household_id:other}]){s.state.rows=[{...task(1),...changed}];const result=await s.call('search',compile('open work tasks due 2026-11-17'));assert.equal(result.status,409);assert.doesNotMatch(result.text,/Fictional|PRIVATE_|11111111/);}assert.equal(s.state.writes,0);
});
