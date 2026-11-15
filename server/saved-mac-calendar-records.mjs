// Only display fields leave the server; native source identities remain inside encrypted storage.
import {safeSavedAt} from './snapshot-freshness.mjs';import {macCalendarSource} from './mac-calendar-identity.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const text=value=>typeof value==='string'&&value.length<=300;
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function savedMacCalendarRecords(rows,ownerId){
 if(!uuid(ownerId)||!Array.isArray(rows))throw Error('Verified Mac snapshot owner required.');const seen=new Set();return rows.map(row=>{
  const p=row?.payload,c=p?.content;
  if(!uuid(row?.id)||seen.has(row.id)||row.owner_id!==ownerId||row.visibility!=='private'||row.household_id!==null||row.deleted_at!=null||row.section!=='Calendar'||row.item_type!=='provider_mac_event'||p?.provider!=='mac_calendar'||!(row.origin==='apple_readonly'&&p.fictional===false||row.origin==='apple_import_qa'&&p.fictional===true&&uuid(p.fixtureRunId))||!text(c?.title)||!text(c.calendarTitle))throw Error('Private Mac snapshot could not be verified.');seen.add(row.id);macCalendarSource(p.sourceId);
  const base={id:row.id,provider:'mac_calendar',snapshot:true,fictional:p.fictional,savedAt:safeSavedAt(row.created_at),title:c.title,calendarTitle:c.calendarTitle};
  if(c.allDay===true){if(!day(c.startDate)||!day(c.endDateExclusive)||c.endDateExclusive<=c.startDate)throw Error('Invalid saved Mac all-day dates.');return{...base,allDay:true,startDate:c.startDate,endDateExclusive:c.endDateExclusive};}
  const start=safeSavedAt(c.start),end=safeSavedAt(c.end);if(c.allDay!==false||!start||!end||end<=start)throw Error('Invalid saved Mac timed event.');return{...base,allDay:false,start,end};
 });
}
