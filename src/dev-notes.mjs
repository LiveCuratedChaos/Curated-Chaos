// M0H: Private fictional cloud notes QA in the connected shell.
// No live integrations, no household records and no real personal content.
import {createDevApi,makeFictionalNote} from './dev-api.mjs';
import {createDevSessionManager} from './dev-session.mjs';
import {renderConnectedShell} from './dev-cloud-shell.mjs';
import {escapeHtml as e} from './core.mjs';
import {normalizeCloudRecords} from './dev-brief-model.mjs';

const root=document.getElementById('connected-notes');
let config=null,api=null,auth=null,session=null,user=null,notes=[],busy=false,notice='',error='',generation=0,query='';
const clearLocal=()=>{generation++;session=null;user=null;notes=[];query='';};
const alerts=()=>`${error?`<p class="warning" role="alert">${e(error)}</p>`:''}${notice?`<p class="notice" role="status">${e(notice)}</p>`:''}`;
const wrap=inner=>renderConnectedShell(`<section class="connected-card"><p class="eyebrow">CURATED CHAOS · MILESTONE 0H</p><h1>My Notes</h1><p class="muted">Private fictional cloud notes · Isolated development project</p><p class="tiny muted">Supabase project: ${e(config?.projectRef||'not connected')}</p>${alerts()}${inner}<p class="tiny muted"><a href="/dev-dashboard.html">Connected Daily Brief</a> · <a href="/dev-tasks.html">Connected Tasks</a>. Other pages remain local-only fictional demonstrations.</p></section>`,{active:'notes'});
const viewNotes=()=>notes.filter(n=>`${n.payload.title} ${n.payload.body||''}`.toLowerCase().includes(query.trim().toLowerCase()));
const noteRow=n=>`<li class="item"><div class="item-main"><strong>${e(n.payload.title)}</strong><small>${e(n.payload.body||'No description')}</small><small>Private fictional note · ${e(new Date(n.created_at).toLocaleDateString())}</small></div></li>`;
function render(){
 document.title='Cloud Notes QA · Curated Chaos';
 if(!api){root.innerHTML=wrap('<p class="muted">Loading development connection settings…</p>');return;}
 if(!session){root.innerHTML=wrap(`<section class="panel"><h2>Sign in to your development account</h2><p class="muted">Only use your fictional test accounts.</p><form id="notes-login" autocomplete="off"><label class="field-label">Test email<input name="email" type="email" autocomplete="username" required></label><label class="field-label">Test password<input name="password" type="password" autocomplete="off" required></label><button class="btn btn-primary" type="submit" ${busy?'disabled':''}>${busy?'Signing in…':'Sign in'}</button></form></section>`);return;}
 const shown=viewNotes();
 root.innerHTML=wrap(`<div class="auth-user"><p class="tiny muted">Signed in as ${e(user.email||'Test account')}</p><button id="notes-logout" type="button" class="btn btn-small" ${busy?'disabled':''}>Sign out</button></div>
 <div class="metric-grid"><div class="metric"><span>Private notes</span><strong>${notes.length}</strong></div><div class="metric"><span>Matching search</span><strong>${shown.length}</strong></div><div class="metric"><span>Cloud source</span><strong>Dev</strong></div></div>
 <div class="two-columns"><section class="panel"><div class="panel-head"><h2>Create fictional note</h2><span class="pill gold">Cloud</span></div><form id="notes-add"><label class="field-label">Title<input name="title" maxlength="120" required placeholder="Example: QA fictional packing list"></label><label class="field-label">Description<textarea name="body" maxlength="1000" rows="4" placeholder="Fictional information only"></textarea></label><button class="btn btn-primary" type="submit" ${busy?'disabled':''}>Save private note</button></form></section>
 <section class="panel"><div class="panel-head"><h2>My private cloud notes</h2><button id="notes-reload" class="btn btn-small" type="button" ${busy?'disabled':''}>Refresh</button></div><label class="field-label">Search notes<input id="notes-search" type="search" value="${e(query)}" placeholder="Filter saved notes"></label>${shown.length?`<ul class="item-list">${shown.map(noteRow).join('')}</ul>`:'<p class="empty">No notes match this search. If you created one in the earlier sign-in tester, clear the filter or refresh.</p>'}</section></div>
 <p class="warning tiny">Development test screen only. Never enter actual personal, work, school, household, financial or other sensitive information. Note editing, sharing, deleting and production login are not enabled.</p>`);
}
const show=(msg,kind='notice')=>{error=kind==='error'?msg:'';notice=kind==='error'?'':msg;render();};
async function refresh(){
 if(!auth?.get()){clearLocal();show('Sign in to your development account.','error');return;}
 const n=++generation,owner=user.id;busy=true;render();
 try{const token=await auth.getAccessToken();const raw=await api.listBriefRecords(token);if(n!==generation)return;notes=normalizeCloudRecords(raw,owner).notes;error='';notice='Private notes loaded for your test account.';}
 catch(err){if(n!==generation)return;if(!auth.get()){clearLocal();error='Session expired. Sign in again.';}else error=err.message;notice='';}
 finally{if(n===generation){busy=false;render();}}
}
root.addEventListener('submit',async ev=>{
 if(ev.target.id==='notes-login'){
  ev.preventDefault();if(busy)return;
  const v=new FormData(ev.target),email=String(v.get('email')||'').trim(),password=String(v.get('password')||'');
  busy=true;error='';render();
  try{const result=await auth.signIn(email,password);session=auth.get();user=result.user;await refresh();}
  catch(err){clearLocal();show(err.message,'error');}
  finally{busy=false;render();}
  return;
 }
 if(ev.target.id==='notes-add'){
  ev.preventDefault();if(busy||!session)return;
  const v=new FormData(ev.target),draft={title:String(v.get('title')||''),body:String(v.get('body')||'')};
  let record;try{record=makeFictionalNote(draft.title,draft.body,user.id);}catch(err){show(err.message,'error');return;}
  const n=generation;busy=true;render();
  try{const token=await auth.getAccessToken();const created=await api.addNote(token,record);if(n!==generation)return;if(!Array.isArray(created)||created.length!==1)throw Error('Cloud note save could not be verified.');await refresh();if(session)show('Fictional note saved in private cloud.');}
  catch(err){if(n===generation)show(err.message,'error');}
  finally{if(n===generation){busy=false;render();}}
 }
});
root.addEventListener('input',ev=>{
 if(ev.target.id==='notes-search'){
  // Keep focus during filtering to make search usable without repeated clicks.
  const next=ev.target.value;query=next;
  const list=root.querySelector('#notes-results');
  // Render the full view only on blur/enter; results update through replacement below.
  const shown=viewNotes();
  const oldList=root.querySelector('.item-list, .empty');
  if(oldList)oldList.outerHTML=shown.length?`<ul class="item-list">${shown.map(noteRow).join('')}</ul>`:'<p class="empty">No notes match this search.</p>';
 }
});
root.addEventListener('click',async ev=>{
 if(ev.target.closest('#notes-logout')){clearLocal();busy=false;show('Signed out.');await auth.signOut();return;}
 if(ev.target.closest('#notes-reload')){await refresh();}
});
(async()=>{
 try{const response=await fetch('/dev-config.json',{cache:'no-store'});if(!response.ok)throw Error('Development configuration unavailable. Copy the working .env.local into the M0H folder.');config=await response.json();api=createDevApi(config);auth=createDevSessionManager(api,config.projectRef,window.sessionStorage);busy=true;render();const restored=await auth.restore();if(restored){session=restored;user=restored.user;await refresh();}busy=false;render();}
 catch(err){root.innerHTML=wrap(`<p class="warning" role="alert">${e(err.message)}</p>`);}
})();
