import {createDevApi} from './dev-api.mjs';
import {createDevSessionManager} from './dev-session.mjs';
import {renderConnectedShell} from './dev-cloud-shell.mjs';
import {escapeHtml} from './core.mjs';
import {personalRecords,personalKind,personalCreate,progressFor} from './dev-personal-model.mjs';
const root=document.getElementById('cc-personal');let api,auth,user=null,records=[],busy=false,error='',notice='',current='all',editor=null,seq=0;
const e=v=>escapeHtml(String(v??''));
const btn=(title,action)=>`<button type="button" class="btn btn-small" data-action="${e(action)}">${e(title)}</button>`;
function render(){
 let h=`<section class="cc-work-header"><p class="eyebrow">THE CHAOS · MILESTONE 2G</p><h1>Personal Life</h1><p class="cc-work-deck">Start with the big picture. Open a project when you want smaller steps.</p><div class="cc-work-badges"><span class="pill">Fictional test data</span><span class="pill">Private by account</span><span class="pill">Simple quick-add</span></div></section>`;
 if(error)h+=`<p class="warning" role="alert">${e(error)}</p>`;
 if(notice)h+=`<p class="notice" role="status">${e(notice)}</p>`;
 if(!user){h+=`<section class="cc-work-card"><h2>Sign in to private Personal Life QA</h2><form id="personal-login" class="cc-org-fields"><label class="field-label">Development test email<input type="email" name="email" required></label><label class="field-label">Test password<input name="password" type="password" required></label><button class="btn btn-primary" type="submit">Sign in</button></form></section>`;}
 else{
  const parents=records.filter(r=>r.item_type==='project');const tasks=records.filter(r=>r.item_type==='task');
  h+=`<div class="cc-work-status"><div><strong>My Personal Space</strong><small>${e(user.email)} · ${parents.length} focus areas · ${tasks.length} smaller steps</small></div><div class="cc-work-actions">${btn('Refresh','refresh')}${btn('Sign out','signout')}</div></div>`;
  h+=`<section class="cc-work-card"><h2>Personal Life Overview</h2><p class="tiny muted">Quick-add only asks for a name. Projects, goals, lists and routines can be expanded into steps.</p><div class="cc-work-actions">${btn('All','view-all')}${btn('Projects','view-project')}${btn('Goals','view-goal')}${btn('Lists','view-list')}${btn('Routines','view-routine')}</div></section>`;
  h+=`<section class="cc-work-card"><div class="cc-card-heading"><h2>${current==='all'?'My Focus Areas':({project:'Projects',goal:'Personal Goals',list:'Personal Lists',routine:'Routines'})[current]}</h2></div><div class="cc-work-actions">${btn('+ Project','new-project')}${btn('+ Goal','new-goal')}${btn('+ List','new-list')}${btn('+ Routine','new-routine')}</div>`;
  const visible=parents.filter(r=>current==='all'||personalKind(r)===current);
  if(!visible.length)h+=`<p class="muted">Nothing here yet. Start with a name—add details later.</p>`;
  for(const r of visible){const p=progressFor(tasks,r.id);const steps=tasks.filter(t=>t.payload?.project_id===r.id);h+=`<details class="cc-personal-outline"><summary><strong>${e(r.payload.title)}</strong> <small class="muted">· ${e(personalKind(r))} · ${p.done}/${p.total} steps</small></summary><div class="cc-personal-inner"><div class="cc-work-actions">${btn('+ Step','new-step:'+r.id)}${btn('Details later','details')}</div>`;
   for(const t of steps)h+=`<label class="cc-work-row"><input type="checkbox" data-step-id="${e(t.id)}" ${t.payload.done?'checked':''} ${busy?'disabled':''}> ${e(t.payload.title)}</label>`;
   if(!steps.length)h+=`<p class="tiny muted">No steps yet. You can leave it this way or break it down.</p>`;
   h+='</div></details>';
  }
  h+='</section>';
  if(editor){h+=`<section class="cc-work-card"><h2>Add ${e(editor.kind==='step'?'step':editor.kind)}</h2><form id="personal-add" class="cc-org-fields"><label class="field-label">Name<input name="title" maxlength="140" required autofocus placeholder="What would you like to work on?"></label><button type="submit" class="btn btn-primary">Save</button>${btn('Cancel','cancel')}</form></section>`;}
  h+=`<section class="cc-work-card"><h2>Coming later</h2><p class="tiny muted">Customizable Personal Life widgets, optional deadlines and milestones, cleaning and household routines, maintenance, groceries, deliveries and mini calendars. These are not live in this foundation.</p></section>`;
 }
 root.innerHTML=renderConnectedShell(`<div class="cc-workspace-page">${h}</div>`,{active:'personal',workspace:'personal'});
}
async function load(){if(!user)return;const id=user.id,version=++seq;busy=true;render();try{const all=await api.listOrganization(await auth.getAccessToken(),id);if(version!==seq||user?.id!==id)return;records=personalRecords(all,id);error='';}catch(ex){error=String(ex.message||ex).slice(0,220);}finally{if(version===seq){busy=false;render();}}}
root.addEventListener('submit',ev=>{if(!['personal-login','personal-add'].includes(ev.target.id))return;ev.preventDefault();if(busy)return;const v=Object.fromEntries(new FormData(ev.target).entries());if(ev.target.id==='personal-login'){busy=true;render();void(async()=>{try{const a=await auth.signIn(v.email.trim(),v.password);user=a.user;await load();}catch(ex){error=String(ex.message||ex);user=null;}finally{busy=false;render();}})();return;}
 const ed=editor;busy=true;render();void(async()=>{try{const rec=personalCreate(ed.kind,v.title,user.id,ed.projectId);const rows=await api.addOrganizationRecord(await auth.getAccessToken(),rec);if(!Array.isArray(rows)||rows.length!==1)throw Error('Save not confirmed.');editor=null;notice='Saved fictional item.';await load();}catch(ex){error=String(ex.message||ex).slice(0,230);}finally{busy=false;render();}})();});
