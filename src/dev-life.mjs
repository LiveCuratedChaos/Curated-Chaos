// M1D: save only prepared, fictional samples to the isolated development account.
import { createDevApi } from './dev-api.mjs';
import { createDevSessionManager } from './dev-session.mjs';
import { renderConnectedShell } from './dev-cloud-shell.mjs';
import { escapeHtml as e,dayString,formatDate } from './core.mjs';
import { LIFE_EXAMPLES,LIFE_SOURCES,LIFE_NAMES,makeFictionalLife,normalizeFictionalLife } from './dev-life-model.mjs';
const root=document.getElementById('connected-life');
let api=null,config=null,auth=null,user=null,life=[],busy=false,notice='',error='',generation=0;
const reset=()=>{user=null;life=[];generation++;};
const panel=(title,content)=>`<section class="panel"><div class="panel-head"><h2>${e(title)}</h2></div>${content}</section>`;
function show(){
  const signedIn=!!(user&&auth?.get());
  const header=`<section class="connected-card"><p class="eyebrow">CURATED CHAOS · MILESTONE 1D</p><h1>Life Sources · Fictional Test Records</h1><p class="muted">Save sample school checkpoints, bills, and household responsibilities, then see them in your Daily Brief.</p><p class="warning tiny">FICTIONAL DATA ONLY. Never enter real WGU documents, personal finances, household details or confidential work data.</p>${error?`<p class="warning" role="alert">${e(error)}</p>`:''}${notice?`<p class="notice" role="status">${e(notice)}</p>`:''}`;
  let content='';
  if(!api)content='<p>Loading development connection…</p>';
  else if(!signedIn)content=panel('Sign in to your development account',`<form id="life-login" autocomplete="off"><label class="field-label">Test email<input type="email" name="email" required autocomplete="username"></label><label class="field-label">Test password<input type="password" name="password" required autocomplete="off"></label><button class="btn btn-primary" type="submit" ${busy?'disabled':''}>Sign in</button></form><p class="tiny muted">Use Account A, the same development account you used in 1C.</p>`);
  else{
    const added=new Set(life.map(r=>r.payload.template_id));
    const examples=LIFE_SOURCES.map(s=>panel(`${LIFE_NAMES[s]} · prepared examples`, `<ul class="item-list">${LIFE_EXAMPLES.filter(t=>t.source===s).map(t=>`<li class="item"><div class="item-main"><strong>${e(t.title)}</strong><small>${e(t.detail)} · ${e(t.kind)} · ${added.has(t.id)?'Due '+e(formatDate(life.find(r=>r.payload.template_id===t.id).payload.day)):'Due date set when added'}</small>${t.amount!==null?'<small>Contains a fictional dollar amount, hidden by default in Daily Brief.</small>':''}</div><button type="button" class="btn btn-small" data-add-life="${e(t.id)}" ${busy||added.has(t.id)?'disabled':''}>${added.has(t.id)?'Added':'Add sample'}</button></li>`).join('')}</ul>`)).join('');
    content=`<div class="auth-user"><p class="muted">Signed in as <strong>${e(user.email||'Development account')}</strong></p><button class="btn" id="life-logout" type="button">Sign out</button></div>${panel('Your saved fictional records',life.length?`<p><strong>${life.length}</strong> saved sample record(s), private to this account.</p><ul class="item-list">${life.map(r=>`<li class="item"><div class="item-main"><strong>${e(r.payload.title)}</strong><small>${e(r.section)} · ${e(formatDate(r.payload.day))} · FICTIONAL CLOUD RECORD</small></div></li>`).join('')}</ul>`:'<p class="empty">No sample life records saved yet. Use the examples below to add some.</p>')}${examples}${panel('See these records in your Daily Brief',`<p>Open <a href="/dev-dashboard.html">A Glimpse of Your Day</a> to see your own fictional school, bill, and household summaries. Financial amounts start hidden. Suggested tasks, where relevant, still require your approval.</p><button class="btn" type="button" id="life-reload" ${busy?'disabled':''}>Refresh private records</button>`)}<p class="tiny muted">No WGU, bank, budgeting provider, or shared-household connection is present. Private QA rows are stored using the existing Supabase dev table; no new schema needed.</p>`;
  }
  root.innerHTML=renderConnectedShell(header+content+'</section>',{active:'life'});
}
function msg(text,isError=false){error=isError?text:'';notice=isError?'':text;show();}
async function load(){if(!user||!auth?.get())return;const seq=++generation;busy=true;show();try{const token=await auth.getAccessToken();const raw=await api.listFictionalLife(token);if(seq!==generation)return;life=normalizeFictionalLife(raw,user.id);error='';notice='Private fictional records loaded.';}catch(err){if(seq!==generation)return;error=err.message;notice='';if(!auth.get())reset();}finally{if(seq===generation){busy=false;show();}}}
root.addEventListener('submit',async ev=>{if(ev.target.id!=='life-login')return;ev.preventDefault();if(busy)return;const values=new FormData(ev.target);busy=true;show();try{const r=await auth.signIn(String(values.get('email')||'').trim(),String(values.get('password')||''));user=r.user;await load();}catch(err){reset();msg(err.message,true);}finally{busy=false;show();}});
root.addEventListener('click',async ev=>{
 const add=ev.target.closest('[data-add-life]');
 if(add){if(busy||!user||!auth?.get()||life.some(x=>x.payload.template_id===add.dataset.addLife))return;let data;try{data=makeFictionalLife(add.dataset.addLife,user.id,dayString());}catch(err){msg(err.message,true);return;}const seq=++generation;busy=true;show();try{const token=await auth.getAccessToken();const response=await api.addFictionalLife(token,data);if(seq!==generation)return;if(!Array.isArray(response)||response.length!==1)throw Error('Cloud save not confirmed. Refresh before retrying.');await load();if(user)msg('Fictional life record saved privately. Check your Daily Brief.');}catch(err){if(seq===generation)msg(err.message,true);}finally{if(seq===generation){busy=false;show();}}return;}
 if(ev.target.closest('#life-reload')){await load();return;}
 if(ev.target.closest('#life-logout')){reset();busy=false;show();await auth.signOut();msg('Signed out.');}
});
(async()=>{try{const response=await fetch('/dev-config.json',{cache:'no-store'});if(!response.ok)throw Error('Development connection unavailable. Copy .env.local from your working M1C_Reviewed folder.');config=await response.json();api=createDevApi(config);auth=createDevSessionManager(api,config.projectRef,window.sessionStorage);busy=true;show();const restored=await auth.restore();if(restored){user=restored.user;await load();}busy=false;show();}catch(err){root.innerHTML=renderConnectedShell(`<section class="connected-card"><h1>Life Sources</h1><p class="warning">${e(err.message)}</p></section>`,{active:'life'});}})();
