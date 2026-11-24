import {createFavoriteItemPanel,favoriteTokenFields,validFavoriteOriginal} from './private-favorite-item-panel.mjs';
import {escapeHtml as e} from './core.mjs';
import {FAVORITE_PAGES,validateFavoritePages,favoritePageChanges} from './private-favorites.mjs';

const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const button=(action,label)=>`<button type="button" class="btn" data-favorite-action="${action}">${label}</button>`;
const checked=value=>value?' checked':'';
function sameLayout(a,b){
 const first=validateFavoritePages(a),second=validateFavoritePages(b);
 return first.collections.length===second.collections.length&&first.collections.every((v,i)=>v.id===second.collections[i].id&&v.name===second.collections[i].name)&&first.pages.length===second.pages.length&&first.pages.every((v,i)=>v.page===second.pages[i].page&&v.collections.join(',')===second.pages[i].collections.join(','));
}
export function createFavoritesPanel({client,pages,activePage,clock=Date.now,onChange,onSaved=()=>{},onOpenNote=null,onOpenTask=null,onOpenProject=null,onOpenEvent=null,onOpenSchool=null,canUse,idFactory=()=>crypto.randomUUID()}){
 let view=null,draft=null,review=null,opened=false,busy=false,locked=false,error='',notice='',newName='',generation=0,timer;
 const fresh=time=>Number.isFinite(time)&&time>clock()&&time<=clock()+300000;
 const title='#private-favorites-title';
 const openers={};
 if(onOpenSchool){
  for(const type of ['program','course'])openers[type]=(key,row,expiresAt)=>{reset();onOpenSchool(type,key,row,expiresAt);};
 }
 if(onOpenNote)openers.note=key=>{reset();onOpenNote(key);};
 if(onOpenEvent)openers.event=(key,row,expiresAt)=>{reset();onOpenEvent(key,row,expiresAt);};
 if(onOpenProject)openers.project=(key,row,deadline)=>{reset();onOpenProject(key,row,deadline);};
 if(onOpenTask)openers.task=key=>{reset();onOpenTask(key);};
 const items=Object.keys(openers).length?createFavoriteItemPanel({client,clock,onChange,canUse,openers,onSaved}):null;
 function reset(){
  items?.reset();generation++;clearTimeout(timer);opened=busy=locked=false;view=draft=review=null;newName=error=notice='';
 }
 function expire(){
  reset();opened=locked=true;error='Favorites expired. Fetch the latest Favorites to reopen them.';onChange(title);
 }
 async function read(message=''){
  if(!canUse()||busy)return;
  reset();const n=generation;opened=busy=true;onChange(title);
  try{
   const result=await client.favoritesRead();if(n!==generation)return;
   if(!token(result?.viewId)||!token(result.baseTag)||result.readOnly!==false||!fresh(result.expiresAt))throw Error();
   view={...result,layout:validateFavoritePages(result.layout)};notice=message;
   timer=setTimeout(expire,result.expiresAt-clock());timer.unref?.();
  }catch{if(n===generation){locked=true;error='Favorites could not be read. Fetch the latest Favorites to try again.';}}
  finally{if(n===generation){busy=false;onChange(title);}}
 }
 function edit(addPage){
  draft=structuredClone(view.layout);error=notice=newName='';
  if(addPage&&pages.includes(activePage)&&!draft.pages.some(v=>v.page===activePage))draft.pages.push({page:activePage,collections:[]});
  onChange(title);
 }
 async function prepare(){
  let layout;
  try{layout=validateFavoritePages(draft);}catch(err){error=err.message;onChange(title);return;}
  if(newName.trim()){error='Add the new collection or clear its name before reviewing.';onChange(title);return;}
  if(!favoritePageChanges(view.layout,layout).length){error='Choose a change to review.';onChange(title);return;}
  const n=++generation;busy=true;error='';onChange(title);
  try{
   const result=await client.favoritesReview({baseTag:view.baseTag,layout});if(n!==generation)return;
   if(!token(result?.reviewId)||!fresh(result.expiresAt)||result.expiresAt>view.expiresAt||!sameLayout(result.layout,layout))throw Error();
   review=result;
  }catch{if(n===generation){locked=true;error='Favorites changed or the review expired. Fetch the latest Favorites before reviewing again.';}}
  finally{if(n===generation){busy=false;onChange(title);}}
 }
 async function save(){
  const n=++generation,current=review;busy=true;review=null;error='';onChange(title);
  try{
   const result=await client.favoritesSave(current.reviewId);if(n!==generation)return;
   if(result?.saved!==true||!sameLayout(result.layout,current.layout))throw Error();
   busy=false;onSaved();await read('Favorites saved.');
  }catch{if(n===generation){busy=false;locked=true;error='The save could not be confirmed. Fetch the latest Favorites before trying again.';onChange(title);}}
 }
 function removeCollection(id){
  const collection=draft.collections.find(v=>v.id===id);
  if(!collection)return;
  draft.collections=draft.collections.filter(v=>v!==collection);
  for(const page of draft.pages)page.collections=page.collections.filter(value=>value!==id);
 }
 function input(event){
  if(items?.input(event)||items?.opened())return true;
  const el=event.target,key=el.dataset?.favoriteField;if(!key)return false;
  if(!canUse()||busy||locked||!draft||review)return true;
  if(!fresh(view.expiresAt)){expire();return true;}
  if(key==='new'){newName=el.value;return true;}
  if(key==='name'){
   const c=draft.collections.find(v=>v.id===el.dataset.collection);
   if(c)c.name=el.value;return true;
  }
  const page=el.dataset.page;if(!pages.includes(page))return true;
  const row=draft.pages.find(v=>v.page===page);
  if(key==='page'){
   if(el.checked&&!row)draft.pages.push({page,collections:[]});
   if(!el.checked&&row)draft.pages=draft.pages.filter(v=>v!==row);
  }else if(key==='member'&&row&&draft.collections.some(v=>v.id===el.dataset.collection)){
   const id=el.dataset.collection;
   if(el.checked&&!row.collections.includes(id))row.collections.push(id);
   if(!el.checked)row.collections=row.collections.filter(v=>v!==id);
  }
  error='';onChange(`[data-favorite-field="${key}"][data-page="${page}"]`+(key==='member'?`[data-collection="${el.dataset.collection}"]`:''));return true;
 }
 async function cancel(reopen=false){
  reset();const n=generation;opened=busy=true;onChange(title);
  try{await client.favoritesCancel();}catch{/* A fresh read also invalidates the old review. */}
  if(n!==generation)return;
  reset();if(reopen)await read();else onChange('[data-favorite-action="open"]');
 }
 function click(event){
  if(items&&(!draft&&!busy&&!review||items.opened())&&items.click(event))return true;
  if(items?.opened())return false;
  const el=event.target.closest('[data-favorite-action]');if(!el)return false;
  const action=el.dataset.favoriteAction;
  if(action==='close'&&!busy){void cancel();return true;}
  if(!canUse()||busy)return true;
  if(action==='open'||action==='refresh'){void read();return true;}
  if(locked||!view)return true;
  if(!fresh(view.expiresAt)){expire();return true;}
  if(!draft){
   if(action==='manage'||action==='current')edit(action==='current');
  }else if(review){
   if(action==='approve'){if(fresh(review.expiresAt))void save();else expire();}
   if(action==='back'){review=null;onChange(title);}
  }else if(action==='add'){
   const c={id:idFactory(),name:newName.trim()};
   try{validateFavoritePages({...draft,collections:[...draft.collections,c]});draft.collections.push(c);newName=error='';}
   catch(err){error=err.message;}onChange('[data-favorite-field="new"]');
  }else if(action==='remove'){removeCollection(el.dataset.collection);error='';onChange(title);}
  else if(action==='review')void prepare();
  else if(action==='discard')void cancel(true);
  return true;
 }
 function links(layout,matches){
  return layout.pages.filter(row=>pages.includes(row.page)&&matches(row)).map(({page})=>{
   const [label,path]=FAVORITE_PAGES[page];return `<li><a href="${path}">${e(label)}</a></li>`;
  }).join('');
 }
 function itemLists(collection=null){
  return Object.keys(openers).map(type=>'<button type="button" class="btn" data-kind="'+type+'" data-favorite-item-action="list"'+(collection?' data-collection="'+collection.id+'"':'')+'>View favorite '+type+'s'+(collection?' in '+e(collection.name):'')+'</button>').join('');
 }
 function groups(layout){
  const sections=[];
  for(const name of new Set(pages.map(p=>FAVORITE_PAGES[p][2]))){
   const items=links(layout,p=>FAVORITE_PAGES[p.page][2]===name);
   if(items)sections.push(`<h3>${e(name)}</h3><ul>${items}</ul>`);
  }
  for(const c of layout.collections){
   const items=links(layout,p=>p.collections.includes(c.id));
   sections.push(`<h3>${e(c.name)}</h3>`+(items?`<ul>${items}</ul>`:'<p>No saved pages in this collection.</p>')+itemLists(c));
  }
  return sections.join('')||'<p>Choose the pages you want to reach from Favorites.</p>';
 }
 function editor(){
  const collections=draft.collections.map(c=>`<div><label>Collection name <input data-favorite-field="name" data-collection="${c.id}" value="${e(c.name)}" maxlength="80"></label> <button type="button" class="btn" data-favorite-action="remove" data-collection="${c.id}">Remove collection ${e(c.name)}</button></div>`).join('');
  const choices=pages.map(page=>{
   const row=draft.pages.find(v=>v.page===page),label=e(FAVORITE_PAGES[page][0]);
   const memberships=row?draft.collections.map(c=>`<label><input type="checkbox" data-favorite-field="member" data-page="${page}" data-collection="${c.id}"${checked(row.collections.includes(c.id))}> Include ${label} in ${e(c.name)}</label>`).join(''):'';
   return `<div><label><input type="checkbox" data-favorite-field="page" data-page="${page}"${checked(row)}> ${label}</label>${memberships}</div>`;
  }).join('');
  return `<fieldset${locked?' disabled':''}><legend>Collections</legend>${collections}<label>New collection name <input data-favorite-field="new" maxlength="80" value="${e(newName)}"></label>${button('add','Add collection')}</fieldset><fieldset${locked?' disabled':''}><legend>Favorite pages</legend>${choices}</fieldset>`+(locked?'':button('review','Review Favorites')+button('discard','Discard changes'));
 }
 function render(){
  if(items?.opened())return items.render();
  if(!opened)return button('open','Favorites');
  let content='';
  if(busy)content='<p role="status">Checking Favorites…</p>';
  else if(review)content='<ul>'+favoritePageChanges(view.layout,review.layout).map(text=>'<li>'+e(text)+'</li>').join('')+'</ul>'+button('approve','Approve and save Favorites')+button('back','Back to editing');
  else if(draft)content=editor();
  else if(view&&!locked)content=groups(view.layout)+itemLists()+button('manage','Manage favorites')+(pages.includes(activePage)&&!view.layout.pages.some(v=>v.page===activePage)?button('current','Favorite this page'):'');
  const heading=review?'Review Favorites':draft?'Manage favorites':'Favorites';
  return `<section class="panel" aria-labelledby="private-favorites-title"><h2 id="private-favorites-title" tabindex="-1">${heading}</h2>${notice?'<p role="status">'+e(notice)+'</p>':''}${error?'<p role="alert">'+e(error)+'</p>':''}${content}${locked?button('refresh','Fetch latest Favorites'):''}${busy?'':button('close','Close favorites')}</section>`;
 }
 return{click,input,render,reset,blocked:()=>Boolean(opened||items?.opened()),editing:()=>Boolean(draft||items?.editing())};
}

