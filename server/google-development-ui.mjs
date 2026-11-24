// Public UI for a loopback-only development gateway; never receives provider tokens.
import {escapeHtml as e} from '/src/core.mjs';
const status=document.getElementById('connection-status'),controls=document.getElementById('connection-controls');
let csrf,busy=false,sessionTimer,macPreviewTimer,macReviewTimer,supportsSaveReview=false,closed=false,generation=0,sessionExpiresAt=null,savedSourceItems=[];
function connectionControls(c){
 const paused=c.status==='paused';
 return '<section class="panel"><h2>'+e(c.provider==='gmail'?'Gmail':'Google Calendar')+'</h2><p>'+e(c.accountLabel)+' · '+(paused?'Paused on this Mac':c.selectionRequired?'Saved authorization · source selection required':'Saved authorization · source selection saved')+'</p><p><strong>Permission:</strong> '+e(c.permission||'Unknown permission; reconnect review required.')+'</p><p class="tiny muted">The last successful provider check is unknown. No automatic refresh runs. '+(c.provider==='gmail'?'Gmail read-only authorization can cover the mailbox; this app preview is limited to the selected Inbox dates and subject/sender metadata.':'Calendar access is read only and limited to the selected calendar and dates.')+'</p><button class="btn" data-pause="'+e(c.connectionId)+'" data-paused="'+String(paused)+'">'+(paused?'Resume connection':'Pause connection')+'</button><p class="tiny muted">Pausing blocks new previews on this Mac and retains your encrypted credentials and source choices. It does not revoke Google permission or delete data. Resume only if you want this Mac to use the connection again.</p></section>'+(paused?'':selectionForm(c));
}
function selectionForm(c){
 const saved=c.sourceSelection,selection=saved?.selection;
 const gmail=c.provider==='gmail',source=gmail?'INBOX':'primary',label=gmail?'Inbox · subject and sender only':'Primary calendar · event titles and times';
 return '<form class="source-selection panel" data-connection="'+e(c.connectionId)+'"><h2>'+e(gmail?'Gmail selection':'Calendar selection')+'</h2><label><input type="checkbox" name="source" value="'+source+'" '+(selection?'checked ':'')+'required> '+label+'</label><label class="field-label">Start date (UTC, included)<input type="date" name="startDate" value="'+e(selection?.timeMin?.slice(0,10)||'')+'" required></label><label class="field-label">End date (UTC, excluded)<input type="date" name="endDate" value="'+e(selection?.timeMax?.slice(0,10)||'')+'" required></label><p>Maximum '+(gmail?'31':'366')+' days. Saving does not read or import data.</p><button class="btn btn-primary" type="submit">Save source selection</button><p role="status" class="selection-result">'+(selection?'Saved privately on this Mac. No automatic reading or import.':'')+'</p></form>'+ (saved?'<section class="panel"><p>Read the saved '+e(gmail?'Inbox subject/sender':'primary calendar event')+' selection: '+e(selection.timeMin.slice(0,10))+' through '+e(selection.timeMax.slice(0,10))+' (end excluded, UTC). Preview is displayed in this browser; nothing is added to the app database.</p><button class="btn" data-preview="'+e(c.connectionId)+'" data-selection="'+e(saved.selectionId)+'">Read selected source preview</button><div class="source-preview" role="status"></div></section>':'');
}
function briefToday(timeZone,instant=new Date()){
 const format=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}),parts=Object.fromEntries(format.formatToParts(instant).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return parts.year+'-'+parts.month+'-'+parts.day;
}
const briefDefaultZone='America/New_York';
function briefZoneOptions(){let browserZone;try{browserZone=Intl.DateTimeFormat().resolvedOptions().timeZone;}catch{}return [...new Set([briefDefaultZone,'UTC',browserZone].filter(Boolean))].map(zone=>'<option value="'+e(zone)+'">'+e(zone)+'</option>').join('');}
function briefInstant(value,timeZone){return new Intl.DateTimeFormat('en-US',{timeZone,dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
function briefDay(value,shift=0){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw Error('Choose a valid UTC date.');
 const date=new Date(value+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value||value<'2000-01-01'||value>'2100-12-31')throw Error('Choose a valid UTC date.');
 date.setUTCDate(date.getUTCDate()+shift);const day=date.toISOString().slice(0,10);if(day<'2000-01-01'||day>'2100-12-31')throw Error('Choose a date from 2000 through 2100.');return day;
}
function savedFreshnessHtml(freshness,timeZone){
 if(!freshness||!Array.isArray(freshness.sources))return '<p>Save times unavailable. Source check times are unknown; nothing was refreshed.</p>';
 const labels={gmail:'Gmail',google_calendar:'Google Calendar',plaid:'Chase',mac_calendar:'Mac Calendar'};
 return '<h4>How old are these saved copies?</h4><p>Save times describe copies in this app. They do not tell us when Google or Chase last checked the source. No source was refreshed.</p><ul>'+freshness.sources.map(source=>'<li><strong>'+e(labels[source.provider]||'Saved source')+'</strong>: '+(source.count===0?'No saved snapshots.':e(source.count)+' saved snapshots. '+(source.oldestSavedAt&&source.newestSavedAt?'Saved '+e(briefInstant(source.oldestSavedAt,timeZone))+(source.oldestSavedAt!==source.newestSavedAt?' through '+e(briefInstant(source.newestSavedAt,timeZone)):'')+'. ':'')+(source.unknownSavedAtCount?e(source.unknownSavedAtCount)+(source.unknownSavedAtCount===1?' save time unknown. ':' save times unknown. '):'')+'Last source check unknown.')+'</li>').join('')+'</ul>';
}
function filteredSavedItems(records,query='',provider='all'){
 const needle=String(query).trim().toLocaleLowerCase('en-US');
 return records.filter(r=>(provider==='all'||r.provider===provider)&&(!needle||[r.title,r.sender,r.calendarTitle].some(value=>String(value||'').toLocaleLowerCase('en-US').includes(needle)))).slice().sort((a,b)=>(Date.parse(b.receivedAt||b.start||b.startDate)||0)-(Date.parse(a.receivedAt||a.start||a.startDate)||0)||String(a.id).localeCompare(String(b.id)));
}
function savedSourceLabel(provider){return{gmail:'Gmail',google_calendar:'Google Calendar',mac_calendar:'Mac Calendar'}[provider]||'Saved source';}
function renderSavedRows(){
 checkCurrent(generation);
 const target=document.getElementById('saved-source-results');if(!target)return;
 const rows=filteredSavedItems(savedSourceItems,document.getElementById('saved-source-search')?.value,document.getElementById('saved-source-provider')?.value||'all');
 target.innerHTML='<p role="status">'+rows.length+' of '+savedSourceItems.length+' saved items. Snapshots only; no source has been refreshed.</p>'+(rows.length?'<ul>'+rows.map(r=>'<li><strong>'+e(r.title||(r.provider==='gmail'?'(No subject)':'Untitled event'))+'</strong> · '+e(savedSourceLabel(r.provider))+' · '+e(r.fictional?'Fictional test record':'Saved source snapshot')+(r.calendarTitle?' · '+e(r.calendarTitle):'')+'<br>'+e(r.sender|| (r.allDay?r.startDate+' through '+r.endDateExclusive+' (end excluded)':r.start||''))+(r.receivedAt?'<br>Received: '+e(r.receivedAt):'')+'</li>').join('')+'</ul>':'<p>No saved items match. Try another search or source.</p>');
}
controls.addEventListener('input',event=>{if(event.target.id==='saved-source-search')try{renderSavedRows();}catch{}});
controls.addEventListener('change',event=>{if(event.target.id==='saved-source-provider')try{renderSavedRows();}catch{}});
let sessionChannel;try{if(typeof BroadcastChannel!=='undefined'){sessionChannel=new BroadcastChannel('cc-private-development-session');sessionChannel.onmessage=event=>{if(event.data==='signed-out'){clearPrivateView();status.textContent='Signed out in another tab. Reload to sign in again.';}};}}catch{}
function clearPrivateView(){clearTimeout(macReviewTimer);clearTimeout(macPreviewTimer);savedSourceItems=[];generation++;clearTimeout(sessionTimer);csrf=null;sessionExpiresAt=null;supportsSaveReview=false;controls.innerHTML='';}
function checkCurrent(expected){
 if(closed||expected!==generation)throw Error('Page session ended.');
 if(sessionExpiresAt!==null&&sessionExpiresAt<=Date.now()){clearPrivateView();throw Error('Page session expired.');}
}
const previewFailureMessages=Object.freeze({
 'reconnect-required':'Google authorization expired. Reconnect Google before previewing again.',
 'access-denied':'Google denied access. Check the read-only permission for this connection.',
 'selection-changed':'This selection changed. Reload the current saved selection before previewing.',
 'session-ended':'Your app session ended. Sign in before previewing again.',
 'incomplete-read':'The preview read was incomplete. No partial snapshot was accepted.',
 'source-unavailable':'The Google source is unavailable. Check the connection before trying again.'
});
async function request(path,options={}){
 const expected=generation;checkCurrent(expected);
 const r=await fetch(path,{...options,cache:'no-store'});checkCurrent(expected);
 const data=await r.json();checkCurrent(expected);
 if(!r.ok){
  const previewMessage=path==='/auth/google/preview'&&typeof data?.outcome==='string'&&Object.hasOwn(previewFailureMessages,data.outcome)
   ?previewFailureMessages[data.outcome]:null;
  const failure=Error(data?.error||'Connection unavailable.');
  if(previewMessage)failure.previewMessage=previewMessage;
  throw failure;
 }
 return data;
}
window.addEventListener('pagehide',()=>{closed=true;clearPrivateView();sessionChannel?.close();status.textContent='Private connections page closed.';});
async function show(){
 clearTimeout(sessionTimer);savedSourceItems=[];
 let state=await request('/auth/google/status');if(state.signedIn&&(!Number.isFinite(state.expiresAt)||state.expiresAt<=Date.now())){clearPrivateView();status.textContent='Session ended. Reload to sign in again.';return;}sessionExpiresAt=state.signedIn?state.expiresAt:null;csrf=state.csrf;supportsSaveReview=state.saveReviewAvailable===true;
 // Remove only this tab's legacy development refresh-token entry; never read its contents.
 if(/^cc_m0e_dev_session_[a-z0-9-]{10,32}$/.test(state.legacySessionKey||''))try{sessionStorage.removeItem(state.legacySessionKey);}catch{}
 if(!state.configured){status.textContent='Google development credentials are not installed yet. The live app is unchanged.';controls.innerHTML='';return;}
 if(!state.signedIn){
  status.textContent='Sign in with your development test account. Session credentials stay on the local server; sign-in lasts up to 30 minutes.';
  controls.innerHTML='<form id="connection-login"><label class="field-label">Development email<input type="email" name="email" autocomplete="username" required></label><label class="field-label">Development password<input type="password" name="password" autocomplete="current-password" required></label><button class="btn" type="submit">Sign in</button></form>';return;
 }
 if(Number.isFinite(state.expiresAt))sessionTimer=setTimeout(()=>{clearPrivateView();busy=false;show().catch(()=>{status.textContent='Session ended. Reload to sign in again.';});},Math.max(0,state.expiresAt-Date.now()));
 status.textContent='App sign-in verified. Google authorization is a separate step. No source data is imported here.';
 controls.innerHTML='<button class="btn" data-provider="google_calendar">Authorize read-only Google Calendar</button> <button class="btn" data-provider="gmail">Authorize read-only Gmail</button><p>Google may grant mailbox-wide read permission. Later label/date selection limits what this app imports. Mail bodies, attachments and mailbox changes are not enabled by this page.</p><button class="btn" id="connection-signout">Sign out of development connections</button>'+
  state.connections.map(connectionControls).join('')+(state.macCalendarTransferAvailable?'<section class="panel"><h2>Temporary Mac calendar Brief</h2><p>Prepare a one-use transfer, then choose Review in Daily Brief in the Mac helper. Only the separately approved calendar selection is accepted. Events remain temporarily on this Mac for up to five minutes; transferring a preview does not save it to the database.</p><button class="btn" data-mac-prepare="true">Prepare approved Mac transfer</button> <button class="btn" data-mac-brief="true">View temporary Mac calendar Brief</button><p>Uses the Brief date and time zone below. Missing events do not mean your calendar is free.</p><div class="mac-calendar-brief" role="status"></div>'+(state.macCalendarIdentityReviewAvailable?'<p>This approved review also includes event and calendar identifiers to recognize repeat copies. Identifiers stay on this Mac during review. Saving is a separate action and requires approval.</p><button class="btn" data-mac-items="true">Choose Mac events to review</button><div class="mac-calendar-review" role="status"></div>':'')+'</section>':'')+(state.macCalendarSavedAvailable?'<section class="panel"><h2>Saved Mac calendar snapshots</h2><p>Private encrypted copies already saved in development. Viewing does not read Calendar on your Mac.</p><button class="btn" data-mac-saved="true">View saved Mac calendar snapshots</button><div class="saved-mac-calendar" role="status"></div></section>':'')+'<section class="panel"><h2>Saved-source Daily Brief</h2><p>Read saved email subjects, calendar events for a selected day and time zone, and financial snapshot counts. These may be out of date; no source is refreshed and no action is taken.</p><label class="field-label">Brief date<input type="date" id="saved-brief-day" aria-label="Brief date" value="'+briefToday(briefDefaultZone)+'" min="2000-01-01" max="2100-12-31"></label><label class="field-label">Brief time zone<select id="saved-brief-zone" aria-label="Brief time zone">'+briefZoneOptions()+'</select></label><button class="btn" data-saved-brief="true">View saved-source Brief</button> <button class="btn" data-brief-day="-1">Previous day</button> <button class="btn" data-brief-day="1">Next day</button> <button class="btn" data-brief-day="today">Today</button><div class="saved-source-brief" role="status"></div></section><section class="panel"><h2>Saved source items</h2><p>View private snapshots already saved in your development account. This does not read Google, Calendar on your Mac, or refresh a source.</p><button class="btn" data-saved="true">View saved source items</button><div class="saved-source-items" role="status"></div></section>';
}
controls.addEventListener('submit',async event=>{
 if(event.target.classList.contains('import-review')){
  event.preventDefault();if(busy)return;busy=true;
  const form=event.target,result=form.querySelector('.review-result'),button=form.querySelector('button');button.disabled=true;
  try{const values=new FormData(form),data=await request(supportsSaveReview?'/auth/google/save-review':'/auth/google/review',{method:'POST',headers:{'Content-Type':'application/json','X-CC-CSRF':csrf},body:JSON.stringify({previewId:form.dataset.previewId,selectedKeys:values.getAll('item')})});if(data.reviewOnly){result.textContent=data.selectedCount+' selected items reviewed. Nothing saved. Saving requires an approved source selection.';}else result.innerHTML=e('New: '+data.insertCount+' · Already saved: '+data.unchangedCount+' · Conflicts: '+data.conflictCount+'. Nothing saved by this review.')+(data.saveEnabled?'<button class="btn btn-primary" type="button" data-save-review="'+e(data.reviewId)+'">Save reviewed items</button>':'<p>Saving is disabled until this exact source selection is approved. Changed records are not overwritten.</p>');}
  catch{result.textContent='Review unavailable. The preview may have expired or the connection changed. Read a fresh preview before reviewing.';}
  finally{busy=false;button.disabled=false;}return;
 }
 if(event.target.classList.contains('mac-import-review')){
  event.preventDefault();if(busy)return;busy=true;const form=event.target,result=form.querySelector('.mac-review-result'),button=form.querySelector('button');button.disabled=true;
  try{const values=new FormData(form),data=await request('/auth/google/mac-calendar-review',{method:'POST',headers:{'Content-Type':'application/json','X-CC-CSRF':csrf},body:JSON.stringify({selectedKeys:values.getAll('mac-item')})});if(!Number.isFinite(data.expiresAt)||data.expiresAt<=Date.now())throw Error('Preview expired');result.innerHTML=e('New: '+data.insertCount+' · Already saved: '+data.unchangedCount+' · Conflicts: '+data.conflictCount+'. Nothing saved.')+(data.saveEnabled?'<p>Save only these reviewed events as encrypted private copies in the development database. Calendar events will not be changed.</p><button class="btn" type="button" data-mac-save-review="'+e(data.reviewId)+'">Save reviewed Mac events</button>':'<p>Database saving is disabled or no new conflict-free events are ready. Separate approval is required to enable saving.</p>');}
  catch{result.textContent='Review unavailable or expired. No records were saved. Check the selection and app sign-in.';}finally{busy=false;button.disabled=false;}return;
 }
 if(event.target.classList.contains('source-selection')){
  event.preventDefault();if(busy)return;busy=true;
  const form=event.target,values=new FormData(form),result=form.querySelector('.selection-result'),button=form.querySelector('button');button.disabled=true;
  try{await request('/auth/google/selection',{method:'POST',headers:{'Content-Type':'application/json','X-CC-CSRF':csrf},body:JSON.stringify({connectionId:form.dataset.connection,selection:{source:values.get('source'),startDate:values.get('startDate'),endDate:values.get('endDate')}})});result.textContent='Selection saved privately on this Mac. No data has been read or imported. Refresh to review or preview the saved choice.';}
  catch{result.textContent='Selection could not be saved. Check the dates and sign-in, then retry.';}
  finally{busy=false;button.disabled=false;}return;
 }
 if(event.target.id!=='connection-login')return;event.preventDefault();if(busy)return;busy=true;
 const values=new FormData(event.target);controls.innerHTML='';
 try{await request('/auth/google/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:values.get('email'),password:values.get('password')})});values.delete('password');await show();}catch{await show().catch(()=>{});status.textContent='Development sign-in failed. Check the test account and retry.';const email=controls.querySelector('input[name="email"]');if(email)email.value=String(values.get('email')||'');}finally{busy=false;}
});
controls.addEventListener('change',event=>{const macForm=event.target.closest('form.mac-import-review');if(macForm)macForm.querySelector('.mac-review-result').textContent='Selection changed. Review again; nothing saved.';const form=event.target.closest('form.import-review');if(form)form.querySelector('.review-result').textContent='Selection changed. Review again before saving.';});
controls.addEventListener('click',async event=>{
 if(busy)return;const button=event.target.closest('button');if(!button||(button.closest('form')&&!button.dataset.saveReview&&!button.dataset.macSaveReview))return;busy=true;button.disabled=true;
 try{
  if(button.id==='connection-signout'){const previousCsrf=csrf;clearPrivateView();sessionChannel?.postMessage('signed-out');await request('/auth/google/signout',{method:'POST',headers:{'Content-Type':'application/json','X-CC-CSRF':previousCsrf},body:'{}'});await show();return;}
  if(button.dataset.macSaveReview){
   const target=button.closest('form').querySelector('.mac-review-result');
   try{const data=await request('/auth/google/mac-calendar-save',{method:'POST',headers:{'Content-Type':'application/json','X-CC-CSRF':csrf},body:JSON.stringify({reviewId:button.dataset.macSaveReview,approved:true})});target.textContent='Saved and verified: '+data.inserted+' · Already saved: '+data.unchanged+'. Private encrypted development snapshots. View saved Mac calendar snapshots to check them.';}
   catch{target.textContent='Save was not confirmed. Check saved Mac calendar snapshots and make a fresh review before retrying. No automatic retry was attempted.';}return;
  }
  if(button.dataset.macSaved){
   const target=button.parentElement.querySelector('.saved-mac-calendar');target.textContent='Reading saved private Mac snapshots…';
   try{const data=await request('/auth/google/mac-calendar-saved');target.innerHTML='<p>'+data.records.length+' saved Mac calendar snapshots. Not a live calendar feed. Temporary previews are separate.</p>'+(data.records.length?'<ul>'+data.records.map(row=>'<li><strong>'+e(row.title||'Untitled event')+'</strong> · '+e(row.calendarTitle)+' · '+e(row.fictional?'Fictional test snapshot':'Saved Mac snapshot')+'<br>'+e(row.allDay?row.startDate+' through '+row.endDateExclusive+' (all day, end excluded)':briefInstant(row.start,briefDefaultZone)+' through '+briefInstant(row.end,briefDefaultZone))+'<br>'+e(row.savedAt?'Saved '+briefInstant(row.savedAt,briefDefaultZone):'Save time unknown')+'</li>').join('')+'</ul>':'<p>No saved Mac calendar snapshots.</p>');}
   catch{target.textContent='Saved Mac snapshots are unavailable. No partial list is shown. Check app sign-in and retry.';}return;
  }
  if(button.dataset.macItems){
   const target=button.parentElement.querySelector('.mac-calendar-review');clearTimeout(macReviewTimer);target.textContent='Reading the temporary Mac selection…';
   try{const data=await request('/auth/google/mac-calendar-items');if(!Number.isFinite(data.expiresAt)||data.expiresAt<=Date.now())throw Error('Preview expired');
    target.innerHTML='<p>'+data.events.length+' events in the transferred selection. Select only events you want to review. Nothing is selected automatically; nothing will be saved.</p>'+(data.events.length?'<form class="mac-import-review"><ul>'+data.events.map(row=>'<li><label><input type="checkbox" name="mac-item" value="'+e(row.key)+'"> '+e(row.title||'Untitled event')+' · '+e(row.calendarTitle)+' · '+e(row.allDay?row.startDate+' through '+row.endDateExclusive+' (all day, end excluded)':briefInstant(row.start,data.scope.timeZone)+' through '+briefInstant(row.end,data.scope.timeZone))+'</label></li>').join('')+'</ul><button class="btn" type="submit">Review selected Mac events</button><p class="mac-review-result" role="status"></p></form>':'<p>No events were transferred.</p>');
    macReviewTimer=setTimeout(()=>{target.textContent='Temporary Mac review expired. Nothing saved.';},Math.max(0,data.expiresAt-Date.now()));
   }catch{target.textContent='Mac review is unavailable or expired. No records were saved.';}return;
  }
  if(button.dataset.macPrepare||button.dataset.macBrief){
   const target=button.parentElement.querySelector('.mac-calendar-brief');clearTimeout(macPreviewTimer);target.textContent='Checking temporary Mac preview…';
   try{
    if(button.dataset.macPrepare){const data=await request('/auth/google/mac-calendar-prepare',{method:'POST',headers:{'Content-Type':'application/json','X-CC-CSRF':csrf},body:'{}'});target.textContent='Ready for '+data.scope.calendarCount+' calendars, at most '+data.scope.maxEvents+' events, '+data.scope.startDate+' through '+data.scope.endDateExclusive+' (end excluded), '+data.scope.timeZone+'. In the Mac helper, preview this selection and choose Review in Daily Brief. Nothing saved.';}
    else{const day=briefDay(document.getElementById('saved-brief-day')?.value),timeZone=document.getElementById('saved-brief-zone')?.value||'UTC';const data=await request('/auth/google/mac-calendar-brief?day='+encodeURIComponent(day)+'&timeZone='+encodeURIComponent(timeZone));
     if(!Number.isFinite(data.expiresAt)||data.expiresAt<=Date.now())throw Error('Expired');
     target.innerHTML='<h3>'+e(data.day)+' · '+e(data.timeZone)+' · Temporary Mac snapshot</h3><p>Not saved. Your Mac calendar may lag iCloud. No AI processing or actions.</p>'+(data.events.length?'<ul>'+data.events.map(r=>'<li><strong>'+e(r.title||'Untitled event')+'</strong> · '+e(r.calendarTitle)+'<br>'+e(r.allDay?'All day: '+r.startDate+' through '+r.endDateExclusive+' (end excluded)':briefInstant(r.start,data.timeZone)+' through '+briefInstant(r.end,data.timeZone))+'</li>').join('')+'</ul>':'<p>No transferred events overlap this day.</p>');
     macPreviewTimer=setTimeout(()=>{target.textContent='Temporary Mac preview expired. Nothing saved.';},Math.max(0,data.expiresAt-Date.now()));
    }
   }catch{target.textContent='No current Mac preview is available. Check sign-in and the approved selection, then prepare a fresh transfer. Nothing saved.';}return;
  }
  if(button.dataset.saveReview){
   const target=button.closest('form').querySelector('.review-result');
   try{const data=await request('/auth/google/save',{method:'POST',headers:{'Content-Type':'application/json','X-CC-CSRF':csrf},body:JSON.stringify({reviewId:button.dataset.saveReview,approved:true})});target.textContent=data.inserted+' items saved and verified, '+data.unchanged+' already saved. Use View saved source items to see snapshots.';}
   catch{target.textContent='Save not confirmed or not approved. Read the saved source items and prepare a fresh review before retrying. No automatic retry was attempted.';}return;
  }
  if(button.dataset.savedBrief||button.dataset.briefDay){
   const target=button.parentElement.querySelector('.saved-source-brief');target.textContent='Reading saved snapshots…';
   try{const input=document.getElementById('saved-brief-day'),timeZone=document.getElementById('saved-brief-zone')?.value||'UTC';let day;try{day=button.dataset.briefDay==='today'?briefDay(briefToday(timeZone)):briefDay(input?.value,Number(button.dataset.briefDay||0));}catch{target.textContent='Choose a valid Brief date and time zone from 2000 through 2100.';return;}input.value=day;const data=await request('/auth/google/saved-brief?day='+encodeURIComponent(day)+'&timeZone='+encodeURIComponent(timeZone));
    target.innerHTML='<h3>'+e(data.day)+' · '+e(data.timeZone||'UTC')+' · Saved snapshots</h3><p>Sources were not refreshed. This filters the currently saved snapshots, not a preserved historical copy. Missing saved events do not mean your calendar is free. Saved email subjects do not establish unread status or required actions.</p><h4>Saved calendar events overlapping this day</h4>'+(data.events.length?'<ul>'+data.events.map(r=>'<li><strong>'+e(r.title||'Untitled event')+'</strong> · '+(r.provider==='mac_calendar'?e('Mac Calendar · '+r.calendarTitle)+' · ':'')+e(r.allDay?'All day: '+r.startDate+' through '+r.endDateExclusive+' (end excluded)':briefInstant(r.start,data.timeZone||'UTC')+' through '+briefInstant(r.end,data.timeZone||'UTC'))+'</li>').join('')+'</ul>':'<p>No saved event snapshots overlap this selected day.</p>')+'<h4>Recent saved email subjects received by this selected day</h4>'+(data.recentMail.length?'<ul>'+data.recentMail.map(r=>'<li>'+e(r.title||'(No subject)')+' · '+e(briefInstant(r.receivedAt,data.timeZone||'UTC'))+'</li>').join('')+'</ul>':'<p>No saved email snapshots were received by this selected day.</p>')+'<p>'+data.savedMailCount+' saved email snapshots in total. Showing at most five subjects received by the selected day.</p>'+savedFreshnessHtml(data.freshness,data.timeZone||'UTC')+'<h4>Saved financial snapshot inventory · not date-filtered</h4><p>'+data.financialAccounts+' accounts · '+data.financialTransactions+' transactions. Amounts are not included in this Brief. These are saved counts, not live balances or reconciled spending.</p><a class="btn" href="/auth/google/finances/">View saved financial snapshots</a>';
   }catch{target.textContent='Saved-source Brief unavailable. Sign in again and retry. No partial Brief is shown.';}return;
  }
  if(button.dataset.saved){
   const target=button.parentElement.querySelector('.saved-source-items');savedSourceItems=[];target.textContent='Loading saved items…';
   try{const data=await request('/auth/google/records');savedSourceItems=data.records;
    target.innerHTML='<label class="field-label">Search saved titles, senders and calendars<input id="saved-source-search" aria-label="Search saved titles, senders and calendars" type="search" maxlength="300" autocomplete="off"></label><label class="field-label">Saved source<select id="saved-source-provider" aria-label="Saved source"><option value="all">All sources</option><option value="gmail">Gmail</option><option value="google_calendar">Google Calendar</option><option value="mac_calendar">Mac Calendar</option></select></label><div id="saved-source-results"></div>';renderSavedRows();}
   catch{savedSourceItems=[];target.textContent='Saved source items are unavailable. Sign in again and retry. No partial list is shown.';}return;
  }
  if(button.dataset.pause){
   await request('/auth/google/pause',{method:'POST',headers:{'Content-Type':'application/json','X-CC-CSRF':csrf},body:JSON.stringify({connectionId:button.dataset.pause,paused:button.dataset.paused!=='true'})});await show();return;
  }
  if(button.dataset.preview){
   const target=button.parentElement.querySelector('.source-preview');target.textContent='Reading the saved selection…';
   try{const data=await request('/auth/google/preview',{method:'POST',headers:{'Content-Type':'application/json','X-CC-CSRF':csrf},body:JSON.stringify({connectionId:button.dataset.preview,selectionId:button.dataset.selection,confirmed:true})});
    const rows=data.result.messages||data.result.events||[];
    target.innerHTML='<p>Read at '+e(data.readAt)+'. This is a snapshot, not a live feed.</p><p>'+rows.length+' '+(rows.length===1?'item':'items')+' in this preview. Nothing saved to the app database.</p>'+(rows.length?'<form class="import-review" data-preview-id="'+e(data.previewId)+'"><p>Select up to 250 items to review. Nothing is selected automatically. Review expires after five minutes and does not save items.</p><ul>'+rows.map(r=>'<li><label><input type="checkbox" name="item" value="'+e(r.key)+'"> '+e(r.subject||r.title)+' · '+e(r.sender||r.start||r.startDate||'')+'</label></li>').join('')+'</ul><button class="btn" type="submit">Review selected items</button><p role="status" class="review-result"></p></form>':'<p>No items to review in this window.</p>');
   }catch(error){target.textContent=error?.previewMessage??'Preview unavailable. Reload and check your sign-in or reconnect Google. No partial result was accepted.';}return;
  }
  if(button.dataset.provider){const result=await request('/auth/google/begin',{method:'POST',headers:{'Content-Type':'application/json','X-CC-CSRF':csrf},body:JSON.stringify({provider:button.dataset.provider})});location.assign(result.authorizationUrl);}
 }catch{status.textContent='Connection did not complete. Sign in again or retry.';}finally{busy=false;button.disabled=false;}
});
show().catch(()=>{status.textContent='Development setup is unavailable. Check the local server configuration.';});
