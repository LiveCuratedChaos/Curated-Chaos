import test from 'node:test';
import assert from 'node:assert/strict';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {manualBudgetMonth,calculateManualBudget,nextManualBudget,normalizeManualBudget,includedManualBalance} from '../src/private-finance-manual.mjs';
import {createManualBudgetPanel} from '../src/private-manual-budget-panel.mjs';
import {validatePrivatePreviewArguments} from '../tools/private-session-preview-server.mjs';
import {manualBudgetId} from '../server/private-budget-period.mjs';
import {createManualFinanceStorage} from '../server/private-manual-finance-storage.mjs';
import {supportsOrdinaryWorkspaceRestore} from '../server/private-workspace-restore-contract.mjs';

const enabled={allowManualFinance:true,allowManualBudgets:true};
const november={period:'month',periodStart:'2026-11-01',periodEnd:'2026-11-30'};
const december={period:'month',periodStart:'2026-12-01',periodEnd:'2026-12-31'};
const sample={...november,plannedIncomeMinor:20000,allocations:[
 {category:'Food',plannedMinor:10000,carryDeficit:true},
 {category:'Travel',plannedMinor:5000,carrySurplus:true},
 {category:'Other',plannedMinor:5000}],
 transactions:[{category:'Food',day:'2026-11-05',amountMinor:12100},{category:'Other',day:'2026-11-14',amountMinor:1800},
 {category:'Unallocated',day:'2026-11-20',amountMinor:350}]};

