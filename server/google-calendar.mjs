// Server-only preparation. No routes, OAuth flow, storage, or live connection are enabled.
// Call only after verifying the app user and reading that user's explicit calendar grants.
import {createHash} from 'node:crypto';

export const GOOGLE_CALENDAR_READ_SCOPE='https://www.googleapis.com/auth/calendar.events.readonly';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateOnly=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(value+'T12:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
};
function instant(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)||!dateOnly(value.slice(0,10)))throw Error('Calendar time requires a valid date and explicit UTC offset.');
 const parsed=Date.parse(value);if(!Number.isFinite(parsed))throw Error('Calendar time is invalid.');
 return new Date(parsed).toISOString();
}
function identifier(value,label){
 if(typeof value!=='string'||!value.length||value.length>1024||/[\u0000-\u001f\u007f]/.test(value))throw Error('Invalid '+label+'.');
 return value;
}
export function normalizeGoogleEvent(event,{ownerId,calendarId}){
 if(!UUID.test(ownerId||''))throw Error('Verified app owner required.');
 identifier(calendarId,'calendar identifier');
 if(event?.status==='cancelled')return null;
 if(!event||!['confirmed','tentative'].includes(event.status))throw Error('Calendar event status is invalid.');
 const eventId=identifier(event.id,'event identifier');
 let timing;
 if(event.start?.date&&event.end?.date){
  if(event.start.dateTime||event.end.dateTime||!dateOnly(event.start.date)||!dateOnly(event.end.date)||event.end.date<=event.start.date)throw Error('All-day calendar dates are invalid.');
  timing={allDay:true,startDate:event.start.date,endDateExclusive:event.end.date};
 }else{
  if(event.start?.date||event.end?.date)throw Error('Calendar event mixes date and timed values.');
  const start=instant(event.start?.dateTime),end=instant(event.end?.dateTime);
  if(end<=start)throw Error('Calendar event must end after it starts.');
  timing={allDay:false,start,end};
 }
 const key=createHash('sha256').update(JSON.stringify([ownerId,'google_calendar',calendarId,eventId])).digest('hex');
 return {key,ownerId,visibility:'private',provider:'google_calendar',calendarId,eventId,
  title:typeof event.summary==='string'&&event.summary.trim()?event.summary.trim().slice(0,200):'Untitled event',
  status:event.status,...timing};
}

export async function readGoogleCalendarWindow({ownerId,calendarId,authorizedCalendarIds,accessToken,timeMin,timeMax},fetcher=fetch){
 if(!UUID.test(ownerId||''))throw Error('Verified app owner required.');
 identifier(calendarId,'calendar identifier');
 if(!Array.isArray(authorizedCalendarIds)||!authorizedCalendarIds.includes(calendarId))throw Error('This calendar has not been authorized for this app user.');
 if(typeof accessToken!=='string'||!accessToken.length||/[\s\u007f]/.test(accessToken))throw Error('Calendar authorization is unavailable.');
 const start=instant(timeMin),end=instant(timeMax),span=Date.parse(end)-Date.parse(start);
 if(span<=0||span>366*86400000)throw Error('Choose a calendar window of up to 366 days.');
 const records=new Map(),seenTokens=new Set();let pageToken='';
 for(let page=0;page<20;page++){
  const url=new URL('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calendarId)+'/events');
  const params={timeMin:start,timeMax:end,singleEvents:'true',orderBy:'startTime',showDeleted:'false',maxResults:'500',fields:'nextPageToken,items(id,status,summary,start,end)'};
  for(const [name,value] of Object.entries(params))url.searchParams.set(name,value);
  if(pageToken)url.searchParams.set('pageToken',pageToken);
  let response;
  try{response=await fetcher(url.href,{method:'GET',headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});}
  catch{throw Error('Calendar could not be reached. No partial snapshot was accepted.');}
  // Do not echo provider response bodies or credentials into logs/UI errors.
  if(!response.ok)throw Error(response.status===401?'Calendar authorization expired. Reconnect to continue.':response.status===403?'Calendar access was denied. Review the approved permissions.':'Calendar refresh failed. No partial snapshot was accepted.');
  let data;try{data=await response.json();}catch{throw Error('Calendar response could not be verified.');}
  if(!data||typeof data!=='object'||Array.isArray(data)||(data.items!==undefined&&!Array.isArray(data.items)))throw Error('Calendar response could not be verified.');
  for(const event of data.items||[]){
   const record=normalizeGoogleEvent(event,{ownerId,calendarId});if(!record)continue;
   const previous=records.get(record.key);
   if(previous&&JSON.stringify(previous)!==JSON.stringify(record))throw Error('Calendar changed while loading. Refresh again before accepting this snapshot.');
   records.set(record.key,record);
   if(records.size>10000)throw Error('Calendar window contains too many events. Choose a smaller window.');
  }
  if(data.nextPageToken===undefined||data.nextPageToken==='')return {provider:'google_calendar',ownerId,calendarId,timeMin:start,timeMax:end,complete:true,events:[...records.values()]};
  pageToken=identifier(data.nextPageToken,'calendar page token');
  if(seenTokens.has(pageToken))throw Error('Calendar pagination could not be verified.');
  seenTokens.add(pageToken);
 }
 throw Error('Calendar window needs too many pages. Choose a smaller window.');
}
