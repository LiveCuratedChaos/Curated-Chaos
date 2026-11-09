import test from 'node:test';
import assert from 'node:assert/strict';
import {savedProviderRecords} from '../server/saved-provider-records.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const row=()=>({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',owner_id:ownerId,visibility:'private',household_id:null,deleted_at:null,item_type:'provider_email',origin:'google_import_qa',payload:{fictional:true,fixtureRunId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',provider:'gmail',connectionId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',sourceId:'fixture-message',content:{subject:'Fictional mail',sender:'fixture@example.test',receivedAt:'2026-11-03T12:00:00.000Z',body:'excluded'},refreshToken:'excluded'}});
test('saved source view returns only whitelisted private snapshot fields',()=>{
 const result=savedProviderRecords([row()],ownerId);assert.equal(result[0].fictional,true);assert.equal(result[0].snapshot,true);assert.equal(result[0].title,'Fictional mail');assert.doesNotMatch(JSON.stringify(result),/excluded|refreshToken|body/);
});
test('saved view rejects mixed owners, sharing, deleted data and ambiguous records',()=>{
 for(const change of [{owner_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'},{visibility:'household'},{deleted_at:'2026-11-08T00:00:00Z'},{item_type:'task'}])assert.throws(()=>savedProviderRecords([{...row(),...change}],ownerId));
 assert.throws(()=>savedProviderRecords([row(),row()],ownerId));const broken=row();broken.payload.content.receivedAt='not-a-date';assert.throws(()=>savedProviderRecords([broken],ownerId));
});
test('calendar snapshots preserve exclusive all-day boundaries',()=>{
 const event=row();event.item_type='provider_event';event.payload.provider='google_calendar';event.payload.sourceId=['primary','fixture-event'];event.payload.content={title:'Fictional all-day',status:'confirmed',allDay:true,startDate:'2026-11-10',endDateExclusive:'2026-11-12'};
 assert.equal(savedProviderRecords([event],ownerId)[0].endDateExclusive,'2026-11-12');event.payload.content.endDateExclusive='2026-11-10';assert.throws(()=>savedProviderRecords([event],ownerId));
});
test('Google save time comes only from the database copy, never message arrival or payload claims',()=>{
 const item=row();item.created_at='2026-11-08T12:00:00.123456+00:00';item.payload.savedAt='2000-01-01T00:00:00Z';assert.equal(savedProviderRecords([item],ownerId)[0].savedAt,'2026-11-08T12:00:00.123Z');delete item.created_at;assert.equal(savedProviderRecords([item],ownerId)[0].savedAt,null);
});