// Widgets with the same area share one temporary title inventory.
export function createFavoriteWidgetSource({client,pages,clock=Date.now,onChange,isOnline,canOpen,openers}){
 const views=new Map();
 let selecting=null;
 const fresh=expiry=>Number.isFinite(expiry)&&expiry>clock()&&expiry<=clock()+300000;
 function retire(filter){
  const view=views.get(filter);
  if(selecting?.view===view)selecting=null;
  clearTimeout(view?.timer);views.delete(filter);
 }
 function reset(){for(const filter of views.keys())retire(filter);}
 async function fetchView(filter){
  retire(filter);
  const view={state:'loading',data:null};views.set(filter,view);onChange();
  try{
   const data=await client.favoriteWidget(filter);
   if(views.get(filter)!==view||!isOnline())return;
   if(!data||Object.keys(data).sort().join(',')!=='expiresAt,filter,incomplete,itemCount,items,pages,readOnly'||typeof data.incomplete!=='boolean'||data.filter!==filter||data.readOnly!==true||!fresh(data.expiresAt)
    ||!Array.isArray(data.pages)||new Set(data.pages).size!==data.pages.length||data.pages.some(page=>!pages.includes(page))
    ||!Number.isInteger(data.itemCount)||data.itemCount<0||data.itemCount>500||!Array.isArray(data.items)||data.items.length!==Math.min(10,data.itemCount)
    ||data.items.some(row=>!row||Object.keys(row).sort().join(',')!=='choice,title,type'||!token(row.choice)||!Object.hasOwn(openers,row.type)||typeof row.title!=='string'||!row.title.trim()||row.title.length>200)
    ||new Set(data.items.map(row=>row.choice)).size!==data.items.length)throw Error();
   view.state='ready';view.data=data;
   view.timer=setTimeout(()=>{if(views.get(filter)===view){view.data=null;view.state='expired';onChange();}},Math.max(1,data.expiresAt-clock()));view.timer.unref?.();
  }catch{if(views.get(filter)===view)view.state='unavailable';}
  finally{if(views.get(filter)===view)onChange();}
 }
 function show(filters){
  const visible=new Set(filters);
  for(const filter of views.keys())if(!visible.has(filter))retire(filter);
  if(isOnline())for(const filter of visible)if(!views.has(filter))void fetchView(filter);
 }
 function refresh(filter){if(views.has(filter)&&isOnline())return fetchView(filter);}
 async function open(filter,choice){
  const view=views.get(filter),data=view?.data,row=data?.items.find(item=>item.choice===choice);
  if(!row||!fresh(data.expiresAt)||!canOpen()||selecting)return;
  const pending={view};selecting=pending;onChange();
  try{
   const result=await client.favoriteWidgetSelect({filter,choice});
   if(selecting!==pending||view.data!==data||!fresh(data.expiresAt)||!isOnline())return;
   if(!result||Object.keys(result).sort().join(',')!=='expiresAt,readOnly,row,type'||result.readOnly!==true||result.type!==row.type||!fresh(result.expiresAt)||result.expiresAt>data.expiresAt
    ||!validFavoriteOriginal(row.type,result.row)||result.row.title!==row.title)throw Error();
   selecting=null;
   if(canOpen())openers[row.type](result.row[favoriteTokenFields[row.type]],result.row,result.expiresAt);
  }catch{
   if(selecting===pending){view.data=null;view.state='unavailable';clearTimeout(view.timer);}
  }finally{if(selecting===pending)selecting=null;if(views.get(filter)===view)onChange();}
 }
 function render(widget){
  const filter=widget.filter,view=views.get(filter),data=view?.data;
  if(!isOnline())return '<p role="status">Offline. Reconnect to view Favorites.</p>';
  if(view?.state==='loading')return '<p role="status">Loading Favorites…</p>';
  const retry='<button class="btn" type="button" data-favorite-widget-refresh="'+e(filter)+'">Fetch latest Favorites</button>';
  if(!data||!fresh(data.expiresAt))return '<p role="status">'+(view?.state==='expired'||data?'Favorites expired.':'Favorites are unavailable.')+'</p>'+retry;
  const limit=widget.limit??6;
  // Reserve space for both kinds when pages and originals share a widget.
  const pageCount=Math.min(data.pages.length,limit-Math.min(data.items.length,Math.ceil(limit/2)));
  const shownItems=data.items.slice(0,limit-pageCount),entries=[];
  for(const key of data.pages.slice(0,pageCount)){
   const [label,path]=FAVORITE_PAGES[key];entries.push('<li><a href="'+path+'">'+e(label)+'</a></li>');
  }
  for(const item of shownItems){
   entries.push('<li><button type="button" class="btn" data-favorite-widget-choice="'+item.choice+'" data-area="'+e(filter)+'"'+(selecting?' disabled':'')+'>'+e(item.title)+'</button> <small>'+e(item.type)+'</small></li>');
  }
  const count=data.pages.length+data.itemCount;
  const list=entries.length?'<ul>'+entries.join('')+'</ul>':data.incomplete?'':'<p>No favorites in this view.</p>';
  const more=entries.length<count?'<p>Showing '+entries.length+' of '+count+(data.incomplete?' available favorites.':' favorites.')+'</p>':'';
  return list+more+(data.incomplete?'<p role="status">Some favorite items could not be loaded.</p>'+retry:'')+button('open','Open Favorites');
 }
 return {reset,show,refresh,open,blocked:()=>Boolean(selecting),changed(){const filters=[...views.keys()];reset();show(filters);},render};
}
