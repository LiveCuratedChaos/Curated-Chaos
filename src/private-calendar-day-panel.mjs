import {escapeHtml as e} from './core.mjs';
import {verifyCalendarDay,validateCalendarDayFields} from './private-calendar-day.mjs';
import {eventCopyDraft} from './private-event-copy.mjs';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export function createCalendarDayPanel({client,clock=Date.now,calendarAccent=()=>'inherit',allowFavorites=false,handingOff=()=>false,onColor=null,canUse=()=>false,onChange=()=>{}}){
 let generation=0,opened=false,busy=false,disposed=false,fields=null,view=null,details=null,error='',timer=null;
 const current=n=>!disposed&&generation===n&&canUse(),changed=focus=>{if(!disposed)onChange(canUse()?focus:undefined);};
 const fresh=expiry=>Number.isFinite(expiry)&&expiry>clock()&&expiry<=clock()+300000;
 function clearTimer(){if(timer!==null)clearTimeout(timer);timer=null;}
 function expire(){clearTimer();view=null;details=null;error='This day schedule expired. Close it and open the date again for a fresh schedule.';changed();}
 function arm(){clearTimer();const expires=Math.min(view?.expiresAt??Infinity,details?.expiresAt??Infinity);if(Number.isFinite(expires)){timer=setTimeout(()=>{if(!canUse()&&!handingOff()){view=null;details=null;changed();return;}if(details&&details.expiresAt<=clock()&&view?.expiresAt>clock()){details=null;error='The event details expired. Open the event again for fresh details.';arm();changed();}else expire();},Math.max(0,expires-clock()));timer.unref?.();}}
 function reset(){generation++;clearTimer();opened=false;busy=false;fields=null;view=null;details=null;error='';}
 async function load(values){
  if(disposed||!canUse()||busy)return;
  try{values=validateCalendarDayFields(values);}catch{return;}
  const n=++generation;clearTimer();opened=true;busy=true;fields={...values};view=null;details=null;error='';changed();
  try{const value=await client.calendarDayList({...fields});if(!current(n))return;view=structuredClone(verifyCalendarDay(value,fields,{now:clock()}));arm();}
  catch{if(current(n)){view=null;error='The saved day schedule could not be verified. Close it and open the date again. No connected calendar was refreshed.';}}
  finally{if(!disposed&&generation===n){busy=false;if(!canUse()){view=null;details=null;clearTimer();}changed('#private-calendar-day-title');}}
 }
 async function read(token){
  if(disposed||!canUse()||busy||!view)return;if(!fresh(view.expiresAt)){expire();return;}
  const row=view.events.find(r=>r.eventReadToken===token);if(!row)return;
  const n=++generation,expiry=view.expiresAt;busy=true;details=null;error='';changed();
  try{
   const response=await client.calendarDayRead({eventReadToken:token});if(!current(n))return;
   if(!response||typeof response!=='object'||Array.isArray(response)||Object.keys(response).some(key=>!['title','day','time','end_time','section','location','description','all_day','end_day','expiresAt','readOnly'].includes(key)))throw Error();
   const value={all_day:false,end_day:'',...response};
   const keys=['title','day','time','end_time','section','location','description','all_day','end_day','expiresAt','readOnly'];
   if(!exact(value,keys)||value.readOnly!==true||!fresh(value.expiresAt)||value.expiresAt>expiry||value.title!==row.title||value.day!==row.day||value.time!==row.time||!fresh(expiry))throw Error();
   const {readOnly,...copy}=value;eventCopyDraft(copy,{now:clock()});
   if(Boolean(row.allDay)!==value.all_day||(row.endDay||'')!==(value.end_day>value.day?value.end_day:'')||(row.endTime||'')!==value.end_time||row.endDateUnavailable||row.endTimeUnavailable)throw Error();
   details={...structuredClone(value),eventReadToken:token};arm();
  }catch{if(current(n)){details=null;error='Event details could not be verified. The saved schedule remains available while it is fresh.';}}
  finally{if(!disposed&&generation===n){busy=false;if(!canUse()){view=null;details=null;clearTimer();}changed(details?'#private-calendar-day-details-title':'#private-calendar-day-status');}}
 }
 const schedule=row=>`${row.allDay?'All day':row.time}${row.endTime?'–'+row.endTime:''}${row.endDay?' · through '+row.endDay:''}${row.day<fields.day?' · Continuing from '+row.day:''}${row.endDateUnavailable||row.endTimeUnavailable?' · Complete schedule unavailable':''}`;
 function render(){
  if(disposed||!opened||!canUse()&&!handingOff())return'';
  if(view&&!fresh(view.expiresAt)){view=null;details=null;clearTimer();error='This day schedule expired. Close it and open the date again for a fresh schedule.';}
  if(details&&!fresh(details.expiresAt)){details=null;error='The event details expired. Open the event again for fresh details.';}
  const button=(id,label,disabled=false)=>`<button type="button" class="btn" id="${id}"${disabled?' disabled':''}>${label}</button>`;
  return`<section class="panel" id="private-calendar-day-panel"${handingOff()?' inert':''} data-category-color="${e(calendarAccent())}" aria-labelledby="private-calendar-day-title"><h2 id="private-calendar-day-title" tabindex="-1">Date schedule</h2><p class="tiny muted">Saved workspace events only · New York time · Current records, not a historical snapshot.</p><p>${e(fields.day)}${fields.eventKind?' · '+(fields.eventKind==='allDay'?'All-day events':'Timed events'):''}${fields.eventSource?' · '+e({manual:'Manual calendar',saved:'Saved calendar',other:'Other saved calendar'}[fields.eventSource]):''}${fields.eventCategory?' · '+e(fields.eventCategory):''}${fields.query?' · Filter: '+e(fields.query):''}</p>${button('private-calendar-day-close','Close day schedule')}<p id="private-calendar-day-status" role="status" tabindex="-1">${busy?'Loading saved schedule…':e(error)}</p>${view?`<p>${view.matchCount} matching saved events. Checked ${e(view.checkedAt)}.${view.omittedRecords||view.dateRangeUnavailableRecords?' '+view.omittedRecords+' omitted records; '+view.dateRangeUnavailableRecords+' records with unavailable date ranges. This schedule may be incomplete.':''}</p>${view.matchCount===0?'<p>No matching saved events were verified for this date.</p>':''}<ol start="${view.offset+1}">${view.events.map(row=>`<li${row.displayColor?' data-category-color="'+e(row.displayColor)+'"':''}><strong>${e(row.title)}</strong><p>${e(schedule(row))}</p>${row.eventReadToken?`<button type="button" class="btn" data-calendar-day-event="${e(row.eventReadToken)}"${busy?' disabled':''}>Open schedule event<span class="sr-only">: ${e(row.title)}</span></button>`:'<p>Event details unavailable.</p>'}</li>`).join('')}</ol>${button('private-calendar-day-previous','Previous schedule events',busy||view.offset===0)}${button('private-calendar-day-next','Next schedule events',busy||view.offset+50>=view.matchCount)}`:''}${details?`<section id="private-calendar-day-details" aria-labelledby="private-calendar-day-details-title"><h3 id="private-calendar-day-details-title" tabindex="-1">${e(details.title)}</h3><p>${e(details.day)} · ${e(details.all_day?'All day':details.time)}${details.end_time?'–'+e(details.end_time):''}${details.end_day?' · through '+e(details.end_day):''}</p><p>${e(details.location||'No location saved.')}</p><pre class="private-note-body" tabindex="0" aria-label="Schedule event details">${'\n'+e(details.description||'No details saved.')}</pre>${allowFavorites?`<button type="button" class="btn" data-kind="event" data-favorite-item-action="select" data-selection="${e(details.eventReadToken)}">Manage event favorite</button>`:''}${onColor?button('private-calendar-day-color','Change event color'):''}${button('private-calendar-day-details-close','Close event details')}</section>`:''}</section>`;
 }
 function click(event){const target=event?.target;if(!target?.closest||handingOff())return false;
  if(target.closest('#private-calendar-day-close')){const date=fields?.day;reset();changed(date?'[data-private-calendar-day="'+date+'"]':undefined);return true;}
  if(!canUse()||disposed)return false;
  if(target.closest('#private-calendar-day-color')){
   if(onColor&&!busy&&details&&fresh(details.expiresAt)){
    const item={kind:'event',token:details.eventReadToken,title:details.title,section:'Calendar'};
    reset();onColor(item);
   }
   return true;
  }
  if(target.closest('#private-calendar-day-details-close')){details=null;arm();changed();return true;}
  const selected=target.closest('[data-calendar-day-event]');if(selected){void read(selected.dataset.calendarDayEvent);return true;}
  for(const [id,delta]of [['previous',-50],['next',50]])if(target.closest('#private-calendar-day-'+id)){if(!busy&&view&&fresh(view.expiresAt)&&view.offset+delta>=0&&view.offset+delta<view.matchCount)void load({...fields,offset:view.offset+delta});return true;}
  return false;
 }
 return{open:values=>load({...values,offset:0}),blocked:()=>busy,closeForFavorite(){const day=fields?.day;reset();return day;},reset,offline(){generation++;clearTimer();busy=false;view=null;details=null;if(opened)error='The day schedule is unavailable while disconnected. Close it and open the date again after reconnecting.';changed();},dispose(){reset();disposed=true;},render,click};
}
