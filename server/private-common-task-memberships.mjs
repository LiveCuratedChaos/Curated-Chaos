import {commonTaskReferencePair} from '../src/private-common-task-reference.mjs';
// Internal contracts only. Persistence requires the separately reviewed atomic storage writer.
import {resolveCommonProjectTarget,resolveCommonTaskSource,validateCommonProjectReference,validateCommonTaskReference} from './private-common-task-targets.mjs';
import {privateSourceTimestamp} from './private-school-read.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const fail=()=>{throw Error('Canonical task membership could not be verified.');};
export const commonTaskMembershipKey=commonTaskReferencePair;
function dedicated(task,project){if(task.kind==='task'&&project.kind==='project')fail();}
export function commonTaskMembershipState(row,owner){
 const p=row?.payload;
 if(!uuid(owner)||!uuid(row?.id)||row.owner_id!==owner||row.visibility!=='private'||row.household_id!==null||row.section!=='Personal Life'||row.item_type!=='common_task_link'||row.origin!=='PRIVATE_COOKIE_COMMON_TASK_LINK'||!Number.isInteger(row.version)||row.version<1||!exact(p,['fictional','schemaVersion','task','project'])||p.fictional!==true||p.schemaVersion!==1)fail();
 commonTaskMembershipKey(p.task,p.project);dedicated(p.task,p.project);
 const result=structuredClone(row);for(const key of ['created_at','updated_at','deleted_at']){if(key==='deleted_at'&&row[key]===null)continue;privateSourceTimestamp(row[key]);}return result;
}
export function intrinsicAcademicMembership(task,project){
 if(task.reference.kind!=='school-step')return false;
 const t=task.reference,p=project.reference;
 if(p.kind==='school-degree')return typeof task.source.payload.degreeId==='string'&&task.source.payload.degreeId.toLowerCase()===p.recordId.toLowerCase();
 return t.recordId.toLowerCase()===p.recordId.toLowerCase()&&(p.kind==='school-course'||p.kind==='school-assessment'&&p.academicId.toLowerCase()===t.assessmentId.toLowerCase());
}
export function prepareCommonTaskMembership({taskRow,projectRow,taskReference,projectReference,priorLink=null,ownerId,linked}={}){
 if(typeof linked!=='boolean')fail();
 const task=resolveCommonTaskSource(taskRow,ownerId,taskReference),project=resolveCommonProjectTarget(projectRow,ownerId,projectReference);
 dedicated(task.reference,project.reference);if(intrinsicAcademicMembership(task,project))fail();
 const key=commonTaskMembershipKey(task.reference,project.reference),before=priorLink===null?null:commonTaskMembershipState(priorLink,ownerId);
 if(before&&commonTaskMembershipKey(before.payload.task,before.payload.project)!==key)fail();
 if((before?.deleted_at===null)===linked)return{noChanges:true};
 return{task,project,before,linked,payload:{fictional:true,schemaVersion:1,task:structuredClone(task.reference),project:structuredClone(project.reference)},review:{taskTitle:task.title,projectTitle:project.title,linked,projectStatusDomain:project.statusDomain,projectStatus:project.status}};
}
