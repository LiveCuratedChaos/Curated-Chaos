import {verifyReceiptPicker,renderReceiptPicker} from './private-receipt-picker.mjs';
import {downloadCheckedDocument} from './private-document-panel.mjs';
import {manualBudgetProposals} from './private-budget-proposals.mjs';
import {manualExpense} from './private-manual-transactions.mjs';
import {escapeHtml as esc} from './core.mjs';
import {manualBudgetMonth,manualBudgetPeriod,normalizeManualBudget,calculateManualBudget,parseManualAmount} from './private-finance-manual.mjs';
import {savedAccountAmount as dollars} from './private-saved-finance-panel.mjs';
import {newYorkTaskDay} from './private-smart-task.mjs';

const button=(action,label)=>'<button type="button" class="btn" data-budget-action="'+action+'">'+esc(label)+'</button>';
const field=(label,name,value,type='text',readOnly=false)=>'<label>'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" required '+(readOnly?'readonly':'')+'></label>';
const optionalField=(label,name,value)=>'<label>'+esc(label)+'<input name="'+name+'" value="'+esc(value)+'"></label>';
const check=(label,name,value)=>'<label><input type="checkbox" name="'+name+'" '+(value?'checked':'')+'>'+esc(label)+'</label>';
const monthName=new Intl.DateTimeFormat('en-US',{month:'long',timeZone:'UTC'});
const decimal=value=>dollars(value).replace(/[$,]/g,'');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const periodKey=period=>[period.period,period.periodStart,period.periodEnd].join('_');
const samePeriod=(a,b)=>a.period===b.period&&a.periodStart===b.periodStart&&a.periodEnd===b.periodEnd;
const keys=(value,expected)=>value&&Object.keys(value).sort().join(',')===expected;
const empty=period=>({...period,plannedIncomeMinor:0,allocations:[],transactions:[]});
function editableExpense(t){
 return {category:t.category,day:t.day,receiptFile:t.receiptFile,reconciliationId:t.reconciliationId,amount:t.amountMinor===null?'':decimal(t.amountMinor),label:t.label??'',receiptReference:t.receiptReference??'',
  splits:(t.splits??[]).map(p=>({category:p.category,amount:decimal(p.amountMinor)}))};
}
function expenseFields(t,period){
 return manualExpense({...(t.receiptFile?{receiptFile:t.receiptFile}:{}),...(t.reconciliationId?{reconciliationId:t.reconciliationId}:{}),category:t.splits.length?'':t.category.trim(),day:t.day,amountMinor:parseManualAmount(t.amount),
  ...(t.label.trim()?{label:t.label.trim()}:{}),...(t.receiptReference.trim()?{receiptReference:t.receiptReference.trim()}:{}),
  ...(t.splits.length?{splits:t.splits.map(p=>({category:p.category.trim(),amountMinor:parseManualAmount(p.amount)}))}:{})},period.periodStart,period.periodEnd);
}
function editable(budget){
 return {income:decimal(budget.plannedIncomeMinor),categories:budget.allocations.map(a=>({
  category:a.category,allocation:decimal(a.plannedMinor),opening:decimal(a.openingMinor??0),
  carrySurplus:a.carrySurplus??false,carryDeficit:a.carryDeficit??false})),expenses:budget.transactions.map(editableExpense)};
}
function fields(draft,period){
 return normalizeManualBudget({...period,plannedIncomeMinor:parseManualAmount(draft.income),
  allocations:draft.categories.map(a=>({category:a.category.trim(),plannedMinor:parseManualAmount(a.allocation),openingMinor:parseManualAmount(a.opening),carrySurplus:a.carrySurplus,carryDeficit:a.carryDeficit})),
  transactions:draft.expenses.map(t=>expenseFields(t,period))});
}
function summary(budget,show,reviewing=false){
 const result=calculateManualBudget(budget),amount=v=>show?esc(dollars(v)):'Hidden';
 return '<dl><dt>Planned income</dt><dd>'+amount(budget.plannedIncomeMinor)+'</dd><dt>Left to budget</dt><dd>'+amount(result.unallocatedMinor)+'</dd>'+
 '<dt>Recorded expenses</dt><dd>'+amount(result.totalActualMinor)+'</dd><dt>Left to spend, including opening balances</dt><dd>'+amount(result.remainingToSpendMinor)+'</dd></dl>'+
 (result.categories.length?'<table><caption>Category balances</caption><thead><tr><th>Category</th><th>Opening</th><th>Allocated</th><th>Spent</th><th>Remaining</th><th>Carry forward</th></tr></thead><tbody>'+
  result.categories.map((r,i)=>{const a=budget.allocations[i];return '<tr><th>'+esc(r.category)+'</th><td>'+amount(a.openingMinor??0)+'</td><td>'+amount(a.plannedMinor)+'</td><td>'+amount(r.actualMinor)+'</td><td>'+amount(r.remainingMinor)+'</td><td>'+([a.carrySurplus?'surplus':'',a.carryDeficit?'overspending':''].filter(Boolean).join(' and ')||'Neither')+'</td></tr>';}).join('')+'</tbody></table>':'')+
 (budget.transactions.length?'<table><caption>Recorded expenses</caption><thead><tr><th>Date</th><th>Category</th><th>Amount</th></tr></thead><tbody>'+
 budget.transactions.map(t=>'<tr><td>'+esc(t.day)+'</td><td>'+(t.splits?t.splits.map(p=>esc(p.category)+' '+amount(p.amountMinor)).join('<br>'):esc(t.category))+
 (t.label?'<br>'+esc(t.label):'')+(reviewing&&t.receiptReference?'<br>Receipt reference · '+esc(t.receiptReference):'')+'</td><td>'+amount(t.amountMinor)+'</td></tr>').join('')+'</tbody></table><p>Expenses outside allocated categories · '+amount(result.unallocatedActualMinor)+'</p>':'');
}
function expenseForm(t,i,allowRemove){
 let html='';
    const prefix='expense-'+i+'-';
    html+='<fieldset><legend>Expense '+(i+1)+'</legend>'+optionalField('Description (optional)',prefix+'label',t.label)+field('Date',prefix+'day',t.day,'date',Boolean(t.reconciliationId))+
     field('Total amount',prefix+'amount',t.amount,'text',Boolean(t.reconciliationId))+optionalField('Receipt reference (optional)',prefix+'receiptReference',t.receiptReference);
    if(!t.splits.length)html+=field('Category',prefix+'category',t.category)+button('split-'+i,'Split expense');
    else {
     t.splits.forEach((part,j)=>{
      const name='part-'+i+'-'+j+'-';
      html+='<fieldset><legend>Split '+(j+1)+'</legend>'+field('Category',name+'category',part.category)+field('Split amount',name+'amount',part.amount)+
       (t.splits.length>2?button('remove-part-'+i+'-'+j,'Remove split'):'')+'</fieldset>';
     });
     if(t.splits.length<20)html+=button('add-part-'+i,'Add split');
     html+=button('unsplit-'+i,'Use one category');
    }
 return html+(t.receiptFile?'<p>Receipt file attached. Manage the link in transaction history.</p>':'')+(t.reconciliationId?'<p>Matched to a saved debit. The recorded amount and date are preserved.</p>':allowRemove&&!t.receiptFile?button('remove-expense-'+i,'Remove expense'):'')+'</fieldset>';
}

