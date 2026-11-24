import {publicAssessmentHistory,verifyPublicAssessmentHistory} from './private-school-assessment-history.mjs';
import {schoolProgress} from './school-progress.mjs';
export {schoolProgress} from './school-progress.mjs';
// Current saved School records only; no transcript, institutional sync or write authority.
import {SCHOOL_STATUSES,ASSESSMENT_TYPES,PROGRESS_METRICS} from './dev-school-model.mjs';
const fail=()=>{throw Error('Current private School records could not be verified.');};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const text=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0);
const day=v=>v===''||typeof v==='string'&&/^(?:20\d\d|2100)-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const number=(v,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
const order=v=>v===null||Number.isInteger(v)&&v>0&&v<=999;
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const courseKeys=['code','term','status','credits','officialOrder','studyOrder','targetDate'],degreeKeys=['progressMetric','totalCredits','totalTerms','targetDate'];
export function schoolSummaryFields(p){
 if(!p||!['degree','course'].includes(p.kind)||!text(p.title,140,true))fail();
 const out={kind:p.kind,title:p.title};for(const key of p.kind==='degree'?degreeKeys:courseKeys)out[key]=p[key];
 if(!day(out.targetDate))fail();
 if(p.kind==='degree'){if(!PROGRESS_METRICS.includes(out.progressMetric)||!number(out.totalCredits,1000)||!number(out.totalTerms,100))fail();}
 else if(!text(out.code,30)||!text(out.term,40)||!SCHOOL_STATUSES.includes(out.status)||!number(out.credits,30)||!order(out.officialOrder)||!order(out.studyOrder))fail();
 return out;
}
export function verifyPrivateSchoolDetails(v,{now=Date.now()}={}){
 if(!v||!Number.isFinite(now)||v.readOnly!==true||!Number.isFinite(v.expiresAt)||v.expiresAt<=now||v.expiresAt>now+300000)fail();
 const summary=schoolSummaryFields(v),keys=['readOnly','expiresAt','kind','title',...(v.kind==='degree'?degreeKeys:[...courseKeys,'notes','assessments','studySessions'])];if(!exact(v,keys))fail();
 if(v.kind==='course'){
  if(!text(v.notes,1200)||!Array.isArray(v.assessments)||v.assessments.length>25||!Array.isArray(v.studySessions)||v.studySessions.length>50)fail();
  for(const a of v.assessments){if(!exact(a,['title','type','status','tasks',...(Object.hasOwn(a,'history')?['history']:[])])||!text(a.title,120,true)||!ASSESSMENT_TYPES.includes(a.type)||!SCHOOL_STATUSES.includes(a.status)||!Array.isArray(a.tasks)||a.tasks.length>20)fail();if(Object.hasOwn(a,'history'))verifyPublicAssessmentHistory(a.history);for(const t of a.tasks)if(!exact(t,['title','done'])||!text(t.title,160,true)||typeof t.done!=='boolean')fail();}
  for(const s of v.studySessions)if(!exact(s,['day','time','title',...(Object.hasOwn(s,'endTime')?['endTime']:[])])||Object.hasOwn(s,'endTime')&&(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s.endTime)||!s.time||s.endTime<=s.time)||!day(s.day)||!s.day||!text(s.title,100,true)||typeof s.time!=='string'||s.time!==''&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s.time))fail();
 }
 return v;
}
export function verifyPrivateSchoolOverview(v,{now=Date.now()}={}){
 if(!exact(v,['readOnly','providerRead','checkedAt','expiresAt','viewId','programs','courses'])||v.readOnly!==true||v.providerRead!==false||!token(v.viewId)||!Number.isFinite(now)||typeof v.checkedAt!=='string')fail();const checked=Date.parse(v.checkedAt);if(!Number.isFinite(checked)||new Date(checked).toISOString()!==v.checkedAt||checked>now||checked<now-300000||!Number.isFinite(v.expiresAt)||v.expiresAt<=now||v.expiresAt>checked+300000||!Array.isArray(v.programs)||!Array.isArray(v.courses)||v.programs.length+v.courses.length>2000)fail();
 const tokens=new Set();for(const p of v.programs){if(!exact(p,['schoolReadToken','title','progressMetric','done','total','percentage','courseCount'])||!token(p.schoolReadToken)||tokens.has(p.schoolReadToken)||!text(p.title,140,true)||!PROGRESS_METRICS.includes(p.progressMetric)||!number(p.done,60000)||!number(p.total,60000)||!Number.isInteger(p.courseCount)||p.courseCount<0||p.courseCount>2000||p.percentage!==(p.total?Math.min(100,Math.round(p.done/p.total*100)):0))fail();tokens.add(p.schoolReadToken);}
 for(const c of v.courses){if(!exact(c,['schoolReadToken','title',...courseKeys,'programReadToken','programTitle','association'])||!token(c.schoolReadToken)||tokens.has(c.schoolReadToken))fail();schoolSummaryFields({...c,kind:'course'});tokens.add(c.schoolReadToken);if(c.association==='linked'){const p=v.programs.find(p=>p.schoolReadToken===c.programReadToken);if(!p||p.title!==c.programTitle)fail();}else if(!['unassigned','unavailable'].includes(c.association)||c.programReadToken!==''||c.programTitle!==(c.association==='unassigned'?'Unassigned':'Program unavailable'))fail();}
 for(const p of v.programs){
  const linked=v.courses.filter(c=>c.programReadToken===p.schoolReadToken);if(linked.length!==p.courseCount)fail();
  const computed=schoolProgress({progressMetric:p.progressMetric,totalCredits:0,totalTerms:0},linked);
  if(p.done!==computed.done||p.progressMetric==='classes'&&p.total!==linked.length||p.total===0&&computed.total!==0)fail();
 }return v;
}

// Project known detail fields for display; retain the original source object for writes.
export function schoolDetailContent(p){return p.kind==='course'?{notes:p.notes,assessments:Array.isArray(p.assessments)?p.assessments.map(a=>({title:a?.title,type:a?.type,status:a?.status,tasks:Array.isArray(a?.tasks)?a.tasks.map(t=>({title:t?.title,done:t?.done})):a?.tasks,...(Object.hasOwn(a,'learningRecord')?{history:publicAssessmentHistory(a)}:{})})):p.assessments,studySessions:Array.isArray(p.studySessions)?p.studySessions.map(s=>({day:s?.day,time:s?.time,title:s?.title,...(s&&Object.hasOwn(s,'endTime')?{endTime:s.endTime}:{})})):p.studySessions}:{};}
