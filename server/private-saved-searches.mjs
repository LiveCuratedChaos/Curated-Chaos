// Prepared storage component only; no routes, startup flag or automatic history collection.
import {randomBytes,randomUUID} from 'node:crypto';
import {privateSearchFields} from './private-workspace-search.mjs';
import {stableStringify} from './stable-json.mjs';
export const SAVED_SEARCH_SOURCE='PRIVATE_SAVED_SEARCH_V1';
export const SAVED_SEARCH_ORIGIN='PRIVATE_COOKIE_SAVED_SEARCH';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const equal=(a,b)=>stableStringify(a)===stableStringify(b);
const token=()=>randomBytes(32).toString('base64url');
const retention=90*86400000;
function stamp(v){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('Invalid saved-search timestamp.');return Date.parse(v);}
function sameStamp(a,b){return a===null?b===null:b!==null&&stamp(a)===stamp(b);}
export function savedSearchName(name){if(typeof name!=='string'||!name.trim()||name.trim().length>80||/[\u0000-\u001f\u007f]/.test(name))throw Error('Enter a search name up to 80 characters.');return name.trim();}
export function savedSearchFilters(values){
 if(!plain(values)||Object.hasOwn(values,'offset'))throw Error('Only reusable search filters may be saved.');
 const fields=privateSearchFields(values,{allowPriority:true,allowDateRange:true,allowUndated:true});
 if(/[\u0000-\u001f\u007f]/.test(fields.query))throw Error('Enter a supported title search.');
 return fields;
}
export function privateSavedSearchState(row,ownerId){
 if(!uuid(ownerId)||!uuid(row?.id)||row.owner_id!==ownerId||row.household_id!==null||row.visibility!=='private'||row.section!=='Personal Life'||row.item_type!=='saved_search'||row.origin!==SAVED_SEARCH_ORIGIN||!Number.isInteger(row.version)||row.version<1||!plain(row.payload)||row.payload.fictional!==true||row.payload.source!==SAVED_SEARCH_SOURCE||row.payload.schemaVersion!==1||savedSearchName(row.payload.title)!==row.payload.title||!equal(savedSearchFilters(row.payload.filters),row.payload.filters))throw Error('Exact private saved-search scope required.');
 stamp(row.created_at);if(row.deleted_at!==null)stamp(row.deleted_at);
 return structuredClone(row);
}
function sameSelection(a,b){return same({...a,payload:{title:a.payload.title,filters:a.payload.filters}},{...b,payload:{title:b.payload.title,filters:b.payload.filters}});}
function same(a,b){return a.id===b.id&&a.owner_id===b.owner_id&&a.version===b.version&&sameStamp(a.deleted_at,b.deleted_at)&&stamp(a.created_at)===stamp(b.created_at)&&equal(a.payload,b.payload);}
export function createPrivateSavedSearches({api,now=Date.now,idFactory=randomUUID}){
 if(typeof now!=='function'||typeof idFactory!=='function'||['getPrivateSavedSearch','listPrivateSavedSearches','addPrivateSavedSearch','updatePrivateSavedSearch','setPrivateSavedSearchDeletedAt'].some(k=>typeof api?.[k]!=='function'))throw Error('Explicit saved-search API required.');
 const contexts=new Map();let disposed=false;
 function clear(id){clearTimeout(contexts.get(id)?.timer);contexts.delete(id);}
 function alive(s){return !disposed&&contexts.get(s.contextId)===s&&s.expiresAt>now();}
 function begin(contextId,ownerId,expiresAt){if(disposed||typeof contextId!=='string'||!contextId||!uuid(ownerId)||!Number.isFinite(expiresAt)||expiresAt<=now())throw Error('Saved-search context unavailable.');clear(contextId);const s={contextId,ownerId,expiresAt:Math.min(expiresAt,now()+300000),actions:new Map(),review:null,viewId:token()};contexts.set(contextId,s);s.timer=setTimeout(()=>clear(contextId),Math.max(1,s.expiresAt-now()));s.timer.unref?.();return s;}
 function eligible(row){if(row.deleted_at!==null&&(stamp(row.deleted_at)>now()||stamp(row.deleted_at)<now()-retention))throw Error('The 90-day recovery period has ended.');}
 function selected(contextId,actor,key){const s=contexts.get(contextId),row=s?.actions.get(key);if(!s||!alive(s)||s.ownerId!==actor.ownerId||!row)throw Error('Fetch saved searches again.');return{s,row};}
 async function get(actor,id){const rows=await api.getPrivateSavedSearch(actor.accessToken,id,actor.ownerId);if(!Array.isArray(rows)||rows.length!==1)throw Error('Saved search unavailable.');const row=privateSavedSearchState(rows[0],actor.ownerId);if(row.id!==id)throw Error('Saved search identity changed.');return row;}
 function offer(contextId,ownerId,values,expiresAt){const filters=savedSearchFilters(values),s=begin(contextId,ownerId,expiresAt);s.offer={key:token(),filters};return{saveSearchToken:s.offer.key,saveSearchExpiresAt:s.expiresAt};}
 async function list(contextId,actor,expiresAt,{removed=false,offset=0}={}){
  if(typeof removed!=='boolean'||!Number.isInteger(offset)||offset<0||offset>1950||offset%50)throw Error('Choose a valid saved-search page.');
  const s=begin(contextId,actor.ownerId,expiresAt),rows=await api.listPrivateSavedSearches(actor.accessToken,actor.ownerId,removed);
  if(!alive(s)||!Array.isArray(rows)||rows.length>2000||new Set(rows.map(r=>r?.id)).size!==rows.length)throw Error('Saved-search list unverified.');
  const checked=rows.map(r=>privateSavedSearchState(r,actor.ownerId));if(checked.some(r=>(r.deleted_at!==null)!==removed))throw Error('Saved-search list scope changed.');
  const items=checked.filter(r=>!removed||stamp(r.deleted_at)<=now()&&stamp(r.deleted_at)>=now()-retention).sort((a,b)=>a.payload.title.localeCompare(b.payload.title)||a.id.localeCompare(b.id));
  return{viewId:s.viewId,removed,offset,limit:50,matchCount:items.length,retentionDays:90,expiresAt:s.expiresAt,records:items.slice(offset,offset+50).map(row=>{const key=token();s.actions.set(key,row);return{name:row.payload.title,filters:structuredClone(row.payload.filters),...(removed?{deletedAt:new Date(stamp(row.deleted_at)).toISOString()}:{}),savedSearchToken:key};})};
 }
 async function load(contextId,actor,key){const{s,row}=selected(contextId,actor,key);if(row.deleted_at!==null)throw Error('Restore this saved search before running it.');const current=await get(actor,row.id);if(!alive(s)||!sameSelection(current,row)||current.deleted_at!==null)throw Error('Saved search changed. Fetch again.');return{name:current.payload.title,filters:structuredClone(current.payload.filters)};}
 async function prepare(contextId,actor,values){
  const s=contexts.get(contextId);if(!s||!alive(s)||s.ownerId!==actor.ownerId||!plain(values)||!['create','rename','remove','restore'].includes(values.action))throw Error('Saved-search review unavailable.');
  const creating=values.action==='create',naming=creating||values.action==='rename',allowed=['action',creating?'saveSearchToken':'savedSearchToken',...(naming?['name']:[])];
  if(Object.keys(values).some(k=>!allowed.includes(k))||Object.keys(values).length!==allowed.length)throw Error('Exact saved-search review fields required.');
  const name=naming?savedSearchName(values.name):null,marker={};s.review=marker;let record,payload;
  if(creating){if(!s.offer||values.saveSearchToken!==s.offer.key)throw Error('Search offer ended.');const id=idFactory();if(!uuid(id))throw Error('New saved-search identity required.');record={id,owner_id:actor.ownerId,household_id:null,visibility:'private',section:'Personal Life',item_type:'saved_search',origin:SAVED_SEARCH_ORIGIN,payload:{fictional:true,source:SAVED_SEARCH_SOURCE,schemaVersion:1,title:name,filters:structuredClone(s.offer.filters)}};payload=record.payload;}
  else{const selection=selected(contextId,actor,values.savedSearchToken);record=await get(actor,selection.row.id);if(!alive(s)||s.review!==marker||!sameSelection(record,selection.row))throw Error('Saved search changed. Fetch again.');eligible(record);if((values.action==='restore')!==(record.deleted_at!==null))throw Error('Saved-search action no longer available.');payload={...record.payload,...(naming?{title:name}:{})};if(values.action==='rename'&&name===record.payload.title){s.review=null;return{noChanges:true};}}
  const review={action:values.action,record,payload,reviewId:token(),claimed:false,started:false};s.review=review;
  return{reviewId:review.reviewId,action:review.action,name:payload.title,filters:structuredClone(payload.filters),expiresAt:s.expiresAt};
 }
 function claim(contextId,ownerId,reviewId){const s=contexts.get(contextId),r=s?.review;if(!s||!alive(s)||s.ownerId!==ownerId||!r||r.reviewId!==reviewId||r.claimed)throw Error('Saved-search review ended.');if(r.action!=='create')eligible(r.record);r.claimed=true;return{state:s,review:r};}
 async function authorize({state:s,review:r},actor){r.authorized=false;if(!alive(s)||s.review!==r||!r.claimed||r.started||actor.ownerId!==s.ownerId)return false;
  if(r.action==='create'){const rows=await api.getPrivateSavedSearch(actor.accessToken,r.record.id,actor.ownerId);r.authorized=Array.isArray(rows)&&rows.length===0;}
  else{eligible(r.record);r.authorized=same(await get(actor,r.record.id),r.record);}
  r.authorized=Boolean(r.authorized&&alive(s)&&s.review===r);return r.authorized;
 }
 async function save({state:s,review:r},actor){
  if(!alive(s)||s.review!==r||!r.claimed||!r.authorized||r.started||actor.ownerId!==s.ownerId)throw Error('Saved-search review ended.');if(r.action!=='create')eligible(r.record);r.started=true;r.authorized=false;
  let rows,deletedAt=r.record.deleted_at??null;
  if(r.action==='create')rows=await api.addPrivateSavedSearch(actor.accessToken,structuredClone(r.record));
  else if(r.action==='rename')rows=await api.updatePrivateSavedSearch(actor.accessToken,r.record,actor.ownerId,structuredClone(r.payload));
  else{deletedAt=r.action==='remove'?new Date(now()).toISOString():null;rows=await api.setPrivateSavedSearchDeletedAt(actor.accessToken,r.record,actor.ownerId,deletedAt);}
  if(!Array.isArray(rows)||rows.length!==1)throw Error('Saved-search acknowledgement unverified.');const ack=privateSavedSearchState(rows[0],actor.ownerId);
  if(ack.id!==r.record.id||!equal(ack.payload,r.payload)||!sameStamp(ack.deleted_at,deletedAt)||(r.action==='create'?ack.version!==1:ack.version!==r.record.version+1||stamp(ack.created_at)!==stamp(r.record.created_at)))throw Error('Saved-search acknowledgement unverified.');
  const latest=await get(actor,r.record.id);if(!alive(s)||s.review!==r||!same(ack,latest))throw Error('Saved-search reread unverified.');clear(s.contextId);return{saved:true,action:r.action};
 }
 return{offer,list,load,prepare,claim,authorize,save,clear,currentView(id,viewId){const s=contexts.get(id);return Boolean(s&&alive(s)&&s.viewId===viewId);},hasAction(id,key){const s=contexts.get(id);return Boolean(s&&alive(s)&&s.actions.has(key));},offerCurrent(id,key){const s=contexts.get(id);return Boolean(s&&alive(s)&&s.offer?.key===key);},current(id,reviewId){const s=contexts.get(id);return Boolean(s&&alive(s)&&typeof reviewId==='string'&&s.review&&s.review.reviewId===reviewId&&!s.review.claimed);},dispose(){disposed=true;for(const id of contexts.keys())clear(id);}};
}
