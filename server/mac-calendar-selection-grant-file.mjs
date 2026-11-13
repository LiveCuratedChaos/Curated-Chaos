import {createMacCalendarGrantPublisher} from './mac-calendar-grant-file.mjs';
// Reuse exclusive private-file handling; replace only the fixed selection endpoint.
export function createCalendarSelectionGrantPublisher(path,{origin='http://127.0.0.1:5312',now=Date.now}={}){
 if(!['http://127.0.0.1:5312','http://127.0.0.1:5313'].includes(origin))throw Error('Exact private selection origin required.');const publish=createMacCalendarGrantPublisher(path,{now});const selected=grant=>{if(!grant||!Number.isFinite(grant.expiresAt)||typeof grant.capability!=='string')throw Error('Selection handoff required.');return publish({capability:grant.capability,expiresAt:grant.expiresAt,endpoint:origin+'/auth/workspace/calendar-selection/transfer',kind:'mac-calendar-selection-grant-v1'});};selected.dispose=()=>publish.dispose();return selected;
}
