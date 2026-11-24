// Verify sparse recovery replies before displaying titles or offering approval.
const exactKeys=(value,keys)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys);
const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const sections={task:['Home','Personal Life','Work','School'],note:['Personal Life'],event:['Calendar']};
import {PRIVATE_RECOVERY_DAYS, privateRecoveryDeadline, withinPrivateRecoveryWindow} from './private-record-retention.mjs';
function item(value,allowProjects){return Boolean(value&&typeof value.title==='string'&&value.title.trim()&&value.title.length<=200&&(value.type==='project'?allowProjects===true&&sections.task.includes(value.section)&&value.title===value.title.trim()&&value.title.length<=140&&!/[\u0000-\u001f\u007f]/.test(value.title):Object.hasOwn(sections,value.type)&&sections[value.type].includes(value.section)));}
function fresh(value,now){return Number.isFinite(now)&&Number.isFinite(value?.expiresAt)&&value.expiresAt>now&&value.expiresAt<=now+300000&&value.retentionDays===PRIVATE_RECOVERY_DAYS;}
export function verifyPrivateRecoveryList(value,{offset=0,now=Date.now(),allowProjects=false}={}){
 if(!exactKeys(value,'expiresAt,limit,matchCount,offset,records,retentionDays')||typeof allowProjects!=='boolean'||!fresh(value,now)||!Number.isInteger(offset)||offset<0||offset>1950||offset%50!==0||value.offset!==offset||value.limit!==50||!Number.isInteger(value.matchCount)||value.matchCount<0||value.matchCount>2000||!Array.isArray(value.records)||value.records.length!==Math.min(50,Math.max(0,value.matchCount-offset))||new Set(value.records.map(row=>row?.recordToken)).size!==value.records.length||value.records.some(row=>{
  const removed=typeof row?.deletedAt==='string'&&/^\d{4}-\d\d-\d\dT/.test(row.deletedAt)?Date.parse(row.deletedAt):NaN;
  return !exactKeys(row,'deletedAt,recordToken,section,title,type')||!item(row,allowProjects)||!token(row.recordToken)||!Number.isFinite(removed)||!withinPrivateRecoveryWindow(row.deletedAt,now);
 }))throw Error('Removed items could not be verified.');
 const expiresAt=Math.min(value.expiresAt,...value.records.map(row=>privateRecoveryDeadline(row.deletedAt)));
 return expiresAt===value.expiresAt?value:{...value,expiresAt};
}
export function verifyPrivateRecoveryReview(value,{now=Date.now(),allowProjects=false,selection,sourceExpiresAt}={}){
 if(!exactKeys(value,'expiresAt,restoring,retentionDays,reviewId,section,title,type')||typeof allowProjects!=='boolean'||!fresh(value,now)||!item(value,allowProjects)||!token(value.reviewId)||typeof value.restoring!=='boolean')throw Error('Item review could not be verified.');
 if(selection===null&&value.restoring)throw Error('Item review could not be verified.');
 if(selection){
  if(!value.restoring||['title','type','section'].some(field=>value[field]!==selection[field])||!Number.isFinite(sourceExpiresAt))throw Error('The removed item changed. Fetch latest.');
  const expiresAt=Math.min(value.expiresAt,sourceExpiresAt,privateRecoveryDeadline(selection.deletedAt));
  if(!Number.isFinite(expiresAt)||expiresAt<=now)throw Error('The removed-item view expired. Fetch latest before reviewing again.');
  return expiresAt===value.expiresAt?value:{...value,expiresAt};
 }
 return value;
}
