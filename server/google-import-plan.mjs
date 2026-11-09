import {stableStringify} from './stable-json.mjs';
// Pure review planning. No network, database writes, or automatic tasks/events.
import {createHash} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const identity=value=>typeof value==='string'&&value.length>0&&value.length<=1024&&!/[\u0000-\u001f\u007f]/.test(value);
const text=(value,max)=>{if(typeof value!=='string'||value.length>max)throw Error('Invalid source text.');return value;};
const instant=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('Invalid source time.');return new Date(value).toISOString();};
const day=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('Invalid source day.');return value;};
function stableId(parts){const hash=createHash('sha256').update(stableStringify(parts)).digest('hex');return hash.slice(0,8)+'-'+hash.slice(8,12)+'-5'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);}
export function planGoogleSourceImport({ownerId,connectionId,selectionId,preview,selectedKeys,existing=[],fixtureRunId=null}){
 if(fixtureRunId!==null&&!UUID.test(fixtureRunId))throw Error('Invalid fictional test run.');
 if(![ownerId,connectionId,selectionId].every(v=>UUID.test(v||'')))throw Error('Verified owner, connection and selection required.');
 if(preview?.previewOnly!==true||preview.persisted!==false||preview.selectionId!==selectionId||preview.result?.ownerId!==ownerId||preview.result.complete!==true)throw Error('Use a complete preview of the current selection.');
 if(!Array.isArray(selectedKeys)||selectedKeys.length>250||new Set(selectedKeys).size!==selectedKeys.length||!selectedKeys.every(identity)||!Array.isArray(existing))throw Error('Explicit item selection required.');
 const result=preview.result,gmail=result.provider==='gmail';
 if(!gmail&&result.provider!=='google_calendar')throw Error('Unsupported source.');
 if(gmail&&(result.connectionId!==connectionId||result.content!=='metadata-only'))throw Error('Verified metadata-only preview required.');
 const rows=gmail?result.messages:result.events;
 if(!Array.isArray(rows))throw Error('Complete source rows required.');
 const byKey=new Map();for(const row of rows){if(!identity(row?.key)||byKey.has(row.key))throw Error('Ambiguous preview items.');byKey.set(row.key,row);}
 const records=selectedKeys.map(key=>{
  const row=byKey.get(key);if(!row||row.ownerId!==ownerId||row.provider!==result.provider||row.visibility!=='private')throw Error('Select only this owner’s verified preview items.');
  let sourceId,content;
  if(gmail){
   if(row.connectionId!==connectionId||!identity(row.messageId)||!identity(row.threadId))throw Error('Invalid message identity.');
   sourceId=row.messageId;content={subject:text(row.subject,300),sender:text(row.sender,500),receivedAt:instant(row.receivedAt)};
  }else{
   if(!identity(row.calendarId)||row.calendarId!==result.calendarId||!identity(row.eventId)||!['confirmed','tentative'].includes(row.status))throw Error('Invalid calendar identity.');
   sourceId=[row.calendarId,row.eventId];
   const timing=row.allDay===true?{allDay:true,startDate:day(row.startDate),endDateExclusive:day(row.endDateExclusive)}:{allDay:false,start:instant(row.start),end:instant(row.end)};
   if(timing.allDay?timing.endDateExclusive<=timing.startDate:timing.end<=timing.start)throw Error('Invalid event duration.');
   content={title:text(row.title,200),status:row.status,...timing};
  }
  const id=stableId([ownerId,result.provider,connectionId,sourceId]);
  return {id,owner_id:ownerId,household_id:null,visibility:'private',section:gmail?'Personal Life':'Calendar',item_type:gmail?'provider_email':'provider_event',origin:fixtureRunId?'google_import_qa':'google_readonly',payload:{fictional:Boolean(fixtureRunId),...(fixtureRunId?{fixtureRunId}:{}),provider:result.provider,connectionId,sourceId,content}};
 });
 const actions=records.map(record=>{
  const matches=existing.filter(row=>row?.id===record.id);
  if(!matches.length)return {action:'insert',record};
  const previous=matches[0];
  if(matches.length!==1||previous.deleted_at!=null||previous.owner_id!==ownerId||previous.visibility!=='private'||previous.household_id!==null||previous.origin!==record.origin||previous.item_type!==record.item_type||previous.payload?.connectionId!==connectionId||stableStringify(previous.payload?.sourceId)!==stableStringify(record.payload.sourceId))throw Error('Existing record conflicts with the reviewed source. Nothing may be overwritten.');
  if(stableStringify(previous.payload)!==stableStringify(record.payload)&&(!Number.isInteger(previous.version)||previous.version<1))throw Error('A verified record revision is required to plan an update.');
  return {action:stableStringify(previous.payload)===stableStringify(record.payload)?'unchanged':'review-update',record,expectedVersion:previous.version};
 });
 return {ownerId,connectionId,selectionId,requiresApproval:true,executed:false,deletes:[],actions};
}
