// Milestone 2B: responsive workspace and owner-private customizable fictional dashboard layouts.
import {createDevApi} from './dev-api.mjs';
import {createDevSessionManager} from './dev-session.mjs';
import {renderConnectedShell} from './dev-cloud-shell.mjs';
import {safeWorkspacePage} from './dev-navigation-model.mjs';
import {workspaceCards,workspaceHeading} from './dev-workspace-model.mjs';
import {normalizeCloudRecords} from './dev-brief-model.mjs';
import {normalizeOrganizerRows} from './dev-organize-model.mjs';
import {normalizeFictionalLife} from './dev-life-model.mjs';
import {normalizeFictionalEmails} from './dev-email-model.mjs';
import {readOwnerBriefPreferences} from './dev-preferences-model.mjs';
import {DASHBOARD_DEVICES,defaultWidgetLayouts,readOwnerWidgetLayout,makeWidgetLayoutRecord,renderWidgetBoard,editWidgetLayouts,moveWidgetBetween} from './dev-widget-layout-model.mjs';
import {escapeHtml as e} from './core.mjs';
const root=document.getElementById('connected-workspace');
const page=safeWorkspacePage(new URLSearchParams(location.search).get('page'));
let config,api,auth,user=null,loading=false,error='',snapshot=null,lastChecked=0,requestGeneration=0;
let hideAmounts=true;
let layouts=defaultWidgetLayouts(),layoutRecord=null,duplicateLayouts=0,layoutEdit=false,layoutDirty=false,layoutBusy=false,layoutMessage='',dragWidget='';
const currentDevice=()=>typeof window==='undefined'?'desktop':window.innerWidth<680?'phone':window.innerWidth<1020?'tablet':'desktop';
let device=currentDevice(),manualDevice=false;
const bodyTitle=workspaceHeading(page);
function notice(){return error?`<p class="warning" role="alert">${e(error)}</p>`:'';}
function show(){
  const state=loading?'Loading private fictional data…':user?`${e(user.email||'Test account')} · ${lastChecked?'Last checked '+new Date(lastChecked).toLocaleTimeString():'not yet checked'}`:'Sign in to view your fictional cloud records';
  let content=`<section class="cc-work-header"><p class="eyebrow">YOUR SPACE · MILESTONE 2B</p><h1>${e(bodyTitle.title)}</h1><p class="cc-work-deck">${e(bodyTitle.description)}</p><div class="cc-work-badges"><span class="pill">Customizable workspace</span><span class="pill">${page==='curation'?'Widget studio · M2B':'Full features in '+e(bodyTitle.next)}</span><span class="pill">Fictional data only</span></div></section>${notice()}`;
  if(!user){
    content+=`<section class="cc-work-card cc-work-auth"><h2>Connect your development test account</h2><p class="muted">Sign in with Test Account A or B to see your already saved private fictional records. Your credentials stay in the existing temporary in-tab QA session.</p><form id="workspace-login"><label class="field-label">Test account email<input type="email" name="email" autocomplete="username" required></label><label class="field-label">Test password<input type="password" name="password" autocomplete="current-password" required></label><button class="btn btn-primary" type="submit" ${loading?'disabled':''}>Sign in to test workspace</button></form><p class="tiny muted">No real banking, email or WGU integrations are connected. Do not enter sensitive or real records.</p></section>`;
  }else{
    content+=`<div class="cc-work-status"><div><strong>${loading?'Checking cloud…':'Signed in to private test workspace'}</strong><small>${state}</small></div><div class="cc-work-actions"><button class="btn btn-small" id="workspace-refresh" ${loading?'disabled':''}>Fetch latest</button><button class="btn btn-small" id="workspace-signout" ${loading?'disabled':''}>Sign out</button></div></div>`;
    if(snapshot){content+=(page==='curation'?`${layoutMessage?`<p role="status" class="notice">${e(layoutMessage)}</p>`:''}${renderWidgetBoard(layouts,device,snapshot,{editing:layoutEdit,dirty:layoutDirty,loading:layoutBusy,duplicateCount:duplicateLayouts,hideAmounts})}`:workspaceCards(page,snapshot));}
    else content+=`<p class="warning">${loading?'Retrieving saved fictional records…':'No verified cloud snapshot is available. Use Fetch latest to try again.'}</p>`;
  }
  if(page!=='more'&&page!=='curation')content+=`<section class="cc-work-next"><h2>Coming in ${e(bodyTitle.next)}</h2><p>This page is the navigation foundation for the ${e(bodyTitle.title)} workspace. The full management tools, widgets, and any integrations for this area are not yet built. Current links lead only to your tested Milestone 1 QA pages.</p></section>`;
  root.innerHTML=renderConnectedShell(`<div class="cc-workspace-page">${content}</div>`,{active:'workspace',workspace:page});
}
async function load(){
  if(!user||!auth||!api)return;
  const seq=++requestGeneration,viewer=user.id; loading=true;error='';show();
  try{
    const token=await auth.getAccessToken();
    const [raw,lifeRows,emailRows,prefs,widgetRows,organization]=await Promise.all([api.listBriefRecords(token),api.listFictionalLife(token),api.listFictionalEmails(token),api.listBriefPreferences(token,viewer),page==='curation'?api.listWidgetLayouts(token,viewer):Promise.resolve([]),api.listOrganization(token,viewer)]);
    if(seq!==requestGeneration||user?.id!==viewer)return;
    const base=normalizeCloudRecords(raw,viewer);
    snapshot={...base,life:normalizeFictionalLife(lifeRows,viewer),emails:normalizeFictionalEmails(emailRows,viewer),projects:normalizeOrganizerRows(organization,viewer).projects};
    if(page==='curation'){const saved=readOwnerWidgetLayout(widgetRows,viewer);if(!layoutDirty){layouts=saved.layouts;layoutRecord=saved.record;duplicateLayouts=saved.duplicateCount;}else if((saved.record?.id||null)!==(layoutRecord?.id||null)||(saved.record?.version||null)!==(layoutRecord?.version||null)){layoutMessage='A layout changed in another tab. Your draft is still visible, but please discard it and reload the latest layout before saving.';}}
    const p=readOwnerBriefPreferences(prefs,viewer).preferences;
    hideAmounts=p.hideAmounts;
    document.body.dataset.theme=p.palette;
    document.body.dataset.density=p.density;
    lastChecked=Date.now();
  }catch(err){
    if(seq!==requestGeneration)return;
    snapshot=null;lastChecked=0;
    error='Could not verify your fictional cloud data. No saved information was changed. '+String(err?.message||'Connection error').slice(0,200);
  }finally{if(seq===requestGeneration){loading=false;show();}}
}
root.addEventListener('submit',event=>{
  if(event.target?.id!=='workspace-login')return;
  event.preventDefault();if(loading)return;
  const data=new FormData(event.target);
  const email=String(data.get('email')||'').trim(),password=String(data.get('password')||'');
  if(!email||!password)return;
  loading=true;error='';show();
  void (async()=>{
    try{const signed=await auth.signIn(email,password);++requestGeneration;user=signed.user;layouts=defaultWidgetLayouts();layoutRecord=null;layoutDirty=false;layoutMessage='';await load();}
    catch(err){user=null;snapshot=null;lastChecked=0;error=String(err?.message||'Sign-in failed').slice(0,220);}
    finally{loading=false;show();}
  })();
});
root.addEventListener('click',event=>{
  if(event.target.closest('#workspace-refresh')){if(!loading&&user)void load();return;}
  if(event.target.closest('#workspace-signout')){
    if(loading||!user)return;
    // Wipe the UI immediately so pending requests cannot paint the previous account's records.
    ++requestGeneration;const old=auth;user=null;snapshot=null;lastChecked=0;error='';loading=false;layouts=defaultWidgetLayouts();layoutRecord=null;layoutDirty=false;layoutEdit=false;layoutMessage='';hideAmounts=true;show();
    void old.signOut();
  }
});

