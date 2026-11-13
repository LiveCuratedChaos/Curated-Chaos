// Copy only the explicitly selected task display; no reads, writes, IDs or history.
import {TASK_PRIORITIES} from './task-priorities.mjs';
const day=v=>typeof v==='string'&&/^(?:20\d\d|2100)-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export function taskCopyDraft(view,{now=Date.now(),allowLongDescription=false}={}){
 if(typeof allowLongDescription!=='boolean')throw Error('Explicit task-description copy limit required.');const descriptionLimit=allowLongDescription?10000:1000;
 if(!Number.isFinite(now)||view?.readOnly!==true||!Number.isFinite(view.expiresAt)||view.expiresAt<=now)throw Error('Open a fresh task view before copying it.');
 if(typeof view.title!=='string'||!view.title.trim()||view.title!==view.title.trim()||view.title.length>140||typeof view.day!=='string'||view.day!==''&&!day(view.day)||!['Home','Personal Life','Work','School'].includes(view.section)||!TASK_PRIORITIES.includes(view.priority)||typeof view.completed!=='boolean'||typeof view.description!=='string'||view.description.length>descriptionLimit||!Array.isArray(view.subtasks)||view.subtasks.length>20||view.subtaskCount!==view.subtasks.length||view.omittedSubtasks!==0||view.subtasks.some(step=>!step||typeof step.title!=='string'||!step.title.trim()||step.title!==step.title.trim()||step.title.length>140||/[\r\n]/.test(step.title)||typeof step.done!=='boolean'))throw Error('This task cannot be copied completely within the new-task limits: a 140-character title, '+descriptionLimit+'-character description and 20 single-line steps. Nothing was copied.');
 return{title:view.title,day:view.day,section:view.section,priority:view.priority,description:view.description,subtaskText:view.subtasks.map(step=>step.title).join('\n')};
}
