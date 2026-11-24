import test from 'node:test';
import assert from 'node:assert/strict';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {calculateManualBudget,nextManualBudget,normalizeManualBudget,includedManualBalance} from '../src/private-finance-manual.mjs';
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
