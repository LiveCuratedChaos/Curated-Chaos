import {privateRecoveryDeadline} from './private-record-retention.mjs';
import {verifySchoolAcademicView} from './private-school-academic-content.mjs';
// Exact nested snapshots and one reviewed recovery operation; no pruning or record copies.
import {schoolProgramProposal} from './private-school-records.mjs';
import {validateSchoolAcademicIdentities,schoolAcademicIdentityValues} from './private-school-identities.mjs';
import {schoolAcademicRecoveryEntries,SCHOOL_ACADEMIC_RECOVERY_DAYS} from './private-school-academic-recovery-shape.mjs';
const retention=SCHOOL_ACADEMIC_RECOVERY_DAYS*86400000,plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype,exact=(v,k)=>plain(v)&&Object.keys(v).sort().join(',')===[...k].sort().join(','),uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),fail=()=>{throw Error('Exact reviewed academic recovery change required.');};
const canonical=v=>Array.isArray(v)?v.map(canonical):plain(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v,equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function source(p){schoolProgramProposal(p,p.degreeId===''?null:p.degreeId);validateSchoolAcademicIdentities(p);if(p.kind!=='course'||p.academicIdentityVersion!==1){const e=Error('Assign stable academic identities before changing academic records.');e.code='SCHOOL_IDENTITIES_REQUIRED';throw e;}return schoolAcademicRecoveryEntries(p);}
function stamp(v){if(typeof v!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)fail();return Date.parse(v);}
function clock(now){if(!Number.isFinite(now))fail();const iso=new Date(now).toISOString();stamp(iso);return iso;}
export function applySchoolAcademicRecovery(payload,operation,{idFactory,now=Date.now()}={}){
 const entries=source(payload),removedAt=clock(now),op=operation,p=structuredClone(payload);let recoveryChange;
 if(!plain(op)||!['remove-assessment','remove-step','restore'].includes(op.action)||!exact(op,op.action==='remove-assessment'?['action','assessmentId']:op.action==='remove-step'?['action','assessmentId','stepId']:['action','recoveryId']))fail();
 function index(id,list,key='academicId'){if(!uuid(id))fail();const n=list.findIndex(r=>r[key]===id);if(n<0)fail();return n;}
 if(op.action==='restore'){
 const i=index(op.recoveryId,entries,'recoveryId'),entry=p.removedAcademicRecords[i],age=now-stamp(entry.removedAt);if(age<0||age>retention)fail();
 if(entry.kind==='assessment'){if(p.assessments.length>=25)fail();const position=Math.min(entry.position,p.assessments.length+1);p.assessments.splice(position-1,0,entry.record);recoveryChange={action:'restore-assessment',title:entry.record.title,position,originalPosition:entry.position,stepCount:entry.record.tasks.length,removedAt:entry.removedAt};}
 else{const ai=index(entry.parentAcademicId,p.assessments),a=p.assessments[ai];if(a.tasks.length>=20)fail();const position=Math.min(entry.position,a.tasks.length+1);a.tasks.splice(position-1,0,entry.record);recoveryChange={action:'restore-step',title:entry.record.title,assessmentTitle:a.title,assessmentPosition:ai+1,position,originalPosition:entry.position,removedAt:entry.removedAt};}
 p.removedAcademicRecords.splice(i,1);
 }else{
 if(entries.length>=100||typeof idFactory!=='function')fail();const recoveryId=idFactory(),ids=schoolAcademicIdentityValues(payload);if(!uuid(recoveryId)||ids.some(id=>id.toLowerCase()===recoveryId.toLowerCase()))fail();const ai=index(op.assessmentId,p.assessments),a=p.assessments[ai];let record,position,kind,parentAcademicId;
 if(op.action==='remove-assessment'){record=p.assessments.splice(ai,1)[0];position=ai+1;kind='assessment';parentAcademicId=null;recoveryChange={action:op.action,title:record.title,assessmentPosition:position,stepCount:record.tasks.length,removedAt};}
 else{const si=index(op.stepId,a.tasks);record=a.tasks.splice(si,1)[0];position=si+1;kind='step';parentAcademicId=a.academicId;recoveryChange={action:op.action,title:record.title,assessmentTitle:a.title,assessmentPosition:ai+1,stepPosition:position,removedAt};}
 p.academicRecoveryVersion=1;p.removedAcademicRecords=[...(p.removedAcademicRecords??[]),{recoveryId,kind,parentAcademicId,position,removedAt,record}];
 }
 source(p);return{payload:p,recoveryChange};
}
export function validateSchoolAcademicRecoveryProposal(before,after,{now=Date.now()}={}){
 clock(now);const old=source(before),next=source(after);let op,options={now};
 if(next.length===old.length+1){const added=next.filter(e=>!old.some(o=>o.recoveryId===e.recoveryId));if(added.length!==1)fail();const e=added[0],time=stamp(e.removedAt);if(time>now||time<now-300000)fail();op=e.kind==='assessment'?{action:'remove-assessment',assessmentId:e.record.academicId}:{action:'remove-step',assessmentId:e.parentAcademicId,stepId:e.record.academicId};options={now:time,idFactory:()=>e.recoveryId};}
 else if(next.length===old.length-1){const removed=old.filter(e=>!next.some(n=>n.recoveryId===e.recoveryId));if(removed.length!==1)fail();op={action:'restore',recoveryId:removed[0].recoveryId};}
 else fail();const expected=applySchoolAcademicRecovery(before,op,options).payload;if(!equal(expected,after))fail();return structuredClone(after);
}
export function verifySchoolAcademicRecoveryReview(v,{now=Date.now()}={}){
 clock(now);if(!exact(v,['reviewId','expiresAt','kind','recoveryChange'])||typeof v.reviewId!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(v.reviewId)||v.kind!=='course'||!Number.isFinite(v.expiresAt)||v.expiresAt<=now||v.expiresAt>now+300000)fail();const c=v.recoveryChange,keys={ 'remove-assessment':['action','title','assessmentPosition','stepCount','removedAt'],'remove-step':['action','title','assessmentTitle','assessmentPosition','stepPosition','removedAt'],'restore-assessment':['action','title','position','originalPosition','stepCount','removedAt'],'restore-step':['action','title','assessmentTitle','assessmentPosition','position','originalPosition','removedAt']};if(!plain(c)||!Object.hasOwn(keys,c.action)||!exact(c,keys[c.action]))fail();const step=c.action.endsWith('step'),text=(s,n)=>typeof s==='string'&&s.length<=n&&s.trim().length>0&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s),pos=(n,max)=>Number.isInteger(n)&&n>=1&&n<=max;
 if(!text(c.title,step?160:120)||step&&!text(c.assessmentTitle,120)||Object.hasOwn(c,'assessmentPosition')&&!pos(c.assessmentPosition,25)||Object.hasOwn(c,'stepPosition')&&!pos(c.stepPosition,20)||Object.hasOwn(c,'position')&&!pos(c.position,step?20:25)||Object.hasOwn(c,'originalPosition')&&!pos(c.originalPosition,step?20:25)||Object.hasOwn(c,'stepCount')&&(!Number.isInteger(c.stepCount)||c.stepCount<0||c.stepCount>20))fail();if(Object.hasOwn(c,'originalPosition')&&c.position>c.originalPosition)fail();const age=now-stamp(c.removedAt);if(age<0||age>(c.action.startsWith('remove-')?300000:retention))fail();
 if(c.action.startsWith('restore-')){
  const expiresAt=Math.min(v.expiresAt,privateRecoveryDeadline(c.removedAt));
  if(expiresAt!==v.expiresAt)return {...v,expiresAt};
 }
 return v;
}

