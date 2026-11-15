// Preparation only: no route, native access, scheduler, key access or persistence.
// A future authorized adapter supplies the exact selection and read-only native callback.
import {randomBytes} from 'node:crypto';
import {createMacCalendarBridge,validateMacCalendarScope} from './mac-calendar-bridge.mjs';
import {macCalendarItemKey} from './mac-calendar-identity.mjs';
import {briefDateInZone} from './saved-source-brief.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const identity=v=>typeof v==='string'&&v.length>0&&v.length<=1024&&!/[\u0000-\u001f\u007f]/.test(v);
export function createMacCalendarOpenRefresh({approval=null,confirmSession,readCalendarWindow,now=Date.now}={}){
 if(approval!==null&&(!uuid(approval.ownerId)||approval.timeZone!=='America/New_York'||!Number.isInteger(approval.windowDays)||approval.windowDays<1||approval.windowDays>31||!Number.isInteger(approval.maxEvents)||approval.maxEvents<1||approval.maxEvents>250||!Array.isArray(approval.calendarIds)||approval.calendarIds.length<1||approval.calendarIds.length>5||approval.calendarIds.some(v=>!identity(v))||new Set(approval.calendarIds).size!==approval.calendarIds.length||Object.keys(approval).some(k=>!['ownerId','timeZone','windowDays','maxEvents','calendarIds'].includes(k))||typeof confirmSession!=='function'||typeof readCalendarWindow!=='function'))throw Error('An exact approved private Calendar selection is required.');
 const allowed=approval?structuredClone(approval):null,states=new Map(),reading=new Set();let disposed=false;
 function erase(key){const s=states.get(key);if(!s)return;s.closed=true;s.controller?.abort();clearTimeout(s.timer);s.bridge?.forgetSession(s.ownerId,s.binding);states.delete(key);}
 const active=s=>!disposed&&!s.closed&&states.get(s.key)===s&&s.expiresAt>now();
 async function verify(s){if(!active(s)||!await confirmSession(s.ownerId,s.binding)||!active(s))throw Error('The private Calendar opening ended.');}
 function forgetSession(ownerId,binding){for(const[k,s]of states)if(s.ownerId===ownerId&&s.binding===binding)erase(k);}
 return{
  async prepare({ownerId,binding,sessionExpiresAt}={}){
   if(disposed)throw Error('Calendar refresh is closed.');if(!allowed)return{available:false,reason:'calendar-access-not-enabled',background:false,persisted:false};
   if(ownerId!==allowed.ownerId||!identity(binding)||!Number.isFinite(sessionExpiresAt)||sessionExpiresAt<=now()||reading.has(ownerId)||!await confirmSession(ownerId,binding)||disposed||reading.has(ownerId))throw Error('An active approved Calendar account is required.');
   const startDate=briefDateInZone(now(),allowed.timeZone),endDateExclusive=new Date(Date.parse(startDate+'T00:00:00Z')+allowed.windowDays*86400000).toISOString().slice(0,10),scope=validateMacCalendarScope({calendarCount:allowed.calendarIds.length,maxEvents:allowed.maxEvents,startDate,endDateExclusive,timeZone:allowed.timeZone});
   forgetSession(ownerId,binding);const key=randomBytes(32).toString('base64url'),s={key,ownerId,binding,scope,expiresAt:Math.min(sessionExpiresAt,now()+300000),used:false,closed:false};s.timer=setTimeout(()=>erase(key),Math.max(1,s.expiresAt-now()));s.timer.unref?.();states.set(key,s);
   return{available:true,openingToken:key,expiresAt:s.expiresAt,scope,background:false,persisted:false,savingEnabled:false};
  },
  async refresh({ownerId,binding,openingToken}={}){
   const s=states.get(openingToken);if(!s||s.ownerId!==ownerId||s.binding!==binding||s.used||reading.has(ownerId))throw Error('A fresh private Calendar opening is required.');s.used=true;reading.add(ownerId);
   try{await verify(s);s.controller=new AbortController();s.bridge=createMacCalendarBridge({scope:s.scope,captureIdentity:true,now,confirmSession:async()=>{await verify(s);return true;}});const grant=await s.bridge.prepare({ownerId,binding,sessionExpiresAt:s.expiresAt});
    const payload=await readCalendarWindow({ownerId:s.ownerId,binding:s.binding,calendarIds:[...allowed.calendarIds],scope:{...s.scope},signal:s.controller.signal});await verify(s);await s.bridge.accept(grant.capability,payload);const preview=await s.bridge.importPreview({ownerId,binding});await verify(s);
    if(preview.events.some(e=>!allowed.calendarIds.includes(e.calendarId))||new Set(preview.events.map(macCalendarItemKey)).size!==preview.events.length)throw Error('The calendar selection or event identities could not be verified.');
    const view=await s.bridge.reviewItems({ownerId,binding});await verify(s);return{...view,source:'Apple Calendar on this Mac',refreshReason:'calendar-open',complete:true,background:false,persisted:false,savingEnabled:false};
   }catch(error){erase(s.key);throw error;}finally{reading.delete(ownerId);}
  },
  forgetSession,
  dispose(){disposed=true;for(const key of states.keys())erase(key);}
 };
}
