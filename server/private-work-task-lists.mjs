import {createHmac,randomBytes} from 'node:crypto';
import {privateSavedSearchState} from './private-saved-searches.mjs';
import {stableStringify} from './stable-json.mjs';

const lifetime=300_000;
const validChoice=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);

export function createWorkTaskLists({api,now=Date.now}){
 const secret=randomBytes(32);
 async function inventory(contextId,actor,expiresAt){
  if(!Number.isSafeInteger(expiresAt)||expiresAt<=now()||expiresAt>now()+lifetime)throw Error('Refresh the Work task lists.');
  const rows=await api.listPrivateSavedSearches(actor.accessToken,actor.ownerId,false);
  if(!Array.isArray(rows)||rows.length>2000||new Set(rows.map(row=>row?.id)).size!==rows.length)throw Error('Work list inventory unavailable.');
  const entries=[];
  for(const candidate of rows){
   const row=privateSavedSearchState(candidate,actor.ownerId);
   if(row.deleted_at!==null)throw Error('Work list inventory changed.');
   const {title,filters}=row.payload;
   if(filters.type!=='task'||filters.section!=='Work')continue;
   const choice=createHmac('sha256',secret).update(stableStringify([contextId,actor.ownerId,expiresAt,row.id,row.version,row.created_at,title,filters])).digest('base64url');
   entries.push({name:title,filters,choice,id:row.id});
  }
  if(expiresAt<=now())throw Error('Refresh the Work task lists.');
  return entries.sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 }
 async function list(contextId,actor,sessionEnd,{offset=0,expiresAt=Math.min(now()+lifetime,sessionEnd)}){
  if(!Number.isInteger(offset)||offset<0||offset>1950||offset%50||expiresAt>sessionEnd)throw Error('Choose a current list page.');
  const entries=await inventory(contextId,actor,expiresAt);
  if(offset&&offset>=entries.length)throw Error('Refresh the Work task lists.');
  return{offset,matchCount:entries.length,expiresAt,lists:entries.slice(offset,offset+50).map(({name,choice})=>({name,choice}))};
 }
 async function selected(contextId,actor,sessionEnd,{choices,expiresAt}){
  if(!Array.isArray(choices)||!choices.length||choices.length>32||!choices.every(validChoice)||new Set(choices).size!==choices.length||expiresAt>sessionEnd)throw Error('Choose current Work task lists.');
  const options=new Map((await inventory(contextId,actor,expiresAt)).map(entry=>[entry.choice,entry.filters]));
  return choices.map(choice=>{if(!options.has(choice))throw Error('A selected list changed. Refresh the Work task lists.');return options.get(choice);});
 }
 return{list,selected};
}
