import {PROJECT_STATUSES} from './private-project-model.mjs';
import {escapeHtml as e} from './core.mjs';
import {applicationSummary,careerFold,goalFilters,goalSummary,pipelineFilters} from './private-career-pipeline.mjs';
const exact=(v,keys)=>v&&Object.keys(v).sort().join(',')===keys;
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const text=(v,n)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=n;
const btn=(action,label,disabled)=>'<button type="button" class="btn" data-career-pipeline="'+e(action)+'" '+(disabled?'disabled':'')+'>'+e(label)+'</button>';
function verify(page,filters,now,profile){
 const keys=profile?'expiresAt,goals,offset,query,total,viewId':'applications,expiresAt,offset,query,stage,stages,total,viewId';
 if(!exact(page,keys)||!token(page.viewId)||!Number.isFinite(page.expiresAt)||page.expiresAt<=now||page.expiresAt>now+300000||
   Object.entries(filters).some(([k,v])=>page[k]!==v)||!Number.isInteger(page.total)||page.total<0||page.total>2000)throw Error();
 const rows=profile?page.goals:page.applications;
 if(!Array.isArray(rows)||rows.length!==Math.min(50,Math.max(0,page.total-page.offset))||
   new Set(rows.map(r=>r.projectToken)).size!==rows.length||rows.some(r=>!token(r.projectToken)||!text(r.title,140)))throw Error();
 if(profile){
  for(const {title,status,projectToken,...goal} of rows){if(!PROJECT_STATUSES.includes(status))throw Error();goalSummary(goal);}
  return page;
 }
 if(!Array.isArray(page.stages)||page.stages.length>2000)throw Error();
 const stages=new Map();
 for(const item of page.stages){
  if(!exact(item,'count,label')||!text(item.label,48)||stages.has(item.label)||!Number.isInteger(item.count)||item.count<1)throw Error();
  stages.set(item.label,item.count);
 }
 const all=[...stages.values()].reduce((a,b)=>a+b,0);
 if(all>2000||page.total!==(filters.stage?(stages.get(filters.stage)??0):all))throw Error();

 for(const item of page.applications){
  if(!exact(item,'employer,projectToken,role,stage,title')||
   !stages.has(item.stage)||filters.stage&&item.stage!==filters.stage)throw Error();
  applicationSummary({employer:item.employer,role:item.role,stage:item.stage});
 }
 return page;
}
function goalIndex(goals,field,heading){
 const entries=new Map();
 for(const goal of goals)for(const label of goal[field]){
  const key=careerFold(label);
  if(!entries.has(key))entries.set(key,{label,titles:[]});
  entries.get(key).titles.push(goal.title);
 }
 if(!entries.size)return '';
 const items=[...entries.values()].sort((a,b)=>a.label.localeCompare(b.label));
 return '<h3>'+heading+'</h3><dl>'+items.map(({label,titles})=>
  '<dt>'+e(label)+'</dt><dd>'+titles.map(e).join(', ')+'</dd>').join('')+'</dl>';
}
function renderGoals(view,query,busy){
 let html='<form id="private-career-filters"><label>Goal, role, skill or certification<input maxlength="100" name="career-pipeline-query" value="'+e(query)+'" '+(busy?'disabled':'')+'></label><button class="btn" type="submit" '+(busy?'disabled':'')+'>Find goals</button></form>';
 if(!view)return html;
 html+=btn('new','Add career goal',busy);
 if(!view.goals.length)return html+'<p>No career goals match this search.</p>';
 html+='<p>Goals '+(view.offset+1)+'–'+(view.offset+view.goals.length)+' of '+view.total+'</p><ul>'+view.goals.map(goal=>
  '<li><strong>'+e(goal.title)+'</strong> · '+e(goal.role)+' · '+e(goal.status)+' '+btn('edit-'+goal.projectToken,'Open '+goal.title,busy)+'</li>').join('')+'</ul>';
 return html+goalIndex(view.goals,'skills','Skills in these goals')+goalIndex(view.goals,'certifications','Certifications in these goals');
}
export function createCareerPipelinePanel({client,clock,canUse,onEdit,onCreate,onChange}){
 let profile=false,seq=0,opened=false,busy=false,view=null,query='',stage='',error='',notice='',timer;
 function reset(){clearTimeout(timer);seq++;profile=opened=busy=false;view=null;query=stage=error=notice='';}
 async function load(offset=0,message=''){
  if(busy||!canUse())return;
  const n=++seq;clearTimeout(timer);busy=opened=true;view=null;error='';notice=message;onChange();
  try{
   const filters=profile?goalFilters({query,offset}):pipelineFilters({query,stage,offset});
   const result=profile?await client.careerProfile(filters):await client.careerPipeline(filters);
   if(seq!==n||!canUse())return;view=verify(result,filters,clock(),profile);query=filters.query;
   timer=setTimeout(()=>{if(n!==seq)return;view=null;error=profile?'Career goals expired. Refresh the profile.':'Application details expired. Refresh the pipeline.';onChange();},Math.max(1,view.expiresAt-clock()));timer.unref?.();
  }catch{if(n===seq)error=profile?'Career goals could not be verified. Refresh the profile.':'Applications could not be verified. Refresh the pipeline.';}
  finally{if(n===seq){busy=false;onChange();}}
 }
 async function edit(choice){
  const item=(profile?view?.goals:view?.applications)?.find(r=>r.projectToken===choice);
  if(!item||busy||!canUse()||view.expiresAt<=clock())return;
  const n=seq,expiry=view.expiresAt;busy=true;error='';onChange();
  try{
   const source=await client.projectsRead(choice);
   if(n!==seq||!canUse())return;
   if(source.projectToken!==choice||source.expiresAt<=clock()||source.expiresAt>expiry||source.section!=='Work'||
     source.title!==item.title||source.career?.kind!==(profile?'goal':'application')||source.career.role!==item.role)throw Error();
   if(profile){
    if(source.status!==item.status||['skills','certifications'].some(k=>JSON.stringify(source.career[k])!==JSON.stringify(item[k])))throw Error();
   }else if(source.career.employer!==item.employer||source.career.stage!==item.stage)throw Error();
   clearTimeout(timer);view=null;opened=false;busy=false;onEdit(source);
  }catch{if(n===seq)error=profile?'This goal changed. Refresh the profile.':'This application changed. Refresh the pipeline to reopen it.';}
  finally{if(n===seq){busy=false;onChange();}}
 }
 function render(){
  if(!opened)return btn('open','View job application pipeline',false)+btn('profile','View career goals and skills',false);
  let html='<section class="panel"><h2>'+(profile?'Career goals and skills':'Job application pipeline')+'</h2>'+
   (error?'<p role="alert">'+e(error)+'</p>':'')+(notice?'<p role="status">'+e(notice)+'</p>':'');
  if(profile){
   const current=view&&view.expiresAt>clock()?view:null;html+=renderGoals(current,query,busy);
   if(current?.offset)html+=btn('previous','Previous goals',busy);
   if(current&&current.offset+50<current.total)html+=btn('next','More goals',busy);
   return html+btn('refresh','Refresh profile',busy)+btn('close','Close profile',busy)+'</section>';
  }
  html+=
   '<form id="private-career-filters"><label>Employer, role or project title<input maxlength="100" name="career-pipeline-query" value="'+e(query)+'" '+(busy?'disabled':'')+'></label>'+
   '<button type="submit" class="btn" '+(busy?'disabled':'')+'>Find applications</button></form>';
  if(view&&view.expiresAt>clock()){
   const stages=[{label:'',count:view.stages.reduce((sum,s)=>sum+s.count,0)},...view.stages];
   if(stage&&!view.stages.some(s=>s.label===stage))stages.push({label:stage,count:0});
   html+='<label>Application stage<select name="career-pipeline-stage" '+(busy?'disabled':'')+'>'+stages.map(s=>
    '<option value="'+e(s.label)+'" '+(s.label===stage?'selected':'')+'>'+e(s.label||'All stages')+' ('+s.count+')</option>').join('')+'</select></label>';
   html+=btn('new','Add application',busy);
   if(view.applications.length)html+='<p>'+view.total+' matching applications</p><ul>'+view.applications.map(item=>
    '<li><strong>'+e(item.role)+'</strong> · '+e(item.employer)+' · '+e(item.stage)+' '+btn('edit-'+item.projectToken,'Open '+item.title,busy)+'</li>').join('')+'</ul>';
   else html+='<p>No applications match these filters.</p>';
   if(view.offset)html+=btn('previous','Previous applications',busy);
   if(view.offset+50<view.total)html+=btn('next','More applications',busy);
  }
  return html+btn('refresh','Refresh pipeline',busy)+btn('close','Close pipeline',busy)+'</section>';
 }
 return {reset,render,active:()=>opened,blocked:()=>busy,refresh:saved=>load(0,saved?(profile?'Career goal saved.':'Application saved.') : ''),input(event){
  if(event.target?.name==='career-pipeline-query'){if(!busy)query=event.target.value;return true;}
  if(event.target?.name==='career-pipeline-stage'){if(!busy){stage=event.target.value;void load();}return true;}return false;
 },submit(event){if(event.target?.id!=='private-career-filters')return false;event.preventDefault();void load();return true;},
 click(event){
  const action=event.target?.closest?.('[data-career-pipeline]')?.dataset?.careerPipeline;
  if(!action)return false;if(busy||!canUse())return true;
  if(action==='open'||action==='profile'){reset();profile=action==='profile';void load();}
  else if(action==='refresh')void load();
  else if(action==='new'&&view&&view.expiresAt>clock()){const expiry=view.expiresAt;clearTimeout(timer);view=null;opened=false;onCreate(expiry,profile?'goal':'application');}
  else if(action==='close'){reset();onChange();}
  else if(action==='next'||action==='previous'){if(view)void load(query.trim()===view.query?view.offset+(action==='next'?50:-50):0);}
  else if(action.startsWith('edit-'))void edit(action.slice(5));return true;
 }};
}
