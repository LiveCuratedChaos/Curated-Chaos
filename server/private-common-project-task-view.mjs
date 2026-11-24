// Complete bounded selected-project inputs only. Pure internal read model; never write authority.
import {privateProjectState} from './private-projects.mjs';
import {projectTaskState,projectMembershipState} from './private-project-task-links.mjs';
import {resolveCommonTaskSource,resolveCommonProjectTarget} from './private-common-task-targets.mjs';
import {commonTaskMembershipState,commonTaskMembershipKey} from './private-common-task-memberships.mjs';
import {commonTaskSourceKey} from '../src/private-common-task-reference.mjs';
import {projectProgress,ongoingRecurringTask,separatesRecurring} from '../src/project-progress.mjs';
const fail=()=>{throw Error('Complete current project task sources could not be verified.');};
const folded=value=>typeof value==='string'?value.toLowerCase():fail();
function inventory(rows){if(!Array.isArray(rows)||rows.length>2000)fail();const byId=new Map();for(const row of rows){const key=folded(row?.id);if(byId.has(key))fail();byId.set(key,row);}return byId;}
export function commonProjectTaskView({ownerId,rootProjectId,projects,ordinaryTasks,ordinaryMemberships,canonicalSources,canonicalMemberships}){
 if(!Array.isArray(ordinaryMemberships)||!Array.isArray(canonicalMemberships)||ordinaryMemberships.length+canonicalMemberships.length>2000)fail();
 const projectMap=inventory(projects),taskMap=inventory(ordinaryTasks),sourceMap=inventory(canonicalSources);inventory([...ordinaryMemberships,...canonicalMemberships]);
 for(const row of projectMap.values())privateProjectState(row,ownerId,{summary:true});for(const row of taskMap.values())projectTaskState(row,ownerId);
 for(const row of sourceMap.values()){if(row.item_type==='task')projectTaskState(row,ownerId);else resolveCommonProjectTarget(row,ownerId,{kind:'school-course',recordId:row.id});}
 const root=projectMap.get(folded(rootProjectId));if(!root)fail();const tasks=new Map(),slots=new Set();
 function add(task,project){const key=commonTaskSourceKey(task.reference),before=tasks.get(key);if(before){if(before.title!==task.title||before.completed!==task.completed||before.recurring!==task.recurring)fail();before.projectIds.add(project.id);}else tasks.set(key,{reference:structuredClone(task.reference),title:task.title,section:task.section,completed:task.completed,recurring:task.recurring,projectIds:new Set([project.id])});}
 for(const row of ordinaryMemberships){const link=projectMembershipState(row,ownerId),tid=folded(link.payload.taskId),pid=folded(link.payload.projectId),slot='ordinary:'+tid+'|'+pid;if(slots.has(slot))fail();slots.add(slot);const project=projectMap.get(pid);if(!project||link.deleted_at!==null)continue;const task=taskMap.get(tid);if(!task)fail();add({reference:{kind:'task',recordId:task.id},title:task.payload.title,section:task.section,completed:task.payload.done,recurring:ongoingRecurringTask(task.payload)},project);}
 for(const row of canonicalMemberships){const link=commonTaskMembershipState(row,ownerId),slot='canonical:'+commonTaskMembershipKey(link.payload.task,link.payload.project);if(slots.has(slot))fail();slots.add(slot);if(link.deleted_at!==null||link.payload.project.kind!=='project')continue;const project=projectMap.get(folded(link.payload.project.recordId));if(!project)continue;const source=sourceMap.get(folded(link.payload.task.recordId));if(!source)fail();const task=resolveCommonTaskSource(source,ownerId,link.payload.task);resolveCommonProjectTarget(project,ownerId,link.payload.project);add({...task,recurring:task.reference.kind==='task'?ongoingRecurringTask(task.source.payload):false},project);}
 if(tasks.size>2000)fail();const values=[...tasks.values()].map(t=>({...t,projectIds:[...t.projectIds].sort()})).sort((a,b)=>a.title.localeCompare(b.title)||commonTaskSourceKey(a.reference).localeCompare(commonTaskSourceKey(b.reference)));
 return{manualStatus:root.payload.status,progress:projectProgress(values,{separateRecurring:separatesRecurring(root.payload)}),tasks:values};
}
