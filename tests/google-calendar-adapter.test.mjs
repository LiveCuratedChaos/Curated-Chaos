import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGoogleEvent,readGoogleCalendarWindow} from '../server/google-calendar.mjs';
import {ProviderReadError} from '../server/provider-read-error.mjs';
import {allowedPublicPath} from '../tools/local-server.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const config={ownerId,calendarId:'primary',authorizedCalendarIds:['primary'],accessToken:'fictional-token',timeMin:'2026-11-01T00:00:00Z',timeMax:'2026-12-01T00:00:00Z'};
const event=(id='event-one')=>({id,status:'confirmed',summary:'Fictional appointment',start:{dateTime:'2026-11-08T09:00:00-05:00'},end:{dateTime:'2026-11-08T10:00:00-05:00'}});
const response=data=>({ok:true,json:async()=>data});
test('Google calendar importer is server-only and requires an explicitly authorized calendar',async()=>{
 assert.equal(allowedPublicPath('/server/google-calendar.mjs'),false);
 let called=false;
 await assert.rejects(readGoogleCalendarWindow({...config,calendarId:'someone-else'},async()=>{called=true;}),/not been authorized/);
 assert.equal(called,false);
});
test('timed events preserve absolute instants across daylight saving offsets',()=>{
 const normalized=normalizeGoogleEvent(event(),config);
 assert.equal(normalized.start,'2026-11-08T14:00:00.000Z');
 assert.equal(normalized.end,'2026-11-08T15:00:00.000Z');
 assert.equal(normalized.visibility,'private');
 const before={...event(),start:{dateTime:'2026-11-01T01:30:00-04:00'},end:{dateTime:'2026-11-01T01:30:00-05:00'}};
 assert.equal(Date.parse(normalizeGoogleEvent(before,config).end)-Date.parse(normalizeGoogleEvent(before,config).start),3600000);
});
test('all-day events retain the provider exclusive end date without timezone shifts',()=>{
 const r=normalizeGoogleEvent({...event(),start:{date:'2026-11-08'},end:{date:'2026-11-10'}},config);
 assert.equal(r.startDate,'2026-11-08');assert.equal(r.endDateExclusive,'2026-11-10');
 assert.equal(r.allDay,true);
 assert.equal(normalizeGoogleEvent({id:'cancelled',status:'cancelled'},config),null);
});
test('event deduplication keys are isolated by owner and calendar',()=>{
 const r=normalizeGoogleEvent(event(),config);
 assert.notEqual(r.key,normalizeGoogleEvent(event(),{...config,calendarId:'other'}).key);
 assert.notEqual(r.key,normalizeGoogleEvent(event(),{...config,ownerId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}).key);
 assert.equal(r.key,normalizeGoogleEvent(event(),config).key);
});
test('paginated reads use only GET and return a complete minimal snapshot without tokens',async()=>{
 const calls=[];
 const result=await readGoogleCalendarWindow(config,async(url,options)=>{calls.push({url:new URL(url),options});return response(calls.length===1?{items:[event()],nextPageToken:'page-2'}:{items:[event('event-two')]});});
 assert.equal(result.events.length,2);assert.equal(result.complete,true);
 assert.equal(calls[1].url.searchParams.get('pageToken'),'page-2');
 for(const call of calls){assert.equal(call.url.origin,'https://www.googleapis.com');assert.equal(call.options.method,'GET');assert.equal(call.options.redirect,'error');assert.equal(call.url.searchParams.get('singleEvents'),'true');assert.doesNotMatch(call.url.href,/fictional-token/);}
 assert.doesNotMatch(JSON.stringify(result),/fictional-token|Authorization|refreshToken/);
});
test('failure on a later page returns no partial result and does not echo provider error content',async()=>{
 let count=0;
 await assert.rejects(readGoogleCalendarWindow(config,async()=>++count===1?response({items:[event()],nextPageToken:'next'}):{ok:false,status:500,json:async()=>({error:'secret-provider-body'})}),err=>/No partial/.test(err.message)&&!err.message.includes('secret-provider-body'));
});
test('expired Calendar authorization has a typed reconnect outcome without echoing provider details',async()=>{
 await assert.rejects(readGoogleCalendarWindow(config,async()=>({ok:false,status:401,json:async()=>({error:'private-provider-secret'})})),error=>error instanceof ProviderReadError&&error.outcome==='reconnect-required'&&!error.message.includes('private-provider-secret'));
});
test('pagination loops and inconsistent duplicate events fail closed',async()=>{
 await assert.rejects(readGoogleCalendarWindow(config,async()=>response({items:[event()],nextPageToken:'same'})),/pagination/);
 let count=0;
 await assert.rejects(readGoogleCalendarWindow(config,async()=>response(++count===1?{items:[event()],nextPageToken:'next'}:{items:[{...event(),summary:'Changed mid-read'}]})),/changed while loading/);
});
test('invalid dates, ambiguous times, reversed ranges and oversized windows are rejected',async()=>{
 assert.throws(()=>normalizeGoogleEvent({...event(),start:{date:'2026-02-30'},end:{date:'2026-03-03'}},config));
 assert.throws(()=>normalizeGoogleEvent({...event(),start:{dateTime:'2026-11-08T09:00:00'}},config),/explicit UTC offset/);
 assert.throws(()=>normalizeGoogleEvent({...event(),start:{dateTime:'2026-11-08T24:00:00Z'}},config),/valid date/);
 assert.throws(()=>normalizeGoogleEvent({...event(),end:{dateTime:'2026-11-08T08:00:00-05:00'}},config),/end after/);
 await assert.rejects(readGoogleCalendarWindow({...config,timeMax:'2028-01-01T00:00:00Z'},()=>{throw Error('Must not send')}),/366 days/);
});
