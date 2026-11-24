import {emptyFavoriteItems,validateFavoriteItems,favoriteCollections,validateFavoriteMemberships,afterCollectionChange} from './private-favorite-items.mjs';
import {FAVORITE_PAGES,defaultFavorites,validateFavoritePages} from '../src/private-favorites.mjs';
import {defaultOnboarding,validateOnboarding} from '../src/private-onboarding.mjs';
// Fixed private presentation policies. No record edits, provider access or retries.
import {randomBytes} from 'node:crypto';
import {createPrivatePreferencesReview} from './private-preferences-review.mjs';
import {makeBriefPreferencesRecord} from '../src/dev-preferences-model.mjs';
import {defaultBriefLayout,validateBriefLayout} from '../src/private-brief-layout.mjs';
import {defaultCalendarPresentation,validateCalendarPresentation} from '../src/private-calendar-presentation.mjs';
import {defaultQuickAddLayout,validateQuickAddLayout} from '../src/private-quick-add-layout.mjs';
import {stableStringify} from './stable-json.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const random=()=>randomBytes(32).toString('base64url'),same=(a,b)=>stableStringify(a)===stableStringify(b);
// REST timestamps are strings. Keep PostgreSQL's last three fractional digits;
// Date milliseconds alone cannot verify unchanged creation/update metadata.
function time(value){
 if(typeof value!=='string')return null;
 const match=value.match(/^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,6}))?(Z|[+-](\d\d):(\d\d))$/);
 if(!match||Number(match[2])>23||Number(match[3])>59||Number(match[4])>59||match[6]!=='Z'&&(Number(match[7])>23||Number(match[8])>59))return null;
 const day=Date.parse(match[1]+'T00:00:00Z'),milliseconds=Date.parse(value);
 if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==match[1]||!Number.isFinite(milliseconds))return null;
 return(BigInt(milliseconds)*1000n+BigInt((match[5]??'').padEnd(6,'0').slice(3))).toString();
}
function creation(record){return{id:record.id,owner_id:record.owner_id,household_id:record.household_id,visibility:record.visibility,section:record.section,item_type:record.item_type,origin:record.origin,created_at:time(record.created_at)};}
// Policy selection stays inside this module; callers cannot choose arbitrary
// payload keys or replace validation/default behavior through factory options.
const briefPolicy=Object.freeze({extension:'briefLayout',validate:validateBriefLayout,defaultValue:defaultBriefLayout,label:'Brief layout'});
const calendarPolicy=Object.freeze({extension:'calendarPresentation',validate:validateCalendarPresentation,defaultValue:defaultCalendarPresentation,label:'Calendar presentation'});
const onboardingPolicy=Object.freeze({extension:'onboarding',validate:validateOnboarding,defaultValue:defaultOnboarding,label:'Personal setup'});
export function createPrivateOnboarding(options){
 const preferencesPatch=layout=>{
  if(!layout.palette)return {};
  if(!options.allowAppearanceSave)throw Error('Reviewed appearance scope required for a setup palette.');
  return layout.status==='complete'?{palette:layout.palette}:{};
 };
 return createPrivatePresentation(options,{...onboardingPolicy,preferencesPatch});
}
export function createPrivateFavorites(options){
 const available=options.pages??Object.keys(FAVORITE_PAGES);
 function validateChange(before,after){
  if(after.pages.some(row=>!available.includes(row.page)&&!before.pages.some(old=>old.page===row.page)))throw Error('Choose an available page.');
 }
 function widgetSnapshot(current){
  const references=validateFavoriteItems(current.record?.payload.favoriteItems??emptyFavoriteItems());
  validateFavoriteMemberships(references,current.layout.collections);
  return {pages:current.layout.pages.map(row=>row.page).filter(page=>available.includes(page)),items:references.items};
 }
 return createPrivatePresentation(options,{extension:'favorites',validate:validateFavoritePages,validateChange,widgetSnapshot,preferencesPatch:afterCollectionChange,defaultValue:defaultFavorites,label:'Favorites'});
}
export function createPrivateFavoriteItemStore(options){
 const details=current=>({collections:favoriteCollections(current.record?.payload)});
 return createPrivatePresentation(options,{extension:'favoriteItems',label:'Favorite items',defaultValue:emptyFavoriteItems,validate:validateFavoriteItems,details,
  validateChange:(_before,after,current)=>validateFavoriteMemberships(after,details(current).collections)});
}
const quickAddPolicy=Object.freeze({extension:'quickAddLayout',validate:validateQuickAddLayout,defaultValue:defaultQuickAddLayout,label:'Quick Add settings'});
export function createPrivateQuickAddLayout(options){return createPrivatePresentation(options,quickAddPolicy);}
export function createPrivateBriefLayout(options){return createPrivatePresentation(options,briefPolicy);}
export function createPrivateCalendarPresentation(options){return createPrivatePresentation(options,calendarPolicy);}
function createPrivatePresentation({api,now=Date.now}={},policy){
 if(typeof now!=='function'||['listBriefPreferences','addBriefPreferences','updateBriefPreferences'].some(key=>typeof api?.[key]!=='function'))throw Error(`Explicit private ${policy.label} API required.`);
 const preferences=createPrivatePreferencesReview(),contexts=new Map();let disposed=false;
 function clear(id){clearTimeout(contexts.get(id)?.timer);contexts.delete(id);}
 const alive=state=>!disposed&&contexts.get(state.id)===state&&state.expiresAt>now();
 function state(id,actor){const current=contexts.get(id);if(!current||!alive(current)||current.owner!==actor?.ownerId)throw Error(`Fetch ${policy.label} again.`);return current;}
 function checked(rows,owner){
  if(!uuid(owner)||!Array.isArray(rows)||rows.length>1||rows.some(row=>!row||!uuid(row.id)||row.owner_id!==owner||row.household_id!==null||row.visibility!=='private'||row.section!=='Personal Life'||row.item_type!=='brief_preferences'||row.origin!=='M1F_QA_SETTINGS'||row.deleted_at!==null||!Number.isInteger(row.version)||row.version<1||time(row.created_at)===null||time(row.updated_at)===null||!row.payload||typeof row.payload!=='object'||Array.isArray(row.payload)||row.payload.fictional!==true||row.payload.source!=='M1F_QA_SETTINGS'))throw Error('Supported private Brief preferences required.');
  // Canonicalize only the HMAC input, preserving the original record for writes
  // and metadata checks. Equivalent time zones must not manufacture conflicts.
  const current={...preferences.read(rows.map(row=>({...row,created_at:time(row.created_at),updated_at:time(row.updated_at)})),owner),record:rows.length?structuredClone(rows[0]):null},layout=current.record&&Object.hasOwn(current.record.payload,policy.extension)?policy.validate(current.record.payload[policy.extension]):policy.defaultValue();
  return{...current,layout};
 }
 const latest=async actor=>checked(await api.listBriefPreferences(actor.accessToken,actor.ownerId),actor.ownerId);
 async function read(id,actor,expiresAt){
  if(disposed||typeof id!=='string'||!id||!uuid(actor?.ownerId)||!Number.isFinite(expiresAt)||expiresAt<=now())throw Error(`Active ${policy.label} context required.`);
  clear(id);const current={id,owner:actor.ownerId,expiresAt:Math.min(expiresAt,now()+300000),viewId:random(),generation:0,review:null};contexts.set(id,current);current.timer=setTimeout(()=>{if(contexts.get(id)===current)clear(id);},Math.max(1,current.expiresAt-now()));current.timer.unref?.();
  const value=await latest(actor);if(!alive(current))throw Error(`${policy.label} view ended.`);current.baseTag=value.baseTag;
  return{...policy.details?.(value),layout:structuredClone(value.layout),baseTag:value.baseTag,viewId:current.viewId,expiresAt:current.expiresAt,readOnly:false};
 }
 async function prepare(id,actor,values){
  const current=state(id,actor);current.review=null;const generation=++current.generation;
  if(!values||Array.isArray(values)||Object.keys(values).sort().join(',')!=='baseTag,layout'||typeof values.baseTag!=='string'||values.baseTag!==current.baseTag)throw Error(`Fetch the latest ${policy.label} before reviewing.`);
  const layout=policy.validate(values.layout),value=await latest(actor);
  if(!alive(current)||current.generation!==generation||value.baseTag!==values.baseTag)throw Error('Brief preferences changed. Fetch latest.');
  policy.validateChange?.(value.layout,layout,value);
  const patch=policy.preferencesPatch?.(layout,value)??{};
  if(same(layout,value.layout)&&Object.entries(patch).every(([k,v])=>same(value.record?.payload?.[k]??null,v)))return{noChanges:true};
  const payload={...(value.record?structuredClone(value.record.payload):makeBriefPreferencesRecord({},actor.ownerId).payload),...patch,[policy.extension]:layout};
  current.review={id:random(),s:current,owner:actor.ownerId,baseTag:value.baseTag,record:value.record?structuredClone(value.record):null,payload,layout:structuredClone(layout),claimed:false,started:false,authorized:false,authorizing:null};
  return{layout:structuredClone(layout),reviewId:current.review.id,expiresAt:current.expiresAt};
 }
 function claim(id,owner,reviewId){const current=state(id,{ownerId:owner}),review=current.review;if(!review||review.id!==reviewId||review.claimed)throw Error(`${policy.label} review ended.`);current.review=null;review.claimed=true;review.generation=++current.generation;return review;}
 const active=(review,actor)=>Boolean(review?.claimed&&!review.started&&alive(review.s)&&review.owner===actor?.ownerId&&review.s.generation===review.generation);
 async function authorize(review,actor){
  if(!review)return false;review.authorized=false;const marker={};review.authorizing=marker;
  try{if(!active(review,actor))return false;const value=await latest(actor);if(review.authorizing!==marker||!active(review,actor)||value.baseTag!==review.baseTag)return false;review.authorized=true;return true;}
  finally{if(review.authorizing===marker)review.authorizing=null;}
 }
 async function save(review,actor){
  if(!active(review,actor)||!review.authorized||review.authorizing)throw Error(`${policy.label} review ended.`);review.started=true;review.authorized=false;
  const rows=await(review.record?api.updateBriefPreferences(actor.accessToken,review.record,actor.ownerId,structuredClone(review.payload)):api.addBriefPreferences(actor.accessToken,{...makeBriefPreferencesRecord({},actor.ownerId),payload:structuredClone(review.payload)}));
  if(!alive(review.s)||review.s.generation!==review.generation)throw Error(`${policy.label} save could not be confirmed. Fetch latest before trying again.`);
  const acknowledged=checked(rows,actor.ownerId);if(!acknowledged.record||acknowledged.record.version!==(review.record?review.record.version+1:1)||!same(acknowledged.record.payload,review.payload)||review.record&&!same(creation(acknowledged.record),creation(review.record)))throw Error(`${policy.label} acknowledgement differs from review.`);
  preferences.confirmed(rows,actor.ownerId,review);
  const value=await latest(actor);
  if(!alive(review.s)||review.s.generation!==review.generation||!value.record||value.record.version!==acknowledged.record.version||!same(creation(value.record),creation(acknowledged.record))||time(value.record.updated_at)!==time(acknowledged.record.updated_at)||!same(value.record.payload,review.payload))throw Error(`${policy.label} changed during save verification. Fetch latest.`);
  clear(review.s.id);return{saved:true,layout:structuredClone(value.layout)};
 }
 return{read,prepare,claim,authorize,save,clear,...(policy.widgetSnapshot?{widgetSnapshotFor:async actor=>policy.widgetSnapshot(await latest(actor))}:{}),...(policy.details?{snapshotFor:async actor=>{const current=await latest(actor);return {...policy.details(current),layout:current.layout};}}:{}),valueFor:async actor=>structuredClone((await latest(actor)).layout),current:(id,reviewId)=>Boolean(contexts.get(id)&&alive(contexts.get(id))&&!contexts.get(id).review?.claimed&&contexts.get(id).review?.id===reviewId),currentView:(id,viewId)=>Boolean(contexts.get(id)&&alive(contexts.get(id))&&contexts.get(id).viewId===viewId),dispose(){disposed=true;for(const id of contexts.keys())clear(id);preferences.dispose();}};
}
