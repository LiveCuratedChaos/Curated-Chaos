// A complete sparse graph is read evidence, never membership write authority.
import {hierarchyProgress} from '../src/project-hierarchy.mjs';
import {separatesRecurring} from '../src/project-progress.mjs';
import {privateProjectState} from './private-projects.mjs';
import {stableStringify} from './stable-json.mjs';
const fail=()=>{throw Error('Project structure or tasks changed. Fetch project tasks again.');};
const taskSummary=r=>({id:r.id,version:r.version,section:r.section,title:r.payload.title,done:r.payload.done,recurrence:r.payload.recurrence??null,stopped:r.payload.recurrenceStopped??null});
const projectSummary=r=>({id:r.id,version:r.version,section:r.section,title:r.payload.title,status:r.payload.status,separateRecurring:separatesRecurring(r.payload)});
const sorted=rows=>[...rows].sort((a,b)=>a.id.localeCompare(b.id));
export function projectSubprojectTaskView({snapshot,ownerId,project,tasks,memberships}){
 if(!snapshot||Object.keys(snapshot).sort().join(',')!=='memberships,projects,relationships,tasks'||!Array.isArray(tasks)||!Array.isArray(memberships))fail();
 privateProjectState(project,ownerId,{summary:true});const summary=hierarchyProgress({...snapshot,ownerId,rootProjectId:project.id});
 const iso=value=>{if(!(typeof value==='string'||value instanceof Date)||!Number.isFinite(new Date(value).getTime()))fail();return new Date(value).toISOString();};
 const snapshotMemberships=snapshot.memberships.map(r=>{if(r.deleted_at!==null)fail();return{...r,created_at:iso(r.created_at),updated_at:iso(r.updated_at)};});
 const root=snapshot.projects.find(r=>r.id===project.id);if(!root)fail();privateProjectState(root,ownerId,{summary:true});
 if(stableStringify(projectSummary(root))!==stableStringify(projectSummary(project)))fail();
 // The stable snapshot intentionally omits day. Fetch it only from the existing
 // sparse task choices after proving the entire task collection still matches.
 if(tasks.length!==snapshot.tasks.length||stableStringify(sorted(tasks).map(taskSummary))!==stableStringify(sorted(snapshot.tasks).map(taskSummary)))fail();
 const activeRoot=memberships.filter(r=>r.deleted_at===null),snapshotRoot=snapshotMemberships.filter(r=>r.payload.projectId===project.id);
 if(stableStringify(sorted(activeRoot))!==stableStringify(sorted(snapshotRoot)))fail();
 const descendantIds=new Set(summary.projectIds.filter(id=>id!==project.id)),inherited=new Map();
 for(const link of snapshotMemberships){if(!descendantIds.has(link.payload.projectId))continue;const id=link.payload.taskId;if(!inherited.has(id))inherited.set(id,new Set());inherited.get(id).add(link.payload.projectId);}
 return{progress:summary.progress,inheritedProjectCounts:new Map([...inherited].map(([id,projects])=>[id,projects.size]))};
}
