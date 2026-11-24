// Shared wire shape only. A reference is not permission to read or mutate its source.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const fail=()=>{throw Error('The canonical task or project reference could not be verified.');};
function reference(value,kinds){
 if(!value||!kinds.includes(value.kind))fail();
 const nested=['school-assessment','school-step'].includes(value.kind),step=value.kind==='school-step',keys=['kind','recordId',...(nested?['academicId']:[]),...(step?['assessmentId']:[])];
 if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.sort().join(',')||!uuid(value.recordId)||nested&&!uuid(value.academicId)||step&&!uuid(value.assessmentId))fail();return value;
}
export const validateCommonProjectReference=value=>reference(value,['project','school-degree','school-course','school-assessment']);
export const validateCommonTaskReference=value=>reference(value,['task','school-step']);
export function commonTaskReferencePair(task,project){validateCommonTaskReference(task);validateCommonProjectReference(project);if(task.kind==='task'&&project.kind==='project')fail();const key=ref=>[ref.kind,ref.recordId,...(ref.kind==='school-step'?[ref.assessmentId]:[]),...(['school-step','school-assessment'].includes(ref.kind)?[ref.academicId]:[])].map(v=>v.toLowerCase()).join(':');return key(task)+'|'+key(project);}
export function commonTaskSourceKey(value){validateCommonTaskReference(value);return[value.kind,value.recordId,...(value.kind==='school-step'?[value.assessmentId,value.academicId]:[])].map(v=>v.toLowerCase()).join(':');}
