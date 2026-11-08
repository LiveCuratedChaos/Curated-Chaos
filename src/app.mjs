import {
  AREAS, SOURCE_KEYS, addDays, applyDraft, applySuggestion, buildBrief,
  dayString, escapeHtml as e, formatDate, initialSettings, isVisibleRecord,
  safeAutomationMode, sameEvent, seedDemoData, validateDraft, visibleItems
} from './core.mjs';

// LOCAL-ONLY FIXTURE MODE. There is intentionally no remote API, auth token, or provider SDK.
const STORAGE_KEY = 'curated-chaos-isolated-fictional-v1';
const app=document.getElementById('app');
const allPages=['Daily Brief','The Curation',...AREAS,'My Account'];
const navSymbols={'Daily Brief':'◈','The Curation':'▦','Home':'⌂','Calendar':'▣','Personal Life':'✧','Work':'▥','School':'▤','Finances':'◉','My Account':'⚙'};
const widgetNames={schedule:'Today’s Calendar',priorities:'Priority Tasks',school:'School Progress',bills:'Upcoming Bills',suggestions:'Pending Suggestions'};
const sourceNames={calendar:'Calendar samples',email:'Email samples',finance:'Financial samples',tasks:'Personal tasks',school:'School reminders',household:'Household samples'};
const themeNames={neutral:'Classic Minimal · Neutral',luxury:'Timeless Luxury',blush:'Blush Pink',coastal:'Coastal Blue',earthy:'Earthy Green',executive:'Modern Executive',academia:'Dark Academia · personal'};
let state = restore();
let page=allPages.includes(new URLSearchParams(location.search).get('page')) ? new URLSearchParams(location.search).get('page') : 'Daily Brief', modal='', quickDraft=null, reviewId=null, query='', notice='', undoSnapshot=null;

