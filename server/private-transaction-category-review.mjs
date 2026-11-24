import {receiptChoices,downloadReceipt} from './private-receipt-files.mjs';
import {reconciliationId,prepareExpenseReconciliation,validateExpenseReconciliation} from './private-expense-reconciliation.mjs';
import {manualBudgetId,validateBudgetRow} from './private-budget-period.mjs';
import {manualBudgetPeriod} from '../src/private-finance-manual.mjs';
import {randomBytes} from 'node:crypto';
import {stableStringify} from './stable-json.mjs';
import {categorySource,categoryRecordId,categoryRecordType,validateCategoryRecord} from './private-transaction-category-record.mjs';
import {transactionCategories} from '../src/private-transaction-categories.mjs';

const same=(a,b)=>stableStringify(a)===stableStringify(b);
const token=()=>randomBytes(32).toString('base64url');
const keys=(v,fields)=>v&&Object.keys(v).sort().join(',')===fields;
export function createTransactionCategoryReview({api,transactionReader,allowExpenseMatching=false,documentStorage=null,now=Date.now}){
 const views=new Map();
 function clear(id){clearTimeout(views.get(id)?.timer);views.delete(id);}
 const active=view=>views.get(view.id)===view&&view.expiresAt>now();
 function current(id,actor){
  const view=views.get(id);if(!view||!active(view)||view.owner!==actor.ownerId)throw Error('Open saved transactions again.');
  return view;
 }
 async function page(actor,offset){
  if(!Number.isInteger(offset)||offset<0||offset>480||offset%20!==0)throw Error('Choose a transaction page.');
  const rows=await transactionReader(actor,{offset});
  if(!Array.isArray(rows)||rows.length>21||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Invalid saved transaction page.');
  return {items:rows.slice(0,20).map(row=>categorySource(row,actor.ownerId)),more:rows.length>20&&offset<480};
 }
 async function open(id,actor,values,expiresAt){
  if(!keys(values,'offset'))throw Error('Select a transaction page.');
  clear(id);
  const view={id,owner:actor.ownerId,offset:values.offset,expiresAt:Math.min(expiresAt,now()+300000),options:new Map()};
  views.set(id,view);view.timer=setTimeout(()=>{if(views.get(id)===view)clear(id);},Math.max(1,view.expiresAt-now()));view.timer.unref?.();
  const result=await page(actor,view.offset);
  if(!active(view))throw Error('Transaction page expired.');
  const items=result.items.map(item=>{
   const transactionToken=token();view.options.set(transactionToken,item);
   return {transactionToken,label:item.label,day:item.source.day,pending:item.pending};
  });
  return {items,more:result.more,offset:view.offset,expiresAt:view.expiresAt};
 }
 async function latest(actor,view,item){
  const result=await page(actor,view.offset);
  if(!active(view)||!result.items.some(candidate=>same(candidate,item)))throw Error('Selected transaction changed.');
 }
 async function annotation(actor,id){
  const rows=await api.getTransactionCategories(actor.accessToken,actor.ownerId,id);
  if(!Array.isArray(rows)||rows.length>1)throw Error('Cannot verify saved categories.');
  if(!rows.length)return null;
  validateCategoryRecord(rows[0],actor.ownerId);
  if(rows[0].id!==id)throw Error('Selected categories changed.');
  return rows[0];
 }
 async function matchRecord(actor,item){
  const id=reconciliationId(actor.ownerId,item.source),rows=await api.getExpenseMatch(actor.accessToken,actor.ownerId,id);
  if(!Array.isArray(rows)||rows.length>1)throw Error('Incomplete match history.');
  if(!rows.length)return null;
  if(rows[0].id!==id)throw Error('Match selection changed.');
  validateExpenseReconciliation(rows[0],actor.ownerId);
  return rows[0];
 }
 async function getBudget(actor,period){
  const id=manualBudgetId(actor.ownerId,period),rows=await api.getManualBudget(actor.accessToken,id,actor.ownerId);
  if(!Array.isArray(rows)||rows.length>1)throw Error('Invalid selected budget.');
  if(!rows.length)return null;
  if(rows[0].id!==id)throw Error('Budget period changed.');
  validateBudgetRow(rows[0],actor.ownerId);return rows[0];
 }
 async function expenses(id,actor,values){
  if(!allowExpenseMatching||!keys(values,'offset,period,transactionToken')||!keys(values.period,'period,periodEnd,periodStart')||
     !Number.isInteger(values.offset)||values.offset<0||values.offset>980||values.offset%20!==0)throw Error('Select a budget period.');
  const view=current(id,actor),selection=view.selection;
  view.review=view.expenses=null;
  if(!selection||selection.transactionToken!==values.transactionToken||selection.item.pending||selection.item.source.amountMinor<=0)throw Error('Select a posted debit.');
  await latest(actor,view,selection.item);
  if(await matchRecord(actor,selection.item))throw Error('Debit already matched.');
  const period=manualBudgetPeriod(values.period),row=await getBudget(actor,period);
  if(!active(view))throw Error('Selection expired.');
  const entries=(row?.payload.budget.transactions??[]).map((expense,index)=>({expense,index})).filter(i=>!i.expense.reconciliationId);
  const exact=i=>i.expense.amountMinor===selection.item.source.amountMinor;
  entries.sort((a,b)=>Number(exact(b))-Number(exact(a))||b.expense.day.localeCompare(a.expense.day)||a.index-b.index);
  view.expenses={row,options:new Map()};
  const items=entries.slice(values.offset,values.offset+20).map(({expense,index})=>{
   const expenseToken=token();view.expenses.options.set(expenseToken,index);
   return {expenseToken,day:expense.day,label:expense.label??'',category:expense.splits?expense.splits.map(p=>p.category).join(', '):expense.category,amountMinor:expense.amountMinor};
  });
  return {period,items,offset:values.offset,more:entries.length>values.offset+20,expiresAt:view.expiresAt};
 }
 async function read(id,actor,values){
  if(!keys(values,'transactionToken'))throw Error('Select a transaction.');
  const view=current(id,actor);view.review=view.selection=view.expenses=null;
  const item=view.options.get(values.transactionToken);
  if(!item)throw Error('Select a listed transaction.');
  await latest(actor,view,item);
  const recordId=categoryRecordId(view.owner,item.source);
  const prior=await annotation(actor,recordId);
  if(!active(view))throw Error('Selection expired.');
  const previous=prior&&!same(prior.payload.source,item.source)?{day:prior.payload.source.day,amountMinor:prior.payload.source.amountMinor}:null;
  const matched=allowExpenseMatching?await matchRecord(actor,item):null;
  if(!active(view))throw Error('Selection expired.');
  view.selection={item,recordId,prior,transactionToken:values.transactionToken};
  return {label:item.label,day:item.source.day,amountMinor:item.source.amountMinor,pending:item.pending,categories:prior?.payload.categories??null,previous,...(allowExpenseMatching?{match:matched?validateExpenseReconciliation(matched,view.owner):null}:{}),expiresAt:view.expiresAt};
 }
 async function receiptSource(id,actor,transactionToken){
  const view=current(id,actor),s=view.selection;
  if(!documentStorage||!s||s.transactionToken!==transactionToken||s.item.pending)throw Error('Choose a posted transaction.');
  await latest(actor,view,s.item);
  if(!same(await annotation(actor,s.recordId),s.prior)||!active(view)||view.selection!==s)throw Error('Selected transaction changed.');
  return {view,s};
 }
 async function receipts(id,actor,{transactionToken,offset}){
  const {view,s}=await receiptSource(id,actor,transactionToken);view.review=null;
  const page=await receiptChoices(documentStorage,actor,offset);
  const doc=s.prior?.payload.receiptDocumentId?await documentStorage.inspect(actor,s.prior.payload.receiptDocumentId):null;
  if(!active(view)||view.selection!==s)throw Error('Selection expired.');
  s.receipts=page.options;return {...page.reply,attachedName:doc?.fields.name??null,expiresAt:view.expiresAt};
 }
 async function receiptDownload(id,actor,{transactionToken}){
  const {view,s}=await receiptSource(id,actor,transactionToken);
  if(!s.prior?.payload.receiptDocumentId||!same(s.prior.payload.source,s.item.source))throw Error('Review the changed source before opening its receipt.');
  const result=await downloadReceipt(documentStorage,actor,{documentId:s.prior.payload.receiptDocumentId});
  const current=await receiptSource(id,actor,transactionToken);if(current.s!==s||!active(view))throw Error('Selection changed.');
  return result;
 }
 async function prepare(id,actor,values){
  const view=current(id,actor);view.review=null;
  const selection=view.selection;
  if(allowExpenseMatching&&keys(values,'expenseToken,transactionToken')){
   const options=view.expenses,index=options?.options.get(values.expenseToken);
   if(!selection||values.transactionToken!==selection.transactionToken||index===undefined)throw Error('Select a listed expense.');
   const {item}=selection;
   await latest(actor,view,item);
   const period=manualBudgetPeriod(options.row.payload.budget);
   if(!same(await getBudget(actor,period),options.row)||await matchRecord(actor,item)||!active(view))throw Error('Match changed.');
   const plan=prepareExpenseReconciliation(view.owner,item,options.row,index);
   const reviewId=token();view.review={view,selection,priorBudget:options.row,plan,reviewId};
   return {reviewId,label:item.label,match:plan.details,expiresAt:view.expiresAt};
  }
  const isReceipt=keys(values,'receiptChoice,transactionToken');
  if((!isReceipt&&!keys(values,'categories,transactionToken'))||!selection||selection.transactionToken!==values.transactionToken||selection.item.pending)throw Error('Select a posted transaction.');
  const {item,recordId,prior}=selection;
  let categories,receiptDocumentId=prior?.payload.receiptDocumentId,receiptName;
  if(isReceipt){
   await receiptSource(id,actor,values.transactionToken);
   if(!selection.receipts)throw Error('Open receipt choices.');
   const doc=selection.receipts.get(values.receiptChoice);
   if(!doc&&(values.receiptChoice!==null||!receiptDocumentId))throw Error('Choose a library file.');
   receiptDocumentId=doc?.id??null;receiptName=doc?.fields.name??null;
   categories=prior?.payload.categories??null;
   if(categories)transactionCategories(categories,item.source);
  }else categories=transactionCategories(values.categories,item.source);
  await latest(actor,view,item);
  if(!same(await annotation(actor,recordId),prior)||!active(view))throw Error('Saved categories changed.');
  if(prior&&same(prior.payload.categories,categories)&&same(prior.payload.source,item.source)&&prior.payload.receiptDocumentId===receiptDocumentId)return {noChanges:true};
  const draft={id:recordId,owner_id:view.owner,section:'Finances',household_id:null,visibility:'private',origin:'PRIVATE_MANUAL_FINANCE',item_type:categoryRecordType,
   payload:{fictional:true,version:1,ownerId:view.owner,source:item.source,categories,...(receiptDocumentId===undefined?{}:{receiptDocumentId})}};
  const reviewId=token();view.review={view,selection,draft,reviewId};
  return {reviewId,label:item.label,day:item.source.day,amountMinor:item.source.amountMinor,categories,...(isReceipt?{receiptName}:{}),expiresAt:view.expiresAt};
 }
 function claim(id,owner,reviewId){
  const view=current(id,{ownerId:owner}),r=view.review;
  if(!r||r.reviewId!==reviewId)throw Error('Review expired.');
  view.review=null;r.claimed=true;return r;
 }
 async function save(r,actor){
  if(!r?.claimed||r.started||!active(r.view)||r.view.owner!==actor.ownerId)throw Error('Review expired.');
  r.started=true;
  const {prior,item}=r.selection;
  await latest(actor,r.view,item);
  if(r.plan){
   const rows=await api.matchExpense(actor.accessToken,actor.ownerId,r.plan,r.priorBudget);
   if(!Array.isArray(rows)||rows.length!==1||!same(rows[0].payload,r.plan.receipt.payload)||!same(await matchRecord(actor,item),rows[0]))throw Error('Match unconfirmed.');
   const budget=await getBudget(actor,r.plan.details.period);
   if(budget?.version!==r.priorBudget.version+1||!same(budget.payload.budget,r.plan.budget.payload.budget)||!active(r.view))throw Error('Budget match unconfirmed.');
   clear(r.view.id);return {saved:true,version:1};
  }
  const rows=await api.saveTransactionCategories(actor.accessToken,actor.ownerId,r.draft,prior);
  if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==r.draft.id||rows[0].version!==(prior?.version??0)+1||
     !same(rows[0].payload,r.draft.payload)||!same(await annotation(actor,r.draft.id),rows[0])||!active(r.view))throw Error('Save unconfirmed.');
  clear(r.view.id);return {saved:true,version:rows[0].version};
 }
 return {receipts,receiptDownload,open,read,expenses,prepare,claim,save,clear,dispose(){for(const id of views.keys())clear(id);}};
}
