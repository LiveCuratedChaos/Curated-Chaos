import {safeSavedAt} from './snapshot-freshness.mjs';
// Whitelisted read model; saved snapshots never imply a fresh provider sync.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text=(value,max)=>typeof value==='string'&&value.length<=max;
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function savedProviderRecords(rows,ownerId){
 if(!UUID.test(ownerId||'')||!Array.isArray(rows))throw Error('Verified saved source list required.');
 const seen=new Set();return rows.map(row=>{
  const p=row?.payload,c=p?.content,gmail=row?.item_type==='provider_email';
  if(!UUID.test(row?.id||'')||seen.has(row.id)||row.owner_id!==ownerId||row.visibility!=='private'||row.household_id!==null||row.deleted_at!=null||!['provider_email','provider_event'].includes(row.item_type)||!UUID.test(p?.connectionId||'')||p.provider!==(gmail?'gmail':'google_calendar')||!(row.origin==='google_import_qa'&&p.fictional===true&&UUID.test(p.fixtureRunId||'')||row.origin==='google_readonly'&&p.fictional===false))throw Error('Saved source permissions or identity could not be verified.');
  seen.add(row.id);
  const base={savedAt:safeSavedAt(row.created_at),id:row.id,provider:p.provider,fictional:p.fictional,snapshot:true};
  if(gmail){if(!text(c?.subject,300)||!text(c.sender,500)||!instant(c.receivedAt))throw Error('Saved message metadata is invalid.');return {...base,title:c.subject,sender:c.sender,receivedAt:c.receivedAt};}
  if(!text(c?.title,200)||!['confirmed','tentative'].includes(c.status))throw Error('Saved event metadata is invalid.');
  if(c.allDay===true){if(!day(c.startDate)||!day(c.endDateExclusive)||c.endDateExclusive<=c.startDate)throw Error('Saved all-day dates are invalid.');return {...base,title:c.title,allDay:true,startDate:c.startDate,endDateExclusive:c.endDateExclusive};}
  if(c.allDay!==false||!instant(c.start)||!instant(c.end)||Date.parse(c.end)<=Date.parse(c.start))throw Error('Saved event time is invalid.');
  return {...base,title:c.title,allDay:false,start:c.start,end:c.end};
 });
}
