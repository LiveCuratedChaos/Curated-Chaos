import {TASK_PRIORITIES} from './task-priorities.mjs';
// Read-only task versions reuse original task validation and display, without edit authority.
import {escapeHtml as e} from './core.mjs';
import {verifyPrivateTaskDetails,renderPrivateTaskDetails} from './private-task-details-view.mjs';
import {createPrivateRecordVersionPanel} from './private-record-version-panel.mjs';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
export function verifyTaskHistoricalDetails(v,{entry,now=Date.now(),maxExpiry=now+300000}={}){
 if(!entry||!exact(v,['readOnly','historical','expiresAt','version','operation','capturedAt','wasDeleted','record',...(Object.hasOwn(v??{},'recoveredAt')?['recoveredAt']:[])])||v.readOnly!==true||v.historical!==true||typeof v.wasDeleted!=='boolean'||!Number.isFinite(v.expiresAt)||v.expiresAt<=now||v.expiresAt>Math.min(now+300000,maxExpiry)||['version','operation','capturedAt','recoveredAt'].some(k=>v[k]!==entry[k])||!v.record||typeof v.record.title!=='string'||!v.record.title.trim()||v.record.title.length>200||!['Home','Personal Life','Work','School'].includes(v.record.section)||typeof v.record.completed!=='boolean')throw Error('Earlier task could not be verified.');verifyPrivateTaskDetails(v.record,{title:v.record.title,section:v.record.section,completed:v.record.completed},{now,expiresAt:v.expiresAt});return v;
}
export function createPrivateTaskVersionPanel({allowPriority=false,onUsePriority=null,allowUndated=false,onUseDueDate=null,onUseField=null,...options}){
 if(typeof allowPriority!=='boolean'||typeof allowUndated!=='boolean'||[onUsePriority,onUseDueDate,onUseField].some(fn=>fn!==null&&typeof fn!=='function'))throw Error('Explicit historical task draft actions required.');
 const draftActions=onUseField?['title','description'].map(field=>({
  id:'use-'+field,label:'Use earlier task '+field+' in current draft',
  canUse:detail=>detail.record[field]!==options.source()?.[field]&&
   (field!=='title'||detail.record.title.length<=140&&detail.record.title.trim()===detail.record.title),
  onUse:detail=>onUseField(detail,field)
 })):[];
 if(allowPriority&&onUsePriority)draftActions.push({id:'use-priority',label:'Use earlier task text and priority in current draft',canUse:detail=>TASK_PRIORITIES.includes(detail.record?.priority),onUse:onUsePriority});
 if(onUseDueDate)draftActions.push({id:'use-date',label:'Use earlier due date in current draft',canUse:detail=>(allowUndated||detail.record.day!=='')&&detail.record.day!==options.source()?.day,onUse:onUseDueDate});
 return createPrivateRecordVersionPanel({...options,draftActions,kind:'task',verifyDetails:verifyTaskHistoricalDetails,renderDetails:detail=>'<h3>Earlier task</h3><p>Read only · Version '+detail.version+(detail.wasDeleted?' · Deleted at capture':'')+'</p>'+renderPrivateTaskDetails(detail.record)});
}
