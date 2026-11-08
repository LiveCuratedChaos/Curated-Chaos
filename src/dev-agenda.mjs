// M1B seven-day private development agenda. No real calendar provider or household data.
import { createDevApi } from './dev-api.mjs';
import { createDevSessionManager } from './dev-session.mjs';
import { renderConnectedShell } from './dev-cloud-shell.mjs';
import { escapeHtml as e, dayString, formatDate } from './core.mjs';
import { normalizeCloudRecords, validDay } from './dev-brief-model.mjs';
import { makeFictionalEvent, agendaForWeek } from './dev-agenda-model.mjs';

const root=document.getElementById('connected-agenda');
let api=null,config=null,auth=null,user=null,records={tasks:[],notes:[],events:[]},busy=false,notice='',error='',generation=0,selectedDay=dayString();
const reset=()=>{user=null;records={tasks:[],notes:[],events:[]};generation++;};
const alertUi=()=>`${error?`<p class="warning" role="alert">${e(error)}</p>`:''}${notice?`<div class="notice" role="status">${e(notice)}</div>`:''}`;
const panel=(title,inner)=>`<section class="panel"><div class="panel-head"><h2>${e(title)}</h2></div>${inner}</section>`;
function show(){
  const signedIn=Boolean(user && auth?.get());
  const header=`<section class="connected-card"><p class="eyebrow">CURATED CHAOS · MILESTONE 1B</p><h1>Seven-Day Agenda</h1><p class="muted">Cloud-saved fictional events and tasks · isolated test project only</p><p class="tiny muted">No Google Calendar, iCloud, email, bank, or household connections.</p>${alertUi()}`;
  let main='';
  if(!api){main='<p>Loading isolated development settings…</p>'}
  else if(!signedIn){main=`${panel('Sign in to your test account',`<form id="agenda-login" autocomplete="off"><label class="field-label">Test email<input name="email" type="email" autocomplete="username" required></label><label class="field-label">Test password<input type="password" name="password" required autocomplete="off"></label><button class="btn btn-primary" type="submit" ${busy?'disabled':''}>Sign in</button></form><p class="tiny muted">Use fictional QA accounts only. Session is remembered in this tab for up to 12 hours.</p>`)}`}
  else{
    const rows=agendaForWeek(records,selectedDay);
    const days=rows.map(d=>`<section class="week-agenda-day"><h3>${e(formatDate(d.day,{year:'numeric'}))}</h3>${d.items.length?`<ul class="item-list">${d.items.map(i=>`<li class="item"><span class="agenda-kind">${i.kind==='event'?'EVENT':'TASK'}</span><div class="item-main"><strong class="${i.done?'completed':''}">${e(i.title)}</strong><small>${i.kind==='event'?e(i.time)+' · ':''}${e(i.section)} · PRIVATE CLOUD · FICTIONAL${i.done?' · COMPLETED':''}</small></div></li>`).join('')}</ul>`:'<p class="empty">No fictional cloud items for this date.</p>'}</section>`).join('');
    main=`<div class="auth-user"><p class="muted">Signed in as <strong>${e(user.email)}</strong></p><button class="btn" id="agenda-logout" type="button">Sign out</button></div>
      ${panel('Add fictional calendar event',`<form id="agenda-add"><label class="field-label">Event title<input name="title" placeholder="Sample practice appointment" maxlength="140" required></label><div class="brief-fields"><label class="field-label">Date<input type="date" name="day" value="${e(dayString())}" required></label><label class="field-label">Start time<input type="time" name="time" value="09:00" required></label></div><button class="btn btn-primary" type="submit" ${busy?'disabled':''}>Save private fictional event</button></form><p class="tiny muted">Saves only to your dev Supabase account. It does not add an event to Google, Apple, or any other calendar.</p>`)}
      ${panel('Your next seven days',`<form id="agenda-filter" class="agenda-range"><label class="field-label">Start date<input type="date" name="start" value="${e(selectedDay)}" required></label><button class="btn" type="submit" ${busy?'disabled':''}>View seven days</button><button class="btn" type="button" id="agenda-today">Today</button><button class="btn" type="button" id="agenda-reload" ${busy?'disabled':''}>Refresh cloud data</button></form><div class="week-agenda">${days}</div>`)}
      <p class="tiny muted">Tasks from the cloud Tasks page appear alongside your fictional events. All data is private to this test account.</p>`;
  }
  root.innerHTML=renderConnectedShell(header+main+'</section>',{active:'agenda'});
}
function msg(m,isError=false){error=isError?m:'';notice=isError?'':m;show();}
async function load(){if(!user||!auth?.get())return;const seq=++generation;busy=true;show();try{const token=await auth.getAccessToken();const result=await api.listBriefRecords(token);if(seq!==generation)return;records=normalizeCloudRecords(result,user.id);error='';notice='Private cloud agenda loaded.';}catch(ex){if(seq!==generation)return;error=ex.message;notice='';if(!auth.get())reset();}finally{if(seq===generation){busy=false;show();}}}
root.addEventListener('submit',async ev=>{
  if(ev.target.id==='agenda-login'){
    ev.preventDefault();if(busy)return;const data=new FormData(ev.target);busy=true;show();try{const result=await auth.signIn(String(data.get('email')||'').trim(),String(data.get('password')||''));user=result.user;await load();}catch(err){reset();msg(err.message,true);}finally{busy=false;show();}
  }
  if(ev.target.id==='agenda-filter'){ev.preventDefault();const data=new FormData(ev.target);const start=String(data.get('start')||'');if(!validDay(start))return msg('Enter a valid starting date.',true);selectedDay=start;msg('Seven-day window updated.');}
  if(ev.target.id==='agenda-add'){
    ev.preventDefault();if(busy||!user||!auth?.get())return;
    const data=new FormData(ev.target);let payload;
    try{payload=makeFictionalEvent(Object.fromEntries(data.entries()),user.id);}catch(ex){return msg(ex.message,true);}
    const seq=++generation;busy=true;show();
    try{const token=await auth.getAccessToken();const reply=await api.addFictionalEvent(token,payload);if(seq!==generation)return;if(!Array.isArray(reply)||reply.length!==1)throw Error('Cloud event save could not be confirmed. Check the agenda before retrying.');selectedDay=payload.payload.day;await load();if(user)msg('Fictional event saved privately to the development cloud.');}
    catch(ex){if(seq===generation)msg(ex.message,true);}finally{if(seq===generation){busy=false;show();}}
  }
});
root.addEventListener('click',async ev=>{
  if(ev.target.closest('#agenda-today')){selectedDay=dayString();show();}
  if(ev.target.closest('#agenda-reload')){await load();}
  if(ev.target.closest('#agenda-logout')){reset();show();await auth.signOut();msg('Signed out.');}
});
(async()=>{
  try{const response=await fetch('/dev-config.json',{cache:'no-store'});if(!response.ok)throw Error('Development configuration unavailable. Copy your .env.local into this M1B folder.');
    config=await response.json();api=createDevApi(config);auth=createDevSessionManager(api,config.projectRef,window.sessionStorage);const restored=await auth.restore();if(restored){user=restored.user;await load();}show();
  }catch(err){root.innerHTML=`<p class="warning">${e(err.message)}</p>`;}
})();
