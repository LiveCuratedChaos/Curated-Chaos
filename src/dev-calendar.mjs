// Curated Chaos M2D: owner-private fictional calendar workspace. No external provider access.
import {createDevApi} from './dev-api.mjs';
import {createDevSessionManager} from './dev-session.mjs';
import {renderConnectedShell,renderDevelopmentConnectionsLink} from './dev-cloud-shell.mjs';
import {escapeHtml as e,dayString,formatDate} from './core.mjs';
import {validDay} from './dev-brief-model.mjs';
import {CALENDARS,CATEGORIES,VIEWS,MONTH_STYLES,REMINDERS,initialCalendarPrefs,normalizeCalendarPrefs,readCalendarPrefs,makeCalendarPrefsRecord,makeCalendarEvent,editCalendarEvent,normalizedCalendarEvent,selectedDayItems,monthDays,weekDays,stepCalendarDate} from './dev-calendar-model.mjs';
const root=document.getElementById('cc-calendar');
let api,auth,user=null,rows=[],prefs=initialCalendarPrefs(),prefsRecord=null,dirty=false,showPreferences=false,showAdd=false,editing=null,busy=false,loading=false,notice='',error='',generation=0;
let focus=dayString(),selected=focus,view='month',mobilePanelOpen=false,eventDraft=null;
const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const opt=(values,chosen)=>values.map(x=>`<option value="${e(x)}" ${x===chosen?'selected':''}>${e(x)}</option>`).join('');
const fmtTime=t=>{if(!t)return 'Any time';const [h,m]=t.split(':').map(Number);return `${(h%12)||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;};
const dayTitle=day=>formatDate(day,{year:'numeric',month:'long',weekday:'long'});
const monthTitle=day=>{const [y,m]=day.split('-').map(Number);return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(new Date(y,m-1,1,12));};
const hasSession=()=>Boolean(user&&auth?.get());
const alert=()=>`${error?`<p class="warning" role="alert">${e(error)}</p>`:''}${notice?`<p class="notice" role="status">${e(notice)}</p>`:''}`;
const tabs=()=>`<div class="cc-calendar-views" role="group" aria-label="Calendar view">${VIEWS.map(v=>`<button type="button" class="btn btn-small ${view===v?'selected':''}" data-cal-view="${v}" aria-pressed="${view===v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div>`;
function eventForm(record=null){
 const isEdit=Boolean(record),key=record?.id||'new';
 if(eventDraft?.key!==key){
  const p=record?.payload||{};
  eventDraft={key,record:record?structuredClone(record):null,values:{title:p.title||'',day:p.day||selected,time:p.time||'09:00',end_time:p.end_time||'',calendar:p.calendar||prefs.defaultCalendar,category:p.category||prefs.defaultCategory,reminder:p.reminder||prefs.defaultReminder,description:p.description||''}};
 }
 const p=eventDraft.values;
 const title=isEdit?'Edit fictional event':'Add fictional event';
 return `<section class="cc-work-card cc-cal-form"><div class="cc-card-heading"><h2>${title}</h2><button class="btn btn-small" type="button" id="cal-cancel-edit">Close</button></div><form id="${isEdit?'cal-edit-event':'cal-add-event'}" ${isEdit?`data-event-id="${e(record.id)}"`:''} ><fieldset class="cc-org-fields cc-cal-event-fields" ${busy||loading?'disabled':''}><label class="field-label">Event title<input name="title" maxlength="140" required value="${e(p.title)}" placeholder="QA: Sample appointment"></label><label class="field-label">Date<input type="date" name="day" required value="${e(p.day)}"></label><div class="cc-cal-times"><label class="field-label">Start time<input name="time" type="time" value="${e(p.time)}" required></label><label class="field-label">End time (optional)<input name="end_time" type="time" value="${e(p.end_time)}"></label></div><div class="cc-cal-times"><label class="field-label">Calendar<select name="calendar">${opt(CALENDARS,p.calendar)}</select></label><label class="field-label">Category<select name="category">${opt(CATEGORIES,p.category)}</select></label></div><label class="field-label">Reminder preference<select name="reminder">${opt(REMINDERS,p.reminder)}</select></label><label class="field-label">Description<textarea name="description" rows="2" maxlength="1000">${e(p.description)}</textarea></label><p class="tiny muted">Unsaved text stays through errors and refresh checks. Closing this editor or leaving the page discards it. Reminder selection is saved only; notifications are not delivered.</p><button class="btn btn-primary" type="submit" ${busy?'disabled':''}>${isEdit?'Save event changes':'Save fictional event'}</button></fieldset></form></section>`;
}
function displayPrefs(){
 const checkboxSet=(set,name)=>`<fieldset class="cc-cal-checkboxes"><legend>${e(name)}</legend>${set.map(x=>`<label><input type="checkbox" data-cal-filter="${name==='Calendars'?'calendars':'categories'}" value="${e(x)}" ${(name==='Calendars'?prefs.calendars:prefs.categories).includes(x)?'checked':''}>${e(x)}</label>`).join('')}</fieldset>`;
 return `<section class="cc-work-card cc-cal-settings"><div class="cc-card-heading"><h2>Calendar display & defaults</h2><button class="btn btn-small" type="button" id="cal-hide-settings">Close</button></div><p class="tiny muted">These are private display preferences for fictional test events. External calendar connections and push notifications are not active.</p><div class="cc-cal-prefs-grid"><label class="field-label">Default opening view<select data-cal-preference="view">${opt(VIEWS,prefs.view)}</select></label><label class="field-label">Default calendar for new events<select data-cal-preference="defaultCalendar">${opt(CALENDARS,prefs.defaultCalendar)}</select></label><label class="field-label">Default category<select data-cal-preference="defaultCategory">${opt(CATEGORIES,prefs.defaultCategory)}</select></label><label class="field-label">Default reminder preference<select data-cal-preference="defaultReminder">${opt(REMINDERS,prefs.defaultReminder)}</select></label><label class="field-label">Month view appearance<select data-cal-preference="monthStyle">${opt(MONTH_STYLES,prefs.monthStyle)}</select></label></div>${checkboxSet(CALENDARS,'Calendars')}${checkboxSet(CATEGORIES,'Categories')}<label class="cc-cal-check-line"><input type="checkbox" id="cal-show-tasks" ${prefs.showTasks?'checked':''}> Show due tasks alongside events</label><div class="cc-cal-actions"><button type="button" class="btn btn-primary" id="cal-save-prefs" ${busy?'disabled':''}>Save display preferences${dirty?' *':''}</button><button type="button" class="btn btn-small" id="cal-reset-prefs" ${busy?'disabled':''}>Restore defaults (unsaved)</button></div>${dirty?'<p class="tiny muted">* Unsaved changes. Press Save display preferences to keep them after refreshing.</p>':''}</section>`;
}
function displayItem(item,{short=false}={}){
 const isEvent=item.kind==='event';
 return `<div class="cc-cal-event ${isEvent?'cc-cal-event-only':'cc-cal-task'}" title="${e(item.title)}"><span class="cc-cal-kind">${isEvent?e(item.calendar):'TASK'}</span><div><strong class="${item.done?'completed':''}">${e(item.title)}</strong>${!short?`<small>${isEvent?`${fmtTime(item.time)}${item.endTime?'–'+fmtTime(item.endTime):''} · ${e(item.category)}`:`Due task · ${e(item.category)}`}</small>`:''}</div></div>`;
}
function month(){
 const currentMonth=focus.slice(0,7),today=dayString();
 const heads=weekdays.map(x=>`<div class="cc-cal-weekday">${x}</div>`).join('');
 const cells=monthDays(focus).map(day=>{
  const items=selectedDayItems(rows,day,prefs),isCurrent=day.slice(0,7)===currentMonth,chosen=day===selected;
  return `<button type="button" class="cc-cal-cell ${isCurrent?'':'cc-cal-outside'} ${chosen?'cc-cal-selected':''} ${day===today?'cc-cal-today':''}" data-cal-day="${day}" aria-label="${e(dayTitle(day))}, ${items.length} items" aria-pressed="${chosen}"><span class="cc-cal-day-number">${Number(day.slice(-2))}</span>${prefs.monthStyle==='dots'?`<span class="cc-cal-dots" aria-label="${items.length} entries">${items.slice(0,6).map(i=>`<span class="cc-cal-dot ${i.kind==='task'?'cc-cal-task-dot':''}"></span>`).join('')}${items.length>6?`<small>+${items.length-6}</small>`:''}</span>`:items.slice(0,3).map(i=>`<span class="cc-cal-mini ${i.kind==='task'?'cc-cal-mini-task':''}">${i.kind==='event'?fmtTime(i.time)+' ':''}${e(i.title)}</span>`).join('')}${items.length>3?`<small class="cc-cal-extra">+${items.length-3} more</small>`:''}</button>`;
 }).join('');
 return `<div class="cc-cal-month-grid">${heads}${cells}</div>`;
}
function week(){return `<div class="cc-cal-week-grid">${weekDays(focus).map(day=>`<section class="cc-work-card cc-cal-week-card"><button class="cc-cal-week-title" type="button" data-cal-day="${day}" aria-pressed="${day===selected}">${e(formatDate(day,{year:'numeric'}))}</button>${selectedDayItems(rows,day,prefs).map(i=>displayItem(i)).join('')||'<p class="tiny muted">No entries</p>'}</section>`).join('')}</div>`;}
function day(){return `<section class="cc-work-card cc-cal-day-view"><h2>${e(dayTitle(selected))}</h2>${selectedDayItems(rows,selected,prefs).map(i=>displayItem(i)).join('')||'<p class="muted">Nothing scheduled for this date in your visible fictional calendars.</p>'}</section>`;}
function datePanel(){
 const items=selectedDayItems(rows,selected,prefs);
 return `<aside class="cc-work-card cc-cal-side-panel ${mobilePanelOpen?'cc-cal-drawer-open':''}" aria-label="Selected day schedule"><div class="cc-card-heading"><h2>${e(dayTitle(selected))}</h2><div class="cc-cal-actions"><button class="btn btn-small" type="button" id="cal-add-toggle">+ Event</button><button class="btn btn-small cc-cal-mobile-close" type="button" id="cal-close-day" aria-label="Close day schedule">Close</button></div></div><p class="tiny muted">${items.length} visible item${items.length===1?'':'s'} · Personal fictional calendar</p><div class="cc-cal-day-items">${items.length?items.map(i=>`<article class="cc-cal-panel-entry">${displayItem(i)}${i.kind==='event'?`<p class="tiny muted">Reminder saved: ${e(i.reminder)} (not delivered)</p>${i.description?`<p>${e(i.description)}</p>`:''}<button class="btn btn-small" type="button" data-cal-edit="${e(i.id)}">Edit event</button>`:`<a href="/dev-organize.html#tasks" class="cc-work-action">Open Tasks</a>`}</article>`).join(''):'<p class="empty">No visible events or due tasks. Add a fictional event or select another day.</p>'}</div>${showAdd?eventForm():''}${editing?eventForm(eventDraft?.key===editing?eventDraft.record:rows.find(r=>r.id===editing)||null):''}</aside>`;
}
function show(){
 const login=`<section class="cc-work-card cc-work-auth"><h2>Private test calendar sign-in</h2><p class="muted">Use Development Test Account A or B. This calendar editor uses fictional records. Read-only Google connections and saved source snapshots are managed separately.</p><form id="cal-login"><label class="field-label">Test account email<input type="email" name="email" autocomplete="username" required></label><label class="field-label">Test password<input type="password" name="password" autocomplete="current-password" required></label><button type="submit" class="btn btn-primary" ${busy?'disabled':''}>Sign in</button></form></section>`;
 const header=`<section class="cc-work-header"><p class="eyebrow">THE CHAOS · MILESTONE 2D</p><h1>Calendar</h1><p class="cc-work-deck">A month-first calendar with a selected-day schedule, fictional events, due tasks and private display preferences.</p><div class="cc-work-badges"><span class="pill">Fictional test data only</span><span class="pill">Month · Week · Day</span><span class="pill">Separate Google source snapshots</span></div></section>${alert()}`;
 let body='';
 if(!hasSession())body=login;
 else body=`<div class="cc-work-status"><div><strong>Private test calendar</strong><small>${e(user.email)} · ${loading?'Loading…':rows.length+' saved fictional items'}${dirty?' · Unsaved display preferences':''}</small></div><div class="cc-work-actions"><button class="btn btn-small" id="cal-settings-toggle">Display & defaults</button><button class="btn btn-small" id="cal-refresh" ${busy?'disabled':''}>Refresh</button><button class="btn btn-small" id="cal-signout" ${busy?'disabled':''}>Sign out</button></div></div>${showPreferences?displayPrefs():''}<section class="cc-work-card cc-cal-toolbar"><div><h2>${view==='month'?e(monthTitle(focus)):view==='week'?'Week of '+e(formatDate(weekDays(focus)[0],{year:'numeric'})):e(dayTitle(selected))}</h2><p class="tiny muted">Select a date to open its schedule. All items are isolated fictional QA records.</p></div><div class="cc-cal-toolbar-buttons"><button class="btn btn-small" id="cal-prev" title="Previous ${view}" aria-label="Previous ${view}">‹</button><button class="btn btn-small" id="cal-today">Today</button><button class="btn btn-small" id="cal-next" title="Next ${view}" aria-label="Next ${view}">›</button>${tabs()}</div></section><div class="cc-cal-layout"><section class="cc-cal-main">${view==='month'?month():view==='week'?week():day()}</section>${datePanel()}</div>${mobilePanelOpen?'<button type="button" class="cc-cal-overlay" id="cal-overlay-close" aria-label="Close day schedule"></button>':''}<p class="tiny muted">Events are not synced to Apple/Google. Reminder times are stored but do not send notifications. Calendar connections, category-color customization and automation arrive in later integration phases.</p>`;
 root.innerHTML=renderConnectedShell(`<div class="cc-workspace-page cc-calendar-page">${header}${renderDevelopmentConnectionsLink(location.href)}${body}</div>`,{active:'calendar'});
}
async function load({keepDraft=true}={}){
 if(!hasSession())return;
 const seq=++generation,viewer=user.id;loading=true;error='';show();
 try{
  const token=await auth.getAccessToken();
  const [raw,prefRows]=await Promise.all([api.listCalendarRecords(token,viewer),api.listCalendarPreferences(token,viewer)]);
  if(seq!==generation||user?.id!==viewer)return;
  rows=Array.isArray(raw)?raw.filter(r=>r?.owner_id===viewer&&r.visibility==='private'&&r.household_id===null&&r.deleted_at==null&&r.payload?.fictional===true&&(r.item_type==='task'||normalizedCalendarEvent(r))):[];
  const selectedPrefs=readCalendarPrefs(prefRows,viewer);
  if(!keepDraft||!dirty){prefsRecord=selectedPrefs.record;prefs=selectedPrefs.prefs;dirty=false;view=prefs.view;}
  error='';
  if(selectedPrefs.duplicates)notice='Warning: duplicate settings records exist; using the newest one.';
 }catch(err){if(seq!==generation)return;notice='';error='Could not verify private calendar data. Previously loaded items may be out of date. '+String(err.message||err).slice(0,180);}finally{if(seq===generation){loading=false;show();}}
}
async function writeEvent(form,record=null){
 if(!hasSession()||busy||loading)return;
 const owner=user.id,seq=generation,values=Object.fromEntries(new FormData(form).entries());
 const key=record?.id||'new';
 eventDraft={key,record:eventDraft?.key===key?eventDraft.record:record?structuredClone(record):null,values};
 if(record)record=eventDraft.record;
 let entry;
 try{entry=record?editCalendarEvent(record,values,owner):makeCalendarEvent(values,owner);}catch(err){error=err.message;notice='';show();return;}
 busy=true;error='';notice='';show();
 try{
  const token=await auth.getAccessToken();
  const result=record?await api.updateCalendarEvent(token,record,owner,entry):await api.addFictionalEvent(token,entry);
  if(seq!==generation||user?.id!==owner)return;
  if(!Array.isArray(result)||result.length!==1)throw Error('Save could not be confirmed. Refresh before retrying to avoid duplicates. For an event changed elsewhere, close and reopen the editor to use its latest version. Your draft is still available until you close it.');
  selected=values.day;focus=selected;editing=null;showAdd=false;eventDraft=null;
  notice=record?'Fictional event updated.':'Fictional event saved privately.';
  busy=false;await load({keepDraft:true});
 }catch(err){if(seq===generation){error=String(err.message||err)+' Refresh and check saved events before retrying an uncertain save.';notice='';}}finally{if(seq===generation){busy=false;show();}}
}
async function savePrefs(){
 if(!hasSession()||busy||loading)return;
 const owner=user.id,seq=generation,previous=prefsRecord;
 const record=makeCalendarPrefsRecord(owner,prefs);
 busy=true;error='';show();
 try{
  const token=await auth.getAccessToken();
  const result=previous?await api.updateCalendarPreferences(token,previous,owner,record.payload):await api.addCalendarPreferences(token,record);
  if(seq!==generation||user?.id!==owner)return;
  if(!Array.isArray(result)||result.length!==1)throw Error('Preferences could not be confirmed. Reload before saving again.');
  prefsRecord=result[0];dirty=false;view=prefs.view;notice='Calendar display preferences saved privately.';
 }catch(err){if(seq===generation){error=String(err.message||err);notice='';}}finally{if(seq===generation){busy=false;show();}}
}
root.addEventListener('submit',event=>{
 const form=event.target;if(!['cal-login','cal-add-event','cal-edit-event'].includes(form.id))return;
 event.preventDefault();if(busy||loading)return;
 if(form.id==='cal-login'){
  const values=Object.fromEntries(new FormData(form).entries());
  busy=true;error='';show();void(async()=>{try{const result=await auth.signIn(String(values.email||'').trim(),String(values.password||''));user=result.user;rows=[];eventDraft=null;editing=null;showAdd=false;prefsRecord=null;prefs=initialCalendarPrefs();dirty=false;await load();}catch(err){error=String(err.message||err);user=null;eventDraft=null;}finally{busy=false;show();}})();return;
 }
 const record=form.id==='cal-edit-event'?rows.find(r=>r.id===form.dataset.eventId):null;
 if(form.id==='cal-edit-event'&&!record){error='Event was not found. Refresh and try again.';show();return;}
 void writeEvent(form,record);
});
root.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(!hasSession()||busy||loading)return;
 if(button.dataset.calDay){const day=button.dataset.calDay;if(!validDay(day))return;selected=day;focus=day;mobilePanelOpen=true;show();return;}
 if(button.dataset.calView){view=button.dataset.calView;focus=selected;mobilePanelOpen=false;show();return;}
 if(button.id==='cal-prev'||button.id==='cal-next'){const next=stepCalendarDate(focus,view,button.id==='cal-prev'?-1:1);focus=next;selected=next;mobilePanelOpen=false;show();return;}
 if(button.id==='cal-today'){focus=dayString();selected=focus;mobilePanelOpen=false;show();return;}
 if(button.id==='cal-settings-toggle'){showPreferences=!showPreferences;show();return;}
 if(button.id==='cal-hide-settings'){showPreferences=false;show();return;}
 if(button.id==='cal-close-day'||button.id==='cal-overlay-close'){mobilePanelOpen=false;showAdd=false;editing=null;eventDraft=null;show();return;}
 if(button.id==='cal-add-toggle'){showAdd=!showAdd;editing=null;eventDraft=null;mobilePanelOpen=true;show();return;}
 if(button.id==='cal-cancel-edit'){editing=null;showAdd=false;eventDraft=null;show();return;}
 if(button.dataset.calEdit){if(editing!==button.dataset.calEdit)eventDraft=null;editing=button.dataset.calEdit;showAdd=false;show();return;}
 if(button.id==='cal-save-prefs'){void savePrefs();return;}
 if(button.id==='cal-reset-prefs'){prefs=initialCalendarPrefs();dirty=true;view=prefs.view;show();return;}
 if(button.id==='cal-refresh'){void load();return;}
 if(button.id==='cal-signout'){++generation;const old=auth;user=null;rows=[];prefs=initialCalendarPrefs();prefsRecord=null;dirty=false;showAdd=false;editing=null;eventDraft=null;mobilePanelOpen=false;error='';notice='';show();void old.signOut();}
});
function captureEventDraft(event){
 const form=event.target.form;
 if(!hasSession()||busy||loading||!['cal-add-event','cal-edit-event'].includes(form?.id))return;
 const key=form.dataset.eventId||'new';
 if(eventDraft?.key===key)eventDraft.values=Object.fromEntries(new FormData(form).entries());
}
root.addEventListener('input',captureEventDraft);
root.addEventListener('change',event=>{
 captureEventDraft(event);
 const input=event.target;if(!hasSession()||busy||loading)return;
 if(input.dataset.calPreference){prefs=normalizeCalendarPrefs({...prefs,[input.dataset.calPreference]:input.value});dirty=true;show();return;}
 if(input.dataset.calFilter){const key=input.dataset.calFilter;const next=new Set(prefs[key]);if(input.checked)next.add(input.value);else next.delete(input.value);prefs=normalizeCalendarPrefs({...prefs,[key]:Array.from(next)});dirty=true;show();return;}
 if(input.id==='cal-show-tasks'){prefs=normalizeCalendarPrefs({...prefs,showTasks:input.checked});dirty=true;show();}
});
(async()=>{try{const result=await fetch('/dev-config.json',{cache:'no-store'});if(!result.ok)throw Error('Development config unavailable. Run npm run setup:reuse.');const config=await result.json();api=createDevApi(config);auth=createDevSessionManager(api,config.projectRef,sessionStorage);const restored=await auth.restore();user=restored?.user||null;if(user)await load();else show();}catch(err){error=String(err.message||err);show();}})();
