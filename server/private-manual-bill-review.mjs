import {randomBytes} from 'node:crypto';
import {financeRecordId,nextFinanceSlot} from './private-finance-identity.mjs';
import {billType,confirmationType,confirmationId,validateBillRow} from './private-bill-records.mjs';
import {savedFinanceRecords} from './saved-finance-records.mjs';
import {manualBill,billOccurrences,billConfirmation} from '../src/private-manual-bills.mjs';
import {newYorkTaskDay} from '../src/private-smart-task.mjs';
import {stableStringify} from './stable-json.mjs';

const token=()=>randomBytes(32).toString('base64url');
const same=(a,b)=>stableStringify(a)===stableStringify(b);
const keys=(v,fields)=>v&&Object.keys(v).sort().join(',')===fields;

export function billMatchCandidate(row,owner,today){
 if(row?.item_type!=='provider_bank_transaction'||row.origin!=='plaid_readonly'||row.deleted_at!==null||
    !Number.isInteger(row.version)||row.version<1)throw Error('Verified saved transaction required.');
 const [tx]=savedFinanceRecords([row],owner).transactions;
 if(tx.pending||tx.direction!=='outflow'||tx.date>today)return null;
 const {connectionId,sourceId}=row.payload;
 return {match:{key:financeRecordId('private-bill-match',owner,connectionId,sourceId),recordId:row.id,version:row.version},
  summary:{label:tx.merchant||tx.name||'Saved transaction',paidDay:tx.date,amountMinor:tx.amountMinor}};
}
function draft(owner,id,kind,fields){
 return {owner_id:owner,id,section:'Finances',household_id:null,visibility:'private',origin:'PRIVATE_MANUAL_FINANCE',item_type:kind,
  payload:{...fields,ownerId:owner,fictional:true,version:1}};
}
export function createManualBillReview({api,now=Date.now,transactionReader=null}){
 const contexts=new Map();
 function clear(id){clearTimeout(contexts.get(id)?.timer);contexts.delete(id);}
 const active=s=>contexts.get(s.id)===s&&s.expiresAt>now();
 function state(id,actor){
  const s=contexts.get(id);
  if(!s?.ready||!active(s)||s.owner!==actor.ownerId)throw Error('Open bills again.');
  return s;
 }
 async function record(actor,kind,id){
  const rows=await api.getBillRecord(actor.accessToken,actor.ownerId,kind,id);
  if(!Array.isArray(rows)||rows.length>1)throw Error('Invalid selected bill.');
  if(!rows.length)return null;
  if(rows[0].id!==id||rows[0].item_type!==kind)throw Error('Bill selection changed.');
  validateBillRow(rows[0],actor.ownerId);
  return rows[0];
 }
 async function selected(s,actor,billToken){
  const expected=s.bills.get(billToken);
  if(!expected||!same(await record(actor,billType,expected.id),expected)||!active(s))throw Error('Bill changed.');
  return expected;
 }
 async function list(id,actor,expiresAt){
  clear(id);
  const s={id,owner:actor.ownerId,expiresAt:Math.min(expiresAt,now()+300000),bills:new Map()};
  contexts.set(id,s);s.timer=setTimeout(()=>{if(contexts.get(id)===s)clear(id);},Math.max(1,s.expiresAt-now()));s.timer.unref?.();
  const rows=await api.listBills(actor.accessToken,s.owner);
  if(!active(s)||!Array.isArray(rows)||rows.length>100||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Complete bill list required.');
  const bills=rows.map(row=>{
   if(row.item_type!==billType)throw Error('Invalid bill.');
   const bill=validateBillRow(row,s.owner),billToken=token();s.bills.set(billToken,row);
   return {billToken,label:bill.label,version:row.version};
  }).sort((a,b)=>a.label.localeCompare(b.label));
  s.ready=true;return {bills,expiresAt:s.expiresAt};
 }
 async function read(id,actor,values){
  if(!keys(values,'billToken,from,to'))throw Error('Choose a bill and date range.');
  const s=state(id,actor);s.review=s.selection=s.candidates=null;
  const bill=await selected(s,actor,values.billToken),{from,to}=values,today=newYorkTaskDay(now());
  billOccurrences(bill.payload.bill,[],from,to,today);
  const rows=await api.listBillConfirmations(actor.accessToken,s.owner,bill.id,from,to);
  if(!Array.isArray(rows)||rows.length>367)throw Error('Incomplete bill history.');
  const payments=rows.map(row=>{
   if(row.item_type!==confirmationType||row.payload?.billId!==bill.id)throw Error('Bill history changed.');
   return validateBillRow(row,s.owner);
  });
  const occurrences=billOccurrences(bill.payload.bill,payments,from,to,today);
  if(!active(s))throw Error('Bill selection expired.');
  s.selection={billToken:values.billToken,occurrences};
  return {bill:bill.payload.bill,occurrences,today,version:bill.version,expiresAt:s.expiresAt};
 }
 async function transactionPage(actor,offset){
  if(!transactionReader||!Number.isInteger(offset)||offset<0||offset>480||offset%20!==0)throw Error('Choose a saved transaction page.');
  const rows=await transactionReader(actor,{offset});
  if(!Array.isArray(rows)||rows.length>21||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Invalid saved transactions.');
  return {items:rows.slice(0,20).map(row=>billMatchCandidate(row,actor.ownerId,newYorkTaskDay(now()))).filter(Boolean),more:rows.length===21&&offset<480};
 }
 function unpaid(s,billToken,dueDay){
  const occurrence=s.selection?.occurrences.find(o=>o.dueDay===dueDay);
  if(s.selection?.billToken!==billToken||!occurrence||occurrence.payment)throw Error('Select an unpaid occurrence.');
  return occurrence;
 }
 async function candidates(id,actor,values){
  if(!keys(values,'billToken,dueDay,offset'))throw Error('Choose a bill occurrence.');
  const s=state(id,actor),{billToken,dueDay,offset}=values;
  s.review=s.candidates=null;unpaid(s,billToken,dueDay);await selected(s,actor,billToken);
  const page=await transactionPage(actor,offset);
  const used=new Set(await api.usedBillMatchKeys(actor.accessToken,s.owner,page.items.map(item=>item.match.key)));
  if(!active(s))throw Error('Bill selection expired.');
  s.candidates={offset,billToken,dueDay,items:new Map()};
  const transactions=page.items.filter(item=>!used.has(item.match.key)).map(candidate=>{
   const transactionToken=token();s.candidates.items.set(transactionToken,candidate);
   return {...candidate.summary,transactionToken};
  });
  return {transactions,more:page.more,expiresAt:s.expiresAt};
 }
 async function prepare(id,actor,values){
  const s=state(id,actor);s.review=null;
  let next,prior=null,parent=null,candidate=null,offset=null,details;
  if(keys(values,'bill')||keys(values,'bill,billToken')){
   const bill=manualBill(values.bill);
   if('billToken' in values)prior=await selected(s,actor,values.billToken);
   if(prior&&same(prior.payload.bill,bill))return {noChanges:true};
   next=draft(s.owner,prior?.id??nextFinanceSlot(s.owner,billType,[...s.bills.values()]),billType,{bill});
   details={bill};
  }else{
   const manual=keys(values,'amountMinor,billToken,dueDay,paidDay');
   if(!manual&&!keys(values,'billToken,dueDay,transactionToken'))throw Error('Choose a payment to review.');
   const {billToken,dueDay}=values,occurrence=unpaid(s,billToken,dueDay);
   parent=await selected(s,actor,billToken);
   if(!manual){
    if(s.candidates?.dueDay!==dueDay||s.candidates.billToken!==billToken)throw Error('Choose a listed transaction.');
    candidate=s.candidates.items.get(values.transactionToken);offset=s.candidates.offset;
    if(!candidate)throw Error('Choose a listed transaction.');
   }
   const {paidDay,amountMinor}=candidate?.summary??values;
   const confirmation=billConfirmation({label:occurrence.label,dueDay,expectedMinor:occurrence.expectedMinor,estimated:occurrence.estimated,
    paidDay,amountMinor,source:manual?'manual':'saved_transaction'});
   if(paidDay>newYorkTaskDay(now()))throw Error('Payment date is in the future.');
   const occurrenceId=confirmationId(s.owner,parent.id,dueDay);
   if(await record(actor,confirmationType,occurrenceId))throw Error('Payment already confirmed.');
   next=draft(s.owner,occurrenceId,confirmationType,{billId:parent.id,confirmation,match:candidate?.match??null});
   details={confirmation,...(candidate?{transaction:candidate.summary}:{})};
  }
  if(!active(s))throw Error('Bill review expired.');
  const reviewId=token();
  s.review={reviewId,s,next,prior,parent,candidate,offset};
  return {reviewId,...details,expiresAt:s.expiresAt};
 }
 function claim(id,owner,reviewId){
  const s=state(id,{ownerId:owner}),review=s.review;
  if(!review||review.reviewId!==reviewId)throw Error('Open bill review again.');
  s.review=null;review.claimed=true;return review;
 }
 async function save(r,actor){
  if(!r?.claimed||r.started||r.s.owner!==actor.ownerId||!active(r.s))throw Error('Review expired.');
  r.started=true;
  if(r.candidate&&!(await transactionPage(actor,r.offset)).items.some(item=>same(item,r.candidate)))throw Error('Saved transaction changed.');
  if(!active(r.s))throw Error('Review expired.');
  const {owner}=r.s;
  const rows=r.parent?await api.confirmBill(actor.accessToken,owner,r.next,r.parent):await api.saveBill(actor.accessToken,owner,r.next,r.prior);
  if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==r.next.id||rows[0].version!==(r.prior?.version??0)+1||!same(rows[0].payload,r.next.payload))throw Error('Bill save unconfirmed.');
  if(!same(await record(actor,r.next.item_type,r.next.id),rows[0])||!active(r.s))throw Error('Bill save unconfirmed.');
  clear(r.s.id);return {saved:true,version:rows[0].version};
 }
 return {list,read,candidates,prepare,claim,save,clear,dispose(){for(const id of contexts.keys())clear(id);}};
}
