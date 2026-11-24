import {defaultBriefLayout} from '../src/private-brief-layout.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {projectWorkspaceHttp} from './support/private-workspace-http.mjs';
const scope={fixtures:true,previewPort:5316,serveWorkspace:true,allowBriefRead:true,allowBriefLayout:true,allowTaskWorkspace:true,allowSearch:true,allowTaskPriorityLists:true,allowSearchDates:true,allowUndatedTasks:true,allowTaskCreate:true,allowTaskRead:true,allowTaskDescriptionEdit:true,allowTaskEdit:true,allowTaskCompletion:true,allowTaskReopen:true,allowProjects:true,allowProjectTaskLinks:true,allowProjectHierarchy:true,allowSavedSearches:true};
const setup=(t,extra={})=>projectWorkspaceHttp(t,{...scope,...extra});
test('Brief layout review persists only after approval and reopens exact saved order with replay blocked',async t=>{
 const s=await setup(t);const initial=await s.call('brief-layout/read',{});assert.equal(initial.status,200);assert.deepEqual(initial.data.layout,defaultBriefLayout());assert.doesNotMatch(JSON.stringify(initial.data),/owner_id|payload|origin|accessToken/);
 const layout=structuredClone(initial.data.layout);layout.sections.reverse();layout.sections.find(s=>s.id==='dueTasks').display='hidden';layout.sections.find(s=>s.id==='completedTasks').display='expanded';const review=await s.call('brief-layout/review',{baseTag:initial.data.baseTag,layout});assert.equal(review.status,200);assert.deepEqual(review.data.layout,layout);
 assert.equal((await s.call('brief-layout/save',{reviewId:review.data.reviewId,approved:false})).status,409);assert.equal((await s.call('brief-layout/save',{reviewId:review.data.reviewId,approved:true})).status,200);assert.equal((await s.call('brief-layout/save',{reviewId:review.data.reviewId,approved:true})).status,409);
 const latest=await s.call('brief-layout/read',{});assert.deepEqual(latest.data.layout,layout);const noChange=await s.call('brief-layout/review',{baseTag:latest.data.baseTag,layout});assert.equal(noChange.data.noChanges,true);assert.equal((await s.call('brief-layout/cancel',{})).status,200);
});
test('cancellation and Brief refresh invalidate layout reviews without changing saved settings',async t=>{
 const s=await setup(t);for(const action of ['cancel','brief']){const initial=await s.call('brief-layout/read',{}),layout=structuredClone(initial.data.layout);layout.sections[0].display='hidden';const review=await s.call('brief-layout/review',{baseTag:initial.data.baseTag,layout});assert.equal(review.status,200);if(action==='cancel')await s.call('brief-layout/cancel',{});else await s.call('brief');assert.equal((await s.call('brief-layout/save',{reviewId:review.data.reviewId,approved:true})).status,409);assert.deepEqual((await s.call('brief-layout/read',{})).data.layout,defaultBriefLayout());}
});
test('disabled layout scope and malformed or unauthorized layout fields cannot be used to change access',async t=>{
 const off=await setup(t,{allowBriefLayout:false});assert.equal((await off.call('brief-layout/read',{})).status,404);const s=await setup(t),initial=await s.call('brief-layout/read',{});for(const layout of [{...initial.data.layout,sources:{gmail:true}},{schemaVersion:2,sections:[]},{schemaVersion:1,sections:Array(8).fill({id:'dueTasks',display:'hidden'})}])assert.equal((await s.call('brief-layout/review',{baseTag:initial.data.baseTag,layout})).status,409);assert.deepEqual((await s.call('brief-layout/read',{})).data.layout,defaultBriefLayout());
});
test('reviewed narrative controls persist separately from appearance and record fields',async t=>{
 const s=await setup(t),initial=await s.call('brief-layout/read',{}),before=await s.call('brief');
 const latest=await s.call('brief-layout/read',{}),layout=structuredClone(latest.data.layout);layout.narrative={length:'detailed',detail:'titles',tone:'professional'};
 const review=await s.call('brief-layout/review',{baseTag:latest.data.baseTag,layout});assert.equal(review.status,200);assert.deepEqual(review.data.layout.narrative,layout.narrative);
 assert.deepEqual((await s.call('brief-layout/read',{})).data.layout,initial.data.layout);assert.equal((await s.call('brief-layout/save',{reviewId:review.data.reviewId,approved:true})).status,409);
 const read=await s.call('brief-layout/read',{}),next=await s.call('brief-layout/review',{baseTag:read.data.baseTag,layout});assert.equal((await s.call('brief-layout/save',{reviewId:next.data.reviewId,approved:true})).status,200);
 assert.deepEqual((await s.call('brief-layout/read',{})).data.layout,layout);const after=await s.call('brief');for(const key of ['dueTasks','upcomingTasks','completedTasks','eventsToday','upcomingEvents','notes'])assert.deepEqual(after.data[key].map(({title})=>title),before.data[key].map(({title})=>title));
});
test('invalid narrative preferences cannot introduce source permissions or content through layout reviews',async t=>{
 const s=await setup(t),read=await s.call('brief-layout/read',{});
 for(const narrative of [null,{length:'detailed',detail:'titles',tone:'unknown'},{length:'standard',detail:'bodies',tone:'professional'},{length:'standard',detail:'overview',tone:'professional',providerRead:true},{length:'standard',detail:'overview',tone:'<script>untrusted</script>'}]){
  const response=await s.call('brief-layout/review',{baseTag:read.data.baseTag,layout:{...read.data.layout,narrative}});assert.equal(response.status,409);assert.doesNotMatch(JSON.stringify(response.data),/untrusted|providerRead|bodies/);
 }
 assert.deepEqual((await s.call('brief-layout/read',{})).data.layout,read.data.layout);
});
test('Calendar display is independently opted in and reviewed while Brief preferences stay intact',async t=>{
 const off=await setup(t);assert.equal((await off.call('calendar-presentation/read',{})).status,404);
 const s=await setup(t,{allowCalendarWorkspace:true,allowCalendarPresentation:true,allowEventCreate:true,allowEventEdit:true,allowEventDetails:true});const before=await s.call('brief-layout/read',{}),read=await s.call('calendar-presentation/read',{});assert.equal(read.status,200);assert.deepEqual(read.data.layout,{schemaVersion:1,monthDisplay:'details'});assert.doesNotMatch(JSON.stringify(read.data),/owner_id|payload|origin|accessToken/);
 const layout={schemaVersion:1,monthDisplay:'dots'},review=await s.call('calendar-presentation/review',{baseTag:read.data.baseTag,layout});assert.equal(review.status,200);assert.equal((await s.call('calendar-presentation/save',{reviewId:review.data.reviewId,approved:true})).status,200);assert.equal((await s.call('calendar-presentation/save',{reviewId:review.data.reviewId,approved:true})).status,409);assert.deepEqual((await s.call('calendar-presentation/read',{})).data.layout,layout);assert.deepEqual((await s.call('brief-layout/read',{})).data.layout,before.data.layout);
 const current=await s.call('calendar-presentation/read',{});assert.equal((await s.call('calendar-presentation/review',{baseTag:current.data.baseTag,layout:{schemaVersion:1,monthDisplay:'details',providerRead:true}})).status,409);assert.deepEqual((await s.call('calendar-presentation/read',{})).data.layout,layout);
});
