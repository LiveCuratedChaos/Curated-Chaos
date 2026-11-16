// Prepare a reviewed next-occurrence draft from an already selected task view.
// No task creation, completion, history edits, IDs, network calls or automatic retry.
import {taskCopyDraft} from './private-task-copy.mjs';
import {nextTaskOccurrence} from './task-recurrence.mjs';
export function recurringTaskDraft(view,{schedule,completedOn,now=Date.now(),allowLongDescription=false}={}){
 const draft=taskCopyDraft(view,{now,allowLongDescription});
 const next=nextTaskOccurrence({schedule,currentDueDay:draft.day,completedOn});
 return{...draft,day:next.day,recurrence:next.schedule,skippedOccurrences:next.skippedOccurrences};
}
