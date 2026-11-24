import {randomBytes} from 'node:crypto';
import {nextFinanceSlot} from './private-finance-identity.mjs';
import {validateIncomeRow,paymentId,incomeSourceType,incomePaymentType} from './private-income-records.mjs';
import {manualIncomeSchedule,manualIncomePayment,manualIncomeForPeriod} from '../src/private-manual-income.mjs';
import {stableStringify} from './stable-json.mjs';
import {newYorkTaskDay} from '../src/private-smart-task.mjs';

const token=()=>randomBytes(32).toString('base64url');
const same=(a,b)=>stableStringify(a)===stableStringify(b);
const keys=(v,s)=>v&&Object.keys(v).sort().join(',')===s;
const slotKey=p=>p.expectedDay+'#'+p.slot;
function draftRow(owner,id,kind,fields){
 return {owner_id:owner,id,section:'Finances',household_id:null,visibility:'private',origin:'PRIVATE_MANUAL_FINANCE',item_type:kind,
  payload:{...fields,ownerId:owner,fictional:true,version:1}};
}
export function createManualIncomeReview({api,now=Date.now}){
 const contexts=new Map();
 function clear(id){clearTimeout(contexts.get(id)?.timer);contexts.delete(id);}
 function active(s){return contexts.get(s.id)===s&&s.expiresAt>now();}
 function state(id,actor){const s=contexts.get(id);if(!s||!active(s)||s.owner!==actor.ownerId)throw Error('Open manual income again.');return s;}
 async function get(actor,kind,id){
  const rows=await api.getIncomeRecord(actor.accessToken,actor.ownerId,kind,id);
  if(!Array.isArray(rows)||rows.length>1)throw Error('Private income record unavailable.');
  if(!rows.length)return null;
  const row=rows[0];validateIncomeRow(row,actor.ownerId);
  if(row.id!==id||row.item_type!==kind)throw Error('Income selection changed.');
  return row;
 }
 async function list(id,actor,expiresAt){
  clear(id);
  const s={id,owner:actor.ownerId,expiresAt:Math.min(expiresAt,now()+300000),sources:new Map(),selection:null,review:null};
  contexts.set(id,s);s.timer=setTimeout(()=>{if(contexts.get(id)===s)clear(id);},Math.max(1,s.expiresAt-now()));s.timer.unref?.();
  const rows=await api.listIncomeSources(actor.accessToken,actor.ownerId);
  if(!active(s)||!Array.isArray(rows)||rows.length>100||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Complete source list required.');
  const sources=rows.map(row=>{
   if(row.item_type!==incomeSourceType)throw Error('Unexpected income record.');
   const schedule=validateIncomeRow(row,s.owner),sourceToken=token();
   s.sources.set(sourceToken,row);
   return {sourceToken,label:schedule.label,cadence:schedule.cadence,version:row.version};
  }).sort((a,b)=>a.label.localeCompare(b.label));
  s.ready=true;
  return {sources,expiresAt:s.expiresAt};
 }
 async function selected(s,actor,sourceToken){
  const prior=s.sources.get(sourceToken);
  if(!prior)throw Error('Select a listed income source.');
  const row=await get(actor,incomeSourceType,prior.id);
  if(!same(row,prior)||!active(s))throw Error('Income schedule changed.');
  return row;
 }
 async function read(id,actor,values){
  if(!keys(values,'from,sourceToken,to'))throw Error('Select an income source and period.');
  const s=state(id,actor);s.selection=s.review=null;
  const source=await selected(s,actor,values.sourceToken),{from,to}=values,schedule=source.payload.schedule;
  manualIncomeForPeriod(schedule,[],from,to);
  const rows=await api.listIncomePayments(actor.accessToken,s.owner,source.id,from,to);
  if(!Array.isArray(rows)||rows.length>2000)throw Error('Complete paycheck history required.');
  const receipts=rows.map(row=>{
   if(row.item_type!==incomePaymentType||row.payload?.sourceId!==source.id)throw Error('Selected paycheck changed.');
   return validateIncomeRow(row,s.owner);
  });
  const summary=manualIncomeForPeriod(schedule,receipts,from,to);
  if(!active(s))throw Error('Income selection expired.');
  const received=receipts.filter(p=>p.receivedDay>=from&&p.receivedDay<=to).sort((a,b)=>a.receivedDay.localeCompare(b.receivedDay)||a.expectedDay.localeCompare(b.expectedDay)||a.slot-b.slot);
  s.selection={sourceToken:values.sourceToken,summary,rows:new Map(rows.map(r=>[slotKey(r.payload.payment),r]))};
  return {schedule,summary,received,version:source.version,expiresAt:s.expiresAt};
 }
 async function prepare(id,actor,values){
  const s=state(id,actor);s.review=null;
  if(!s.ready)throw Error('Open manual income again.');
  let source=null,prior=null,draft,details;
  if(keys(values,'schedule')||keys(values,'schedule,sourceToken')){
   const schedule=manualIncomeSchedule(values.schedule);
   if('sourceToken' in values)prior=await selected(s,actor,values.sourceToken);
   if(prior&&same(prior.payload.schedule,schedule))return {noChanges:true};
   const recordId=prior?.id??nextFinanceSlot(s.owner,incomeSourceType,[...s.sources.values()]);
   draft=draftRow(s.owner,recordId,incomeSourceType,{schedule});
   details={schedule};
  }else{
   if(!keys(values,'payment,sourceToken')||!keys(values.payment,'expectedDay,netMinor,paystub,receivedDay,slot'))throw Error('Exact paycheck required.');
   source=await selected(s,actor,values.sourceToken);
   if(s.selection?.sourceToken!==values.sourceToken)throw Error('Open the selected pay period first.');
   const key=slotKey(values.payment),expected=s.selection.summary.payments.find(p=>slotKey(p)===key);
   if(!expected)throw Error('Select a scheduled paycheck in this period.');
   const payment=manualIncomePayment({...values.payment,expectedNetMinor:expected.expectedNetMinor});
   if(payment.receivedDay>newYorkTaskDay(now()))throw Error('The receipt date is in the future.');
   const recordId=paymentId(s.owner,source.id,payment.expectedDay,payment.slot);
   prior=await get(actor,incomePaymentType,recordId);
   if(!same(prior,s.selection.rows.get(key)??null))throw Error('Payment changed. Open the period again.');
   if(prior&&same(prior.payload.payment,payment))return {noChanges:true};
   draft=draftRow(s.owner,recordId,incomePaymentType,{sourceId:source.id,payment});
   details={payment};
  }
  if(!active(s))throw Error('Income review expired.');
  const review={id:token(),s,draft,prior,source};s.review=review;
  return {reviewId:review.id,action:prior?'edit':'create',...details,expiresAt:s.expiresAt};
 }
 function claim(id,owner,reviewId){
  const s=state(id,{ownerId:owner}),r=s.review;
  if(!r||r.id!==reviewId)throw Error('Income review expired.');
  s.review=null;r.claimed=true;return r;
 }
 async function save(r,actor){
  if(!r?.claimed||r.started||r.s.owner!==actor.ownerId||!active(r.s))throw Error('Review expired.');
  r.started=true;
  if(r.source&&!same(await get(actor,incomeSourceType,r.source.id),r.source))throw Error('Income schedule changed.');
  if(!active(r.s))throw Error('Review expired.');
  const rows=await api.saveIncomeRecord(actor.accessToken,r.s.owner,r.draft,r.prior);
  if(!Array.isArray(rows)||rows.length!==1||rows[0].version!==(r.prior?.version??0)+1||rows[0].id!==r.draft.id||
     !same(rows[0].payload,r.draft.payload))throw Error('Income save unconfirmed.');
  validateIncomeRow(rows[0],r.s.owner);
  const latest=await get(actor,r.draft.item_type,r.draft.id);
  if(!same(rows[0],latest)||!active(r.s))throw Error('Income save unconfirmed.');
  clear(r.s.id);return {saved:true,version:latest.version};
 }
 return {list,read,prepare,claim,save,clear,dispose(){for(const id of contexts.keys())clear(id);}};
}
