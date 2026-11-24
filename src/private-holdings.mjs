import {validDay} from './dev-brief-model.mjs';

const scale=1000000n;
const keys=(v,fields)=>v&&Object.keys(v).sort().join(',')===fields;
const nonnegative=n=>Number.isSafeInteger(n)&&n>=0;
const name=s=>typeof s==='string'&&s.length>0&&s.length<=100&&s===s.trim()&&!/[\u0000-\u001f\u007f]/.test(s);
const day=s=>typeof s==='string'&&validDay(s);
const cents=n=>{const value=Number(n);if(!Number.isSafeInteger(value))throw Error('Holding exceeds the supported precision.');return value;};
const round=value=>(value+scale/2n)/scale;
export const holdingActivityNames=Object.freeze({buy:'Purchase',sell:'Sale',dividend:'Cash dividend',reinvest:'Reinvested dividend'});
export function parseShares(text){
 if(typeof text!=='string'||!/^\d{1,10}(?:\.\d{1,6})?$/.test(text.trim()))throw Error('Enter shares with up to six decimal places.');
 const [whole,decimal='']=text.trim().split('.');
 return cents(BigInt(whole)*scale+BigInt(decimal.padEnd(6,'0')));
}
export function formatShares(units){
 if(!nonnegative(units))throw Error('Invalid share quantity.');
 return (BigInt(units)/scale).toString()+((BigInt(units)%scale).toString().padStart(6,'0').replace(/0+$/,'').replace(/^(\d+)$/,'.$1'));
}
export function holdingActivity(v){
 if(!keys(v,'amountMinor,day,kind,shareUnits')||!Object.hasOwn(holdingActivityNames,v.kind)||!day(v.day)||!nonnegative(v.amountMinor)||v.amountMinor===0||
    !nonnegative(v.shareUnits)||(v.kind==='dividend'?v.shareUnits!==0:v.shareUnits===0))throw Error('Enter the activity date, amount and share quantity.');
 return {kind:v.kind,day:v.day,amountMinor:v.amountMinor,shareUnits:v.shareUnits};
}
export function holdingInputs(v){
 if(!keys(v,'activities,annualDividendMinor,label,price')||!name(v.label)||!Array.isArray(v.activities)||v.activities.length>1000||
    v.annualDividendMinor!==null&&!nonnegative(v.annualDividendMinor))throw Error('Enter a valid manual holding.');
 let price=null;
 if(v.price!==null){
  if(!keys(v.price,'amountMinor,day')||!day(v.price.day)||!nonnegative(v.price.amountMinor))throw Error('Choose an as-of date for the manual price.');
  price={day:v.price.day,amountMinor:v.price.amountMinor};
 }
 return {label:v.label,price,annualDividendMinor:v.annualDividendMinor,activities:v.activities.map(holdingActivity)};
}
function sumActivities(activities,through){
 let shares=0n,purchases=0n,sales=0n,cash=0n,reinvested=0n;
 const ordered=activities.toSorted((a,b)=>a.day.localeCompare(b.day));
 for(const row of ordered){
  if(through&&row.day>through)break;
  const units=BigInt(row.shareUnits),amount=BigInt(row.amountMinor);
  switch(row.kind){
   case 'buy': shares+=units;purchases+=amount;break;
   case 'sell': shares-=units;sales+=amount;break;
   case 'dividend': cash+=amount;break;
   case 'reinvest': shares+=units;reinvested+=amount;break;
  }
  if(shares<0n)throw Error('A sale exceeds the shares held on that day.');
 }
 return {shares,purchases,sales,cash,reinvested};
}
export function holdingSummary(input){
 const h=holdingInputs(input),total=sumActivities(h.activities);
 const summary={shareUnits:cents(total.shares),cashDividendsMinor:cents(total.cash),reinvestedDividendsMinor:cents(total.reinvested),
  estimatedAnnualDividendMinor:h.annualDividendMinor===null?null:cents(round(total.shares*BigInt(h.annualDividendMinor))),valuation:null};
 if(h.price){
  const at=sumActivities(h.activities,h.price.day),value=round(at.shares*BigInt(h.price.amountMinor));
  // Reinvestments already contribute shares to value. Only cash dividends count as cash returned.
  summary.valuation={asOf:h.price.day,shareUnits:cents(at.shares),marketValueMinor:cents(value),purchaseOutlayMinor:cents(at.purchases),
   saleProceedsMinor:cents(at.sales),cashDividendsMinor:cents(at.cash),gainMinor:cents(value+at.sales+at.cash-at.purchases)};
 }
 return summary;
}
