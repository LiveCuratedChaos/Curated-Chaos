import {randomBytes} from 'node:crypto';
import {privateSchoolState} from './private-school-read.mjs';
import {privateProjectState} from './private-projects.mjs';
import {normalizeCloudRecords} from '../src/dev-brief-model.mjs';
import {isPrivateNoteSummary} from './private-note-source.mjs';
import {createPrivateFavoriteItemStore} from './private-brief-layout.mjs';
import {validateFavoriteMemberships} from './private-favorite-items.mjs';
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
export function createPrivateFavoriteNotes(options){
 return createFavoriteRecords(options,{type:'note',lookup:'getPrivateNote',tokenField:'noteToken',selected:(reader,id,actor,key)=>reader.colorRecord(id,actor,key),summary:isPrivateNoteSummary});
}
export function createPrivateFavoriteTasks(options){
 const summary=(row,owner)=>row?.deleted_at===null&&Number.isInteger(row.version)&&row.version>0&&normalizeCloudRecords([row],owner,options.taskOptions).tasks.length===1;
 return createFavoriteRecords(options,{type:'task',lookup:'getPrivateTaskDetails',tokenField:'taskReadToken',selected:(reader,id,actor,key)=>reader.selectedRecord(id,actor,key),summary});
}
export function createPrivateFavoriteEvents(options){
 const summary=(row,owner)=>row?.deleted_at===null&&Number.isInteger(row.version)&&row.version>0&&normalizeCloudRecords([row],owner).events.length===1;
 return createFavoriteRecords(options,{type:'event',lookup:'getPrivateEvent',tokenField:'eventReadToken',summary,selected:(reader,id,actor,key)=>reader.selectedRecord(id,actor,key),
  fields:row=>({day:row.payload.day,time:row.payload.time,allDay:options.allowAllDay&&row.payload.all_day===true})});
}
export function createPrivateFavoriteProjects(options){
 function summary(row,owner){try{privateProjectState(row,owner,{summary:true});return true;}catch{return false;}}
 return createFavoriteRecords(options,{type:'project',lookup:'getPrivateProject',tokenField:'projectReadToken',selected:(reader,id,actor,key)=>reader.selectedRecord(id,actor,key),summary,
  inventory:(api,actor)=>api.listPrivateProjects(actor.accessToken,actor.ownerId),fields:row=>({section:row.section,projectStatus:row.payload.status})});
}
export function createPrivateFavoriteSchool(options,type){
 const kind=type==='program'?'degree':type;
 if(type!=='program'&&type!=='course')throw Error('Choose a School program or course.');
 function summary(row,owner){
  try{return privateSchoolState(row,owner).fields.kind===kind;}catch{return false;}
 }
 async function selected(reader,id,actor,key){
  const source=await reader.selectedSource(id,actor,key);
  if(source.record.payload.kind!==kind)throw Error('Select the current School original.');
  return source;
 }
 return createFavoriteRecords(options,{type,lookup:'getPrivateSchoolRecord',tokenField:'schoolReadToken',summary,selected,
  inventory:(api,actor)=>api.listPrivateSchoolSummaries(actor.accessToken,actor.ownerId)});
}
export function createPrivateFavoriteDocuments({api,now,library}){
 const choices=new Map();
 const row=(doc,owner)=>({id:doc.id,owner_id:owner,version:doc.version,payload:{title:doc.fields.name},doc});
 const storage=api.documentStorage;
 const lookup=async(actor,id)=>{
  try{
   const doc=await storage.inspect(actor,id);
   return doc?.id===id?row(doc,actor.ownerId):null;
  }catch{return null;}
 };
 const inventoryReader={begin(id,owner,expiresAt){
  const previous=choices.get(id);
  clearTimeout(previous?.timer);
  const view={owner,expiresAt,items:new Map()};
  choices.set(id,view);
  view.timer=setTimeout(()=>{if(choices.get(id)===view)choices.delete(id);},Math.max(1,expiresAt-now()));
  view.timer.unref?.();
  return entry=>{
   const documentToken=randomBytes(32).toString('base64url');
   view.items.set(documentToken,entry);
   return {documentToken};
  };
 }};
 const reader={current:(id,key)=>library.hasChoice(id,key)};
 const service=createFavoriteRecords({api,now,inventoryReader,selectedReader:()=>reader},{
  type:'document',tokenField:'documentToken',summary:(entry,owner)=>entry?.owner_id===owner,
  async selected(_reader,id,actor,key){
   const {doc,expiresAt}=await library.selectedDocument(id,actor,key);
   return {record:row(doc,actor.ownerId),expiresAt};
  },
  async inventory(_api,actor,refs){
   const result=[],ids=[...refs.keys()];
   for(let i=0;i<ids.length;i+=8){
    const batch=await Promise.all(ids.slice(i,i+8).map(id=>lookup(actor,id)));
    result.push(...batch.filter(Boolean));
   }
   return result;
  }
 });
 function clear(id){
  service.clear(id);
  clearTimeout(choices.get(id)?.timer);
  choices.delete(id);
 }
 async function open(id,actor,key,current){
  const view=choices.get(id),entry=view?.items.get(key);
  const live=()=>current()&&entry&&view.owner===actor.ownerId&&choices.get(id)===view&&view.expiresAt>now()&&view.items.has(key);
  if(!live())throw Error('Choose a current document favorite.');
  const snapshot=await service.snapshotFor(actor);
  if(!live()||!snapshot.layout.items.some(item=>item.type==='document'&&item.id===entry.id))throw Error('Favorite changed.');
  const latest=await lookup(actor,entry.id);
  if(!live()||!latest||latest.version!==entry.version||latest.payload.title!==entry.payload.title)throw Error('Document changed.');
  view.items.delete(key);
  return library.openFavorite(id,actor,latest.doc,view.expiresAt);
 }
 return {...service,open,clear,dispose(){for(const id of choices.keys())clear(id);service.dispose();}};
}
function createFavoriteRecords({api,now,selectedReader,inventoryReader},policy){
 const store=createPrivateFavoriteItemStore({api,now}),states=new Map();
 function clear(id){clearTimeout(states.get(id)?.timer);states.delete(id);store.clear(id);}
 const active=s=>Boolean(s&&states.get(s.id)===s&&s.expiresAt>now()&&selectedReader(s.id,s.token)?.current(s.id,s.token));
 async function selected(s,actor){
  if(!active(s)||actor.ownerId!==s.owner)throw Error('Select the current original.');
  const original=await policy.selected(selectedReader(s.id,s.token),s.id,actor,s.token);
  if(!active(s)||original.record.id!==s.recordId||original.record.version!==s.version||original.record.payload.title!==s.title)throw Error('The original changed.');
 }
 async function read(id,actor,deadline,sourceToken){
  clear(id);if(!token(sourceToken))throw Error('Select a private original.');
  const reader=selectedReader(id,sourceToken);if(!reader)throw Error('Select the current original.');
  const s={id,owner:actor.ownerId,token:sourceToken,expiresAt:Math.min(deadline,now()+300000)};states.set(id,s);
  s.timer=setTimeout(()=>{if(states.get(id)===s)clear(id);},Math.max(1,s.expiresAt-now()));s.timer.unref?.();
  const {record,expiresAt}=await policy.selected(reader,id,actor,sourceToken);if(!active(s))throw Error('Selection ended.');
  s.recordId=record.id;s.version=record.version;s.title=record.payload.title;s.expiresAt=Math.min(s.expiresAt,expiresAt);
  const view=await store.read(id,actor,s.expiresAt);if(!active(s))throw Error('Selection ended.');
  validateFavoriteMemberships(view.layout,view.collections);
  Object.assign(s,{view});const item=view.layout.items.find(v=>v.type===policy.type&&v.id===record.id);
  return{title:s.title,favorite:Boolean(item),members:item?.collections??[],collections:view.collections,expiresAt:s.expiresAt,baseTag:view.baseTag};
 }
 async function review(id,actor,values){
  const s=states.get(id);if(!s?.view||!active(s)||values.baseTag!==s.view.baseTag||typeof values.favorite!=='boolean'||!Array.isArray(values.members)||new Set(values.members).size!==values.members.length||!values.favorite&&values.members.length)throw Error('Review current favorite choices.');
  s.review=null;await selected(s,actor);
  const members=s.view.collections.filter(c=>values.members.includes(c.id)).map(c=>c.id);
  if(members.length!==values.members.length)throw Error('Choose available collections.');
  const layout=structuredClone(s.view.layout),old=layout.items.find(v=>v.type===policy.type&&v.id===s.recordId);
  if(old&&values.favorite)old.collections=members;
  else if(old)layout.items=layout.items.filter(v=>v!==old);
  else if(values.favorite)layout.items.push({type:policy.type,id:s.recordId,collections:members});
  const result=await store.prepare(id,actor,{layout,baseTag:values.baseTag});if(!active(s))throw Error('Selection ended.');
  if(result.noChanges)return result;
  if(!store.current(id,result.reviewId))throw Error('Favorite review expired.');
  s.review=result.reviewId;
  return{reviewId:s.review,expiresAt:result.expiresAt,title:s.title,favorite:values.favorite,members};
 }
 function claim(id,actor,reviewId){
  const s=states.get(id);if(!active(s)||s.review!==reviewId)throw Error('Favorite review expired.');
  s.review=null;return{s,inner:store.claim(id,actor.ownerId,reviewId)};
 }
 async function authorize(c,actor){await selected(c.s,actor);return (await store.authorize(c.inner,actor))&&active(c.s);}
 async function save(c,actor){
  if(!active(c.s))throw Error('Favorite selection ended.');
  const result=await store.save(c.inner,actor);if(!active(c.s)||!result.saved)throw Error('Check current favorites.');
  clear(c.s.id);return{saved:true};
 }
 const inventory=(actor,refs)=>policy.inventory?policy.inventory(api,actor,refs):api.listPrivateBriefRecords(actor.accessToken,actor.ownerId);
 function visibleRows(rows,owner,refs){
  if(!Array.isArray(rows)||rows.length>2000)throw Error('Favorite items are unavailable.');
  const visible=new Map();
  for(const row of rows){
   if(!refs.has(row?.id)||!policy.summary(row,owner))continue;
   if(visible.has(row.id))throw Error('Favorite item inventory changed.');
   visible.set(row.id,row);
  }
  return [...visible.values()];
 }
 function originalRow(row,issue){return {title:row.payload.title,...policy.fields?.(row),[policy.tokenField]:issue(row)[policy.tokenField]};}
 async function widgetOriginal(id,actor,expiresAt,ref,current){
  const rows=await api[policy.lookup](actor.accessToken,ref.id,actor.ownerId);
  const row=rows?.[0];
  if(!current()||!Array.isArray(rows)||rows.length!==1||!policy.summary(row,actor.ownerId)
   ||row.id!==ref.id||row.version!==ref.version||row.payload.title!==ref.title||row.section!==ref.section)throw Error('Favorite changed.');
  return originalRow(row,inventoryReader.begin(id,actor.ownerId,expiresAt,1));
 }
 async function list(id,actor,deadline,offset,current,collectionId){
  if(!Number.isInteger(offset)||offset<0||offset%50!==0)throw Error('Choose a page of favorites.');
  const snapshot=await store.snapshotFor(actor);
  if(!current())throw Error('Favorite items are unavailable.');
  validateFavoriteMemberships(snapshot.layout,snapshot.collections);
  const collection=collectionId===undefined?null:snapshot.collections.find(c=>c.id===collectionId);
  if(collectionId!==undefined&&!collection)throw Error('Choose a current collection.');
  const refs=new Map(snapshot.layout.items.filter(item=>item.type===policy.type&&(!collection||item.collections.includes(collection.id))).map(item=>[item.id,item.collections]));
  const rows=await inventory(actor,refs);
  if(!current())throw Error('Favorite items are unavailable.');
  const entries=visibleRows(rows,actor.ownerId,refs).sort((a,b)=>a.payload.title.localeCompare(b.payload.title)||a.id.localeCompare(b.id));
  const expiresAt=Math.min(deadline,now()+300000),issue=inventoryReader.begin(id,actor.ownerId,expiresAt,50);
  const items=entries.slice(offset,offset+50).map(r=>({...originalRow(r,issue),collections:snapshot.collections.filter(c=>refs.get(r.id).includes(c.id)).map(c=>c.name)}));
  return{readOnly:true,...(collection?{collection}:{}),[policy.type+'s']:items,offset,count:entries.length,expiresAt};
 }
 return{read,review,claim,authorize,save,list,clear,snapshotFor:store.snapshotFor,inventory,visibleRows,widgetOriginal,dispose(){for(const id of states.keys())clear(id);store.dispose();}};
}
