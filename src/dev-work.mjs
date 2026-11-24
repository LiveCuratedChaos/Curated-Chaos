// M2F Work & Career: simple saved projects, tasks and career items using existing private RLS records.
import {createDevApi} from './dev-api.mjs';
import {createDevSessionManager} from './dev-session.mjs';
import {renderConnectedShell} from './dev-cloud-shell.mjs';
import {escapeHtml as e} from './core.mjs';
import {workRecords,careerProjects,regularProjects,workProgress,workQuickRecord} from './dev-work-model.mjs';
const root=document.getElementById('cc-work');let api,auth,user=null,projects=[],tasks=[],busy=false,error='',notice='',tab='overview',editor='';let generation=0,quickDraft={title:'',day:''};
const E=v=>e(String(v??''));
const button=(title,action,extra='')=>`<button type="button" class="btn btn-small" data-action="${action}" ${extra} ${busy?'disabled':''}>${E(title)}</button>`;
function render(){let out=`<section class="cc-work-header"><p class="eyebrow">THE CHAOS · MILESTONE 2F</p><h1>Work & Career</h1><p class="cc-work-deck">One place for your projects, responsibilities and professional growth. Start small and expand as needed.</p><div class="cc-work-badges"><span class="pill">Fictional test records only</span><span class="pill">Private by account</span></div></section>${error?`<p role="alert" class="warning">${E(error)}</p>`:''}${notice?`<p role="status" class="notice">${E(notice)}</p>`:''}`;
if(!user)out+=`<section class="cc-work-card"><h2>Sign in to private Work QA</h2><form id="work-login" class="cc-org-fields"><label class="field-label">Development test email<input name="email" type="email" required></label><label class="field-label">Test password<input type="password" name="password" required></label><button class="btn btn-primary" type="submit">Sign in</button></form></section>`;
else{const n=workProgress(tasks);out+=`<div class="cc-work-status"><div><strong>My Work</strong><small>${E(user.email)} · ${projects.length} projects · ${tasks.length} tasks</small></div><div class="cc-work-actions">${button('Refresh','refresh')}${button('Sign out','signout')}</div></div><section class="cc-work-card"><h2>Work Overview</h2><p>${n.completed} of ${n.total} test tasks complete</p><div class="cc-work-actions">${button('Overview','tab-overview')}${button('Projects & Tasks','tab-projects')}${button('Career Development','tab-career')}</div></section>`;
if(editor)out+=`<section class="cc-work-card"><h2>${editor==='career'?'Add career goal / opportunity':editor==='task'?'Add Work task':'Add Work project'}</h2><form id="work-quick" class="cc-org-fields"><label class="field-label">Name<input name="title" maxlength="140" value="${E(quickDraft.title)}" ${busy?'disabled':''} required autofocus placeholder="Example: Practice project"></label>${editor==='task'?`<label class="field-label">Due date (optional)<input name="day" type="date" value="${E(quickDraft.day)}" ${busy?'disabled':''}></label>`:''}<button class="btn btn-primary" type="submit">Save fictional item</button>${button('Cancel','cancel')}</form>${editor==='task'?'<p class="tiny muted">Add a date when it helps; a task can stay undated.</p>':''}</section>`;
if(tab!=='career'){out+=`<section class="cc-work-card"><div class="cc-card-heading"><h2>Projects & Responsibilities</h2><div class="cc-work-actions">${button('+ Project','add-project')}${button('+ Task','add-task')}</div></div><p class="tiny muted">Work tasks and projects share the private organization system, so they can also appear in Tasks & Projects.</p>${regularProjects(projects).length?regularProjects(projects).map(p=>`<p>▸ <strong>${E(p.payload.title)}</strong> <small class="muted">${E(p.payload.status||'In Progress')}</small></p>`).join(''):'<p class="muted">No practice Work projects yet.</p>'}<h3>Tasks</h3>${tasks.length?tasks.map(t=>`<label class="cc-work-row"><input type="checkbox" data-task-id="${E(t.id)}" ${t.payload.done||t.payload.status==='Completed'?'checked':''} ${busy?'disabled':''}> ${E(t.payload.title)} <small class="muted">${E(t.payload.day)}</small></label>`).join(''):'<p class="muted">No practice Work tasks yet.</p>'}</section>`;}
if(tab!=='projects'){out+=`<section class="cc-work-card"><div class="cc-card-heading"><h2>Career Development</h2>${button('+ Career goal or opportunity','add-career')}</div><p class="tiny muted">Track fictional career goals or opportunity names here. Job stages and skill details are planned for a later iteration.</p>${careerProjects(projects).length?careerProjects(projects).map(p=>`<p>▸ ${E(p.payload.title)}</p>`).join(''):'<p class="muted">No practice career items yet.</p>'}</section>`;}
out+=`<section class="cc-work-card"><h2>Coming later in Work</h2><p class="tiny muted">Shift schedules, time off, notes, detailed job application stages, skills, linked subtasks and configurable Work widgets. No real employer or sensitive case information in this development build.</p></section>`;}
root.innerHTML=renderConnectedShell(`<div class="cc-workspace-page">${out}</div>`,{active:'work',workspace:'work'});}
async function load(){if(!user)return;const seq=++generation,owner=user.id;error='';busy=true;render();try{const rows=await api.listOrganization(await auth.getAccessToken(),owner);if(seq!==generation||user?.id!==owner)return;({projects,tasks}=workRecords(rows,owner));}catch(err){if(seq===generation&&user?.id===owner){notice='';error=String(err.message||err).slice(0,230);}}finally{if(seq===generation){busy=false;render();}}}
async function create(v){
 if(!user||!editor||busy)return;
 const owner=user.id,seq=generation,which=editor;quickDraft={title:String(v.title||''),day:String(v.day||'')};busy=true;error='';notice='';render();
 try{const rec=workQuickRecord(which==='task'?'task':'project',v.title,owner,{career:which==='career',day:v.day});
  const token=await auth.getAccessToken();if(seq!==generation||user?.id!==owner)return;
  const resp=await api.addOrganizationRecord(token,rec);if(seq!==generation||user?.id!==owner)return;
  if(!Array.isArray(resp)||resp.length!==1)throw Error('Save was not confirmed. Refresh and check before retrying.');
  editor='';quickDraft={title:'',day:''};notice='Saved private fictional record.';await load();
 }catch(err){if(seq===generation&&user?.id===owner){notice='';error=String(err.message||err).slice(0,230);}}
 finally{if(seq===generation){busy=false;render();}}
}
root.addEventListener('input',ev=>{if(ev.target.form?.id==='work-quick'&&['title','day'].includes(ev.target.name)&&!busy)quickDraft={...quickDraft,[ev.target.name]:ev.target.value};});
root.addEventListener('submit',ev=>{if(!['work-login','work-quick'].includes(ev.target.id))return;ev.preventDefault();if(busy)return;const v=Object.fromEntries(new FormData(ev.target).entries());if(ev.target.id==='work-quick'){void create(v);return;}busy=true;render();void(async()=>{try{const res=await auth.signIn(v.email.trim(),v.password);user=res.user;await load();}catch(err){error=String(err.message||err);user=null;}finally{busy=false;render();}})();});
root.addEventListener('click',ev=>{const b=ev.target.closest('[data-action]');if(!b||busy||!user)return;const action=b.dataset.action;if(action==='refresh')void load();else if(action==='signout'){++generation;const previous=auth;user=null;projects=[];tasks=[];editor='';quickDraft={title:'',day:''};error='';notice='';render();void previous.signOut();}else if(action.startsWith('tab-')){tab=action.slice(4);render();}else if(action==='cancel'){editor='';quickDraft={title:'',day:''};render();}else if(action.startsWith('add-')){editor=action.slice(4);quickDraft={title:'',day:''};render();}});
async function toggleTask(t){
 if(busy||!user)return;const rec=tasks.find(r=>r.id===t.dataset.taskId);if(!rec)return;
 const owner=user.id,seq=generation,done=t.checked;busy=true;error='';notice='';render();
 try{const payload={...rec.payload,status:done?'Completed':'Not Started',done};
  const token=await auth.getAccessToken();if(seq!==generation||user?.id!==owner)return;
  const resp=await api.updateOrganizationRecord(token,rec,owner,'task',payload,'Work');if(seq!==generation||user?.id!==owner)return;
  if(!Array.isArray(resp)||resp.length!==1)throw Error('Update was not confirmed. Refresh before retrying.');
  await load();
 }catch(err){if(seq===generation&&user?.id===owner){notice='';error=String(err.message||err).slice(0,230);}}
 finally{if(seq===generation){busy=false;render();}}
}
root.addEventListener('change',ev=>{if(ev.target.matches('input[data-task-id]'))void toggleTask(ev.target);});

(async()=>{try{const res=await fetch('/dev-config.json',{cache:'no-store'});if(!res.ok)throw Error('Development configuration unavailable.');const conf=await res.json();api=createDevApi(conf);auth=createDevSessionManager(api,conf.projectRef,sessionStorage);user=(await auth.restore())?.user||null;if(user)await load();else render();}catch(err){error=String(err.message||err);render();}})();
