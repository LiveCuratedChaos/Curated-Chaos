import test from 'node:test';import assert from 'node:assert/strict';
import {makePrivateSessionPreview,validatePrivatePreviewArguments} from '../tools/private-session-preview-server.mjs';
const features={serveWorkspace:true,allowBriefRead:true,allowSearch:true,allowTaskPriorityLists:true,allowSearchDates:true,allowUndatedTasks:true,allowTaskCreate:true,allowTaskRead:true,allowTaskEdit:true,allowTaskDescriptionEdit:true,allowTaskCompletion:true,allowTaskReopen:true};
const filters={query:'Fictional',type:'task',section:'all',status:'all',priority:'all',dateFrom:'',dateTo:'',dateStatus:'all'};
async function setup(t,on=true){const preview=makePrivateSessionPreview({fixtures:true,...features,allowSavedSearches:on}),handler=preview.server.listeners('request')[0];t.after(()=>preview.dispose());let cookie='',csrf='';async function call(path,body,extra={}){const req={url:path,method:body===undefined?'GET':'POST',headers:{host:'127.0.0.1:5312',origin:'http://127.0.0.1:5312',cookie,'content-type':'application/json','x-cc-request':'workspace-session','x-cc-csrf':csrf,...extra},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},res={writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(value){this.body=value;}};await handler(req,res);const data=JSON.parse(res.body);if(res.headers['Set-Cookie'])cookie=res.headers['Set-Cookie'].split(';')[0];if(data.csrf)csrf=data.csrf;return{status:res.status,data,headers:res.headers};}await call('/auth/workspace/status');await call('/auth/workspace/login',{email:'demo@example.test',password:'fictional-only'});const send=(action,values={})=>call('/auth/workspace/saved-searches/'+action,values);return{call,send};}
async function offer(s){const response=await s.call('/auth/workspace/search',filters);assert.equal(response.status,200);assert.match(response.data.saveSearchToken,/^[A-Za-z0-9_-]{43}$/);assert.ok(response.data.saveSearchExpiresAt<=Date.now()+300000);return response.data.saveSearchToken;}
async function create(s){const key=await offer(s),view=await s.send('review',{action:'create',name:'Fictional shortcut',saveSearchToken:key});assert.equal(view.status,200);const saved=await s.send('save',{reviewId:view.data.reviewId,approved:true});assert.equal(saved.status,200);return view;}
test('saved-search routes and public capability are default-off; dependencies are explicit',async t=>{const s=await setup(t,false);assert.equal((await s.send('list')).status,404);assert.equal((await s.call('/dev-config.json')).data.privateSavedSearches,undefined);assert.throws(()=>makePrivateSessionPreview({fixtures:true,allowSavedSearches:true}));assert.throws(()=>validatePrivatePreviewArguments(['--fixtures-only','--allow-private-saved-searches']));});
test('private HTTP search offer, nonwriting review, explicit approval and replay protection',async t=>{const s=await setup(t),key=await offer(s);assert.equal((await s.send('list')).data.matchCount,0);const fresh=await offer(s),v=await s.send('review',{action:'create',name:'Fictional shortcut',saveSearchToken:fresh});assert.equal(v.status,200);assert.equal((await s.send('save',{reviewId:v.data.reviewId,approved:false})).status,409);const results=await Promise.all([s.send('save',{reviewId:v.data.reviewId,approved:true}),s.send('save',{reviewId:v.data.reviewId,approved:true})]);assert.deepEqual(results.map(v=>v.status).sort(),[200,409]);assert.equal((await s.send('list')).data.matchCount,1);assert.equal((await s.send('review',{action:'create',name:'Old offer',saveSearchToken:key})).status,409);});
test('HTTP run/rename/remove/restore preserve filters and do not execute saved search during review',async t=>{const s=await setup(t);await create(s);let list=(await s.send('list')).data,key=list.records[0].savedSearchToken;assert.deepEqual((await s.send('load',{savedSearchToken:key})).data.filters,filters);let view=await s.send('review',{action:'rename',name:'Renamed shortcut',savedSearchToken:key});assert.equal((await s.send('save',{reviewId:view.data.reviewId,approved:true})).status,200);list=(await s.send('list')).data;assert.equal(list.records[0].name,'Renamed shortcut');view=await s.send('review',{action:'remove',savedSearchToken:list.records[0].savedSearchToken});assert.equal((await s.send('save',{reviewId:view.data.reviewId,approved:true})).status,200);assert.equal((await s.send('list')).data.records.length,0);list=(await s.send('list',{removed:true})).data;key=list.records[0].savedSearchToken;assert.equal((await s.send('load',{savedSearchToken:key})).status,409);view=await s.send('review',{action:'restore',savedSearchToken:key});assert.equal((await s.send('save',{reviewId:view.data.reviewId,approved:true})).status,200);list=(await s.send('list')).data;assert.deepEqual(list.records[0].filters,filters);assert.equal((await s.call('/dev-config.json')).data.privateSavedSearches,true);});
test('wrong origins/CSRF and extra fields fail before saved-search storage actions',async t=>{const s=await setup(t),key=await offer(s);for(const headers of [{origin:'https://evil.test'},{'x-cc-csrf':'bad'},{host:'evil.test'},{'content-type':'text/plain'}])assert.equal((await s.call('/auth/workspace/saved-searches/review',{action:'create',name:'Forbidden',saveSearchToken:key},headers)).status,403);assert.equal((await s.send('review',{action:'create',name:'Forbidden',saveSearchToken:key,owner_id:'bad'})).status,409);assert.equal((await s.send('list')).data.matchCount,0);});
test('Brief refresh, cancellation and sign-out retire old saved-search reviews',async t=>{for(const action of ['refresh','cancel','logout']){const s=await setup(t),key=await offer(s),v=await s.send('review',{action:'create',name:'Fictional',saveSearchToken:key});if(action==='refresh')await s.call('/auth/workspace/brief');if(action==='cancel')await s.send('cancel');if(action==='logout')await s.call('/auth/workspace/logout',{});assert.notEqual((await s.send('save',{reviewId:v.data.reviewId,approved:true})).status,200);}});

