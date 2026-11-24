import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {routineProgress,readRoutineProgress} from '../server/private-routine-streak.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {nextTaskOccurrence} from '../src/task-recurrence.mjs';
const owner=randomUUID(),schedule={anchorDay:'2026-11-01',frequency:'daily',interval:1};
function series(completions){
 const id=randomUUID();
 function row(idForRow,day,ordinal,prior){
  return {id:idForRow,version:1,section:'Home',owner_id:owner,visibility:'private',household_id:null,deleted_at:null,item_type:'task',
   payload:{fictional:true,day,done:false,recurrence:{...schedule,seriesId:id,ordinal},...(prior?{recurrence_predecessor:prior}: {})}};
 }
 const rows=[row(id,schedule.anchorDay,0)];
 for(const reviewDay of completions){
  const previous=rows.at(-1),successorId=randomUUID(),next=nextTaskOccurrence({schedule,currentDueDay:previous.payload.day,completedOn:reviewDay});
  previous.payload.done=true;previous.payload.recurrence_completion={reviewDay,successorId,nextDay:next.day,schedule};
  rows.push(row(successorId,next.day,next.ordinal,previous.id));
 }
 return rows;
}
function summary(rows,asOf,selected=rows.at(-1)){return routineProgress(rows,{owner,selected,now:Date.parse(asOf+'T16:00:00Z')});}
test('current streak holds through the due day, resets on a missed due date, and restarts with the next timely completion',()=>{
 const rows=series(['2026-11-01','2026-11-02']);
 assert.equal(summary(rows,'2026-11-03').streak,2);assert.equal(summary(rows,'2026-11-04').streak,0);
 const resumed=series(['2026-11-01','2026-11-02','2026-11-05','2026-11-06']);
 assert.deepEqual(summary(resumed,'2026-11-06'),{scheduled:true,streak:1,completed:4,stopped:false,asOf:'2026-11-06'});
 resumed[3].payload.done=false;assert.equal(summary(resumed,'2026-11-06').streak,0);
});
test('foreign, deleted, duplicate, misaligned, and incomplete histories cannot produce a count',()=>{
 for(const patch of [rows=>rows.pop(),rows=>rows.shift(),rows=>rows.push(rows[0]),rows=>rows[0].owner_id=randomUUID(),
  rows=>rows[0].deleted_at='2026-11-01',rows=>rows[1].payload.day='2026-11-04']){
  const rows=series(['2026-11-01','2026-11-02']);patch(rows);
  assert.throws(()=>summary(rows,'2026-11-03'));
 }
});
test('selection expiry while the series loads suppresses the late result',async()=>{
 const rows=series(['2026-11-01']),record=rows[0],now=()=>Date.parse('2026-11-02T17:00:00Z');let current=true;
 const options={reader:{selectedRecord:async()=>({record,expiresAt:now()+1000}),current:()=>current},actor:{ownerId:owner,accessToken:'fictional'},
  contextId:'ctx',taskReadToken:'selected',now,api:{getPrivateTask:async()=>[record],listRoutineOccurrences:async()=>rows}};
 assert.equal((await readRoutineProgress(options)).streak,1);current=false;await assert.rejects(readRoutineProgress(options));
});

test('signed-in Home task moves through reviewed recurring completion and shows the same streak from both occurrences',async t=>{
 const scope={allowTaskCompletion:true,allowRecurringChores:true,allowTaskCreate:true,allowTaskRead:true,allowRoutineStreaks:true};
 const fixture=privateWorkspaceFixture(t,scope),tab=fixture.tab(),other=fixture.tab();
 await tab.login();await other.login();
 const today=(await tab.client.brief()).day;
 const title='Fictional daily cleaning';
 const draft=await tab.client.reviewNewTask({title,section:'Home',day:today});
 await tab.client.createTask(draft.reviewId);
 const original=(await tab.client.brief()).dueTasks.find(row=>row.title===title);
 assert.equal((await tab.client.readRoutineProgress(original.taskReadToken)).scheduled,false);
 await assert.rejects(other.client.readRoutineProgress(original.taskReadToken));
 const review=await tab.client.reviewCompletion(original.completionToken,{anchorDay:today,frequency:'daily',interval:1});
 await tab.client.approveCompletion(review.reviewId);
 const after=await tab.client.brief();
 for(const items of [after.completedTasks,after.upcomingTasks]){
  const task=items.find(row=>row.title===title);
  assert.ok(task);
  const result=await tab.client.readRoutineProgress(task.taskReadToken);
  assert.deepEqual({...result,expiresAt:0},{scheduled:true,streak:1,completed:1,stopped:false,asOf:today,expiresAt:0});
 }
 const off=privateWorkspaceFixture(t,{...scope,allowRoutineStreaks:false}).tab();
 await off.login();
 assert.equal((await off.fetcher('/auth/workspace/tasks/routine-progress',{method:'POST',body:'{}'})).status,404);
});
