import {macCalendarSource,macCalendarItemKey} from './mac-calendar-identity.mjs';
// Ephemeral owner/session-bound Mac calendar transfer. No provider calls or persistence.
import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {briefDayBounds,briefDateInZone} from './saved-source-brief.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function validateMacCalendarScope(scope){
 if(!scope||!Number.isInteger(scope.calendarCount)||scope.calendarCount<1||scope.calendarCount>5||!Number.isInteger(scope.maxEvents)||scope.maxEvents<1||scope.maxEvents>250)throw Error('Explicit bounded Mac calendar scope required.');
 const start=briefDayBounds(scope.startDate,scope.timeZone).start,end=briefDayBounds(scope.endDateExclusive,scope.timeZone).start,days=(Date.parse(scope.endDateExclusive)-Date.parse(scope.startDate))/86400000;
 if(end<=start||days<1||days>31)throw Error('Choose a window of 1–31 local days.');return Object.freeze({calendarCount:scope.calendarCount,maxEvents:scope.maxEvents,startDate:scope.startDate,endDateExclusive:scope.endDateExclusive,timeZone:scope.timeZone,start,end});
}
function eventInstant(value){
 if(typeof value!=='string')throw Error('Invalid Mac event timestamp.');
 const match=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
 if(!match||Number(match[2])>23||Number(match[3])>59||Number(match[4])>59||Number(match[7]||0)>23||Number(match[8]||0)>59)throw Error('Invalid Mac event timestamp.');
 // Date.parse otherwise silently rolls February 30 into March.
 briefDayBounds(match[1],'UTC');const instant=Date.parse(value);if(!Number.isFinite(instant))throw Error('Invalid Mac event timestamp.');return instant;
}
function normalizeTransfer(body,scope,captureIdentity){
 if(!body||body.kind!=='mac-calendar-preview-v1'||(body.identityReview===true)!==captureIdentity||body.calendarCount!==scope.calendarCount||body.startDate!==scope.startDate||body.endDateExclusive!==scope.endDateExclusive||body.timeZone!==scope.timeZone||!Array.isArray(body.events)||body.events.length>scope.maxEvents)throw Error('Mac preview exceeds or differs from the approved selection.');
 return body.events.map(event=>{
  if(typeof event?.title!=='string'||event.title.length>300||typeof event.calendarTitle!=='string'||event.calendarTitle.length>300||typeof event.allDay!=='boolean')throw Error('Invalid Mac event metadata.');
  const start=eventInstant(event.start),end=eventInstant(event.end);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||start>=scope.end||end<=scope.start)throw Error('Mac event dates are outside the approved window.');
  if(event.allDay){const first=briefDateInZone(start,scope.timeZone),last=briefDateInZone(end,scope.timeZone);if(first>=last||briefDayBounds(first,scope.timeZone).start!==start||briefDayBounds(last,scope.timeZone).start!==end)throw Error('All-day events must use local day boundaries.');}
  // Whitelist fields; never copy source notes, URLs, attendees, credentials or commands.
  return {...(captureIdentity?macCalendarSource(event):{}),title:event.title,calendarTitle:event.calendarTitle,allDay:event.allDay,...(event.allDay?{startDate:briefDateInZone(start,scope.timeZone),endDateExclusive:briefDateInZone(end,scope.timeZone)}:{start:new Date(start).toISOString(),end:new Date(end).toISOString()})};
 });
}
export function createMacCalendarBridge({scope,confirmSession,captureIdentity=false,now=()=>Date.now()}){
 const approved=validateMacCalendarScope(scope),grants=new Map(),snapshots=new Map(),inFlight=new Set();let completed=false;
 const actorKey=(owner,binding)=>owner+':'+binding;
 async function actor(owner,binding){if(!uuid(owner)||typeof binding!=='string'||!binding||!await confirmSession(owner,binding))throw Error('Verified current app session required.');}
 function erase(map,key){clearTimeout(map.get(key)?.timer);map.delete(key);}
 function expire(map,key,value){value.timer=setTimeout(()=>{if(map.get(key)===value)erase(map,key);},Math.max(0,value.expiresAt-now()));value.timer.unref?.();map.set(key,value);}
 function prune(){for(const [key,value] of grants)if(value.expiresAt<=now())erase(grants,key);for(const [key,value] of snapshots)if(value.expiresAt<=now())erase(snapshots,key);}
 return {
  async prepare({ownerId,binding,sessionExpiresAt}){
   prune();if(completed)throw Error('The approved one-time transfer is already complete.');await actor(ownerId,binding);if(completed)throw Error('The approved one-time transfer is already complete.');const expiresAt=Math.min(now()+300000,sessionExpiresAt);if(!Number.isFinite(expiresAt)||expiresAt<=now())throw Error('App session expired.');
   for(const grant of inFlight)if(grant.ownerId===ownerId)grant.revoked=true;
   for(const [key,value] of grants)if(value.ownerId===ownerId)erase(grants,key);
   const capability=randomBytes(32).toString('base64url');expire(grants,hash(capability),{ownerId,binding,expiresAt});return{capability,expiresAt,scope:approved,identityReview:captureIdentity};
  },
  revoke(capability){if(typeof capability==='string')erase(grants,hash(capability));},
  async accept(capability,body){
   prune();if(typeof capability!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(capability))throw Error('One-use local transfer required.');const key=hash(capability),grant=grants.get(key);if(!grant)throw Error('Transfer expired or used.');erase(grants,key);
   inFlight.add(grant);
   try{await actor(grant.ownerId,grant.binding);const events=normalizeTransfer(body,approved,captureIdentity);await actor(grant.ownerId,grant.binding);if(grant.expiresAt<=now()||grant.revoked||completed)throw Error('Transfer expired.');
   completed=true;for(const key of grants.keys())erase(grants,key);for(const other of inFlight)if(other!==grant)other.revoked=true;
   const snapshotKey=actorKey(grant.ownerId,grant.binding);erase(snapshots,snapshotKey);expire(snapshots,snapshotKey,{events,selectionId:randomUUID(),expiresAt:grant.expiresAt,receivedAt:new Date(now()).toISOString()});return{accepted:true,eventCount:events.length,expiresAt:grant.expiresAt,persisted:false};}finally{inFlight.delete(grant);}
  },
  async brief({ownerId,binding,day,timeZone}){
   prune();await actor(ownerId,binding);const snapshot=snapshots.get(actorKey(ownerId,binding));if(!snapshot)throw Error('No current Mac calendar snapshot.');const bounds=briefDayBounds(day,timeZone);
   const events=snapshot.events.filter(event=>event.allDay?event.startDate<=day&&event.endDateExclusive>day:Date.parse(event.start)<bounds.end&&Date.parse(event.end)>bounds.start).map(({calendarId,eventId,occurrenceStart,...event})=>({...event}));
   await actor(ownerId,binding);if(snapshot.expiresAt<=now()||snapshots.get(actorKey(ownerId,binding))!==snapshot)throw Error('Mac preview expired.');return{day,timeZone,events,expiresAt:snapshot.expiresAt,receivedAt:snapshot.receivedAt,source:'Mac Calendar preview',snapshot:true,persisted:false,providerRead:false};
  },
  async importPreview({ownerId,binding}){
   if(!captureIdentity)throw Error('Mac identity review is disabled.');prune();await actor(ownerId,binding);const snapshot=snapshots.get(actorKey(ownerId,binding));if(!snapshot)throw Error('No current Mac review preview.');await actor(ownerId,binding);if(snapshot.expiresAt<=now()||snapshots.get(actorKey(ownerId,binding))!==snapshot)throw Error('Mac preview expired.');
   return structuredClone({ownerId,selectionId:snapshot.selectionId,provider:'mac_calendar',previewOnly:true,persisted:false,complete:true,scope:approved,events:snapshot.events,expiresAt:snapshot.expiresAt});
  },
  async reviewItems(actor){const preview=await this.importPreview(actor);return{selectionId:preview.selectionId,expiresAt:preview.expiresAt,scope:preview.scope,persisted:false,events:preview.events.map(({calendarId,eventId,occurrenceStart,...event})=>({...event,key:macCalendarItemKey({calendarId,eventId,occurrenceStart})}))};},
  forgetSession(ownerId,binding){for(const grant of inFlight)if(grant.ownerId===ownerId&&grant.binding===binding)grant.revoked=true;erase(snapshots,actorKey(ownerId,binding));for(const [key,value] of grants)if(value.ownerId===ownerId&&value.binding===binding)erase(grants,key);},
  scope:approved
 };
}
