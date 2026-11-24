import {calculateManualBudget,normalizeManualBudget} from './private-finance-manual.mjs';

// Exact proportional cents, with leftover cents assigned in descending remainder order.
// Ties retain the owner's category order. All products stay in integer arithmetic.
function distribute(total,weights){
 let values=weights.map(BigInt);
 if(values.every(n=>n===0n))values=values.map(()=>1n);
 const weight=values.reduce((sum,value)=>sum+value,0n);
 const parts=values.map((value,index)=>{
  const portion=BigInt(total)*value;
  return {index,cents:Number(portion/weight),remainder:portion%weight};
 });
 const ordered=[...parts].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1);
 const remaining=total-parts.reduce((sum,part)=>sum+part.cents,0);
 for(let i=0;i<remaining;i++)ordered[i].cents++;
 return parts.map(part=>part.cents);
}

export function manualBudgetProposals(input,reserveMinor){
 const original=normalizeManualBudget(input),income=original.plannedIncomeMinor;
 if(!original.allocations.length||!Number.isSafeInteger(reserveMinor)||reserveMinor<=0||reserveMinor>income)
  throw Error('Add a category and planned income, then choose a reserve above zero and within that income.');
 const planned=original.allocations.map(row=>row.plannedMinor);
 const actual=calculateManualBudget(original).categories.map(row=>row.actualMinor);
 const options=[];
 function add(id,label,available,weights,basis){
  const amounts=distribute(available,weights);
  if(options.some(p=>p.budget.allocations.every((row,i)=>row.plannedMinor===amounts[i])))return;
  const budget={...original,allocations:original.allocations.map((row,i)=>({...row,plannedMinor:amounts[i]}))};
  calculateManualBudget(budget);
  options.push({id,label,basis,unallocatedMinor:income-available,budget});
 }
 const basis=planned.some(n=>n>0)?'Uses your current category proportions.':'Divides the allocation evenly across your categories.';
 add('full','Allocate all planned income',income,planned,basis);
 add('reserve','Keep the selected reserve',income-reserveMinor,planned,basis);
 if(actual.some(n=>n>0))add('spending','Use recorded spending proportions',income-reserveMinor,actual,
  'Keeps the selected reserve and uses spending recorded in your allocated categories for this period.');
 return options;
}
