import { agendaForWeek } from './dev-agenda-model.mjs';
import { LIFE_SOURCES, LIFE_NAMES, normalizeFictionalLife, lifeSummary, lifeSuggestions } from './dev-life-model.mjs';
import { normalizeFictionalEmails, emailSuggestions } from './dev-email-model.mjs';
import {reviewAutomationSuggestion} from './private-automation-policy.mjs';
import { createDevApi } from './dev-api.mjs';
import { createDevSessionManager } from './dev-session.mjs';
import { renderConnectedShell, renderDevelopmentConnectionsLink } from './dev-cloud-shell.mjs';
import { escapeHtml as e, formatDate, dayString } from './core.mjs';
import { TASK_SECTIONS, makeFictionalTask, normalizeCloudRecords, briefForDate, toggledTaskPayload } from './dev-brief-model.mjs';
import { INTEGRATION_SOURCES, SOURCE_LABELS, isDuplicateTask, validateSuggestedTask, makeSuggestionDismissal } from './dev-intelligence-model.mjs';
import { makeApprovalDecision, makeRestoreDecision, getDecisionState, decisionPreventsApproval } from './dev-decision-model.mjs';
import { normalizeBriefPreferences, readOwnerBriefPreferences, maySuggest } from './dev-preferences-model.mjs';
import { cloudFreshness, safeSnapshotAge, verifiedSnapshotCounts } from './dev-sync-model.mjs';

