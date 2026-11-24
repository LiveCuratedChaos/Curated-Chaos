// Pages have fixed internal destinations. An owner-supplied collection name never becomes a URL.
export const FAVORITE_PAGES=Object.freeze({
 brief:['Daily Brief','/dev-dashboard.html','Planning'],curation:['The Curation','/dev-curation.html','Planning'],
 calendar:['Calendar','/dev-calendar.html','Planning'],tasks:['Tasks','/dev-tasks.html','Planning'],notes:['Notes','/dev-notes.html','Planning'],
 work:['Work','/dev-work.html','Life areas'],personal:['Personal Life','/dev-personal.html','Life areas'],
 home:['Home & Household','/dev-home.html','Life areas'],school:['School','/dev-school.html','Life areas'],finances:['Finances','/dev-finances.html','Life areas']
});
export function enabledFavoritePages({allowWidgetLayouts,allowWidgetPages,allowCalendarWorkspace,allowTaskWorkspace,allowNotesWorkspace}){
 return Object.keys(FAVORITE_PAGES).filter(page=>({
  brief:true,curation:Boolean(allowWidgetLayouts),calendar:Boolean(allowCalendarWorkspace),tasks:Boolean(allowTaskWorkspace),notes:Boolean(allowNotesWorkspace)
 }[page]??(allowWidgetLayouts&&allowWidgetPages)));
}
export const defaultFavorites=()=>({version:1,collections:[],pages:[]});
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const fold=value=>value.normalize('NFKC').toLocaleLowerCase('en-US');
export function validateFavoritePages(value){
 if(!exact(value,['version','collections','pages'])||value.version!==1||!Array.isArray(value.collections)||value.collections.length>100||!Array.isArray(value.pages)||value.pages.length>Object.keys(FAVORITE_PAGES).length)throw Error('Choose a supported Favorites list.');
 const ids=new Set(),names=new Set(),pages=new Set();
 for(const c of value.collections){
  if(!exact(c,['id','name'])||!uuid(c.id)||ids.has(c.id)||typeof c.name!=='string'||c.name!==c.name.trim()||!c.name||c.name.length>80||/[\u0000-\u001f\u007f]/.test(c.name)||names.has(fold(c.name)))throw Error('Give each collection a distinct name of up to 80 characters.');
  ids.add(c.id);names.add(fold(c.name));
 }
 for(const p of value.pages){
  if(!exact(p,['page','collections'])||typeof p.page!=='string'||!Object.hasOwn(FAVORITE_PAGES,p.page)||pages.has(p.page)||!Array.isArray(p.collections)||new Set(p.collections).size!==p.collections.length||!p.collections.every(id=>ids.has(id)))throw Error('Choose available favorite pages and collections.');
  pages.add(p.page);
 }
 return structuredClone(value);
}
export function favoritePageChanges(before,after){
 const changes=[];
 for(const c of after.collections){
  const old=before.collections.find(v=>v.id===c.id);
  if(!old)changes.push('Create collection “'+c.name+'”');
  else if(old.name!==c.name)changes.push('Rename “'+old.name+'” to “'+c.name+'”');
 }
 for(const c of before.collections)if(!after.collections.some(v=>v.id===c.id))changes.push('Remove collection “'+c.name+'”');
 for(const key of Object.keys(FAVORITE_PAGES)){
  const title=FAVORITE_PAGES[key][0],was=before.pages.find(v=>v.page===key),now=after.pages.find(v=>v.page===key);
  if(!now&&was)changes.push('Remove '+title+' from Favorites');
  if(!now)continue;
  if(!was)changes.push('Favorite '+title);
  for(const c of after.collections){
   const had=was?.collections.includes(c.id)??false,has=now.collections.includes(c.id);
   if(has!==had)changes.push((has?'Add '+title+' to “':'Remove '+title+' from “')+c.name+'”');
  }
 }
 return changes;
}
