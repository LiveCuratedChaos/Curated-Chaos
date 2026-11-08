import { createDevApi, makeFictionalNote } from './dev-api.mjs';
import { escapeHtml as e } from './core.mjs';
const root=document.getElementById('auth-app');
let api=null, config=null, session=null, user=null, notes=[],busy=false,notice='',error='',generation=0;
const clearSession=()=>{session=null;user=null;notes=[];generation++;};
function showMessage(message,kind='notice'){ if(kind==='error'){error=message;notice='';}else{notice=message;error='';} render(); }
function card(inner){return `<section class="auth-card"><p class="eyebrow">CURATED CHAOS · MILESTONE 0C</p><h1>Isolated Cloud Sign-In</h1><p class="muted">Fictional test accounts only · Development Supabase · No production connections</p><p class="tiny muted">Target project: <strong>${e(config?.projectRef||'Not connected')}</strong></p>${error?`<div class="warning" role="alert">${e(error)}</div>`:''}${notice?`<div class="notice" role="status">${e(notice)}</div>`:''}${inner}<p class="tiny muted"><a href="/">← Return to fictional Daily Brief</a></p></section>`;}
function render(){
  document.title='Dev Sign-In · Curated Chaos';
  if(!api){root.innerHTML=card('<p>Cannot start the development login without a valid local configuration.</p>');return;}
  if(!session){
    root.innerHTML=card(`<h2>Sign in to the development project</h2><p class="muted">Use Test Account A or B that you created in the NEW project. Do not enter your original Curated Chaos credentials.</p><form id="auth-form" autocomplete="off"><label class="field-label">Test account email<input type="email" name="email" autocomplete="username" required /></label><label class="field-label">Test account password<input type="password" name="password" autocomplete="off" required /></label><button type="submit" class="btn btn-primary" ${busy?'disabled':''}>${busy?'Signing in…':'Sign in securely'}</button></form><p class="tiny muted">Session remains in browser memory only. Refreshing closes this test session; passwords are not saved by Curated Chaos.</p>`);
    return;
  }
  const rows=notes.map(n=>`<li class="item"><div class="item-main"><strong>${e(n.payload?.title||'(untitled)')}</strong><small>${e(n.payload?.body||'Fictional note')} · ${e(new Date(n.created_at).toLocaleString())}</small></div></li>`).join('');
  root.innerHTML=card(`<div class="auth-user"><div><h2>Signed in</h2><p class="muted">${e(user?.email||'Test user')}</p><p class="tiny muted">Account ID: ${e(user?.id||'')}</p></div><button type="button" id="sign-out" class="btn">Sign out / Switch A–B</button></div>
  <section class="panel"><h2>Create a private fictional note</h2><p class="tiny muted">Stored in this test user's <code>cc_records</code>. Visible only to this signed-in user through RLS.</p><form id="note-form"><label class="field-label">Fictional title<input name="title" maxlength="120" required placeholder="e.g. QA note for Account A" /></label><label class="field-label">Fictional details (optional)<textarea name="body" maxlength="1000" rows="2" placeholder="No private information"></textarea></label><button type="submit" class="btn btn-primary" ${busy?'disabled':''}>Save private test note</button></form></section>
  <section class="panel"><div class="panel-head"><h2>Private cloud notes</h2><button type="button" class="btn btn-small" id="reload" ${busy?'disabled':''}>Refresh</button></div>${notes.length?`<ul class="item-list">${rows}</ul>`:'<p class="muted">No private test notes yet. Create one above.</p>'}</section>
  <p class="warning tiny">This screen is a limited authentication proof-of-concept, not the complete secure multi-device app. Do not put real data here. No session persistence, production security approval, household invitations, or bank/email connections.</p>`);
}
function active(){ if(!session||Date.now()>=session.expiresAt-15000){clearSession();showMessage('Test session expired. Sign in again.','error');return false;}return true;}
async function load(){
  if(!active()) return;
  const n=++generation, token=session.accessToken;
  busy=true;render();
  try {const result=await api.listNotes(token);if(n!==generation)return;notes=Array.isArray(result)?result:[];notice='Fetched private records from the isolated development project.';error='';}
  catch(err){if(n!==generation)return;showMessage(err.message,'error');return;}
  finally{if(n===generation){busy=false;render();}}
}
root.addEventListener('submit',async event=>{
  if(event.target.id==='auth-form'){
    event.preventDefault(); if(busy)return;
    const data=new FormData(event.target),email=String(data.get('email')||'').trim(),password=String(data.get('password')||'');
    if(!email||!password)return;
    busy=true;error='';notice='';render();
    try {const s=await api.signIn(email,password);const u=await api.getUser(s.accessToken);if(!u?.id) throw Error('Supabase did not return an authenticated user.');session=s;user=u;notice='Authenticated to the development project.';await load();}
    catch(err){clearSession();showMessage(err.message,'error');}
    finally{busy=false;render();}
  } else if(event.target.id==='note-form'){
    event.preventDefault();if(busy||!active())return;
    const form=event.target,data=new FormData(form);
    let note;try{note=makeFictionalNote(data.get('title'),data.get('body'),user.id);}catch(err){showMessage(err.message,'error');return;}
    busy=true;error='';render();
    try{await api.addNote(session.accessToken,note);notice='Private fictional note saved in the development database.';await load();}
    catch(err){showMessage(err.message,'error');}
    finally{busy=false;render();}
  }
});
root.addEventListener('click',async event=>{
  if(event.target.closest('#sign-out')){
    const token=session?.accessToken;clearSession();busy=false;showMessage('Signed out locally.');await api.signOut(token);
  } else if(event.target.closest('#reload'))await load();
});
(async()=>{
  try {
    const response=await fetch('/dev-config.json',{cache:'no-store'});
    if(!response.ok)throw Error('Development configuration could not be loaded. Copy your previous .env.local into this new project folder.');
    config=await response.json();api=createDevApi(config);render();
  }catch(err){root.innerHTML=`<section class="auth-card"><h1>Configuration needed</h1><p class="warning">${e(err.message)}</p><p><a href="/">Return to fictional Daily Brief</a></p></section>`;}
})();