const root=document.getElementById('connected-brief');
const insideDashboard=document.body.dataset.connectedShell==='true';
let api=null,config=null,auth=null,session=null,user=null,records={tasks:[],notes:[],events:[]},emails=[],life=[],decisionRows=[],decisionState={latest:new Map(),approved:new Set(),dismissed:new Set(),history:[]},busy=false,notice='',error='',generation=0;
let preferences=normalizeBriefPreferences(),selections={...preferences.sources},hideAmounts=preferences.hideAmounts,reviewId=null,reviewDraft=null;
const emptyTaskDraft=()=>({title:'',day:dayString(),section:'Home'});
let taskDraft=emptyTaskDraft();
let lastSuccessAt=0,lastAttemptAt=0,refreshFailed=false,simulateOutage=false;
const offline=()=>simulateOutage||(typeof navigator!=='undefined'&&navigator.onLine===false);
const syncState=()=>cloudFreshness({lastSuccessAt,loading:busy,offline:offline(),failed:refreshFailed});
const canWrite=()=>syncState().allowWrite;
const blank=()=>{taskDraft=emptyTaskDraft();session=null;user=null;preferences=normalizeBriefPreferences();selections={...preferences.sources};hideAmounts=true;document.body.dataset.theme='neutral';document.body.dataset.density='balanced';try{sessionStorage.removeItem('cc-m1c-preview-palette');}catch{}records={tasks:[],notes:[],events:[]};emails=[];life=[];decisionRows=[];decisionState={latest:new Map(),approved:new Set(),dismissed:new Set(),history:[]};reviewId=null;reviewDraft=null;lastSuccessAt=0;lastAttemptAt=0;refreshFailed=false;simulateOutage=false;generation++;};
const lostSession=(err)=>{if(auth?.get())return false;blank();busy=false;error=err?.message||'Please sign in again.';notice='';render();return true;};
const active=()=>{
  if(!auth?.get()){blank();error='Please sign in to your development account.';render();return false;}
  return true;
};
const syncWarning=()=>{const status=syncState();return status.allowWrite?'':`Cloud updates are not verified (${status.state}). Saving or approving is temporarily disabled. Use Fetch latest after the connection recovers.`;};
const alertUi=()=>`${error?`<p class="warning" role="alert">${e(error)}</p>`:''}${notice?`<div class="notice" role="status">${e(notice)}</div>`:''}`;
function renderSyncPanel(){
  const status=syncState();const counts=verifiedSnapshotCounts({records,emails,life,decisions:decisionRows});
  const time=lastSuccessAt?new Date(lastSuccessAt).toLocaleString():'Never';
  return `<section class="panel" aria-label="Cloud freshness and recovery"><div class="panel-head"><h2>Cloud freshness &amp; recovery · QA</h2><span class="pill">${e(status.state.toUpperCase())}</span></div>
    <p role="status"><strong>${e(status.readable)}</strong></p><p class="tiny muted">Last successful complete check: <strong>${e(time)}</strong> · ${e(safeSnapshotAge(lastSuccessAt))}. Checked source: isolated Supabase test project, not Google Calendar, Gmail, banking, or WGU.</p>
    <p class="tiny muted">Last confirmed fictional records: ${counts.tasks} task(s), ${counts.events} event(s), ${counts.email} email(s), ${counts.life} life record(s), ${counts.decisions} decision(s).</p>
    ${status.allowWrite?'':`<p class="warning" role="alert">${e(syncWarning())}</p>`}
    <div class="dialog-actions"><button type="button" class="btn btn-small" id="brief-reload" ${busy||offline()?'disabled':''}>Fetch latest cloud records</button>
    <button type="button" class="btn btn-small" id="brief-simulate-offline" ${busy?'disabled':''}>${simulateOutage?'Restore simulated connection':'Simulate cloud outage'}</button></div>
    <p class="tiny muted">The outage switch is local to this test tab and does not disconnect the real database. During an outage, the last confirmed snapshot stays visible but is explicitly marked unverified. Writes are blocked; nothing is queued or silently replayed. Reconnect and fetch latest to verify again. Another device's changes become visible after Fetch latest or returning to this tab. Auto-check runs approximately every two minutes while this tab is visible.</p></section>`;
}
const chrome=(inner)=>{
  const body=`<section class="${insideDashboard?'connected-card':'auth-card connected-card'}"><p class="eyebrow">CURATED CHAOS · MILESTONE 1G</p><h1>A Glimpse of Your Day</h1><p class="muted">Private cloud tasks, events and fictional email, school, bill and household samples; no live integrations</p><p class="tiny muted">Supabase project: <strong>${e(config?.projectRef||'Not connected')}</strong></p>${alertUi()}${renderDevelopmentConnectionsLink(typeof location==='undefined'?'':location.href)}${inner}<p class="tiny muted">${insideDashboard?'Other pages in the sidebar are local fictional demos, not linked to your cloud account.':'Other pages: <a href="/dev-dashboard.html">Connected Daily Brief in the app layout</a> · <a href="/">Local fictional dashboard</a> · <a href="/dev-auth.html">Previous notes tester</a>.'} Session memory is limited to this browser tab.</p></section>`;
  return insideDashboard?renderConnectedShell(body):body;
};
const renderTask=(r)=>`<li class="item"><button type="button" class="tick ${r.payload.done?'done':''}" data-toggle="${e(r.id)}" aria-label="${r.payload.done?'Mark incomplete':'Complete'} fictional task ${e(r.payload.title)}" ${busy||!canWrite()?'disabled':''}>${r.payload.done?'✓':''}</button><div class="item-main"><strong class="${r.payload.done?'completed':''}">${e(r.payload.title)}</strong><small>${e(r.section)} · ${e(formatDate(r.payload.day))} · Private cloud</small></div></li>`;
function renderLifePanel(source,today){
  const items=lifeSummary(life,source,today);
  const rows=items.length?`<ul class="item-list">${items.map(r=>{
    const p=r.payload;const amount=source==='finances'?`<small class="sample-money">${hideAmounts?'Amount hidden':'$'+p.amount.toFixed(2)} · fictional, not a bank balance</small>`:'';
    return `<li class="item"><div class="item-main"><strong>${e(p.title)}</strong><small>${e(formatDate(p.day))} · ${e(p.kind)} · Private fictional cloud record</small><small>${e(p.detail)}</small>${amount}</div></li>`;
  }).join('')}</ul>`:`<p class="empty">No saved fictional ${e(LIFE_NAMES[source].toLowerCase())} records for this date window. <a href="/dev-life.html">Add a prepared sample →</a></p>`;
  return panel(`${LIFE_NAMES[source]} · saved fictional records`,rows,'<span class="pill gold">SAMPLE ONLY</span>');
}
function renderReviewModal(fixtures){
  if(!reviewId)return '';
  const suggestion=fixtures.suggestions.find(s=>s.id===reviewId);
  if(!suggestion)return '';
  const draft=reviewDraft?.suggestionId===suggestion.id?reviewDraft:suggestion;
  const changed=reviewDraft?.sourceSnapshot!==JSON.stringify(suggestion);
  const blocked=!canWrite()||changed;
  const dup=decisionState.approved.has(suggestion.id)||decisionState.dismissed.has(suggestion.id)||isDuplicateTask(records.tasks,suggestion);
  return `<div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="sample-review-title"><div class="dialog-top"><h2 id="sample-review-title">Review a fictional suggestion</h2><button type="button" class="btn" id="sample-cancel">Close</button></div><p class="muted">${e(suggestion.reason)}</p><p class="tiny muted">Source: ${e(SOURCE_LABELS[suggestion.source])}${suggestion.emailId?` · <a href="/dev-email.html#email-${e(suggestion.emailId)}">View saved source email</a>`:suggestion.recordId?` · <a href="/dev-life.html">View saved fictional source record</a>`:""} · SAMPLE ONLY. This creates a PRIVATE CLOUD TASK only after you click Approve. It never changes a calendar, email account, or bank.</p><form id="sample-approve"><input type="hidden" name="suggestionId" value="${e(suggestion.id)}"><label class="field-label">Task title<input name="title" maxlength="140" required value="${e(draft.title)}"></label><div class="brief-fields"><label class="field-label">Due date<input name="day" type="date" required value="${e(draft.day)}"></label><label class="field-label">Section<select name="section">${TASK_SECTIONS.map(x=>`<option value="${e(x)}" ${x===draft.section?'selected':''}>${e(x)}</option>`).join('')}</select></label></div>${dup?'<p class="warning">An identical fictional task already exists; duplicate creation is blocked.</p>':''}${changed?'<p class="warning">The source changed after this review opened. Close and reopen it before approving; your edits are retained until then.</p>':''}${blocked?'<p class="warning">Cloud data must be verified before approving. Fetch latest after reconnecting.</p>':''}<div class="dialog-actions"><button type="button" class="btn" id="sample-dismiss-review">Dismiss suggestion</button><button type="submit" class="btn btn-primary" ${busy||dup||blocked?'disabled':''}>Approve & save private task</button></div></form></section></div>`;
}
// In M1E, only saved fictional source records generate suggestions.
// Old, unsaved sample fixture suggestions are intentionally excluded.
function allSuggestions(){return [...lifeSuggestions(life),...emailSuggestions(emails)];}
function renderIntelligence(today){
  const open=records.tasks.filter(r=>!r.payload.done&&r.payload.day<=today).length;
  const upcoming=records.tasks.filter(r=>!r.payload.done&&r.payload.day>today).length;
  const suggestions=allSuggestions().map((suggestion,index)=>({suggestion,index,policy:reviewAutomationSuggestion({...suggestion,confidence:Number.isFinite(suggestion.confidence)?suggestion.confidence:0.5,uncertainty:suggestion.uncertainty||'Confirm the source meaning and proposed task details.'},{mode:preferences.automationMode})})).filter(({suggestion,policy})=>policy.visible&&maySuggest(suggestion,preferences)&&!decisionState.dismissed.has(suggestion.id)&&!decisionState.approved.has(suggestion.id)&&!isDuplicateTask(records.tasks,suggestion)).sort((a,b)=>b.policy.confidence-a.policy.confidence||a.index-b.index).map(({suggestion})=>suggestion);
  const sourceControls=INTEGRATION_SOURCES.filter(s=>selections[s]).map(s=>e(SOURCE_LABELS[s])).join(', ')||'None';
  const pending=suggestions.length?`<ul class="item-list">${suggestions.map(s=>`<li class="item"><div class="item-main"><strong>${e(s.title)}</strong><small>${e(SOURCE_LABELS[s.source])} · ${e(formatDate(s.day))} · Saved fictional source</small><small>${e(s.reason)} · explicit approval required</small>${s.emailId?`<small><a href="/dev-email.html#email-${e(s.emailId)}">View source fictional email</a></small>`:s.recordId?`<small><a href="/dev-life.html">View fictional source record</a></small>`:''}</div><button class="btn btn-small" data-review="${e(s.id)}" ${busy||!canWrite()?'disabled':''}>Review</button><button class="btn btn-small" data-dismiss="${e(s.id)}" ${busy||!canWrite()?'disabled':''}>Dismiss</button></li>`).join('')}</ul>`:'<p class="empty">No pending suggestions from saved fictional sources. Approved or dismissed items remain out of the queue.</p>';
  const modeCopy=preferences.automationMode==='automatic'?'Automatic · suggestions ranked by confidence; record changes still need approval.':preferences.automationMode==='disabled'?'Disabled · suggestions are hidden.':'Ask · review each suggestion before saving.';
  return `<section class="panel sample-banner"><div class="panel-head"><h2>Smart Independence · rules-based QA preview</h2><span class="pill gold">NO LIVE INTEGRATIONS</span></div>
    <p>Your private test account has <strong>${open} due/overdue task(s)</strong>, <strong>${upcoming} upcoming task(s)</strong>, <strong>${life.filter(r=>selections[r.item_type==='school_fixture'?'school':r.item_type==='bill_fixture'?'finances':'household']).length} saved fictional school, bill or household record(s)</strong>, and <strong>${selections.email?emails.length:0} fictional email(s)</strong>. The sections below show only source records actually saved in this account, not invented live events or real balances.</p>
    <p class="tiny muted">Sources displayed: <strong>${sourceControls}</strong>. Fictional financial amounts: <strong>${hideAmounts?'hidden':'shown'}</strong>. <a href="/dev-settings.html">Change saved settings →</a></p>
    <p class="tiny muted">Sources marked "cloud QA" are records you entered in the isolated development environment, not connections to the named provider. Financial amounts default to hidden. Source visibility and amount-display preferences are stored for this test account; they do not grant or revoke actual database/provider access.</p></section>
  <div class="two-columns sample-panels">${LIFE_SOURCES.filter(s=>selections[s]).map(s=>renderLifePanel(s,today)).join('')}</div>
  ${selections.email?panel('Email insights · fictional private inbox',emails.length?`<ul class="item-list">${emails.map(row=>`<li class="item"><div class="item-main"><strong>${e(row.payload.subject)}</strong><small>${e(row.payload.sender)} · Private cloud · SAMPLE ONLY</small><small>${e(row.payload.preview)}</small></div></li>`).join('')}</ul><p><a href="/dev-email.html">Open fictional email inbox →</a></p>`:'<p class="empty">No saved fictional emails yet. <a href="/dev-email.html">Add a prepared email sample →</a></p>'):''}
  ${panel('Pending Suggestions · review required',`<p class="tiny muted">${e(modeCopy)} Every create/edit/send/payment/import remains behind its explicit approval.</p>${pending}`,'<span class="pill gold">SAVED FICTIONAL SOURCE</span>')}
  <p class="tiny muted">Categorization and previews are automatic only for known fictional examples. Creating a task, sending an email, or changing a calendar or financial record is never automatic. Approved and dismissed decisions are recorded privately for this QA account. Restoring a dismissal is permitted; an approval cannot be undone here. This is not an immutable or transactional audit log. Existing tasks also suppress duplicates.</p>
  ${renderReviewModal({suggestions:allSuggestions()})}`;
}
function renderActivityHistory(){
  const suggestions=new Map(allSuggestions().map(s=>[s.id,s]));
  const legacy=records.tasks.filter(r=>r.payload?.fictional===true&&String(r.payload.source||'').startsWith('M1A_APPROVED_'))
    .filter(r=>!decisionState.approved.has(String(r.payload.source).slice('M1A_APPROVED_'.length)))
    .map(r=>({label:'Approved task · earlier milestone',description:r.payload.title,at:r.created_at||'',id:'',restore:false}));
  const entries=decisionState.history.map(r=>{
    const p=r.payload,s=suggestions.get(p.suggestion_id),current=decisionState.latest.get(p.suggestion_id);
    return {id:p.suggestion_id,label:p.status==='approved'?'Approved task':p.status==='dismissed'?'Dismissed suggestion':'Restored suggestion',
      description:p.status==='approved'?(p.task_title||s?.title||'Fictional task'):(s?.title||'Fictional suggestion'),at:r.created_at||'',
      restore:p.status==='dismissed'&&current===r};
  });
  const history=[...entries,...legacy].sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,12);
  const rows=history.length?`<ul class="item-list">${history.map(x=>`<li class="item"><div class="item-main"><strong>${e(x.label)}</strong><small>${e(x.description)} · ${e(x.at?new Date(x.at).toLocaleString():'Earlier test')} · private fictional QA</small></div>${x.restore?`<button class="btn btn-small" data-restore="${e(x.id)}" ${busy||!canWrite()?'disabled':''}>Restore suggestion</button>`:''}</li>`).join('')}</ul>`:'<p class="empty">No saved approvals or dismissals in this test account.</p>';
  return panel('Decision history · approvals & dismissals',rows,'<span class="pill">Not an immutable audit log</span>');
}
function render(){
  document.title='Connected Daily Brief QA · Curated Chaos';
  if(!api){root.innerHTML=chrome('<p>Load the development connection settings before signing in.</p>');return;}
  if(!session){root.innerHTML=chrome(`<h2>Sign in to view your private Daily Brief</h2><p class="muted">Use one of your two development test accounts. Never use your original app credentials here.</p><form id="brief-login" autocomplete="off"><label class="field-label">Test email<input name="email" type="email" autocomplete="username" required></label><label class="field-label">Test password<input name="password" type="password" autocomplete="off" required></label><button class="btn btn-primary" type="submit" ${busy?'disabled':''}>${busy?'Signing in…':'Sign in'}</button></form><p class="tiny muted">Your test session is remembered across refreshes in this browser tab, for up to 12 hours. Closing the tab or using another device may require a new sign-in.</p>`);return;}
  if(!lastSuccessAt){root.innerHTML=chrome(`<div class="auth-user"><p class="tiny muted">Signed in as ${e(user.email||'Test account')}</p><button type="button" class="btn btn-small" id="brief-logout">Sign out</button></div>${renderSyncPanel()}<p class="warning">No test data has been verified for this session yet. Nothing is displayed as current until a complete cloud fetch succeeds.</p>`);return;}
  const today=dayString(),b=briefForDate(records,today);
  const rows=(items,empty)=>items.length?`<ul class="item-list">${items.map(renderTask).join('')}</ul>`:`<p class="empty">${empty}</p>`;
  const noteRows=b.notes.length?`<ul class="item-list">${b.notes.map(n=>`<li class="item"><div class="item-main"><strong>${e(n.payload.title)}</strong><small>${e(n.payload.body||'Fictional note')} · Saved in private cloud</small></div></li>`).join('')}</ul>`:'<p class="empty">No private notes for this account yet. Notes from the prior sign-in test will appear here.</p>';
  root.innerHTML=chrome(`<div class="auth-user"><div><p class="tiny muted">Signed in as ${e(user.email||'Test account')}</p><p class="tiny muted">Account ID: ${e(user.id)}</p></div><button type="button" class="btn btn-small" id="brief-logout" ${busy?'disabled':''}>Sign out / Switch account</button></div>
    <section class="summary"><p class="eyebrow">YOUR CLOUD DAILY BRIEF · ${e(formatDate(today))}</p><p>${b.due.length?`You have ${b.due.length} fictional ${b.due.length===1?'task':'tasks'} due today or earlier.`:'No fictional tasks due today or earlier.'} ${b.upcoming.length?`${b.upcoming.length} upcoming.`:''} Private account data only.</p><p class="tiny"><a href="/dev-settings.html">Personalize this Daily Brief →</a></p><div class="status-row"><span class="pill gold">Dev QA only</span><span class="pill">Private Supabase records</span><span class="pill">0 live integrations · fictional sources only</span></div></section>
    ${renderSyncPanel()}
    <div class="metric-grid"><div class="metric"><span>Due / overdue</span><strong>${b.due.length}</strong></div><div class="metric"><span>Upcoming</span><strong>${b.upcoming.length}</strong></div><div class="metric"><span>Done today</span><strong>${b.doneToday.length}</strong></div><div class="metric"><span>Private notes</span><strong>${records.notes.length}</strong></div></div>
    ${panel('Your next seven days · private cloud',`<p class="tiny muted">Your own fictional calendar events and tasks saved to the isolated development database. No external calendar connection. Older events can be viewed using the start-date control in Seven-Day Agenda.</p><div class="week-strip">${agendaForWeek({...records,events:selections.calendar?records.events:[]},today).map(x=>`<div class="week-day"><strong>${e(formatDate(x.day))}</strong><small>${x.items.length} item(s)</small>${x.items.slice(0,3).map(i=>`<div class="week-mini">${i.kind==='event'?e(i.time)+' · ':''}${e(i.title)}${i.done?' ✓':''}</div>`).join('')}${x.items.length>3?`<small>+${x.items.length-3} more</small>`:''}</div>`).join('')}</div><p><a href="/dev-agenda.html">Open cloud seven-day agenda →</a></p>`)}
    ${renderIntelligence(today)}
    ${renderActivityHistory()}
    <section class="panel"><div class="panel-head"><h2>Quick Add · Private cloud task</h2><span class="pill gold">Fictional only</span></div><form id="brief-add-task"><label class="field-label">Task title<input name="title" maxlength="140" value="${e(taskDraft.title)}" required placeholder="Example: Review fictional study checklist"></label><div class="brief-fields"><label class="field-label">Due date<input name="day" type="date" value="${e(taskDraft.day)}" required></label><label class="field-label">Section<select name="section">${TASK_SECTIONS.map(s=>`<option value="${e(s)}" ${taskDraft.section===s?'selected':''}>${e(s)}</option>`).join('')}</select></label></div><button type="submit" class="btn btn-primary" ${busy||!canWrite()?'disabled':''}>Save fictional task to cloud</button></form></section>
    <div class="two-columns">${panel('Today & overdue',rows(b.due,'No open test tasks due.'))}${panel('Upcoming',rows(b.upcoming,'No upcoming test tasks.'))}${panel('Completed today',rows(b.doneToday,'No completed test tasks due today.'))}${panel('Your private cloud notes',noteRows)}</div>
    <p class="tiny muted"><a href="/dev-notes.html">Open and create private cloud notes →</a> · <a href="/dev-tasks.html">Manage all cloud tasks →</a></p><div class="two-columns" style="margin-top:16px">${panel('Integration status','<p class="muted">Email, school, finance and household samples are manually selected fictional cloud records, not actual provider data. Calendar and finance integrations remain unconnected.</p>')}${panel('Household status','<p class="muted">Fictional household items are PRIVATE to the test account; household sharing has not been enabled or tested.</p>')}</div>

    <p class="warning tiny">This is not the production app and is not approved for real financial, school, family or personal data. Temporary in-tab QA session persistence is enabled; production-strength sign-in and actual provider connections are not enabled.</p>`);
}
function panel(title,body,extra=''){return `<section class="panel"><div class="panel-head"><h2>${e(title)}</h2>${extra}</div>${body}</section>`;}
function message(msg,kind='notice'){error=kind==='error'?msg:'';notice=kind==='error'?'':msg;render();}
async function load(){
  if(!active())return;
  const n=++generation,viewer=user.id;
  lastAttemptAt=Date.now();
  if(offline()){busy=false;refreshFailed=true;error='Development cloud is unavailable (offline or simulated outage). Your last confirmed snapshot is shown without claiming it is current.';notice='';render();return false;}
  busy=true;render();
  try{
    const token=await auth.getAccessToken();if(n!==generation)return false;
    const [raw,decisions,emailRows,lifeRows,prefRows]=await Promise.all([api.listBriefRecords(token),api.listSuggestionDecisions(token,viewer),api.listFictionalEmails(token),api.listFictionalLife(token),api.listBriefPreferences(token,viewer)]);if(n!==generation)return false;
    const nextPreferences=readOwnerBriefPreferences(prefRows,viewer).preferences,nextRecords=normalizeCloudRecords(raw,viewer),nextEmails=normalizeFictionalEmails(emailRows,viewer),nextLife=normalizeFictionalLife(lifeRows,viewer),nextDecisions=Array.isArray(decisions)?decisions:[];
    const nextDecisionState=getDecisionState(nextDecisions,viewer,[...lifeSuggestions(nextLife),...emailSuggestions(nextEmails)]);
    preferences=nextPreferences;records=nextRecords;emails=nextEmails;life=nextLife;decisionRows=nextDecisions;decisionState=nextDecisionState;
    selections={...preferences.sources};hideAmounts=preferences.hideAmounts;document.body.dataset.theme=preferences.palette;document.body.dataset.density=preferences.density;try{sessionStorage.setItem('cc-m1c-preview-palette',preferences.palette);}catch{}
    lastSuccessAt=Date.now();refreshFailed=false;error='';notice='Private cloud tasks, notes, events, fictional emails, life records and suggestion decisions loaded for this test account.';return true;
  }
  catch(err){if(n!==generation)return false;if(lostSession(err))return false;refreshFailed=true;error=err.message+' Existing displayed records are a last-confirmed snapshot, not a current cloud view.';notice='';}
  finally{if(n===generation){busy=false;render();}}
}
root.addEventListener('input',ev=>{
  const form=ev.target.closest('form');if(form?.id==='brief-add-task'&&['title','day','section'].includes(ev.target.name))taskDraft={...taskDraft,[ev.target.name]:ev.target.value};
  if(form?.id==='sample-approve'&&reviewDraft&&['title','day','section'].includes(ev.target.name))reviewDraft={...reviewDraft,[ev.target.name]:ev.target.value};
});
root.addEventListener('change',ev=>{
  const form=ev.target.closest('form');if(form?.id==='brief-add-task'&&['title','day','section'].includes(ev.target.name))taskDraft={...taskDraft,[ev.target.name]:ev.target.value};
  if(form?.id==='sample-approve'&&reviewDraft&&['title','day','section'].includes(ev.target.name))reviewDraft={...reviewDraft,[ev.target.name]:ev.target.value};
});
root.addEventListener('submit',async ev=>{
  if(ev.target.id==='brief-login'){
    ev.preventDefault();if(busy)return;
    const values=new FormData(ev.target),email=String(values.get('email')||'').trim(),password=String(values.get('password')||'');
    if(!email||!password)return;
    busy=true;error='';render();
    try{
      const result=await auth.signIn(email,password);
      session=auth.get();user=result.user;
      await load();
    }catch(err){blank();message(err.message,'error');}
    finally{busy=false;render();}
  }
  if(ev.target.id==='sample-approve'){
    ev.preventDefault();if(busy||!active())return;if(!canWrite())return message(syncWarning(),'error');
    const formData=new FormData(ev.target),suggestion=allSuggestions().find(x=>x.id===String(formData.get('suggestionId')));
    if(!suggestion||suggestion.id!==reviewId||!maySuggest(suggestion,preferences))return message('That fictional suggestion is unavailable.','error');
    if(!reviewDraft||reviewDraft.sourceSnapshot!==JSON.stringify(suggestion))return message('The suggestion changed. Close and reopen the review before approving.','error');
    reviewDraft={...reviewDraft,title:String(formData.get('title')||''),day:String(formData.get('day')||''),section:String(formData.get('section')||'')};
    let draft;try{draft=validateSuggestedTask(suggestion,Object.fromEntries(formData.entries()));}catch(err){return message(err.message,'error');}
    if(decisionPreventsApproval(decisionState,suggestion.id)||isDuplicateTask(records.tasks,{...draft,id:suggestion.id})){reviewId=null;reviewDraft=null;return message('A matching or previously decided suggestion exists. Nothing new was saved.');}
    let data;try{data=makeFictionalTask(draft,user.id);data.payload.source='M1A_APPROVED_'+suggestion.id;}catch(err){return message(err.message,'error');}
    busy=true;render();const n=generation;
    try{
      const token=await auth.getAccessToken();if(n!==generation)return;
      if(config?.atomicFictionalApprovals===true){
        const receipt=await api.approveFictionalSuggestion(token,{sourceId:suggestion.emailId||suggestion.recordId,expectedVersion:suggestion.sourceVersion,...draft});
        if(n!==generation)return;
        if(!receipt||typeof receipt.already_saved!=='boolean'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receipt.task_id||''))throw Error('Approval result uncertain. Check Tasks and decision history before retrying.');
        reviewId=null;reviewDraft=null;const refreshed=await load();if(refreshed&&session)message(receipt.already_saved?'This suggestion was already approved. No duplicate was created.':'Task and approval history saved together in one database transaction.');return;
      }
      // Recheck the remote state immediately before saving. This narrows (but cannot eliminate)
      // simultaneous-tab races without a database uniqueness constraint/transaction.
      const [freshTasks,freshDecisions]=await Promise.all([api.listBriefRecords(token),api.listSuggestionDecisions(token,user.id)]);
      if(n!==generation)return;
      const remote=normalizeCloudRecords(freshTasks,user.id);
      const decisions=getDecisionState(freshDecisions,user.id,allSuggestions());
      if(decisionPreventsApproval(decisions,suggestion.id)||isDuplicateTask(remote.tasks,{...draft,id:suggestion.id})){
        reviewId=null;reviewDraft=null;if(await load())return message('Suggestion already handled or matching task saved in cloud. No duplicate created.');
        return;
      }
      const result=await api.addFictionalTask(token,data);
      if(n!==generation)return;
      if(!Array.isArray(result)||result.length!==1||!result[0]?.id)throw Error('Task save result uncertain; check Tasks before retrying.');
      reviewId=null;reviewDraft=null;
      let decisionSaved=false;
      try{
        const decision=makeApprovalDecision(suggestion,user.id,result[0]);
        const recorded=await api.addSuggestionDecision(token,decision);
        decisionSaved=Array.isArray(recorded)&&recorded.length===1;
      }catch{/* Task is already saved; do not retry or imply rollback. */}
      const refreshed=await load();
      if(refreshed&&session)message(decisionSaved?'Approved task and decision history saved privately.':'Task saved successfully, but its decision history could not be confirmed. Do not approve again; check Tasks.');
    }
    catch(err){if(n===generation&&!lostSession(err))message(err.message,'error');}
    finally{if(n===generation){busy=false;render();}}
  }
  if(ev.target.id==='brief-add-task'){
    ev.preventDefault();if(busy||!active())return;if(!canWrite())return message(syncWarning(),'error');
    const form=ev.target,formData=new FormData(form),data=Object.fromEntries(formData.entries());
    taskDraft={title:String(data.title||''),day:String(data.day||''),section:String(data.section||'')};const submittedDraft=taskDraft;
    let draft;try{draft=makeFictionalTask(data,user.id);}catch(err){message(err.message,'error');return;}
    busy=true;render();const n=generation;
    try{const token=await auth.getAccessToken();if(n!==generation)return;const result=await api.addFictionalTask(token,draft);if(n!==generation)return;if(!Array.isArray(result)||result.length!==1)throw Error('Cloud task could not be verified. Check Tasks before retrying.');if(taskDraft===submittedDraft)taskDraft=emptyTaskDraft();const refreshed=await load();if(refreshed&&session)message('Fictional task saved in your private cloud records.');}
    catch(err){if(n===generation&&!lostSession(err))message(err.message,'error');}
    finally{if(n===generation){busy=false;render();}}
  }
});
async function saveDismissal(suggestionId){
  if(busy||!active())return;if(!canWrite())return message(syncWarning(),'error');
  const suggestion=allSuggestions().find(s=>s.id===suggestionId);
  if(!suggestion||!maySuggest(suggestion,preferences)||(decisionState.approved.has(suggestionId)||decisionState.dismissed.has(suggestionId)))return;
  let decision;
  try{decision=makeSuggestionDismissal(suggestion,user.id);}catch(err){message(err.message,'error');return;}
  busy=true;render();const n=generation;
  try{
    const token=await auth.getAccessToken();if(n!==generation)return;
    // Cloud first: don't hide it in the UI unless Supabase confirms the save.
    const result=await api.addSuggestionDecision(token,decision);
    if(n!==generation)return;
    if(!Array.isArray(result)||result.length!==1)throw Error('Dismissal was not confirmed in the cloud. Please retry.');
    reviewId=null;reviewDraft=null;
    const refreshed=await load();
    if(refreshed&&session)message('Dismissal saved privately for this test account. It will remain dismissed after refreshing.');
  }catch(err){if(n===generation&&!lostSession(err))message(err.message,'error');}
  finally{if(n===generation){busy=false;render();}}
}
async function restoreDismissal(suggestionId){
  if(busy||!active())return;if(!canWrite())return message(syncWarning(),'error');
  const suggestion=allSuggestions().find(s=>s.id===suggestionId);
  if(!suggestion||!decisionState.dismissed.has(suggestionId))return;
  let entry;try{entry=makeRestoreDecision(suggestion,user.id);}catch(err){return message(err.message,'error');}
  busy=true;render();const n=generation;
  try{
    const token=await auth.getAccessToken();if(n!==generation)return;
    // Only undo the *dismissal*; never delete an approved task or alter external data.
    const result=await api.addSuggestionDecision(token,entry);
    if(n!==generation)return;
    if(!Array.isArray(result)||result.length!==1)throw Error('Cloud restore was not confirmed.');
    reviewId=null;reviewDraft=null;const refreshed=await load();if(refreshed&&session)message('Dismissal restored; the fictional suggestion may be reviewed again.');
  }catch(err){if(n===generation&&!lostSession(err))message(err.message,'error');}
  finally{if(n===generation){busy=false;render();}}
}
root.addEventListener('click',async ev=>{
  const restore=ev.target.closest('[data-restore]');
  if(restore){await restoreDismissal(restore.dataset.restore);return;}
  const toReview=ev.target.closest('[data-review]');
  if(toReview){if(!canWrite())return message(syncWarning(),'error');const s=allSuggestions().find(x=>x.id===toReview.dataset.review);if(!s||!maySuggest(s,preferences)||(decisionState.approved.has(s.id)||decisionState.dismissed.has(s.id))||isDuplicateTask(records.tasks,s))return;reviewId=s.id;reviewDraft={suggestionId:s.id,title:s.title,day:s.day,section:s.section,sourceSnapshot:JSON.stringify(s)};render();return;}
  const toDismiss=ev.target.closest('[data-dismiss]');
  if(toDismiss){await saveDismissal(toDismiss.dataset.dismiss);return;}
  if(ev.target.closest('#sample-cancel')){reviewId=null;reviewDraft=null;render();return;}
  if(ev.target.closest('#sample-dismiss-review')){if(reviewId)await saveDismissal(reviewId);return;}

  if(ev.target.closest('#brief-logout')){blank();busy=false;message('Signed out of this test screen.');await auth.signOut();return;}
  if(ev.target.closest('#brief-simulate-offline')){simulateOutage=!simulateOutage;refreshFailed=true;notice=simulateOutage?'Simulated cloud outage enabled. No server connection was altered.':'Simulated outage cleared. Fetch latest to verify cloud state.';error='';render();return;}
  if(ev.target.closest('#brief-reload')){await load();return;}
  const button=ev.target.closest('[data-toggle]');
  if(!button||busy||!active())return;if(!canWrite())return message(syncWarning(),'error');
  const record=records.tasks.find(r=>r.id===button.dataset.toggle);
  if(!record)return;
  let payload;try{payload=toggledTaskPayload(record);}catch(err){message(err.message,'error');return;}
  const n=generation;busy=true;render();
  try{const token=await auth.getAccessToken();if(n!==generation)return;const response=await api.toggleFictionalTask(token,record.id,user.id,payload,record.version);if(n!==generation)return;if(!Array.isArray(response)||response.length!==1)throw Error('Task update was not confirmed.');const refreshed=await load();if(refreshed&&session)message('Task status updated in your private cloud records.');}
  catch(err){if(n===generation&&!lostSession(err))message(err.message,'error');}
  finally{if(n===generation){busy=false;render();}}
});
// M1G: best-effort foreground refresh for external changes; no persistent background sync.
const refreshOnReturn=()=>{if(!auth?.get()||busy||offline())return; if(Date.now()-lastAttemptAt<15000)return; void load();};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshOnReturn();});
window.addEventListener('online',()=>{if(auth?.get()){notice='Connection appears available again. Checking the cloud…';void load();}});
window.addEventListener('offline',()=>{refreshFailed=true;error='Browser reports offline. Last confirmed data is not current.';render();});
setInterval(()=>{if(!document.hidden&&auth?.get()&&!busy&&!offline()&&Date.now()-lastAttemptAt>=120000)void load();},30000);
(async()=>{
  try{
    const response=await fetch('/dev-config.json',{cache:'no-store'});
    if(!response.ok)throw Error('Development configuration unavailable. Copy .env.local from your verified M1B development folder.');
    config=await response.json();api=createDevApi(config);auth=createDevSessionManager(api,config.projectRef,window.sessionStorage);
    busy=true;render();
    const restored=await auth.restore();
    if(restored){session=restored;user=restored.user;notice='Development sign-in restored after refresh.';await load();}
    busy=false;render();
  }catch(err){root.innerHTML=chrome(`<p class="warning">${e(err.message)}</p><p><a href="/">Return to fictional Daily Brief</a></p>`);}
})();