test('category-specific rollover preserves the prior period and reconciles unmatched expenses and exact totals',()=>{
 const next=nextManualBudget(sample,december);
 assert.deepEqual(next.allocations.map(a=>a.openingMinor),[-2100,5000,0]);
 assert.deepEqual(next.transactions,[]);
 assert.equal(calculateManualBudget(sample).unallocatedActualMinor,350);
 assert.equal(calculateManualBudget(sample).remainingToSpendMinor,5750);
 assert.equal(calculateManualBudget(next).remainingToSpendMinor,22900);
 assert.throws(()=>nextManualBudget(sample,{...december,periodStart:'2026-12-12'}));
 assert.throws(()=>normalizeManualBudget({...sample,periodEnd:'2026-12-01'}));
 const max=Number.MAX_SAFE_INTEGER;
 const account=balanceMinor=>({label:'Test',type:'other',balanceMinor,includeInBudget:true,showInAccountList:true});
 assert.equal(includedManualBalance([account(max),account(1),account(-1)]),max);
 assert.throws(()=>calculateManualBudget({...sample,transactions:[{category:'Food',day:november.periodStart,amountMinor:max},{category:'New',day:november.periodEnd,amountMinor:1}]}));
});
test('signed-in budget review refuses stale edits, repeated approvals and changed rollover sources',async t=>{
 const fixture=privateWorkspaceFixture(t,enabled),one=fixture.tab(),two=fixture.tab();
 await one.login();await two.login();
 await Promise.all([one.client.manualBudgetOpen(november),two.client.manualBudgetOpen(november)]);
 const a=await one.client.manualBudgetReview({budget:sample}),b=await two.client.manualBudgetReview({budget:sample});
 await assert.rejects(two.client.manualBudgetSave(a.reviewId));
 assert.deepEqual(await one.client.manualBudgetSave(a.reviewId),{saved:true,version:1});
 await assert.rejects(one.client.manualBudgetSave(a.reviewId));
 await assert.rejects(two.client.manualBudgetSave(b.reviewId));
 await one.client.manualBudgetOpen(december);
 const carry=await one.client.manualBudgetReview({carryFrom:november});
 assert.equal(carry.budget.allocations[1].openingMinor,5000);
 await two.client.manualBudgetOpen(november);
 const edit=await two.client.manualBudgetReview({budget:{...sample,transactions:[]}});
 await two.client.manualBudgetSave(edit.reviewId);
 await assert.rejects(one.client.manualBudgetSave(carry.reviewId));
 assert.equal((await one.client.manualBudgetOpen(december)).budget,null);
 const revised=await one.client.manualBudgetReview({carryFrom:november});
 assert.equal(revised.budget.allocations[0].openingMinor,0);
 await one.client.manualBudgetSave(revised.reviewId);
 assert.deepEqual((await one.client.manualBudgetOpen(december)).budget,revised.budget);
 await assert.rejects(one.client.manualBudgetReview({carryFrom:november}));
});
test('budget panel reviews and saves a pay-period plan and expense, hides values on reopen and clears on reset',async t=>{
 const tab=privateWorkspaceFixture(t,enabled).tab();await tab.login();
 const panel=createManualBudgetPanel({client:tab.client}),turn=()=>new Promise(r=>setImmediate(r));
 t.after(()=>panel.reset());
 const input=(form,name,value)=>panel.input({target:{name,value,checked:value,type:typeof value==='boolean'?'checkbox':'text',form:{id:form}}});
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{budgetAction:action}})}});await turn();};
 const submit=async id=>{panel.submit({target:{id},preventDefault(){}});await turn();};
 input('budget-period','period','pay_period');input('budget-period','periodStart','2026-11-01');input('budget-period','periodEnd','2026-11-14');
 await submit('budget-period');await click('edit');input('budget-edit','income','100.00');
 await click('add-category');input('budget-edit','category-0-category','Groceries');input('budget-edit','category-0-allocation','45.00');input('budget-edit','category-0-carryDeficit',true);
 await click('add-expense');input('budget-edit','expense-0-category','Groceries');input('budget-edit','expense-0-day','2026-11-06');input('budget-edit','expense-0-amount','51.12');
 await submit('budget-edit');assert.match(panel.render(),/Approve budget save/);assert.match(panel.render(),/-\$6.12/);
 await click('approve');assert.match(panel.render(),/Show amounts/);assert.doesNotMatch(panel.render(),/51.12/);
 await click('amounts');assert.match(panel.render(),/\$48.88/);
 await click('close');input('budget-period','period','pay_period');input('budget-period','periodStart','2026-11-15');input('budget-period','periodEnd','2026-11-28');
 await submit('budget-period');input('','priorStart','2026-11-01');await click('carry');
 assert.match(panel.render(),/revision 1/);assert.match(panel.render(),/-\$6.12/);
 await click('approve');await click('amounts');assert.match(panel.render(),/\$93.88/);
 panel.reset();assert.doesNotMatch(panel.render(),/Groceries|93.88/);
});
test('budget storage binds the sealed content to its owner, exact period and revision across recovery',async()=>{
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',key=Buffer.alloc(32,2);
 const id=manualBudgetId(owner,november);let stored;
 const storage=createManualFinanceStorage(async(path,opts)=>{
  if(opts.body){
   assert.doesNotMatch(opts.body,/Food|plannedIncomeMinor|2026-11-01/);
   stored={...JSON.parse(opts.body),version:1,deleted_at:null};
  } else {assert.match(path,/item_type=eq.manual_finance_budget/);assert.ok(path.includes('id=eq.'+id));}
  return [structuredClone(stored)];
 },async()=>Buffer.from(key));
 const draft={id,owner_id:owner,section:'Finances',item_type:'manual_finance_budget',origin:'PRIVATE_MANUAL_FINANCE',
  household_id:null,visibility:'private',payload:{fictional:true,version:1,ownerId:owner,budget:sample}};
 await storage.saveManualBudget('fixture',owner,draft,null);
 assert.deepEqual((await storage.getManualBudget('fixture',id,owner))[0].payload.budget,sample);
 assert.equal(supportsOrdinaryWorkspaceRestore(stored,{manualFinanceKey:key}),true);
 assert.equal(supportsOrdinaryWorkspaceRestore(stored),false);
 assert.equal(supportsOrdinaryWorkspaceRestore({...stored,id:manualBudgetId(owner,december)},{manualFinanceKey:key}),false);
 assert.equal(supportsOrdinaryWorkspaceRestore({...stored,version:2},{manualFinanceKey:key}),false);
 const ids=Array.from({length:12},(_,month)=>manualBudgetId(owner,manualBudgetMonth('2026-01-01',month)));
 const directory=createManualFinanceStorage(async(path,options,token)=>{
  assert.equal(token,'fixture');assert.deepEqual(options,{});
  const query=new URL(path,'https://fixture.invalid').searchParams;
  assert.equal(query.get('select'),'id');assert.equal(query.get('owner_id'),'eq.'+owner);
  assert.equal(query.get('id'),'in.('+ids.join(',')+')');return [{id}];
 },()=>{throw Error('A month lookup must not open the finance key.');});
 assert.deepEqual(await directory.listManualBudgetIds('fixture',owner,ids),[id]);
});
test('budget launcher requires a separate opt-in and protected session routes',async t=>{
 const flags=['--fixtures-only','--serve-private-dashboard','--allow-private-brief-read','--allow-private-manual-finance-reviewed','--allow-private-manual-budgets-reviewed'];
 assert.equal(validatePrivatePreviewArguments(flags).allowManualBudgets,true);
 assert.throws(()=>validatePrivatePreviewArguments(flags.filter(f=>f!=='--allow-private-manual-finance-reviewed')));
 for(const enabledBudget of [false,true]){
  const tab=privateWorkspaceFixture(t,{...enabled,allowManualBudgets:enabledBudget}).tab();
  assert.equal((await(await tab.fetcher('/dev-config.json')).json()).privateManualBudgets,enabledBudget?true:undefined);
  await tab.login();
  assert.equal((await tab.fetcher('/auth/workspace/manual-budgets/open',{method:'POST',body:'{}'})).status,enabledBudget?403:404);
 }
});

