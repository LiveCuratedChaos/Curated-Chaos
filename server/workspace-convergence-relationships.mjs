// Reused from private source a6a7f33d0086cf739d8e4963ea61eac65854b6d0; current approved contracts apply.
// Offline, non-disclosing relationship acceptance only. Never a migration authority.
import {planWorkspaceConvergence} from './workspace-convergence-plan.mjs';
import {normalizeProjectWorkspace} from '../src/project-workspace-model.mjs';
import {validateProjectHierarchy,hierarchyProgress} from '../src/project-hierarchy.mjs';
export function checkWorkspaceConvergenceRelationships(input){
 try{
  const inventory=planWorkspaceConvergence(input),{records,ownerId}=input;
  if(inventory.counts.unknownProvenance)throw Error();
  const manual=records.filter(r=>r.origin==='CC_MANUAL_WORKSPACE');
  if(manual.some(r=>!['project','task'].includes(r.item_type)))throw Error();
  const firstParty=normalizeProjectWorkspace(manual,ownerId);
  const reviewed=records.filter(r=>r.origin!=='CC_MANUAL_WORKSPACE');
  const projects=reviewed.filter(r=>r.item_type==='project'),tasks=reviewed.filter(r=>r.item_type==='task'),relationships=reviewed.filter(r=>r.item_type==='project_project_link'),memberships=reviewed.filter(r=>r.item_type==='project_task_link');
  validateProjectHierarchy({ownerId,projects,relationships});
  // Existing hierarchy checks validate every membership's complete payload,
  // endpoint scope and recurrence fields, not only edges beneath this root.
  if(projects.length)hierarchyProgress({ownerId,rootProjectId:projects[0].id,projects,tasks,relationships,memberships});
  else if(memberships.length)throw Error();
  const parents=new Map(),assignments=new Map(),archived=new Set(projects.filter(p=>p.payload.archived===true).map(p=>p.id));
  for(const r of relationships){const id=r.payload.childProjectId;parents.set(id,(parents.get(id)||0)+1);}
  for(const r of memberships){const id=r.payload.taskId;assignments.set(id,(assignments.get(id)||0)+1);}
  const manualAssignments=firstParty.tasks.filter(t=>t.payload.project_id!==null).length;
  return {planOnly:true,recordWrites:0,automaticConversionAllowed:false,relationshipValidationPerformed:true,fullPayloadCompatibilityValidated:false,historyCompatibilityValidated:false,migrationReady:false,
   counts:{manualProjects:firstParty.projects.length,manualTasks:firstParty.tasks.length,reviewedProjects:projects.length,reviewedTasks:tasks.length,manualAssignments,reviewedMemberships:memberships.length,hierarchyLinks:relationships.length,multipleParentProjects:[...parents.values()].filter(n=>n>1).length,multipleProjectTasks:[...assignments.values()].filter(n=>n>1).length,archivedProjectMemberships:memberships.filter(r=>archived.has(r.payload.projectId)).length,archivedHierarchyLinks:relationships.filter(r=>archived.has(r.payload.parentProjectId)||archived.has(r.payload.childProjectId)).length},
   requiredContracts:inventory.requiredContracts};
 }catch(cause){const error=Error('Complete compatible owner-private workspace relationships required.');if(['PROJECT_HIERARCHY_SINGLE_PARENT','PROJECT_HIERARCHY_CYCLE'].includes(cause?.code))error.code=cause.code;throw error;}
}

