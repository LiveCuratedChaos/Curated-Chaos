import {TASK_PRIORITIES} from './task-priorities.mjs';
// Historical title/description and explicitly selected priority or due date; never old checklist/lifecycle state.
import {verifyRecordVersionMetadata} from './private-record-version-page.mjs';
import {verifyTaskHistoricalDetails} from './private-task-version-panel.mjs';
export function taskHistoricalTextDraft(historical,{now=Date.now(),includePriority=false,includeDay=false,allowUndated=false}={}){
 if([includePriority,includeDay,allowUndated].some(value=>typeof value!=='boolean'))throw Error('Explicit historical task choices required.');
 verifyRecordVersionMetadata(historical,now);if(Object.hasOwn(historical,'recoveredAt'))verifyRecordVersionMetadata({...historical,capturedAt:historical.recoveredAt},now);
 const entry=Object.fromEntries(['version','operation','capturedAt',...(Object.hasOwn(historical,'recoveredAt')?['recoveredAt']:[])].map(k=>[k,historical[k]]));verifyTaskHistoricalDetails(historical,{entry,now,maxExpiry:now+300000});
 const {title,description}=historical.record;if(title!==title.trim()||title.length>140)throw Error('Earlier task text exceeds the current editor limits. Nothing was copied.');if(includePriority&&!TASK_PRIORITIES.includes(historical.record.priority))throw Error('Earlier priority was not captured. Current priority has not changed.');if(includeDay&&historical.record.day===''&&!allowUndated)throw Error('The earlier task had no due date. Current due date has not changed.');return{title,description,...(includePriority?{priority:historical.record.priority}:{}),...(includeDay?{day:historical.record.day}:{})};
}
