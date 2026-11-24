import {receiptChoices,selectedReceipt,downloadReceipt} from './private-receipt-files.mjs';
import {manualExpense} from '../src/private-manual-transactions.mjs';
import {manualIncomeForPeriod} from '../src/private-manual-income.mjs';
import {validateIncomeRow,incomeSourceType,incomePaymentType} from './private-income-records.mjs';
import {financeRecordId} from './private-finance-identity.mjs';
import {randomBytes} from 'node:crypto';
import {manualBudgetPeriod,normalizeManualBudget,calculateManualBudget,nextManualBudget} from '../src/private-finance-manual.mjs';
import {stableStringify} from './stable-json.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const same=(left,right)=>stableStringify(left)===stableStringify(right);
const token=()=>randomBytes(32).toString('base64url');

export function manualBudgetId(owner,period) {
 if (!uuid.test(owner)) throw Error('Verified budget owner required.');
 const {period:kind,periodStart,periodEnd}=manualBudgetPeriod(period);
 return financeRecordId('private-budget-v1',owner.toLowerCase(),kind,periodStart,periodEnd);
}

export function validateBudgetRow(row,owner) {
 const p=row?.payload;
 if (row?.owner_id!==owner||row.household_id!==null||row.visibility!=='private'||row.section!=='Finances'||
     row.item_type!=='manual_finance_budget'||row.origin!=='PRIVATE_MANUAL_FINANCE'||row.deleted_at!==null||
     !Number.isSafeInteger(row.version)||row.version<1||!p||Object.keys(p).sort().join(',')!=='budget,fictional,ownerId,version'||
     p.fictional!==true||p.ownerId!==owner||p.version!==1) throw Error('Private budget record required.');
 const budget=normalizeManualBudget(p.budget);
 if (manualBudgetId(owner,budget)!==row.id) throw Error('Budget period differs from the selected record.');
 calculateManualBudget(budget);
 return budget;
}

function preserveExpenseMatches(current,proposed){
 const linked=rows=>rows.filter(t=>t.reconciliationId).map(t=>[t.reconciliationId,t.day,t.amountMinor]).sort((a,b)=>a[0].localeCompare(b[0]));
 const before=linked(current?.transactions??[]),after=linked(proposed.transactions);
 if(!same(before,after)||new Set(after.map(entry=>entry[0])).size!==after.length)throw Error('Preserve the date, amount and link for each reconciled expense.');
}

