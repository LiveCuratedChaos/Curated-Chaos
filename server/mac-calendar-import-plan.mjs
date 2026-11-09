import {macCalendarSource as source,macCalendarItemKey} from './mac-calendar-identity.mjs';
export {macCalendarItemKey} from './mac-calendar-identity.mjs';
// Insert-only review planning. This does not read calendars or execute database operations.
import {createHash} from 'node:crypto';
import {stableStringify} from './stable-json.mjs';
import {validateMacCalendarScope} from './mac-calendar-bridge.mjs';
import {briefDayBounds} from './saved-source-brief.mjs';
import {safeSavedAt} from './snapshot-freshness.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const text=value=>typeof value==='string'&&value.length<=300;
const digest=value=>createHash('sha256').update(stableStringify(value)).digest('hex');
export function planMacCalendarImport({ownerId,selectionId,preview,selectedKeys,existing=[],fixtureRunId=null}){
 if(!uuid(ownerId)||!uuid(selectionId)||fixtureRunId!==null&&!uuid(fixtureRunId))throw Error('Verified Mac import owner and selection required.');
 if(preview?.ownerId!==ownerId||preview.selectionId!==selectionId||preview.provider!=='mac_calendar'||preview.previewOnly!==true||preview.persisted!==false||preview.complete!==true)throw Error('Complete owner-bound Mac preview required.');
 const scope=validateMacCalendarScope(preview.scope);
 if(!Array.isArray(preview.events)||preview.events.length>scope.maxEvents||!Array.isArray(selectedKeys)||!selectedKeys.length||selectedKeys.length>scope.maxEvents||selectedKeys.some(key=>typeof key!=='string'||! /^[a-f0-9]{64}$/.test(key))||new Set(selectedKeys).size!==selectedKeys.length||!Array.isArray(existing))throw Error('Explicit bounded Mac event selection required.');
 const byKey=new Map();for(const event of preview.events){const key=macCalendarItemKey(event);if(byKey.has(key))throw Error('Ambiguous Mac event identities.');byKey.set(key,event);}
 if(new Set([...byKey.values()].map(event=>event.calendarId)).size>scope.calendarCount)throw Error('Preview exceeds the selected calendar count.');
 const records=selectedKeys.map(key=>{
  const event=byKey.get(key);if(!event||!text(event.title)||!text(event.calendarTitle)||typeof event.allDay!=='boolean')throw Error('Selected Mac event metadata is invalid.');
  let timing,start,end;
  if(event.allDay){start=briefDayBounds(event.startDate,scope.timeZone).start;end=briefDayBounds(event.endDateExclusive,scope.timeZone).start;timing={allDay:true,startDate:event.startDate,endDateExclusive:event.endDateExclusive};}
  else{const first=safeSavedAt(event.start),last=safeSavedAt(event.end);if(!first||!last)throw Error('Valid timed Mac event required.');start=Date.parse(first);end=Date.parse(last);timing={allDay:false,start:first,end:last};}
  if(end<=start||start>=scope.end||end<=scope.start)throw Error('Selected Mac event is outside the reviewed window.');
  const sourceId=source(event),hex=digest([ownerId,'mac_calendar',sourceId]);const id=hex.slice(0,8)+'-'+hex.slice(8,12)+'-5'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32);
  return{id,owner_id:ownerId,household_id:null,visibility:'private',section:'Calendar',item_type:'provider_mac_event',origin:fixtureRunId?'apple_import_qa':'apple_readonly',payload:{provider:'mac_calendar',fictional:fixtureRunId!==null,...(fixtureRunId?{fixtureRunId}:{}),sourceId,content:{title:event.title,calendarTitle:event.calendarTitle,...timing}}};
 });
 const actions=records.map(record=>{const matches=existing.filter(row=>row?.id===record.id);if(!matches.length)return{action:'insert',record};const prior=matches[0];
  if(matches.length!==1||prior.owner_id!==ownerId||prior.visibility!=='private'||prior.household_id!==null||prior.section!=='Calendar'||prior.item_type!==record.item_type||prior.origin!==record.origin||prior.deleted_at!=null||stableStringify(prior.payload?.sourceId)!==stableStringify(record.payload.sourceId))throw Error('Existing Mac snapshot conflicts with this review. Nothing may be overwritten.');
  if(!Number.isInteger(prior.version)||prior.version<1)throw Error('Verified Mac snapshot revision required.');
  return{action:stableStringify(prior.payload)===stableStringify(record.payload)?'unchanged':'review-update',record,expectedVersion:prior.version};
 });
 return{ownerId,selectionId,requiresApproval:true,executed:false,deletes:[],actions};
}
