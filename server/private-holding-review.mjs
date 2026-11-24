import {randomBytes} from 'node:crypto';
import {nextFinanceSlot} from './private-finance-identity.mjs';
import {holdingType,validateHoldingRow} from './private-holding-record.mjs';
import {holdingInputs,holdingActivity,holdingSummary} from '../src/private-holdings.mjs';
import {newYorkTaskDay} from '../src/private-smart-task.mjs';
import {stableStringify} from './stable-json.mjs';
const token=()=>randomBytes(32).toString('base64url');
const same=(a,b)=>stableStringify(a)===stableStringify(b);
const keys=(v,fields)=>v&&Object.keys(v).sort().join(',')===fields;
export function createHoldingReview({api,now=Date.now}){
 const views=new Map();
 function clear(id){clearTimeout(views.get(id)?.timer);views.delete(id);}
 const active=v=>views.get(v.id)===v&&v.expiresAt>now();
 function state(id,actor){
  const v=views.get(id);if(!v?.ready||!active(v)||v.owner!==actor.ownerId)throw Error('Open investments again.');return v;
 }
 async function list(id,actor,expiresAt){
  clear(id);const v={id,owner:actor.ownerId,expiresAt:Math.min(expiresAt,now()+300000),holdings:new Map()};
  views.set(id,v);v.timer=setTimeout(()=>{if(views.get(id)===v)clear(id);},Math.max(1,v.expiresAt-now()));v.timer.unref?.();
  const rows=await api.listHoldings(actor.accessToken,v.owner);
  if(!active(v)||!Array.isArray(rows)||rows.length>100||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Incomplete holdings list.');
  const holdings=rows.map(row=>{
   const holding=validateHoldingRow(row,v.owner),holdingToken=token();v.holdings.set(holdingToken,row);
   return {holdingToken,label:holding.label,version:row.version};
  }).sort((a,b)=>a.label.localeCompare(b.label));
  v.ready=true;return {holdings,expiresAt:v.expiresAt};
 }
 async function selected(v,actor,holdingToken){
  const old=v.holdings.get(holdingToken);
  if(!old)throw Error('Select a holding.');
  const rows=await api.getHolding(actor.accessToken,v.owner,old.id);
  if(!active(v)||!Array.isArray(rows)||rows.length!==1||!same(rows[0],old))throw Error('Holding changed.');
  return old;
 }
 async function read(id,actor,values){
  const v=state(id,actor);v.review=null;
  if(!keys(values,'holdingToken'))throw Error('Select a holding.');
  const row=await selected(v,actor,values.holdingToken),holding=validateHoldingRow(row,v.owner);
  return {holding,summary:holdingSummary(holding),version:row.version,expiresAt:v.expiresAt};
 }
 async function prepare(id,actor,values){
  const v=state(id,actor);v.review=null;
  const prior=Object.hasOwn(values,'holdingToken')?await selected(v,actor,values.holdingToken):null;
  const previous=prior?.payload.holding;
  let holding;
  if(keys(values,'settings')||keys(values,'holdingToken,settings')){
   if(!keys(values.settings,'annualDividendMinor,label,price'))throw Error('Review the holding settings.');
   holding=holdingInputs({...values.settings,activities:previous?.activities??[]});
  }else if(keys(values,'activity,holdingToken,index')&&previous){
   const activity=holdingActivity(values.activity),index=values.index;
   if(index!==null&&(!Number.isInteger(index)||index<0||index>=previous.activities.length))throw Error('Select a recorded activity.');
   if(activity.day>newYorkTaskDay(now()))throw Error('The activity date is in the future.');
   const activities=[...previous.activities];activities[index??activities.length]=activity;
   holding=holdingInputs({...previous,activities});
  }else throw Error('Review one holding or one activity.');
  if(holding.price?.day>newYorkTaskDay(now()))throw Error('The manual price date is in the future.');
  const summary=holdingSummary(holding);
  if(Buffer.byteLength(JSON.stringify(holding))>60000)throw Error('This holding exceeds its storage limit.');
  if(previous&&same(previous,holding))return {noChanges:true};
  if(!active(v))throw Error('Holding review expired.');
  const draft={id:prior?.id??nextFinanceSlot(v.owner,holdingType,[...v.holdings.values()]),owner_id:v.owner,section:'Finances',
   visibility:'private',household_id:null,item_type:holdingType,origin:'PRIVATE_MANUAL_FINANCE',payload:{fictional:true,ownerId:v.owner,version:1,holding}};
  const reviewId=token();v.review={reviewId,v,draft,prior};
  return {reviewId,holding,summary,expiresAt:v.expiresAt};
 }
 function claim(id,owner,reviewId){
  const v=state(id,{ownerId:owner}),r=v.review;if(!r||r.reviewId!==reviewId)throw Error('Holding review expired.');
  v.review=null;r.claimed=true;return r;
 }
 async function save(r,actor){
  if(!r?.claimed||r.started||!active(r.v)||actor.ownerId!==r.v.owner)throw Error('Holding review expired.');
  r.started=true;
  const result=await api.saveHolding(actor.accessToken,r.v.owner,r.draft,r.prior);
  if(!Array.isArray(result)||result.length!==1||result[0].id!==r.draft.id||result[0].version!==(r.prior?.version??0)+1||
     !same(validateHoldingRow(result[0],r.v.owner),r.draft.payload.holding))throw Error('Holding save unconfirmed.');
  const rows=await api.getHolding(actor.accessToken,r.v.owner,r.draft.id);
  if(!Array.isArray(rows)||rows.length!==1||!same(rows[0],result[0])||!active(r.v))throw Error('Holding save unconfirmed.');
  clear(r.v.id);return {saved:true,version:result[0].version};
 }
 return {list,read,prepare,claim,save,clear,dispose(){for(const id of views.keys())clear(id);}};
}
