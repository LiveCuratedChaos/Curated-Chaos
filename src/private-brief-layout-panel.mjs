import {escapeHtml as e} from './core.mjs';
import {BRIEF_SECTIONS,defaultBriefLayout,validateBriefLayout} from './private-brief-layout.mjs';

const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const exact=(value,keys)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(','));
const label=id=>BRIEF_SECTIONS.find(section=>section.id===id).label;
const modes={expanded:'Expanded',collapsed:'Collapsed',hidden:'Hidden'};
const dateModes={single:'Single day',strip:'Seven-day strip',week:'Detailed week'},dateRanges={rolling:'Rolling seven days',calendar:'Calendar week'};
const weekDays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const narrativeOptions={length:{short:'Short',standard:'Standard',detailed:'Detailed'},detail:{overview:'Overview only',titles:'Include record titles'},tone:{'elegant-warm':'Elegant & Warm',professional:'Professional',gentle:'Gentle'}};
const narrativeLabels={length:'Brief length',detail:'Brief detail',tone:'Brief tone'};
const copy=layout=>validateBriefLayout(layout);
const same=(a,b)=>JSON.stringify(copy(a))===JSON.stringify(copy(b));

export function createBriefLayoutPanel({client,clock=Date.now,allowDates=false,canUse=()=>false,onChange=()=>{},onOpen=()=>{},onSaved=()=>{}}){
 if(typeof allowDates!=='boolean')throw Error('Explicit Brief date preference scope required.');
 let generation=0,opened=false,busy=false,locked=false,disposed=false,view=null,draft=null,review=null,pendingWrite=null,error='',notice='';
 const active=n=>!disposed&&n===generation;
 const current=n=>active(n)&&canUse();
 const fresh=expiry=>Number.isFinite(expiry)&&expiry>clock()&&expiry<=clock()+300000;
 const changed=focus=>{if(!disposed)onChange(canUse()?focus:undefined);};
 function reset(){generation++;opened=false;busy=false;locked=false;view=null;draft=null;review=null;error='';notice='';}
 function finish(n,focus){if(!active(n))return;busy=false;if(!canUse()){view=null;review=null;locked=Boolean(draft);}changed(focus);}
 function editable(){return!disposed&&canUse()&&!busy&&!pendingWrite&&!locked&&!review&&draft&&view;}
 function requireFreshView(){
  if(view&&fresh(view.expiresAt))return true;
  review=null;locked=Boolean(draft);view=null;error='This layout view expired. Keep your draft and fetch the latest layout before reviewing.';changed('#private-brief-layout-error');return false;
 }
 async function read(){
  if(disposed||!canUse()||busy||pendingWrite)return;
  const first=!opened,n=++generation;opened=true;busy=true;view=null;review=null;locked=Boolean(draft);error='';notice='';if(first)onOpen();changed();
  try{
   const value=await client.briefLayoutRead();if(!current(n))return;
   if(!exact(value,['layout','baseTag','viewId','expiresAt','readOnly'])||value.readOnly!==false||!token(value.baseTag)||!token(value.viewId)||!fresh(value.expiresAt))throw Error();
   const layout=copy(value.layout);view={baseTag:value.baseTag,viewId:value.viewId,expiresAt:value.expiresAt};draft=layout;locked=false;
  }catch{if(current(n)){view=null;review=null;locked=Boolean(draft);error='The Daily Brief layout could not be verified. Fetch the latest layout before making changes.';}}
  finally{finish(n,error?'#private-brief-layout-error':'#private-brief-layout-title');}
 }
 function move(id,delta){
  if(!editable()||!requireFreshView())return;
  const index=draft.sections.findIndex(section=>section.id===id),next=index+delta;if(index<0||next<0||next>=draft.sections.length)return;
  const sections=draft.sections.map(section=>({...section}));[sections[index],sections[next]]=[sections[next],sections[index]];draft=copy({...draft,sections});error='';notice='';changed('[name="brief-layout-display-'+id+'"]');
 }
 function defaults(){if(!editable()||!requireFreshView())return;const layout=copy(defaultBriefLayout());if(!allowDates&&draft.dateView)layout.dateView={...draft.dateView};draft=copy(layout);error='';notice='Default order and display prepared. Review before saving.';changed('#private-brief-layout-title');}
 async function prepare(){
  if(!editable()||!requireFreshView())return;
  const layout=copy(draft),baseTag=view.baseTag,expiresAt=view.expiresAt,n=++generation;busy=true;review=null;error='';notice='';changed();
  try{
   const value=await client.briefLayoutReview({baseTag,layout});if(!current(n))return;
   if(exact(value,['noChanges'])&&value.noChanges===true){notice='The layout is unchanged.';return;}
   if(!exact(value,['layout','reviewId','expiresAt'])||!token(value.reviewId)||!fresh(value.expiresAt)||value.expiresAt>expiresAt||!same(value.layout,layout))throw Error();
   review={layout:copy(value.layout),reviewId:value.reviewId,expiresAt:value.expiresAt};
  }catch{if(current(n)){view=null;review=null;locked=true;error='The layout review could not be verified. Keep your draft and fetch the latest layout before trying again.';}}
  finally{finish(n,review?'#private-brief-layout-review-title':error?'#private-brief-layout-error':'#private-brief-layout-title');}
 }
 async function save(){
  if(disposed||!canUse()||busy||pendingWrite||locked||!review)return;
  if(!fresh(review.expiresAt)){review=null;view=null;locked=true;error='This layout review expired. Keep your draft and fetch the latest layout before trying again.';changed('#private-brief-layout-error');return;}
  const expected=copy(review.layout),reviewId=review.reviewId,n=++generation,marker={};pendingWrite=marker;busy=true;locked=true;review=null;error='';notice='';changed();
  try{
   const value=await client.briefLayoutSave(reviewId);if(!current(n))return;
   if(!exact(value,['saved','layout'])||value.saved!==true||!same(value.layout,expected))throw Error();
   const saved=copy(value.layout);pendingWrite=null;reset();notice='Daily Brief layout saved.';onSaved(saved);changed();
  }catch{if(current(n)){view=null;review=null;locked=true;error='The layout save could not be confirmed and may have saved. Keep your layout copy, then fetch the latest layout before trying again. No change was retried.';}}
  finally{if(pendingWrite===marker){pendingWrite=null;if(active(n)){busy=false;if(!canUse()){view=null;review=null;locked=Boolean(draft);}}changed();}}
 }
 async function cancel(){
  if(disposed||!canUse()||busy||pendingWrite)return;
  const n=++generation;busy=true;review=null;error='';notice='';changed();
  try{const value=await client.briefLayoutCancel();if(!current(n))return;if(!exact(value,['cancelled'])||value.cancelled!==true)throw Error();reset();changed('#private-brief-layout-open');}
  catch{if(current(n)){view=null;locked=Boolean(draft);error='The layout review could not be closed. Keep your draft and try closing it again. No save was requested.';}}
  finally{finish(n,error?'#private-brief-layout-error':undefined);}
 }
 function back(){if(disposed||!canUse()||busy||pendingWrite||!review)return;review=null;notice='';changed('#private-brief-layout-title');}
 function render(){
  if(disposed||!canUse())return'';
  const waiting=busy||Boolean(pendingWrite);if(!opened)return'<button type="button" class="btn" id="private-brief-layout-open" '+(waiting?'disabled':'')+'>Customize Daily Brief</button>'+(notice?'<p role="status">'+e(notice)+'</p>':'');
  let html='<section class="panel" aria-labelledby="private-brief-layout-title"><h2 id="private-brief-layout-title" tabindex="-1">Customize Daily Brief</h2><p>Choose the order, display and wording of your Daily Brief sections. These preferences change presentation only; they do not change saved records or who can access them.</p>';
  if(error)html+='<p role="alert" id="private-brief-layout-error" tabindex="-1">'+e(error)+'</p>';if(notice)html+='<p role="status">'+e(notice)+'</p>';if(waiting)html+='<p role="status">Checking Daily Brief layout…</p>';
  if(review){
   html+='<section aria-labelledby="private-brief-layout-review-title"><h3 id="private-brief-layout-review-title" tabindex="-1">Review Daily Brief layout</h3><ol>'+review.layout.sections.map(section=>'<li><strong>'+e(label(section.id))+'</strong> · '+e(modes[section.display])+'</li>').join('')+'</ol><dl>'+Object.entries(narrativeLabels).map(([key,text])=>'<dt>'+e(text)+'</dt><dd>'+e(narrativeOptions[key][review.layout.narrative[key]])+'</dd>').join('')+'</dl>'+(allowDates?'<dl><dt>Date view</dt><dd>'+e(dateModes[review.layout.dateView.mode])+'</dd><dt>Date range</dt><dd>'+e(dateRanges[review.layout.dateView.range])+'</dd><dt>Week starts on</dt><dd>'+e(weekDays[review.layout.dateView.weekStart])+'</dd></dl>':'')+'<p>Only this layout changes. Your records, task completion, project statuses and access permissions stay unchanged.</p><button type="button" class="btn btn-primary" id="private-brief-layout-approve" '+(waiting?'disabled':'')+'>Approve Brief layout</button><button type="button" class="btn" id="private-brief-layout-back" '+(waiting?'disabled':'')+'>Back to layout draft</button></section>';
  }else if(draft){
   const off=waiting||locked||!view;
   html+='<form id="private-brief-layout-editor"><fieldset><legend>Brief wording</legend>'+Object.entries(narrativeLabels).map(([key,text])=>'<label class="field-label" for="private-brief-layout-narrative-'+key+'">'+e(text)+'</label><select id="private-brief-layout-narrative-'+key+'" name="brief-layout-narrative-'+key+'" '+(off?'disabled':'')+'>'+Object.entries(narrativeOptions[key]).map(([value,caption])=>'<option value="'+value+'" '+(value===draft.narrative[key]?'selected':'')+'>'+e(caption)+'</option>').join('')+'</select>').join('')+'</fieldset>'+(allowDates?'<fieldset><legend>Date browsing</legend>'+[['mode','Date view',dateModes],['range','Date range',dateRanges],['weekStart','Week starts on',Object.fromEntries(weekDays.map((day,index)=>[String(index),day]))]].map(([key,text,options])=>'<label class="field-label" for="private-brief-layout-date-'+key+'">'+e(text)+'</label><select id="private-brief-layout-date-'+key+'" name="brief-layout-date-'+key+'" '+(off?'disabled':'')+'>'+Object.entries(options).map(([value,caption])=>'<option value="'+value+'" '+(value===String(draft.dateView[key])?'selected':'')+'>'+e(caption)+'</option>').join('')+'</select>').join('')+'</fieldset>':'')+'<ol>'+draft.sections.map((section,index)=>{const name='brief-layout-display-'+section.id;return'<li><label class="field-label" for="private-'+name+'">'+e(label(section.id))+'</label><select id="private-'+name+'" name="'+name+'" '+(off?'disabled':'')+'>'+Object.entries(modes).map(([value,text])=>'<option value="'+value+'" '+(value===section.display?'selected':'')+'>'+e(text)+'</option>').join('')+'</select><button type="button" class="btn" data-brief-layout-up="'+section.id+'" aria-label="Move '+e(label(section.id))+' up" '+(off||index===0?'disabled':'')+'>Move up</button><button type="button" class="btn" data-brief-layout-down="'+section.id+'" aria-label="Move '+e(label(section.id))+' down" '+(off||index===draft.sections.length-1?'disabled':'')+'>Move down</button></li>';}).join('')+'</ol><button type="submit" class="btn" id="private-brief-layout-review" '+(off?'disabled':'')+'>Review Brief layout</button><button type="button" class="btn" id="private-brief-layout-defaults" '+(off?'disabled':'')+'>Reset layout to defaults</button></form>';
   if(locked)html+='<label class="field-label" for="private-brief-layout-copy">Retained Brief layout</label><textarea id="private-brief-layout-copy" readonly>'+e(JSON.stringify(draft,null,2))+'</textarea>';
  }
  if(!review)html+='<button type="button" class="btn" id="private-brief-layout-fetch" '+(waiting?'disabled':'')+'>'+(draft?'Discard draft and fetch layout':'Fetch latest Brief layout')+'</button>';
  return html+'<button type="button" class="btn" id="private-brief-layout-cancel" '+(waiting?'disabled':'')+'>Cancel layout changes</button></section>';
 }
 return{
  render,reset,blocked:()=>opened||Boolean(pendingWrite),
  offline(){generation++;view=null;review=null;busy=false;locked=Boolean(draft);error=opened?'Offline. Layout changes were not retried.':'';notice='';},
  input(event){const prefix='brief-layout-display-',name=event.target.name;if(typeof name!=='string')return false;if(name.startsWith('brief-layout-narrative-')){const key=name.slice('brief-layout-narrative-'.length),value=event.target.value;if(editable()&&requireFreshView()&&Object.hasOwn(narrativeOptions,key)&&typeof value==='string'&&Object.hasOwn(narrativeOptions[key],value)){draft=copy({...draft,narrative:{...draft.narrative,[key]:value}});error='';notice='';}return true;}if(name.startsWith('brief-layout-date-')){const key=name.slice('brief-layout-date-'.length),value=event.target.value;if(allowDates&&editable()&&requireFreshView()&&(['mode','range'].includes(key)&&typeof value==='string'&&Object.hasOwn(key==='mode'?dateModes:dateRanges,value)||key==='weekStart'&&typeof value==='string'&&/^[0-6]$/.test(value))){draft=copy({...draft,dateView:{...draft.dateView,[key]:key==='weekStart'?Number(value):value}});error='';notice='';}return true;}if(!name.startsWith(prefix))return false;const id=name.slice(prefix.length);if(editable()&&requireFreshView()&&Object.hasOwn(modes,event.target.value)){const index=draft.sections.findIndex(section=>section.id===id);if(index>=0){const sections=draft.sections.map(section=>({...section}));sections[index].display=event.target.value;draft=copy({...draft,sections});error='';notice='';}}return true;},
  submit(event){if(event.target.id!=='private-brief-layout-editor')return false;event.preventDefault();void prepare();return true;},
  click(event){const hit=selector=>event.target.closest(selector);for(const [selector,action]of [['#private-brief-layout-open',read],['#private-brief-layout-fetch',read],['#private-brief-layout-review',prepare],['#private-brief-layout-approve',save],['#private-brief-layout-back',back],['#private-brief-layout-cancel',cancel],['#private-brief-layout-defaults',defaults]])if(hit(selector)){void action();return true;}for(const [selector,delta]of [['[data-brief-layout-up]',-1],['[data-brief-layout-down]',1]]){const button=hit(selector);if(button){move(button.dataset[delta===-1?'briefLayoutUp':'briefLayoutDown'],delta);return true;}}return false;},
  dispose(){reset();disposed=true;}
 };
}