root.addEventListener('click',ev=>{const b=ev.target.closest('[data-action]');if(!b||!user||busy)return;const a=b.dataset.action;if(a==='refresh')void load();else if(a==='signout'){++seq;const session=auth;user=null;records=[];editor=null;render();void session.signOut();}else if(a.startsWith('view-')){current=a.slice(5);render();}else if(a.startsWith('new-step:')){editor={kind:'step',projectId:a.slice(9)};render();}else if(a.startsWith('new-')){editor={kind:a.slice(4),projectId:null};render();}else if(a==='cancel'){editor=null;render();}else if(a==='details'){notice='More optional details are planned for a later milestone.';render();}});
root.addEventListener('change',ev=>{const input=ev.target;if(!input.matches('input[data-step-id]')||!user||busy)return;const r=records.find(x=>x.id===input.dataset.stepId);if(!r)return;const done=input.checked;busy=true;render();void(async()=>{try{const payload={...r.payload,done,status:done?'Completed':'Not Started'};const rows=await api.updateOrganizationRecord(await auth.getAccessToken(),r,user.id,'task',payload,'Personal Life');if(!Array.isArray(rows)||rows.length!==1)throw Error('Update not confirmed');await load();}catch(ex){error=String(ex.message||ex).slice(0,230);await load();}finally{busy=false;render();}})();});
(async()=>{try{const res=await fetch('/dev-config.json',{cache:'no-store'});if(!res.ok)throw Error('Development configuration unavailable');const conf=await res.json();api=createDevApi(conf);auth=createDevSessionManager(api,conf.projectRef,sessionStorage);user=(await auth.restore())?.user||null;if(user)await load();else render();}catch(ex){error=String(ex.message||ex);render();}})();