export function createPrivateBudgetReview({api,now=Date.now,documentStorage=null}) {
 const views=new Map();
 function clear(id){clearTimeout(views.get(id)?.timer);views.delete(id);}
 function active(view){return views.get(view.id)===view&&view.expiresAt>now();}
 function state(id,owner){const view=views.get(id);if(!view||!active(view)||view.owner!==owner)throw Error('Open the period again.');return view;}
 async function read(actor,period){
  const id=manualBudgetId(actor.ownerId,period),rows=await api.getManualBudget(actor.accessToken,id,actor.ownerId);
  if(!Array.isArray(rows)||rows.length>1)throw Error('Budget read unavailable.');
  if(!rows.length)return null;
  validateBudgetRow(rows[0],actor.ownerId);
  if(rows[0].id!==id)throw Error('Budget selection changed.');
  return rows[0];
 }
 async function open(id,actor,values,expiresAt){
  clear(id);
  if(Object.keys(values).sort().join(',')!=='period,periodEnd,periodStart')throw Error('Select a period.');
  const period=manualBudgetPeriod(values),owner=actor.ownerId;
  const view={id,owner,period,expiresAt:Math.min(now()+300000,expiresAt),review:null,record:null};
  views.set(id,view);
  view.timer=setTimeout(()=>{if(views.get(id)===view)clear(id);},Math.max(1,view.expiresAt-now()));view.timer.unref?.();
  const record=await read(actor,period);
  if(!active(view))throw Error('Budget view expired.');
  view.record=record;view.ready=true;
  return {period,budget:record?.payload.budget??null,version:record?.version??0,expiresAt:view.expiresAt};
 }
 async function expenseForReceipt(id,actor,index){
  const view=state(id,actor.ownerId),budget=view.record?.payload.budget;
  if(!documentStorage||!view.ready||!budget||!Number.isInteger(index)||index<0||index>=budget.transactions.length||
     !same(view.record,await read(actor,view.period))||!active(view))throw Error('Select a current saved expense.');
  return {view,budget,expense:budget.transactions[index]};
 }
 async function receipts(id,actor,{index,offset}){
  const {view,expense}=await expenseForReceipt(id,actor,index);view.review=null;
  const page=await receiptChoices(documentStorage,actor,offset);
  const attached=expense.receiptFile?await documentStorage.inspect(actor,expense.receiptFile.documentId):null;
  if(!active(view))throw Error('Expense view expired.');
  view.receipts={index,options:page.options};
  return {...page.reply,attachedName:attached?.fields.name??null,expiresAt:view.expiresAt};
 }
 async function receiptDownload(id,actor,{index}){
  const {view,expense}=await expenseForReceipt(id,actor,index);
  const result=await downloadReceipt(documentStorage,actor,expense.receiptFile);
  if(!active(view)||!same(view.record,await read(actor,view.period))||!active(view))throw Error('Expense changed.');
  return result;
 }
 async function prepare(id,actor,values){
  const view=state(id,actor.ownerId);
  if(!view.ready)throw Error('Open the period again.');
  view.review=null;
  let budget,source=null,receiptName;
  if(Object.keys(values).join(',')==='carryFrom'){
   if(view.record)throw Error('Choose an empty following period.');
   source=await read(actor,manualBudgetPeriod(values.carryFrom));
   if(!source)throw Error('No saved budget for the preceding period.');
   budget=nextManualBudget(source.payload.budget,view.period);
  }else if(Object.keys(values).sort().join(',')==='index,receiptChoice'){
   const {expense,budget:original}=await expenseForReceipt(id,actor,values.index);
   if(view.receipts?.index!==values.index)throw Error('Choose a file for this expense.');
   const {file,name}=selectedReceipt(view.receipts,values.receiptChoice,expense.receiptFile);receiptName=name;
   const updated={...expense};if(file)updated.receiptFile=file;else delete updated.receiptFile;
   const transactions=[...original.transactions];transactions[values.index]=updated;budget=normalizeManualBudget({...original,transactions});
  }else if(Object.keys(values).sort().join(',')==='expense,index'){
   const original=view.record?.payload.budget??{...view.period,plannedIncomeMinor:0,allocations:[],transactions:[]};
   const expense=manualExpense(values.expense,view.period.periodStart,view.period.periodEnd);
   const index=values.index;
   if(index!==null&&(!Number.isInteger(index)||index<0||index>=original.transactions.length))throw Error('Select a recorded expense.');
   const transactions=[...original.transactions];transactions[index??transactions.length]=expense;
   budget=normalizeManualBudget({...original,transactions});
  }else{
   if(Object.keys(values).join(',')!=='budget')throw Error('Exact budget review required.');
   budget=normalizeManualBudget(values.budget);
   if(!same(manualBudgetPeriod(budget),view.period))throw Error('Budget period changed.');
  }
  if(receiptName===undefined){
   const links=b=>(b?.transactions??[]).filter(t=>t.receiptFile).map(t=>t.receiptFile).sort((a,b)=>a.linkId.localeCompare(b.linkId));
   if(!same(links(view.record?.payload.budget),links(budget)))throw Error('Change receipt links through the document picker.');
  }
  preserveExpenseMatches(view.record?.payload.budget,budget);
  calculateManualBudget(budget);
  if(Buffer.byteLength(JSON.stringify(budget))>60000)throw Error('This period exceeds the budget storage limit.');
  const latest=await read(actor,view.period);
  if(!active(view)||!same(view.record,latest))throw Error('Budget changed. Open the period again.');
  if(latest&&same(latest.payload.budget,budget))return {noChanges:true};
  const review={view,reviewId:token(),budget,source};
  view.review=review;
  return {reviewId:review.reviewId,budget,...(receiptName===undefined?{}:{receiptName}),source:source?{...manualBudgetPeriod(source.payload.budget),version:source.version}:null,expiresAt:view.expiresAt};
 }
 async function cashFlow(id,actor){
  const view=state(id,actor.ownerId);
  if(!view.record||view.review)throw Error('Open a saved budget before comparing cash flow.');
  const budget=validateBudgetRow(view.record,actor.ownerId),sources=await api.listIncomeSources(actor.accessToken,actor.ownerId);
  if(!Array.isArray(sources)||sources.length>100||new Set(sources.map(row=>row.id)).size!==sources.length)throw Error('Complete private income sources required.');
  const {periodStart:from,periodEnd:to}=view.period;
  let expected=0n,received=0n;
  for(const source of sources){
   if(!active(view)||source.item_type!==incomeSourceType)throw Error('Budget comparison expired.');
   const schedule=validateIncomeRow(source,actor.ownerId),rows=await api.listIncomePayments(actor.accessToken,actor.ownerId,source.id,from,to);
   if(!Array.isArray(rows)||rows.length>2000)throw Error('Complete income receipts required.');
   const payments=rows.map(row=>{
    if(row.item_type!==incomePaymentType||row.payload?.sourceId!==source.id)throw Error('Income source changed.');
    return validateIncomeRow(row,actor.ownerId);
   });
   const income=manualIncomeForPeriod(schedule,payments,from,to);
   expected+=BigInt(income.expectedNetMinor);received+=BigInt(income.receivedNetMinor);
  }
  if(!active(view)||!same(view.record,await read(actor,view.period))||!active(view))throw Error('Saved budget changed.');
  const expense=calculateManualBudget(budget).totalActualMinor;
  const amounts={expectedIncomeMinor:Number(expected),receivedIncomeMinor:Number(received),recordedExpensesMinor:expense,
   manualNetCashFlowMinor:Number(received-BigInt(expense)),incomeVarianceMinor:Number(received-BigInt(budget.plannedIncomeMinor))};
  if(!Object.values(amounts).every(Number.isSafeInteger))throw Error('Cash flow exceeds the supported range.');
  return {period:view.period,sourceCount:sources.length,...amounts,expiresAt:view.expiresAt};
 }
 function claim(id,owner,reviewId) {
  const view=state(id,owner),review=view.review;
  if(!review||review.reviewId!==reviewId)throw Error('Review the budget again.');
  view.review=null;review.claimed=true;return review;
 }
 async function save(review,actor) {
  if(!review?.claimed||review.started||!active(review.view)||review.view.owner!==actor.ownerId)throw Error('Budget review ended.');
  review.started=true;
  const {view,budget,source}=review,owner=actor.ownerId;
  if(source&&!same(await read(actor,source.payload.budget),source))throw Error('Rollover source has changed.');
  if(!active(view))throw Error('Budget review ended.');
  const draft={id:manualBudgetId(owner,budget),owner_id:owner,household_id:null,visibility:'private',section:'Finances',
   item_type:'manual_finance_budget',origin:'PRIVATE_MANUAL_FINANCE',payload:{fictional:true,version:1,ownerId:owner,budget}};
  const rows=await api.saveManualBudget(actor.accessToken,owner,draft,view.record);
  if(!Array.isArray(rows)||rows.length!==1||rows[0].version!==(view.record?.version??0)+1||
     !same(validateBudgetRow(rows[0],owner),budget))throw Error('Check the saved budget before retrying.');
  const latest=await read(actor,view.period);
  if(!latest||latest.version!==rows[0].version||!same(latest.payload.budget,budget)||!active(view))throw Error('Budget save unconfirmed.');
  clear(view.id);
  return {saved:true,version:latest.version};
 }
 return {open,prepare,cashFlow,receipts,receiptDownload,claim,save,clear,dispose(){for(const id of views.keys())clear(id);}};
}
