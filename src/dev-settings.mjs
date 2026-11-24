// M1F: Owner-private, fictional settings in isolated Supabase cc_records. No real permissions or providers.
import { createDevApi } from './dev-api.mjs';
import { createDevSessionManager } from './dev-session.mjs';
import { renderConnectedShell } from './dev-cloud-shell.mjs';
import { escapeHtml as e } from './core.mjs';
import { QA_PALETTES } from './dev-theme.mjs';
import { INTEGRATION_SOURCES, SOURCE_LABELS } from './dev-intelligence-model.mjs';
import { normalizeBriefPreferences, makeBriefPreferencesRecord, readOwnerBriefPreferences } from './dev-preferences-model.mjs';
const root=document.getElementById('cc-settings');
const paletteNames={neutral:'Neutral · Classic Minimal',luxury:'Timeless Luxury',blush:'Blush Pink',coastal:'Coastal Blue',earthy:'Earthy Green',executive:'Modern Executive',academia:'Dark Academia · personal'};
let api=null,auth=null,user=null,config=null,settings=normalizeBriefPreferences(),record=null,duplicates=0,busy=false,error='',notice='',generation=0,preferencesDraft=null,needsReview=false;
const applyLook=()=>{const view=preferencesDraft||settings;document.body.dataset.theme=view.palette;document.body.dataset.density=view.density;};
const resetLook=()=>{document.body.dataset.theme='neutral';document.body.dataset.density='balanced';};
const msg=()=>`${error?`<p role="alert" class="warning">${e(error)}</p>`:''}${notice?`<p role="status" class="notice">${e(notice)}</p>`:''}`;
function render(){
  const view=preferencesDraft||settings;
  const login=`<h2>Sign in to edit your test preferences</h2><p class="muted">Sign in using Development Test Account A or B. Settings are stored privately per account.</p><form id="prefs-login" autocomplete="off"><label class="field-label">Test email<input name="email" type="email" autocomplete="username" required></label><label class="field-label">Test password<input name="password" type="password" autocomplete="off" required></label><button type="submit" class="btn btn-primary" ${busy?'disabled':''}>Sign in</button></form>`;
  const sourceControls=INTEGRATION_SOURCES.map(key=>`<label class="settings-choice"><input type="checkbox" name="source_${key}" ${view.sources[key]?'checked':''}> Show ${e(SOURCE_LABELS[key])} records in the Daily Brief</label>`).join('');
  const suggestionControls=['email','school','household'].map(key=>`<label class="settings-choice"><input type="checkbox" name="suggest_${key}" ${view.suggestions[key]?'checked':''}> Prepare ${e(SOURCE_LABELS[key])} task suggestions for my approval</label>`).join('');
  const contents=!user?login:`<div class="auth-user"><p class="tiny muted">Signed in: ${e(user.email||'Development test account')} · Private fictional settings</p><button type="button" class="btn btn-small" id="prefs-logout">Sign out</button></div>
    ${duplicates?'<p class="warning">Multiple legacy settings records were found. The most recently updated was loaded. This QA schema does not yet enforce a unique owner preference record.</p>':''}
    <form id="prefs-form"><fieldset class="cc-preferences-fields" ${busy?'disabled':''}><section class="panel"><h2>Appearance</h2><label class="field-label">Visual preset<select name="palette" id="saved-palette">${QA_PALETTES.map(x=>`<option value="${e(x)}" ${view.palette===x?'selected':''}>${e(paletteNames[x])}</option>`).join('')}</select></label><label class="field-label">Daily Brief density<select name="density"><option value="balanced" ${view.density==='balanced'?'selected':''}>Balanced</option><option value="compact" ${view.density==='compact'?'selected':''}>Compact</option><option value="spacious" ${view.density==='spacious'?'selected':''}>Spacious</option></select></label><label class="settings-choice"><input name="hideAmounts" type="checkbox" ${view.hideAmounts?'checked':''}> Hide fictional financial amounts</label></section>
    <section class="panel"><h2>Sources shown in your Daily Brief</h2><p class="tiny muted">These are visibility filters, not permissions to access, share, download, or delete provider data. Provider access is managed separately; these display settings do not grant access.</p>${sourceControls}</section>
    <section class="panel"><h2>AI Concierge · Smart Independence (QA)</h2><p class="tiny muted">Automatic means prepare and rank suggestions only. Every record change and external action still requires explicit approval. Ask presents each suggestion for review. Disabled suppresses suggestions. Mandatory approval rules stay in force in every mode.</p><label class="field-label">Suggestion mode<select name="automationMode"><option value="automatic" ${view.automationMode==='automatic'?'selected':''}>Automatic · prepare suggestions only</option><option value="ask" ${view.automationMode==='ask'?'selected':''}>Ask · review each suggestion</option><option value="disabled" ${view.automationMode==='disabled'?'selected':''}>Disabled · hide suggestions</option></select></label>${suggestionControls}</section>
    <section class="panel"><h2>Quiet hours · preference preview only</h2><p class="tiny muted">Saved for future notification testing. This build does not send notifications or run scheduled background work.</p><label class="settings-choice"><input name="quietEnabled" type="checkbox" ${view.quietHours.enabled?'checked':''}> Enable quiet hours when notifications are implemented</label><div class="brief-fields"><label class="field-label">From<input type="time" name="quietStart" value="${e(view.quietHours.start)}"></label><label class="field-label">Until<input type="time" name="quietEnd" value="${e(view.quietHours.end)}"></label></div></section>
    <button type="submit" class="btn btn-primary" ${busy||needsReview?'disabled':''}>${busy?'Saving…':'Save my test preferences'}</button> <a class="btn" href="/dev-dashboard.html">Back to Daily Brief</a></fieldset>${needsReview?'<p class="warning">Your draft is kept. Load the latest saved preferences before saving again.</p><button type="button" class="btn" id="prefs-reload-latest">Discard draft and load latest</button>':''}</form>
    <p class="tiny muted">Cross-device preferences are loaded in the connected Daily Brief and this settings page. Other tester pages still have an independent palette-preview control. Preference records are not server-side authorization, nor are they a production-grade account settings service.</p>`;
  root.innerHTML=renderConnectedShell(`<section class="connected-card"><p class="eyebrow">CURATED CHAOS · MILESTONE 1F</p><h1>Daily Brief Settings</h1><p class="muted">Personalization, display filters and fictional suggestion preferences</p>${msg()}${contents}</section>`,{active:'settings'});
}
async function load(){
  const n=++generation;busy=true;render();
  try{const owner=user;const token=await auth.getAccessToken();if(n!==generation)return;const rows=await api.listBriefPreferences(token,owner.id);if(n!==generation)return;
    const loaded=readOwnerBriefPreferences(rows,owner.id);needsReview=false;settings=loaded.preferences;record=loaded.record;duplicates=loaded.duplicateCount;
    applyLook();window.__ccNavigationPrefs=settings.navigation;error='';notice=record?'Saved preferences loaded from your private development account.':'No saved preferences yet. Secure defaults are shown.';
  }catch(err){if(n!==generation)return;needsReview=true;error=err.message;notice='';}
  finally{if(n===generation){busy=false;render();}}
}
root.addEventListener('submit',async ev=>{
  if(ev.target.id==='prefs-login'){
    ev.preventDefault();if(busy)return;const v=new FormData(ev.target);busy=true;render();
    preferencesDraft=null;needsReview=false;const loginGeneration=++generation;let activeGeneration=loginGeneration;
    try{const signed=await auth.signIn(String(v.get('email')||'').trim(),String(v.get('password')||''));if(loginGeneration!==generation)return;user=signed.user;const pendingLoad=load();activeGeneration=generation;await pendingLoad;}
    catch(err){if(activeGeneration!==generation)return;user=null;resetLook();error=err.message;notice='';}finally{if(activeGeneration===generation){busy=false;render();}}return;
  }
  if(ev.target.id!=='prefs-form')return;
  ev.preventDefault();if(busy||!user||needsReview)return;
  const v=new FormData(ev.target),raw={palette:String(v.get('palette')||''),density:String(v.get('density')||''),hideAmounts:v.has('hideAmounts'),automationMode:String(v.get('automationMode')||'ask'),
    sources:Object.fromEntries(INTEGRATION_SOURCES.map(k=>[k,v.has('source_'+k)])),
    suggestions:Object.fromEntries(['email','school','household'].map(k=>[k,v.has('suggest_'+k)])),
    navigation:(preferencesDraft||settings).navigation,
    quietHours:{enabled:v.has('quietEnabled'),start:String(v.get('quietStart')||''),end:String(v.get('quietEnd')||'')}};
  const owner=user,draft=makeBriefPreferencesRecord(raw,owner.id);preferencesDraft=normalizeBriefPreferences(raw);const n=++generation;let saveConfirmed=false,writeAttempted=false;busy=true;render();
  try{const token=await auth.getAccessToken();if(n!==generation)return;const fresh=readOwnerBriefPreferences(await api.listBriefPreferences(token,owner.id),owner.id);
    if(n!==generation)return;
    if(fresh.record && record && (fresh.record.id!==record.id||fresh.record.version!==record.version)){
      settings=fresh.preferences;record=fresh.record;duplicates=fresh.duplicateCount;needsReview=true;applyLook();throw Error('Preferences changed in another tab or device. Your draft is kept; load the latest settings before saving.');
    }
    if(fresh.record&&!record){settings=fresh.preferences;record=fresh.record;needsReview=true;applyLook();throw Error('Settings were created elsewhere. Your draft is kept; load the latest settings before saving.');}
    if(!fresh.record&&record){needsReview=true;throw Error('Saved preferences were removed elsewhere. Your draft is kept; load the latest settings before saving.');}
    writeAttempted=true;const result=record
      ?await api.updateBriefPreferences(token,record,owner.id,draft.payload)
      :await api.addBriefPreferences(token,draft);
    if(n!==generation)return;
    const acknowledged=Array.isArray(result)&&result.length===1?readOwnerBriefPreferences(result,owner.id).record:null;
    if(!acknowledged||record&&(acknowledged.id!==record.id||acknowledged.version<=record.version)||JSON.stringify(normalizeBriefPreferences(acknowledged.payload))!==JSON.stringify(normalizeBriefPreferences(draft.payload))){throw Error('Preference save not confirmed. Refresh and check before trying again.');}
    saveConfirmed=true;const saved=readOwnerBriefPreferences(await api.listBriefPreferences(token,owner.id),owner.id);if(n!==generation)return;if(!saved.record||saved.record.id!==acknowledged.id||saved.record.version<acknowledged.version||JSON.stringify(saved.preferences)!==JSON.stringify(normalizeBriefPreferences(draft.payload))){needsReview=true;throw Error('Save was acknowledged, but the latest saved settings differ. Load them before editing again.');}
    preferencesDraft=null;needsReview=false;
    settings=saved.preferences;record=saved.record;duplicates=saved.duplicateCount;applyLook();window.__ccNavigationPrefs=settings.navigation;notice='Your private Daily Brief preferences were saved. Open the Daily Brief to verify.';error='';
  }catch(err){if(n!==generation)return;error=err.message;notice=saveConfirmed?'Save was acknowledged, but the latest view could not be confirmed. Your draft is kept.':'';if(writeAttempted)needsReview=true;}
  finally{if(n===generation){busy=false;render();}}
});
root.addEventListener('change',ev=>{if(ev.target.id==='saved-palette')document.body.dataset.theme=ev.target.value;});
root.addEventListener('click',async ev=>{if(ev.target.closest('#prefs-reload-latest')){if(busy||!user)return;preferencesDraft=null;needsReview=true;await load();return;}if(!ev.target.closest('#prefs-logout'))return;
  ++generation;busy=false;preferencesDraft=null;needsReview=false;user=null;record=null;duplicates=0;settings=normalizeBriefPreferences();resetLook();window.__ccNavigationPrefs=null;error='';notice='Signed out. Local preview reset.';render();await auth.signOut();});
(async()=>{try{const response=await fetch('/dev-config.json',{cache:'no-store'});if(!response.ok)throw Error('Development configuration unavailable.');
  config=await response.json();api=createDevApi(config);auth=createDevSessionManager(api,config.projectRef,sessionStorage);
  const restored=await auth.restore();if(restored){user=restored.user;await load();}else render();
}catch(err){root.innerHTML=`<p class="warning">${e(err.message)}</p>`;}})();
