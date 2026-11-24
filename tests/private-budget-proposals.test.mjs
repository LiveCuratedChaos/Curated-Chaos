import test from 'node:test';
import assert from 'node:assert/strict';
import {manualBudgetProposals} from '../src/private-budget-proposals.mjs';
import {createManualBudgetPanel} from '../src/private-manual-budget-panel.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {validatePrivatePreviewArguments} from '../tools/private-session-preview-server.mjs';
const period={period:'month',periodStart:'2026-01-01',periodEnd:'2026-01-31'};
const original={...period,plannedIncomeMinor:10001,allocations:[
 {category:'Home',plannedMinor:2000,openingMinor:-200,carryDeficit:true},{category:'Travel',plannedMinor:2000}],
 transactions:[{day:'2026-01-05',category:'Home',amountMinor:4000},{day:'2026-01-10',category:'Other',amountMinor:2000}]};

test('two or three distinct proposals reconcile every cent and retain prior transactions, rollover and category order',()=>{
 const before=structuredClone(original),options=manualBudgetProposals(original,2000);
 assert.deepEqual(options.map(p=>p.id),['full','reserve','spending']);
 assert.deepEqual(options.map(p=>p.budget.allocations.map(a=>a.plannedMinor)),[[5001,5000],[4001,4000],[8001,0]]);
 for(const p of options){
  assert.deepEqual(p.budget.transactions,before.transactions);
  assert.equal(p.budget.allocations[0].openingMinor,-200);
  assert.equal(p.budget.allocations[0].carryDeficit,true);
  assert.equal(p.budget.allocations.reduce((n,a)=>n+a.plannedMinor,0)+p.unallocatedMinor,original.plannedIncomeMinor);
 }
 assert.deepEqual(original,before);
 const huge={...original,plannedIncomeMinor:Number.MAX_SAFE_INTEGER,allocations:[{category:'One',plannedMinor:0},{category:'Two',plannedMinor:0}],transactions:[]};
 const [all,reserve]=manualBudgetProposals(huge,1);assert.equal(all.budget.allocations[0].plannedMinor,4503599627370496);assert.equal(reserve.budget.allocations[0].plannedMinor,4503599627370495);
 assert.equal(manualBudgetProposals({...original,transactions:[]},10001).length,2);
 for(const invalid of [0,-1,10002,3.5])assert.throws(()=>manualBudgetProposals(original,invalid));
});
test('signed-in planner compares without saving, returns from review, and applies only the selected plan',async t=>{
 const tab=privateWorkspaceFixture(t,{allowManualFinance:true,allowManualBudgets:true,allowBudgetPlanner:true}).tab();await tab.login();
 assert.equal((await(await tab.fetcher('/dev-config.json')).json()).privateBudgetPlanner,true);
 await tab.client.manualBudgetOpen(period);const seed=await tab.client.manualBudgetReview({budget:original});await tab.client.manualBudgetSave(seed.reviewId);
 const panel=createManualBudgetPanel({client:tab.client,allowPlanner:true});t.after(()=>panel.reset());
 const turn=()=>new Promise(r=>setImmediate(r));
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{budgetAction:action}})}});await turn();};
 const input=(form,name,value)=>panel.input({target:{form:{id:form},name,value,type:'text'}});
 const submit=async id=>{panel.submit({target:{id},preventDefault(){}});await turn();};
 input('budget-period','periodStart',period.periodStart);await submit('budget-period');await click('planner');
 input('budget-plan','reserveAmount','20.00');await submit('budget-plan');assert.match(panel.render(),/Use recorded spending proportions/);assert.doesNotMatch(panel.render(),/40\.01/);
 await click('amounts');assert.match(panel.render(),/\$40\.01/);await click('proposal-full');assert.match(panel.render(),/Approve budget save/);
 await click('back');await click('exit-planner');
 assert.deepEqual((await tab.client.manualBudgetOpen(period)).budget,original);
 panel.reset();input('budget-period','periodStart',period.periodStart);await submit('budget-period');await click('planner');
 input('budget-plan','reserveAmount','20');await submit('budget-plan');await click('proposal-reserve');assert.match(panel.render(),/Keep the selected reserve/);
 await click('approve');assert.doesNotMatch(panel.render(),/40\.01/);
 const saved=await tab.client.manualBudgetOpen(period);assert.equal(saved.version,2);
 assert.deepEqual(saved.budget,manualBudgetProposals(original,2000)[1].budget);
});
test('planner opt-in requires reviewed private budgets',async t=>{
 const flags=['--fixtures-only','--serve-private-dashboard','--allow-private-brief-read','--allow-private-manual-finance-reviewed','--allow-private-manual-budgets-reviewed','--allow-private-budget-planner-reviewed'];
 assert.equal(validatePrivatePreviewArguments(flags).allowBudgetPlanner,true);
 assert.throws(()=>validatePrivatePreviewArguments(flags.filter(s=>s!=='--allow-private-manual-budgets-reviewed')));
 const tab=privateWorkspaceFixture(t,{allowManualFinance:true,allowManualBudgets:true}).tab();
 assert.equal((await(await tab.fetcher('/dev-config.json')).json()).privateBudgetPlanner,undefined);
});
