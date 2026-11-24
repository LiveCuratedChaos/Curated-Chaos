import test from 'node:test';import assert from 'node:assert/strict';import {projectWorkspaceHttp} from './support/private-workspace-http.mjs';
const scope={fixtures:true,previewPort:5316,serveWorkspace:true,allowBriefRead:true,allowTaskWorkspace:true,allowSearch:true,allowTaskPriorityLists:true,allowSearchDates:true,allowUndatedTasks:true,allowTaskCreate:true,allowTaskRead:true,allowTaskDescriptionEdit:true,allowTaskEdit:true,allowTaskCompletion:true,allowTaskReopen:true,allowProjects:true,allowProjectTaskLinks:true,allowProjectHierarchy:true,allowSavedSearches:true};
const setup=(t,extra={})=>projectWorkspaceHttp(t,{...scope,...extra});
test('project title search opens exact details without granting project edit authority and saves reusable filters',async t=>{
 const s=await setup(t);await s.create('Fictional searchable project');
 const fields={query:'searchable',type:'project',section:'all',status:'all',priority:'all',dateFrom:'',dateTo:'',dateStatus:'all'};
 const found=await s.call('search',fields);assert.equal(found.status,200);assert.equal(found.data.matchCount,1);const result=found.data.results[0];assert.equal(result.projectStatus,'Active');assert.match(result.projectReadToken,/^[A-Za-z0-9_-]{43}$/);assert.doesNotMatch(JSON.stringify(found.data),/description|owner_id|payload|projectToken/);
 const read=await s.call('search/project-read',{projectReadToken:result.projectReadToken});assert.equal(read.status,200);assert.equal(read.data.readOnly,true);assert.equal(read.data.title,'Fictional searchable project');
 assert.equal((await s.call('projects/read',{projectToken:result.projectReadToken})).status,409);
 const savedReview=await s.call('saved-searches/review',{action:'create',saveSearchToken:found.data.saveSearchToken,name:'Fictional project shortcut'});assert.equal(savedReview.status,200);assert.equal((await s.call('saved-searches/save',{reviewId:savedReview.data.reviewId,approved:true})).status,200);
 const saved=await s.call('saved-searches/list',{});assert.equal(saved.status,200);const loaded=await s.call('saved-searches/load',{savedSearchToken:saved.data.records[0].savedSearchToken});assert.equal(loaded.data.filters.type,'project');assert.equal((await s.call('search',loaded.data.filters)).data.matchCount,1);
 assert.equal((await s.call('search/project-read',{projectReadToken:result.projectReadToken})).status,409);
});
test('fresh search, Brief refresh, project mutation and sign-out invalidate displayed project read capabilities',async t=>{
 const s=await setup(t);await s.create('Fictional lifecycle project');const fields={query:'lifecycle',type:'all',section:'all',status:'all'};
 for(const action of ['search','brief','project','logout']){const found=await s.call('search',fields);assert.equal(found.status,200);const key=found.data.results[0].projectReadToken;
  if(action==='search')await s.call('search',fields);if(action==='brief')await s.call('brief');if(action==='project')await s.call('projects/list',{});if(action==='logout')await s.call('logout',{});
  assert.ok([401,403,409].includes((await s.call('search/project-read',{projectReadToken:key})).status),action);
 }
});
test('project search/read are unavailable when private project scope is disabled',async t=>{
 const s=await setup(t,{allowProjects:false,allowProjectTaskLinks:false,allowProjectHierarchy:false});assert.equal((await s.call('search',{query:'fictional',type:'project',section:'all'})).status,409);assert.equal((await s.call('search/project-read',{projectReadToken:'p'.repeat(43)})).status,404);
});