function transactionRows(transactions,shown,selectable=true,receipts=false){
 const amount=v=>shown?esc(dollars(v)):'Hidden';
 if(!transactions.length)return '<p>No recorded transactions for this period.</p>';
 const rows=transactions.map((expense,index)=>({expense,index})).sort((a,b)=>b.expense.day.localeCompare(a.expense.day)||a.index-b.index);
 return '<table><caption>Transaction history</caption><thead><tr><th>Date</th><th>Expense</th><th>Amount</th>'+(selectable?'<th>Details</th>':'')+'</tr></thead><tbody>'+
  rows.map(({expense:t,index})=>'<tr><td>'+esc(t.day)+'</td><td>'+(t.label?esc(t.label)+'<br>':'')+(t.reconciliationId?'Matched saved debit<br>':'')+
   (t.splits?t.splits.map(part=>esc(part.category)+' '+amount(part.amountMinor)).join('<br>'):esc(t.category))+
   '</td><td>'+amount(t.amountMinor)+'</td>'+(selectable?'<td>'+button('transaction-'+index,'Open transaction')+(receipts?button('receipt-at-'+index,t.receiptFile?'Manage receipt file':'Attach receipt file'):'')+'</td>':'')+'</tr>').join('')+'</tbody></table>';
}
export function createManualBudgetPanel({client,allowIncome=false,allowPlanner=false,allowDocuments=false,canDownload=()=>true,download,clock=Date.now,onChange=()=>{},canOpen=()=>true}){
 let transactionsOnly=false,expenseIndex=null,planner=null,receipt=null,periodTrail=[];
 let period,view,directory,draft,review,cash,priorStart,notice,busy,shown,timer,sequence=0;
 function reset(){
  sequence++;clearTimeout(timer);period=manualBudgetMonth(newYorkTaskDay(clock()));view=directory=draft=review=cash=null;
  priorStart='';notice='';busy=false;shown=false;transactionsOnly=false;expenseIndex=null;planner=null;receipt=null;periodTrail=[];
 }
 reset();
 function fresh(){return view&&view.expiresAt>clock();}
 function expired(){return Boolean((view&&!fresh())||(directory&&directory.expiresAt<=clock()));}
 function resetExpiredChooser(){const selection=period;reset();period=selection;}
 function expire(){reset();notice='The budget view expired. Open the period again.';onChange();}
 async function findPeriods(selection,kind,trail=[null]){
  const before=trail.at(-1)??undefined;
  reset();period=selection;const run=sequence;busy=true;onChange();
  try{
   const year=Number(selection.periodStart.slice(0,4));
   const result=kind==='months'?await client.manualBudgetMonths(year):await client.manualBudgetPeriods(before);
   if(run!==sequence)return;
   if(!Number.isFinite(result?.expiresAt)||result.expiresAt<=clock()||result.expiresAt>clock()+300000)throw Error();
   if(kind==='months'){
    if(!keys(result,'expiresAt,months,year')||result.year!==year||!Array.isArray(result.months)||result.months.length>12||
       result.months.some((month,index)=>!Number.isInteger(month)||month<1||month>12||index>0&&month>=result.months[index-1]))throw Error();
   }else{
    if(!keys(result,'expiresAt,hasMore,periods')||!Array.isArray(result.periods)||result.periods.length>10||
       typeof result.hasMore!=='boolean'||result.hasMore&&result.periods.length!==10)throw Error();
    const seen=new Set(before?[periodKey(before)]:[]);
    for(const entry of result.periods){
     if(!keys(entry,'period,periodEnd,periodStart'))throw Error();
     const key=periodKey(manualBudgetPeriod(entry));
     if(seen.has(key))throw Error();
     seen.add(key);
    }
   }
   directory=result;periodTrail=trail;
   timer=setTimeout(expire,Math.max(1,result.expiresAt-clock()));timer.unref?.();
  }catch{if(run===sequence)notice=kind==='months'?'Could not verify the saved months for this year.':'Could not verify the saved budget periods.';}
  finally{if(run===sequence){busy=false;onChange();}}
 }
 async function open(selection,history=false){
  reset();transactionsOnly=history;period=selection;const run=sequence;busy=true;onChange();
  try {
   const v=await client.manualBudgetOpen(selection);
   if(run!==sequence)return;
   if(!keys(v,'budget,expiresAt,period,version')||!samePeriod(v.period,selection)||!Number.isSafeInteger(v.version)||v.version<0||
      !Number.isFinite(v.expiresAt)||v.expiresAt<=clock()||v.expiresAt>clock()+300000||
      (v.version===0)!==(v.budget===null)||v.budget&&!samePeriod(normalizeManualBudget(v.budget),selection))throw Error();
   if(v.budget)calculateManualBudget(v.budget);
   view=v;timer=setTimeout(expire,Math.max(1,v.expiresAt-clock()));timer.unref?.();
  }catch{if(run===sequence)notice='Could not open this budget period.';}
  finally{if(run===sequence){busy=false;onChange();}}
 }
 async function prepare(carry,option=null){
  const run=sequence;busy=true;notice='';onChange();
  try{
   let proposal,source,expense;
   if(carry){
    const end=new Date(period.periodStart+'T00:00:00Z');end.setUTCDate(end.getUTCDate()-1);
    const last=end.toISOString().slice(0,10);
    source=period.period==='month'?manualBudgetMonth(last):manualBudgetPeriod({period:'pay_period',periodStart:priorStart,periodEnd:last});
   }else if(option){proposal=option.budget;}else if(transactionsOnly){
    expense=expenseFields(draft.expenses[0],period);
    const original=view.budget??empty(period),transactions=[...original.transactions];
    transactions[expenseIndex??transactions.length]=expense;
    proposal=normalizeManualBudget({...original,transactions});
   }else {proposal=fields(draft,period);calculateManualBudget(proposal);}
   const v=await client.manualBudgetReview(source?{carryFrom:source}:transactionsOnly?{expense,index:expenseIndex}:{budget:proposal});
   if(run!==sequence||!fresh())return;
   if(v?.noChanges===true){notice=option?'This proposal already matches your saved budget.':'No budget changes to save.';return;}
   if(!keys(v,'budget,expiresAt,reviewId,source')||typeof v.reviewId!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(v.reviewId)||
      v.expiresAt!==view.expiresAt||!samePeriod(v.budget,period)||!equal(normalizeManualBudget(v.budget),normalizeManualBudget(proposal??v.budget))||
      (source?(!v.source||!samePeriod(v.source,source)||!Number.isSafeInteger(v.source.version)||v.source.version<1):v.source!==null))throw Error();
   calculateManualBudget(v.budget);review=v;if(planner)planner.chosen=option;
  }catch{if(run===sequence)notice=carry?'Check that the immediately preceding budget exists.':'Check the dates, category names and amounts. Each split must add up to its expense total.';}
  finally{if(run===sequence){busy=false;onChange();}}
 }
 async function save(){
  const run=sequence;busy=true;onChange();
  try{
   const value=await client.manualBudgetSave(review.reviewId);
   if(run!==sequence)return;
   if(value?.saved!==true||value.version!==view.version+1)throw Error();
   await open(period,transactionsOnly);
  }catch{if(run===sequence){reset();notice='Save could not be confirmed. Open the period to check before retrying.';onChange();}}
 }
 async function compareCash(){
  const run=sequence;busy=true;notice='';cash=null;onChange();
  try{
   const r=await client.manualBudgetCashFlow();
   if(run!==sequence||!fresh())return;
   if(!keys(r,'expectedIncomeMinor,expiresAt,incomeVarianceMinor,manualNetCashFlowMinor,period,receivedIncomeMinor,recordedExpensesMinor,sourceCount')||
      !samePeriod(r.period,period)||r.expiresAt!==view.expiresAt||!Number.isInteger(r.sourceCount)||r.sourceCount<0||r.sourceCount>100||
      ![r.expectedIncomeMinor,r.receivedIncomeMinor,r.recordedExpensesMinor].every(n=>Number.isSafeInteger(n)&&n>=0)||
      !Number.isSafeInteger(r.incomeVarianceMinor)||!Number.isSafeInteger(r.manualNetCashFlowMinor)||
      r.recordedExpensesMinor!==calculateManualBudget(view.budget).totalActualMinor||
      BigInt(r.manualNetCashFlowMinor)!==BigInt(r.receivedIncomeMinor)-BigInt(r.recordedExpensesMinor)||
      BigInt(r.incomeVarianceMinor)!==BigInt(r.receivedIncomeMinor)-BigInt(view.budget.plannedIncomeMinor))throw Error();
   cash=r;
  }catch{if(run===sequence)notice='Could not verify all manual income and expenses for this period.';}
  finally{if(run===sequence){busy=false;onChange();}}
 }
 async function receiptAction(index,action,choice=null){
  const n=sequence;busy=true;notice='';onChange();
  try{
   if(action==='download'){
    const v=await client.manualExpenseReceiptDownload(index);
    if(n!==sequence||!fresh()||!canDownload())return;
    if(v.fields?.name!==receipt?.attachedName)throw Error('Receipt details changed.');
    downloadCheckedDocument(v,null,download);
   }else if(action==='choose'){
    const name=choice===null?null:receipt.files.find(f=>f.choice===choice)?.name;
    if(name===undefined)throw Error();
    const v=await client.manualBudgetReview({index,receiptChoice:choice});if(n!==sequence||!fresh())return;
    if(v?.noChanges===true){notice='This file is already attached.';return;}
    if(!keys(v,'budget,expiresAt,receiptName,reviewId,source')||v.source!==null||v.receiptName!==name||v.expiresAt!==view.expiresAt||!/^[A-Za-z0-9_-]{43}$/.test(v.reviewId))throw Error();
    const proposed=normalizeManualBudget(v.budget),original=normalizeManualBudget(view.budget);
    const before=original.transactions[index].receiptFile,after=proposed.transactions[index].receiptFile;
    if(Boolean(after)!==Boolean(name)||after&&before&&before.linkId!==after.linkId)throw Error();
    const checked=structuredClone(proposed);if(before)checked.transactions[index].receiptFile=before;else delete checked.transactions[index].receiptFile;
    if(!equal(normalizeManualBudget(checked),original))throw Error();
    expenseIndex=index;review=v;
   }else{
    const offset=action==='next'?receipt.offset+25:action==='prev'?receipt.offset-25:0;
    const v=await client.manualExpenseReceipts(index,offset);if(n!==sequence||!fresh())return;
    receipt={...verifyReceiptPicker(v,offset,view.expiresAt),index};
   }
  }catch{if(n===sequence)notice='Could not verify the receipt. Reopen the transaction and check its file.';}
  finally{if(n===sequence){busy=false;onChange();}}
 }
 function render(){
  const heading='<h2>'+(transactionsOnly?'Manual transactions':'Manual budget')+'</h2><p role="status">'+esc(busy?'Checking the budget…':notice)+'</p>';
  const group=html=>'<fieldset '+(busy?'disabled':'')+'>'+html+'</fieldset>';
  if(directory?.periods&&directory.expiresAt>clock()){
   let html='<legend>Saved budget periods, newest created first</legend>';
   for(const entry of directory.periods){
    const dates=entry.periodStart+' through '+entry.periodEnd;
    const label=(entry.period==='month'?'Monthly budget':'Pay period')+' · '+dates;
    html+='<section aria-label="'+esc(label)+'"><h3>'+esc(label)+'</h3>'+button('period-budget-'+periodKey(entry),'Open budget')+
     button('period-transactions-'+periodKey(entry),'Open transactions')+'</section>';
   }
   if(!directory.periods.length)html+='<p>No saved budget periods on this page.</p>';
   if(periodTrail.length>1)html+=button('newer-periods','Newer saved periods');
   if(directory.hasMore)html+=button('older-periods','Older saved periods');
   return heading+group(html+button('close-months','Choose another period'));
  }
  if(directory&&directory.expiresAt>clock()){
   let html='<legend>Saved monthly budgets for '+esc(String(directory.year).padStart(4,'0'))+'</legend>';
   for(const month of directory.months){
    const label=monthName.format(Date.UTC(2000,month-1,1));
    html+='<div>'+button('saved-budget-'+month,'Open '+label+' budget')+button('saved-transactions-'+month,'Open '+label+' transactions')+'</div>';
   }
   if(!directory.months.length)html+='<p>No saved monthly budgets for this year.</p>';
   return heading+group(html+button('close-months','Choose another period'));
  }
  if(!fresh())return heading+'<form id="budget-period">'+group('<legend>Choose a budget period</legend><label>Period<select name="period"><option value="month">Monthly</option><option value="pay_period" '+(period.period==='pay_period'?'selected':'')+'>Pay period</option></select></label>'+
   field(period.period==='month'?'Month containing':'Start date','periodStart',period.periodStart,'date')+(period.period==='pay_period'?field('End date','periodEnd',period.periodEnd,'date'):'')+'<button>Open budget</button>'+button('transactions','Open transaction history')+button('all-periods','Browse saved periods')+(period.period==='month'?button('saved-months','Find saved months') : ''))+'</form>';
  let html='<p>'+esc(period.periodStart)+' through '+esc(period.periodEnd)+'</p>';
  let periodControls='';
  if(period.period==='month'){
   if(period.periodStart!=='0000-01-01')periodControls+=button('previous-month','Previous month');
   if(period.periodStart!=='9999-12-01')periodControls+=button('next-month','Next month');
  }
  periodControls+=button('close','Choose another period');
  if(transactionsOnly){
   if(review){
    const expense=review.budget.transactions[expenseIndex??review.budget.transactions.length-1];
    return heading+group('<legend>Review transaction</legend>'+html+transactionRows([expense],true,false)+
     (Object.hasOwn(review,'receiptName')?'<p>'+(review.receiptName?'Link library file · '+esc(review.receiptName):'Remove this receipt link and keep the library file.')+'</p>':'')+(expense.receiptReference?'<p>Receipt reference · '+esc(expense.receiptReference)+'</p>':'')+button('approve','Approve transaction save')+button('back','Back to edit'));
   }
   if(receipt)return heading+group(html+renderReceiptPicker(receipt,button));
   if(draft)return heading+'<form id="budget-edit">'+group('<legend>'+(expenseIndex===null?'New expense':'Edit expense')+'</legend>'+expenseForm(draft.expenses[0],0,false)+
    '<button>Review transaction</button>'+button('discard','Cancel edit'))+'</form>';
   return heading+group(html+transactionRows(view.budget?.transactions??[],shown,true,allowDocuments)+button('amounts',shown?'Hide amounts':'Show amounts')+
    button('new-transaction','Add transaction')+periodControls);
  }
  if(planner&&!review){
   let body='<legend>Budget proposals</legend>'+html;
   if(!planner.options.length)body+='<label>Amount to leave unallocated in the reserve option<input name="reserveAmount" value="'+esc(planner.reserve)+'" required></label><button>Compare proposals</button>';
   else{
    body+=button('amounts',shown?'Hide amounts':'Show amounts');
    for(const option of planner.options){
     const money=n=>shown?esc(dollars(n)):'Hidden';
     body+='<section><h3>'+esc(option.label)+'</h3><p>'+esc(option.basis)+'</p><p>Unallocated · '+money(option.unallocatedMinor)+'</p>'+
      '<table><thead><tr><th>Category</th><th>Current</th><th>Proposed</th></tr></thead><tbody>'+option.budget.allocations.map((a,i)=>
       '<tr><th>'+esc(a.category)+'</th><td>'+money(view.budget.allocations[i].plannedMinor)+'</td><td>'+money(a.plannedMinor)+'</td></tr>').join('')+'</tbody></table>'+
      button('proposal-'+option.id,'Review '+option.label)+'</section>';
    }
    body+=button('change-reserve','Change reserve');
   }
   return heading+'<form id="budget-plan">'+group(body+button('exit-planner','Back to budget'))+'</form>';
  }
  if(review)return heading+group('<legend>Review budget</legend>'+html+(planner?.chosen?'<p>'+esc(planner.chosen.label)+'</p>':'')+(review.source?'<p>Opening balances copied from the reviewed period ending '+esc(review.source.periodEnd)+', revision '+review.source.version+'.</p>':'')+summary(review.budget,true,true)+button('approve','Approve budget save')+button('back','Back'));
  if(draft){
   html+=field('Planned income','income',draft.income);
   draft.categories.forEach((a,i)=>{const prefix='category-'+i+'-';html+='<fieldset><legend>Category '+(i+1)+'</legend>'+field('Name',prefix+'category',a.category)+field('Allocation',prefix+'allocation',a.allocation)+field('Opening balance',prefix+'opening',a.opening)+check('Carry surplus forward',prefix+'carrySurplus',a.carrySurplus)+check('Carry overspending forward',prefix+'carryDeficit',a.carryDeficit)+button('remove-category-'+i,'Remove category')+'</fieldset>';});
   html+=button('add-category','Add category');
   html+=draft.expenses.map((expense,i)=>expenseForm(expense,i,true)).join('');
   return heading+'<form id="budget-edit">'+group('<legend>Edit budget</legend>'+html+button('add-expense','Add expense')+'<button>Review budget</button>'+button('discard','Discard edits'))+'</form>';
  }
  if(view.budget)html+=summary(view.budget,shown)+button('amounts',shown?'Hide amounts':'Show amounts')+button('edit','Edit budget');
  else html+='<p>No saved budget for this period.</p>'+button('edit','Create budget')+(period.period==='pay_period'?field('Previous pay period start','priorStart',priorStart,'date'):'')+button('carry','Review rollover from previous period');
  if(allowPlanner&&view.budget)html+=view.budget.allocations.length&&view.budget.plannedIncomeMinor>0?button('planner','Compare budget proposals'):'<p>Add planned income and a category to compare budget proposals.</p>';
  if(allowIncome&&view.budget){
   html+=button('cashflow','Compare manual income and expenses');
   if(cash){const amount=n=>shown?esc(dollars(n)):'Hidden';
    html+='<dl><dt>Scheduled income</dt><dd>'+amount(cash.expectedIncomeMinor)+'</dd><dt>Income received</dt><dd>'+amount(cash.receivedIncomeMinor)+'</dd>'+
     '<dt>Received minus planned income</dt><dd>'+amount(cash.incomeVarianceMinor)+'</dd><dt>Net cash flow after recorded expenses</dt><dd>'+amount(cash.manualNetCashFlowMinor)+'</dd></dl>';
   }
  }
  return heading+group(html+periodControls);
 }
 return {render,reset,blocked:()=>Boolean(draft||review||planner||busy),input(event){
  const el=event.target,form=el.form?.id;
  if(form==='budget-period'&&expired())resetExpiredChooser();
  if(form==='budget-plan'&&el.name==='reserveAmount'&&planner&&!busy&&!review){planner.reserve=el.value;return true;}
  if(el.name==='priorStart'&&fresh()&&!busy){priorStart=el.value;return true;}
  if(form==='budget-period'&&!view&&!directory&&!busy&&Object.hasOwn(period,el.name)){period[el.name]=el.value;if(el.name==='period')onChange();return true;}
  if(form!=='budget-edit')return false;
  if(!draft||review||busy)return true;
  if(el.name==='income')draft.income=el.value;
  else if(el.name.startsWith('part-')){
   const m=/^part-(\d+)-(\d+)-(category|amount)$/.exec(el.name);
   const part=m&&draft.expenses[Number(m[1])]?.splits[Number(m[2])];if(part)part[m[3]]=el.value;
  }else {
   const match=/^(category|expense)-(\d+)-(\w+)$/.exec(el.name);
   const row=match&&(match[1]==='category'?draft.categories:draft.expenses)[Number(match[2])];
   if(row&&match[3]!=='splits'&&Object.hasOwn(row,match[3]))row[match[3]]=el.type==='checkbox'?el.checked:el.value;
  }
  return true;
 },submit(event){
  if(event.target.id==='budget-plan'){
   event.preventDefault();
   if(fresh()&&planner&&!review&&!busy){
    try{planner.options=manualBudgetProposals(view.budget,parseManualAmount(planner.reserve));notice='';}
    catch{notice='Enter a reserve greater than zero and no more than planned income.';}
    onChange();
   }
   return true;
  }
  if(!['budget-period','budget-edit'].includes(event.target.id))return false;
  event.preventDefault();
  if(event.target.id==='budget-period'&&expired())resetExpiredChooser();
  if(busy)return true;
  if(event.target.id==='budget-period'&&!view&&!directory&&canOpen()){
   try{void open(period.period==='month'?manualBudgetMonth(period.periodStart):manualBudgetPeriod(period));}
   catch{notice='Choose valid budget dates.';onChange();}
  }else if(draft&&!review&&fresh())void prepare(false);
  return true;
 },click(event){
  const action=event.target.closest('[data-budget-action]')?.dataset.budgetAction;
  if(!action)return false;
  if(expired()){
   if(!['all-periods','saved-months','transactions'].includes(action)){expire();return true;}
   resetExpiredChooser();
  }
  if(busy)return true;
  if(directory){
   if(action==='close-months'){reset();onChange();return true;}
   if(directory.periods){
    if(!canOpen())return true;
    if(action==='newer-periods'&&periodTrail.length>1){void findPeriods(period,'all',periodTrail.slice(0,-1));return true;}
    if(action==='older-periods'&&directory.hasMore){void findPeriods(period,'all',[...periodTrail,directory.periods.at(-1)]);return true;}
    const choice=/^period-(budget|transactions)-(.+)$/.exec(action);
    const chosen=choice&&directory.periods.find(entry=>periodKey(entry)===choice[2]);
    if(chosen)void open(chosen,choice[1]==='transactions');
    return true;
   }
   const choice=/^saved-(budget|transactions)-([1-9]|1[0-2])$/.exec(action);
   if(choice&&canOpen()&&directory.months.includes(Number(choice[2]))){
    const first=String(directory.year).padStart(4,'0')+'-01-01';
    void open(manualBudgetMonth(first,Number(choice[2])-1),choice[1]==='transactions');
   }
   return true;
  }
  if(action==='all-periods'&&!view&&canOpen()){void findPeriods({...period},'all');return true;}
  if(action==='saved-months'&&!view&&canOpen()&&period.period==='month'){
   try{void findPeriods(manualBudgetMonth(period.periodStart),'months');}
   catch{notice='Choose a valid budget date.';onChange();}
   return true;
  }
  if(action==='transactions'&&!view&&canOpen()){
   try{void open(period.period==='month'?manualBudgetMonth(period.periodStart):manualBudgetPeriod(period),true);}
   catch{notice='Choose valid transaction dates.';onChange();}
   return true;
  }
  if(!fresh())return true;
  if(review){if(action==='approve')void save();else if(action==='back'){review=null;onChange();}return true;}
  if(allowDocuments&&transactionsOnly&&!draft){
   if(/^receipt-at-\d+$/.test(action)){void receiptAction(Number(action.slice('receipt-at-'.length)),'open');return true;}
   if(receipt){
    if(action==='receipt-close'){receipt=null;onChange();}
    else if(action==='receipt-next'||action==='receipt-prev')void receiptAction(receipt.index,action.slice(8));
    else if(action==='receipt-download'&&receipt.attachedName)void receiptAction(receipt.index,'download');
    else if(action==='receipt-unlink'&&receipt.attachedName)void receiptAction(receipt.index,'choose');
    else if(action.startsWith('receipt-choose-'))void receiptAction(receipt.index,'choose',action.slice('receipt-choose-'.length));
    return true;
   }
  }
  if(planner){
   if(action==='exit-planner'){planner=null;shown=false;notice='';}
   else if(action==='change-reserve'){planner.options=[];planner.chosen=null;notice='';}
   else if(action==='amounts')shown=!shown;
   else if(action.startsWith('proposal-')){
    const option=planner.options.find(candidate=>candidate.id===action.slice(9));
    if(option){void prepare(false,option);return true;}
   }
   onChange();return true;
  }
  if(draft){
   if(action==='discard')draft=null;
   else if(action==='add-category'&&draft.categories.length<100)draft.categories.push({category:'',allocation:'0.00',opening:'0.00',carrySurplus:false,carryDeficit:false});
   else if(action==='add-expense'&&draft.expenses.length<1000)draft.expenses.push({category:'',day:period.periodStart,amount:'',label:'',receiptReference:'',splits:[]});
   else if(/^(split|unsplit|add-part|remove-part)-/.test(action)){
    const m=/^(split|unsplit|add-part|remove-part)-(\d+)(?:-(\d+))?$/.exec(action),t=m&&draft.expenses[Number(m[2])];
    if(t){
     if(m[1]==='split'&&!t.splits.length)t.splits=[{category:t.category,amount:t.amount},{category:'',amount:''}];
     if(m[1]==='unsplit'){t.category=t.splits[0]?.category??t.category;t.splits=[];}
     if(m[1]==='add-part'&&t.splits.length<20)t.splits.push({category:'',amount:''});
     if(m[1]==='remove-part'&&t.splits.length>2)t.splits.splice(Number(m[3]),1);
    }
   }
   else {const m=/^remove-(category|expense)-(\d+)$/.exec(action);if(m)(m[1]==='category'?draft.categories:draft.expenses).splice(Number(m[2]),1);}
  }else if(canOpen()){
   if(action==='previous-month'||action==='next-month'){
    if(period.period==='month'){
     try{void open(manualBudgetMonth(period.periodStart,action==='previous-month'?-1:1),transactionsOnly);}
     catch{notice='Choose a supported month.';onChange();}
    }
    return true;
   }
   if(transactionsOnly&&(action==='new-transaction'||/^transaction-\d+$/.test(action))){
    expenseIndex=action==='new-transaction'?null:Number(action.slice(12));
    const expenses=view.budget?.transactions??[];
    const entry=expenseIndex===null?{day:period.periodStart,amountMinor:null,category:''}:expenses[expenseIndex];
    if(entry)draft={expenses:[editableExpense(entry)]};
   }
   if(action==='planner'&&allowPlanner&&view.budget&&!transactionsOnly){planner={reserve:'',options:[],chosen:null};shown=false;notice='';}
   if(action==='edit')draft=editable(view.budget??empty(period));
   if(action==='amounts')shown=!shown;
   if(action==='cashflow'&&allowIncome&&view.budget){void compareCash();return true;}
   if(action==='carry'&&!view.budget){void prepare(true);return true;}
   if(action==='close'){reset();void client.manualBudgetCancel().catch(()=>{});}
  }
  onChange();return true;
 }};
}
