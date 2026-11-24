import test from 'node:test';
import assert from 'node:assert/strict';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {newYorkTaskDay} from '../src/private-smart-task.mjs';
import {nextTaskOccurrence} from '../src/task-recurrence.mjs';
import {supportsOrdinaryWorkspaceRestore} from '../server/private-workspace-restore-contract.mjs';

const scopes={allowHomeGroceries:true,allowRecurringChores:true,allowUndatedTasks:true,allowTaskCreate:true,allowTaskRead:true,allowTaskEdit:true,allowTaskDescriptionEdit:true,allowTaskDescriptions:true,allowTaskSubtasks:true,allowTaskCompletion:true,allowSearch:true,allowTaskReopen:true};
const byTitle=(brief,title)=>[...brief.dueTasks,...brief.upcomingTasks,...brief.undatedTasks,...brief.completedTasks].filter(task=>task.title===title);
test('grocery Quick Add creates an undated Home item with or without quantity and uses the ordinary completion flow',async t=>{
 const tab=privateWorkspaceFixture(t,scopes).tab();await tab.login();
 for(const quantity of ['','2 cartons']){
  const title='Fixture milk '+(quantity||'plain'),homeGrocery={quantity,favorite:false};
  const proposal={title,day:'',section:'Home',homeGrocery},cancel=await tab.client.reviewNewTask(proposal);
  await tab.client.cancelNewTask();await assert.rejects(tab.client.createTask(cancel.reviewId));
  assert.equal(byTitle(await tab.client.brief(),title).length,0);
  const review=await tab.client.reviewNewTask(proposal);assert.deepEqual(review.homeGrocery,homeGrocery);
  await tab.client.createTask(review.reviewId);await assert.rejects(tab.client.createTask(review.reviewId));
  const [row]=byTitle(await tab.client.brief(),title);assert.equal(row.day,'');assert.deepEqual(row.homeGrocery,homeGrocery);
  const completed=await tab.client.reviewCompletion(row.completionToken);await tab.client.approveCompletion(completed.reviewId);
  assert.equal((await tab.client.brief()).completedTasks.filter(x=>x.title===title).length,1);
 }
});
test('saved routine starts with one occurrence and only approved completion creates the next scheduled task',async t=>{
 const app=privateWorkspaceFixture(t,{...scopes,allowTaskRead:true,allowBriefLayout:true,allowBriefDates:true}),tab=app.tab(),observer=app.tab();await tab.login();await observer.login();
 const day=newYorkTaskDay(Date.now()),title='Fixture stretch',schedule={anchorDay:day,frequency:'daily',interval:2};
 const review=await tab.client.reviewNewTask({title,day,section:'Personal Life',schedule});assert.deepEqual(review.schedule,schedule);
 assert.equal(byTitle(await observer.client.brief(),title).length,0);await tab.client.createTask(review.reviewId);
 const brief=await tab.client.brief();
 const [first]=byTitle(brief,title);
 const original=brief.routines.rows.find(row=>row.title===title);
 assert.equal(original.done,false);
 assert.equal(original.taskReadToken,first.taskReadToken);
 assert.equal((await tab.client.readTask(original.taskReadToken)).title,title);
 const next=nextTaskOccurrence({schedule,currentDueDay:day,completedOn:day}).day;
 const completion=await tab.client.reviewCompletion(first.completionToken);assert.equal(completion.nextDay,next);assert.deepEqual(completion.schedule,schedule);
 assert.deepEqual(byTitle(await tab.client.brief(),title).map(x=>x.day),[day]);
 const latest=(await tab.client.brief()).dueTasks.find(row=>row.title===title);
 const again=await tab.client.reviewCompletion(latest.completionToken);await tab.client.approveCompletion(again.reviewId);
 await assert.rejects(tab.client.approveCompletion(again.reviewId));
 const after=await tab.client.brief();
 assert.deepEqual(byTitle(after,title).map(row=>row.day).sort(),[day,next]);
 assert.equal(after.routines.rows.find(row=>row.title===title).done,true);
 assert.equal((await tab.client.brief(next)).routines.rows.find(row=>row.title===title).done,false);
 const weekly=await tab.client.briefWeek({anchor:day,range:'rolling',weekStart:1,includeRoutines:true});
 assert.deepEqual(weekly.days.find(entry=>entry.day===day).routines,{due:0,complete:1});
 assert.deepEqual(weekly.days.find(entry=>entry.day===next).routines,{due:1,complete:0});
});
test('a routine must use the enabled scope, exact first date and a schedule with a future occurrence',async t=>{
 const day='2028-02-29',schedule={anchorDay:day,frequency:'yearly',interval:1},fields={section:'School',day,title:'Fixture annual date'};
 const tab=privateWorkspaceFixture(t,scopes).tab(),off=privateWorkspaceFixture(t,{allowTaskCreate:true}).tab();await tab.login();await off.login();
 await assert.rejects(off.client.reviewNewTask({...fields,schedule}));
 for(const invalid of [{...schedule,anchorDay:'2028-02-28'},{...schedule,interval:0},{...schedule,seriesId:'unexpected'},{...schedule,anchorDay:'2100-12-31'}])await assert.rejects(tab.client.reviewNewTask({...fields,schedule:invalid}));
 await assert.rejects(tab.client.reviewNewTask({...fields,day:'2100-12-31',schedule:{...schedule,anchorDay:'2100-12-31'}}));
 const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const row={id,section:'School',item_type:'task',origin:'PRIVATE_COOKIE_TASK_CREATE',deleted_at:null,payload:{title:fields.title,fictional:true,source:'M0D_DEV_BRIEF_TEST',done:false,day,recurrence:{...schedule,seriesId:id,ordinal:0}}};
 assert.equal(supportsOrdinaryWorkspaceRestore(row),true);
 for(const patch of [{seriesId:'another'},{ordinal:1},{anchorDay:'2028-03-01'}]){
  assert.equal(supportsOrdinaryWorkspaceRestore({...row,payload:{...row.payload,recurrence:{...row.payload.recurrence,...patch}}}),false);
 }
});
