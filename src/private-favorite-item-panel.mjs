import {validDay} from './dev-brief-model.mjs';
import {PROJECT_AREAS,PROJECT_STATUSES} from './private-project-model.mjs';
import {escapeHtml as e} from './core.mjs';
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const label=(v,max)=>typeof v==='string'&&v&&v.trim()===v&&v.length<=max;
const title=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200;
const keys=(v,expected)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===expected;
const control=(action,title)=>'<button type="button" class="btn" data-favorite-item-action="'+action+'">'+e(title)+'</button>';
const heading='#private-favorite-items-title';
export const favoriteTokenFields=Object.freeze({program:'schoolReadToken',course:'schoolReadToken',event:'eventReadToken',project:'projectReadToken',task:'taskReadToken',note:'noteToken'});
export function schoolFavoriteButton(kind,selection){
 if(!token(selection)||!['degree','course'].includes(kind))return '';
 const type=kind==='degree'?'program':'course';
 return '<button type="button" class="btn" data-kind="'+type+'" data-favorite-item-action="select" data-selection="'+e(selection)+'">Manage '+type+' favorite</button>';
}
export function validFavoriteOriginal(type,row,withCollections=false){
 if(!Object.hasOwn(favoriteTokenFields,type))return false;
 const field=favoriteTokenFields[type],fields=[field,'title'];
 if(type==='project')fields.push('projectStatus','section');
 if(type==='event')fields.push('day','time','allDay');
 if(withCollections)fields.push('collections');
 if(!keys(row,fields.sort().join(','))||!token(row[field])||!title(row.title))return false;
 if(type==='project'&&(!PROJECT_AREAS.includes(row.section)||!PROJECT_STATUSES.includes(row.projectStatus)))return false;
 if(type==='event'&&(!validDay(row.day)||typeof row.time!=='string'||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.time)||typeof row.allDay!=='boolean'||row.allDay&&row.time!=='00:00'))return false;
 return !withCollections||Array.isArray(row.collections)&&row.collections.length<=100&&row.collections.every(name=>label(name,80));
}
export function createFavoriteItemPanel({client,clock,onChange,canUse,openers,onSaved=()=>{}}){
 const services={
  event:{field:'eventReadToken',list:client.favoriteEventsList,read:client.favoriteEventRead,review:client.favoriteEventReview,save:client.favoriteEventSave,cancel:client.favoriteEventCancel},
  project:{field:'projectReadToken',list:client.favoriteProjectsList,read:client.favoriteProjectRead,review:client.favoriteProjectReview,save:client.favoriteProjectSave,cancel:client.favoriteProjectCancel},
  note:{field:'noteToken',list:client.favoriteNotesList,read:client.favoriteNoteRead,review:client.favoriteNoteReview,save:client.favoriteNoteSave,cancel:client.favoriteNoteCancel},
  task:{field:'taskReadToken',list:client.favoriteTasksList,read:client.favoriteTaskRead,review:client.favoriteTaskReview,save:client.favoriteTaskSave,cancel:client.favoriteTaskCancel}
 };
 for(const type of ['program','course']){
  services[type]={field:'schoolReadToken',list:(offset,collection)=>client.favoriteSchoolList(type,offset,collection),
   read:key=>client.favoriteSchoolRead(type,key),review:values=>client.favoriteSchoolReview(type,values),
   save:reviewId=>client.favoriteSchoolSave(type,reviewId),cancel:()=>client.favoriteSchoolCancel(type)};
 }
 let type='note';
 const service=()=>services[type],noun=()=>type+'s',capital=()=>type[0].toUpperCase()+type.slice(1);

 let mode='',generation=0,timer,view=null,review=null,choice=false,members=[],notice='',error='',busy=false,locked=false;
 function reset(){generation++;clearTimeout(timer);mode='';view=review=null;choice=busy=locked=false;members=[];notice=error='';}
 const fresh=expiry=>Number.isFinite(expiry)&&expiry>clock()&&expiry<=clock()+300000;
 function expire(){reset();mode='expired';error='This view expired. Select the original again.';onChange(heading);}
 function arm(time){clearTimeout(timer);timer=setTimeout(expire,Math.max(1,time-clock()));timer.unref?.();}
 async function read(sourceToken,offset=0,collection){
  reset();mode=sourceToken?'edit':'list';busy=true;const n=generation;onChange(heading);
  try{
   const r=sourceToken?await service().read(sourceToken):await service().list(offset,collection);if(n!==generation)return;
   if(!fresh(r?.expiresAt))throw Error();
   if(sourceToken){
    if(!keys(r,'baseTag,collections,expiresAt,favorite,members,title')||!token(r.baseTag)||!title(r.title)||typeof r.favorite!=='boolean'||!Array.isArray(r.collections)||r.collections.length>100||r.collections.some(c=>!keys(c,'id,name')||!uuid(c.id)||!label(c.name,80))||new Set(r.collections.map(c=>c.id)).size!==r.collections.length||!Array.isArray(r.members)||new Set(r.members).size!==r.members.length||r.members.some(id=>!r.collections.some(c=>c.id===id))||!r.favorite&&r.members.length)throw Error();
    choice=r.favorite;members=[...r.members];
   }else{
    if(!keys(r,['count','expiresAt',noun(),'offset','readOnly',...(collection?['collection']:[])].sort().join(','))||collection&&(!keys(r.collection,'id,name')||r.collection.id!==collection||!label(r.collection.name,80))||r.readOnly!==true||r.offset!==offset||!Number.isInteger(r.count)||r.count<0||r.count>500||!Array.isArray(r[noun()])||r[noun()].length!==Math.max(0,Math.min(50,r.count-offset))||new Set(r[noun()].map(v=>v[service().field])).size!==r[noun()].length||r[noun()].some(v=>!validFavoriteOriginal(type,v,true)))throw Error();
   }
   view=r;arm(r.expiresAt);
  }catch{if(n===generation){locked=true;error='Favorites are unavailable. Reopen the current view to try again.';}}
  finally{if(n===generation){busy=false;onChange(heading);}}
 }
 async function prepare(){
  if(!view||!fresh(view.expiresAt)){expire();return;}
  const n=++generation;busy=true;error='';onChange(heading);
  try{
   const r=await service().review({baseTag:view.baseTag,favorite:choice,members});if(n!==generation)return;
   if(r?.noChanges===true){notice='No changes to save.';return;}
   if(!keys(r,'expiresAt,favorite,members,reviewId,title')||!token(r.reviewId)||!fresh(r.expiresAt)||r.expiresAt>view.expiresAt||r.title!==view.title||r.favorite!==choice||!Array.isArray(r.members)||r.members.length!==members.length||new Set(r.members).size!==r.members.length||r.members.some(id=>!members.includes(id)))throw Error();
   review=r;
  }catch{if(n===generation){locked=true;error='The original or its collections changed. Reopen the original to review again.';}}
  finally{if(n===generation){busy=false;onChange(heading);}}
 }
 async function save(){
  if(!fresh(review?.expiresAt)){expire();return;}
  const n=++generation,r=review;review=null;busy=true;onChange(heading);
  try{
   const result=await service().save(r.reviewId);if(n!==generation)return;
   if(!keys(result,'saved')||result.saved!==true)throw Error();
   onSaved();await read(null);if(generation===n+1&&!locked){notice=capital()+(r.favorite?' saved in Favorites.':' removed from Favorites.');onChange(heading);}
  }catch{if(n===generation){busy=false;locked=true;error='The favorite change could not be confirmed. Reopen the saved item before trying again.';onChange(heading);}}
 }
 async function close(){
  reset();const n=generation;mode='closing';busy=true;onChange(heading);
  try{await service().cancel();}catch{/* The next read retires this view. */}
  if(n===generation){reset();onChange('[data-favorite-action="open"]');}
 }
 function input(event){
  const el=event.target,field=el.dataset?.favoriteItemField;if(!field)return false;
  if(!canUse()||mode!=='edit'||!view||busy||review||locked)return true;
  if(!fresh(view.expiresAt)){expire();return true;}
  if(field==='favorite'){choice=el.checked;if(!choice)members=[];}
  if(field==='member'&&choice&&view.collections.some(c=>c.id===el.value)){
   if(el.checked&&!members.includes(el.value))members.push(el.value);
   if(!el.checked)members=members.filter(id=>id!==el.value);
  }
  notice=error='';onChange(field==='favorite'?'[data-favorite-item-field="favorite"]':'[data-favorite-item-field="member"][value="'+el.value+'"]');return true;
 }
 function click(event){
  const el=event.target.closest('[data-favorite-item-action]');if(!el)return false;
  const action=el.dataset.favoriteItemAction;
  if(action==='list'||action==='select'){
   if(!Object.hasOwn(services,el.dataset.kind)||typeof openers[el.dataset.kind]!=='function'||mode)return true;
   type=el.dataset.kind;
  }
  if(busy||!canUse())return true;
  if(action==='close'){void close();return true;}
  if(action==='list'){const collection=el.dataset.collection;if(collection===undefined||uuid(collection))void read(null,0,collection);return true;}
  if(action==='select'&&token(el.dataset.selection)){void read(el.dataset.selection);return true;}
  if(!view||locked)return true;
  if(!fresh(view.expiresAt)){expire();return true;}
  if(mode==='list'){
   if(action==='open'){
    const selected=view[noun()].find(r=>r[service().field]===el.dataset.selection);
    if(selected){const deadline=view.expiresAt;reset();openers[type](el.dataset.selection,selected,deadline);}
   }
   if(action==='previous'&&view.offset>=50)void read(null,view.offset-50,view.collection?.id);
   if(action==='next'&&view.offset+50<view.count)void read(null,view.offset+50,view.collection?.id);
  }else if(mode==='edit'){
   if(action==='approve'&&review)void save();
   if(action==='review'&&!review)void prepare();
   if(action==='back'&&review){review=null;onChange(heading);}
  }
  return true;
 }
 function render(){
  if(!mode)return '';
  let body='';
  if(busy)body='<p role="status">Checking Favorites…</p>';
  else if(mode==='list'&&view){
   body=view.collection?'<h3>'+e(view.collection.name)+'</h3>':'';
   body+=view[noun()].length?'<ul>'+view[noun()].map(v=>'<li><button type="button" class="btn" data-favorite-item-action="open" data-selection="'+v[service().field]+'">'+e(v.title)+'</button>'+(v.collections.length?' · '+v.collections.map(e).join(', '):'')+'</li>').join('')+'</ul>':'<p>No favorite '+noun()+' on this page.</p>';
   if(view.offset>=50)body+=control('previous','Previous favorite '+noun());
   if(view.offset+50<view.count)body+=control('next','Next favorite '+noun());
  }else if(mode==='edit'&&view){
   body='<h3>'+e(view.title)+'</h3>';
   if(review){body+='<p>'+e(choice?'Keep this '+type+' in Favorites':'Remove this '+type+' from Favorites')+'</p>';const names=view.collections.filter(c=>members.includes(c.id)).map(c=>e(c.name));if(choice)body+='<p>Collections · '+(names.join(', ')||'None')+'</p>';body+=control('approve','Approve favorite '+type+' change')+control('back','Back to favorite '+type+' choices');}
   else body+='<fieldset'+(locked?' disabled':'')+'><legend>Favorite '+type+' choices</legend><label><input type="checkbox" data-favorite-item-field="favorite"'+(choice?' checked':'')+'> Save this '+type+' in Favorites</label>'+ (choice?view.collections.map(c=>'<label><input type="checkbox" data-favorite-item-field="member" value="'+c.id+'"'+(members.includes(c.id)?' checked':'')+'> '+e(c.name)+'</label>').join(''):'')+'</fieldset>'+(locked?'':control('review','Review favorite '+type+' change'));
  }
  return '<section class="panel" aria-labelledby="private-favorite-items-title"><h2 id="private-favorite-items-title" tabindex="-1">Favorite '+noun()+'</h2>'+(error?'<p role="alert">'+e(error)+'</p>':'')+(notice?'<p role="status">'+e(notice)+'</p>':'')+body+(busy?'':control('close','Close favorite '+noun()))+'</section>';
 }
 return{reset,input,click,render,opened:()=>Boolean(mode),editing:()=>mode==='edit'};
}
