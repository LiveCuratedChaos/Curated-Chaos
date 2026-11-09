import test from 'node:test';import assert from 'node:assert/strict';import {createMacCalendarBridge} from '../server/mac-calendar-bridge.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',scope={calendarCount:5,maxEvents:5,startDate:'2026-11-08',endDateExclusive:'2026-12-08',timeZone:'America/New_York'},body=()=>({kind:'mac-calendar-preview-v1',calendarCount:5,...scope,events:[{title:'Fictional appointment',calendarTitle:'Fictional Home',start:'2026-11-09T02:00:00Z',end:'2026-11-09T03:00:00Z',allDay:false,notes:'PRIVATE EXTRA',url:'https://invalid.example'}]});
function setup(){let clock=Date.parse('2026-11-08T12:00:00Z'),valid=true;const bridge=createMacCalendarBridge({scope,confirmSession:async()=>valid,now:()=>clock});return{bridge,prepare:()=>bridge.prepare({ownerId,binding:'fixture-session',sessionExpiresAt:clock+600000}),expire:()=>clock+=300001,revoke:()=>valid=false};}
test('local calendar transfer is single-use and returns only whitelisted metadata to the same owner/session',async()=>{const s=setup(),grant=await s.prepare();assert.equal((await s.bridge.accept(grant.capability,body())).eventCount,1);await assert.rejects(s.bridge.accept(grant.capability,body()),/used/);const result=await s.bridge.brief({ownerId,binding:'fixture-session',day:'2026-11-08',timeZone:'America/New_York'});assert.equal(result.events.length,1);assert.equal(result.persisted,false);assert.doesNotMatch(JSON.stringify(result),/PRIVATE EXTRA|invalid.example|capability/);await assert.rejects(s.bridge.brief({ownerId:other,binding:'fixture-session',day:'2026-11-08',timeZone:'UTC'}));await assert.rejects(s.bridge.brief({ownerId,binding:'another-session',day:'2026-11-08',timeZone:'UTC'}));});
test('scope changes, excessive count, invalid dates and expired/revoked sessions reject transfer',async()=>{for(const mutate of [b=>b.calendarCount=4,b=>b.events=Array(6).fill(b.events[0]),b=>b.events[0].end='invalid',b=>b.startDate='2026-11-09']){const s=setup(),grant=await s.prepare(),payload=body();mutate(payload);await assert.rejects(s.bridge.accept(grant.capability,payload));}const s=setup(),grant=await s.prepare();s.expire();await assert.rejects(s.bridge.accept(grant.capability,body()));const r=setup(),g=await r.prepare();r.revoke();await assert.rejects(r.bridge.accept(g.capability,body()));});
test('sign-out forgets snapshots and expiry prevents reopening without any provider reread',async()=>{const s=setup(),grant=await s.prepare();await s.bridge.accept(grant.capability,body());s.bridge.forgetSession(ownerId,'fixture-session');await assert.rejects(s.bridge.brief({ownerId,binding:'fixture-session',day:'2026-11-08',timeZone:'UTC'}));});
test('malformed timestamps cannot roll into another day or silently change all-day dates',async()=>{
 for(const [start,end,allDay] of [
  ['2026-11-31T12:00:00Z','2026-12-01T14:00:00Z',false],
  ['2026-11-09T24:00:00Z','2026-11-10T02:00:00Z',false],
  ['2026-11-09T02:00Z','2026-11-09T03:00Z',false],
  ['2026-11-09T02:00:00Z','2026-11-10T03:00:00Z',true]
 ]){const s=setup(),grant=await s.prepare(),payload=body();Object.assign(payload.events[0],{start,end,allDay});await assert.rejects(s.bridge.accept(grant.capability,payload));await assert.rejects(s.bridge.accept(grant.capability,body()),/used/);}
});
test('all-day previews preserve exclusive dates and timed previews use the requested viewing zone',async()=>{
 const s=setup(),grant=await s.prepare(),payload=body();Object.assign(payload.events[0],{start:'2026-11-08T00:00:00-05:00',end:'2026-11-10T00:00:00-05:00',allDay:true});await s.bridge.accept(grant.capability,payload);
 const read=day=>s.bridge.brief({ownerId,binding:'fixture-session',day,timeZone:'America/New_York'});
 assert.equal((await read('2026-11-09')).events[0].endDateExclusive,'2026-11-10');assert.equal((await read('2026-11-10')).events.length,0);
 s.expire();await assert.rejects(read('2026-11-09'),/snapshot|expired/);
});
test('forgetting a session during asynchronous authorization cannot restore its private snapshot',async()=>{
 let release,hold=false;const bridge=createMacCalendarBridge({scope,confirmSession:async()=>{if(hold)await new Promise(resolve=>release=resolve);return true;}});
 const grant=await bridge.prepare({ownerId,binding:'fixture-session',sessionExpiresAt:Date.now()+600000});hold=true;
 const pending=bridge.accept(grant.capability,body());bridge.forgetSession(ownerId,'fixture-session');hold=false;release();await assert.rejects(pending,/expired/);
 await assert.rejects(bridge.brief({ownerId,binding:'fixture-session',day:'2026-11-08',timeZone:'UTC'}),/snapshot/);
});
test('a newer preparation invalidates an earlier outstanding one-use transfer',async()=>{
 const s=setup(),old=await s.prepare(),latest=await s.prepare();await assert.rejects(s.bridge.accept(old.capability,body()),/used/);await s.bridge.accept(latest.capability,body());
});
test('the bounded approval allows only one successful transfer, including across app sessions',async()=>{
 const s=setup(),grant=await s.prepare();await s.bridge.accept(grant.capability,body());await assert.rejects(s.prepare(),/one-time transfer is already complete/);await assert.rejects(s.bridge.prepare({ownerId:other,binding:'another-session',sessionExpiresAt:Date.now()+600000}),/one-time transfer is already complete/);
});
test('identifier review is separately enabled, keeps identifiers server-side and returns detached whitelisted browser items',async()=>{
 const owner={ownerId,binding:'fixture-session'},bridge=createMacCalendarBridge({scope,confirmSession:async()=>true,captureIdentity:true}),payload=body();payload.identityReview=true;Object.assign(payload.events[0],{calendarId:'PRIVATE_CALENDAR_ID',eventId:'PRIVATE_EVENT_ID',occurrenceStart:null});let grant=await bridge.prepare({...owner,sessionExpiresAt:Date.now()+600000});assert.equal(grant.identityReview,true);await bridge.accept(grant.capability,payload);
 const items=await bridge.reviewItems(owner);assert.equal(items.events.length,1);assert.match(items.events[0].key,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(items),/PRIVATE_CALENDAR_ID|PRIVATE_EVENT_ID|occurrenceStart/);
 const brief=await bridge.brief({...owner,day:'2026-11-08',timeZone:'America/New_York'});assert.doesNotMatch(JSON.stringify(brief),/PRIVATE_CALENDAR_ID|PRIVATE_EVENT_ID|occurrenceStart/);
 const internal=await bridge.importPreview(owner);internal.events[0].title='MUTATED COPY';assert.notEqual((await bridge.reviewItems(owner)).events[0].title,'MUTATED COPY');bridge.forgetSession(ownerId,owner.binding);await assert.rejects(bridge.reviewItems(owner));
 const disabled=setup();await assert.rejects(disabled.bridge.importPreview(owner),/disabled/);
});
test('identifier review refuses mode mismatch or missing native event identities',async()=>{
 for(const missing of [true,false]){const bridge=createMacCalendarBridge({scope,confirmSession:async()=>true,captureIdentity:true}),grant=await bridge.prepare({ownerId,binding:'fixture-session',sessionExpiresAt:Date.now()+600000}),payload=body();if(missing)payload.identityReview=true;else Object.assign(payload.events[0],{calendarId:'fictional',eventId:'fictional',occurrenceStart:null});await assert.rejects(bridge.accept(grant.capability,payload));}
});
