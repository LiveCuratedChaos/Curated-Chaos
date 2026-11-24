import {manualExpense} from './private-manual-transactions.mjs';
// Pure validation and integer-cent arithmetic for owner-private manual finance records.
// Persistence and release UI must still use the protected, reviewed finance routes.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text=(v,max)=>typeof v==='string'&&v===v.trim()&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const money=v=>Number.isSafeInteger(v);
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export const MANUAL_ACCOUNT_TYPES=Object.freeze(['checking','savings','cash','credit_card','loan','investment','other']);

// Account-list visibility and budget aggregation are deliberately independent.
export function normalizeManualFinanceAccount(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='balanceMinor,includeInBudget,label,showInAccountList,type'||!text(value.label,100)||!MANUAL_ACCOUNT_TYPES.includes(value.type)||!money(value.balanceMinor)||typeof value.showInAccountList!=='boolean'||typeof value.includeInBudget!=='boolean')throw Error('Complete supported manual account settings required.');
 return{label:value.label,type:value.type,balanceMinor:value.balanceMinor,showInAccountList:value.showInAccountList,includeInBudget:value.includeInBudget};
}

export function visibleManualAccounts(accounts){if(!Array.isArray(accounts)||accounts.length>100)throw Error('Bounded manual account list required.');return accounts.map(normalizeManualFinanceAccount).filter(account=>account.showInAccountList);}
function safeCents(value) {
 const amount=Number(value);
 if (!Number.isSafeInteger(amount)) throw Error('The total exceeds the supported range.');
 return amount;
}
export function includedManualBalance(accounts) {
 if (!Array.isArray(accounts)||accounts.length>100) throw Error('Bounded manual account list required.');
 let total=0n;
 for (const input of accounts) {
  const account=normalizeManualFinanceAccount(input);
  if (account.includeInBudget) total+=BigInt(account.balanceMinor);
 }
 return safeCents(total);
}

export function manualBudgetPeriod({period,periodStart,periodEnd}={}) {
 if (!['month','pay_period'].includes(period)||!day(periodStart)||!day(periodEnd)||periodStart>periodEnd)
  throw Error('Choose a valid budget period.');
 if (period==='month') {
  const first=new Date(periodStart+'T00:00:00Z'),end=new Date(first);
  end.setUTCMonth(end.getUTCMonth()+1,0);
  if (first.getUTCDate()!==1||end.toISOString().slice(0,10)!==periodEnd)
   throw Error('A monthly budget covers the first through the last day of one month.');
 }
 return {period,periodStart,periodEnd};
}

export function normalizeManualBudget(value) {
 if (!value||Object.keys(value).sort().join(',')!=='allocations,period,periodEnd,periodStart,plannedIncomeMinor,transactions'||
     !money(value.plannedIncomeMinor)||value.plannedIncomeMinor<0||!Array.isArray(value.allocations)||value.allocations.length>100||
     !Array.isArray(value.transactions)||value.transactions.length>1000) throw Error('Complete supported manual budget required.');
 const period=manualBudgetPeriod(value),seen=new Set();
 const allocations=value.allocations.map(a=>{
  if (!a||!text(a.category,80)||!money(a.plannedMinor)||a.plannedMinor<0||seen.has(a.category)||
      Object.keys(a).some(k=>!['category','plannedMinor','openingMinor','carrySurplus','carryDeficit'].includes(k))||
      ('openingMinor' in a&&!money(a.openingMinor))||['carrySurplus','carryDeficit'].some(k=>k in a&&typeof a[k]!=='boolean'))
   throw Error('Enter unique categories with valid allocations and rollover options.');
  seen.add(a.category);
  return {category:a.category,plannedMinor:a.plannedMinor,...(Object.hasOwn(a,'openingMinor')?{openingMinor:a.openingMinor}:{}),
   ...('carrySurplus' in a?{carrySurplus:a.carrySurplus}:{}),...('carryDeficit' in a?{carryDeficit:a.carryDeficit}:{})};
 });
 const transactions=value.transactions.map(t=>manualExpense(t,period.periodStart,period.periodEnd));
 return {...period,plannedIncomeMinor:value.plannedIncomeMinor,allocations,transactions};
}

export function calculateManualBudget(value) {
 const budget=normalizeManualBudget(value),amounts=new Map();
 let totalActual=0n,totalPlanned=0n,totalOpening=0n,allocatedActual=0n;
 for (const row of budget.transactions) {
  const amount=BigInt(row.amountMinor);
  totalActual+=amount;
  for(const part of row.splits??[row])amounts.set(part.category,(amounts.get(part.category)??0n)+BigInt(part.amountMinor));
 }
 const categories=budget.allocations.map(a=>{
  const opening=BigInt(a.openingMinor??0),planned=BigInt(a.plannedMinor),actual=amounts.get(a.category)??0n;
  totalOpening+=opening;totalPlanned+=planned;allocatedActual+=actual;
  const remainingMinor=safeCents(opening+planned-actual);
  return {category:a.category,plannedMinor:a.plannedMinor,actualMinor:safeCents(actual),remainingMinor,overspentMinor:Math.max(0,-remainingMinor)};
 });
 const income=BigInt(budget.plannedIncomeMinor),unallocatedMinor=safeCents(income-totalPlanned);
 return {period:budget.period,periodStart:budget.periodStart,periodEnd:budget.periodEnd,plannedIncomeMinor:budget.plannedIncomeMinor,
  plannedAllocationsMinor:safeCents(totalPlanned),unallocatedMinor,zeroBased:unallocatedMinor===0,categories,
  unallocatedActualMinor:safeCents(totalActual-allocatedActual),totalActualMinor:safeCents(totalActual),
  remainingToSpendMinor:safeCents(income+totalOpening-totalActual)};
}

export function nextManualBudget(previous,period) {
 const source=normalizeManualBudget(previous),next=manualBudgetPeriod(period);
 const following=new Date(source.periodEnd+'T00:00:00Z');following.setUTCDate(following.getUTCDate()+1);
 if (next.period!==source.period||next.periodStart!==following.toISOString().slice(0,10))
  throw Error('Choose the immediately following budget period.');
 const balances=calculateManualBudget(source).categories;
 return {...next,plannedIncomeMinor:source.plannedIncomeMinor,transactions:[],
  allocations:source.allocations.map((a,index)=>{
   const balance=balances[index].remainingMinor;
   const carry=balance>0?a.carrySurplus:a.carryDeficit;
   return {...a,openingMinor:carry?balance:0};
  })};
}

export function validateManualFinanceEnvelope(row,ownerId){if(!UUID.test(ownerId||'')||row?.owner_id!==ownerId||row.household_id!==null||row.visibility!=='private'||row.section!=='Finances'||row.item_type!=='manual_finance_account'||row.origin!=='PRIVATE_MANUAL_FINANCE'||row.deleted_at!==null||!Number.isInteger(row.version)||row.version<1||!row.payload||Object.keys(row.payload).sort().join(',')!=='account,fictional,ownerId,version'||row.payload.fictional!==true||row.payload.ownerId!==ownerId||row.payload.version!==1)throw Error('Owner-private manual finance record required.');return normalizeManualFinanceAccount(row.payload.account);}

export function parseManualAmount(value) {
 const match = /^(-?)(\d{1,14})(?:\.(\d{1,2}))?$/.exec(value.trim());
 if (!match) throw Error('Enter a dollar amount with up to two decimal places.');
 const minor = Number(BigInt(match[1]+(match[2]+(match[3]||'').padEnd(2,'0'))));
 if (!Number.isSafeInteger(minor)) throw Error('The balance exceeds the supported range.');
 return minor;
}