test('split expenses reconcile exact cents, preserve receipt references and count each purchase once',async t=>{
 const tab=privateWorkspaceFixture(t,enabled).tab();await tab.login();
 const panel=createManualBudgetPanel({client:tab.client});t.after(()=>panel.reset());
 const turn=()=>new Promise(r=>setImmediate(r));
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{budgetAction:action}})}});await turn();};
 const input=(form,name,value)=>panel.input({target:{form:{id:form},name,value,type:'text'}});
 const submit=async id=>{panel.submit({target:{id},preventDefault(){}});await turn();};
 input('budget-period','periodStart',november.periodStart);await submit('budget-period');
 await click('edit');input('budget-edit','income','100');await click('add-category');
 input('budget-edit','category-0-category','Food');input('budget-edit','category-0-allocation','30');
 await click('add-expense');input('budget-edit','expense-0-category','Food');input('budget-edit','expense-0-amount','42.15');
 input('budget-edit','expense-0-label','Fictional store');input('budget-edit','expense-0-receiptReference','Receipt <123>');
 await click('split-0');input('budget-edit','part-0-0-amount','30.00');input('budget-edit','part-0-1-category','Supplies');input('budget-edit','part-0-1-amount','13');
 await submit('budget-edit');assert.match(panel.render(),/split must add up/);assert.doesNotMatch(panel.render(),/Approve budget save/);
 input('budget-edit','part-0-1-amount','12.15');await submit('budget-edit');assert.match(panel.render(),/Receipt &lt;123&gt;/);
 await click('approve');assert.doesNotMatch(panel.render(),/Receipt &lt;123&gt;|42.15/);await click('amounts');assert.match(panel.render(),/\$57.85/);
 const budget=(await tab.client.manualBudgetOpen(november)).budget;
 assert.equal(budget.transactions.length,1);assert.equal(budget.transactions[0].receiptReference,'Receipt <123>');
 const totals=calculateManualBudget(budget);
 assert.equal(totals.categories[0].actualMinor,3000);assert.equal(totals.unallocatedActualMinor,1215);assert.equal(totals.totalActualMinor,4215);
});

