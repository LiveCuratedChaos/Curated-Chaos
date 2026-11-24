// Reused from private source a6a7f33d0086cf739d8e4963ea61eac65854b6d0; current approved contracts apply.
// First-party manual workspace model. Existing fictional organizer guards stay intact.
// Pure/browser-safe: identity, IDs, versions and clocks are supplied by the server.
import {projectProgress,ongoingRecurringTask,separatesRecurring} from './project-progress.mjs';
import {validDay} from './dev-brief-model.mjs';
import {ORG_SECTIONS,PROJECT_STATUSES,TASK_STATUSES,TASK_PRIORITIES,readSubtasks,projectCounts} from './dev-organize-model.mjs';
export const MANUAL_WORKSPACE_ORIGIN='CC_MANUAL_WORKSPACE';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const projectFields=new Set(['title','summary','status','section']);
const taskFields=new Set(['title','description','day','status','priority','project_id','subtasks','section']);
export const MANUAL_DESCRIPTION_LIMIT=10000;
const views=new Set(['all','today','upcoming','undated','completed']);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function ownerId(owner){if(typeof owner!=='string'||!uuid.test(owner))throw Error('Verified workspace owner required.');return owner;}
function text(value,max,label,required=false){if(typeof value!=='string')throw Error('Invalid '+label+'.');const result=value.trim();if(result.length>max||(required&&!result.length))throw Error('Invalid '+label+'.');return result;}
function content(value,label){if(typeof value!=='string'||value.length>MANUAL_DESCRIPTION_LIMIT||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw Error('Invalid '+label+'.');return value;}
function choice(value,allowed,label){if(!allowed.includes(value))throw Error('Invalid '+label+'.');return value;}
function fields(form,allowed){if(!object(form)||Object.keys(form).some(k=>!allowed.has(k)))throw Error('Protected or unsupported workspace field.');return form;}
function json(value,depth=0){if(depth>30)throw Error('Invalid workspace extension.');if(value===null||typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))return;if(Array.isArray(value)){for(const item of value)json(item,depth+1);return;}if(object(value)){for(const item of Object.values(value))json(item,depth+1);return;}throw Error('Invalid workspace extension.');}
function discriminator(record,owner,type){
 ownerId(owner);
 if(!object(record)||record.owner_id!==owner||record.visibility!=='private'||record.household_id!==null||record.deleted_at!==null||record.origin!==MANUAL_WORKSPACE_ORIGIN||record.item_type!==type||!uuid.test(record.id||'')||!Number.isSafeInteger(record.version)||record.version<1||!ORG_SECTIONS.includes(record.section)||!object(record.payload)||record.payload.schemaVersion!==1||record.payload.source!=='manual'||record.payload.fictional!==false)throw Error('Live owner-private manual record required.');
 json(record.payload);return record;
}
function subtasks(value,previous=[]){
 if(!Array.isArray(value)||value.length>40)throw Error('Invalid subtasks.');const ids=new Set();
 for(const item of value){if(!object(item)||typeof item.id!=='string'||!uuid.test(item.id)||typeof item.done!=='boolean'||ids.has(item.id.toLowerCase()))throw Error('Invalid subtasks.');json(item);const stored=previous.find(p=>p.id===item.id);if(Object.keys(item).some(k=>!['id','title','done'].includes(k)&&(!stored||!Object.hasOwn(stored,k)||JSON.stringify(stored[k])!==JSON.stringify(item[k]))))throw Error('Protected subtask extension.');text(item.title,140,'subtask title',true);ids.add(item.id.toLowerCase());}
 // Validate before using the established reader: it must never silently discard
 // a malformed/duplicate subtask or truncate an over-limit array.
 const read=readSubtasks(value);if(read.length!==value.length)throw Error('Invalid subtasks.');
 return read.map(item=>({...structuredClone(value.find(p=>p.id===item.id)),...structuredClone(previous.find(p=>p.id===item.id)||{}),...item,title:text(item.title,140,'subtask title',true)}));
}
function projectPayload(value){
 return {title:text(value.title,140,'project title',true),summary:content(value.summary===undefined?'':value.summary,'project summary'),status:choice(value.status===undefined?'Planned':value.status,PROJECT_STATUSES,'project status')};
}
function projectRecord(record,owner){discriminator(record,owner,'project');separatesRecurring(record.payload);const checked=projectPayload(record.payload);if(checked.title!==record.payload.title||checked.summary!==record.payload.summary||checked.status!==record.payload.status)throw Error('Invalid stored project.');return record;}
function linkedProject(id,section,owner,projects){
 if(id===null)return;
 if(typeof id!=='string'||!uuid.test(id)||!Array.isArray(projects))throw Error('Invalid project assignment.');
 const matches=projects.filter(p=>p?.id===id);if(matches.length!==1)throw Error('Invalid project assignment.');
 projectRecord(matches[0],owner);if(matches[0].section!==section)throw Error('Project must belong to the task section.');
}
function taskPayload(value,section,owner,projects,previous=[]){
 const day=value.day??null;if(day!==null&&(typeof day!=='string'||!validDay(day)))throw Error('Invalid task date.');
 const status=choice(value.status===undefined?'Not Started':value.status,TASK_STATUSES,'task status'),project_id=value.project_id??null;linkedProject(project_id,section,owner,projects);
 return {title:text(value.title,140,'task title',true),description:content(value.description===undefined?'':value.description,'task description'),day,status,priority:choice(value.priority===undefined?'Normal':value.priority,TASK_PRIORITIES,'task priority'),project_id,subtasks:subtasks(value.subtasks===undefined?[]:value.subtasks,previous),done:status==='Completed'};
}
function taskRecord(record,owner,projects){
 discriminator(record,owner,'task');if(!Array.isArray(record.payload.subtasks))throw Error('Invalid stored task.');const checked=taskPayload(record.payload,record.section,owner,projects,record.payload.subtasks);
 for(const name of ['title','description','day','status','priority','project_id','done'])if(checked[name]!==record.payload[name])throw Error('Invalid stored task.');return record;
}
function insert(owner,section,type,payload){return {owner_id:ownerId(owner),household_id:null,visibility:'private',section:choice(section,ORG_SECTIONS,'section'),item_type:type,origin:MANUAL_WORKSPACE_ORIGIN,payload:{schemaVersion:1,source:'manual',fictional:false,...payload}};}

