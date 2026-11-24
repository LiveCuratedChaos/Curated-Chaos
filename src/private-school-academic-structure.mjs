// One additive or adjacent ordering change; canonical academic IDs remain server-internal.
import {schoolProgramProposal} from './private-school-records.mjs';
import {validateSchoolAcademicIdentities,schoolAcademicIdentityValues} from './private-school-identities.mjs';
import {ASSESSMENT_TYPES,SCHOOL_STATUSES} from './dev-school-model.mjs';
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype,exact=(v,keys)=>plain(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(','),uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),text=(v,n)=>typeof v==='string'&&v.length<=n&&v.trim().length>0&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),fail=()=>{throw Error('Exact reviewed academic structure change required.');};
const canonical=v=>Array.isArray(v)?v.map(canonical):plain(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v,equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function source(p){schoolProgramProposal(p,p.degreeId===''?null:p.degreeId);validateSchoolAcademicIdentities(p);if(p.kind!=='course')fail();if(p.academicIdentityVersion!==1){if(p.assessments.length||p.studySessions.length){const error=Error('Assign stable academic identities before changing academic structure.');error.code='SCHOOL_IDENTITIES_REQUIRED';throw error;}if(Object.hasOwn(p,'academicId'))fail();}return p;}
function keys(op){return op?.action==='add-assessment'?['action','title','type','status']:op?.action==='add-step'?['action','assessmentId','title']:op?.action==='move-assessment'?['action','assessmentId','direction']:op?.action==='move-step'?['action','assessmentId','stepId','direction']:[];}
export function applySchoolAcademicStructure(payload,operation,{idFactory}={}){
 source(payload);if(!keys(operation).length||!exact(operation,keys(operation)))fail();const p=structuredClone(payload),op=operation;let structuralChange;
 function fresh(){if(typeof idFactory!=='function')fail();const id=idFactory(),ids=schoolAcademicIdentityValues(p);if(!uuid(id)||ids.some(old=>old?.toLowerCase()===id.toLowerCase()))fail();return id;}
 function assessment(){if(!uuid(op.assessmentId))fail();const index=p.assessments.findIndex(a=>a.academicId===op.assessmentId);if(index<0)fail();return{a:p.assessments[index],index};}
 function move(array,index){if(!['up','down'].includes(op.direction))fail();const target=index+(op.direction==='up'?-1:1);if(target<0||target>=array.length)fail();[array[index],array[target]]=[array[target],array[index]];}
 if(op.action==='add-assessment'){if(p.assessments.length>=25||!text(op.title,120)||!ASSESSMENT_TYPES.includes(op.type)||!SCHOOL_STATUSES.includes(op.status))fail();p.assessments.push({academicId:fresh(),title:op.title,type:op.type,status:op.status,tasks:[]});p.academicIdentityVersion=1;structuralChange={action:op.action,title:op.title,type:op.type,status:op.status,position:p.assessments.length};}
 else if(op.action==='add-step'){const {a,index}=assessment();if(a.tasks.length>=20||!text(op.title,160))fail();a.tasks.push({academicId:fresh(),title:op.title,done:false});structuralChange={action:op.action,title:op.title,assessmentTitle:a.title,assessmentPosition:index+1,position:a.tasks.length};}
 else if(op.action==='move-assessment'){const {a,index}=assessment();move(p.assessments,index);structuralChange={action:op.action,title:a.title,direction:op.direction,from:index+1,to:index+(op.direction==='up'?-1:1)+1};}
 else{const {a,index:assessmentIndex}=assessment();if(!uuid(op.stepId))fail();const index=a.tasks.findIndex(t=>t.academicId===op.stepId);if(index<0)fail();const title=a.tasks[index].title;move(a.tasks,index);structuralChange={action:op.action,title,assessmentTitle:a.title,assessmentPosition:assessmentIndex+1,direction:op.direction,from:index+1,to:index+(op.direction==='up'?-1:1)+1};}
 source(p);return{payload:p,structuralChange};
}
export function validateSchoolAcademicStructureProposal(before,after){
 source(before);source(after);let op,newId;
 if(after.assessments.length===before.assessments.length+1){const a=after.assessments.at(-1);newId=a.academicId;op={action:'add-assessment',title:a.title,type:a.type,status:a.status};}
 else if(after.assessments.length===before.assessments.length){const index=before.assessments.findIndex((a,i)=>a.academicId!==after.assessments[i].academicId);
 if(index>=0)op={action:'move-assessment',assessmentId:before.assessments[index].academicId,direction:'down'};
 else for(let i=0;i<before.assessments.length;i++){const a=before.assessments[i],b=after.assessments[i];if(b.tasks.length===a.tasks.length+1){const t=b.tasks.at(-1);newId=t.academicId;op={action:'add-step',assessmentId:a.academicId,title:t.title};break;}if(b.tasks.length===a.tasks.length){const j=a.tasks.findIndex((t,k)=>t.academicId!==b.tasks[k].academicId);if(j>=0){op={action:'move-step',assessmentId:a.academicId,stepId:a.tasks[j].academicId,direction:'down'};break;}}}
 }
 if(!op)fail();const expected=applySchoolAcademicStructure(before,op,{idFactory:()=>newId}).payload;if(!equal(expected,after))fail();return structuredClone(after);
}
export function verifySchoolAcademicStructureReview(v,{now=Date.now()}={}){
 if(!exact(v,['reviewId','expiresAt','kind','structuralChange'])||typeof v.reviewId!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(v.reviewId)||v.kind!=='course'||!Number.isFinite(now)||!Number.isFinite(v.expiresAt)||v.expiresAt<=now||v.expiresAt>now+300000)fail();
 const c=v.structuralChange,step=['add-step','move-step'].includes(c?.action),move=['move-assessment','move-step'].includes(c?.action),position=(n,max)=>Number.isInteger(n)&&n>=1&&n<=max;
 if(!['add-assessment','add-step','move-assessment','move-step'].includes(c?.action)||!exact(c,['action','title',...(c.action==='add-assessment'?['type','status']:[]),...(step?['assessmentTitle','assessmentPosition']:[]),...(move?['direction','from','to']:['position'])])||!text(c.title,step?160:120)||step&&(!text(c.assessmentTitle,120)||!position(c.assessmentPosition,25))||c.action==='add-assessment'&&(!ASSESSMENT_TYPES.includes(c.type)||!SCHOOL_STATUSES.includes(c.status)))fail();
 if(move){if(!['up','down'].includes(c.direction)||!position(c.from,step?20:25)||!position(c.to,step?20:25)||c.to-c.from!==(c.direction==='up'?-1:1))fail();}else if(!position(c.position,step?20:25))fail();return v;
}
