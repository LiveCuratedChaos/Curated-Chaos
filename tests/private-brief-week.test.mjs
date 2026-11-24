import test from 'node:test';import assert from 'node:assert/strict';
import {privateBriefWeek,privateBriefWeekFields} from '../server/private-brief-week.mjs';
import {verifyPrivateBriefWeek} from '../src/private-brief-week.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now=Date.parse('2026-11-17T12:00:00Z'),values={anchor:'2026-11-17',range:'rolling',weekStart:0},id=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const row=(n,type,payload)=>({id:id(n),owner_id:owner,household_id:null,visibility:'private',item_type:type,section:type==='event'?'Calendar':'Work',version:1,created_at:'2026-11-01T12:00:00Z',deleted_at:null,payload:{fictional:true,...payload}});
const build=(rows=[],extra={})=>privateBriefWeek({rows,ownerId:owner,values,now,expiresAt:now+600000,allowUndated:true,...extra});
test('one saved inventory yields seven honest day summaries without bodies, identities or write handles',()=>{
 const rows=[row(1,'task',{title:'Fictional overdue',done:false,day:'2026-11-16',description:'PRIVATE_OMITTED'}),row(2,'task',{title:'Fictional optional date',done:false,day:null}),row(3,'task',{title:'Fictional later task',done:false,day:'2026-11-20'}),row(4,'event',{title:'Fictional event',day:'2026-11-18',time:'10:00',description:'PRIVATE_OMITTED'})],before=structuredClone(rows),view=build(rows);assert.equal(view.days.length,7);assert.equal(view.days[0].dueTasksCount,1);assert.equal(view.days[1].eventsCount,1);assert.equal(view.days[3].dueTasksCount,2);assert.equal(view.expiresAt,now+300000);assert.equal(view.currentRecords,true);assert.deepEqual(rows,before);assert.doesNotMatch(JSON.stringify(view),/PRIVATE_OMITTED|description|owner_id|11111111|Token|payload|Fictional optional date/);
});
test('completed tasks do not reappear as historically open and multiday events are labeled continuing',()=>{
 const view=build([row(1,'task',{title:'Current completed task',day:'2026-11-17',done:true}),row(2,'event',{title:'Spanning all-day event',day:'2026-11-17',time:'00:00',all_day:true,end_day:'2026-11-19'})]);assert.equal(view.days[0].dueTasksCount,0);assert.equal(view.days[0].events[0].allDay,true);assert.equal(view.days[0].events[0].continuing,false);assert.equal(view.days[1].events[0].continuing,true);assert.equal(view.days[2].eventsCount,1);assert.equal(view.days[3].eventsCount,0);
});
test('bounded visible titles preserve complete counts; empty and unavailable states stay distinct',()=>{
 const view=build(Array.from({length:6},(_,i)=>row(i+1,'task',{title:'Fictional task '+i,day:'2026-11-17',done:false})));assert.equal(view.days[0].dueTasksCount,6);assert.equal(view.days[0].tasks.length,3);const empty=build();assert.equal(empty.available,true);assert.ok(empty.days.every(d=>d.dueTasksCount===0&&d.eventsCount===0));assert.deepEqual(verifyPrivateBriefWeek({available:false},{anchor:values.anchor,dateView:values,now}),{available:false});
});
test('foreign/deleted/shared/duplicate inventories and unsupported query fields fail closed',()=>{
 const task=row(1,'task',{title:'Fictional private task',day:'2026-11-17',done:false});for(const patch of [{owner_id:id(2)},{visibility:'household',household_id:id(3)},{deleted_at:'2026-11-17T12:00:00Z'}])assert.throws(()=>build([{...task,...patch}]));assert.throws(()=>build([task,task]));assert.throws(()=>privateBriefWeekFields({...values,ownerId:owner}));assert.throws(()=>privateBriefWeekFields({...values,weekStart:'1'}));
});
test('malformed, extended, stale or mismatched summaries never become displayable facts',()=>{
 for(const patch of [{providerRead:true},{currentRecords:false},{expiresAt:now+300001},{checkedAt:new Date(now+1).toISOString()},{sourceRecords:0,omittedRecords:1},{payload:{private:'unexpected'}}])assert.throws(()=>verifyPrivateBriefWeek({...build(),...patch},{anchor:values.anchor,dateView:values,now}));const changed=build();changed.days[0].day='2026-11-18';assert.throws(()=>verifyPrivateBriefWeek(changed,{anchor:values.anchor,dateView:values,now}));const badCount=build();badCount.days[0].dueTasksCount=1;assert.throws(()=>verifyPrivateBriefWeek(badCount,{anchor:values.anchor,dateView:values,now}));
});