export function makeManualProject(form,owner){fields(form,projectFields);return insert(owner,form.section===undefined?'Personal Life':form.section,'project',projectPayload(form));}
export function makeManualTask(form,owner,projects=[]){fields(form,taskFields);ownerId(owner);const section=choice(form.section===undefined?'Personal Life':form.section,ORG_SECTIONS,'section');return insert(owner,section,'task',taskPayload(form,section,owner,projects));}
export function changeManualProject(record,patch,owner){
 projectRecord(record,owner);fields(patch,projectFields);if(Object.hasOwn(patch,'section')&&patch.section!==record.section)throw Error('Project section is fixed after creation.');
 return {...structuredClone(record.payload),...projectPayload({...record.payload,...patch})};
}
export function changeManualTask(record,patch,owner,projects=[]){
 taskRecord(record,owner,projects);fields(patch,taskFields);if(Object.hasOwn(patch,'section')&&patch.section!==record.section)throw Error('Task section is fixed after creation.');
 return {...structuredClone(record.payload),...taskPayload({...record.payload,...patch},record.section,owner,projects,record.payload.subtasks)};
}
export function normalizeProjectWorkspace(rows,owner){
 ownerId(owner);if(!Array.isArray(rows)||rows.length>2000)throw Error('Complete bounded workspace record list required.');
 const ids=new Set(),candidates=rows.filter(r=>r?.origin===MANUAL_WORKSPACE_ORIGIN&&['project','task'].includes(r.item_type));
 for(const row of candidates){if(typeof row?.id!=='string'||ids.has(row.id.toLowerCase()))throw Error('Ambiguous workspace identity.');ids.add(row.id.toLowerCase());}
 const projects=candidates.filter(row=>row.item_type==='project').map(row=>structuredClone(projectRecord(row,owner))).sort((a,b)=>a.payload.title.localeCompare(b.payload.title)||a.id.localeCompare(b.id));
 const tasks=candidates.filter(row=>row.item_type==='task').map(row=>structuredClone(taskRecord(row,owner,projects))).sort((a,b)=>(a.payload.day??'9999-12-31').localeCompare(b.payload.day??'9999-12-31')||a.payload.title.localeCompare(b.payload.title)||a.id.localeCompare(b.id));
 return {projects,tasks};
}
export function projectWorkspaceView(rows,owner,{day,view='all',projectId=null}={}){
 if(typeof day!=='string'||!validDay(day)||!views.has(view))throw Error('Valid workspace date and view required.');
 const normalized=normalizeProjectWorkspace(rows,owner);
 if(projectId!==null&&(typeof projectId!=='string'||!uuid.test(projectId)||!normalized.projects.some(p=>p.id===projectId)))throw Error('Choose an available private project.');
 const projects=normalized.projects.filter(p=>projectId===null||p.id===projectId),scoped=normalized.tasks.filter(t=>projectId===null||t.payload.project_id===projectId);
 const tasks=scoped.filter(t=>{const p=t.payload;if(view==='completed')return p.done;if(p.done)return false;if(view==='today')return p.day!==null&&p.day<=day;if(view==='upcoming')return p.day!==null&&p.day>day;if(view==='undated')return p.day===null;return true;});
 const completed=tasks.filter(t=>t.payload.done).length;
 return {projects,tasks,counts:{total:tasks.length,completed,remaining:tasks.length-completed,projectCounts:projectCounts(projects,scoped).map(row=>({...row,progress:projectProgress(scoped.filter(t=>t.payload.project_id===row.project.id).map(t=>({completed:t.payload.done,recurring:ongoingRecurringTask(t.payload)})),{separateRecurring:separatesRecurring(row.project.payload)})}))}};
}

