import {escapeHtml as e} from './core.mjs';
import {QUICK_ADD_LABELS,QUICK_ADD_DESTINATIONS,validateQuickAddLayout} from './private-quick-add-layout.mjs';

const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const equal=(a,b)=>JSON.stringify(validateQuickAddLayout(a))===JSON.stringify(validateQuickAddLayout(b));
const destination=value=>value==='context'?'Current page or personal default':value;

export function createQuickAddSettings({client,clock,canUse,onChange,enabledKinds,allowCalendarCategory=false}){
 let generation=0,opened=false,busy=false,locked=false,view=null,draft=null,review=null,error='',notice='';
 const fresh=value=>Number.isFinite(value)&&value>clock()&&value<=clock()+300000;
 const current=n=>n===generation&&canUse();
 function reset(){generation++;opened=false;busy=false;locked=false;view=null;draft=null;review=null;error='';notice='';}
 async function read(kind=null){
  if(busy||!canUse()||kind!==null&&(opened||!enabledKinds().includes(kind)))return;
  const n=++generation;opened=kind===null;busy=true;error=notice='';locked=false;view=review=null;onChange();
  try{
   const value=await client.quickAddLayoutRead();
   if(!current(n))return;
   if(!value||value.readOnly!==false||!token(value.baseTag)||!token(value.viewId)||!fresh(value.expiresAt))throw Error();
   const layout=validateQuickAddLayout(value.layout);
   if(kind!==null)return layout[kind];
   draft=layout;view={baseTag:value.baseTag,expiresAt:value.expiresAt};
  }catch{if(current(n)){locked=true;error='Quick Add settings could not be read. Choose Quick Add again to retry.';}}
  finally{if(n===generation){busy=false;onChange();}}
 }
 async function prepare(){
  if(!opened||busy||locked||review||!draft||!canUse())return;
  let layout;
  try{layout=validateQuickAddLayout(draft);}
  catch{error='Choose valid Quick Add settings. Calendar categories use up to 48 characters.';onChange();return;}
  const n=++generation;busy=true;notice=error='';onChange();
  try{
   if(!view||!fresh(view.expiresAt))throw Error();
   const value=await client.quickAddLayoutReview({baseTag:view.baseTag,layout});
   if(!current(n))return;
   if(value?.noChanges===true){notice='These are your current Quick Add settings.';return;}
   if(!token(value?.reviewId)||!fresh(value.expiresAt)||value.expiresAt>view.expiresAt||!equal(value.layout,draft))throw Error();
   review=value;
  }catch{if(current(n)){locked=true;error='Quick Add settings changed or expired. Fetch the current settings to review again.';}}
  finally{if(n===generation){busy=false;onChange();}}
 }
 async function save(){
  if(!opened||busy||locked||!review||!canUse())return;
  const n=++generation,selected=review;review=null;busy=true;locked=true;error=notice='';onChange();
  try{
   if(!fresh(selected.expiresAt))throw Error();
   const value=await client.quickAddLayoutSave(selected.reviewId);
   if(!current(n))return;
   if(value?.saved!==true||!equal(value.layout,selected.layout))throw Error();
   reset();notice='Quick Add settings saved.';onChange();
  }catch{if(current(n))error='The Quick Add settings save could not be confirmed. Fetch current settings before trying again.';}
  finally{if(n===generation){busy=false;onChange();}}
 }
 async function cancel(){
  if(busy||!canUse())return;
  const n=++generation;busy=true;onChange();
  try{const result=await client.quickAddLayoutCancel();if(!current(n))return;if(result?.cancelled!==true)throw Error();reset();onChange();}
  catch{if(current(n)){locked=true;error='The settings review could not be closed. Try closing it again.';}}
  finally{if(n===generation){busy=false;onChange();}}
 }
 function render(){
  let html=error?'<p role="alert">'+e(error)+'</p>':notice?'<p role="status">'+e(notice)+'</p>':'';
  if(!opened)return html;
  html+='<section class="panel" aria-label="Quick Add settings"><h2>Quick Add settings</h2>';
  if(busy)html+='<p role="status">Checking Quick Add settings…</p>';
  if(draft){
   for(const kind of enabledKinds()){
    const choice=draft[kind],options=QUICK_ADD_DESTINATIONS[kind],label=QUICK_ADD_LABELS[kind];
    html+='<fieldset><legend>'+label+'</legend>';
    if(review)html+='<p>'+e(destination(choice.destination))+' · Details '+(choice.expanded?'expanded':'collapsed')+(kind==='event'&&allowCalendarCategory?' · Category: '+e(choice.calendarCategory??'None'):'')+'</p>';
    else{
     const disabled=busy||locked?'disabled':'';
     html+=options.length===1?'<p>Private destination · '+e(options[0])+'</p>':'<label class="field-label">'+label+' destination<select name="quick-destination-'+kind+'" '+disabled+'>'+options.map(v=>'<option value="'+e(v)+'" '+(choice.destination===v?'selected':'')+'>'+e(destination(v))+'</option>').join('')+'</select></label>';
     if(kind==='event'&&allowCalendarCategory)html+='<label class="field-label">Default Calendar category<input name="quick-category-event" maxlength="48" value="'+e(choice.calendarCategory??'')+'" '+disabled+'></label>';
     html+='<label><input type="checkbox" name="quick-expanded-'+kind+'" '+(choice.expanded?'checked':'')+' '+disabled+'>Open '+label.toLowerCase()+' details by default</label>';
    }
    html+='</fieldset>';
   }
   if(review)html+='<button class="btn btn-primary" type="button" id="quick-settings-approve">Approve Quick Add settings</button>';
   else if(!locked)html+='<button class="btn" type="button" id="quick-settings-review" '+(busy?'disabled':'')+'>Review Quick Add settings</button>';
  }
  if(locked)html+='<button type="button" class="btn" id="quick-settings-fetch" '+(busy?'disabled':'')+'>Fetch current settings</button>';
  return html+'<button class="btn" type="button" id="quick-settings-close" '+(busy?'disabled':'')+'>Close settings</button></section>';
 }
 return{reset,render,choice:read,blocked:()=>opened||busy,
  input(event){
   if(event.target.name==='quick-category-event'){
    if(allowCalendarCategory&&draft&&!busy&&!locked&&!review&&opened&&canUse()&&enabledKinds().includes('event')){
     const category=String(event.target.value??'').trim();
     if(category)draft.event.calendarCategory=category;
     else delete draft.event.calendarCategory;
    }
    return true;
   }
   const match=/^quick-(destination|expanded)-(task|event|note|grocery|project|routine)$/.exec(event.target.name??'');
   if(!match)return false;
   if(draft&&!busy&&!locked&&!review&&opened&&canUse()&&enabledKinds().includes(match[2])){
    const [ ,field,kind]=match,value=field==='expanded'?event.target.checked:event.target.value;
    if(field==='expanded'?typeof value==='boolean':QUICK_ADD_DESTINATIONS[kind].includes(value))draft[kind][field]=value;
   }
   return true;
  },
  click(event){
   for(const [id,action] of [['quick-settings-open',()=>read()],['quick-settings-fetch',()=>read()],['quick-settings-review',prepare],['quick-settings-approve',save],['quick-settings-close',cancel]]){
    if(event.target.closest('#'+id)){void action();return true;}
   }
   return false;
  }
 };
}
