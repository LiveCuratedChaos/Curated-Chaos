import {randomBytes} from 'node:crypto';
import {briefDateRange} from '../src/private-brief-dates.mjs';
import {validDay} from '../src/dev-brief-model.mjs';
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
async function scheduleForBill(api,{accessToken,ownerId},row,bill,from,to,today){
 const history=inventory(await api.listBillConfirmations(accessToken,ownerId,row.id,from,to),367);
 const payments=history.map(h=>{
  if(h.item_type!==confirmationType||h.payload?.billId!==row.id)throw Error('Incorrect bill confirmation.');
  return validateBillRow(h,ownerId);
 });
 return billOccurrences(bill,payments,from,to,today);
}
async function scheduledBills(api,{accessToken,ownerId},from,to,today){
 const records=inventory(await api.listBills(accessToken,ownerId),100),occurrences=[];
 for(const row of records){
  if(row.item_type!==billType)throw Error('Invalid bill.');
  const bill=validateBillRow(row,ownerId);
  const due=await scheduleForBill(api,{accessToken,ownerId},row,bill,from,to,today);
  for(const occurrence of due)occurrences.push({row,occurrence});
 }
 return occurrences;
}
export async function readBriefBillWeek({api,actor,fields,now,expiresAt}){
 const range=briefDateRange(fields.anchor,fields);
 const currentDay=newYorkTaskDay(now);
 const days=range.days.map(day=>({day,paid:0,unpaid:0}));
 const byDay=new Map(days.map(entry=>[entry.day,entry]));
 const occurrences=await scheduledBills(api,actor,range.from,range.to,currentDay);
 for(const {occurrence} of occurrences){
  const entry=byDay.get(occurrence.dueDay);
  if(occurrence.status==='Paid')entry.paid++;
  else entry.unpaid++;
 }
 return {currentDay,days,expiresAt:Math.min(expiresAt,now+300000)};
}
export async function readBriefBills({api,actor,day,now,expiresAt,sourceFor=null,offset=0,checkInventory=null}){
 if(typeof day!=='string'||!validDay(day))throw Error('Choose a valid Brief date.');
 const currentDay=newYorkTaskDay(now);
 const due=await scheduledBills(api,actor,day,day,currentDay);
 due.sort((a,b)=>a.occurrence.label.localeCompare(b.occurrence.label)||a.occurrence.status.localeCompare(b.occurrence.status)||a.row.id.localeCompare(b.row.id));
 if(offset>0&&offset>=due.length)throw Error('Bill page is unavailable.');
 if(checkInventory)checkInventory(due.map(({row,occurrence})=>[row.id,row.version,occurrence.label,occurrence.status]));
 const rows=due.slice(offset,offset+10).map(({row,occurrence})=>({label:occurrence.label,status:occurrence.status,...(sourceFor?{billReadToken:sourceFor(row,occurrence)}:{})}));
 return {day,currentDay,total:due.length,rows,expiresAt:Math.min(expiresAt,now+300000)};
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
  const due=await scheduledBills(api,actor,first,period.periodEnd,day);
  for(const {occurrence} of due){
   const p=occurrence.payment;
   rows.push(item(occurrence.label+' · '+occurrence.status+(occurrence.estimated&&!p?' (estimate)':''),occurrence.dueDay,
    p?.amountMinor??occurrence.expectedMinor,percent(p?.amountMinor??0,occurrence.expectedMinor)));
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date)||a.label.localeCompare(b.label));
 }else throw Error('Unknown financial widget.');
 return {type,month:first.slice(0,7),total:rows.length,rows:rows.slice(0,options.limit),expiresAt:Math.min(expiresAt,now+300000)};
}

// Selections from the Brief are independent of the original bill editor and payment approvals.
export function createBriefBillSources({api,now=Date.now}){
 const views=new Map();
 function clear(id){clearTimeout(views.get(id)?.timer);views.delete(id);}
 const active=(id,view)=>views.get(id)===view&&view.expiresAt>now();
 async function list(id,actor,day,expiresAt,page=null){
  const offset=page?.offset??0;
  if(!Number.isInteger(offset)||offset<0||offset>90||offset%10||page&&Object.keys(page).some(k=>!['offset','viewToken'].includes(k)))throw Error('Invalid bill page.');
  const resume=page&&Object.hasOwn(page,'viewToken');
  let view;
  if(resume){
   view=views.get(id);
   if(!view||view.owner!==actor.ownerId||view.day!==day||!active(id,view)||view.viewToken!==page.viewToken||!view.viewToken)throw Error('Refresh the bill schedule.');
  }else{
   if(offset!==0)throw Error('Open the first bill page.');
   clear(id);
   view={owner:actor.ownerId,day,expiresAt:Math.min(expiresAt,now()+300000),choices:new Map(),viewToken:page?randomBytes(32).toString('base64url'):null};
   views.set(id,view);
   view.timer=setTimeout(()=>{if(views.get(id)===view)clear(id);},Math.max(0,view.expiresAt-now()));view.timer.unref?.();
  }
  const choices=new Map();
  try{
   const result=await readBriefBills({api,actor,day,now:now(),expiresAt:view.expiresAt,offset,
    checkInventory:page?rows=>{
     const snapshot=JSON.stringify(rows);
     if(resume&&snapshot!==view.snapshot)throw Error('The bill schedule changed.');
     view.snapshot=snapshot;
    }:null,
    sourceFor(row,occurrence){
     const token=randomBytes(32).toString('base64url');
     choices.set(token,{id:row.id,version:row.version,label:occurrence.label,status:occurrence.status});
     return token;
    }});
   if(!active(id,view)||resume&&view.currentDay!==result.currentDay)throw Error('Bill lookup expired.');
   view.choices=choices;view.currentDay=result.currentDay;
   return page?{...result,offset,viewToken:view.viewToken}:result;
  }catch(error){if(views.get(id)===view)clear(id);throw error;}
 }
 async function read(id,actor,token){
  const view=views.get(id),choice=view?.choices.get(token);
  if(!choice||view.owner!==actor.ownerId||!active(id,view))throw Error('Refresh the bill schedule.');
  const rows=inventory(await api.getBillRecord(actor.accessToken,actor.ownerId,billType,choice.id),1),row=rows[0];
  if(!active(id,view)||row?.id!==choice.id||row.version!==choice.version||row.item_type!==billType)throw Error('Bill changed.');
  const bill=validateBillRow(row,actor.ownerId),today=newYorkTaskDay(now());
  const [occurrence]=await scheduleForBill(api,actor,row,bill,view.day,view.day,today);
  if(!active(id,view)||!occurrence||occurrence.label!==choice.label||occurrence.status!==choice.status)throw Error('Bill occurrence changed.');
  return {day:view.day,label:occurrence.label,status:occurrence.status,scheduleLabel:bill.label,firstDueDay:bill.dueDay,endDay:bill.endDay,frequency:bill.frequency,interval:bill.interval,paidDay:occurrence.payment?.paidDay??'',expiresAt:view.expiresAt};
 }
 return {list,read,clear,dispose(){for(const id of views.keys())clear(id);}};
}
