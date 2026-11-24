// Canonical nested removal snapshots; no source normalization, mutation or retention cleanup.
import {ASSESSMENT_TYPES,SCHOOL_STATUSES} from './dev-school-model.mjs';
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype,uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),fail=()=>{throw Error('Saved academic recovery records could not be verified.');};
export const SCHOOL_ACADEMIC_RECOVERY_LIMIT=100;
export {PRIVATE_RECOVERY_DAYS as SCHOOL_ACADEMIC_RECOVERY_DAYS} from './private-record-retention.mjs';
export function schoolAcademicRecoveryEntries(payload,{summary=false}={}){
 if(!plain(payload)||typeof summary!=='boolean')fail();const marked=Object.hasOwn(payload,'academicRecoveryVersion'),stored=Object.hasOwn(payload,'removedAcademicRecords');
 if(!marked){if(stored)fail();return[];}
 if(payload.kind!=='course'||payload.academicRecoveryVersion!==1||payload.academicIdentityVersion!==1)fail();if(summary)return[];
 const entries=payload.removedAcademicRecords;if(!Array.isArray(entries)||entries.length>SCHOOL_ACADEMIC_RECOVERY_LIMIT||new TextEncoder().encode(JSON.stringify(payload)).byteLength>524288)fail();
 const step=r=>{if(!plain(r)||!uuid(r.academicId)||!text(r.title,160)||typeof r.done!=='boolean')fail();};
 for(const entry of entries){
  if(!plain(entry)||Object.keys(entry).sort().join(',')!=='kind,parentAcademicId,position,record,recoveryId,removedAt'||!uuid(entry.recoveryId)||!['assessment','step'].includes(entry.kind)||!Number.isInteger(entry.position)||entry.position<1||entry.position>(entry.kind==='assessment'?25:20)||typeof entry.removedAt!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(entry.removedAt)||!Number.isFinite(Date.parse(entry.removedAt))||new Date(entry.removedAt).toISOString()!==entry.removedAt)fail();
  if(entry.kind==='assessment'){
   const r=entry.record;if(entry.parentAcademicId!==null||!plain(r)||!uuid(r.academicId)||!text(r.title,120)||!ASSESSMENT_TYPES.includes(r.type)||!SCHOOL_STATUSES.includes(r.status)||!Array.isArray(r.tasks)||r.tasks.length>20)fail();for(const task of r.tasks)step(task);
  }else{if(!uuid(entry.parentAcademicId))fail();step(entry.record);}
 }
 return entries;
}
// Includes archival nodes and recovery capabilities in the internal collision domain.
export function schoolAcademicRecoveryIdentityValues(payload){return schoolAcademicRecoveryEntries(payload).flatMap(entry=>[entry.recoveryId,entry.record.academicId,...(entry.kind==='assessment'?entry.record.tasks.map(t=>t.academicId):[])]);}
