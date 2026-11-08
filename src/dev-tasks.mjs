// M0G: Dedicated tasks QA view for the isolated development project only.
// Uses existing RLS-protected fictional cc_records; no real data or production connections.
import {createDevApi} from './dev-api.mjs';
import {createDevSessionManager} from './dev-session.mjs';
import {renderConnectedShell} from './dev-cloud-shell.mjs';
import {escapeHtml as e, dayString, formatDate} from './core.mjs';
import {TASK_SECTIONS,makeFictionalTask,normalizeCloudRecords,toggledTaskPayload} from './dev-brief-model.mjs';
import {TASK_FILTERS,selectTasks,taskCounts} from './dev-tasks-model.mjs';

const root=document.getElementById('connected-tasks');
let config=null,api=null,auth=null,session=null,user=null,records={tasks:[],notes:[]},busy=false,notice='',error='',generation=0;
let status='all',section='all';
const clearLocal=()=>{generation++;session=null;user=null;records={tasks:[],notes:[]};};
const alerts=()=>`${error?`<p class="warning" role="alert">${e(error)}</p>`:''}${notice?`<p class="notice" role="status">${e(notice)}</p>`:''}`;
const wrap=inner=>renderConnectedShell(`<section class="connected-card"><p class="eyebrow">CURATED CHAOS · MILESTONE 0H</p><h1>My Tasks</h1><p class="muted">Private cloud task list · Fictional development records only</p><p class="tiny muted">Isolated project: ${e(config?.projectRef||'not connected')}</p>${alerts()}${inner}<p class="tiny muted"><a href="/dev-dashboard.html">Return to connected Daily Brief</a> · Cloud data is never copied into the local demonstration pages. Refreshes in this browser tab restore the temporary QA session.</p></section>`,{active:'tasks'});
const taskRow=r=>`<li class="item"><button type="button" class="tick ${r.payload.done?'done':''}" data-toggle="${e(r.id)}" ${busy?'disabled':''} aria-label="${r.payload.done?'Mark incomplete':'Complete'} fictional task ${e(r.payload.title)}">${r.payload.done?'✓':''}</button><div class="item-main"><strong class="${r.payload.done?'completed':''}">${e(r.payload.title)}</strong><small>${e(r.section)} · Due ${e(formatDate(r.payload.day))} · ${r.payload.done?'Completed':'Open'} · Private cloud</small></div></li>`;
function render(){
 document.title='Cloud Tasks QA · Curated Chaos';
 if(!api){root.innerHTML=wrap('<p class="muted">Loading development connection settings…</p>');return;}
 if(!session){root.innerHTML=wrap(`<section class="panel"><h2>Sign in to your development account</h2><p class="muted">Use one of the fictional test accounts from the earlier isolation tests.</p><form id="tasks-login" autocomplete="off"><label class="field-label">Test email<input name="email" type="email" autocomplete="username" required></label><label class="field-label">Test password<input name="password" type="password" autocomplete="off" required></label><button class="btn btn-primary" type="submit" ${busy?'disabled':''}>${busy?'Signing in…':'Sign in'}</button></form></section>`);return;}
 const counts=taskCounts(records.tasks),filtered=selectTasks(records.tasks,{status,section});
 const allOptions=['all',...TASK_SECTIONS].map(s=>`<option value="${e(s)}" ${section===s?'selected':''}>${s==='all'?'All sections':e(s)}</option>`).join('');
 const statusOptions=TASK_FILTERS.map(s=>`<option value="${s}" ${status===s?'selected':''}>${s==='all'?'All tasks':s==='open'?'Open tasks':'Completed tasks'}</option>`).join('');
 root.innerHTML=wrap(`<div class="auth-user"><p class="tiny muted">Signed in as ${e(user.email||'Test account')}</p><button id="tasks-logout" type="button" class="btn btn-small" ${busy?'disabled':''}>Sign out</button></div>
 <div class="metric-grid"><div class="metric"><span>All private tasks</span><strong>${counts.total}</strong></div><div class="metric"><span>Open</span><strong>${counts.open}</strong></div><div class="metric"><span>Completed</span><strong>${counts.completed}</strong></div><div class="metric"><span>Notes in cloud</span><strong>${records.notes.length}</strong></div></div>
 <div class="two-columns"><section class="panel"><div class="panel-head"><h2>Add fictional task</h2><span class="pill gold">Cloud</span></div><form id="tasks-add"><label class="field-label">Task title<input name="title" maxlength="140" required placeholder="Example: QA prepare pretend groceries"></label><label class="field-label">Due date<input name="day" type="date" value="${dayString()}" required></label><label class="field-label">Section<select name="section">${TASK_SECTIONS.map(s=>`<option value="${e(s)}">${e(s)}</option>`).join('')}</select></label><button class="btn btn-primary" ${busy?'disabled':''} type="submit">Save private task</button></form></section>
 <section class="panel"><div class="panel-head"><h2>All my cloud tasks</h2><button id="tasks-reload" class="btn btn-small" type="button" ${busy?'disabled':''}>Refresh</button></div><div class="qa-filter-row"><label class="field-label">Status<select id="task-filter-status">${statusOptions}</select></label><label class="field-label">Section<select id="task-filter-section">${allOptions}</select></label></div>${filtered.length?`<ul class="item-list">${filtered.map(taskRow).join('')}</ul>`:'<p class="empty">No tasks match these filters.</p>'}</section></div><p class="warning tiny">Development test screen only. Do not enter actual personal, school, family, financial, or employer information. These browser-tab QA sessions are not production authentication.</p>`);
}
const show=(msg,kind='notice')=>{error=kind==='error'?msg:'';notice=kind==='error'?'':msg;render();};
async function refresh(){
 if(!auth?.get()){clearLocal();show('Sign in to your development test account.','error');return;}
 const n=++generation,owner=user.id;busy=true;render();
 try{const token=await auth.getAccessToken();const raw=await api.listBriefRecords(token);if(n!==generation)return;records=normalizeCloudRecords(raw,owner);error='';notice='Cloud tasks loaded for this test account.';}
 catch(err){if(n!==generation)return;if(!auth.get()){clearLocal();error='Your test session expired. Please sign in again.';}else error=err.message;notice='';}
 finally{if(n===generation){busy=false;render();}}
}
root.addEventListener('submit',async ev=>{
 if(ev.target.id==='tasks-login'){
  ev.preventDefault();if(busy)return;
  const v=new FormData(ev.target),email=String(v.get('email')||'').trim(),password=String(v.get('password')||'');
  busy=true;error='';render();
  try{const result=await auth.signIn(email,password);session=auth.get();user=result.user;await refresh();}
  catch(err){clearLocal();show(err.message,'error');}
  finally{busy=false;render();}
  return;
 }
 if(ev.target.id==='tasks-add'){
  ev.preventDefault();if(busy||!session)return;
  const v=Object.fromEntries(new FormData(ev.target).entries());
  let task;try{task=makeFictionalTask(v,user.id);}catch(err){show(err.message,'error');return;}
  const n=generation;busy=true;render();
  try{const token=await auth.getAccessToken();const result=await api.addFictionalTask(token,task);if(n!==generation)return;if(!Array.isArray(result)||result.length!==1)throw Error('Cloud save could not be verified.');await refresh();if(session)show('Fictional task saved to the private cloud.');}
  catch(err){if(n===generation)show(err.message,'error');}
  finally{if(n===generation){busy=false;render();}}
 }
});
root.addEventListener('change',ev=>{
 if(ev.target.id==='task-filter-status'){status=ev.target.value;render();}
 if(ev.target.id==='task-filter-section'){section=ev.target.value;render();}
});
root.addEventListener('click',async ev=>{
 if(ev.target.closest('#tasks-logout')){clearLocal();busy=false;show('Signed out of your test account.');await auth.signOut();return;}
 if(ev.target.closest('#tasks-reload')){await refresh();return;}
 const b=ev.target.closest('[data-toggle]');if(!b||busy||!session)return;
 const r=records.tasks.find(r=>r.id===b.dataset.toggle);if(!r)return;
 let payload;try{payload=toggledTaskPayload(r);}catch(err){show(err.message,'error');return;}
 const n=generation;busy=true;render();
 try{const token=await auth.getAccessToken();const result=await api.toggleFictionalTask(token,r.id,user.id,payload);if(n!==generation)return;if(!Array.isArray(result)||result.length!==1)throw Error('Cloud update could not be verified.');await refresh();if(session)show('Task completion saved to the private cloud.');}
 catch(err){if(n===generation)show(err.message,'error');}
 finally{if(n===generation){busy=false;render();}}
});
(async()=>{
 try{const response=await fetch('/dev-config.json',{cache:'no-store'});if(!response.ok)throw Error('Development configuration unavailable; copy the working .env.local into this folder.');config=await response.json();api=createDevApi(config);auth=createDevSessionManager(api,config.projectRef,window.sessionStorage);busy=true;render();const restored=await auth.restore();if(restored){session=restored;user=restored.user;notice='Test account sign-in restored.';await refresh();}busy=false;render();}
 catch(err){root.innerHTML=wrap(`<p class="warning" role="alert">${e(err.message)}</p>`);}
})();
