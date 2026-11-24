import {validDay as civilDay} from './dev-brief-model.mjs';

export const INCOME_CADENCES=Object.freeze(['weekly','biweekly','semi_monthly','monthly','custom']);
const exact=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===fields.slice().sort().join(',');
const amount=value=>Number.isSafeInteger(value)&&value>=0;
const validDay=value=>typeof value==='string'&&civilDay(value);
const dayMs=86400000;
const utc=day=>Date.parse(day+'T00:00:00Z');
const asDay=ms=>new Date(ms).toISOString().slice(0,10);

export function manualIncomeSchedule(value){
 const keys=['label','cadence','startDay','endDay','expectedNetMinor','monthDays','customDates'];
 if(!exact(value,keys)||typeof value.label!=='string'||!value.label||value.label!==value.label.trim()||
    value.label.length>100||/[\u0000-\u001f\u007f]/.test(value.label)||!INCOME_CADENCES.includes(value.cadence)||
    !validDay(value.startDay)||!(value.endDay===''||validDay(value.endDay)&&value.endDay>=value.startDay)||
    !amount(value.expectedNetMinor)||!Array.isArray(value.monthDays)||!Array.isArray(value.customDates))
  throw Error('Complete the income schedule.');
 const {cadence,startDay,endDay,monthDays,customDates}=value;
 if(cadence==='semi_monthly'){
  if(monthDays.length!==2||monthDays.some(n=>!Number.isInteger(n)||n<1||n>31)||monthDays[0]>=monthDays[1])
   throw Error('Choose two different monthly pay days in ascending order.');
 }else if(monthDays.length)throw Error('Two pay days apply only to semi-monthly schedules.');
 if(cadence==='custom'){
  if(!customDates.length||customDates.length>366||customDates.some((d,i)=>!validDay(d)||d<startDay||endDay&&d>endDay||i>0&&d<=customDates[i-1]))
   throw Error('Enter unique custom pay dates in date order, within the schedule.');
 }else if(customDates.length)throw Error('Extra pay dates apply only to a custom schedule.');
 return {label:value.label,cadence,startDay,endDay,expectedNetMinor:value.expectedNetMinor,monthDays:[...monthDays],customDates:[...customDates]};
}

export function scheduledIncomeOccurrences(input,from,to){
 const schedule=manualIncomeSchedule(input);
 if(!validDay(from)||!validDay(to)||from>to||utc(to)-utc(from)>366*dayMs)throw Error('Choose a period of up to one year.');
 const first=from>schedule.startDay?from:schedule.startDay,last=schedule.endDay&&schedule.endDay<to?schedule.endDay:to;
 if(first>last)return [];
 if(schedule.cadence==='custom')return schedule.customDates.filter(d=>d>=first&&d<=last).map(expectedDay=>({expectedDay,slot:1}));
 const days=[];
 if(['weekly','biweekly'].includes(schedule.cadence)){
  const step=(schedule.cadence==='weekly'?7:14)*dayMs,anchor=utc(schedule.startDay);
  for(let at=anchor+Math.ceil((utc(first)-anchor)/step)*step;at<=utc(last);at+=step)days.push({expectedDay:asDay(at),slot:1});
 }else{
  const [year,month]=first.split('-').map(Number);
  const monthDays=schedule.cadence==='monthly'?[Number(schedule.startDay.slice(-2))]:schedule.monthDays;
  for(let at=Date.UTC(year,month-1,1);at<=utc(last);){
   const d=new Date(at),end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0));
   for(const [index,n] of monthDays.entries()){
    const payDay=asDay(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),Math.min(n,end.getUTCDate())));
    if(payDay>=first&&payDay<=last)days.push({expectedDay:payDay,slot:index+1});
   }
   at=end.getTime()+dayMs;
  }
 }
 return days;
}

export function manualIncomePayment(value){
 if(!exact(value,['expectedDay','slot','receivedDay','expectedNetMinor','netMinor','paystub'])||!validDay(value.expectedDay)||
    ![1,2].includes(value.slot)||!validDay(value.receivedDay)||!amount(value.expectedNetMinor)||!amount(value.netMinor))
  throw Error('Complete the expected payday, actual receipt date and net amounts.');
 let paystub=null;
 if(value.paystub!==null){
  const p=value.paystub;
  if(!exact(p,['grossMinor','taxMinor','otherDeductionsMinor'])||!Object.values(p).every(amount)||
    BigInt(p.grossMinor)-BigInt(p.taxMinor)-BigInt(p.otherDeductionsMinor)!==BigInt(value.netMinor))
   throw Error('Gross pay minus taxes and other deductions must equal net pay.');
  paystub={grossMinor:p.grossMinor,taxMinor:p.taxMinor,otherDeductionsMinor:p.otherDeductionsMinor};
 }
 return {expectedDay:value.expectedDay,slot:value.slot,receivedDay:value.receivedDay,expectedNetMinor:value.expectedNetMinor,netMinor:value.netMinor,paystub};
}

// A recorded receipt keeps its reviewed expectation even when the schedule changes later.
export function manualIncomeForPeriod(input,receipts,from,to){
 const schedule=manualIncomeSchedule(input),days=scheduledIncomeOccurrences(schedule,from,to);
 if(!Array.isArray(receipts))throw Error('Income receipts required.');
 const occurrenceKey=({expectedDay,slot})=>expectedDay+'#'+slot;
 const occurrences=new Map(days.map(d=>[occurrenceKey(d),d])),paid=new Map();
 let actual=0n,expected=0n;
 for(const entry of receipts){
  const payment=manualIncomePayment(entry);
  const key=occurrenceKey(payment);
  if(paid.has(key))throw Error('A scheduled paycheck may have only one saved receipt.');
  paid.set(key,payment);
  if(payment.receivedDay>=from&&payment.receivedDay<=to)actual+=BigInt(payment.netMinor);
  if(payment.expectedDay>=from&&payment.expectedDay<=to&&!occurrences.has(key))occurrences.set(key,{expectedDay:payment.expectedDay,slot:payment.slot});
 }
 const payments=[...occurrences.values()].sort((a,b)=>a.expectedDay.localeCompare(b.expectedDay)||a.slot-b.slot).map(({expectedDay,slot})=>{
  const receipt=paid.get(occurrenceKey({expectedDay,slot}))??null,expectedNetMinor=receipt?.expectedNetMinor??schedule.expectedNetMinor;
  expected+=BigInt(expectedNetMinor);
  return {expectedDay,slot,expectedNetMinor,receipt};
 });
 const expectedNetMinor=Number(expected),receivedNetMinor=Number(actual);
 if(!Number.isSafeInteger(expectedNetMinor)||!Number.isSafeInteger(receivedNetMinor))throw Error('Income exceeds the supported amount.');
 return {from,to,expectedNetMinor,receivedNetMinor,differenceMinor:Number(actual-expected),payments};
}
