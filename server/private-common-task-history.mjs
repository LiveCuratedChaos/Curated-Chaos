// Archive inspection only. Historical results must never authorize active linking or completion.
import {resolveCommonProjectTarget,validateCommonProjectReference,validateCommonTaskReference,resolveCommonTaskSource} from './private-common-task-targets.mjs';
import {privateSourceTimestamp} from './private-school-read.mjs';
import {schoolAcademicRecoveryEntries} from '../src/private-school-academic-recovery-shape.mjs';
import {commonTaskMembershipState,commonTaskMembershipKey,intrinsicAcademicMembership} from './private-common-task-memberships.mjs';
const fail=()=>{throw Error('Canonical membership history could not be verified.');};
const sameId=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
function validationRow(row){if(row?.deleted_at!==null)privateSourceTimestamp(row?.deleted_at);return{...structuredClone(row),deleted_at:null};}
function finish(row,result,nodeActive=true){return{...result,source:structuredClone(row),sourceTimes:{...result.sourceTimes,deletedAt:row.deleted_at===null?null:privateSourceTimestamp(row.deleted_at)},inspectionOnly:true,active:row.deleted_at===null&&nodeActive};}
function academic(row,owner,ref){return resolveCommonProjectTarget(validationRow(row),owner,{kind:'school-course',recordId:ref.recordId});}
function assessments(row){return[...row.payload.assessments.map(record=>({record,active:true})),...schoolAcademicRecoveryEntries(row.payload).filter(e=>e.kind==='assessment').map(e=>({record:e.record,active:false}))];}
function selectedAssessment(row,id){if(row.payload.academicIdentityVersion!==1)fail();const matches=assessments(row).filter(a=>sameId(a.record.academicId,id));if(matches.length!==1)fail();return matches[0];}
export function inspectCommonProjectHistory(row,owner,value){
 const ref=validateCommonProjectReference(value);
 if(ref.kind!=='school-assessment')return finish(row,resolveCommonProjectTarget(validationRow(row),owner,ref));
 const base=academic(row,owner,ref),selected=selectedAssessment(row,ref.academicId),node=selected.record;
 return finish(row,{...base,reference:{kind:ref.kind,recordId:row.id,academicId:node.academicId},title:node.title,statusDomain:'academic',status:node.status},selected.active);
}
export function inspectCommonTaskHistory(row,owner,value){
 const ref=validateCommonTaskReference(value);
 if(ref.kind==='task')return finish(row,resolveCommonTaskSource(validationRow(row),owner,ref));
 const base=academic(row,owner,ref),parent=selectedAssessment(row,ref.assessmentId),matches=[...parent.record.tasks.map(record=>({record,active:parent.active})),...schoolAcademicRecoveryEntries(row.payload).filter(e=>e.kind==='step'&&sameId(e.parentAcademicId,parent.record.academicId)).map(e=>({record:e.record,active:false}))].filter(e=>sameId(e.record.academicId,ref.academicId));
 if(matches.length!==1)fail();const selected=matches[0];return finish(row,{source:base.source,sourceTimes:base.sourceTimes,section:'School',reference:{kind:'school-step',recordId:row.id,assessmentId:parent.record.academicId,academicId:selected.record.academicId},title:selected.record.title,completed:selected.record.done},selected.active);
}
export function validateCommonTaskMembershipHistory(rows,owner){
 if(!Array.isArray(rows)||rows.length>2000)fail();const byId=new Map(),pairs=new Set();
 for(const row of rows){if(typeof row?.id!=='string'||byId.has(row.id.toLowerCase()))fail();byId.set(row.id.toLowerCase(),row);}
 for(const row of rows){if(row.item_type!=='common_task_link'&&row.origin!=='PRIVATE_COOKIE_COMMON_TASK_LINK')continue;
  const link=commonTaskMembershipState(row,owner),p=link.payload,key=commonTaskMembershipKey(p.task,p.project),taskRow=byId.get(p.task.recordId.toLowerCase()),projectRow=byId.get(p.project.recordId.toLowerCase());
  if(pairs.has(key)||!taskRow||!projectRow)fail();pairs.add(key);
  if(link.deleted_at===null){const task=resolveCommonTaskSource(taskRow,owner,p.task),project=resolveCommonProjectTarget(projectRow,owner,p.project);if(intrinsicAcademicMembership(task,project))fail();}
  else{inspectCommonTaskHistory(taskRow,owner,p.task);inspectCommonProjectHistory(projectRow,owner,p.project);}
 }
 return rows;
}
