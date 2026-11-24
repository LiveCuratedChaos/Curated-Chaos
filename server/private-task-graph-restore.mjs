import {commonTaskMembershipKey} from './private-common-task-memberships.mjs';
// Conservative relationship restore eligibility. Never permits updates to existing task sources.
import {validatePrivateWorkspaceRows} from './private-workspace-backup.mjs';
import {projectTaskState} from './private-project-task-links.mjs';
import {privateProjectState} from './private-projects.mjs';
const graphType=row=>['project_task_link','common_task_link'].includes(row.item_type);
export function taskGraphRestorePlan({inserts,existing,ownerId,key}={}){
 const links=Array.isArray(inserts)?inserts.filter(graphType):[],blocked=reason=>({supported:false,membershipCount:links.length,sourceCount:0,membershipIds:[],reason});
 if(!Array.isArray(inserts)||!Array.isArray(existing))return blocked('unavailable');
 if(!links.length)return{supported:true,membershipCount:0,sourceCount:0,membershipIds:[],reason:''};
 try{
  const combined=validatePrivateWorkspaceRows([...existing,...inserts],ownerId,key),byId=new Map(combined.map(r=>[r.id,r])),fresh=new Map(inserts.map(r=>[r.id,r])),sources=new Set(),counts=new Map();
  if(inserts.some(r=>r.id!==r.id.toLowerCase()))return blocked('unsupported-id-format');
  for(const link of links){const taskKey=link.item_type==='project_task_link'?'task:'+link.payload.taskId.toLowerCase():commonTaskMembershipKey(link.payload.task,link.payload.project).split('|')[0];counts.set(taskKey,(counts.get(taskKey)??0)+1);if(counts.get(taskKey)>50)return blocked('capacity');if(link.deleted_at!==null)return blocked('inactive-membership');const sourceId=link.item_type==='project_task_link'?link.payload.taskId:link.payload.task.recordId,source=fresh.get(sourceId.toLowerCase());if(!source||graphType(source))return blocked('existing-task-source');sources.add(source.id);
   if(link.item_type==='project_task_link'){projectTaskState(source,ownerId);privateProjectState(byId.get(link.payload.projectId),ownerId);}
  }
  return{supported:true,membershipCount:links.length,sourceCount:sources.size,membershipIds:links.map(r=>r.id),reason:''};
 }catch{return blocked('unverified-targets');}
}
