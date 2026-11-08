// M0G: Pure presentation filters for fictional private tasks only.
import { TASK_SECTIONS } from './dev-brief-model.mjs';
export const TASK_FILTERS=['all','open','completed'];
export function selectTasks(tasks, {status='all',section='all'}={}) {
  if(!TASK_FILTERS.includes(status) || (section!=='all' && !TASK_SECTIONS.includes(section)))throw Error('Unsupported QA task filter.');
  return (Array.isArray(tasks)?tasks:[]).filter(task=>task?.item_type==='task' &&
    (section==='all' || task.section===section) &&
    (status==='all' || (status==='completed'?task.payload?.done===true:task.payload?.done===false)))
    .sort((a,b)=>a.payload.day.localeCompare(b.payload.day)||a.created_at.localeCompare(b.created_at));
}
export function taskCounts(tasks){return {total:tasks.length,open:tasks.filter(t=>!t.payload.done).length,completed:tasks.filter(t=>t.payload.done).length};}