function restore(){
  try {
    const raw=localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const x=JSON.parse(raw);
      if (x?.data?.sample===true && x.data.viewer.userId==='fictional-owner' && x.settings?.sources) return x;
    }
  } catch { /* Never use corrupt or externally shaped demo storage. */ }
  return {data:seedDemoData(),settings:initialSettings()};
}
function persist(){
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
  catch {notice='Browser storage is unavailable. Your fictional changes may not persist after refresh.';}
}
function changed(msg='Saved in this browser (fictional demo only).') {persist();notice=msg;render();}
function allowed(items){return visibleItems(items,state.data.viewer);}
function money(num){return state.settings.hideAmounts?'••••':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(num);}
function pill(text,cls=''){return `<span class="pill ${cls}">${e(text)}</span>`;}
function empty(text){return `<p class="empty">${e(text)}</p>`;}
function heading(title,subtitle=''){return `<div class="heading"><div><p class="eyebrow">CURATED CHAOS · DEVELOPMENT</p><h1>${e(title)}</h1>${subtitle?`<p class="muted">${e(subtitle)}</p>`:''}</div><button type="button" class="btn btn-primary" data-action="open-quick">+ Quick Add</button></div>`;}
function taskRows(tasks){
  return tasks.length?`<ul class="item-list">${tasks.map(item=>`<li class="item"><button type="button" class="tick ${item.done?'done':''}" aria-label="${item.done?'Mark incomplete':'Complete'} ${e(item.title)}" data-action="toggle-task" data-id="${e(item.id)}">${item.done?'✓':''}</button><div class="item-main"><strong class="${item.done?'completed':''}">${e(item.title)}</strong><small>${e(item.section)} · ${e(formatDate(item.day))} ${item.visibility==='household'?'· Shared sample':''}</small></div>${item.priority==='High'?pill('Priority','gold'):''}</li>`).join('')}</ul>`:empty('No sample tasks in this view.');
}
function eventRows(events){
  return events.length?`<ul class="item-list">${events.map(item=>`<li class="item"><span class="time-chip">${e(item.time)}</span><div class="item-main"><strong>${e(item.title)}</strong><small>${e(item.origin)} · ${e(formatDate(item.day))}</small></div></li>`).join('')}</ul>`:empty('No sample events on this date.');
}
function billRows(bills){
  return bills.length?`<ul class="item-list">${bills.map(item=>`<li class="item"><div class="item-main"><strong>${e(item.title)}</strong><small>Fictional bill · ${e(formatDate(item.day))}</small></div><strong class="money">${money(item.amount)}</strong></li>`).join('')}</ul>`:empty('No upcoming sample bills.');
}
function suggestionRows(list){
  return list.length?`<ul class="item-list">${list.map(item=>`<li class="item"><div class="item-main"><strong>${e(item.title)}</strong><small>${e(item.origin)} · approval required</small></div><button class="btn btn-small" type="button" data-action="review" data-id="${e(item.id)}">Review</button></li>`).join('')}</ul>`:empty('No pending sample suggestions.');
}
function panel(title,inner,extra=''){return `<section class="panel"><div class="panel-head"><h2>${e(title)}</h2>${extra}</div>${inner}</section>`;}
function renderBrief(){
  const {settings,data}=state;
  const brief=buildBrief(data,settings,settings.selectedDate);
  const selected=settings.selectedDate;
  const subtitle='Your personalized starting point. All records shown here are fictional.';
  const calendar=panel('Your Schedule',eventRows(brief.events),pill('Calendar · demo'));
  const priority=panel('Your Priorities',taskRows(brief.tasks),pill(`${brief.tasks.length} open`));
  const finance=panel('Upcoming Bills',billRows(brief.bills),pill('Read-only demo'));
  const suggestions=panel('Pending Suggestions',suggestionRows(brief.pending),pill('Approval required','gold'));
  const school=panel('School',taskRows(brief.schoolTasks),pill('Example milestones'));
  const home=panel('Household',taskRows(brief.householdTasks),pill('Sample household'));
  return `${heading('A Glimpse of Your Day',subtitle)}
  <div class="date-bar"><div class="date-bar-actions"><button class="btn btn-icon" type="button" data-action="prev-day" aria-label="Previous day">‹</button><label class="date-label" for="day-selection">Viewing <input type="date" id="day-selection" data-change="date" value="${e(selected)}" /></label><button class="btn btn-icon" type="button" data-action="next-day" aria-label="Next day">›</button><button class="btn btn-small" type="button" data-action="today">Today</button></div><button type="button" class="btn btn-small" data-action="refresh">↻ Refresh demo</button></div>
  <section class="summary"><p class="eyebrow">YOUR DAILY BRIEF · ${e(formatDate(selected))}</p><p>${e(brief.summary)}</p><div class="status-row">${pill('Fictional data only','gold')}${pill('0 live integrations')}${pill('Locally generated')}</div></section>
  <div class="metric-grid"><div class="metric"><span>Events</span><strong>${brief.events.length}</strong></div><div class="metric"><span>Open tasks</span><strong>${brief.tasks.length}</strong></div><div class="metric"><span>Upcoming bills</span><strong>${brief.bills.length}</strong></div><div class="metric"><span>Review queue</span><strong>${brief.pending.length}</strong></div></div>
  <div class="two-columns">${calendar}${priority}${school}${finance}${suggestions}${home}</div>
  ${panel('Sources included in this brief',`<p class="muted">These switches filter fictional content. They do not connect or disconnect any real accounts.</p><div class="toggle-grid">${SOURCE_KEYS.map(k=>`<label class="switch-row"><input type="checkbox" data-change="source" data-source="${k}" ${settings.sources[k]?'checked':''} /><span>${e(sourceNames[k])}</span></label>`).join('')}</div>`)}`;
}
function widgetContent(key, brief) {
  if (key==='schedule') return eventRows(brief.events);
  if (key==='priorities') return taskRows(brief.tasks.slice(0,4));
  if (key==='school') return taskRows(brief.schoolTasks);
  if (key==='bills') return billRows(brief.bills);
  if (key==='suggestions') return suggestionRows(brief.pending);
  return empty('Unavailable widget.');
}
function renderCuration(){
  const {settings}=state, brief=buildBrief(state.data,settings);
  return `${heading('The Curation','Your configurable sample dashboard. Layout changes are saved only in this browser.')}
  ${panel('Your Widgets',`<div class="widget-toolbar">${Object.entries(widgetNames).map(([key,title])=>`<label class="switch-row"><input data-change="widget" data-widget="${key}" type="checkbox" ${settings.widgets.includes(key)?'checked':''} />${e(title)}</label>`).join('')}</div><p class="tiny muted">Use the arrows on each widget to change its order.</p>`)}
  <div class="two-columns">${settings.widgets.map((key,index)=>panel(widgetNames[key],widgetContent(key,brief),`<div class="widget-arrows"><button type="button" class="btn btn-small" data-action="move-widget" data-widget="${key}" data-dir="-1" aria-label="Move ${e(widgetNames[key])} up" ${index===0?'disabled':''}>↑</button><button type="button" class="btn btn-small" data-action="move-widget" data-widget="${key}" data-dir="1" aria-label="Move ${e(widgetNames[key])} down" ${index===settings.widgets.length-1?'disabled':''}>↓</button></div>`)).join('')}</div>`;
}
function renderArea(name){
  const data=state.data, filteredTasks=allowed(data.tasks).filter(t=>t.section===name);
  if (name==='Home') return `${heading('Home','Household essentials — fictional examples')}
    <div class="two-columns">${panel('Household Tasks',taskRows(filteredTasks))}${panel('Grocery & Shared Planning',`<p class="muted">A sample grocery item appears as a Home task. Create another using Quick Add → Grocery.</p>${taskRows(filteredTasks.filter(t=>t.title.toLowerCase().includes('grocer')))}`)}</div>`;
  if (name==='Calendar') return `${heading('Calendar','Sample calendar records only — no Google Calendar connection in this starter')}
    ${panel('Upcoming Sample Events',eventRows(allowed(data.events).filter(event=>event.day>=dayString()).sort((a,b)=>a.day.localeCompare(b.day)||a.time.localeCompare(b.time))))}`;
  if (name==='Personal Life') return `${heading('Personal Life','Personal notes, goals and tasks — development preview')}
    <div class="two-columns">${panel('Personal Tasks',taskRows(filteredTasks))}${panel('Notes',allowed(data.notes).map(n=>`<article class="mini-note"><strong>${e(n.title)}</strong><p class="muted">${e(n.body)}</p></article>`).join('')||empty('No notes yet.'))}</div>`;
  if (name==='Work') return `${heading('Work','Your example work priorities')}${panel('Work Tasks',taskRows(filteredTasks))}`;
  if (name==='School') return `${heading('School','Study and assessment planning — fictional examples')}
    <div class="two-columns">${panel('Example Assessments',taskRows(filteredTasks))}${panel('Degree Planning',`<p class="muted">Future work: approved official program plan, separate accelerated plan, assessment details, and study scheduling. This starter intentionally contains no imported academic records.</p>`)}</div>`;
  if (name==='Finances') return `${heading('Finances','Read-only fictional financial overview — no bank connections')}
    <div class="two-columns">${panel('Example Account',`<div class="balance"><span>${e(data.account.name)}</span><strong>${money(data.account.balance)}</strong></div><p class="tiny muted">Fictional balance. No account is connected.</p>`)}${panel('Example Bills',billRows(allowed(data.bills)))}</div>`;
  return empty('Area not yet implemented.');
}
function renderAccount(){
  const settings=state.settings;
  const rules=[['routine_categorization','Routine categorization'],['email_to_event','Email → calendar event (approval mandatory)'],['email_to_task','Email → task (approval mandatory)'],['financial_record_update','Financial record changes (approval mandatory)']];
  return `${heading('My Account','Local development settings — no real account, household or provider is connected')}
  <div class="two-columns">${panel('Appearance Foundation',`<p class="muted">Classic Minimal is the default; the six palette previews and optional personal Dark Academia are basic QA tokens. Detailed approved branding and visual polish will come after functionality.</p><label class="field-label">Theme<select data-change="theme">${Object.entries(themeNames).map(([k,v])=>`<option value="${k}" ${settings.theme===k?'selected':''}>${e(v)}</option>`).join('')}</select></label><label class="switch-row prominent"><input data-change="hide-amounts" type="checkbox" ${settings.hideAmounts?'checked':''} /> Hide dollar amounts throughout app</label>`)}
  ${panel('Integration Readiness',`<ul class="provider-list"><li><strong>Google Calendar</strong> ${pill('Not connected in dev')}</li><li><strong>Email</strong> ${pill('Not connected in dev')}</li><li><strong>Banking / Investments</strong> ${pill('Not connected in dev')}</li></ul><p class="tiny muted">Live connectors will be built and tested separately, one provider at a time. Existing app connections are not copied.</p>`)}
  ${panel('Automation Rules',`<p class="muted">These are saved local preferences only. Email-created items and financial changes always require approval.</p>${rules.map(([key,title])=>`<div class="rule-row"><label for="rule-${key}">${e(title)}</label><select id="rule-${key}" data-change="automation" data-rule="${key}">${['automatic','ask','disabled'].map(v=>`<option value="${v}" ${(settings.automation[key]||'ask')===v?'selected':''} ${v==='automatic'&&safeAutomationMode(key,'automatic')!=='automatic'?'disabled':''}>${v==='ask'?'Ask before applying':v==='automatic'?'Automatic':'Disabled'}</option>`).join('')}</select></div>`).join('')}`)}
  ${panel('Demo Data Controls',`<p class="muted">Only fictional data is used. Sample changes are kept in your browser’s local storage, not in Supabase or Netlify.</p><button type="button" class="btn btn-danger" data-action="reset-demo">Reset fictional sample data</button>`)}
  ${panel('Security Status',`<ul class="simple-list"><li>Separate local-only test environment: <strong>Yes</strong></li><li>Isolated Supabase RLS testing: <strong>23 checks reported passed</strong></li><li>Cloud login: <strong>Separate development testing screen only</strong></li><li>Real-device remote sign-out: <strong>Not implemented</strong></li><li>Encrypted offline records: <strong>Not implemented</strong></li><li>Live bank / email / calendar integrations: <strong>Not enabled</strong></li></ul><p class="tiny muted">No secrets should be pasted into this demo. Use <a href="/dev-auth.html">Isolated Cloud Sign-In Test</a> to sign in with a fictional development account. This does not replace the local demo or connect your original app.</p>`)}</div>`;
}
function renderSearch(){
  const search=e(query.toLowerCase().trim());
  const items=[...allowed(state.data.tasks).map(x=>({...x,kind:'Task'})),...allowed(state.data.events).map(x=>({...x,kind:'Event'})),...allowed(state.data.notes).map(x=>({...x,kind:'Note'})),...allowed(state.data.bills).map(x=>({...x,kind:'Bill'}))];
  const matches=search?items.filter(item=>`${item.title} ${item.section}`.toLowerCase().includes(query.toLowerCase().trim())):[];
  return `<div class="modal-backdrop" data-action="close-modal"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-stop="1"><div class="dialog-top"><h2 id="modal-title">Search Your Sample Records</h2><button type="button" class="btn btn-icon" data-action="close-modal" aria-label="Close">×</button></div><input class="searchbox" type="search" placeholder="Search fictional tasks, events, notes and bills" id="search-input" autocomplete="off" value="${e(query)}" /><p class="tiny muted">Search is local to this fictional demo. No external email or bank data is searched.</p>${matches.length?`<ul class="item-list">${matches.slice(0,15).map(item=>`<li class="item"><div class="item-main"><strong>${e(item.title)}</strong><small>${e(item.kind)} · ${e(item.section)}</small></div></li>`).join('')}</ul>`:empty(search?'No matching sample records.':'Start typing to search.')}<div class="dialog-actions"><button class="btn" type="button" data-action="close-modal">Close</button></div></section></div>`;
}
function renderQuick(){
  const today=dayString();
  if (quickDraft) return `<div class="modal-backdrop" data-action="close-modal"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-stop="1"><div class="dialog-top"><h2 id="modal-title">Review Before Saving</h2><button class="btn btn-icon" data-action="close-modal" type="button" aria-label="Close">×</button></div><p class="muted">Confirm this fictional, private record. This will not sync to another device.</p><dl class="review-list"><dt>Type</dt><dd>${e(quickDraft.type)}</dd><dt>Title</dt><dd>${e(quickDraft.title)}</dd><dt>Destination</dt><dd>Private · ${e(quickDraft.section||'Personal Life')}</dd>${quickDraft.type!=='note'?`<dt>Date</dt><dd>${e(formatDate(quickDraft.day))}</dd>`:''}</dl><div class="dialog-actions"><button class="btn" data-action="edit-draft" type="button">Back</button><button class="btn btn-primary" data-action="confirm-draft" type="button">Save fictional record</button></div></section></div>`;
  return `<div class="modal-backdrop" data-action="close-modal"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-stop="1"><div class="dialog-top"><h2 id="modal-title">Quick Add</h2><button class="btn btn-icon" type="button" data-action="close-modal" aria-label="Close">×</button></div><p class="muted">Create a fictional record. Personal/private by default.</p><form id="quick-form"><label class="field-label">Item type<select name="type" required><option value="task">Task</option><option value="event">Calendar event</option><option value="grocery">Grocery item</option><option value="note">Note</option></select></label><label class="field-label">Title<input name="title" required maxlength="140" placeholder="e.g. Review example assignment" /></label><label class="field-label">Date<input type="date" name="day" value="${e(today)}" /></label><label class="field-label">Area<select name="section">${AREAS.map(name=>`<option ${name==='Personal Life'?'selected':''}>${e(name)}</option>`).join('')}</select></label><label class="field-label">Notes (optional)<textarea name="detail" rows="2" placeholder="Optional fictional details"></textarea></label><div class="dialog-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">Review entry</button></div></form></section></div>`;
}
function renderReview(){
  const item=allowed(state.data.suggestions).find(s=>s.id===reviewId&&s.status==='pending');
  if (!item) return '';
  const proposed=item.proposed;
  const conflict=proposed.type==='event'&&state.data.events.some(x=>isVisibleRecord(x,state.data.viewer)&&sameEvent(x,proposed));
  return `<div class="modal-backdrop" data-action="close-modal"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-stop="1"><div class="dialog-top"><h2 id="modal-title">Review Suggested Action</h2><button type="button" class="btn btn-icon" data-action="close-modal" aria-label="Close">×</button></div><p>${e(item.description)}</p><dl class="review-list"><dt>Source</dt><dd>${e(item.origin)} (fictional)</dd><dt>Action</dt><dd>Create private ${e(proposed.type)}</dd><dt>Title</dt><dd>${e(proposed.title)}</dd><dt>Date</dt><dd>${e(formatDate(proposed.day))}</dd><dt>Automation</dt><dd>Approval always required</dd></dl>${conflict?`<p class="warning">A likely duplicate already exists. Creation is blocked.</p>`:''}<div class="dialog-actions"><button class="btn" type="button" data-action="dismiss-suggestion" data-id="${e(item.id)}">Dismiss</button><button class="btn btn-primary" type="button" data-action="approve-suggestion" data-id="${e(item.id)}" ${conflict?'disabled':''}>Approve & add</button></div></section></div>`;
}
function render(){
  document.body.dataset.theme=state.settings.theme;
  document.title=`${page} · Curated Chaos Dev`;
  const nav=allPages.map(name=>`<button type="button" class="nav-link ${page===name?'active':''}" data-action="navigate" data-page="${e(name)}"><span class="nav-symbol">${navSymbols[name]}</span>${e(name)}</button>`).join('');
  let body=page==='Daily Brief'?renderBrief():page==='The Curation'?renderCuration():page==='My Account'?renderAccount():renderArea(page);
  app.innerHTML=`<div class="shell"><aside class="sidebar"><button type="button" class="brand" data-action="navigate" data-page="Daily Brief"><span class="brand-icon">◈</span><span><strong>Curated Chaos</strong><small>Organize the chaos. Live beautifully.</small></span></button><div class="divider-line"></div><p class="side-caption">YOUR SPACE</p><nav aria-label="Main navigation">${nav}</nav><div class="sidebar-foot"><p>Isolated Development Preview</p><small>Fictional data · no connected accounts</small></div></aside><div class="main-col"><header class="topbar"><div class="topbar-left"><span class="dev-dot"></span><span>FICTIONAL DATA — LOCAL DEVELOPMENT ONLY</span></div><div class="topbar-right"><button type="button" class="btn btn-small" data-action="search" aria-label="Search demo records">⌕ Search <span class="shortcut">⌘K</span></button><button type="button" class="btn btn-small" data-action="toggle-amounts" aria-label="Toggle dollar amounts">${state.settings.hideAmounts?'Show $':'Hide $'}</button></div></header><main class="content" id="main-content">${notice?`<div class="notice" role="status">${e(notice)} ${undoSnapshot?'<button type="button" data-action="undo">Undo</button>':''}<button type="button" data-action="clear-notice" aria-label="Dismiss message">×</button></div>`:''}${body}</main><footer class="footline">Curated Chaos — Milestone 0F · Fictional local preview only · Not the existing Netlify app · <a href="/dev-dashboard.html">Connected Daily Brief · cloud QA</a></footer></div><nav class="bottom-tabs" aria-label="Mobile navigation">${['Daily Brief','The Curation','Calendar','Finances'].map(name=>`<button class="${page===name?'active':''}" type="button" data-action="navigate" data-page="${name}"><span>${navSymbols[name]}</span><small>${name==='The Curation'?'Curation':name}</small></button>`).join('')}<button type="button" data-action="more"><span>☰</span><small>More</small></button></nav></div>${modal==='quick'?renderQuick():modal==='search'?renderSearch():modal==='review'?renderReview():modal==='more'?`<div class="modal-backdrop" data-action="close-modal"><section class="dialog" role="dialog" aria-modal="true" aria-label="More navigation" data-stop="1"><div class="dialog-top"><h2>More</h2><button class="btn btn-icon" type="button" data-action="close-modal" aria-label="Close">×</button></div><div class="more-links">${allPages.map(name=>`<button type="button" class="btn" data-action="navigate" data-page="${e(name)}">${e(name)}</button>`).join('')}</div></section></div>`:''}`;
  if(modal==='search') { const input=document.getElementById('search-input');input?.focus();input?.setSelectionRange(query.length,query.length); }
}

