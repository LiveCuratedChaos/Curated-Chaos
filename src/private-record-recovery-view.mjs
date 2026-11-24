// Verify sparse recovery replies before displaying titles or offering approval.
const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const sections={task:['Home','Personal Life','Work','School'],note:['Personal Life'],event:['Calendar']};
const retention=90*86400000;
function item(value,allowProjects){return Boolean(value&&typeof value.title==='string'&&value.title.trim()&&value.title.length<=200&&(value.type==='project'?allowProjects===true&&sections.task.includes(value.section)&&value.title===value.title.trim()&&value.title.length<=140&&!/[\u0000-\u001f\u007f]/.test(value.title):Object.hasOwn(sections,value.type)&&sections[value.type].includes(value.section)));}
function fresh(value,now){return Number.isFinite(now)&&Number.isFinite(value?.expiresAt)&&value.expiresAt>now&&value.expiresAt<=now+300000&&value.retentionDays===90;}
export function verifyPrivateRecoveryList(value,{offset=0,now=Date.now(),allowProjects=false}={}){
 if(typeof allowProjects!=='boolean'||!fresh(value,now)||!Number.isInteger(offset)||offset<0||offset>1950||offset%50!==0||value.offset!==offset||value.limit!==50||!Number.isInteger(value.matchCount)||value.matchCount<0||value.matchCount>2000||!Array.isArray(value.records)||value.records.length>50||value.records.length>Math.max(0,value.matchCount-offset)||new Set(value.records.map(row=>row?.recordToken)).size!==value.records.length||value.records.some(row=>{
  const removed=typeof row?.deletedAt==='string'&&/^\d{4}-\d\d-\d\dT/.test(row.deletedAt)?Date.parse(row.deletedAt):NaN;
  return !item(row,allowProjects)||!token(row.recordToken)||!Number.isFinite(removed)||removed>now||removed<now-retention;
 }))throw Error('Removed items could not be verified.');
 return value;
}
export function verifyPrivateRecoveryReview(value,{now=Date.now(),allowProjects=false}={}){
 if(typeof allowProjects!=='boolean'||!fresh(value,now)||!item(value,allowProjects)||!token(value.reviewId)||typeof value.restoring!=='boolean')throw Error('Item review could not be verified.');
 return value;
}
