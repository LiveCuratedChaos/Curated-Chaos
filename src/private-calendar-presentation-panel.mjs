import {escapeHtml as e} from './core.mjs';
import {defaultCalendarPresentation,validateCalendarPresentation} from './private-calendar-presentation.mjs';

const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const exact=(value,keys)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(','));
const choices={dots:'Minimal dots',details:'Event details'};
const copy=value=>validateCalendarPresentation(value);
const same=(a,b)=>JSON.stringify(copy(a))===JSON.stringify(copy(b));

export function createCalendarPresentationPanel({client,clock=Date.now,canUse=()=>false,onChange=()=>{},onOpen=()=>{},onSaved=()=>{}}){
 let generation=0,opened=false,busy=false,locked=false,disposed=false,view=null,draft=null,review=null,pendingWrite=null,error='',notice='';
 const active=n=>!disposed&&n===generation,current=n=>active(n)&&canUse();
 const fresh=expiry=>Number.isFinite(expiry)&&expiry>clock()&&expiry<=clock()+300000;
 const changed=focus=>{if(!disposed)onChange(canUse()?focus:undefined);};
 function reset(){generation++;opened=false;busy=false;locked=false;view=null;draft=null;review=null;error='';notice='';}
 function finish(n,focus){if(!active(n))return;busy=false;if(!canUse()){view=null;review=null;locked=Boolean(draft);}changed(focus);}
 function editable(){return!disposed&&canUse()&&!busy&&!pendingWrite&&!locked&&!review&&draft&&view;}
 function requireFreshView(){if(view&&fresh(view.expiresAt))return true;review=null;view=null;locked=Boolean(draft);error='This display view expired. Keep your draft and fetch the latest display settings before reviewing.';changed('#private-calendar-presentation-error');return false;}
 async function read(){
  if(disposed||!canUse()||busy||pendingWrite)return;
  const first=!opened,n=++generation;opened=true;busy=true;view=null;review=null;locked=Boolean(draft);error='';notice='';if(first)onOpen();changed();
  try{
   const value=await client.calendarPresentationRead();if(!current(n))return;
   if(!exact(value,['layout','baseTag','viewId','expiresAt','readOnly'])||value.readOnly!==false||!token(value.baseTag)||!token(value.viewId)||!fresh(value.expiresAt))throw Error();
   const layout=copy(value.layout);view={baseTag:value.baseTag,viewId:value.viewId,expiresAt:value.expiresAt};draft=layout;locked=false;
  }catch{if(current(n)){view=null;review=null;locked=Boolean(draft);error='Calendar display settings could not be verified. Fetch the latest display settings before making changes.';}}
  finally{finish(n,error?'#private-calendar-presentation-error':'#private-calendar-presentation-title');}
 }
 async function prepare(){
  if(!editable()||!requireFreshView())return;
  const layout=copy(draft),baseTag=view.baseTag,expiresAt=view.expiresAt,n=++generation;busy=true;review=null;error='';notice='';changed();
  try{
   const value=await client.calendarPresentationReview({baseTag,layout});if(!current(n))return;
   if(exact(value,['noChanges'])&&value.noChanges===true){notice='Calendar display is unchanged.';return;}
   if(!exact(value,['layout','reviewId','expiresAt'])||!token(value.reviewId)||!fresh(value.expiresAt)||value.expiresAt>expiresAt||!same(value.layout,layout))throw Error();
   review={layout:copy(value.layout),reviewId:value.reviewId,expiresAt:value.expiresAt};
  }catch{if(current(n)){view=null;review=null;locked=true;error='The Calendar display review could not be verified. Keep your draft and fetch the latest display settings before trying again.';}}
  finally{finish(n,review?'#private-calendar-presentation-review-title':error?'#private-calendar-presentation-error':'#private-calendar-presentation-title');}
 }
 async function save(){
  if(disposed||!canUse()||busy||pendingWrite||locked||!review)return;
  if(!fresh(review.expiresAt)){review=null;view=null;locked=true;error='This display review expired. Keep your draft and fetch the latest display settings before trying again.';changed('#private-calendar-presentation-error');return;}
  const expected=copy(review.layout),reviewId=review.reviewId,n=++generation,marker={};pendingWrite=marker;busy=true;locked=true;review=null;error='';notice='';changed();
  try{
   const value=await client.calendarPresentationSave(reviewId);if(!current(n))return;
   if(!exact(value,['saved','layout'])||value.saved!==true||!same(value.layout,expected))throw Error();
   const saved=copy(value.layout);pendingWrite=null;reset();notice='Calendar display saved.';onSaved(saved);changed();
  }catch{if(current(n)){view=null;review=null;locked=true;error='The display save could not be confirmed and may have saved. Keep your display copy, then fetch the latest display settings before trying again. No change was retried.';}}
  finally{if(pendingWrite===marker){pendingWrite=null;if(active(n)){busy=false;if(!canUse()){view=null;review=null;locked=Boolean(draft);}}changed();}}
 }
 async function cancel(){
  if(disposed||!canUse()||busy||pendingWrite)return;
  const n=++generation;busy=true;review=null;error='';notice='';changed();
  try{const value=await client.calendarPresentationCancel();if(!current(n))return;if(!exact(value,['cancelled'])||value.cancelled!==true)throw Error();reset();changed('#private-calendar-presentation-open');}
  catch{if(current(n)){view=null;locked=Boolean(draft);error='The display review could not be closed. Keep your draft and try closing it again. No save was requested.';}}
  finally{finish(n,error?'#private-calendar-presentation-error':undefined);}
 }
 function back(){if(disposed||!canUse()||busy||pendingWrite||!review)return;review=null;notice='';changed('#private-calendar-presentation-title');}
 function render(){
  if(disposed||!canUse())return'';
  const waiting=busy||Boolean(pendingWrite);if(!opened)return'<button type="button" class="btn" id="private-calendar-presentation-open" '+(waiting?'disabled':'')+'>Customize Calendar display</button>'+(notice?'<p role="status">'+e(notice)+'</p>':'');
  let html='<section class="panel" aria-labelledby="private-calendar-presentation-title"><h2 id="private-calendar-presentation-title" tabindex="-1">Customize Calendar display</h2><p>Choose how saved workspace events appear in the month overview. This changes presentation only. Saved events, their dates and times, and access permissions stay unchanged. No connected calendar is refreshed or changed.</p>';
  if(error)html+='<p role="alert" id="private-calendar-presentation-error" tabindex="-1">'+e(error)+'</p>';if(notice)html+='<p role="status">'+e(notice)+'</p>';if(waiting)html+='<p role="status">Checking Calendar display…</p>';
  if(review)html+='<section aria-labelledby="private-calendar-presentation-review-title"><h3 id="private-calendar-presentation-review-title" tabindex="-1">Review Calendar display</h3><p>Month event display: <strong>'+e(choices[review.layout.monthDisplay])+'</strong></p><p>Only the month overview display changes. Saved event contents and calendar connections stay unchanged.</p><button type="button" class="btn btn-primary" id="private-calendar-presentation-approve" '+(waiting?'disabled':'')+'>Approve Calendar display</button><button type="button" class="btn" id="private-calendar-presentation-back" '+(waiting?'disabled':'')+'>Back to display draft</button></section>';
  else if(draft){const off=waiting||locked||!view;html+='<form id="private-calendar-presentation-editor"><label class="field-label" for="private-calendar-presentation-month-display">Month event display</label><select id="private-calendar-presentation-month-display" name="calendar-presentation-monthDisplay" '+(off?'disabled':'')+'>'+Object.entries(choices).map(([value,caption])=>'<option value="'+value+'" '+(value===draft.monthDisplay?'selected':'')+'>'+e(caption)+'</option>').join('')+'</select><p class="tiny muted">Default: '+e(choices[defaultCalendarPresentation().monthDisplay])+'.</p><button type="submit" class="btn" id="private-calendar-presentation-review" '+(off?'disabled':'')+'>Review Calendar display</button></form>';if(locked)html+='<label class="field-label" for="private-calendar-presentation-copy">Retained Calendar display</label><textarea id="private-calendar-presentation-copy" readonly>'+e(JSON.stringify(draft,null,2))+'</textarea>';}
  if(!review)html+='<button type="button" class="btn" id="private-calendar-presentation-fetch" '+(waiting?'disabled':'')+'>'+(draft?'Discard draft and fetch display':'Fetch latest Calendar display')+'</button>';
  return html+'<button type="button" class="btn" id="private-calendar-presentation-cancel" '+(waiting?'disabled':'')+'>Cancel display changes</button></section>';
 }
 return{
  render,reset,blocked:()=>opened||Boolean(pendingWrite),
  offline(){generation++;view=null;review=null;busy=false;locked=Boolean(draft);error=opened?'Offline. Calendar display changes were not retried.':'';notice='';},
  input(event){if(event.target.name!=='calendar-presentation-monthDisplay')return false;if(editable()&&requireFreshView()&&typeof event.target.value==='string'&&Object.hasOwn(choices,event.target.value)){draft=copy({...draft,monthDisplay:event.target.value});error='';notice='';}return true;},
  submit(event){if(event.target.id!=='private-calendar-presentation-editor')return false;event.preventDefault();void prepare();return true;},
  click(event){const hit=selector=>event.target.closest(selector);for(const [selector,action]of [['#private-calendar-presentation-open',read],['#private-calendar-presentation-fetch',read],['#private-calendar-presentation-review',prepare],['#private-calendar-presentation-approve',save],['#private-calendar-presentation-back',back],['#private-calendar-presentation-cancel',cancel]])if(hit(selector)){void action();return true;}return false;},
  dispose(){reset();disposed=true;}
 };
}
