import {newYorkTaskDay} from '../src/private-smart-task.mjs';
import {calculateManualBudget} from '../src/private-finance-manual.mjs';
import {holdingSummary} from '../src/private-holdings.mjs';
import {billOccurrences} from '../src/private-manual-bills.mjs';
import {manualBudgetId,validateBudgetRow} from './private-budget-period.mjs';
import {validateHoldingRow} from './private-holding-record.mjs';
import {billType,confirmationType,validateBillRow} from './private-bill-records.mjs';

function inventory(rows,limit){
 if(!Array.isArray(rows)||rows.length>limit||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Incomplete financial inventory.');
 return rows;
}
const percent=(value,base)=>base>0?Math.round((value/base)*1000)/10:null;
export async function readFinanceWidget({api,actor,type,options,now,expiresAt}){
 if(Object.keys(options).sort().join(',')!=='limit,showAmounts,showPercentages'||typeof options.showAmounts!=='boolean'||
 typeof options.showPercentages!=='boolean'||![2,4,6,10].includes(options.limit))throw Error('Choose supported financial widget settings.');
 const {accessToken,ownerId}=actor,day=newYorkTaskDay(now),first=day.slice(0,7)+'-01',end=new Date(first+'T00:00:00Z');
 end.setUTCMonth(end.getUTCMonth()+1,0);
 const period={period:'month',periodStart:first,periodEnd:end.toISOString().slice(0,10)};
 function item(label,date,amount,percentage){return {label,date,...(options.showAmounts?{amount}:{}),...(options.showPercentages?{percentage}:{})};}
 let rows=[];
 if(type==='budget'){
  const id=manualBudgetId(ownerId,period),records=inventory(await api.getManualBudget(accessToken,id,ownerId),1);
  if(records.length){
   if(records[0].id!==id)throw Error('Budget selection changed.');
   const b=calculateManualBudget(validateBudgetRow(records[0],ownerId));
   rows=[item('Recorded expenses',first,b.totalActualMinor,percent(b.totalActualMinor,b.plannedIncomeMinor)),item('Left to spend',first,b.remainingToSpendMinor,percent(b.remainingToSpendMinor,b.plannedIncomeMinor))];
  }
 }else if(type==='investments'){
  const holdings=inventory(await api.listHoldings(accessToken,ownerId),100);
  rows=holdings.map(row=>{
   const h=validateHoldingRow(row,ownerId),v=holdingSummary(h).valuation;
   return item(h.label,v?.asOf??null,v?.marketValueMinor??null,v?percent(v.gainMinor,v.purchaseOutlayMinor):null);
  }).sort((a,b)=>a.label.localeCompare(b.label));
 }else if(type==='bills'){
  const bills=inventory(await api.listBills(accessToken,ownerId),100);
  for(const row of bills){
   if(row.item_type!==billType)throw Error('Invalid bill.');
   const bill=validateBillRow(row,ownerId);
   const history=inventory(await api.listBillConfirmations(accessToken,ownerId,row.id,first,period.periodEnd),367);
   const payments=history.map(h=>{
    if(h.item_type!==confirmationType||h.payload?.billId!==row.id)throw Error('Incorrect bill confirmation.');
    return validateBillRow(h,ownerId);
   });
   const due=billOccurrences(bill,payments,first,period.periodEnd,day);
   for(const occurrence of due){
    const p=occurrence.payment;
    rows.push(item(occurrence.label+' · '+occurrence.status+(occurrence.estimated&&!p?' (estimate)':''),occurrence.dueDay,
     p?.amountMinor??occurrence.expectedMinor,percent(p?.amountMinor??0,occurrence.expectedMinor)));
   }
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date)||a.label.localeCompare(b.label));
 }else throw Error('Unknown financial widget.');
 return {type,month:first.slice(0,7),total:rows.length,rows:rows.slice(0,options.limit),expiresAt:Math.min(expiresAt,now+300000)};
}