// Widget edits change only the in-memory dashboard draft. The cloud is untouched until Save layout.
function changeLayout(action,id,arg){
  if(!user||!snapshot||loading||layoutBusy)return;
  try{
    const newId='w-'+crypto.randomUUID();
    layouts=editWidgetLayouts(layouts,device,action,id,arg,newId);
    layoutDirty=true;layoutMessage='Unsaved widget layout changes.';show();
  }catch(err){layoutMessage=String(err?.message||'Widget edit failed.');show();}
}
async function saveLayout(){
  if(!user||!snapshot||!layoutDirty||loading||layoutBusy)return;
  const viewer=user.id,seq=requestGeneration,draft=makeWidgetLayoutRecord(layouts,viewer);
  layoutBusy=true;layoutMessage='';show();
  try{
    const token=await auth.getAccessToken();
    const fresh=readOwnerWidgetLayout(await api.listWidgetLayouts(token,viewer),viewer);
    if(seq!==requestGeneration||user?.id!==viewer)return;
    if((fresh.record?.id||null)!==(layoutRecord?.id||null)||(fresh.record?.version||null)!==(layoutRecord?.version||null)){
      throw Error('Layout was changed in another tab. Your draft was not overwritten. Use Discard draft / Fetch latest and try again.');
    }
    const result=layoutRecord
      ?await api.updateWidgetLayout(token,layoutRecord,viewer,draft.payload)
      :await api.addWidgetLayout(token,draft);
    if(seq!==requestGeneration||user?.id!==viewer)return;
    if(!Array.isArray(result)||result.length!==1)throw Error('Save was not confirmed. Do not click Save again until you Fetch latest.');
    const saved=readOwnerWidgetLayout(await api.listWidgetLayouts(token,viewer),viewer);
    if(seq!==requestGeneration||user?.id!==viewer)return;
    layouts=saved.layouts;layoutRecord=saved.record;duplicateLayouts=saved.duplicateCount;layoutDirty=false;
    layoutMessage='Your private dashboard layout was saved to your development cloud account.';
  }catch(err){if(seq===requestGeneration&&user?.id===viewer)layoutMessage=String(err?.message||'Could not save layout.').slice(0,280);}
  finally{if(seq===requestGeneration&&user?.id===viewer){layoutBusy=false;show();}}
}
root.addEventListener('click',event=>{
  if(page!=='curation'||!user||!snapshot)return;
  const deviceButton=event.target.closest('[data-layout-device]');
  if(deviceButton){const next=deviceButton.dataset.layoutDevice;if(DASHBOARD_DEVICES.includes(next)){device=next;manualDevice=true;show();}return;}
  if(event.target.closest('#widgets-edit')){layoutEdit=!layoutEdit;show();return;}
  if(event.target.closest('#widgets-save')){void saveLayout();return;}
  if(event.target.closest('#widgets-discard')){if(!layoutBusy){layoutDirty=false;layoutMessage='Draft discarded; fetching saved layout.';void load();}return;}
  if(!layoutEdit||layoutBusy)return;
  const add=event.target.closest('[data-widget-add]');if(add){changeLayout('add','',add.dataset.widgetAdd);return;}
  const act=event.target.closest('[data-widget-action]');if(act){changeLayout(act.dataset.widgetAction,act.dataset.widgetId);}
});
root.addEventListener('change',event=>{
  if(page!=='curation'||!layoutEdit||!user||!snapshot||layoutBusy)return;
  const size=event.target.closest('[data-widget-size]');if(size){changeLayout('size',size.dataset.widgetSize,size.value);return;}
  const filter=event.target.closest('[data-widget-filter]');if(filter){changeLayout('filter',filter.dataset.widgetFilter,filter.value);return;}
  const limit=event.target.closest('[data-widget-limit]');if(limit){changeLayout('limit',limit.dataset.widgetLimit,limit.value);return;}
  const title=event.target.closest('[data-widget-title]');if(title){changeLayout('title',title.dataset.widgetTitle,title.value);}
});
root.addEventListener('dragstart',event=>{
  const card=event.target.closest('[data-widget-card]');if(!layoutEdit||layoutBusy||!card)return;
  dragWidget=card.dataset.widgetCard;event.dataTransfer?.setData('text/plain',dragWidget);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
});
root.addEventListener('dragover',event=>{if(layoutEdit&&dragWidget&&event.target.closest('[data-widget-card]'))event.preventDefault();});
root.addEventListener('drop',event=>{
  if(!layoutEdit||layoutBusy||!dragWidget)return;
  const target=event.target.closest('[data-widget-card]');event.preventDefault();
  if(target&&target.dataset.widgetCard!==dragWidget){layouts=moveWidgetBetween(layouts,device,dragWidget,target.dataset.widgetCard);layoutDirty=true;layoutMessage='Unsaved widget order.';show();}
  dragWidget='';
});
root.addEventListener('dragend',()=>{dragWidget='';});
window.addEventListener('resize',()=>{
  if(page!=='curation'||manualDevice)return;
  const detected=currentDevice();if(detected!==device){device=detected;show();}
});
(async()=>{
  try{
    const response=await fetch('/dev-config.json',{cache:'no-store'});
    if(!response.ok)throw Error('Development configuration unavailable. Check .env.local.');
    config=await response.json();api=createDevApi(config);auth=createDevSessionManager(api,config.projectRef,sessionStorage);
    const signed=await auth.restore();user=signed?.user||null;
    if(user)await load();else show();
  }catch(err){error=String(err?.message||'Setup error').slice(0,220);show();}
})();
