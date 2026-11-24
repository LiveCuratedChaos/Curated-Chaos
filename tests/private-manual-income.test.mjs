import test from 'node:test';
import assert from 'node:assert/strict';
import {manualIncomeForPeriod,manualIncomePayment,manualIncomeSchedule,scheduledIncomeOccurrences} from '../src/private-manual-income.mjs';
const base={label:'Manual paycheck',cadence:'weekly',startDay:'2026-01-30',endDay:'',expectedNetMinor:70000,monthDays:[],customDates:[]};
const days=(s,from,to)=>scheduledIncomeOccurrences(s,from,to).map(r=>r.expectedDay);
const receipt={expectedDay:'2026-01-30',slot:1,receivedDay:'2026-02-02',expectedNetMinor:70000,netMinor:69000,paystub:{grossMinor:90000,taxMinor:18000,otherDeductionsMinor:3000}};
test('all five income cadences use the original anchor, explicit dates and calendar month ends',()=>{
 assert.deepEqual(days(base,'2026-02-01','2026-02-28'),['2026-02-06','2026-02-13','2026-02-20','2026-02-27']);
 assert.deepEqual(days({...base,cadence:'biweekly'},'2026-02-01','2026-02-28'),['2026-02-13','2026-02-27']);
 const monthly={...base,cadence:'monthly',startDay:'2028-01-31'};
 assert.deepEqual(days(monthly,'2028-02-01','2028-03-31'),['2028-02-29','2028-03-31']);
 const twice={...base,cadence:'semi_monthly',monthDays:[30,31]};
 assert.deepEqual(scheduledIncomeOccurrences(twice,'2026-02-01','2026-02-28'),[{expectedDay:'2026-02-28',slot:1},{expectedDay:'2026-02-28',slot:2}]);
 const custom={...base,cadence:'custom',customDates:['2026-02-01','2026-02-21']};
 assert.deepEqual(days(custom,'2026-02-02','2026-02-28'),['2026-02-21']);
 assert.deepEqual(days({...base,endDay:'2026-02-07'},'2026-02-01','2026-02-28'),['2026-02-06']);
 assert.throws(()=>manualIncomeSchedule({...custom,customDates:['2026-02-01','2026-02-01']}));
});
test('expected pay is assigned to its scheduled period, actual net to the receipt date, and saved expectations survive later changes',()=>{
 const jan=manualIncomeForPeriod({...base,expectedNetMinor:75000},[receipt],'2026-01-01','2026-01-31');
 assert.equal(jan.expectedNetMinor,70000);assert.equal(jan.receivedNetMinor,0);assert.equal(jan.payments[0].receipt.receivedDay,'2026-02-02');
 const feb=manualIncomeForPeriod(base,[receipt],'2026-02-01','2026-02-28');
 assert.equal(feb.expectedNetMinor,280000);assert.equal(feb.receivedNetMinor,69000);assert.equal(feb.differenceMinor,-211000);
 assert.throws(()=>manualIncomeForPeriod(base,[receipt,receipt],'2026-02-01','2026-02-28'));
 assert.throws(()=>manualIncomePayment({...receipt,netMinor:68000}));
 assert.deepEqual(manualIncomePayment({...receipt,paystub:null}),{...receipt,paystub:null});
 assert.throws(()=>manualIncomeSchedule({...base,startDay:['2026-01-30']}));
});

