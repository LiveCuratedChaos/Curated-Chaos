// Complete source-bound academic task inventory. Never writes or returns authority.
import {resolveCommonProjectTarget,resolveCommonTaskSource} from './private-common-task-targets.mjs';
import {commonTaskMembershipState,intrinsicAcademicMembership} from './private-common-task-memberships.mjs';
import {commonTaskSourceKey} from '../src/private-common-task-reference.mjs';
import {privateSchoolState} from './private-school-read.mjs';
import {projectProgress,ongoingRecurringTask} from '../src/project-progress.mjs';
import {stableStringify} from './stable-json.mjs';
const fail=()=>{throw Error('Complete academic task sources could not be verified. Fetch current academic records.');};
const sameId=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const sorted=rows=>[...rows].sort((a,b)=>a.id.toLowerCase().localeCompare(b.id.toLowerCase()));
const refKey=r=>[r.kind,r.recordId,...(r.kind==='school-assessment'?[r.academicId]:[])].map(v=>v.toLowerCase()).join(':');
function unique(rows){if(!Array.isArray(rows)||rows.length>2000||new Set(rows.map(r=>r?.id?.toLowerCase())).size!==rows.length)fail();return rows;}
export async function readPrivateAcademicProjectTasks({api,actor,selectedSource,reference,isCurrent,includeVerifiedInputs=false}={}){
 if(typeof includeVerifiedInputs!=='boolean'||typeof isCurrent!=='function'||!isCurrent()||typeof actor?.accessToken!=='string'||!actor.accessToken||['getCommonTaskSource','listCommonTaskMemberships','commonTaskLinksReady','listPrivateSchoolSummaries'].some(k=>typeof api?.[k]!=='function'))fail();
 const target=resolveCommonProjectTarget(selectedSource,actor.ownerId,reference);if(target.reference.kind==='project')fail();
 const token=actor.accessToken,owner=actor.ownerId;
 async function capture(){
  const [rootRows,membershipRows,ready,summaries]=await Promise.all([api.getCommonTaskSource(token,target.reference,owner),api.listCommonTaskMemberships(token,owner),api.commonTaskLinksReady(token),target.reference.kind==='school-degree'?api.listPrivateSchoolSummaries(token,owner):[]]);
  if(!isCurrent()||ready!==true||!Array.isArray(rootRows)||rootRows.length!==1||stableStringify(rootRows[0])!==stableStringify(target.source))fail();
  resolveCommonProjectTarget(rootRows[0],owner,target.reference);unique(summaries);if(target.reference.kind==='school-degree'){const summary=summaries.find(r=>sameId(r.id,target.source.id));if(!summary||stableStringify(privateSchoolState(summary,owner))!==stableStringify(privateSchoolState(rootRows[0],owner)))fail();}const links=unique(membershipRows).map(r=>commonTaskMembershipState(r,owner)),sources=new Map([[target.source.id.toLowerCase(),rootRows[0]]]),summaryRows=[];
  for(const row of summaries){const state=privateSchoolState(row,owner);if(state.fields.kind==='course'&&sameId(state.degreeId,target.source.id))summaryRows.push(row);}
  for(let n=0;n<summaryRows.length;n+=4){if(!isCurrent())fail();const batch=await Promise.all(summaryRows.slice(n,n+4).map(row=>api.getCommonTaskSource(token,{kind:'school-course',recordId:row.id},owner)));if(!isCurrent()||batch.some(v=>!Array.isArray(v)||v.length!==1))fail();for(let j=0;j<batch.length;j++){const row=batch[j][0],summary=summaryRows[n+j];resolveCommonProjectTarget(row,owner,{kind:'school-course',recordId:summary.id});if(row.version!==summary.version||!sameId(row.payload.degreeId,target.source.id)||stableStringify(privateSchoolState(row,owner))!==stableStringify(privateSchoolState(summary,owner)))fail();sources.set(row.id.toLowerCase(),row);}}
  const included=new Set([refKey(target.reference)]),tasks=new Map();
  function add(task,{intrinsic=false,direct=false,descendant=null}={}){const key=commonTaskSourceKey(task.reference),recurring=task.reference.kind==='task'?ongoingRecurringTask(task.source.payload):false;let before=tasks.get(key);if(before){if(before.title!==task.title||before.completed!==task.completed||before.section!==task.section||before.recurring!==recurring)fail();}else{before={reference:task.reference,title:task.title,section:task.section,completed:task.completed,recurring,intrinsic:false,directLink:false,descendants:new Set()};tasks.set(key,before);if(tasks.size>2000)fail();}before.intrinsic||=intrinsic;before.directLink||=direct;if(descendant)before.descendants.add(descendant);}
  for(const row of sources.values())if(row.payload.kind==='course'){
   if(row.payload.academicIdentityVersion!==1){const error=Error('Prepare and approve original academic identities first.');error.code='SCHOOL_IDENTITIES_REQUIRED';throw error;}
   if(target.reference.kind==='school-degree')included.add(refKey({kind:'school-course',recordId:row.id}));
   for(const assessment of row.payload.assessments){if(target.reference.kind==='school-assessment'&&!sameId(assessment.academicId,target.reference.academicId))continue;included.add(refKey({kind:'school-assessment',recordId:row.id,academicId:assessment.academicId}));for(const step of assessment.tasks){const task=resolveCommonTaskSource(row,owner,{kind:'school-step',recordId:row.id,assessmentId:assessment.academicId,academicId:step.academicId});if(!intrinsicAcademicMembership(task,target))fail();add(task,{intrinsic:true});}}
  }
  const selectedLinks=links.filter(l=>l.deleted_at===null&&included.has(refKey(l.payload.project))),pairKeys=new Set();
  for(const link of links){const pair=commonTaskSourceKey(link.payload.task)+'|'+refKey(link.payload.project);if(pairKeys.has(pair))fail();pairKeys.add(pair);}
  const missing=new Map();for(const link of selectedLinks)if(!sources.has(link.payload.task.recordId.toLowerCase()))missing.set(link.payload.task.recordId.toLowerCase(),link.payload.task);
  const refs=[...missing.values()];for(let n=0;n<refs.length;n+=4){if(!isCurrent())fail();const batch=await Promise.all(refs.slice(n,n+4).map(ref=>api.getCommonTaskSource(token,ref,owner)));if(!isCurrent()||batch.some(v=>!Array.isArray(v)||v.length!==1))fail();for(let j=0;j<batch.length;j++){const row=batch[j][0];if(!sameId(row.id,refs[n+j].recordId))fail();sources.set(row.id.toLowerCase(),row);if(sources.size>2000)fail();}}
  for(const link of selectedLinks){const task=resolveCommonTaskSource(sources.get(link.payload.task.recordId.toLowerCase()),owner,link.payload.task),project=resolveCommonProjectTarget(sources.get(link.payload.project.recordId.toLowerCase()),owner,link.payload.project);if(intrinsicAcademicMembership(task,project))fail();const key=refKey(link.payload.project);add(task,{direct:key===refKey(target.reference),descendant:key===refKey(target.reference)?null:key});}
  if(!isCurrent()||tasks.size>2000)fail();const values=[...tasks.values()].map(t=>{const {descendants,...rest}=t;return{...rest,descendantLinkCount:descendants.size};}).sort((a,b)=>a.title.localeCompare(b.title)||commonTaskSourceKey(a.reference).localeCompare(commonTaskSourceKey(b.reference)));
  return{sources:sorted([...sources.values()]),fingerprint:stableStringify({root:rootRows[0],summaries:sorted(summaries),links:sorted(links),sources:sorted([...sources.values()])}),value:{sourceKind:target.reference.kind,title:target.title,academicStatus:target.status??null,progress:projectProgress(values),intrinsicCount:values.filter(t=>t.intrinsic).length,explicitCount:values.filter(t=>t.directLink||t.descendantLinkCount).length,tasks:values}};
 }
 const before=await capture(),after=await capture();if(!isCurrent()||before.fingerprint!==after.fingerprint||await api.commonTaskLinksReady(token)!==true||!isCurrent())fail();return structuredClone({...after.value,...(includeVerifiedInputs?{inventoryFingerprint:after.fingerprint,verifiedSources:after.sources}:{})});
}
