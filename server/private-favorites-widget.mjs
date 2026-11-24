import {randomBytes} from 'node:crypto';
import {TASK_FILTERS} from '../src/private-widget-layout.mjs';

const pageAreas={work:'Work',home:'Home',school:'School',personal:'Personal Life',notes:'Personal Life'};
const maxItems=10; // Largest selectable widget limit.

export function createFavoritesWidget({favorites,services,now}){
 function clear(context){
  for(const view of context.favoriteWidgetViews?.values()??[])clearTimeout(view.timer);
  context.favoriteWidgetViews=null;
 }
 const inventoryGroup=type=>type==='project'?'projects':'brief';
 async function eligible(actor,refs,filter){
  const inventories=new Map(),matches=[];
  let incomplete=false;
  for(const [type,service] of Object.entries(services)){
   if(!service)continue;
   const ids=new Set(refs.filter(ref=>ref.type===type).map(ref=>ref.id));
   if(!ids.size)continue;
   const group=inventoryGroup(type);
   if(!inventories.has(group))inventories.set(group,Promise.resolve().then(()=>service.inventory(actor)));
   try{
    for(const row of service.visibleRows(await inventories.get(group),actor.ownerId,ids)){
     if(filter==='all'||row.section===filter)matches.push({type,row});
    }
   }catch{incomplete=true;}
  }
  return {matches,incomplete};
 }
 async function list(context,actor,filter,current){
  if(!TASK_FILTERS.includes(filter))throw Error('Choose a widget area.');
  const views=context.favoriteWidgetViews??=new Map();
  const view={owner:actor.ownerId,choices:new Map(),expiresAt:Math.min(context.expiresAt,now()+300000)};
  clearTimeout(views.get(filter)?.timer);
  views.set(filter,view);
  view.timer=setTimeout(()=>{if(views.get(filter)===view)views.delete(filter);},Math.max(1,view.expiresAt-now()));
  view.timer.unref?.();
  const snapshot=await favorites.widgetSnapshotFor(actor);
  const {matches,incomplete}=await eligible(actor,snapshot.items,filter);
  if(!current()||context.favoriteWidgetViews!==views||views.get(filter)!==view||view.expiresAt<=now())throw Error('Widget expired.');
  matches.sort((a,b)=>a.row.payload.title.localeCompare(b.row.payload.title)||a.type.localeCompare(b.type)||a.row.id.localeCompare(b.row.id));
  const items=matches.slice(0,maxItems).map(({type,row})=>{
   const choice=randomBytes(32).toString('base64url'),title=row.payload.title;
   view.choices.set(choice,{id:row.id,version:row.version,type,title,section:row.section});
   return {type,title,choice};
  });
  return {readOnly:true,filter,incomplete,pages:snapshot.pages.filter(page=>filter==='all'||pageAreas[page]===filter),items,itemCount:matches.length,expiresAt:view.expiresAt};
 }
 async function select(context,actor,{filter,choice},current){
  const view=context.favoriteWidgetViews?.get(filter),ref=view?.choices.get(choice);
  const live=()=>ref&&current()&&context.favoriteWidgetViews?.get(filter)===view&&view.owner===actor.ownerId&&view.expiresAt>now();
  if(!live())throw Error('Select a current favorite.');
  const snapshot=await favorites.widgetSnapshotFor(actor);
  if(!live()||!snapshot.items.some(item=>item.id===ref.id&&item.type===ref.type))throw Error('Favorite changed.');
  const row=await services[ref.type].widgetOriginal(context.id,actor,view.expiresAt,ref,live);
  if(!live())throw Error('Widget expired.');
  return {readOnly:true,type:ref.type,row,expiresAt:view.expiresAt};
 }
 return {list,select,clear};
}
