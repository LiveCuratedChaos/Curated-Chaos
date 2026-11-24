import {guideFieldLabels} from './private-school-guide-changes.mjs';
import {escapeHtml as e} from './core.mjs';
import {guideLabels,schoolGuideKinds} from './private-school-guides.mjs';
import {downloadCheckedDocument} from './private-document-panel.mjs';

const token=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{43}$/.test(s);
const name=s=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=150;
const exact=(obj,keys)=>obj&&Object.keys(obj).sort().join(',')===keys;
const btn=(action,label,busy)=>'<button type="button" class="btn" data-school-library="'+e(action)+'" '+(busy?'disabled':'')+'>'+e(label)+'</button>';

function verifyPage(page,source,offset,clock){
 if(!exact(page,'expiresAt,files,hasMore,history,offset,viewId')||!token(page.viewId)||!Number.isFinite(page.expiresAt)||page.expiresAt<=clock()||
    page.expiresAt>clock()+300000||page.offset!==offset||typeof page.hasMore!=='boolean'||!Array.isArray(page.files)||
    page.files.length>25||page.hasMore&&page.files.length!==25||!Array.isArray(page.history)||page.history.length>50)throw Error();
 const counts=new Map(),choices=new Set();
 for(const row of page.history){
  if(!exact(row,'addedAt,choice,kind,name,number')||!schoolGuideKinds(source.kind).includes(row.kind)||!name(row.name)||
    !token(row.choice)||choices.has(row.choice)||typeof row.addedAt!=='string'||new Date(row.addedAt).toISOString()!==row.addedAt||
    row.number!==(counts.get(row.kind)??0)+1)throw Error();
  counts.set(row.kind,row.number);choices.add(row.choice);
 }
 for(const file of page.files){
  if(!exact(file,'choice,name')||!token(file.choice)||choices.has(file.choice)||!name(file.name))throw Error();
  choices.add(file.choice);
 }
 return page;
}

const planStatus={ready:'No new supported changes were found.',historical:'This is an earlier guide version. Open the latest version to check for new changes.',unavailable:'Text extraction is unavailable here. Download the original or use the School editor.',unreadable:'This guide has no supported text or exceeds the reading limits. Download the original to review it.',busy:'The local document reader is busy. Try again shortly.'};
function verifyPlan(result,guide){
 if(!exact(result,'applied,changes,kind,name,number,status')||result.kind!==guide.kind||result.number!==guide.number||
    result.name!==guide.name||!Object.hasOwn(planStatus,result.status)||!Array.isArray(result.applied)||!Array.isArray(result.changes)||
    result.applied.length>3||result.changes.length>3||result.status!=='ready'&&result.changes.length)throw Error();
 const fields=new Set(),ids=new Set();
 for(const [key,rows] of [['applied',result.applied],['changes',result.changes]])for(const row of rows){
  if(!exact(row,key==='changes'?'after,anchor,before,choice,field,page,quote':'after,anchor,before,field,page,quote')||
     !Object.hasOwn(guideFieldLabels,row.field)||(guide.kind==='program')===(row.field==='credits')||fields.has(row.field)||
     !Number.isFinite(row.before)||!Number.isFinite(row.after)||row.before===row.after||!Number.isInteger(row.page)||row.page<1||row.page>80||
     ![row.anchor,row.quote].every(v=>typeof v==='string'&&v.trim()&&v.length<=180)||key==='changes'&&(!token(row.choice)||ids.has(row.choice)))throw Error();
  fields.add(row.field);ids.add(row.choice);
 }
 return result;
}
function renderPlan(plan,busy){
 function evidence(row){
  return '<p>'+e(guideFieldLabels[row.field])+' · '+e(String(row.before))+' → '+e(String(row.after))+'</p><p>Page '+row.page+' · '+e(row.anchor)+' · <q>'+e(row.quote)+'</q></p>';
 }
 return '<h5>'+e(plan.name)+' · '+e(guideLabels[plan.kind])+' · Version '+plan.number+'</h5>'+
  (plan.applied.length?'<h6>Previously applied</h6>'+plan.applied.map(evidence).join(''):'')+
  (plan.changes.length?'<h6>Review suggested changes</h6>'+plan.changes.map(row=>evidence(row)+btn('apply-'+row.choice,'Apply '+guideFieldLabels[row.field].toLowerCase()+' change',busy)).join(''):'<p>'+e(planStatus[plan.status])+'</p>')+
  btn('back','Back to guide versions',busy);
}

