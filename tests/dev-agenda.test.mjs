import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeFictionalEvent,sevenDayDates,agendaForWeek} from '../src/dev-agenda-model.mjs';
import {normalizeCloudRecords} from '../src/dev-brief-model.mjs';
import {createDevApi} from '../src/dev-api.mjs';
import {allowedPublicPath} from '../tools/local-server.mjs';
const a='bb8f4c56-a302-48d3-8c40-dc2838a97221',b='aa8f4c56-a302-48d3-8c40-dc2838a97222';
test('fictional events are strictly private calendar records with real date/time validation',()=>{
  const r=makeFictionalEvent({title:' Sample check in ',day:'2026-10-30',time:'10:30'},a);
  assert.deepEqual({owner:r.owner_id,scope:r.visibility,household:r.household_id,section:r.section,type:r.item_type},
    {owner:a,scope:'private',household:null,section:'Calendar',type:'event'});
  assert.equal(r.payload.title,'Sample check in');assert.equal(r.payload.fictional,true);
  assert.throws(()=>makeFictionalEvent({title:'Real',day:'2026-10-30',time:'10:30'},'other'));
  for (const bad of ['24:01','10:60','10am',''])assert.throws(()=>makeFictionalEvent({title:'A',day:'2026-10-30',time:bad},a));
  assert.throws(()=>makeFictionalEvent({title:'A',day:'2026-02-30',time:'09:00'},a));
  assert.throws(()=>makeFictionalEvent({title:' ',day:'2026-10-30',time:'09:00'},a));
});
test('seven-day window respects calendar month rollover',()=>{
  assert.deepEqual(sevenDayDates('2026-10-30'),['2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05']);
  assert.throws(()=>sevenDayDates('2026-02-30'));
});
test('normalization enforces ownership for events and no household mixing',()=>{
  const evt=makeFictionalEvent({title:'Q',day:'2026-10-30',time:'09:00'},a);
  const row={...evt,id:'cc8f4c56-a302-48d3-8c40-dc2838a97223',created_at:'2026-10-30T09:00:00Z'};
  assert.equal(normalizeCloudRecords([row,{...row,id:'dd8f4c56-a302-48d3-8c40-dc2838a97224',owner_id:b}],a).events.length,1);
  assert.equal(normalizeCloudRecords([row],b).events.length,0);
  assert.equal(normalizeCloudRecords([{...row,visibility:'household'}],a).events.length,0);
  assert.equal(normalizeCloudRecords([{...row,payload:{...row.payload,fictional:false}}],a).events.length,0);
});
test('agenda combines and orders real private fictional task/event records without touching provider fixtures',()=>{
  const event={id:'event1',item_type:'event',payload:{title:'Meeting',day:'2026-10-30',time:'10:30',fictional:true}};
  const task={id:'task1',item_type:'task',section:'Work',payload:{title:'Task',day:'2026-10-30',done:false,fictional:true}};
  const days=agendaForWeek({events:[event],tasks:[task]},'2026-10-30');
  assert.equal(days.length,7);assert.deepEqual(days[0].items.map(x=>x.kind),['event','task']);
  assert.equal(days[1].items.length,0);
});
test('M1B routes are explicitly served and secrets remain private',()=>{
  for(const route of ['/dev-agenda.html','/src/dev-agenda.mjs','/src/dev-agenda-model.mjs'])assert.equal(allowedPublicPath(route),true);
  for(const route of ['/.env.local','/supabase/migrations/001_dev_isolation.sql'])assert.equal(allowedPublicPath(route),false);
});
test('API uses existing private record endpoint and authenticated token to add events',async()=>{
  const calls=[];const mock=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,text:async()=>JSON.stringify([])};};
  const api=createDevApi({supabaseUrl:'https://development123.supabase.co/',projectRef:'development123',publishableKey:'sb_publishable_fixture'},mock);
  await api.listBriefRecords('A');await api.addFictionalEvent('A',makeFictionalEvent({title:'X',day:'2026-10-30',time:'12:00'},a));
  assert.match(calls[0].url,/item_type=in\.\(task,note,event\)/);
  assert.match(calls[0].url,/visibility=eq.private/);
  assert.equal(calls[1].options.method,'POST');assert.equal(calls[1].options.headers.Authorization,'Bearer A');
});
test('agenda source is isolated from external providers and local storage',()=>{
  const js=readFileSync(new URL('../src/dev-agenda.mjs',import.meta.url),'utf8');
  assert.match(js,/createDevSessionManager/);assert.match(js,/makeFictionalEvent/);assert.match(js,/agendaForWeek/);
  assert.doesNotMatch(js,/localStorage|gmail\.google\.com|plaid\.com|api\.chase\.com/);
});
