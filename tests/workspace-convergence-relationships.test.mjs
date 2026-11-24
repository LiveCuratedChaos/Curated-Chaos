// Reused from private source a6a7f33d0086cf739d8e4963ea61eac65854b6d0; current approved contracts apply.
import test from 'node:test';import assert from 'node:assert/strict';
import {checkWorkspaceConvergenceRelationships as check} from '../server/workspace-convergence-relationships.mjs';
import {makeManualProject,makeManualTask} from '../src/project-workspace-model.mjs';
const owner='11111111-1111-4111-8111-111111111111';
const id=n=>'22222222-2222-4222-8222-'+String(n).padStart(12,'0');
function row(n,type,payload){return{id:id(n),owner_id:owner,household_id:null,visibility:'private',deleted_at:null,version:1,section:'Personal Life',item_type:type,origin:({project:'PRIVATE_COOKIE_PROJECT',task:'PRIVATE_COOKIE_TASK_CREATE',project_task_link:'PRIVATE_COOKIE_PROJECT_TASK_LINK',project_project_link:'PRIVATE_COOKIE_PROJECT_PROJECT_LINK'})[type],payload:{schemaVersion:1,fictional:true,...payload}};}
const project=(n,extra={})=>row(n,'project',{title:'Private project',description:'private description',status:'Planned',...extra});
const task=n=>row(n,'task',{title:'Private task',done:false});
const hierarchy=(n,parent,child)=>row(n,'project_project_link',{parentProjectId:id(parent),childProjectId:id(child)});
const membership=(n,p,t)=>row(n,'project_task_link',{projectId:id(p),taskId:id(t)});
const run=records=>check({records,ownerId:owner,complete:true});
const manualProject=n=>({...makeManualProject({title:'Private manual'},owner),id:id(n),version:1,deleted_at:null});
test('combined relationship acceptance preserves multiple task memberships, single-master hierarchy, archived edges and manual assignments',()=>{
 const p=manualProject(20),t={...makeManualTask({title:'Private manual task',project_id:p.id,status:'Waiting',description:' x\n '.repeat(500)},owner,[p]),id:id(21),version:4,deleted_at:null};
 const rows=[project(1,{archived:true,separateRecurring:false}),project(2),project(3),project(4),task(5),hierarchy(6,1,2),hierarchy(7,1,3),hierarchy(8,2,4),membership(10,1,5),membership(11,4,5),p,t],before=structuredClone(rows),report=run(rows);
 assert.deepEqual(rows,before);assert.deepEqual(report.counts,{manualProjects:1,manualTasks:1,reviewedProjects:4,reviewedTasks:1,manualAssignments:1,reviewedMemberships:2,hierarchyLinks:3,multipleParentProjects:0,multipleProjectTasks:1,archivedProjectMemberships:1,archivedHierarchyLinks:2});
 assert.equal(report.migrationReady,false);assert.equal(report.recordWrites,0);assert.equal(report.automaticConversionAllowed,false);assert.equal(report.fullPayloadCompatibilityValidated,false);assert.equal(report.historyCompatibilityValidated,false);assert.doesNotMatch(JSON.stringify(report),/Private|22222222|11111111| x\\n/);
});
test('empty and unassigned workspaces need no manufactured project or relationship',()=>{assert.equal(run([]).relationshipValidationPerformed,true);assert.equal(run([task(1)]).counts.reviewedTasks,1);assert.equal(run([manualProject(2)]).counts.manualAssignments,0);});
test('dangling, wrong-type, cross-provenance and repeated membership endpoints fail closed',()=>{
 for(const rows of [[project(1),membership(3,1,2)],[task(2),membership(3,1,2)],[project(1),task(2),membership(3,2,1)],[manualProject(1),task(2),membership(3,1,2)],[project(1),task(2),membership(3,1,2),membership(4,1,2)]])assert.throws(()=>run(rows),/^Error: Complete compatible owner-private workspace relationships required\.$/);
 const p=project(1),t={...makeManualTask({title:'x'},owner),id:id(2),version:1,deleted_at:null};t.payload.project_id=p.id;assert.throws(()=>run([p,t]));
});
test('cycles, self-links, missing parents, duplicate edges and unexpected link payloads fail closed',()=>{
 for(const links of [[hierarchy(3,1,2),hierarchy(4,2,1)],[hierarchy(3,1,1)],[hierarchy(3,1,9)],[hierarchy(3,1,2),hierarchy(4,1,2)],[{...hierarchy(3,1,2),payload:{...hierarchy(3,1,2).payload,privateExtension:'never print'}}]])assert.throws(()=>run([project(1),project(2),...links]));
});
test('unknown provenance, fabricated manual links and incomplete/private scope violations fail without disclosing input',()=>{
 const r=task(1);for(const patch of [{origin:'PROVIDER_IMPORT'},{owner_id:id(9)},{household_id:owner},{deleted_at:'2026-11-17'},{version:0}])assert.throws(()=>run([{...r,...patch}]),e=>e.message==='Complete compatible owner-private workspace relationships required.');
 assert.throws(()=>check({records:[r],ownerId:owner,complete:false}));assert.throws(()=>run([r,{...r,id:r.id.toUpperCase()}]));
 const link=membership(3,1,2);link.origin='CC_MANUAL_WORKSPACE';link.payload={schemaVersion:1,source:'manual',fictional:false};assert.throws(()=>run([link]));
});
test('long acyclic hierarchies are checked iteratively without recursion or mutation',()=>{const rows=[];for(let n=1;n<=900;n++){rows.push(project(n));if(n>1)rows.push(hierarchy(1000+n,n-1,n));}const before=JSON.stringify(rows);assert.equal(run(rows).counts.hierarchyLinks,899);assert.equal(JSON.stringify(rows),before);});

test('approved single-master project hierarchy rejects older diamond parents without unlinking or losing reusable tasks',()=>{const rows=[project(1),project(2),project(3),project(4),task(5),hierarchy(6,1,2),hierarchy(7,1,3),hierarchy(8,2,4),hierarchy(9,3,4),membership(10,1,5),membership(11,4,5)],before=structuredClone(rows);assert.throws(()=>run(rows),e=>e.code==='PROJECT_HIERARCHY_SINGLE_PARENT'&&e.message==='Complete compatible owner-private workspace relationships required.');assert.deepEqual(rows,before);const allowed=rows.filter(r=>r.id!==id(9)),report=run(allowed);assert.equal(report.counts.multipleParentProjects,0);assert.equal(report.counts.multipleProjectTasks,1);assert.ok(report.requiredContracts.some(s=>s.includes('single-master')));assert.ok(report.requiredContracts.every(s=>!s.includes('several-parent')));});