test('transaction history reviews one expense, preserves legacy rows and allocations, and reopens in newest-first order',async t=>{
 const app=privateWorkspaceFixture(t,enabled),tab=app.tab(),other=app.tab();await tab.login();await other.login();
 await tab.client.manualBudgetOpen(november);const seed=await tab.client.manualBudgetReview({budget:sample});await tab.client.manualBudgetSave(seed.reviewId);
 const panel=createManualBudgetPanel({client:tab.client});t.after(()=>panel.reset());
 const tick=()=>new Promise(r=>setImmediate(r));
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{budgetAction:action}})}});await tick();};
 const input=(form,name,value)=>panel.input({target:{form:{id:form},name,value,type:'text'}});
 const submit=async id=>{panel.submit({target:{id},preventDefault(){}});await tick();};
 input('budget-period','periodStart',november.periodStart);await click('transactions');
 assert.match(panel.render(),/Manual transactions/);assert.doesNotMatch(panel.render(),/121\.00/);
 assert.ok(panel.render().indexOf('2026-11-20')<panel.render().lastIndexOf('2026-11-05'));
 await click('transaction-1');input('budget-edit','expense-0-label','Fictional receipt');input('budget-edit','expense-0-receiptReference','file reference A');
 input('budget-edit','expense-0-amount','20.10');await submit('budget-edit');
 assert.match(panel.render(),/Review transaction/);assert.match(panel.render(),/20\.10/);assert.match(panel.render(),/file reference A/);assert.doesNotMatch(panel.render(),/121\.00/);
 await click('approve');assert.match(panel.render(),/Fictional receipt/);assert.doesNotMatch(panel.render(),/20\.10|file reference A/);
 const result=(await other.client.manualBudgetOpen(november)).budget;assert.deepEqual(result.allocations,sample.allocations);assert.equal(result.transactions.length,3);
 assert.deepEqual(result.transactions[0],sample.transactions[0]);assert.deepEqual(result.transactions[2],sample.transactions[2]);
 assert.equal(result.transactions[1].amountMinor,2010);assert.equal(result.transactions[1].receiptReference,'file reference A');
 await click('close');input('budget-period','period','pay_period');input('budget-period','periodStart','2026-11-14');input('budget-period','periodEnd','2026-11-27');
 await click('transactions');await click('new-transaction');input('budget-edit','expense-0-amount','30');input('budget-edit','expense-0-category','Food');
 await click('split-0');input('budget-edit','part-0-0-amount','20');input('budget-edit','part-0-1-category','Other');input('budget-edit','part-0-1-amount','10');
 await submit('budget-edit');await click('approve');assert.match(panel.render(),/Transaction history/);
 const payPeriod={period:'pay_period',periodStart:'2026-11-14',periodEnd:'2026-11-27'};
 const saved=(await other.client.manualBudgetOpen(payPeriod)).budget;
 assert.equal(calculateManualBudget(saved).totalActualMinor,3000);assert.deepEqual(saved.transactions[0].splits,[{category:'Food',amountMinor:2000},{category:'Other',amountMinor:1000}]);
 await tab.client.manualBudgetOpen(payPeriod);const change=await tab.client.manualBudgetReview({index:0,expense:{category:'Home',amountMinor:3000,day:'2026-11-15'}});
 const competing=await other.client.manualBudgetReview({index:0,expense:{category:'Travel',amountMinor:3100,day:'2026-11-15'}});
 await other.client.manualBudgetSave(competing.reviewId);await assert.rejects(tab.client.manualBudgetSave(change.reviewId));
});

