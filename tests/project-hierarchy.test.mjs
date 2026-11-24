import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProjectHierarchy,validateHierarchyChange,hierarchyProgress} from '../src/project-hierarchy.mjs';
const id=n=>'11111111-1111-4111-a111-'+n.toString(16).padStart(12,'0'),ownerId=id(9999),other=id(9998);
const base=(n,type)=>({id:id(n),owner_id:ownerId,household_id:null,visibility:'private',item_type:type,section:'Personal Life',version:1,deleted_at:null,payload:{fictional:true,schemaVersion:1}});
const project=(n,extra={})=>({...base(n,'project'),origin:'PRIVATE_COOKIE_PROJECT',payload:{fictional:true,schemaVersion:1,title:'Fictional project '+n,status:'Active',...extra}});
const relationship=(n,parent,child,deleted_at=null)=>({...base(n,'project_project_link'),origin:'PRIVATE_COOKIE_PROJECT_PROJECT_LINK',deleted_at,payload:{fictional:true,schemaVersion:1,parentProjectId:id(parent),childProjectId:id(child)}});
const task=(n,done=false,extra={})=>({...base(n,'task'),payload:{fictional:true,title:'Fictional task '+n,done,...extra}});
const membership=(n,taskId,projectId,deleted_at=null)=>({...base(n,'project_task_link'),origin:'PRIVATE_COOKIE_PROJECT_TASK_LINK',deleted_at,payload:{fictional:true,schemaVersion:1,taskId:id(taskId),projectId:id(projectId)}});
const snapshot=()=>({ownerId,projects:[project(1),project(2),project(3),project(4),project(5)],relationships:[relationship(10,1,2),relationship(11,1,3),relationship(12,2,4)]});
test('one-master trees do not duplicate tasks linked to several projects',()=>{
 const s={...snapshot(),rootProjectId:id(1),tasks:[task(20,true),task(21),task(22)],memberships:[membership(30,20,1),membership(31,20,4),membership(32,21,2),membership(33,21,3),membership(34,22,5)]},before=structuredClone(s),v=hierarchyProgress(s);
 assert.deepEqual(v.projectIds,[1,2,3,4].map(id));assert.deepEqual(v.taskIds,[id(20),id(21)]);assert.equal(v.progress.total,2);assert.equal(v.progress.completed,1);assert.equal(v.progress.percentage,50);assert.deepEqual(s,before);
});
test('cycle validation rejects self links, indirect cycles and a second active master',()=>{
 const s=snapshot();assert.throws(()=>validateHierarchyChange(s,{parentProjectId:id(1),childProjectId:id(1),linked:true}));assert.throws(()=>validateHierarchyChange(s,{parentProjectId:id(4),childProjectId:id(1),linked:true}),/itself/);assert.throws(()=>validateHierarchyChange(s,{parentProjectId:id(5),childProjectId:id(4),linked:true}),/only one master/);
});
test('existing cycles anywhere fail closed even outside the requested root',()=>{
 const s=snapshot();s.relationships.push(relationship(14,4,1));assert.throws(()=>validateProjectHierarchy(s));assert.throws(()=>hierarchyProgress({...s,rootProjectId:id(5),tasks:[],memberships:[]}));
});
test('canonical retired relationships can be restored but cannot restore a cycle',()=>{
 const s=snapshot();s.relationships.push(relationship(14,5,4,'2026-11-16T00:00:00Z'));assert.throws(()=>validateHierarchyChange(s,{parentProjectId:id(5),childProjectId:id(4),linked:true}),/only one master/);s.relationships.find(r=>r.id===id(12)).deleted_at='2026-11-16T00:00:00Z';assert.deepEqual(validateHierarchyChange(s,{parentProjectId:id(5),childProjectId:id(4),linked:true}),{parentProjectId:id(5),childProjectId:id(4),linked:true,noChanges:false,relationshipId:id(14)});
 s.relationships.find(r=>r.id===id(12)).deleted_at=null;s.relationships.push(relationship(15,4,1,'2026-11-16T00:00:00Z'));assert.throws(()=>validateHierarchyChange(s,{parentProjectId:id(4),childProjectId:id(1),linked:true}),/itself/);
});
test('idempotent link and unlink retain canonical identity without changing input',()=>{
 const s=snapshot(),before=structuredClone(s);assert.equal(validateHierarchyChange(s,{parentProjectId:id(1),childProjectId:id(2),linked:true}).noChanges,true);assert.equal(validateHierarchyChange(s,{parentProjectId:id(5),childProjectId:id(2),linked:false}).noChanges,true);assert.equal(validateHierarchyChange(s,{parentProjectId:id(1),childProjectId:id(2),linked:false}).relationshipId,id(10));assert.deepEqual(s,before);
});
test('retired graph links do not add descendants and retired task links do not count',()=>{
 const s={ownerId,projects:[project(1),project(2)],relationships:[relationship(10,1,2,'2026-11-16T00:00:00Z')],rootProjectId:id(1),tasks:[task(20),task(21,true)],memberships:[membership(30,20,1),membership(31,21,2),membership(32,21,1,'2026-11-16T00:00:00Z')]};const v=hierarchyProgress(s);assert.deepEqual(v.projectIds,[id(1)]);assert.deepEqual(v.taskIds,[id(20)]);assert.equal(v.progress.completed,0);
});
test('duplicate relationship IDs or canonical pairs, including retired duplicates, are rejected',()=>{
 for(const link of [relationship(10,5,4),relationship(14,1,2),relationship(14,1,2,'2026-11-16T00:00:00Z')]){const s=snapshot();s.relationships.push(link);assert.throws(()=>validateProjectHierarchy(s));}
});
test('foreign, household, deleted and unsupported projects never enter a graph',()=>{
 for(const patch of [{owner_id:other},{household_id:id(100)},{visibility:'household'},{deleted_at:'2026-11-16T00:00:00Z'},{origin:'unknown'},{version:0},{section:'Finances'},{payload:{fictional:true,schemaVersion:1,title:'Valid',status:'Unknown'}}]){const s=snapshot();Object.assign(s.projects[0],patch);assert.throws(()=>validateProjectHierarchy(s));}
});
test('relationship scope, shape and dangling active targets fail closed',()=>{
 for(const patch of [{owner_id:other},{household_id:id(100)},{visibility:'household'},{origin:'unknown'},{deleted_at:'invalid'},{section:'Work'},{payload:{fictional:true,schemaVersion:1,parentProjectId:id(1),childProjectId:id(100)}},{payload:{fictional:true,schemaVersion:1,parentProjectId:id(1),childProjectId:id(2),extra:true}}]){const s=snapshot();Object.assign(s.relationships[0],patch);assert.throws(()=>validateProjectHierarchy(s));}
});
test('missing roots or change endpoints and malformed owner identifiers are rejected',()=>{
 const s=snapshot();assert.throws(()=>validateProjectHierarchy({...s,ownerId:'wrong'}));assert.throws(()=>hierarchyProgress({...s,rootProjectId:id(900),tasks:[],memberships:[]}));assert.throws(()=>validateHierarchyChange(s,{parentProjectId:id(900),childProjectId:id(2),linked:true}));assert.throws(()=>validateHierarchyChange(s,{parentProjectId:id(1),childProjectId:id(2),linked:'yes'}));
});
test('root recurring option governs rollup without changing descendant policies or statuses',()=>{
 const recurrence={anchorDay:'2026-11-16',frequency:'daily',interval:1,ordinal:0,seriesId:id(400)};
 const s={...snapshot(),rootProjectId:id(1),tasks:[task(20,true,{recurrence}),task(21)],memberships:[membership(30,20,4),membership(31,21,2)]};s.projects[1].payload.separateRecurring=false;
 const first=hierarchyProgress(s);assert.equal(first.progress.total,1);assert.equal(first.progress.recurringTotal,1);assert.equal(first.progress.percentage,0);s.projects[0].payload.separateRecurring=false;const second=hierarchyProgress(s);assert.equal(second.progress.total,2);assert.equal(second.progress.percentage,50);assert.equal(s.projects[0].payload.status,'Active');
});
test('stopped repeats count normally and an empty rollup has no percentage',()=>{
 const s={...snapshot(),rootProjectId:id(1),tasks:[task(20,true,{recurrence:{anchorDay:'2026-11-16',frequency:'daily',interval:1,ordinal:0,seriesId:id(400)},recurrenceStopped:true})],memberships:[membership(30,20,4)]};assert.equal(hierarchyProgress(s).progress.percentage,100);assert.equal(hierarchyProgress({...s,memberships:[]}).progress.percentage,null);
});
test('foreign, invalid recurrence and duplicate tasks fail rather than produce partial counters',()=>{
 for(const tasks of [[{...task(20),owner_id:other}],[task(20),task(20)],[task(20,false,{recurrence:{}})],[{...task(20),deleted_at:'2026-11-16T00:00:00Z'}]])assert.throws(()=>hierarchyProgress({...snapshot(),rootProjectId:id(1),tasks,memberships:[]}));
});
test('dangling, foreign or duplicate active task memberships reject the complete rollup',()=>{
 const s={...snapshot(),rootProjectId:id(1),tasks:[task(20)],memberships:[membership(30,20,1)]};for(const memberships of [[membership(30,21,1)],[membership(30,20,900)],[{...membership(30,20,1),owner_id:other}],[membership(30,20,1),membership(31,20,1)]])assert.throws(()=>hierarchyProgress({...s,memberships}));
});
test('technical collection bounds fail closed, and a 2000-project chain needs no recursive stack or depth policy',()=>{
 const projects=Array.from({length:2000},(_,i)=>project(i+1)),relationships=Array.from({length:1999},(_,i)=>relationship(3000+i,i+1,i+2)),s={ownerId,projects,relationships};assert.equal(hierarchyProgress({...s,rootProjectId:id(1),tasks:[],memberships:[]}).projectIds.length,2000);assert.throws(()=>validateHierarchyChange(s,{parentProjectId:id(2000),childProjectId:id(1),linked:true}),/itself/);assert.throws(()=>validateProjectHierarchy({...s,projects:[...projects,project(2001)]}));assert.throws(()=>validateProjectHierarchy({...s,relationships:Array(2001).fill(relationships[0])}));assert.throws(()=>hierarchyProgress({...s,rootProjectId:id(1),tasks:Array(2001).fill(task(20)),memberships:[]}));
});
test('inactive historical relationships may refer to deleted projects absent from the active snapshot',()=>{
 const s=snapshot();s.relationships.push(relationship(14,900,901,'2026-11-16T00:00:00Z'));const result=validateProjectHierarchy(s);assert.equal(result.relationships.at(-1).active,false);assert.equal(hierarchyProgress({...s,rootProjectId:id(1),tasks:[],memberships:[]}).projectIds.length,4);s.relationships.at(-1).owner_id=other;assert.throws(()=>validateProjectHierarchy(s));
});
test('all supplied snapshots must be complete arrays with unique project identities',()=>{
 const s=snapshot();assert.throws(()=>validateProjectHierarchy({...s,projects:[...s.projects,s.projects[0]]}));assert.throws(()=>validateProjectHierarchy({...s,relationships:null}));assert.throws(()=>hierarchyProgress({...s,rootProjectId:id(1),tasks:[],memberships:Array(2001).fill(membership(30,20,1))}));
});