test('the full workspace Calendar can save and rerun its exact date, category, source and event-kind selections',async t=>{
 const {privateWorkspaceFixture}=await import('./support/private-workspace-fixture.mjs');
 const {calendarWorkspaceFields,verifyCalendarWorkspaceList}=await import('../src/private-calendar-workspace.mjs');
 const {validSavedSearchFilters,savedSearchSummary}=await import('../src/private-saved-search-panel.mjs');
 const f=privateWorkspaceFixture(t,{...features,allowSavedSearches:true,allowCalendarWorkspace:true,allowCalendarDayRead:true,allowEventCreate:true,allowEventEdit:true,allowEventDetails:true});
 const b=f.tab();await b.login();const client=b.client;
 const defaultMonth=calendarWorkspaceFields({allowPriority:true,allowUndated:true});
 const month=await client.calendar(defaultMonth);verifyCalendarWorkspaceList(month,defaultMonth);
 const day=(await client.brief()).day;
 for(const [title,calendarCategory] of [['On shift','Uncategorized'],['Off shift','Other']]){
  const review=await client.reviewNewEvent({title,day,time:'09:00',end_time:'',location:'',description:'',calendarCategory});
  await client.createEvent(review.reviewId);
 }
 const narrowed={...defaultMonth,eventKind:'timed',eventSource:'manual',eventCategory:'Uncategorized'};
 const result=await client.calendar(narrowed);verifyCalendarWorkspaceList(result,narrowed);
 assert.ok(validSavedSearchFilters(narrowed));assert.match(savedSearchSummary(narrowed),/Timed events.*Manual calendar.*Uncategorized/);
 const review=await client.reviewSavedSearch({action:'create',name:'Timed manual appointments',saveSearchToken:result.saveSearchToken});
 await client.saveSavedSearch(review.reviewId);
 const list=await client.savedSearches({removed:false,offset:0});
 const saved=list.records.find(r=>r.name==='Timed manual appointments');assert.deepEqual(saved.filters,narrowed);
 const loaded=await client.loadSavedSearch(saved.savedSearchToken);assert.deepEqual(loaded.filters,narrowed);
 const rerun=await client.calendar(loaded.filters);verifyCalendarWorkspaceList(rerun,narrowed);
 const {eventKind,eventSource,eventCategory,query}=rerun;
 const schedule=await client.calendarDayList({day,query,eventKind,eventSource,eventCategory,offset:0});
 assert.ok(schedule.events.some(row=>row.title==='On shift'));
 assert.ok(schedule.events.every(row=>row.title!=='Off shift'));

 assert.equal(validSavedSearchFilters({...narrowed,eventKind:'unsupported'}),false);
});