test('monthly navigation opens the adjacent budget or transaction list, hides amounts and keeps pending edits',async t=>{
 const tab=privateWorkspaceFixture(t,enabled).tab();await tab.login();
 await tab.client.manualBudgetOpen(november);
 const seed=await tab.client.manualBudgetReview({budget:sample});await tab.client.manualBudgetSave(seed.reviewId);
 const reads=[];
 const client={...tab.client,manualBudgetOpen:async selection=>{
  reads.push({...selection});
  return tab.client.manualBudgetOpen(selection);
 }};
 const panel=createManualBudgetPanel({client});t.after(()=>panel.reset());
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{budgetAction:action}})}});await tick();};
 const input=(form,name,value)=>panel.input({target:{form:{id:form},name,value,type:'text'}});
 const submit=async id=>{panel.submit({target:{id},preventDefault(){}});await tick();};
 input('budget-period','periodStart','2026-12-31');await submit('budget-period');
 assert.deepEqual(reads.at(-1),december);
 await click('next-month');assert.deepEqual(reads.at(-1),{period:'month',periodStart:'2027-01-01',periodEnd:'2027-01-31'});
 await click('previous-month');await click('previous-month');assert.deepEqual(reads.at(-1),november);
 assert.match(panel.render(),/Manual budget/);assert.match(panel.render(),/Hidden/);await click('amounts');assert.match(panel.render(),/\$57\.50/);
 await click('edit');input('budget-edit','income','201.00');
 const count=reads.length;
 assert.doesNotMatch(panel.render(),/Previous month|Next month/);await click('next-month');assert.equal(reads.length,count);
 await submit('budget-edit');assert.match(panel.render(),/Approve budget save/);
 await click('previous-month');assert.equal(reads.length,count);assert.match(panel.render(),/201\.00/);
 await click('back');await click('discard');await click('next-month');
 assert.match(panel.render(),/No saved budget/);assert.doesNotMatch(panel.render(),/57\.50|201\.00/);
 await click('previous-month');assert.match(panel.render(),/Show amounts/);assert.doesNotMatch(panel.render(),/57\.50/);
 assert.deepEqual((await tab.client.manualBudgetOpen(november)).budget,sample);

 await click('close');input('budget-period','periodStart','2028-03-31');await click('transactions');await click('previous-month');
 assert.deepEqual(reads.at(-1),{period:'month',periodStart:'2028-02-01',periodEnd:'2028-02-29'});
 assert.match(panel.render(),/Manual transactions/);assert.match(panel.render(),/No recorded transactions/);
 await click('next-month');assert.equal(reads.at(-1).periodEnd,'2028-03-31');
 await click('new-transaction');const historyReads=reads.length;await click('next-month');assert.equal(reads.length,historyReads);
 await click('discard');await click('close');
 input('budget-period','period','pay_period');input('budget-period','periodStart','2028-03-03');input('budget-period','periodEnd','2028-03-16');
 await click('transactions');assert.doesNotMatch(panel.render(),/Previous month|Next month/);
 const payReads=reads.length;await click('previous-month');assert.equal(reads.length,payReads);
});

test('a year lookup reveals only saved months and preserves an existing review',async t=>{
 const fixture=privateWorkspaceFixture(t,enabled),tab=fixture.tab();await tab.login();
 const save=async budget=>{
  await tab.client.manualBudgetOpen({period:budget.period,periodStart:budget.periodStart,periodEnd:budget.periodEnd});
  const review=await tab.client.manualBudgetReview({budget});await tab.client.manualBudgetSave(review.reviewId);
 };
 await save(sample);
 await save({...sample,...december,transactions:[]});
 await save({...sample,period:'pay_period',periodStart:'2026-05-01',periodEnd:'2026-05-15',transactions:[]});
 await save({...sample,periodStart:'2025-03-01',periodEnd:'2025-03-31',transactions:[]});
 await tab.client.manualBudgetOpen(november);
 const pending=await tab.client.manualBudgetReview({budget:{...sample,plannedIncomeMinor:70000}});
 const found=await tab.client.manualBudgetMonths(2026);
 assert.deepEqual(Object.keys(found).sort(),['expiresAt','months','year']);
 assert.deepEqual(found.months,[12,11]);assert.equal(found.year,2026);
 assert.deepEqual((await tab.client.manualBudgetMonths(2025)).months,[3]);
 assert.deepEqual((await tab.client.manualBudgetMonths(2027)).months,[]);
 assert.deepEqual(await tab.client.manualBudgetSave(pending.reviewId),{saved:true,version:2});
 for(const year of ['2026',-1,10000,2026.5])await assert.rejects(tab.client.manualBudgetMonths(year));
 const disabled=privateWorkspaceFixture(t,{allowManualFinance:true}).tab();await disabled.login();
 await assert.rejects(disabled.client.manualBudgetMonths(2026));
});

