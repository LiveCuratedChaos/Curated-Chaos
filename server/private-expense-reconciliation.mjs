import {financeRecordId} from './private-finance-identity.mjs';
import {categoryRecordId} from './private-transaction-category-record.mjs';
import {manualBudgetId,validateBudgetRow} from './private-budget-period.mjs';
import {manualBudgetPeriod} from '../src/private-finance-manual.mjs';
import {manualExpense} from '../src/private-manual-transactions.mjs';

const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const exact=(v,k)=>v&&Object.keys(v).sort().join(',')===k;
export const reconciliationType='manual_expense_reconciliation';
export const reconciliationId=(owner,source)=>financeRecordId('private-expense-reconciliation',owner,categoryRecordId(owner,source));

export function validateExpenseReconciliation(row,owner){
 const p=row?.payload,s=p?.source,ref=p?.expense;
 if(!uuid(owner)||row?.owner_id!==owner||row.visibility!=='private'||row.household_id!==null||row.section!=='Finances'||row.item_type!==reconciliationType||
    row.origin!=='PRIVATE_MANUAL_FINANCE'||row.deleted_at!==null||row.version!==1||!exact(p,'budgetId,expense,fictional,ownerId,period,source,version')||p.fictional!==true||p.ownerId!==owner||p.version!==1||
    !exact(s,'amountMinor,connectionId,day,recordId,sourceId,version')||!uuid(s.recordId)||!uuid(s.connectionId)||!Number.isInteger(s.version)||s.version<1||
    typeof s.sourceId!=='string'||!s.sourceId||s.sourceId.length>256||/[\u0000-\u0020\u007f]/.test(s.sourceId)||!Number.isSafeInteger(s.amountMinor)||s.amountMinor<=0||
    !uuid(row.id)||row.id!==reconciliationId(owner,s)||!exact(p.period,'period,periodEnd,periodStart')||p.budgetId!==manualBudgetId(owner,p.period)||
    !exact(ref,'amountMinor,day,label')||typeof ref.label!=='string')throw Error('Invalid reviewed expense match.');
 manualExpense({category:'Posted debit',day:s.day,amountMinor:s.amountMinor},'2000-01-01','2100-12-31');
 manualExpense({category:'Manual expense',day:ref.day,label:ref.label,amountMinor:ref.amountMinor},p.period.periodStart,p.period.periodEnd);
 return {period:manualBudgetPeriod(p.period),expense:ref,postedDay:s.day,postedMinor:s.amountMinor,differenceMinor:s.amountMinor-ref.amountMinor};
}
export function prepareExpenseReconciliation(owner,item,budgetRow,index){
 const budget=validateBudgetRow(budgetRow,owner),period=manualBudgetPeriod(budget);
 const expense=budget.transactions[index];
 if(item.pending||item.source.amountMinor<=0||!Number.isInteger(index)||index<0||!expense||expense.reconciliationId)throw Error('Select an unmatched expense and posted debit.');
 const id=reconciliationId(owner,item.source);
 const transactions=budget.transactions.map((row,i)=>i===index?{...row,reconciliationId:id}:row);
 const receipt={id,owner_id:owner,section:'Finances',item_type:reconciliationType,origin:'PRIVATE_MANUAL_FINANCE',visibility:'private',household_id:null,
  payload:{ownerId:owner,version:1,fictional:true,period,budgetId:budgetRow.id,source:item.source,expense:{day:expense.day,amountMinor:expense.amountMinor,label:expense.label??''}}};
 const details=validateExpenseReconciliation({...receipt,version:1,deleted_at:null},owner);
 return {receipt,budget:{...budgetRow,payload:{...budgetRow.payload,budget:{...budget,transactions}}},details};
}
