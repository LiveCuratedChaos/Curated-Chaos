import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarEventSource,calendarEventCategory,calendarFilterDimensions} from '../src/private-calendar-filters.mjs';

test('calendar sources use safe provenance labels and never expose origin identifiers',()=>{
 const row={item_type:'event',origin:'PRIVATE_COOKIE_EVENT_CREATE',id:'private-source-row-id',visibility:'private',household_id:null,payload:{}};
 assert.equal(calendarEventSource(row),'Manual calendar');assert.deepEqual(calendarFilterDimensions(row),{source:'Manual calendar',category:'Uncategorized',householdVisible:false});
 row.origin='google_readonly';assert.equal(calendarEventSource(row),'Saved calendar');assert.equal(JSON.stringify(calendarFilterDimensions(row)).includes('google_readonly'),false);
 assert.throws(()=>calendarEventSource({item_type:'task'}),/could not be verified/);
});
test('owner-assigned event categories default safely and reject malformed or oversized values',()=>{
 const row={item_type:'event',origin:'M1B_MANUAL_QA',payload:{calendarCategory:'Appointments'}};
 assert.equal(calendarEventCategory(row),'Appointments');row.payload.calendarCategory='  ';assert.equal(calendarEventCategory(row),'Uncategorized');row.payload.calendarCategory='x'.repeat(49);assert.throws(()=>calendarEventCategory(row),/could not be verified/);row.payload.calendarCategory='Private\nTag';assert.throws(()=>calendarEventCategory(row),/could not be verified/);
});