test('a saved month opens its original budget or transactions without fetching other amounts',async t=>{
 const tab=privateWorkspaceFixture(t,enabled).tab();await tab.login();
 await tab.client.manualBudgetOpen(november);
 const review=await tab.client.manualBudgetReview({budget:sample});await tab.client.manualBudgetSave(review.reviewId);
 const calls=[];
 const client={...tab.client,
  manualBudgetMonths:year=>{calls.push(['list',year]);return tab.client.manualBudgetMonths(year);},
  manualBudgetOpen:period=>{calls.push(['open',period]);return tab.client.manualBudgetOpen(period);}
 };
 const panel=createManualBudgetPanel({client});t.after(()=>panel.reset());
 const input=(name,value)=>panel.input({target:{form:{id:'budget-period'},name,value,type:'text'}});
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{budgetAction:action}})}});await new Promise(resolve=>setImmediate(resolve));};
 input('periodStart','2026-08-01');await click('saved-months');
 assert.deepEqual(calls,[['list',2026]]);
 assert.match(panel.render(),/Saved monthly budgets for 2026/);assert.match(panel.render(),/Open November transactions/);
 assert.doesNotMatch(panel.render(),/Open October|Food|Travel|\$|20000/);
 await click('saved-budget-10');assert.equal(calls.length,1);
 await click('saved-transactions-11');assert.deepEqual(calls.at(-1),['open',november]);
 assert.match(panel.render(),/Manual transactions/);assert.match(panel.render(),/Transaction history/);assert.doesNotMatch(panel.render(),/121\.00/);
 await click('close');input('periodStart','2026-02-14');await click('saved-months');await click('saved-budget-11');
 assert.match(panel.render(),/Manual budget/);assert.match(panel.render(),/Show amounts/);
 await click('amounts');assert.match(panel.render(),/\$57\.50/);
 await click('close');input('periodStart','2023-02-01');await click('saved-months');
 assert.match(panel.render(),/No saved monthly budgets for this year/);
 await click('close-months');assert.match(panel.render(),/Choose a budget period/);
 input('period','pay_period');await click('saved-months');assert.doesNotMatch(panel.render(),/Find saved months/);
 assert.equal(calls.at(-1)[1],2023);
});

test('invalid, expired or late month lists cannot reopen a selected budget',async t=>{
 let now=Date.parse('2026-11-18T12:00:00Z'),months=[11,11],resolveList,delay=false;
 const calls=[];
 const client={manualBudgetMonths:year=>delay?new Promise(resolve=>{resolveList=resolve;}):Promise.resolve({year,months,expiresAt:now+30000}),
  manualBudgetOpen:async period=>{calls.push(period);}};
 const panel=createManualBudgetPanel({client,clock:()=>now});t.after(()=>panel.reset());
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{budgetAction:action}})}});await new Promise(resolve=>setImmediate(resolve));};
 await click('saved-months');assert.match(panel.render(),/Could not verify/);
 months=[11];await click('saved-months');now+=30001;await click('saved-budget-11');
 assert.deepEqual(calls,[]);assert.match(panel.render(),/expired/);
 delay=true;await click('saved-months');panel.reset();resolveList({year:2026,months:[11],expiresAt:now+30000});
 await new Promise(resolve=>setImmediate(resolve));
 assert.doesNotMatch(panel.render(),/Open November budget/);await click('saved-transactions-11');assert.deepEqual(calls,[]);
});

