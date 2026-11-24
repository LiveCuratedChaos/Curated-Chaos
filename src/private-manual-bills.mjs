import {validDay} from './dev-brief-model.mjs';
import {recurrenceDatesInRange} from './task-recurrence.mjs';

const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys;
const date=value=>typeof value==='string'&&validDay(value);
const money=value=>Number.isSafeInteger(value)&&value>=0;
export const BILL_FREQUENCIES=Object.freeze(['once','weekly','monthly','yearly']);
export function manualBill(value){
 if(!exact(value,'amountMinor,dueDay,endDay,estimated,frequency,interval,label')||typeof value.label!=='string'||
    value.label!==value.label.trim()||!value.label||value.label.length>120||/[\u0000-\u001f\u007f]/.test(value.label)||
    !money(value.amountMinor)||typeof value.estimated!=='boolean'||!date(value.dueDay)||!BILL_FREQUENCIES.includes(value.frequency)||
    !Number.isInteger(value.interval)||value.interval<1||value.interval>365||
    !(value.endDay===''||date(value.endDay)&&value.endDay>=value.dueDay)||
    value.frequency==='once'&&(value.interval!==1||value.endDay!==''))throw Error('Enter a bill name, valid dates, amount and frequency.');
 const {label,dueDay,frequency,interval,endDay,estimated,amountMinor}=value;
 return {label,dueDay,frequency,interval,endDay,estimated,amountMinor};
}

export function billDueDates(input,from,to){
 const bill=manualBill(input);
 if(!date(from)||!date(to)||from>to||Date.parse(to)-Date.parse(from)>366*86400000)throw Error('Choose up to one year of bill dates.');
 const last=bill.endDay&&bill.endDay<to?bill.endDay:to;
 if(from>last||bill.dueDay>last)return [];
 if(bill.frequency==='once')return bill.dueDay>=from?[bill.dueDay]:[];
 return recurrenceDatesInRange({anchorDay:bill.dueDay,frequency:bill.frequency,interval:bill.interval},from,last);
}

export function billConfirmation(value){
 if(!exact(value,'amountMinor,dueDay,estimated,expectedMinor,label,paidDay,source')||!date(value.dueDay)||!date(value.paidDay)||
    !money(value.amountMinor)||!money(value.expectedMinor)||typeof value.estimated!=='boolean'||typeof value.label!=='string'||
    !value.label||value.label.trim()!==value.label||value.label.length>120||/[\u0000-\u001f\u007f]/.test(value.label)||
    !['manual','saved_transaction'].includes(value.source))throw Error('Complete bill confirmation required.');
 const {label,dueDay,paidDay,amountMinor,expectedMinor,estimated,source}=value;
 return {label,dueDay,paidDay,amountMinor,expectedMinor,estimated,source};
}

export function billOccurrences(bill,confirmations,from,to,today){
 if(!date(today)||!Array.isArray(confirmations))throw Error('Current bill confirmation dates required.');
 const records=new Map(billDueDates(bill,from,to).map(dueDay=>[dueDay,{label:bill.label,dueDay,expectedMinor:bill.amountMinor,
  estimated:bill.estimated,status:dueDay<today?'Overdue':'Due',payment:null}]));
 for(const input of confirmations){
  const p=billConfirmation(input);
  if(p.dueDay<from||p.dueDay>to||p.paidDay>today||records.get(p.dueDay)?.payment)throw Error('Invalid payment history for this period.');
  records.set(p.dueDay,{label:p.label,dueDay:p.dueDay,expectedMinor:p.expectedMinor,estimated:p.estimated,status:'Paid',payment:p});
 }
 return [...records.values()].sort((a,b)=>a.dueDay.localeCompare(b.dueDay));
}
