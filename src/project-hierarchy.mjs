// Complete, private snapshots only. One active master per smaller project.
// A graph is a read model, never write authority.
import {PROJECT_AREAS,PROJECT_STATUSES} from './private-project-model.mjs';
import {ongoingRecurringTask,projectProgress,separatesRecurring} from './project-progress.mjs';
const LIMIT=2000,uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const fail=()=>{throw Error('Complete private project hierarchy unavailable.');};
const cycle=()=>{const error=Error('A project cannot contain itself through its subprojects.');error.code='PROJECT_HIERARCHY_CYCLE';throw error;};
const oneMaster=()=>{const error=Error('A smaller project can belong to only one master project. Unlink its current master before linking another.');error.code='PROJECT_HIERARCHY_SINGLE_PARENT';throw error;};
function rows(value){if(!Array.isArray(value)||value.length>LIMIT)fail();return value;}
function scope(row,ownerId,type){if(!row||!uuid(row.id)||row.owner_id!==ownerId||row.household_id!==null||row.visibility!=='private'||row.item_type!==type||!Number.isInteger(row.version)||row.version<1||row.payload?.fictional!==true)fail();}
function title(value){return typeof value==='string'&&value===value.trim()&&value.length>0&&value.length<=140&&!/[\u0000-\u001f\u007f]/.test(value);}
function unique(items,key){const seen=new Set();for(const item of items){const id=key(item);if(seen.has(id))fail();seen.add(id);}}
function deletion(row){if(row.deleted_at!==null&&(typeof row.deleted_at!=='string'||!Number.isFinite(new Date(row.deleted_at).getTime())))fail();}
function relation(row,ownerId){scope(row,ownerId,'project_project_link');deletion(row);const p=row.payload;if(row.origin!=='PRIVATE_COOKIE_PROJECT_PROJECT_LINK'||row.section!=='Personal Life'||Object.keys(p).sort().join(',')!=='childProjectId,fictional,parentProjectId,schemaVersion'||p.schemaVersion!==1||!uuid(p.parentProjectId)||!uuid(p.childProjectId)||p.parentProjectId===p.childProjectId)fail();return{ id:row.id,parentProjectId:p.parentProjectId,childProjectId:p.childProjectId,active:row.deleted_at===null};}
function graph({ownerId,projects,relationships}){
 if(!uuid(ownerId))fail();rows(projects);rows(relationships);unique(projects,r=>r?.id);unique(relationships,r=>r?.id);
 const byId=new Map();for(const p of projects){scope(p,ownerId,'project');if(p.deleted_at!==null||p.origin!=='PRIVATE_COOKIE_PROJECT'||!PROJECT_AREAS.includes(p.section)||p.payload.schemaVersion!==1||!PROJECT_STATUSES.includes(p.payload.status)||Object.hasOwn(p.payload,'archived')&&typeof p.payload.archived!=='boolean'||!title(p.payload.title))fail();separatesRecurring(p.payload);byId.set(p.id,p);}
 const links=relationships.map(r=>relation(r,ownerId));unique(links,r=>r.parentProjectId+':'+r.childProjectId);
 const children=new Map(projects.map(p=>[p.id,[]])),parents=new Map(projects.map(p=>[p.id,[]]));
 for(const r of links.filter(r=>r.active)){if(!byId.has(r.parentProjectId)||!byId.has(r.childProjectId))fail();if(parents.get(r.childProjectId).length)oneMaster();children.get(r.parentProjectId).push(r.childProjectId);parents.get(r.childProjectId).push(r.parentProjectId);}
 // Kahn's algorithm avoids recursion limits even for long, valid chains.
 const indegree=new Map([...parents].map(([id,list])=>[id,list.length])),queue=[...byId.keys()].filter(id=>!indegree.get(id));let visited=0;
 for(let i=0;i<queue.length;i++){const id=queue[i];visited++;for(const child of children.get(id)){indegree.set(child,indegree.get(child)-1);if(!indegree.get(child))queue.push(child);}}
 if(visited!==projects.length)cycle();return{byId,links,children,parents};
}
export function validateProjectHierarchy(snapshot){const g=graph(snapshot);return{projectIds:[...g.byId.keys()].sort(),relationships:g.links.map(r=>({...r}))};}
export function validateHierarchyChange(snapshot,{parentProjectId,childProjectId,linked}={}){
 const g=graph(snapshot);if(!uuid(parentProjectId)||!uuid(childProjectId)||parentProjectId===childProjectId||typeof linked!=='boolean'||!g.byId.has(parentProjectId)||!g.byId.has(childProjectId))fail();
 const existing=g.links.find(r=>r.parentProjectId===parentProjectId&&r.childProjectId===childProjectId),noChanges=(existing?.active??false)===linked;
 if(linked&&!noChanges){if(g.parents.get(childProjectId).length)oneMaster();const seen=new Set(),queue=[childProjectId];for(let i=0;i<queue.length;i++){const id=queue[i];if(id===parentProjectId)cycle();if(seen.has(id))continue;seen.add(id);queue.push(...g.children.get(id));}}
 return{parentProjectId,childProjectId,linked,noChanges,relationshipId:existing?.id??null};
}
export function hierarchyProgress(snapshot){
 const {ownerId,rootProjectId,tasks,memberships}=snapshot,g=graph(snapshot);if(!uuid(rootProjectId)||!g.byId.has(rootProjectId))fail();rows(tasks);rows(memberships);unique(tasks,r=>r?.id);unique(memberships,r=>r?.id);
 const taskMap=new Map();for(const t of tasks){scope(t,ownerId,'task');if(t.deleted_at!==null||!PROJECT_AREAS.includes(t.section)||!title(t.payload.title)||typeof t.payload.done!=='boolean')fail();taskMap.set(t.id,{completed:t.payload.done,recurring:ongoingRecurringTask(t.payload)});}
 const pairs=new Set();for(const m of memberships){scope(m,ownerId,'project_task_link');deletion(m);const p=m.payload;if(m.origin!=='PRIVATE_COOKIE_PROJECT_TASK_LINK'||m.section!=='Personal Life'||Object.keys(p).sort().join(',')!=='fictional,projectId,schemaVersion,taskId'||p.schemaVersion!==1||!uuid(p.taskId)||!uuid(p.projectId))fail();const pair=p.taskId+':'+p.projectId;if(pairs.has(pair))fail();pairs.add(pair);if(m.deleted_at===null&&(!taskMap.has(p.taskId)||!g.byId.has(p.projectId)))fail();}
 const included=new Set(),queue=[rootProjectId];for(let i=0;i<queue.length;i++){const id=queue[i];if(included.has(id))continue;included.add(id);queue.push(...g.children.get(id));}
 const taskIds=new Set(memberships.filter(m=>m.deleted_at===null&&included.has(m.payload.projectId)).map(m=>m.payload.taskId));
 return{projectIds:[...included].sort(),taskIds:[...taskIds].sort(),progress:projectProgress([...taskIds].map(id=>taskMap.get(id)),{separateRecurring:separatesRecurring(g.byId.get(rootProjectId).payload)})};
}