app.addEventListener('click',event=>{
  const target=event.target.closest('[data-action]');
  if (!target) return;
  const action=target.dataset.action;
  if (action==='close-modal' && event.target.closest('[data-stop]') && !event.target.closest('button[data-action="close-modal"]')) return;
  if (action==='navigate') {page=target.dataset.page;modal='';notice='';window.scrollTo(0,0);render();return;}
  if (action==='more') {modal='more';render();return;}
  if (action==='open-quick'){quickDraft=null;modal='quick';render();return;}
  if (action==='search'){query='';modal='search';render();return;}
  if (action==='close-modal'){modal='';quickDraft=null;reviewId=null;render();return;}
  if (action==='clear-notice'){notice='';undoSnapshot=null;render();return;}
  if (action==='today'){state.settings.selectedDate=dayString();changed('Showing today’s fictional schedule.');return;}
  if (action==='prev-day'||action==='next-day'){state.settings.selectedDate=addDays(state.settings.selectedDate,action==='prev-day'?-1:1);changed('Changed Daily Brief date.');return;}
  if (action==='refresh'){notice='Fictional data refreshed locally. No external connections were contacted.';render();return;}
  if (action==='toggle-amounts'){state.settings.hideAmounts=!state.settings.hideAmounts;changed('Dollar amount visibility updated locally.');return;}
  if (action==='toggle-task'){
    const id=target.dataset.id;undoSnapshot=structuredClone(state.data);
    state.data.tasks=state.data.tasks.map(t=>t.id===id&&isVisibleRecord(t,state.data.viewer)?{...t,done:!t.done}:t);
    changed('Sample task updated.');return;
  }
  if (action==='undo'&&undoSnapshot){state.data=undoSnapshot;undoSnapshot=null;changed('Last sample task change undone.');return;}
  if (action==='review'){reviewId=target.dataset.id;modal='review';render();return;}
  if (action==='dismiss-suggestion'){
    const id=target.dataset.id;
    state.data.suggestions=state.data.suggestions.map(s=>s.id===id&&isVisibleRecord(s,state.data.viewer)?{...s,status:'dismissed'}:s);
    modal='';reviewId=null;changed('Sample suggestion dismissed.');return;
  }
  if (action==='approve-suggestion'){
    try{state.data=applySuggestion(state.data,target.dataset.id);modal='';reviewId=null;changed('Suggestion approved, and fictional record created.');}
    catch(err){notice=err.message;render();} return;
  }
  if (action==='edit-draft'){quickDraft=null;render();return;}
  if (action==='confirm-draft'){
    try {
      if (quickDraft.type==='event'&&state.data.events.some(v=>isVisibleRecord(v,state.data.viewer)&&sameEvent(v,quickDraft))) throw Error('Potential duplicate event. Please review the existing sample record first.');
      state.data=applyDraft(state.data,quickDraft,`demo-${Date.now()}`);quickDraft=null;modal='';changed('Private fictional record saved in this browser.');
    }catch(err){notice=err.message;modal='';quickDraft=null;render();} return;
  }
  if (action==='move-widget'){
    const key=target.dataset.widget,delta=Number(target.dataset.dir),items=state.settings.widgets;
    const old=items.indexOf(key),next=old+delta;
    if(old>=0&&next>=0&&next<items.length){[items[old],items[next]]=[items[next],items[old]];changed('Widget order saved locally.');}return;
  }
  if (action==='reset-demo'){
    if(!window.confirm('Reset all fictional sample data and local demo preferences? This does not affect your real Curated Chaos app.')) return;
    state={data:seedDemoData(),settings:initialSettings()};notice='Fictional demo reset.';undoSnapshot=null;persist();render();return;
  }
});
app.addEventListener('change',event=>{
  const control=event.target,action=control.dataset.change;
  if(action==='date'){state.settings.selectedDate=control.value||dayString();changed('Date changed.');return;}
  if(action==='source'){state.settings.sources[control.dataset.source]=control.checked;changed('Fictional source filter updated.');return;}
  if(action==='widget'){
    const key=control.dataset.widget, items=state.settings.widgets;
    state.settings.widgets=control.checked?([...items,key].filter((v,i,a)=>a.indexOf(v)===i)):items.filter(x=>x!==key);
    changed('Widgets updated locally.');return;
  }
  if(action==='theme'){state.settings.theme=control.value;changed('Basic theme token preview changed.');return;}
  if(action==='hide-amounts'){state.settings.hideAmounts=control.checked;changed('Amount visibility updated.');return;}
  if(action==='automation'){
    const key=control.dataset.rule;
    const selected=control.value;
    if(selected==='automatic'&&safeAutomationMode(key,selected)!=='automatic') {notice='This sensitive automation requires approval and cannot be set to Automatic.';render();return;}
    state.settings.automation[key]=selected;changed('Automation preference saved locally. No live automation is running.');return;
  }
});
app.addEventListener('submit',event=>{
  if(event.target.id!=='quick-form')return;
  event.preventDefault();
  const values=Object.fromEntries(new FormData(event.target).entries());
  const err=validateDraft(values);
  if(err){notice=err;modal='';render();return;}
  quickDraft=values;render();
});
app.addEventListener('input',event=>{
  if(event.target.id==='search-input'){
    const next=event.target.value;
    const pos=event.target.selectionStart;
    query=next;render();
    const input=document.getElementById('search-input');
    try{input.setSelectionRange(pos,pos);}catch{}
  }
});
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k') {event.preventDefault();modal='search';query='';render();}
  if(event.key==='Escape'&&modal){modal='';quickDraft=null;render();}
});
render();
