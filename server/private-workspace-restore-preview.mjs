import {withinArchivedDeletedRetention,supportsArchivedDeletedWorkspaceRestore} from './private-workspace-restore-contract.mjs';
import {commonTaskMembershipKey} from './private-common-task-memberships.mjs';
import {resolveCommonTaskSource,resolveCommonProjectTarget} from './private-common-task-targets.mjs';
import {validateHierarchyChange,validateProjectHierarchy} from '../src/project-hierarchy.mjs';
// Comparison only: no database client, file writes, insertion payloads or restore executor.
import {inspectPrivateWorkspace,validatePrivateWorkspaceRows} from './private-workspace-backup.mjs';import {stableStringify} from './stable-json.mjs';import {safeSavedAt} from './snapshot-freshness.mjs';
const singleton=row=>['brief_preferences','dashboard_layout'].includes(row.item_type)&&row.deleted_at==null;
const approvalSource=row=>row.item_type==='task'&&row.payload?.fictional===true&&/^M1A_APPROVED_/.test(row.payload?.source||'')?row.payload.source:null;
export function previewPrivateWorkspaceRestore({bytes,key,projectRef,ownerId,existing=[],allowNewTaskGraphTargets=false,allowFreshHierarchy=false,allowArchivedDeletedRestore=false,now=Date.now()}){
 const snapshot=inspectPrivateWorkspace(bytes,{key,projectRef,ownerId}),currentRows=validatePrivateWorkspaceRows(existing,ownerId,key),current=new Map(currentRows.map(row=>[row.id,row]));
 if(typeof allowArchivedDeletedRestore!=='boolean'||!Number.isFinite(now))throw Error('Explicit archived deletion comparison scope required.');
 if(typeof allowFreshHierarchy!=='boolean'||typeof allowNewTaskGraphTargets!=='boolean')throw Error('Explicit graph comparison scope required.');
 const target=id=>current.get(id)??(allowNewTaskGraphTargets?snapshot.records.find(r=>r.id===id&&r.deleted_at===null):null);
 const activeProject=row=>row.item_type==='project'&&row.deleted_at===null;
 const projects=currentRows.filter(activeProject);
 const freshProjects=new Map();
 if(allowFreshHierarchy)for(const row of snapshot.records){
  if(activeProject(row)&&!current.has(row.id)){freshProjects.set(row.id,row);projects.push(row);}
 }
 const actions=snapshot.records.map(record=>{
  const prior=current.get(record.id),base={id:record.id,itemType:record.item_type};
  if(!prior){
   if(record.item_type==='project_project_link'&&record.deleted_at==null){
    const {parentProjectId,childProjectId}=record.payload;
    const parent=current.get(parentProjectId)??freshProjects.get(parentProjectId),child=current.get(childProjectId)??freshProjects.get(childProjectId);
    if(allowFreshHierarchy&&(!freshProjects.has(parentProjectId)||!freshProjects.has(childProjectId)))return{...base,action:'blocked-existing-hierarchy-target'};
    if(!parent||!child||parent.deleted_at!=null||child.deleted_at!=null||parent.item_type!=='project'||child.item_type!=='project')return{...base,action:'blocked-link-targets'};
    if(currentRows.some(r=>r.item_type==='project_project_link'&&r.payload.parentProjectId===parent.id&&r.payload.childProjectId===child.id))return{...base,action:'blocked-unique-slot'};
    try{validateHierarchyChange({ownerId,projects,relationships:currentRows.filter(r=>r.item_type==='project_project_link')},{parentProjectId:parent.id,childProjectId:child.id,linked:true});}catch(error){return{...base,action:error.code==='PROJECT_HIERARCHY_SINGLE_PARENT'?'blocked-hierarchy-parent':'blocked-hierarchy-cycle'};}
   }
   if(record.item_type==='project_task_link'&&record.deleted_at==null){
    const task=target(record.payload.taskId),project=target(record.payload.projectId);
    if(!task||task.item_type!=='task'||task.deleted_at!=null||!project||project.item_type!=='project'||project.origin!=='PRIVATE_COOKIE_PROJECT'||project.deleted_at!=null)return{...base,action:'blocked-link-targets'};
    if(currentRows.some(r=>r.item_type==='project_task_link'&&r.payload.taskId===record.payload.taskId&&r.payload.projectId===record.payload.projectId))return{...base,action:'blocked-unique-slot'};
   }
   if(record.item_type==='common_task_link'&&record.deleted_at==null){
    const p=record.payload,task=target(p.task.recordId.toLowerCase()),project=target(p.project.recordId.toLowerCase());
    try{resolveCommonTaskSource(task,ownerId,p.task);resolveCommonProjectTarget(project,ownerId,p.project);}catch{return{...base,action:'blocked-link-targets'};}
    const key=commonTaskMembershipKey(p.task,p.project);if(currentRows.some(r=>r.item_type==='common_task_link'&&commonTaskMembershipKey(r.payload.task,r.payload.project)===key))return{...base,action:'blocked-unique-slot'};
   }
   if(record.item_type==='project_project_link'&&record.deleted_at!==null&&allowFreshHierarchy&&allowArchivedDeletedRestore&&withinArchivedDeletedRetention(record,{now})){
    const {parentProjectId,childProjectId}=record.payload;
    if(![parentProjectId,childProjectId].every(id=>activeProject(current.get(id)??freshProjects.get(id)??{})))return{...base,action:'blocked-link-targets'};
    if(currentRows.some(r=>r.item_type==='project_project_link'&&r.payload.parentProjectId===parentProjectId&&r.payload.childProjectId===childProjectId))return{...base,action:'blocked-unique-slot'};
    return{...base,action:'missing-deleted-needs-review'};
   }
   if(record.deleted_at!=null){if(allowArchivedDeletedRestore&&withinArchivedDeletedRetention(record,{now}))return{...base,action:supportsArchivedDeletedWorkspaceRestore(record,{now})?'missing-deleted-needs-review':'blocked-deleted-record'};return{...base,action:'archived-deleted'};}
   const occupied=currentRows.some(row=>row.id!==record.id&&(singleton(record)&&singleton(row)&&row.item_type===record.item_type||approvalSource(record)&&approvalSource(record)===approvalSource(row)));
   if(occupied)return{...base,action:'blocked-unique-slot'};
   // Two archived active singleton/source records must never be proposed together.
   const archiveCollision=snapshot.records.some(row=>row.id!==record.id&&(singleton(record)&&singleton(row)&&row.item_type===record.item_type||approvalSource(record)&&approvalSource(record)===approvalSource(row)));
   return{...base,action:archiveCollision?'blocked-archive-duplicate':'missing-needs-review'};
  }
  if(prior.section!==record.section||prior.item_type!==record.item_type||prior.origin!==record.origin)return{...base,action:'blocked-scope'};
  if((prior.deleted_at==null)!==(record.deleted_at==null))return{...base,action:'blocked-deletion-state'};
  if(prior.version<record.version)return{...base,action:'blocked-version'};
  if(safeSavedAt(prior.created_at)!==safeSavedAt(record.created_at))return{...base,action:'blocked-created-time'};
  const sameDeletion=prior.deleted_at==null||safeSavedAt(prior.deleted_at)===safeSavedAt(record.deleted_at),samePayload=stableStringify(prior.payload)===stableStringify(record.payload);
  return{...base,action:sameDeletion&&samePayload?'unchanged':'conflict',newerRevision:prior.version>record.version};
 });
 // A set of individually valid missing edges may still form a cycle when
 // combined with the current graph. A future executor must revalidate atomically.
 const candidates=snapshot.records.filter(r=>r.item_type==='project_project_link'&&r.deleted_at===null&&actions.some(a=>a.id===r.id&&a.action==='missing-needs-review'));
 if(candidates.length){try{validateProjectHierarchy({ownerId,projects,relationships:[...currentRows.filter(r=>r.item_type==='project_project_link'),...candidates]});}catch(error){for(const action of actions)if(candidates.some(r=>r.id===action.id))action.action=error.code==='PROJECT_HIERARCHY_SINGLE_PARENT'?'blocked-hierarchy-parent':'blocked-hierarchy-cycle';}}
 const count=action=>actions.filter(row=>row.action===action).length;
 return{...(Object.hasOwn(snapshot,'recordVersions')?{recordVersionCount:snapshot.recordVersions.length,recordVersionRestoreAvailable:false}:{}),snapshotId:snapshot.snapshotId,recordCount:snapshot.records.length,unchangedCount:count('unchanged'),missingCount:count('missing-needs-review'),archivedDeletedCount:count('archived-deleted'),conflictCount:count('conflict'),blockedCount:actions.filter(row=>row.action.startsWith('blocked-')).length,currentOnlyCount:currentRows.filter(row=>!snapshot.records.some(record=>record.id===row.id)).length,executed:false,databaseWritten:false,restoreAvailable:false,actions};
}