export function createSchoolLibraryPanel({client,source,allowEdit,clock=Date.now,onChange,onSaved,download}){
 let seq=0,page=null,review=null,plan=null,error='',busy=false,opened=false,kind='';
 function reset(){seq++;page=review=plan=null;busy=opened=false;error=kind='';}
 async function act(action){
  const record=source();
  if(!record||busy)return;
  const request=++seq;
  const current=()=>seq===request&&source()?.token===record.token&&record.expiresAt>clock();
  if(action==='close'){
   reset();void client.schoolLibraryClose().catch(()=>{});onChange();return;
  }
  busy=true;error='';opened=true;onChange();
  try{
   if(['open','next','previous'].includes(action)){
    const offset=action==='next'?page.offset+25:action==='previous'?page.offset-25:0;
    page=review=plan=null;
    const result=await client.schoolLibraryOpen(record.token,offset);if(!current())return;
    page=verifyPage(result,record,offset,clock);kind=schoolGuideKinds(record.kind).includes(kind)?kind:schoolGuideKinds(record.kind)[0];
   }else if(!page||page.expiresAt<=clock())throw Error();
   else if(action.startsWith('inspect-')&&allowEdit){
    const guide=page.history.find(g=>g.choice===action.slice(8));if(!guide)throw Error();
    const result=await client.schoolGuideInspect(page.viewId,guide.choice);if(!current())return;
    plan=verifyPlan(result,guide);
   }else if(action.startsWith('apply-')&&allowEdit){
    const proposal=plan?.changes.find(change=>change.choice===action.slice(6));if(!proposal)throw Error();
    plan=null;
    const result=await client.schoolGuideApply(page.viewId,proposal.choice);if(!current())return;
    if(!exact(result,'saved')||result.saved!==true)throw Error();
    reset();onSaved('plan');return;
   }else if(action.startsWith('download-')){
    const selected=page.history.find(h=>h.choice===action.slice(9));if(!selected)throw Error();
    const result=await client.schoolGuideDownload(page.viewId,selected.choice);if(!current())return;
    if(result.fields?.name!==selected.name)throw Error();
    downloadCheckedDocument(result,null,download);
   }else if(action.startsWith('choose-')&&allowEdit){
    const file=page.files.find(f=>f.choice===action.slice(7));if(!file)throw Error();
    const result=await client.schoolGuideReview(page.viewId,file.choice,kind);if(!current())return;
    if(!exact(result,'kind,name,number,reviewId,title')||!token(result.reviewId)||result.kind!==kind||result.name!==file.name||
       result.title!==record.title||result.number!==1+page.history.filter(h=>h.kind===kind).length)throw Error();
    review=result;
   }else if(action==='save'&&allowEdit&&review){
    const id=review.reviewId;review=null;
    const result=await client.schoolGuideSave(page.viewId,id);if(!current())return;
    if(!exact(result,'saved')||result.saved!==true)throw Error();
    reset();onSaved();return;
   }else if(action==='back'){plan=review=null;}
  }catch{if(current()){plan=review=null;error='Could not verify this guide version. Reopen the School record to check for a duplicate or a changed file.';}}
  finally{if(request===seq){busy=false;onChange();}}
 }
 function render(){
  const record=source();if(!record)return '';
  if(!opened)return btn('open','Open School Library',false);
  let inner='';
  if(page&&page.expiresAt>clock()){
   if(plan)inner=renderPlan(plan,busy);
   else if(review){
    inner='<p>'+e(review.title)+' · '+e(guideLabels[review.kind])+' · Version '+review.number+'</p><p>'+e(review.name)+'</p>'+
     btn('save','Save guide version',busy)+btn('back','Back to files',busy);
   }else{
    inner=page.history.length?'<ol>'+[...page.history].reverse().map(h=>'<li>'+e(guideLabels[h.kind])+' · Version '+h.number+' · '+e(h.addedAt.slice(0,10))+' · '+btn('download-'+h.choice,'Download '+h.name,busy)+(allowEdit?btn('inspect-'+h.choice,'Check guide for plan changes',busy):'')+'</li>').join('')+'</ol>':'<p>No guides linked yet.</p>';
    if(allowEdit&&page.history.length<50){
     inner+='<label>Document type <select name="school-guide-kind" '+(busy?'disabled':'')+'>'+schoolGuideKinds(record.kind).map(k=>'<option value="'+k+'" '+(kind===k?'selected':'')+'>'+e(guideLabels[k])+'</option>').join('')+'</select></label>';
     inner+=page.files.length?'<ul>'+page.files.map(f=>'<li>'+btn('choose-'+f.choice,'Review '+f.name,busy)+'</li>').join('')+'</ul>':'<p>Add a file to the Document Library to link it here.</p>';
     if(page.offset)inner+=btn('previous','Previous files',busy);
     if(page.hasMore)inner+=btn('next','Next files',busy);
    }else if(allowEdit)inner+='<p>This record has reached its 50-version limit.</p>';
   }
  }
  return '<section><h4>School Library</h4>'+inner+(error?'<p role="alert">'+e(error)+'</p>':'')+btn('close','Close School Library',busy)+'</section>';
 }
 return {reset,render,blocked:()=>busy,click(event){
  const target=event?.target?.closest?.('[data-school-library]');if(!target)return false;
  void act(target.dataset.schoolLibrary);return true;
 },input(event){if(event?.target?.name!=='school-guide-kind')return false;
  if(!busy&&!review&&schoolGuideKinds(source()?.kind).includes(event.target.value))kind=event.target.value;
  return true;
 }};
}
