import {createMacCalendarOpenRefresh} from './mac-calendar-open-refresh.mjs';import {createHash} from 'node:crypto';import {briefDateInZone} from './saved-source-brief.mjs';
// Default is one-time acceptance. On-open mode requires an explicit separately authorized adapter.
export function createPrivateMacCalendarOpenPreview({mode='one-time',maxEvents=5,selectionForOwner,readCalendarWindow,confirmSession,now=Date.now}){
 if(!['one-time','on-open'].includes(mode)||![5,25,250].includes(maxEvents))throw Error('An exact Calendar preview policy is required.');
 if([selectionForOwner,readCalendarWindow,confirmSession].some(v=>typeof v!=='function'))throw Error('Explicit read-only Mac preview adapters required.');let used=false,disposed=false;const states=new Map();
 function close(s){s.closed=true;clearTimeout(s.timer);s.coordinator.dispose();s.view=null;if(states.get(s.binding)===s)states.delete(s.binding);}
 async function current(s){if(disposed||s.closed||states.get(s.binding)!==s||!await confirmSession(s.ownerId,s.binding)||disposed||s.closed)throw Error('The Calendar preview ended.');}
 return{
  async open({ownerId,binding,sessionExpiresAt}){if(disposed||mode==='one-time'&&used||!await confirmSession(ownerId,binding))throw Error('The Calendar preview is not available.');const selected=await selectionForOwner(ownerId);if(disposed||mode==='one-time'&&used||selected?.ownerId!==ownerId||selected.maxEvents!==maxEvents||!await confirmSession(ownerId,binding))throw Error('The remembered calendar selection could not be verified.');
   const {calendarLabels,...approval}=selected,digest=createHash('sha256').update(JSON.stringify(approval)).digest('hex'),prior=states.get(binding),day=briefDateInZone(now(),'America/New_York');
   if(mode==='on-open'&&prior&&!prior.closed&&prior.ownerId===ownerId&&prior.digest===digest){if(prior.promise){const result=await prior.promise;await current(prior);return structuredClone(result);}if(prior.view?.expiresAt>now()&&prior.view.scope.startDate===day){await current(prior);return structuredClone(prior.view);}}
   if(prior)close(prior);used=true;const coordinator=createMacCalendarOpenRefresh({approval,readCalendarWindow,confirmSession,now}),s={ownerId,binding,digest,coordinator,closed:false};states.set(binding,s);
   s.promise=(async()=>{try{const opening=await coordinator.prepare({ownerId,binding,sessionExpiresAt}),preview=await coordinator.refresh({ownerId,binding,openingToken:opening.openingToken});await current(s);const result={source:preview.source,events:preview.events.map(({key,...event})=>event),scope:preview.scope,checkedAt:new Date(now()).toISOString(),expiresAt:preview.expiresAt,complete:true,background:false,persisted:false,savingEnabled:false};s.view=structuredClone(result);s.timer=setTimeout(()=>close(s),Math.max(1,result.expiresAt-now()));s.timer.unref?.();return result;}catch(error){close(s);throw error;}finally{s.promise=null;}})();return structuredClone(await s.promise);
  },
  forgetSession(ownerId,binding){const s=states.get(binding);if(s?.ownerId===ownerId)close(s);},
  dispose(){disposed=true;for(const s of states.values())close(s);states.clear();}
 };
}