test('saved budget periods preserve overlapping custom dates and offer older records without repeating them',async t=>{
 const fixture=privateWorkspaceFixture(t,enabled),tab=fixture.tab();await tab.login();
 const periods=[];
 for(let index=1;index<=12;index++){
  const period={period:'pay_period',periodStart:'2026-11-'+String(index).padStart(2,'0'),periodEnd:'2026-11-30'};
  periods.push(period);await tab.client.manualBudgetOpen(period);
  const review=await tab.client.manualBudgetReview({budget:{...period,plannedIncomeMinor:index*100,allocations:[],transactions:[]}});
  await tab.client.manualBudgetSave(review.reviewId);
 }
 const list=await tab.client.manualBudgetPeriods();
 assert.equal(list.hasMore,true);assert.equal(list.periods.length,10);
 assert.deepEqual(Object.keys(list).sort(),['expiresAt','hasMore','periods']);
 for(const period of list.periods)assert.deepEqual(Object.keys(period).sort(),['period','periodEnd','periodStart']);
 const boundary=list.periods.at(-1),next=await tab.client.manualBudgetPeriods(boundary);
 assert.equal(next.hasMore,false);assert.equal(next.periods.length,2);
 assert.deepEqual([...list.periods,...next.periods].map(p=>p.periodStart).sort(),periods.map(p=>p.periodStart));
 await assert.rejects(tab.client.manualBudgetPeriods({...boundary,periodEnd:'2026-12-01'}));
 const panel=createManualBudgetPanel({client:tab.client});t.after(()=>panel.reset());
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{budgetAction:action}})}});await new Promise(resolve=>setImmediate(resolve));};
 await click('all-periods');assert.match(panel.render(),/Saved budget periods/);assert.doesNotMatch(panel.render(),/\$|Planned income/);
 await click('older-periods');assert.doesNotMatch(panel.render(),/Older saved periods/);assert.match(panel.render(),/Newer saved periods/);
 await click('newer-periods');assert.match(panel.render(),/Older saved periods/);assert.doesNotMatch(panel.render(),/Newer saved periods/);
 await click('older-periods');
 const selected=next.periods[0];
 await click('period-budget-pay_period_'+list.periods[0].periodStart+'_'+list.periods[0].periodEnd);
 assert.match(panel.render(),/Saved budget periods/);
 await click('period-transactions-pay_period_'+selected.periodStart+'_'+selected.periodEnd);
 assert.match(panel.render(),/Manual transactions/);assert.ok(panel.render().includes(selected.periodStart+' through '+selected.periodEnd));
 await click('close');await click('all-periods');await click('older-periods');
 await click('period-budget-pay_period_'+selected.periodStart+'_'+selected.periodEnd);
 assert.match(panel.render(),/Show amounts/);assert.doesNotMatch(panel.render(),/\$/);
});

test('a page of saved periods rejects duplicate dates, financial fields, stale replies and an impossible continuation',async t=>{
 const period={period:'pay_period',periodStart:'2026-11-01',periodEnd:'2026-11-15'};
 let now=Date.parse('2026-11-24T12:00:00Z'),response,resolvePage,delay=false;
 const panel=createManualBudgetPanel({clock:()=>now,client:{manualBudgetPeriods:()=>delay?new Promise(resolve=>{resolvePage=resolve;}):Promise.resolve(response)}});
 t.after(()=>panel.reset());
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{budgetAction:action}})}});await new Promise(resolve=>setImmediate(resolve));};
 for(const [periods,hasMore] of [[[period,period],false],[[{...period,balance:123}],false],[[period],true]]){
  response={periods,hasMore,expiresAt:now+20000};await click('all-periods');
  assert.match(panel.render(),/Could not verify the saved budget periods/);assert.doesNotMatch(panel.render(),/data-budget-action="period-transactions-/);
 }
 delay=true;await click('all-periods');panel.reset();resolvePage({periods:[period],hasMore:false,expiresAt:now+20000});
 await new Promise(resolve=>setImmediate(resolve));assert.doesNotMatch(panel.render(),/data-budget-action="period-transactions-/);
});

test('an expired saved-period view does not block choosing a new budget in a suspended tab',async t=>{
 let now=Date.parse('2026-11-18T12:00:00Z');
 const calls=[];
 const client={manualBudgetPeriods:async()=>({periods:[],hasMore:false,expiresAt:now+1000}),
  manualBudgetOpen:async period=>{calls.push(period);return {period,budget:null,version:0,expiresAt:now+1000};}};
 const panel=createManualBudgetPanel({client,clock:()=>now});t.after(()=>panel.reset());
 const turn=()=>new Promise(resolve=>setImmediate(resolve));
 panel.click({target:{closest:()=>({dataset:{budgetAction:'all-periods'}})}});
 await turn();
 assert.match(panel.render(),/No saved budget periods/);
 now+=1001;
 assert.match(panel.render(),/Choose a budget period/);
 panel.input({target:{name:'periodStart',value:'2027-01-15',form:{id:'budget-period'}}});
 panel.submit({target:{id:'budget-period'},preventDefault(){}});
 await turn();
 assert.deepEqual(calls,[{period:'month',periodStart:'2027-01-01',periodEnd:'2027-01-31'}]);
 assert.match(panel.render(),/2027-01-01 through 2027-01-31/);
});
