import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeFictionalTask, validDay, normalizeCloudRecords, briefForDate, toggledTaskPayload } from '../src/dev-brief-model.mjs';
import { createDevApi } from '../src/dev-api.mjs';
import { allowedPublicPath } from '../tools/local-server.mjs';

const a='bb8f4c56-a302-48d3-8c40-dc2838a97221',b='aa8f4c56-a302-48d3-8c40-dc2838a97222';
const t=makeFictionalTask({title:'  Fictional school task  ',day:'2026-10-30',section:'School'},a);
const record={id:'cc8f4c56-a302-48d3-8c40-dc2838a97223',owner_id:a,household_id:null,visibility:'private',section:'School',item_type:'task',payload:t.payload,created_at:'2026-10-29T12:00:00Z'};

test('M0D public route only provides two approved JS modules and HTML',()=>{
  for(const route of ['/dev-brief.html','/src/dev-brief.mjs','/src/dev-brief-model.mjs'])assert.equal(allowedPublicPath(route),true,route);
  for(const route of ['/.env.local','/src/.env.local','/src/../tools/verify-rls.mjs','/tools/dev-env.mjs'])assert.equal(allowedPublicPath(route),false,route);
});
test('fictional task is private, owned, and in a recognized section',()=>{
  assert.equal(t.owner_id,a); assert.equal(t.visibility,'private');assert.equal(t.household_id,null);assert.equal(t.payload.title,'Fictional school task');assert.equal(t.payload.done,false);assert.equal(t.payload.fictional,true);assert.equal(t.payload.source,'M0D_DEV_BRIEF_TEST');
  for(const section of ['Finances','Calendar','Admin','Household'])assert.throws(()=>makeFictionalTask({title:'x',section},a));
  assert.throws(()=>makeFictionalTask({title:'x'},'invalid'));
  assert.throws(()=>makeFictionalTask({title:' '},a));
  assert.throws(()=>makeFictionalTask({title:'x'.repeat(141)},a));
});
test('date validation rejects impossible and malformed dates',()=>{
  assert.equal(validDay('2026-10-30'),true);assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2026-13-01'),false);assert.equal(validDay('yesterday'),false);
});
test('cloud note from previous tester appears, and unrelated records are filtered in UI too',()=>{
  const ownNote={...record,id:'dd8f4c56-a302-48d3-8c40-dc2838a97224',section:'Personal Life',item_type:'note',payload:{title:'QA Account A',body:'QA only',fictional:true}};
  const cloud=normalizeCloudRecords([record,{...record,owner_id:b},ownNote,{...record,visibility:'household'},{...record,payload:{title:'real account',day:'2026-10-30',done:false}},{...record,household_id:b}],a);
  assert.equal(cloud.tasks.length,1);assert.equal(cloud.notes.length,1);
  assert.equal(normalizeCloudRecords([record,ownNote],b).tasks.length,0);
});
test('daily brief displays due, completed, upcoming, and private notes',()=>{
  const done={...record,id:'ee8f4c56-a302-48d3-8c40-dc2838a97225',payload:{...record.payload,done:true}};
  const future={...record,id:'ff8f4c56-a302-48d3-8c40-dc2838a97226',payload:{...record.payload,day:'2026-11-01'}};
  const b=briefForDate({tasks:[record,done,future],notes:[]},'2026-10-30');
  assert.equal(b.due.length,1);assert.equal(b.doneToday.length,1);assert.equal(b.upcoming.length,1);
});
test('task toggle validates fixture and inverts done without moving scope',()=>{
  assert.deepEqual(toggledTaskPayload(record),{...t.payload,done:true});
  assert.throws(()=>toggledTaskPayload({...record,item_type:'note'}));
  assert.throws(()=>toggledTaskPayload({...record,payload:{...t.payload,fictional:false}}));
});
test('API includes authenticated RLS token and private filters for QA brief',async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,text:async()=>JSON.stringify(url.includes('PATCH')?[]:[])};};
  const api=createDevApi({supabaseUrl:'https://development123.supabase.co/',projectRef:'development123',publishableKey:'sb_publishable_fixture'},fetcher);
  await api.listBriefRecords('fake-token');await api.addFictionalTask('fake-token',t);await api.toggleFictionalTask('fake-token',record.id,a,{...t.payload,done:true},1);
  assert.match(calls[0].url,/visibility=eq\.private/);assert.match(calls[0].url,/item_type=in\.\(task,note,event\)/);
  assert.equal(calls[0].options.headers.Authorization,'Bearer fake-token');
  assert.equal(calls[1].options.method,'POST');assert.equal(calls[2].options.method,'PATCH');
  assert.match(calls[2].url,/owner_id=eq\./);
  assert.deepEqual(JSON.parse(calls[2].options.body),{payload:{...t.payload,done:true}});
});
test('connected QA interface never imports local fixture data or stores passwords directly',()=>{
  const code=readFileSync(new URL('../src/dev-brief.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(code,/localStorage|seedDemoData/);
  assert.match(code,/createDevSessionManager/);
  assert.match(code,/listBriefRecords/);
  assert.match(code,/makeFictionalTask/);
});

test('dismissal API filters private owner and sends authorized record',async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,text:async()=>JSON.stringify([])};};
  const api=createDevApi({supabaseUrl:'https://development123.supabase.co/',projectRef:'development123',publishableKey:'sb_publishable_fixture'},fetcher);
  const viewer='bb8f4c56-a302-48d3-8c40-dc2838a97221';
  await api.listSuggestionDecisions('fake-token',viewer);
  assert.match(calls[0].url,/visibility=eq.private/);
  assert.match(calls[0].url,/item_type=eq.suggestion_decision/);
  assert.match(calls[0].url,/owner_id=eq/);
  assert.equal(calls[0].options.headers.Authorization,'Bearer fake-token');
  assert.throws(()=>api.listSuggestionDecisions('fake-token','invalid-user'));
  await api.addSuggestionDecision('fake-token',{owner_id:viewer,visibility:'private',item_type:'suggestion_decision',payload:{suggestion_id:'sug-email',status:'dismissed'}});
  assert.equal(calls[1].options.method,'POST');
  assert.equal(calls[1].options.headers.Authorization,'Bearer fake-token');
});
test('connected Daily Brief saves and reloads suggestion decisions before hiding them',()=>{
  const code=readFileSync(new URL('../src/dev-brief.mjs',import.meta.url),'utf8');
  assert.match(code,/api\.listSuggestionDecisions/);
  assert.match(code,/api\.addSuggestionDecision/);
  assert.match(code,/if\(!Array\.isArray\(result\)\|\|result\.length!==1\)throw Error\('Dismissal/);
  assert.doesNotMatch(code,/dismissed\.add\(toDismiss/);
});
test('brief excludes removed records and malformed task completion state',()=>{
 const deleted={...record,deleted_at:'2026-11-08T12:00:00Z'};
 const note={...record,item_type:'note',section:'Personal Life',deleted_at:'2026-11-08T12:00:00Z'};
 const event={...record,item_type:'event',section:'Calendar',deleted_at:'2026-11-08T12:00:00Z',payload:{fictional:true,title:'Deleted fixture event',day:'2026-11-08',time:'10:00'}};
 const cloud=normalizeCloudRecords([record,deleted,note,event,{...record,payload:{...record.payload,done:'false'}},{...record,payload:{...record.payload,title:'   '}}],a);
 assert.deepEqual(cloud.tasks,[record]);assert.deepEqual(cloud.notes,[]);assert.deepEqual(cloud.events,[]);assert.throws(()=>toggledTaskPayload(deleted));
});
