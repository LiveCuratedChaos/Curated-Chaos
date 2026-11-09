import test from 'node:test';
import assert from 'node:assert/strict';
import {savedSourceBrief,briefDayBounds} from '../server/saved-source-brief.mjs';
test('saved brief includes overlapping UTC events, recent real mail and finance counts without money or sender details',()=>{
 const records=[{fictional:false,provider:'google_calendar',title:'Overnight',allDay:false,start:'2026-11-07T23:00:00Z',end:'2026-11-08T01:00:00Z'},{fictional:false,provider:'google_calendar',title:'Ends at midnight',allDay:false,start:'2026-11-07T22:00:00Z',end:'2026-11-08T00:00:00Z'},{fictional:false,provider:'google_calendar',title:'Multi-day',allDay:true,startDate:'2026-11-07',endDateExclusive:'2026-11-09'},{fictional:true,provider:'google_calendar',title:'QA',allDay:true,startDate:'2026-11-08',endDateExclusive:'2026-11-09'},...Array.from({length:7},(_,i)=>({fictional:false,provider:'gmail',title:'Mail '+i,receivedAt:`2026-11-0${i+1}T12:00:00Z`,sender:'PRIVATE SENDER',id:'PRIVATE ID'}))];
 const result=savedSourceBrief({day:'2026-11-08',records,finance:{accounts:[{fictional:false,currentMinor:999},{fictional:true}],transactions:[{fictional:false,amountMinor:999}]}});
 assert.deepEqual(result.events.map(x=>x.title),['Overnight','Multi-day']);assert.equal(result.recentMail.length,5);assert.equal(result.recentMail[0].title,'Mail 6');assert.equal(result.savedMailCount,7);assert.equal(result.financialAccounts,1);assert.equal(result.financialTransactions,1);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|999|QA/);assert.equal(result.providerRead,false);
});
test('saved brief validates real calendar dates and represents empty saved data without live claims',()=>{
 const args={records:[],finance:{accounts:[],transactions:[]}};assert.throws(()=>savedSourceBrief({...args,day:'2026-02-30'}));const result=savedSourceBrief({...args,day:'2026-11-08'});assert.deepEqual(result.events,[]);assert.equal(result.snapshot,true);
});
test('past-date Brief never presents later-received emails as already received',()=>{
 const records=[{fictional:false,provider:'gmail',title:'Earlier fixture',receivedAt:'2026-11-08T23:59:59Z'},{fictional:false,provider:'gmail',title:'Later fixture',receivedAt:'2026-11-09T00:00:00Z'}];const result=savedSourceBrief({day:'2026-11-08',records,finance:{accounts:[],transactions:[]}});assert.deepEqual(result.recentMail.map(x=>x.title),['Earlier fixture']);assert.equal(result.savedMailCount,2);
});
test('local Brief day boundaries handle 23-hour/25-hour New York days and reject skipped dates',()=>{
 const spring=briefDayBounds('2026-03-08','America/New_York'),fall=briefDayBounds('2026-11-01','America/New_York');assert.equal(spring.end-spring.start,23*3600000);assert.equal(fall.end-fall.start,25*3600000);assert.equal(new Date(spring.start).toISOString(),'2026-03-08T05:00:00.000Z');assert.equal(new Date(fall.end).toISOString(),'2026-11-02T05:00:00.000Z');assert.throws(()=>briefDayBounds('2026-11-08','Not/AZone'));assert.throws(()=>briefDayBounds('2011-12-30','Pacific/Apia'),/does not exist/);
});
test('time-zone selection changes event overlap and mail cutoff without implying historical financial balances',()=>{
 const records=[{fictional:false,provider:'google_calendar',title:'Local evening fixture',allDay:false,start:'2026-11-09T02:00:00Z',end:'2026-11-09T03:00:00Z'},{fictional:false,provider:'gmail',title:'Local evening mail',receivedAt:'2026-11-09T02:00:00Z'}],base={day:'2026-11-08',records,finance:{accounts:[],transactions:[]}},utc=savedSourceBrief(base),local=savedSourceBrief({...base,timeZone:'America/New_York'});assert.equal(utc.events.length,0);assert.equal(utc.recentMail.length,0);assert.equal(local.events.length,1);assert.equal(local.recentMail.length,1);assert.equal(local.timeZone,'America/New_York');assert.equal(local.providerRead,false);
});
