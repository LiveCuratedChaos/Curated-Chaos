import test from 'node:test';import assert from 'node:assert/strict';
import {validateCalendarDayFields,verifyCalendarDay} from '../src/private-calendar-day.mjs';
const now=Date.parse('2026-11-17T12:00:00.000Z'),fields={day:'2026-11-17',query:'Fictional',offset:0},token='a'.repeat(43);
const event=(n=1)=>({type:'event',title:'Fictional event '+n,section:'Calendar',day:fields.day,time:'09:00',eventReadToken:String(n).padStart(43,'x')});
const view=()=>({...fields,limit:50,matchCount:1,omittedRecords:0,dateRangeUnavailableRecords:0,checkedAt:new Date(now).toISOString(),expiresAt:now+300000,events:[event()],readOnly:true,providerRead:false,viewId:token});
test('Calendar day fields normalize supported title filters and reject widening or coerced pages',()=>{
 assert.deepEqual(validateCalendarDayFields({day:fields.day}),{day:fields.day,query:'',offset:0});assert.deepEqual(validateCalendarDayFields({...fields,query:' Fictional '}),fields);
 for(const patch of [{day:'2026-02-30'},{day:'1999-12-31'},{day:'2101-01-01'},{day:true},{query:null},{query:'x'.repeat(101)},{query:'hidden\nline'},{offset:1},{offset:2000},{offset:'0'},{owner_id:'foreign'}])assert.throws(()=>validateCalendarDayFields({...fields,...patch}));
});
test('verified Calendar day keeps the complete sparse envelope and supports empty or paged results',()=>{
 const value=view(),before=structuredClone(value);assert.equal(verifyCalendarDay(value,fields,{now}),value);assert.deepEqual(value,before);assert.doesNotThrow(()=>verifyCalendarDay({...view(),matchCount:0,events:[]},fields,{now}));const page={...view(),offset:50,matchCount:55,events:Array.from({length:5},(_,n)=>event(n+1))};assert.doesNotThrow(()=>verifyCalendarDay(page,{...fields,offset:50},{now}));
});
test('Calendar day replies cannot add editable or recovery capabilities or unselected private fields',()=>{
 for(const patch of [{eventEditToken:token},{recordToken:token},{description:'PRIVATE_BODY'},{id:'PRIVATE_ID'},{readOnly:true},{eventReadToken:'bad'},{type:'note'},{section:'Work'}])assert.throws(()=>verifyCalendarDay({...view(),events:[{...event(),...patch}]},fields,{now}));
 for(const patch of [{extra:true},{viewId:'bad'},{readOnly:false},{providerRead:true},{query:'Changed'},{day:'2026-11-18'},{offset:50},{limit:100}])assert.throws(()=>verifyCalendarDay({...view(),...patch},fields,{now}));
});
test('stale, future, extended or contradictory Calendar day responses fail closed',()=>{
 for(const patch of [{checkedAt:new Date(now+1).toISOString()},{checkedAt:new Date(now-300001).toISOString()},{checkedAt:'invalid'},{expiresAt:now},{expiresAt:now+300001},{matchCount:0},{matchCount:2001},{matchCount:2},{omittedRecords:-1},{dateRangeUnavailableRecords:2000,omittedRecords:1}])assert.throws(()=>verifyCalendarDay({...view(),...patch},fields,{now}));
 assert.throws(()=>verifyCalendarDay({...view(),matchCount:2,events:[event(),event()]},fields,{now}));assert.throws(()=>verifyCalendarDay({...view(),offset:50,matchCount:1,events:[]},{...fields,offset:50},{now}));
});
test('chronological and selected-day overlap rules preserve overnight and all-day events but exclude midnight endings',()=>{
 const overnight={...event(),day:'2026-11-16',time:'23:00',endDay:'2026-11-17',endTime:'01:00'};assert.doesNotThrow(()=>verifyCalendarDay({...view(),events:[overnight]},fields,{now}));const allDay={...event(),day:'2026-11-16',time:'00:00',allDay:true,endDay:'2026-11-17'};assert.doesNotThrow(()=>verifyCalendarDay({...view(),events:[allDay]},fields,{now}));assert.throws(()=>verifyCalendarDay({...view(),events:[{...overnight,endTime:'00:00'}]},fields,{now}));assert.throws(()=>verifyCalendarDay({...view(),matchCount:2,events:[{...event(1),time:'10:00'},{...event(2),time:'09:00'}]},fields,{now}));
});

test('a filtered day rejects widened replies even when a row falls on the correct date',()=>{
 const filters={...fields,eventKind:'timed',eventSource:'manual',eventCategory:'Shift'};
 const row={...event(),eventSource:'Manual calendar',eventCategory:'Shift',householdVisible:false};
 const response={...view(),...filters,events:[row]};
 assert.equal(verifyCalendarDay(response,filters,{now}),response);
 for(const patch of [{eventSource:'Saved calendar'},{eventCategory:'Appointment'},{allDay:true,time:'00:00'}]){
  assert.throws(()=>verifyCalendarDay({...response,events:[{...row,...patch}]},filters,{now}));
 }
 const {eventSource,...widened}=response;
 assert.throws(()=>verifyCalendarDay(widened,filters,{now}));
});