import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createManualIncomePanel} from '../src/private-manual-income-panel.mjs';
import {validatePrivatePreviewArguments} from '../tools/private-session-preview-server.mjs';
const enabled={allowManualFinance:true,allowManualIncome:true};
const janRange={from:'2026-01-01',to:'2026-01-31'},febRange={from:'2026-02-01',to:'2026-02-28'};
test('signed-in income schedules and paychecks require review, preserve the reviewed expectation and reject competing payments',async t=>{
 const fixture=privateWorkspaceFixture(t,enabled),a=fixture.tab(),b=fixture.tab();
 await a.login();await b.login();await a.client.manualIncomeList();
 const add=await a.client.manualIncomeReview({schedule:base});await a.client.manualIncomeSave(add.reviewId);
 async function select(tab,range){
  const {sources}=await tab.client.manualIncomeList();assert.doesNotMatch(JSON.stringify(sources),/expectedNetMinor|payment|70000/);
  const {sourceToken}=sources[0];const data=await tab.client.manualIncomeRead({sourceToken,...range});
  return {sourceToken,...data};
 }
 let one=await select(a,janRange),two=await select(b,janRange);
 const {expectedNetMinor,...payment}=receipt;
 const first=await a.client.manualIncomeReview({sourceToken:one.sourceToken,payment});
 const second=await b.client.manualIncomeReview({sourceToken:two.sourceToken,payment});
 assert.deepEqual(first.payment,receipt);await a.client.manualIncomeSave(first.reviewId);
 await assert.rejects(b.client.manualIncomeSave(second.reviewId));await assert.rejects(a.client.manualIncomeSave(first.reviewId));
 two=await select(b,febRange);assert.equal(two.summary.receivedNetMinor,69000);assert.deepEqual(two.received,[receipt]);
 const change=await b.client.manualIncomeReview({sourceToken:two.sourceToken,schedule:{...base,expectedNetMinor:72000}});
 await b.client.manualIncomeSave(change.reviewId);
 one=await select(a,janRange);assert.equal(one.summary.payments[0].expectedNetMinor,70000);
 const corrected=await a.client.manualIncomeReview({sourceToken:one.sourceToken,payment:{...payment,netMinor:66000,paystub:null}});
 await a.client.manualIncomeSave(corrected.reviewId);two=await select(b,febRange);
 assert.equal(two.summary.receivedNetMinor,66000);assert.equal(two.received.length,1);
 await assert.rejects(b.client.manualIncomeReview({sourceToken:two.sourceToken,payment:{...payment,expectedDay:'2026-02-01'}}));
});
test('income panel creates an anchored schedule, records gross tax and net, and hides amounts on reopen',async t=>{
 const tab=privateWorkspaceFixture(t,enabled).tab();await tab.login();
 const panel=createManualIncomePanel({client:tab.client});t.after(()=>panel.reset());
 const turn=()=>new Promise(r=>setImmediate(r));
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{incomeAction:action}})}});await turn();};
 const input=(form,name,value)=>panel.input({target:{form:{id:form},name,value,checked:value,type:typeof value==='boolean'?'checkbox':'text'}});
 const submit=async id=>{panel.submit({target:{id},preventDefault(){}});await turn();};
 await click('load');await click('add');input('income-edit','label','Fictional payroll');input('income-edit','cadence','monthly');
 input('income-edit','startDay','2026-01-31');input('income-edit','expected','700.00');await submit('income-edit');
 assert.match(panel.render(),/Approve income save/);await click('approve');
 const select=async()=>{const id=/data-income-action="(select-[^"]+)"/.exec(panel.render())[1];await click(id);
  input('income-period','from',janRange.from);input('income-period','to',janRange.to);await submit('income-period');};
 await select();assert.match(panel.render(),/Awaiting receipt/);assert.doesNotMatch(panel.render(),/700.00/);
 await click('pay-0');input('income-edit','receivedDay','2026-01-31');input('income-edit','net','690.00');input('income-edit','stub',true);
 input('income-edit','gross','900');input('income-edit','tax','180');input('income-edit','other','30');await submit('income-edit');
 assert.match(panel.render(),/Gross \$900.00/);assert.match(panel.render(),/Net \$690.00/);
 await click('approve');await select();assert.doesNotMatch(panel.render(),/690.00/);await click('amounts');assert.match(panel.render(),/Received in this period<\/dt><dd>\$690.00/);
 panel.reset();assert.doesNotMatch(panel.render(),/payroll|690.00/);
});
test('income is enabled independently of budgets and requires sign-in and CSRF',async t=>{
 const args=['--fixtures-only','--serve-private-dashboard','--allow-private-brief-read','--allow-private-manual-finance-reviewed','--allow-private-manual-income-reviewed'];
 assert.equal(validatePrivatePreviewArguments(args).allowManualIncome,true);assert.throws(()=>validatePrivatePreviewArguments(args.filter(a=>a!=='--allow-private-manual-finance-reviewed')));
 for(const flag of [false,true]){
  const tab=privateWorkspaceFixture(t,{allowManualFinance:true,allowManualIncome:flag}).tab();
  const config=await(await tab.fetcher('/dev-config.json')).json();assert.equal(config.privateManualIncome,flag?true:undefined);assert.equal(config.privateManualBudgets,undefined);
  await tab.login();const result=await tab.fetcher('/auth/workspace/manual-income/list',{method:'POST',body:'{}'});assert.equal(result.status,flag?403:404);
 }
});
test('saved budget compares actual received income and expenses by period without exposing payment details',async t=>{
 const tab=privateWorkspaceFixture(t,{...enabled,allowManualBudgets:true}).tab();await tab.login();
 await tab.client.manualIncomeList();
 const add=await tab.client.manualIncomeReview({schedule:base});await tab.client.manualIncomeSave(add.reviewId);
 const {sourceToken}=(await tab.client.manualIncomeList()).sources[0];await tab.client.manualIncomeRead({sourceToken,...janRange});
 const {expectedNetMinor,...payment}=receipt;
 const review=await tab.client.manualIncomeReview({sourceToken,payment});await tab.client.manualIncomeSave(review.reviewId);
 const period={period:'month',periodStart:febRange.from,periodEnd:febRange.to};
 await tab.client.manualBudgetOpen(period);
 const proposed=await tab.client.manualBudgetReview({budget:{...period,plannedIncomeMinor:100000,allocations:[],transactions:[{category:'Food',day:'2026-02-09',amountMinor:3000}]}});
 await tab.client.manualBudgetSave(proposed.reviewId);await tab.client.manualBudgetOpen(period);
 const cash=await tab.client.manualBudgetCashFlow();
 assert.deepEqual({...cash,expiresAt:0},{period,sourceCount:1,expectedIncomeMinor:280000,receivedIncomeMinor:69000,recordedExpensesMinor:3000,
  manualNetCashFlowMinor:66000,incomeVarianceMinor:-31000,expiresAt:0});
 assert.doesNotMatch(JSON.stringify(cash),/paystub|2026-02-02|paycheck|grossMinor/);
 const off=privateWorkspaceFixture(t,{allowManualFinance:true,allowManualBudgets:true}).tab();await off.login();
 assert.equal((await off.fetcher('/auth/workspace/manual-budgets/cash-flow',{method:'POST',body:'{}'})).status,404);
});