test('archived descendants retain deduplicated parent progress until their single master link is unlinked',()=>{
 const s={...snapshot(),rootProjectId:id(1),tasks:[task(20,true),task(21)],memberships:[membership(30,20,4),membership(31,21,2)]};const before=hierarchyProgress(s);s.projects.find(p=>p.id===id(4)).payload.archived=true;assert.deepEqual(hierarchyProgress(s),before);s.relationships.find(r=>r.id===id(12)).deleted_at='2026-11-16T00:00:00Z';assert.notDeepEqual(hierarchyProgress(s),before);assert.equal(s.tasks[0].payload.done,true);assert.equal(s.memberships.length,2);
});

test('a preexisting diamond fails closed even if the requested change is unrelated',()=>{
 const s=snapshot();s.relationships.push(relationship(13,3,4));const before=structuredClone(s);assert.throws(()=>validateProjectHierarchy(s));assert.throws(()=>hierarchyProgress({...s,rootProjectId:id(5),tasks:[],memberships:[]}));assert.throws(()=>validateHierarchyChange(s,{parentProjectId:id(1),childProjectId:id(5),linked:true}));assert.deepEqual(s,before);
});
test('explicit unlink then reparent preserves retired identity and never copies projects or tasks',()=>{
 const s=snapshot(),beforeProjects=structuredClone(s.projects);const unlink=validateHierarchyChange(s,{parentProjectId:id(2),childProjectId:id(4),linked:false});assert.equal(unlink.relationshipId,id(12));s.relationships.find(r=>r.id===unlink.relationshipId).deleted_at='2026-11-16T00:00:00Z';const linked=validateHierarchyChange(s,{parentProjectId:id(3),childProjectId:id(4),linked:true});assert.equal(linked.noChanges,false);assert.equal(linked.relationshipId,null);s.relationships.push(relationship(13,3,4));assert.doesNotThrow(()=>validateProjectHierarchy(s));assert.throws(()=>validateHierarchyChange(s,{parentProjectId:id(2),childProjectId:id(4),linked:true}),/only one master/);assert.equal(s.relationships.find(r=>r.id===id(12)).deleted_at,'2026-11-16T00:00:00Z');assert.deepEqual(s.projects,beforeProjects);
});
