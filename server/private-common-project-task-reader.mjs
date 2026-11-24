import {projectSubprojectTaskView} from './project-subproject-task-view.mjs';
import {hierarchyProgress} from '../src/project-hierarchy.mjs';
import {separatesRecurring} from '../src/project-progress.mjs';
// Selected direct-project read only. Never accepts browser IDs as selection authority.
import {stableStringify} from './stable-json.mjs';
import {resolveCommonProjectTarget} from './private-common-task-targets.mjs';
import {commonTaskMembershipState} from './private-common-task-memberships.mjs';
import {projectMembershipState} from './private-project-task-links.mjs';
import {commonProjectTaskView} from './private-common-project-task-view.mjs';
const fail=()=>{throw Error('Complete current project task progress could not be verified.');};
const sorted=rows=>[...rows].sort((a,b)=>a.id.toLowerCase().localeCompare(b.id.toLowerCase()));
export async function readPrivateCommonProjectTasks({api,actor,selectedProject,isCurrent,includeSubprojects=false,includeVerifiedInputs=false}={}){
 if(typeof includeVerifiedInputs!=='boolean')fail();
 if(typeof includeSubprojects!=='boolean'||includeSubprojects&&typeof api?.projectHierarchySnapshot!=='function')fail();
 if(typeof isCurrent!=='function'||['getCommonTaskSource','listCommonTaskMemberships','listProjectTaskChoices','listProjectTaskMemberships','commonTaskLinksReady'].some(k=>typeof api?.[k]!=='function')||typeof actor?.accessToken!=='string'||!actor.accessToken||!isCurrent())fail();
 const target=resolveCommonProjectTarget(selectedProject,actor.ownerId,{kind:'project',recordId:selectedProject?.id}),owner=actor.ownerId,token=actor.accessToken;
 async function capture(){
  if(!isCurrent())fail();const [projects,tasks,ordinary,canonical,ready,hierarchy]=await Promise.all([api.getCommonTaskSource(token,target.reference,owner),api.listProjectTaskChoices(token,owner),api.listProjectTaskMemberships(token,target.source.id,owner),api.listCommonTaskMemberships(token,owner),api.commonTaskLinksReady(token),includeSubprojects?api.projectHierarchySnapshot(token,owner):null]);
  if(!isCurrent()||ready!==true||!Array.isArray(projects)||projects.length!==1||![tasks,ordinary,canonical].every(v=>Array.isArray(v)&&v.length<=2000)||ordinary.length+canonical.length>2000)fail();
  resolveCommonProjectTarget(projects[0],owner,target.reference);if(stableStringify(projects[0])!==stableStringify(target.source))fail();
  for(const row of ordinary){const link=projectMembershipState(row,owner);if(link.payload.projectId.toLowerCase()!==target.source.id.toLowerCase())fail();}
  let selectedProjects=projects,selectedMemberships=ordinary;const included=new Set([target.source.id.toLowerCase()]);
  if(includeSubprojects){projectSubprojectTaskView({snapshot:hierarchy,ownerId:owner,project:projects[0],tasks,memberships:ordinary.map(row=>projectMembershipState(row,owner))});const graph=hierarchyProgress({...hierarchy,ownerId:owner,rootProjectId:target.source.id}),ids=graph.projectIds.filter(id=>id!==target.source.id),additional=[];
   for(let offset=0;offset<ids.length;offset+=4){if(!isCurrent())fail();const batch=await Promise.all(ids.slice(offset,offset+4).map(recordId=>api.getCommonTaskSource(token,{kind:'project',recordId},owner)));if(!isCurrent()||batch.some(v=>!Array.isArray(v)||v.length!==1))fail();additional.push(...batch.map(v=>v[0]));}
   for(const row of additional){resolveCommonProjectTarget(row,owner,{kind:'project',recordId:row.id});const original=hierarchy.projects.find(p=>p.id===row.id);if(!original||original.version!==row.version||original.section!==row.section||original.payload.title!==row.payload.title||original.payload.status!==row.payload.status||separatesRecurring(original.payload)!==separatesRecurring(row.payload))fail();included.add(row.id.toLowerCase());}
   if(included.size!==graph.projectIds.length)fail();selectedProjects=[...projects,...additional];selectedMemberships=hierarchy.memberships;
  }
  const reservations=canonical.map(row=>commonTaskMembershipState(row,owner)),references=new Map();
  for(const row of reservations)if(row.deleted_at===null&&row.payload.project.kind==='project'&&included.has(row.payload.project.recordId.toLowerCase()))references.set(row.payload.task.recordId.toLowerCase(),row.payload.task);
  const sources=[],refs=[...references.values()];
  for(let offset=0;offset<refs.length;offset+=4){
   if(!isCurrent())fail();
   const batch=await Promise.all(refs.slice(offset,offset+4).map(async ref=>{
    const rows=await api.getCommonTaskSource(token,ref,owner);
    if(!Array.isArray(rows)||rows.length!==1||typeof rows[0]?.id!=='string'||rows[0].id.toLowerCase()!==ref.recordId.toLowerCase())fail();
    return rows[0];
   }));
   if(!isCurrent())fail();
   sources.push(...batch);
  }
  const input={ownerId:owner,rootProjectId:target.source.id,projects:selectedProjects,ordinaryTasks:tasks,ordinaryMemberships:selectedMemberships,canonicalSources:sources,canonicalMemberships:reservations};
  const result=commonProjectTaskView(input);return{input,result,fingerprint:stableStringify({...input,hierarchy,projects:sorted(selectedProjects),ordinaryTasks:sorted(tasks),ordinaryMemberships:sorted(selectedMemberships),canonicalSources:sorted(sources),canonicalMemberships:sorted(reservations)})};
 }
 const before=await capture(),after=await capture();if(!isCurrent()||before.fingerprint!==after.fingerprint||await api.commonTaskLinksReady(token)!==true||!isCurrent())fail();
 return structuredClone({...after.result,...(includeVerifiedInputs?{verifiedInputs:after.input,inventoryFingerprint:after.fingerprint}:{})});
}
