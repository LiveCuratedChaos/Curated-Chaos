// Read-only projection: original identities and bodies never leave the server.
import {verifyProjectTaskSummary} from '../src/private-project-task-summary.mjs';
export function projectTaskSummary(snapshot,{project,includeSubprojects=false,hierarchyAvailable=false,offset=0,expiresAt,now}={}){
 if(!snapshot||!Array.isArray(snapshot.tasks)||snapshot.manualStatus!==project?.payload?.status)throw Error('Verified project task snapshot required.');
 const tasks=snapshot.tasks.slice(offset,offset+50).map(t=>({sourceKind:t.reference.kind,title:t.title,section:t.section,completed:t.completed,recurring:t.recurring,direct:t.projectIds.includes(project.id),inheritedProjectCount:t.projectIds.filter(id=>id!==project.id).length}));
 return verifyProjectTaskSummary({readOnly:true,projectTitle:project.payload.title,manualStatus:snapshot.manualStatus,includeSubprojects,hierarchyAvailable,progress:snapshot.progress,tasks,offset,limit:50,matchCount:snapshot.tasks.length,expiresAt},{now,projectTitle:project.payload.title,manualStatus:project.payload.status,offset,includeSubprojects,expiresAt});
}
