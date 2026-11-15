// M1C fictional email insight QA — no email provider, no background import, no sending email.
import { createDevApi } from './dev-api.mjs';
import { createDevSessionManager } from './dev-session.mjs';
import { renderConnectedShell,renderDevelopmentConnectionsLink } from './dev-cloud-shell.mjs';
import { escapeHtml as e, dayString, formatDate } from './core.mjs';
import { EMAIL_EXAMPLES, makeFictionalEmail, normalizeFictionalEmails, emailSuggestions } from './dev-email-model.mjs';
const root=document.getElementById('connected-email');
let api=null,config=null,auth=null,user=null,emails=[],busy=false,notice='',error='',generation=0;
function reset(){user=null;emails=[];generation++;}
const alerts=()=>`${error?`<p role="alert" class="warning">${e(error)}</p>`:''}${notice?`<div role="status" class="notice">${e(notice)}</div>`:''}`;
const panel=(title,inner)=>`<section class="panel"><div class="panel-head"><h2>${e(title)}</h2></div>${inner}</section>`;
function show(){
  const signedIn=Boolean(user&&auth?.get());
  const header=`<section class="connected-card"><p class="eyebrow">CURATED CHAOS · MILESTONE 1D</p><h1>Email Insights · Fictional Inbox</h1><p class="muted">Review sample-only messages, detect possible tasks, and send suggestions to the Daily Brief for approval.</p><p class="warning tiny">This sample inbox uses fictional messages only. Manage read-only Gmail connections and saved source snapshots separately below. Never paste private email into the sample workflow.</p>${alerts()}`;
  let body='';
  if(!api)body='<p>Loading your isolated test connection…</p>';
  else if(!signedIn)body=panel('Sign in to your test account',`<form id="email-login" autocomplete="off"><label class="field-label">Test email<input name="email" type="email" autocomplete="username" required></label><label class="field-label">Test password<input name="password" type="password" autocomplete="off" required></label><button class="btn btn-primary" type="submit" ${busy?'disabled':''}>Sign in</button></form><p class="tiny muted">Use the same development Account A as the agenda. Your 12-hour tab session can be restored after refresh.</p>`);
  else {
    const existing=new Set(emails.map(x=>x.payload.template_id));
    const samples=EMAIL_EXAMPLES.map(t=>`<li class="item"><div class="item-main"><strong>${e(t.subject)}</strong><small>${e(t.sender)} · ${e(t.category)} · Categorized automatically from a fixed sample template (no AI or inbox scan)</small><small>${e(t.preview)}</small></div><button type="button" class="btn btn-small" data-add-email="${e(t.id)}" ${busy||existing.has(t.id)?'disabled':''}>${existing.has(t.id)?'Added':'Add sample'}</button></li>`).join('');
    const suggestions=emailSuggestions(emails);
    const ownRows=emails.length?emails.map(row=>{const p=row.payload;const suggestion=suggestions.find(x=>x.emailId===row.id);return `<li class="item" id="email-${e(row.id)}"><div class="item-main"><strong>${e(p.subject)}</strong><small>From: ${e(p.sender)} · Added ${e(formatDate(p.received_day))} · private fictional cloud email</small><small>${e(p.preview)}</small><small>Source: selected fictional template · Classification: exact sample match</small>${suggestion?`<small>Possible task: ${e(suggestion.title)} · ${e(formatDate(suggestion.day))}. Review required; nothing added automatically.</small>`:'<small>No task suggested for this receipt example.</small>'}</div></li>`;}).join(''):'<p class="empty">Your fictional inbox is empty. Add one of the prepared examples above to test the workflow.</p>';
    body=`<div class="auth-user"><p class="muted">Signed in as <strong>${e(user.email)}</strong></p><button type="button" class="btn" id="email-logout">Sign out</button></div>`+
      panel('Add a prepared fictional message',`<p class="tiny muted">Only the three predefined example messages can be added. No actual inbox connection, forwarding, sending, or email address entry is supported.</p><ul class="item-list">${samples}</ul>`)+
      panel('Your saved fictional inbox',`<p class="tiny muted">${emails.length} private sample email(s) visible to this test account · stored in isolated development Supabase</p>${emails.length?`<ul class="item-list">${ownRows}</ul>`:ownRows}`)+
      panel('Possible task insights · review in Daily Brief',`<p>Detected <strong>${suggestions.length}</strong> possible task(s) from the fictional messages. Smart Independence preview: harmless categorization happens automatically; creating tasks never does. Open the <a href="/dev-dashboard.html">Daily Brief</a> to review, edit, approve or dismiss each suggestion. They do not create tasks until you approve.</p><p class="tiny muted">Approved tasks appear in Tasks and the Agenda. Dismissals persist in this account. A sample receipt is informational and creates no task.</p><button type="button" class="btn" id="email-reload" ${busy?'disabled':''}>Refresh private inbox</button>`);
  }
  root.innerHTML=renderConnectedShell(header+renderDevelopmentConnectionsLink(location.href)+body+'</section>',{active:'email'});
}
function message(msg,failed=false){error=failed?msg:'';notice=failed?'':msg;show();}
async function load(){if(!user||!auth?.get())return;const seq=++generation;busy=true;show();try{const token=await auth.getAccessToken();const raw=await api.listFictionalEmails(token);if(seq!==generation)return;emails=normalizeFictionalEmails(raw,user.id);error='';notice='Private fictional inbox loaded.';}catch(err){if(seq!==generation)return;error=err.message;notice='';if(!auth.get())reset();}finally{if(seq===generation){busy=false;show();}}}
root.addEventListener('submit',async ev=>{if(ev.target.id!=='email-login')return;ev.preventDefault();if(busy)return;const fields=new FormData(ev.target);busy=true;show();try{const result=await auth.signIn(String(fields.get('email')||'').trim(),String(fields.get('password')||''));user=result.user;await load();}catch(err){reset();message(err.message,true);}finally{busy=false;show();}});
root.addEventListener('click',async ev=>{
  const add=ev.target.closest('[data-add-email]');
  if(add){
    if(busy||!user||!auth?.get()||emails.some(x=>x.payload.template_id===add.dataset.addEmail))return;
    let entry;try{entry=makeFictionalEmail(add.dataset.addEmail,user.id,dayString());}catch(err){message(err.message,true);return;}
    const seq=++generation;busy=true;show();
    try{const token=await auth.getAccessToken();const result=await api.addFictionalEmail(token,entry);if(seq!==generation)return;if(!Array.isArray(result)||result.length!==1)throw Error('Cloud save not confirmed. Refresh the inbox before retrying.');await load();if(user)message('Fictional email saved. Open the Daily Brief to review its suggestion.');}
    catch(err){if(seq===generation)message(err.message,true);}finally{if(seq===generation){busy=false;show();}}
    return;
  }
  if(ev.target.closest('#email-reload')){await load();return;}
  if(ev.target.closest('#email-logout')){reset();busy=false;message('Signed out of this test screen.');await auth.signOut();}
});
(async()=>{try{const response=await fetch('/dev-config.json',{cache:'no-store'});if(!response.ok)throw Error('Development configuration missing. Copy .env.local from your working M1B folder.');config=await response.json();api=createDevApi(config);auth=createDevSessionManager(api,config.projectRef,window.sessionStorage);busy=true;show();const restored=await auth.restore();if(restored){user=restored.user;await load();}busy=false;show();}catch(err){root.innerHTML=renderConnectedShell(`<section class="connected-card"><h1>Email Insights</h1><p class="warning">${e(err.message)}</p></section>`,{active:'email'});}})();
