// Milestone 2C: Test-only Quick Add, Tasks, Projects and subtasks.
import {createDevApi,makeFictionalNote} from './dev-api.mjs';
import {createDevSessionManager} from './dev-session.mjs';
import {renderConnectedShell} from './dev-cloud-shell.mjs';
import {escapeHtml as e,dayString} from './core.mjs';
import {makeFictionalEvent} from './dev-agenda-model.mjs';
import {ORG_SECTIONS,TASK_STATUSES,PROJECT_STATUSES,TASK_PRIORITIES,makeTask,makeProject,normalizeOrganizerRows,changeTask,changeProject,readSubtasks,addSubtask,toggleSubtask,projectCounts,getTaskStatus,getTaskPriority,pickOrganizerTasks,visibleProjectStatus} from './dev-organize-model.mjs';
const root=document.getElementById('cc-organize');
let api,auth,user=null,records={tasks:[],projects:[]},ready=false,busy=false,message='',issue='',serial=0,editor=null;
let taskSection='all',taskStatus='all',taskPriority='all',pane=['tasks','projects','quick-add'].includes(location.hash.slice(1))?location.hash.slice(1):'quick-add';
let addKind='task';
const optionalDateValue=value=>value||'';
const option=(value,selected)=>`<option value="${e(value)}" ${value===selected?'selected':''}>${e(value)}</option>`;
const options=(values,selected)=>values.map(s=>option(s,selected)).join('');
const label=(name,input)=>`<label class="field-label">${name}${input}</label>`;
const escapeAttr=value=>e(value??'');
const sectionSelect=(name,selected='Personal Life')=>`<select name="${name}" required>${options(ORG_SECTIONS,selected)}</select>`;
const stateSelect=(name,list,selected)=>`<select name="${name}" required>${options(list,selected)}</select>`;
const projectSelect=(section,selected='')=>`<select name="project_id"><option value="">No project</option>${records.projects.filter(p=>p.section===section).map(p=>`<option value="${e(p.id)}" ${p.id===selected?'selected':''}>${e(p.payload.title)}</option>`).join('')}</select>`;
const sectionFilter=`<label>Section <select id="org-task-section">${options(['all',...ORG_SECTIONS],taskSection)}</select></label>`;
const statusFilter=`<label>Status <select id="org-task-status">${options(['all',...TASK_STATUSES],taskStatus)}</select></label>`;
const priorityFilter=`<label>Priority <select id="org-task-priority">${options(['all',...TASK_PRIORITIES],taskPriority)}</select></label>`;
function addForm(){
 let fields='';
 if(addKind==='task')fields=`${label('Task title','<input name="title" maxlength="140" placeholder="Add a task…" required autofocus>')}<details class="cc-org-more"><summary>Optional details · due date, area, project, status</summary>${label('Due date (optional)','<input name="day" type="date">')}${label('Area',sectionSelect('section'))}${label('Priority',stateSelect('priority',TASK_PRIORITIES,'Normal'))}${label('Status',stateSelect('status',TASK_STATUSES,'Not Started'))}${label('Project',projectSelect('Personal Life'))}${label('Description','<textarea name="description" maxlength="1000" rows="2" placeholder="Optional notes"></textarea>')}<p class="tiny muted">Set an area first if you want to link a project. You can add subtasks after saving.</p></details>`;
 if(addKind==='project')fields=`${label('Project name','<input name="title" maxlength="140" placeholder="QA: Sample household project" required>')}${label('Area',sectionSelect('section'))}${label('Status',stateSelect('status',PROJECT_STATUSES,'Planned'))}${label('Description','<textarea name="summary" maxlength="1000" rows="2" placeholder="Fictional test details"></textarea>')}`;
 if(addKind==='event')fields=`${label('Event title','<input name="title" maxlength="140" required>')}${label('Date',`<input type="date" name="day" required value="${dayString()}">`)}${label('Start time','<input type="time" name="time" value="09:00" required>')}`;
 if(addKind==='note')fields=`${label('Note title','<input name="title" maxlength="120" required>')}${label('Text','<textarea name="body" maxlength="1000" rows="3"></textarea>')}`;
 const kindButtons=[['task','Task'],['project','Project'],['event','Event'],['note','Note']].map(([id,t])=>`<button type="button" class="${addKind===id?'selected':''}" data-quick-kind="${id}" aria-pressed="${addKind===id}">${t}</button>`).join('');
 return `<section class="cc-work-card cc-org-form" id="quick-add"><h2>Quick Add</h2><p class="muted">Save a task with just a title, or expand Optional details for more control.</p><div class="cc-org-tabs" role="group" aria-label="Quick Add record type">${kindButtons}</div><form id="org-add" class="cc-org-fields">${fields}<button class="btn btn-primary" type="submit" ${busy||!ready?'disabled':''}>Save fictional ${e(addKind)}</button></form></section>`;
}
function taskEditForm(r){const p=r.payload;
 return `<form id="org-edit-task" data-record-id="${e(r.id)}" class="cc-org-edit cc-org-fields">${label('Title',`<input name="title" maxlength="140" required value="${escapeAttr(p.title)}">`)}${label('Due date',`<input name="day" type="date" value="${e(optionalDateValue(p.day))}">`)}${label('Area',sectionSelect('section',r.section))}${label('Priority',stateSelect('priority',TASK_PRIORITIES,getTaskPriority(r)))}${label('Status',stateSelect('status',TASK_STATUSES,getTaskStatus(r)))}${label('Project',projectSelect(r.section,p.project_id))}${label('Details',`<textarea name="description" maxlength="1000" rows="2">${e(p.description||'')}</textarea>`)}<p class="tiny muted">Change the area, then save before choosing a project in that area. Edits require the latest cloud record version.</p><div class="cc-org-actions"><button class="btn btn-primary" type="submit" ${busy?'disabled':''}>Save changes</button><button class="btn btn-small" type="button" id="org-cancel">Cancel</button></div></form>`;
}
function taskRow(r){
 const p=r.payload,subs=readSubtasks(p.subtasks),project=records.projects.find(x=>x.id===p.project_id&&x.section===r.section);
 const expanded=editor?.type==='task'&&editor.id===r.id;
 const complete=subs.filter(s=>s.done).length;
 // A read-and-complete checklist belongs on the visible task card, not exclusively inside Edit.
 // The editor adds subtasks and edits metadata; toggles are available in either view.
 const sublist=subs.length?`<section class="cc-org-subtasks" aria-label="Subtasks for ${e(p.title)}"><h3>Subtasks · ${complete} of ${subs.length} complete</h3><ul class="cc-work-list">${subs.map(s=>`<li class="cc-org-subtask"><label><input type="checkbox" data-org-toggle-sub="${e(r.id)}" data-sub-id="${e(s.id)}" ${s.done?'checked':''} ${busy?'disabled':''}><span>${e(s.title)}</span></label></li>`).join('')}</ul></section>`:expanded?'<section class="cc-org-subtasks"><h3>Subtasks</h3><p class="empty">No subtasks yet.</p></section>':'';
 const addSubForm=expanded?`<section class="cc-org-subtasks cc-org-add-subtask"><h3>Add subtasks</h3><p class="tiny muted">Add as many as you need, then save them all together. Press Enter in the last field to add another row.</p><form id="org-add-subtask" data-record-id="${e(r.id)}" class="cc-org-subform"><div id="org-subtask-drafts"><label class="field-label">Subtask title<input name="subtask_title" maxlength="140" placeholder="A smaller step" autocomplete="off"></label></div><div class="cc-org-actions"><button type="button" id="org-more-subtask" class="btn btn-small">+ Add another subtask</button><button type="submit" class="btn btn-primary" ${busy?'disabled':''}>Save all subtasks</button></div></form></section>`:'';
 return `<article class="cc-work-card cc-org-record" data-qa-task="${e(r.id)}"><div class="cc-card-heading"><h2>${e(p.title)}</h2><span class="pill">${e(getTaskPriority(r))} priority</span></div><p class="muted">${e(r.section)} · ${p.day?'Due '+e(p.day):'No due date'} · ${e(getTaskStatus(r))}${project?' · Project: '+e(project.payload.title):''}</p>${p.description?`<p>${e(p.description)}</p>`:''}<div class="cc-org-actions"><button class="btn btn-small" data-org-edit="task:${e(r.id)}">${expanded?'Editing':'Edit task'}</button></div>${sublist}${expanded?taskEditForm(r):''}${addSubForm}</article>`;
}
function projectRow(count){const r=count.project,p=r.payload,expanded=editor?.type==='project'&&editor.id===r.id;
 return `<article class="cc-work-card cc-org-record"><div class="cc-card-heading"><h2>${e(p.title)}</h2><span class="pill">${e(visibleProjectStatus(p.status))}</span></div><p class="muted">${e(r.section)} · ${count.completed} of ${count.total} linked tasks completed</p>${p.summary?`<p>${e(p.summary)}</p>`:''}<button type="button" class="btn btn-small" data-org-edit="project:${e(r.id)}">Edit project</button>${expanded?`<form id="org-edit-project" data-record-id="${e(r.id)}" class="cc-org-edit cc-org-fields">${label('Project name',`<input name="title" maxlength="140" value="${escapeAttr(p.title)}" required>`)}${label('Area',sectionSelect('section',r.section))}${label('Status',stateSelect('status',PROJECT_STATUSES,visibleProjectStatus(p.status)))}${label('Description',`<textarea name="summary" maxlength="1000" rows="2">${e(p.summary||'')}</textarea>`)}<p class="tiny muted">Move linked tasks to another project or unlink them before changing this project’s area.</p><div class="cc-org-actions"><button type="submit" class="btn btn-primary" ${busy?'disabled':''}>Save project</button><button type="button" class="btn btn-small" id="org-cancel">Cancel</button></div></form>`:''}</article>`;
}
function show(){
 let inside=`<section class="cc-work-header"><p class="eyebrow">YOUR SPACE · MILESTONE 3D</p><h1>Tasks & Projects</h1><p class="cc-work-deck">Create a task with only a title, then add details or subtasks when you need them. Existing private cloud records are preserved.</p><div class="cc-work-badges"><span class="pill">Private test records</span><span class="pill">No live integrations</span></div></section>`;
 if(issue)inside+=`<p class="warning" role="alert">${e(issue)}</p>`;
 if(message)inside+=`<p class="notice" role="status">${e(message)}</p>`;
 if(!user){inside+=`<section class="cc-work-card cc-work-auth"><h2>Sign into your development account</h2><form id="org-login">${label('Test email','<input type="email" name="email" autocomplete="username" required>')}${label('Test password','<input type="password" name="password" autocomplete="current-password" required>')}<button type="submit" class="btn btn-primary" ${busy?'disabled':''}>Sign in</button></form><p class="tiny muted">Use only fictional data. Do not add private workplace investigation files or real personal/financial information.</p></section>`;}
 else{
 inside+=`<div class="cc-work-status"><div><strong>${ready?'Cloud records verified':busy?'Checking cloud…':'Cloud data unverified'}</strong><small>Signed in as ${e(user.email||'Test Account')} · ${records.tasks.length} tasks · ${records.projects.length} projects</small></div><div class="cc-work-actions"><button class="btn btn-small" id="org-refresh" ${busy?'disabled':''}>Fetch latest</button><button class="btn btn-small" id="org-signout" ${busy?'disabled':''}>Sign out</button></div></div>`;
 if(ready){inside+=`<nav class="cc-org-tabs" aria-label="Organization views"><button type="button" data-org-pane="quick-add" class="${pane==='quick-add'?'selected':''}">Quick Add</button><button type="button" data-org-pane="tasks" class="${pane==='tasks'?'selected':''}">Tasks (${records.tasks.length})</button><button type="button" data-org-pane="projects" class="${pane==='projects'?'selected':''}">Projects (${records.projects.length})</button></nav>`;
 if(pane==='quick-add')inside+=addForm();
 if(pane==='tasks'){
 const tasks=pickOrganizerTasks(records.tasks,{status:taskStatus,section:taskSection,priority:taskPriority});
 inside+=`<section class="cc-org-toolbar"><h2>My Tasks</h2><div class="cc-org-filters">${sectionFilter}${statusFilter}${priorityFilter}</div></section><div class="cc-org-grid">${tasks.length?tasks.map(taskRow).join(''):'<p class="empty">No fictional tasks match your filters. Choose Quick Add to create one.</p>'}</div>`;
 }
 if(pane==='projects')inside+=`<section class="cc-org-toolbar"><h2>My Projects</h2><p class="muted">Projects are separate from task lists. Tasks linked to a project contribute to its progress.</p></section><div class="cc-org-grid">${records.projects.length?projectCounts(records.projects,records.tasks).map(projectRow).join(''):'<p class="empty">No fictional projects yet. Choose Quick Add to create one.</p>'}</div>`;
 } else inside+='<p class="warning">Cloud data is not verified; editing is disabled. Use Fetch latest or sign in again.</p>';
 }
 inside+='<p class="tiny muted">Only fictional records. Changes to event times, notes, and tasks appear on the existing QA pages after their next refresh. M2C does not implement groceries, household sharing, recurrence, or real provider connections.</p>';
 root.innerHTML=renderConnectedShell(`<div class="cc-workspace-page cc-organize-page">${inside}</div>`,{active:'organize'});
}
async function load(){if(!user||!api||!auth)return;const seq=++serial,owner=user.id;busy=true;ready=false;show();try{
 const token=await auth.getAccessToken();const raw=await api.listOrganization(token,owner);
 if(seq!==serial||user?.id!==owner)return;
 records=normalizeOrganizerRows(raw,owner);ready=true;issue='';
 }catch(err){if(seq!==serial)return;records={tasks:[],projects:[]};issue='Could not verify your cloud records. Nothing has been changed. '+String(err.message||err).slice(0,180);}finally{if(seq===serial){busy=false;show();}}
}
function setPane(newPane){pane=newPane;location.hash=newPane;editor=null;show();}
async function writeCreate(record){const seq=serial,owner=user.id;busy=true;show();try{
 const token=await auth.getAccessToken();const result=await api.addOrganizationRecord(token,record);
 if(seq!==serial||user?.id!==owner)return;
 if(!Array.isArray(result)||result.length!==1)throw Error('Save not confirmed. Refresh and check before saving again.');
 message='Fictional record saved privately. It is now available to the appropriate workspace.';
 await load();
 }catch(err){if(seq===serial){issue=String(err.message||err);busy=false;show();}}finally{if(seq===serial){busy=false;show();}}
}
async function writeUpdate(type,id,compute,{keepEditor=false}={}){
 const scrollBefore=keepEditor?window.scrollY:null;
 const seq=serial,owner=user.id;
 const current=(type==='project'?records.projects:records.tasks).find(r=>r.id===id);
 if(!current||!Number.isInteger(current.version)) {issue='Record not available for safe editing. Fetch latest.';show();return;}
 busy=true;show();
 try{const token=await auth.getAccessToken();const freshRows=normalizeOrganizerRows(await api.listOrganization(token,owner),owner);
 if(seq!==serial||user?.id!==owner)return;
 const fresh=(type==='project'?freshRows.projects:freshRows.tasks).find(r=>r.id===id);
 if(!fresh||fresh.version!==current.version)throw Error('Record changed in another tab. Please Fetch latest before editing. No changes were saved.');
 const update=compute(fresh,freshRows.projects);
 if(type==='project' && update.section!==fresh.section && freshRows.tasks.some(t=>t.payload.project_id===id))throw Error('Move the project’s linked tasks before changing its area. No changes were saved.');
 const payload=update.payload;
 const updated=await api.updateOrganizationRecord(token,{id:fresh.id,version:fresh.version},owner,type,payload,update.section||fresh.section);
 if(seq!==serial||user?.id!==owner)return;
 if(!Array.isArray(updated)||updated.length!==1)throw Error('Version conflict; save was not confirmed. Fetch latest to retry.');
 if(!keepEditor)editor=null;message='Your private fictional '+type+' was updated.';issue='';await load();
 if(keepEditor&&scrollBefore!==null)requestAnimationFrame(()=>window.scrollTo(0,scrollBefore));
 }catch(err){if(seq===serial){issue=String(err.message||err).slice(0,250);busy=false;show();}}finally{if(seq===serial){busy=false;show();}}
}
root.addEventListener('submit',event=>{
 if(!['org-login','org-add','org-edit-task','org-edit-project','org-add-subtask'].includes(event.target?.id))return;
 event.preventDefault();if(busy)return;
 const form=event.target,values=Object.fromEntries(new FormData(form));
 if(form.id==='org-login'){
  busy=true;issue='';message='';show();void (async()=>{try{const signed=await auth.signIn(String(values.email||'').trim(),String(values.password||''));++serial;user=signed.user;await load();}catch(err){user=null;issue=String(err.message||err).slice(0,200);}finally{busy=false;show();}})();return;
 }
 if(!user||!ready)return;
 if(form.id==='org-add'){
  try{
   const record=addKind==='task'?makeTask(values,user.id,records.projects):addKind==='project'?makeProject(values,user.id):addKind==='event'?makeFictionalEvent(values,user.id):makeFictionalNote(values.title,values.body,user.id);
   if(addKind==='task'||addKind==='project')void writeCreate(record);
   else void (async()=>{busy=true;show();const seq=serial,owner=user.id;try{const token=await auth.getAccessToken();const saved=addKind==='event'?await api.addFictionalEvent(token,record):await api.addNote(token,record);if(seq!==serial||user?.id!==owner)return;if(!Array.isArray(saved)||saved.length!==1)throw Error('Save not confirmed; check cloud before retrying.');message='Fictional '+addKind+' saved. Open its existing QA workspace to see it.';issue='';await load();}catch(err){if(seq===serial){issue=String(err.message||err);show();}}finally{if(seq===serial){busy=false;show();}}})();
  }catch(err){issue=err.message;show();}return;
 }
 const id=form.dataset.recordId;
 if(form.id==='org-edit-task') {void writeUpdate('task',id,(r,projects)=>({payload:changeTask(r,values,user.id,projects),section:values.section}));return;}
 if(form.id==='org-edit-project') {void writeUpdate('project',id,r=>({payload:changeProject(r,values,user.id),section:values.section}));return;}
 if(form.id==='org-add-subtask') {
  const titles=new FormData(form).getAll('subtask_title').map(v=>String(v).trim()).filter(Boolean);
  if(!titles.length){issue='Enter at least one subtask title.';return;}
  void writeUpdate('task',id,r=>{let payload=r.payload;for(const title of titles)payload=addSubtask({...r,payload},title,crypto.randomUUID());return {payload,section:r.section};},{keepEditor:true});return;
 }
});
root.addEventListener('click',event=>{
 const more=event.target.closest('#org-more-subtask');if(more){const target=root.querySelector('#org-subtask-drafts');if(target&&target.querySelectorAll('input').length<40){const label=document.createElement('label');label.className='field-label';label.textContent='Another subtask';const input=document.createElement('input');input.name='subtask_title';input.maxLength=140;input.placeholder='A smaller step';input.autocomplete='off';label.append(input);target.append(label);input.focus();}return;}
 const p=event.target.closest('[data-org-pane]');if(p&&user&&ready){setPane(p.dataset.orgPane);return;}
 const kind=event.target.closest('[data-quick-kind]');if(kind&&user&&ready){addKind=kind.dataset.quickKind;show();return;}
 if(event.target.closest('#org-cancel')){editor=null;show();return;}
 if(event.target.closest('#org-refresh')&&user&&!busy){void load();return;}
 if(event.target.closest('#org-signout')&&user&&!busy){++serial;const previous=auth;user=null;ready=false;records={tasks:[],projects:[]};editor=null;issue='';message='';show();void previous.signOut();return;}
 if(!user||!ready||busy)return;
 const edit=event.target.closest('[data-org-edit]');if(edit){const [type,id]=edit.dataset.orgEdit.split(':');if((type==='task'?records.tasks:records.projects).some(r=>r.id===id)){editor={type,id};show();}return;}
});
root.addEventListener('keydown',event=>{
 if(event.key==='Enter'&&event.target.matches('#org-subtask-drafts input')&&!event.shiftKey){const inputs=[...root.querySelectorAll('#org-subtask-drafts input')];if(event.target===inputs.at(-1)){event.preventDefault();root.querySelector('#org-more-subtask')?.click();}}
});
root.addEventListener('change',event=>{
 const el=event.target;
 if(el.matches('#org-add select[name="section"], #org-edit-task select[name="section"]')){
   const select=el.form?.querySelector('select[name="project_id"]');
   if(select){const existing=select.value;select.replaceChildren(new Option('No project',''));for(const project of records.projects.filter(p=>p.section===el.value)){select.add(new Option(project.payload.title,project.id));}select.value=records.projects.some(p=>p.id===existing&&p.section===el.value)?existing:'';}
   return;
 }
 if(el.id==='org-task-section')taskSection=el.value;
 else if(el.id==='org-task-status')taskStatus=el.value;
 else if(el.id==='org-task-priority')taskPriority=el.value;
 else if(el.dataset.orgToggleSub&&user&&ready&&!busy){const id=el.dataset.orgToggleSub,subid=el.dataset.subId;void writeUpdate('task',id,r=>({payload:toggleSubtask(r,subid),section:r.section}));return;}
 else return;
 show();
});
(async()=>{try{const res=await fetch('/dev-config.json',{cache:'no-store'});if(!res.ok)throw Error('Missing development configuration. Run npm run setup:reuse.');const conf=await res.json();api=createDevApi(conf);auth=createDevSessionManager(api,conf.projectRef,sessionStorage);const saved=await auth.restore();user=saved?.user||null;if(user)await load();else show();}catch(err){issue=String(err.message||err);show();}})();
