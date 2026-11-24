// Server-only canonical references. These do not grant mutation authority or persist copies.
import {validateCommonProjectReference,validateCommonTaskReference} from '../src/private-common-task-reference.mjs';
export {validateCommonProjectReference,validateCommonTaskReference} from '../src/private-common-task-reference.mjs';
import {validateSchoolAcademicIdentities} from '../src/private-school-identities.mjs';
import {privateProjectState} from './private-projects.mjs';
import {projectTaskState} from './private-project-task-links.mjs';
import {privateSchoolState,privateSourceTimestamp} from './private-school-read.mjs';
import {verifyPrivateSchoolDetails,schoolDetailContent} from '../src/private-school-read.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const fail=()=>{throw Error('The canonical task or project source could not be verified.');};
function common(row,owner,ref){
 if(!uuid(owner)||!uuid(row?.id)||row.id.toLowerCase()!==ref.recordId.toLowerCase())fail();
 // Source revisions bind even submillisecond changes; never truncate to Date milliseconds.
 const sourceTimes={createdAt:privateSourceTimestamp(row.created_at),updatedAt:privateSourceTimestamp(row.updated_at)};
 return{reference:{...ref,recordId:row.id},source:structuredClone(row),sourceTimes};
}
function school(row,owner,ref){
 const state=privateSchoolState(row,owner),payload=row.payload;validateSchoolAcademicIdentities(payload);
 // Validate full active and archived source content before selecting any nested node.
 verifyPrivateSchoolDetails({readOnly:true,expiresAt:1,...state.fields,...schoolDetailContent(payload)},{now:0});
 if(ref.kind==='school-degree'&&payload.kind!=='degree'||ref.kind!=='school-degree'&&payload.kind!=='course')fail();
 return common(row,owner,ref);
}
function assessment(row,id){
 if(row.payload.academicIdentityVersion!==1)fail();
 const matches=row.payload.assessments.filter(a=>a.academicId.toLowerCase()===id.toLowerCase());if(matches.length!==1)fail();return matches[0];
}
export function resolveCommonProjectTarget(row,owner,value){
 const ref=validateCommonProjectReference(value);
 if(ref.kind==='project'){privateProjectState(row,owner);return{...common(row,owner,ref),title:row.payload.title,section:row.section,statusDomain:'manual',status:row.payload.status};}
 const result=school(row,owner,ref);
 if(ref.kind==='school-assessment'){const node=assessment(row,ref.academicId);return{...result,reference:{...result.reference,academicId:node.academicId},title:node.title,section:'School',statusDomain:'academic',status:node.status};}
 return{...result,title:row.payload.title,section:'School',statusDomain:ref.kind==='school-course'?'academic':null,status:ref.kind==='school-course'?row.payload.status:null};
}
export function resolveCommonTaskSource(row,owner,value){
 const ref=validateCommonTaskReference(value);
 if(ref.kind==='task'){projectTaskState(row,owner);return{...common(row,owner,ref),title:row.payload.title,section:row.section,completed:row.payload.done};}
 const result=school(row,owner,ref),parent=assessment(row,ref.assessmentId),matches=parent.tasks.filter(t=>t.academicId.toLowerCase()===ref.academicId.toLowerCase());if(matches.length!==1)fail();const node=matches[0];
 return{...result,reference:{...result.reference,assessmentId:parent.academicId,academicId:node.academicId},title:node.title,section:'School',completed:node.done};
}