export function verifySchoolAcademicRecoveryView(v,{now=Date.now()}={}){
 if(!exact(v,['viewId','expiresAt','assessments','removed']))fail();verifySchoolAcademicView({viewId:v.viewId,expiresAt:v.expiresAt,assessments:v.assessments},{now});if(!Array.isArray(v.removed)||v.removed.length>100)fail();const seen=new Set(v.assessments.flatMap(a=>[a.assessmentToken,...a.tasks.map(t=>t.stepToken)]));
 for(const r of v.removed){if(!exact(r,['recoveryToken','kind','title','parentTitle','parentPosition','originalPosition','removedAt','stepCount','canRestore','blockedReason'])||typeof r.recoveryToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(r.recoveryToken)||seen.has(r.recoveryToken)||!['assessment','step'].includes(r.kind)||typeof r.title!=='string'||!r.title.trim()||r.title.length>(r.kind==='step'?160:120)||typeof r.parentTitle!=='string'||r.parentTitle.length>120||!Number.isInteger(r.originalPosition)||r.originalPosition<1||r.originalPosition>(r.kind==='step'?20:25)||!Number.isInteger(r.stepCount)||r.stepCount<0||r.stepCount>20||typeof r.canRestore!=='boolean'||!['','future','expired','parent-unavailable','capacity'].includes(r.blockedReason))fail();seen.add(r.recoveryToken);
  let parent=null;if(r.kind==='assessment'){if(r.parentTitle!==''||r.parentPosition!==null)fail();}else{if(r.stepCount!==0||!r.parentTitle.trim())fail();if(r.parentPosition!==null){if(!Number.isInteger(r.parentPosition)||r.parentPosition<1||r.parentPosition>v.assessments.length)fail();parent=v.assessments[r.parentPosition-1];if(parent.title!==r.parentTitle)fail();}}
  const age=now-stamp(r.removedAt),reason=age<0?'future':age>retention?'expired':r.kind==='step'&&!parent?'parent-unavailable':r.kind==='assessment'?v.assessments.length>=25?'capacity':'':parent.tasks.length>=20?'capacity':'';if(r.blockedReason!==reason||r.canRestore!==(reason===''))fail();
 }return v;
}
