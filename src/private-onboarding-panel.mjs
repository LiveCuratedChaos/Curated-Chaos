import {escapeHtml as e} from './core.mjs';
import {defaultOnboarding,validateOnboarding,SETUP_DOMAINS,SETUP_PRIORITIES,SETUP_PALETTES,onboardingSuggestions} from './private-onboarding.mjs';

const token=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{43}$/.test(s);
const equal=(a,b)=>JSON.stringify(validateOnboarding(a))===JSON.stringify(validateOnboarding(b));
const isFresh=(v,clock)=>Number.isFinite(v)&&v>clock()&&v<=clock()+300000;
export function createOnboardingPanel({client,clock=Date.now,canUse,onChange,onSaved,allowPalette=false,connections=[]}){
 let write=null;
 let saved=null,draft=null,view=null,review=null,busy=false,locked=false,error='',generation=0,pending=false,tour=-1,showConnections=false,timer;
 const refresh=focus=>onChange(focus);
 function reset(){generation++;write=null;clearTimeout(timer);saved=draft=view=review=null;busy=locked=pending=false;error='';tour=-1;showConnections=false;}
 function expire(){
  view=review=null;
  if(draft){locked=true;error='Setup expired. Fetch the saved setup to review your choices again.';}
  refresh();
 }
 function install(result){
  if(!token(result?.viewId)||!token(result.baseTag)||result.readOnly!==false||!isFresh(result.expiresAt,clock))throw Error('Setup could not be verified.');
  saved=validateOnboarding(result.layout);view={baseTag:result.baseTag,expiresAt:result.expiresAt};
  clearTimeout(timer);timer=setTimeout(expire,Math.max(1,result.expiresAt-clock()));timer.unref?.();
 }
 async function sync(){
  const n=++generation;
  try{const value=await client.onboardingRead();if(n===generation)install(value);}catch{if(n===generation){saved=view=null;error='Setup is unavailable. Try fetching it again.';}}
 }
 async function begin(mode){
  if(!canUse()||busy||pending)return;
  const n=++generation;busy=true;locked=false;error='';tour=-1;review=null;refresh();
  try{
   const result=await client.onboardingRead();if(n!==generation)return;install(result);
   if(mode==='refresh'&&!draft)return;
   draft={...structuredClone(saved),status:'paused'};
   if(mode==='skip')return;
   if(saved.status==='complete')delete draft.palette;
   if(mode==='resume'&&draft.mode)return;
   draft.mode=mode==='guided'?'guided':'quick';draft.step='areas';
  }catch{if(n===generation){locked=true;error='Saved setup could not be read. Fetch it again.';}}
  finally{if(n===generation){busy=false;refresh('#private-setup-title');if(mode==='skip'&&draft&&!locked)void prepare(false);}}
 }
 async function prepare(finish){
  if(!draft||!canUse()||busy||pending||locked)return;
  const n=++generation;busy=true;error='';refresh();
  try{
   if(!view||!isFresh(view.expiresAt,clock))throw Error();
   const proposed=validateOnboarding({...draft,status:finish?'complete':'paused'});
   const value=await client.onboardingReview({baseTag:view.baseTag,layout:proposed});if(n!==generation)return;
   if(value.noChanges===true){saved=proposed;draft=review=null;return;}
   if(!token(value.reviewId)||!isFresh(value.expiresAt,clock)||value.expiresAt>view.expiresAt||!equal(value.layout,proposed))throw Error();
   review=value;
  }catch{if(n===generation){locked=true;error='Setup changed or expired. Fetch your saved setup before reviewing again.';}}
  finally{if(n===generation){busy=false;refresh('#private-setup-title');}}
 }
 async function save(){
  if(!review||!canUse()||busy||locked||pending)return;
  if(!isFresh(review.expiresAt,clock)){expire();return;}
  const n=++generation,r=review;write=r;busy=pending=true;review=null;error='';refresh();
  try{
   const result=await client.onboardingSave(r.reviewId);if(n!==generation)return;
   if(result?.saved!==true||!equal(result.layout,r.layout))throw Error();
   clearTimeout(timer);saved=validateOnboarding(result.layout);draft=view=null;
  }catch{if(n===generation){locked=true;error='The setup save could not be confirmed. Fetch your saved setup before trying again.';}}
  finally{
   if(write===r){
    write=null;pending=false;
    if(n===generation){busy=false;refresh('#private-setup-title');if(!locked)onSaved();}
    else refresh();
   }
  }
 }
 async function discard(){
  const n=++generation;
  clearTimeout(timer);busy=true;draft=review=view=null;locked=false;error='';refresh();
  try{await client.onboardingCancel();}catch{/* A subsequent read replaces the old review. */}
  finally{if(n===generation){busy=false;refresh('#private-setup-title');}}
 }
 function move(forward){
  if(!draft)return;
  const steps=draft.mode==='guided'?['areas','priorities','widgets','review']:['areas','priorities','review'];
  if(forward&&draft.step==='areas'&&!draft.domains.length){error='Choose at least one area.';refresh();return;}
  if(forward&&draft.step==='priorities'){
   if(!draft.priorities.length){error='Choose one to three priorities.';refresh();return;}
   if(draft.mode==='quick'||!draft.widgets.length)draft.widgets=onboardingSuggestions(draft);
  }
  const index=steps.indexOf(draft.step)+(forward?1:-1);if(index<0||index>=steps.length)return;
  draft.step=steps[index];error='';refresh('#private-setup-title');
 }
 function input(event){
  const type=event.target.dataset?.setupField;if(!type)return false;
  if(!draft||locked||busy||review||!canUse())return true;
  const id=event.target.value,checked=event.target.checked;
  if(type==='palette'&&allowPalette&&draft.step==='review'){
   if(!id)delete draft.palette;
   else if(Object.hasOwn(SETUP_PALETTES,id))draft.palette=id;
   refresh('[data-setup-field="palette"]');return true;
  }
  if(type==='domains'&&draft.step==='areas'&&Object.hasOwn(SETUP_DOMAINS,id)||['priorities','widgets'].includes(type)&&draft.step===type&&Object.hasOwn(SETUP_PRIORITIES,id)&&draft.domains.includes(SETUP_PRIORITIES[id][0])){
   error='';
   const values=draft[type];
   if(checked&&!values.includes(id)){if(type==='priorities'&&values.length>=3)error='Choose up to three priorities.';else values.push(id);}
   if(!checked)draft[type]=values.filter(x=>x!==id);
   if(type==='domains'){for(const key of ['priorities','widgets'])draft[key]=draft[key].filter(x=>draft.domains.includes(SETUP_PRIORITIES[x][0]));}
   refresh('[data-setup-field="'+type+'"][value="'+id+'"]');
  }
  return true;
 }
 function click(event){
  const action=event.target.closest('[data-setup-action]')?.dataset.setupAction;if(!action)return false;
  if(!canUse()||busy||pending)return true;
  if(['quick','guided','resume','skip','refresh'].includes(action)){void begin(action);return true;}
  if(action==='discard'){void discard();return true;}
  if(action==='connections'){showConnections=!showConnections;refresh('#private-setup-title');return true;}
  if(action==='tour'){tour=0;refresh('#private-setup-title');return true;}
  if(action==='tour-next'){tour=tour>=2?-1:tour+1;refresh('#private-setup-title');return true;}
  if(action==='tour-close'){tour=-1;refresh('#private-setup-title');return true;}
  if(locked)return true;
  if(action==='approve')void save();
  else if(action==='back-review'){review=null;if(!draft?.mode)draft=null;refresh('#private-setup-title');}
  else if(action==='next'||action==='back')move(action==='next');
  else if(action==='finish'||action==='pause')void prepare(action==='finish');
  return true;
 }
 function render(){
  const disabled=busy||pending||!canUse()?'disabled':'';
  const button=(action,label)=>'<button type="button" class="btn" data-setup-action="'+action+'" '+disabled+'>'+e(label)+'</button>';
  const summary=value=>'<p>Areas · '+e(value.domains.map(id=>SETUP_DOMAINS[id].label).join(', ')||'None selected')+'</p><p>Priorities · '+e(value.priorities.map(id=>SETUP_PRIORITIES[id][1]).join(', ')||'None selected')+'</p>'+
   (value.palette?'<p>Color palette · '+e(SETUP_PALETTES[value.palette])+'</p>':'')+(value.widgets.length?'<p>Starter widgets · '+e(value.widgets.map(id=>SETUP_PRIORITIES[id][1]).join(', '))+'</p>':'');
  let heading='Personal setup',body='';
  if(review){heading=review.layout.status==='complete'?'Review your setup':'Review paused setup';body=summary(review.layout)+button('approve',review.layout.status==='complete'?'Save my setup':'Save and resume later')+button('back-review','Back to choices');}
  else if(draft){
   if(locked)body=summary(draft)+button('refresh','Fetch saved setup');
   else{
    const step=draft.step;
    const choices=step==='areas'?Object.entries(SETUP_DOMAINS).map(([id,d])=>[id,d.label]):Object.entries(SETUP_PRIORITIES).filter(([,v])=>draft.domains.includes(v[0])).map(([id,v])=>[id,v[1]]);
    heading=({areas:'Choose your areas',priorities:'Choose up to three priorities',widgets:'Choose your starter widgets',review:'Your setup choices'})[step];
    const field=step==='areas'?'domains':step;
    body=step==='review'?summary(draft):'<fieldset '+disabled+'><legend>'+e(step==='areas'?'Life areas':step==='priorities'?'Current priorities':'Widgets for Daily Brief')+'</legend>'+choices.map(([id,label])=>'<label><input type="checkbox" data-setup-field="'+field+'" value="'+id+'" '+(draft[field].includes(id)?'checked':'')+'> '+e(label)+'</label>').join('')+'</fieldset>';
    if(step==='review'&&allowPalette){
     body+='<label>Color palette (optional)<select data-setup-field="palette" '+disabled+'><option value="">Keep my current palette</option>'+Object.entries(SETUP_PALETTES).map(([id,label])=>'<option value="'+id+'" '+(draft.palette===id?'selected':'')+'>'+e(label)+'</option>').join('')+'</select></label>';
     if(draft.palette)body+='<div class="setup-palette-preview" data-theme="'+draft.palette+'"><strong>'+e(SETUP_PALETTES[draft.palette])+' preview</strong><span>Daily Brief</span></div>';
    }
    if(step!=='areas')body+=button('back','Back');
    body+=step==='review'?button('finish','Review finished setup'):button('next','Next');
    body+=button('pause','Pause setup');
   }
   body+=button('discard','Close without saving');
  }else if(saved?.status==='complete'){
   heading='Your priorities';body='<ul>'+saved.priorities.map(id=>'<li><a href="'+SETUP_DOMAINS[SETUP_PRIORITIES[id][0]].page+'">'+e(SETUP_PRIORITIES[id][1])+'</a></li>').join('')+'</ul>';
   body+='<nav aria-label="Your selected areas">'+saved.domains.map(id=>'<a class="btn" href="'+SETUP_DOMAINS[id].page+'">'+e(SETUP_DOMAINS[id].label)+'</a>').join(' ')+'</nav>'+button('guided','Adjust setup')+button('tour','Take a short tour');
   if(connections.length){
    body+=button('connections',showConnections?'Close source options':'Optional connections');
    if(showConnections)body+='<nav aria-label="Optional sources">'+connections.map(({label,href})=>'<a class="btn" href="'+e(href)+'">'+e(label)+'</a>').join(' ')+'</nav>';
   }
   if(tour>=0){const [title,info]=[['Daily Brief','Your selected areas and priorities are linked here. Customize the Brief widgets to change their order or size.'],['Quick Add','Use Quick Add on any workspace page to start a private task, event, note, grocery item, project or routine.'],['The Curation','Open The Curation to arrange widgets for each screen size.']][tour];body+='<p><strong>'+e(title)+'</strong> · '+e(info)+'</p>'+button('tour-next',tour===2?'Finish tour':'Next tour step')+button('tour-close','Close tour');}
  }else if(saved?.status==='paused'){
   body=saved.mode?button('resume','Resume setup'):button('quick','Quick Start')+button('guided','Guided Setup');
  }else if(saved){body=button('quick','Quick Start')+button('guided','Guided Setup')+button('skip','Skip for now');}
  else if(!busy)body=button('refresh','Fetch saved setup');
  return '<section class="panel" aria-labelledby="private-setup-title"><h2 id="private-setup-title" tabindex="-1">'+e(heading)+'</h2>'+body+(busy?'<p role="status">Checking setup…</p>':'')+(error?'<p role="alert">'+e(error)+'</p>':'')+'</section>';
 }
 return {reset,sync,click,input,render,blocked:()=>Boolean(draft||busy||pending||review),offline(){generation++;clearTimeout(timer);saved=view=review=null;busy=false;if(draft){locked=true;error='You are offline. Fetch your saved setup after reconnecting.';}tour=-1;}};
}
