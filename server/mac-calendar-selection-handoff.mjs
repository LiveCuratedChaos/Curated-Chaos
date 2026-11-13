// Selection metadata only; no EventKit, event reads, files, database or persistent authorization.
import {randomBytes,createHash} from 'node:crypto';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),id=v=>typeof v==='string'&&v.length>0&&v.length<=1024&&!/[\u0000-\u001f\u007f]/.test(v),digest=v=>createHash('sha256').update(v).digest('hex');
export function validateCalendarSelection(value){
 if(!value||Object.keys(value).sort().join(',')!=='calendarIds,calendarLabels,maxEvents,ownerId,timeZone,windowDays'||!uuid(value.ownerId)||value.timeZone!=='America/New_York'||!Number.isInteger(value.windowDays)||value.windowDays<1||value.windowDays>31||!Number.isInteger(value.maxEvents)||value.maxEvents<1||value.maxEvents>250||!Array.isArray(value.calendarIds)||value.calendarIds.length<1||value.calendarIds.length>5||value.calendarIds.some(v=>!id(v))||new Set(value.calendarIds).size!==value.calendarIds.length||!Array.isArray(value.calendarLabels)||value.calendarLabels.length!==value.calendarIds.length||value.calendarLabels.some(v=>typeof v!=='string'||!v.trim()||v.length>300||/[\u0000-\u001f\u007f]/.test(v)))throw Error('Exact bounded calendar selection required.');
 return structuredClone(value);
}
export function createCalendarSelectionHandoff({confirmSession,now=Date.now}={}){
 if(typeof confirmSession!=='function')throw Error('Active private session verification required.');const grants=new Map(),pending=new Set(),selections=new Map();let disposed=false;
 function erase(map,key){const value=map.get(key);clearTimeout(value?.timer);if(value)value.revoked=true;map.delete(key);}
 function store(map,key,value){value.timer=setTimeout(()=>erase(map,key),Math.max(1,value.expiresAt-now()));value.timer.unref?.();map.set(key,value);}
 async function verify(value){if(disposed||value.revoked||value.expiresAt<=now()||!await confirmSession(value.ownerId,value.binding)||disposed||value.revoked||value.expiresAt<=now())throw Error('The private selection session ended.');}
 const actorKey=(ownerId,binding)=>ownerId+':'+binding;
 function forgetSession(ownerId,binding){for(const[k,v]of grants)if(v.ownerId===ownerId&&v.binding===binding)erase(grants,k);for(const v of pending)if(v.ownerId===ownerId&&v.binding===binding)v.revoked=true;erase(selections,actorKey(ownerId,binding));}
 return{
  async prepare({ownerId,binding,sessionExpiresAt,windowDays=30,maxEvents=5}={}){
   validateCalendarSelection({ownerId,windowDays,maxEvents,timeZone:'America/New_York',calendarIds:['validation-only'],calendarLabels:['Validation only']});if(!id(binding)||!Number.isFinite(sessionExpiresAt))throw Error('A verified private selection session is required.');
   const value={ownerId,binding,windowDays,maxEvents,expiresAt:Math.min(sessionExpiresAt,now()+300000)};await verify(value);forgetSession(ownerId,binding);const capability=randomBytes(32).toString('base64url');store(grants,digest(capability),value);return{capability,expiresAt:value.expiresAt,windowDays,maxEvents,maxCalendars:5,timeZone:'America/New_York',eventsRead:0,persisted:false};
  },
  async accept(capability,body){
   if(typeof capability!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(capability))throw Error('A fresh one-use selection handoff is required.');const key=digest(capability),grant=grants.get(key);if(!grant)throw Error('Selection handoff expired or used.');grants.delete(key);clearTimeout(grant.timer);pending.add(grant);
   try{await verify(grant);if(!body||Object.keys(body).sort().join(',')!=='calendarIds,calendarLabels,kind'||body.kind!=='mac-calendar-selection-v1')throw Error('Selection metadata only; event data is not accepted.');const selection=validateCalendarSelection({calendarIds:body.calendarIds,calendarLabels:body.calendarLabels,ownerId:grant.ownerId,windowDays:grant.windowDays,maxEvents:grant.maxEvents,timeZone:'America/New_York'});await verify(grant);store(selections,actorKey(grant.ownerId,grant.binding),{...grant,selection});return{accepted:true,calendarCount:selection.calendarIds.length,expiresAt:grant.expiresAt,eventsRead:0,persisted:false,refreshEnabled:false};}finally{pending.delete(grant);}
  },
  async take({ownerId,binding}={}){const key=actorKey(ownerId,binding),value=selections.get(key);if(!value)throw Error('No reviewed selection for this private session.');selections.delete(key);clearTimeout(value.timer);pending.add(value);try{await verify(value);return structuredClone(value.selection);}finally{pending.delete(value);}},
  forgetSession,
  dispose(){disposed=true;for(const key of grants.keys())erase(grants,key);for(const key of selections.keys())erase(selections,key);for(const v of pending)v.revoked=true;}
 };
}