test('saving an interpreted interval retains the original dates when the relative phrase would move', async t => {
 const {parsePrivateSearchIntent}=await import('../src/private-search-intent.mjs');
 const session=await setup(t);
 const phrase='open Work tasks due between today and tomorrow';
 const interpret=now=>parsePrivateSearchIntent(phrase,{now:Date.parse(now),allowDates:true,allowUndated:true,allowPriority:true}).fields;
 const original=interpret('2026-11-17T12:00:00Z');
 const result=await session.call('/auth/workspace/search',original);
 assert.equal(result.status,200);
 const review=await session.send('review',{action:'create',name:'Two planning days',saveSearchToken:result.data.saveSearchToken});
 assert.equal(review.status,200);
 assert.equal((await session.send('save',{reviewId:review.data.reviewId,approved:true})).status,200);
 const list=await session.send('list');
 const shortcut=list.data.records.find(row=>row.name==='Two planning days');
 const loaded=await session.send('load',{savedSearchToken:shortcut.savedSearchToken});
 assert.deepEqual(loaded.data.filters,original);
 assert.notDeepEqual(loaded.data.filters,interpret('2026-11-19T12:00:00Z'));
 const rerun=await session.call('/auth/workspace/search',loaded.data.filters);
 assert.equal(rerun.status,200);
 assert.equal(rerun.data.dateFrom,'2026-11-17');
 assert.equal(rerun.data.dateTo,'2026-11-18');
});

test('named School course and program searches preserve their type through review, load and rerun',async t=>{
 const {privateWorkspaceFixture}=await import('./support/private-workspace-fixture.mjs');
 const {savedSearchSummary}=await import('../src/private-saved-search-panel.mjs');
 const tab=privateWorkspaceFixture(t,{...features,allowSavedSearches:true,allowSchoolRead:true}).tab();
 await tab.login();
 for(const [type,kind,label] of [['school-course','course','School courses'],['school-program','degree','School programs']]){
  const query={...filters,type,section:'School',query:''};
  const result=await tab.client.search(query);
  assert.ok(result.matchCount>0);assert.ok(result.results.every(row=>row.schoolKind===kind));
  const review=await tab.client.reviewSavedSearch({action:'create',name:label,saveSearchToken:result.saveSearchToken});
  await tab.client.saveSavedSearch(review.reviewId);
  const list=await tab.client.savedSearches({removed:false,offset:0});
  const shortcut=list.records.find(row=>row.name===label);
  const loaded=await tab.client.loadSavedSearch(shortcut.savedSearchToken);
  assert.deepEqual(loaded.filters,query);assert.ok(savedSearchSummary(loaded.filters).includes(label));
  const rerun=await tab.client.search(loaded.filters);
  assert.deepEqual(rerun.results.map(row=>row.title),result.results.map(row=>row.title));
 }
});
