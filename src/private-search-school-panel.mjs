import {schoolFavoriteButton} from './private-favorite-item-panel.mjs';
import {escapeHtml as e} from './core.mjs';
import {verifyPrivateSchoolDetails} from './private-school-read.mjs';
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
export function createSearchSchoolPanel({client,clock=Date.now,allowFavorites=false,canUse=()=>false,findResult=()=>null,onOpen=()=>{},onChange=()=>{}}){
 let generation=0,selected=null,favorite=null,details=null,busy=false,error='',timer=null,disposed=false;
 function reset(){generation++;clearTimeout(timer);timer=null;selected=null;favorite=null;details=null;busy=false;error='';}
 const matches=(key,bind=true)=>{const row=favorite?(favorite.expiresAt>clock()?favorite.row:null):findResult(key);return row&&row.type==='school'&&row.section==='School'&&['degree','course'].includes(row.schoolKind)&&row.schoolReadToken===key&&typeof row.title==='string'&&(!bind||!selected||row.title===selected.title&&row.schoolKind===selected.schoolKind);};
 const live=(n,key)=>!disposed&&generation===n&&canUse()&&matches(key);
 async function open(key,source=null){
  if(disposed||busy||!canUse()||!token(key))return;
  const row=source?.row??findResult(key);
  if(row?.type!=='school'||row.section!=='School'||!['degree','course'].includes(row.schoolKind)||row.schoolReadToken!==key||typeof row.title!=='string')return;
  onOpen();reset();selected=structuredClone(row);favorite=source;
  const n=++generation;busy=true;onChange();
  try{
   const result=source?await client.openFavoriteSchool(source.type,key):await client.readSearchSchool(key);
   if(!live(n,key))return;
   const valid=verifyPrivateSchoolDetails(result,{now:clock()});
   if(valid.title!==row.title||valid.kind!==row.schoolKind||source&&valid.expiresAt>source.expiresAt)throw Error();
   details=structuredClone(valid);
   timer=setTimeout(()=>{if(disposed||generation!==n)return;details=null;error='Temporary School details expired. Reopen the original for fresh details.';onChange();},Math.max(1,valid.expiresAt-clock()));
   timer.unref?.();
  }catch{if(live(n,key))error='Selected School details could not be verified. Reopen the current list.';}
  finally{if(!disposed&&generation===n){busy=false;onChange(canUse()&&matches(key)?details?'#private-search-school-title':'#private-search-school-error':undefined);}}
 }
 function openFavorite(type,key,row,expiresAt){
  if(!allowFavorites||!['program','course'].includes(type)||row?.schoolReadToken!==key||!Number.isFinite(expiresAt)||expiresAt<=clock()||expiresAt>clock()+300000)return;
  return open(key,{type,expiresAt,row:{type:'school',section:'School',title:row.title,schoolReadToken:key,schoolKind:type==='program'?'degree':'course'}});
 }
 const body=d=>`<p>Saved ${d.kind==='degree'?'degree program':'academic course'} · School · Read only</p><dl>${Object.entries({progressMetric:'Progress metric',totalCredits:'Total credits',totalTerms:'Total terms',code:'Course code',term:'Term',status:'Academic status',credits:'Credits',officialOrder:'Official order',studyOrder:'Study order',targetDate:'Target date'}).filter(([key])=>Object.hasOwn(d,key)).map(([key,label])=>`<dt>${label}</dt><dd>${e(String(d[key]??'Unspecified'))}</dd>`).join('')}</dl>${d.notes!==undefined?`<h3>Notes</h3><pre class="private-note-body">
${e(d.notes)}</pre>`:''}${d.assessments?`<h3>Assessments</h3><ul>${d.assessments.map(a=>`<li><strong>${e(a.title)}</strong> · ${e(a.type)} · ${e(a.status)}<ul>${a.tasks.map(task=>`<li>${task.done?'Completed':'Open'}: ${e(task.title)}</li>`).join('')}</ul></li>`).join('')}</ul>`:''}${d.studySessions?`<h3>Saved study agenda</h3><p>These saved sessions do not create calendar commitments.</p><ul>${d.studySessions.map(s=>`<li>${e(s.day)} ${e(s.time)} · ${e(s.title)}</li>`).join('')}</ul>`:''}`;
 return{reset,openFavorite,offline(){reset();onChange();},render(){if(disposed)return'';if(!canUse()||selected&&!matches(selected.schoolReadToken)){reset();return'';}if(!selected)return'';if(details&&details.expiresAt<=clock()){details=null;error='Temporary School details expired. Search again to reopen this record.';}return`<section class="panel" id="private-search-school-panel" aria-labelledby="private-search-school-title"><h2 id="private-search-school-title" tabindex="-1">${e(selected.title)}</h2>${busy?'<p role="status">Checking selected School record…</p>':''}${error?`<p role="alert" id="private-search-school-error" tabindex="-1">${e(error)}</p>`:''}${details?body(details)+(allowFavorites?schoolFavoriteButton(details.kind,selected.schoolReadToken):''):''}<button class="btn" type="button" id="private-search-school-close">Close School details</button></section>`;},click(event){const t=event?.target;if(!t?.closest)return false;const button=t.closest('[data-private-search-school]');if(button){void open(button.dataset.privateSearchSchool);return true;}if(t.closest('#private-search-school-close')){reset();onChange();return true;}return false;},dispose(){reset();disposed=true;}};
}
