import {defaultFavorites,validateFavoritePages} from '../src/private-favorites.mjs';

const uuid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===expected;
export const emptyFavoriteItems=()=>({version:1,items:[]});
export function validateFavoriteItems(value){
 if(!keys(value,'items,version')||value.version!==1||!Array.isArray(value.items)||value.items.length>500)throw Error('Unsupported favorite items.');
 const seen=new Set();
 for(const item of value.items){
  if(!keys(item,'collections,id,type')||!['note','task','project','event'].includes(item.type)||!uuid(item.id)||seen.has(item.id)||!Array.isArray(item.collections)||item.collections.length>100||item.collections.some(id=>!uuid(id))||new Set(item.collections).size!==item.collections.length)throw Error('Unsupported favorite item reference.');
  seen.add(item.id);
 }
 return structuredClone(value);
}
export function favoriteCollections(payload){return validateFavoritePages(payload?.favorites??defaultFavorites()).collections;}
export function validateFavoriteMemberships(layout,collections){
 const ids=new Set(collections.map(c=>c.id));
 if(layout.items.some(item=>item.collections.some(id=>!ids.has(id))))throw Error('A favorite collection changed.');
}
export function afterCollectionChange(layout,current){
 const existing=current.record?.payload.favoriteItems;if(!existing)return {};
 const references=validateFavoriteItems(existing),previous=favoriteCollections(current.record.payload);
 validateFavoriteMemberships(references,previous);
 const ids=new Set(layout.collections.map(c=>c.id));
 for(const item of references.items)item.collections=item.collections.filter(id=>ids.has(id));
 return {favoriteItems:references};
}
