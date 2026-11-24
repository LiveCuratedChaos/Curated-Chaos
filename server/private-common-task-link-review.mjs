// Server-only one-use review authority for canonical memberships. No browser IDs grant access.
import {randomBytes} from 'node:crypto';
import {stableStringify} from './stable-json.mjs';
import {prepareCommonTaskMembership,commonTaskMembershipKey,commonTaskMembershipState} from './private-common-task-memberships.mjs';
import {resolveCommonTaskSource,resolveCommonProjectTarget} from './private-common-task-targets.mjs';
const token=()=>randomBytes(32).toString('base64url');
const equal=(a,b)=>stableStringify(a)===stableStringify(b);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const fail=()=>{throw Error('Current canonical task membership could not be verified.');};
export function createPrivateCommonTaskLinkReview({api,now=Date.now}={}){
 if(typeof now!=='function'||['getCommonTaskSource','getCommonTaskMembership','setCommonTaskLink','commonTaskLinksReady'].some(k=>typeof api?.[k]!=='function'))fail();
 const contexts=new Map(),claims=new WeakSet();let disposed=false;
 const alive=s=>Boolean(s)&&!disposed&&contexts.get(s.id)===s&&Number.isFinite(now())&&s.expiresAt>now();
 function clear(id){const s=contexts.get(id);clearTimeout(s?.timer);contexts.delete(id);}
 function state(id,actor){const s=contexts.get(id);if(!alive(s)||s.owner!==actor?.ownerId||typeof actor.accessToken!=='string'||!actor.accessToken)fail();return s;}
 async function fresh(s,actor){
  if(!alive(s)||s.owner!==actor?.ownerId||typeof actor.accessToken!=='string'||!actor.accessToken)fail();
  const [taskRows,projectRows,links,ready]=await Promise.all([api.getCommonTaskSource(actor.accessToken,s.task.reference,actor.ownerId),api.getCommonTaskSource(actor.accessToken,s.project.reference,actor.ownerId),api.getCommonTaskMembership(actor.accessToken,s.task.reference,s.project.reference,actor.ownerId),api.commonTaskLinksReady(actor.accessToken)]);
  if(!alive(s)||ready!==true||![taskRows,projectRows,links].every(Array.isArray)||taskRows.length!==1||projectRows.length!==1||links.length>1)fail();
  const task=resolveCommonTaskSource(taskRows[0],actor.ownerId,s.task.reference),project=resolveCommonProjectTarget(projectRows[0],actor.ownerId,s.project.reference),link=links.length?commonTaskMembershipState(links[0],actor.ownerId):null;
  if(link&&commonTaskMembershipKey(link.payload.task,link.payload.project)!==commonTaskMembershipKey(task.reference,project.reference))fail();
  return{task,project,link};
 }
 async function unchanged(s,actor){const latest=await fresh(s,actor);if(!equal(latest.task,s.task)||!equal(latest.project,s.project)||!equal(latest.link,s.link))fail();return latest;}
 // Sources must come from a trusted, currently authorized selected-record handoff.
 async function open(id,actor,{taskRow,projectRow,taskReference,projectReference,expiresAt}){
  clear(id);if(disposed||typeof id!=='string'||!id||typeof actor?.accessToken!=='string'||!actor.accessToken||!Number.isFinite(expiresAt)||!Number.isFinite(now())||expiresAt<=now())fail();
  const task=resolveCommonTaskSource(taskRow,actor.ownerId,taskReference),project=resolveCommonProjectTarget(projectRow,actor.ownerId,projectReference);
  commonTaskMembershipKey(task.reference,project.reference);
  const s={id,owner:actor.ownerId,task,project,link:null,expiresAt:Math.min(expiresAt,now()+300000),viewId:token(),generation:0,review:null};contexts.set(id,s);s.timer=setTimeout(()=>{if(contexts.get(id)===s)clear(id);},Math.max(1,s.expiresAt-now()));s.timer.unref?.();
  try{const latest=await fresh(s,actor);if(!equal(task,latest.task)||!equal(project,latest.project))fail();s.link=latest.link;
   // Intrinsic academic edges and all-manual pairs are never duplicate canonical links.
   prepareCommonTaskMembership({taskRow:task.source,projectRow:project.source,taskReference:task.reference,projectReference:project.reference,priorLink:s.link,ownerId:s.owner,linked:s.link?.deleted_at!==null});
   return{viewId:s.viewId,expiresAt:s.expiresAt,taskTitle:task.title,projectTitle:project.title,linked:s.link?.deleted_at===null,projectStatusDomain:project.statusDomain,projectStatus:project.status};
  }catch(error){if(contexts.get(id)===s)clear(id);throw error;}
 }
 async function review(id,actor,{viewId,linked}){const s=state(id,actor);s.review=null;const generation=++s.generation;if(viewId!==s.viewId||typeof linked!=='boolean')fail();await unchanged(s,actor);if(!alive(s)||s.generation!==generation)fail();const plan=prepareCommonTaskMembership({taskRow:s.task.source,projectRow:s.project.source,taskReference:s.task.reference,projectReference:s.project.reference,priorLink:s.link,ownerId:s.owner,linked});if(plan.noChanges)return{noChanges:true};const r={id:token(),s,linked,generation,started:false};s.review=r;return{reviewId:r.id,expiresAt:s.expiresAt,...plan.review};}
 function claim(id,owner,reviewId){const s=contexts.get(id),r=s?.review;if(!alive(s)||s.owner!==owner||!r||r.id!==reviewId)fail();s.review=null;claims.add(r);return r;}
 const valid=r=>claims.has(r)&&alive(r.s)&&r.generation===r.s.generation;
 async function authorize(r,actor){if(!valid(r)||r.started||r.s.owner!==actor?.ownerId)return false;await unchanged(r.s,actor);return valid(r)&&!r.started;}
 async function save(r,actor){if(!valid(r)||r.started||r.s.owner!==actor?.ownerId)fail();r.started=true;const s=r.s;await unchanged(s,actor);if(!valid(r))fail();
  const result=await api.setCommonTaskLink(actor.accessToken,{task:s.task.reference,taskVersion:s.task.source.version,project:s.project.reference,projectVersion:s.project.source.version,linkVersion:s.link?.version??0,linked:r.linked});
  if(!valid(r)||!exact(result,['taskId','taskVersion','projectId','projectVersion','linkRecord']))fail();
  const link=commonTaskMembershipState(result.linkRecord,s.owner),sameSource=s.task.source.id===s.project.source.id;
  if(result.taskId!==s.task.source.id||result.projectId!==s.project.source.id||result.taskVersion!==s.task.source.version+1||result.projectVersion!==s.project.source.version+(sameSource?1:0)||commonTaskMembershipKey(link.payload.task,link.payload.project)!==commonTaskMembershipKey(s.task.reference,s.project.reference)||link.version!==(s.link?.version??0)+1||(link.deleted_at===null)!==r.linked||s.link&&(link.id!==s.link.id||link.created_at!==s.link.created_at||!equal(link.payload,s.link.payload)))fail();
  const after=await fresh(s,actor),expectedTask={...s.task.source,version:result.taskVersion,updated_at:after.task.source.updated_at},expectedProject=sameSource?{...s.project.source,version:result.projectVersion,updated_at:after.project.source.updated_at}:s.project.source;
  if(!valid(r)||!equal(after.task.source,expectedTask)||!equal(after.project.source,expectedProject)||!equal(after.link,link))fail();
  clear(s.id);return{saved:true,linked:r.linked};
 }
 return{open,review,claim,authorize,save,clear,retireReview(id){const s=contexts.get(id);if(s){s.review=null;s.generation++;}},currentView:(id,v)=>{const s=contexts.get(id);return Boolean(alive(s)&&s.viewId===v);},current:(id,r)=>{const s=contexts.get(id);return Boolean(alive(s)&&s.review?.id===r);},dispose(){disposed=true;for(const id of contexts.keys())clear(id);}};
}
