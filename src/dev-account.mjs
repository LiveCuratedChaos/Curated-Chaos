// M1F: Owner-private, fictional settings in isolated Supabase cc_records. No real permissions or providers.
import { createDevApi } from './dev-api.mjs';
import { createDevSessionManager } from './dev-session.mjs';
import { renderConnectedShell } from './dev-cloud-shell.mjs';
import { escapeHtml as e } from './core.mjs';
import { QA_PALETTES } from './dev-theme.mjs';
import {CUSTOM_NAV_IDS,WORKSPACE_PAGES,normalizeNavigation} from './dev-navigation-model.mjs';
import { INTEGRATION_SOURCES, SOURCE_LABELS } from './dev-intelligence-model.mjs';
import { normalizeBriefPreferences, makeBriefPreferencesRecord, readOwnerBriefPreferences } from './dev-preferences-model.mjs';
const root=document.getElementById('cc-account');
const paletteNames={neutral:'Neutral · Classic Minimal',luxury:'Timeless Luxury',blush:'Blush Pink',coastal:'Coastal Blue',earthy:'Earthy Green',executive:'Modern Executive',academia:'Dark Academia · personal'};
let api=null,auth=null,user=null,config=null,settings=normalizeBriefPreferences(),record=null,duplicates=0,busy=false,error='',notice='',generation=0;
const applyLook=()=>{document.body.dataset.theme=settings.palette;document.body.dataset.density=settings.density;};
const resetLook=()=>{document.body.dataset.theme='neutral';document.body.dataset.density='balanced';};
const msg=()=>`${error?`<p role="alert" class="warning">${e(error)}</p>`:''}${notice?`<p role="status" class="notice">${e(notice)}</p>`:''}`;
function render(){
  const login=`<h2>Sign in to manage your test account preferences</h2><p class="muted">Sign in using Development Test Account A or B. Settings are stored privately per account.</p><form id="prefs-login" autocomplete="off"><label class="field-label">Test email<input name="email" type="email" autocomplete="username" required></label><label class="field-label">Test password<input name="password" type="password" autocomplete="off" required></label><button type="submit" class="btn btn-primary" ${busy?'disabled':''}>Sign in</button></form>`;
  const sourceControls=INTEGRATION_SOURCES.map(key=>`<label class="settings-choice"><input type="checkbox" name="source_${key}" ${settings.sources[key]?'checked':''}> Show ${e(SOURCE_LABELS[key])} records in the Daily Brief</label>`).join('');
  const suggestionControls=['email','school','household'].map(key=>`<label class="settings-choice"><input type="checkbox" name="suggest_${key}" ${settings.suggestions[key]?'checked':''}> Prepare ${e(SOURCE_LABELS[key])} task suggestions for my approval</label>`).join('');
  const nav=normalizeNavigation(settings.navigation);
  const navControls=nav.order.map((id,index)=>{const p=WORKSPACE_PAGES.find(x=>x.id===id);return `<div class="cc-nav-edit-row"><label class="settings-choice"><input type="checkbox" name="nav_show_${e(id)}" ${nav.hidden.includes(id)?'':'checked'}> ${e(p.title)}</label><select aria-label="Order of ${e(p.title)}" name="nav_order_${e(id)}">${nav.order.map((_,n)=>`<option value="${n}" ${n===index?'selected':''}>Position ${n+1}</option>`).join('')}</select></div>`;}).join('');
  const contents=!user?login:`<div class="auth-user"><p class="tiny muted">Signed in: ${e(user.email||'Development test account')} · Private fictional settings</p><button type="button" class="btn btn-small" id="prefs-logout">Sign out</button></div>
    ${duplicates?'<p class="warning">Multiple legacy settings records were found. The most recently updated was loaded. This QA schema does not yet enforce a unique owner preference record.</p>':''}
    <form id="prefs-form"><section class="panel"><h2>Appearance & display</h2><label class="field-label">Visual preset<select name="palette" id="saved-palette">${QA_PALETTES.map(x=>`<option value="${e(x)}" ${settings.palette===x?'selected':''}>${e(paletteNames[x])}</option>`).join('')}</select></label><label class="field-label">Display density<select name="density"><option value="balanced" ${settings.density==='balanced'?'selected':''}>Balanced</option><option value="compact" ${settings.density==='compact'?'selected':''}>Compact</option><option value="spacious" ${settings.density==='spacious'?'selected':''}>Spacious</option></select></label><label class="settings-choice"><input name="hideAmounts" type="checkbox" ${settings.hideAmounts?'checked':''}> Hide fictional financial amounts</label></section>
    <section class="panel"><h2>Navigation · Milestone 3C</h2><p class="tiny muted">Choose which main pages show in the sidebar and their order. Hidden pages and their data are not deleted; their direct links still work. Daily Brief, The Curation and My Account remain available.</p>${navControls}</section>
    <section class="panel"><h2>Sources shown in your Daily Brief</h2><p class="tiny muted">These settings are appearance preferences, not permissions to access, share, download, or delete provider data. No real providers are connected.</p>${sourceControls}</section>
    <section class="panel"><h2>AI Concierge · Smart Independence (QA)</h2><p class="tiny muted">Automatic low-risk categorization of known fictional samples remains rules-based. The controls below determine which approval-required suggestions are shown. No task, message, calendar change, sharing, or financial action happens without explicit approval.</p>${suggestionControls}</section>
    <section class="panel"><h2>Quiet hours · preference preview only</h2><p class="tiny muted">Saved for future notification testing. This build does not send notifications or run scheduled background work.</p><label class="settings-choice"><input name="quietEnabled" type="checkbox" ${settings.quietHours.enabled?'checked':''}> Enable quiet hours when notifications are implemented</label><div class="brief-fields"><label class="field-label">From<input type="time" name="quietStart" value="${e(settings.quietHours.start)}"></label><label class="field-label">Until<input type="time" name="quietEnd" value="${e(settings.quietHours.end)}"></label></div></section>
    <button type="submit" class="btn btn-primary" ${busy?'disabled':''}>${busy?'Saving…':'Save my test preferences'}</button> <a class="btn" href="/dev-dashboard.html">Open Daily Brief</a></form>
    <p class="tiny muted">Saved display preferences are loaded by the Daily Brief and Account Settings. Other development pages may still use their own palette preview. Full navigation customization is not active yet. Preference records are not server-side authorization, nor are they a production-grade account settings service.</p>`;
  root.innerHTML=renderConnectedShell(`<section class="connected-card"><p class="eyebrow">CURATED CHAOS · MILESTONE 3C</p><h1>My Account</h1><p class="muted">Account appearance, privacy display options and notification preferences</p>${msg()}${contents}</section>`,{active:'account'});
}
async function load(){
  const n=++generation;busy=true;render();
  try{const token=await auth.getAccessToken();const rows=await api.listBriefPreferences(token,user.id);if(n!==generation)return;
    const loaded=readOwnerBriefPreferences(rows,user.id);settings=loaded.preferences;record=loaded.record;duplicates=loaded.duplicateCount;
    applyLook();window.__ccNavigationPrefs=settings.navigation;error='';notice=record?'Saved preferences loaded from your private development account.':'No saved preferences yet. Secure defaults are shown.';
  }catch(err){if(n!==generation)return;error=err.message;notice='';}
  finally{if(n===generation){busy=false;render();}}
}
root.addEventListener('submit',async ev=>{
  if(ev.target.id==='prefs-login'){
    ev.preventDefault();if(busy)return;const v=new FormData(ev.target);busy=true;render();
    try{const signed=await auth.signIn(String(v.get('email')||'').trim(),String(v.get('password')||''));user=signed.user;await load();}
    catch(err){user=null;resetLook();error=err.message;notice='';}finally{busy=false;render();}return;
  }
  if(ev.target.id!=='prefs-form')return;
  ev.preventDefault();if(busy||!user)return;
  const nav=normalizeNavigation(settings.navigation);
  const v=new FormData(ev.target),raw={palette:String(v.get('palette')||''),density:String(v.get('density')||''),hideAmounts:v.has('hideAmounts'),
    sources:Object.fromEntries(INTEGRATION_SOURCES.map(k=>[k,v.has('source_'+k)])),
    suggestions:Object.fromEntries(['email','school','household'].map(k=>[k,v.has('suggest_'+k)])),
    navigation:{order:[...nav.order].sort((a,b)=>Number(v.get('nav_order_'+a))-Number(v.get('nav_order_'+b))),hidden:nav.order.filter(id=>!v.has('nav_show_'+id))},
    quietHours:{enabled:v.has('quietEnabled'),start:String(v.get('quietStart')||''),end:String(v.get('quietEnd')||'')}};
  const draft=makeBriefPreferencesRecord(raw,user.id);const n=++generation;busy=true;render();
  try{const token=await auth.getAccessToken();const fresh=readOwnerBriefPreferences(await api.listBriefPreferences(token,user.id),user.id);
    if(n!==generation)return;
    if(fresh.record && record && (fresh.record.id!==record.id||fresh.record.version!==record.version)){
      settings=fresh.preferences;record=fresh.record;duplicates=fresh.duplicateCount;applyLook();throw Error('Preferences changed in another tab or device. Latest saved settings loaded. Please review and save again.');
    }
    if(fresh.record&&!record){settings=fresh.preferences;record=fresh.record;applyLook();throw Error('Settings were created elsewhere. Latest settings loaded; review before saving.');}
    const result=record
      ?await api.updateBriefPreferences(token,record,user.id,draft.payload)
      :await api.addBriefPreferences(token,draft);
    if(n!==generation)return;
    if(!Array.isArray(result)||result.length!==1){throw Error('Preference save not confirmed. Refresh and check before trying again.');}
    const saved=readOwnerBriefPreferences(await api.listBriefPreferences(token,user.id),user.id);
    settings=saved.preferences;record=saved.record;duplicates=saved.duplicateCount;applyLook();window.__ccNavigationPrefs=settings.navigation;notice='Your private preferences were saved. Refresh and open another workspace to verify navigation.';error='';
  }catch(err){if(n!==generation)return;error=err.message;notice='';}
  finally{if(n===generation){busy=false;render();}}
});
root.addEventListener('change',ev=>{if(ev.target.id==='saved-palette')document.body.dataset.theme=ev.target.value;});
root.addEventListener('click',async ev=>{if(!ev.target.closest('#prefs-logout'))return;
  ++generation;user=null;record=null;duplicates=0;settings=normalizeBriefPreferences();resetLook();window.__ccNavigationPrefs=null;error='';notice='Signed out. Local preview reset.';render();await auth.signOut();});
(async()=>{try{const response=await fetch('/dev-config.json',{cache:'no-store'});if(!response.ok)throw Error('Development configuration unavailable.');
  config=await response.json();api=createDevApi(config);auth=createDevSessionManager(api,config.projectRef,sessionStorage);
  const restored=await auth.restore();if(restored){user=restored.user;await load();}else render();
}catch(err){root.innerHTML=`<p class="warning">${e(err.message)}</p>`;}})();
