// M2C: private, fictional tasks and projects. Pure validated model helpers.
// No real work investigations, providers, financial accounts, or household sharing.
import {validDay,TASK_SECTIONS} from './dev-brief-model.mjs';
// Match canonical Supabase UUIDs.
const UUID_V4ISH=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ORG_SECTIONS=Object.freeze([...TASK_SECTIONS]);
export const TASK_STATUSES=Object.freeze(['Not Started','In Progress','Waiting','On Hold','Completed']);
export const PROJECT_STATUSES=Object.freeze(['Planned','In Progress','On Hold','Completed','Cancelled']);
export const visibleProjectStatus=status=>status==='Active'?'In Progress':PROJECT_STATUSES.includes(status)?status:'Planned';
export const TASK_PRIORITIES=Object.freeze(['Low','Normal','High','Urgent']);
const requireOwner=id=>{if(!UUID_V4ISH.test(id||''))throw Error('Sign into a verified fictional development account.');return id;};
const plain=(v,max,field,{required=false}={})=>{
  const str=String(v??'').trim();
  if(str.length>max||(required&&!str.length))throw Error(`${field} must contain ${required?'1–':''}${max} characters maximum.`);
  return str;
};
const choose=(value,allowed,name)=>{if(!allowed.includes(value))throw Error(`Choose a valid ${name}.`);return value;};
const data=(owner,section,item_type,payload)=>({owner_id:requireOwner(owner),household_id:null,visibility:'private',section:choose(section,ORG_SECTIONS,'section'),item_type,origin:'m2c-fictional',payload});
export function normalizeOrganizerRows(rows,owner){
  requireOwner(owner);
  if(!Array.isArray(rows))return {tasks:[],projects:[]};
  const own=rows.filter(r=>r?.owner_id===owner&&r.visibility==='private'&&r.household_id==null&&r.deleted_at==null&&r.payload?.fictional===true&&ORG_SECTIONS.includes(r.section));
  const tasks=own.filter(r=>r.item_type==='task'&&typeof r.payload?.title==='string'&&r.payload.title.trim().length>0&&(r.payload.day==null||r.payload.day===''||validDay(r.payload.day)));
  const projects=own.filter(r=>r.item_type==='project'&&typeof r.payload?.title==='string'&&r.payload.title.trim().length>0);
  return {tasks:tasks.sort((a,b)=>String(a.payload.day||'9999-12-31').localeCompare(String(b.payload.day||'9999-12-31'))||String(a.created_at).localeCompare(String(b.created_at))),projects:projects.sort((a,b)=>String(a.payload.title).localeCompare(String(b.payload.title)))};
}
export const getTaskStatus=task=>TASK_STATUSES.includes(task?.payload?.status)?task.payload.status:task?.payload?.done?'Completed':'Not Started';
export const getTaskPriority=task=>TASK_PRIORITIES.includes(task?.payload?.priority)?task.payload.priority:'Normal';
export function makeProject(form,owner){
 const title=plain(form.title,140,'Project title',{required:true}),summary=plain(form.summary,1000,'Project description');
 const section=choose(form.section||'Personal Life',ORG_SECTIONS,'project section');
 const status=choose(form.status==='Active'?'In Progress':(form.status||'Planned'),PROJECT_STATUSES,'project status');
 return data(owner,section,'project',{title,summary,status,fictional:true,source:'M2C_PROJECT'});
}
export function makeTask(form,owner,projects=[]){
 const title=plain(form.title,140,'Task title',{required:true}),description=plain(form.description,1000,'Task description');
 const day=String(form.day||'').trim();if(day&&!validDay(day))throw Error('Choose a valid task due date.');
 const section=choose(form.section||'Personal Life',ORG_SECTIONS,'task section');
 const status=choose(form.status||'Not Started',TASK_STATUSES,'task status');
 const priority=choose(form.priority||'Normal',TASK_PRIORITIES,'task priority');
 const projectId=form.project_id||null;
 if(projectId&&(!UUID_V4ISH.test(projectId)||!projects.some(r=>r.id===projectId&&r.owner_id===owner&&r.section===section)))throw Error('Choose a project belonging to your account and task section.');
 return data(owner,section,'task',{title,description,day:day||null,status,priority,project_id:projectId,subtasks:[],done:status==='Completed',fictional:true,source:'M2C_QUICK_ADD'});
}
export function changeTask(record,form,owner,projects=[]){
 if(record?.item_type!=='task'||record.owner_id!==requireOwner(owner)||record.visibility!=='private'||record.household_id!=null||record.payload?.fictional!==true)throw Error('This private fictional task cannot be modified.');
 const next=makeTask({...record.payload,section:record.section,...form},owner,projects);
 return {...record.payload,...next.payload,source:record.payload.source||'M2C_QUICK_ADD',subtasks:readSubtasks(record.payload.subtasks)};
}
export function changeProject(record,form,owner){
 if(record?.item_type!=='project'||record.owner_id!==requireOwner(owner)||record.visibility!=='private'||record.household_id!=null||record.payload?.fictional!==true)throw Error('This private fictional project cannot be modified.');
 return {...record.payload,...makeProject({...record.payload,...form},owner).payload,source:record.payload.source||'M2C_PROJECT'};
}
export function readSubtasks(value){
 if(!Array.isArray(value))return [];
 return value.filter(s=>s&&UUID_V4ISH.test(s.id)&&typeof s.title==='string'&&s.title.trim()&&s.title.length<=140&&typeof s.done==='boolean').slice(0,40).map(s=>({id:s.id,title:s.title,done:s.done}));
}
export function addSubtask(record,title,id){
 if(record?.item_type!=='task'||record.payload?.fictional!==true)throw Error('Choose a fictional task.');
 if(!UUID_V4ISH.test(id))throw Error('Invalid subtask identifier.');
 title=plain(title,140,'Subtask title',{required:true});
 const previous=readSubtasks(record.payload.subtasks);if(previous.length>=40)throw Error('Subtask limit reached.');
 return {...record.payload,subtasks:[...previous,{id,title,done:false}]};
}
export function toggleSubtask(record,id){
 const previous=readSubtasks(record?.payload?.subtasks);
 if(record?.item_type!=='task'||record.payload?.fictional!==true||!previous.some(s=>s.id===id))throw Error('Choose an existing fictional subtask.');
 return {...record.payload,subtasks:previous.map(s=>s.id===id?{...s,done:!s.done}:s)};
}
export function projectCounts(projects,tasks){
 return projects.map(p=>({project:p,total:tasks.filter(t=>t.payload.project_id===p.id).length,completed:tasks.filter(t=>t.payload.project_id===p.id&&(t.payload.done===true||getTaskStatus(t)==='Completed')).length}));
}
export function pickOrganizerTasks(tasks,{status='all',section='all',priority='all',project='all'}={}){
 return tasks.filter(t=>(status==='all'||getTaskStatus(t)===status)&&(section==='all'||t.section===section)&&(priority==='all'||getTaskPriority(t)===priority)&&(project==='all'||t.payload.project_id===project));
}
