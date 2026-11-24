import test from 'node:test';
import assert from 'node:assert/strict';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createFinanceWidgets} from '../src/private-finance-widgets.mjs';
import {editWidgetLayouts} from '../src/dev-widget-layout-model.mjs';
import {validatePrivateWidgetLayouts,widgetLayoutDescription} from '../src/private-widget-layout.mjs';
import {newYorkTaskDay} from '../src/private-smart-task.mjs';

const hidden={showAmounts:false,showPercentages:false,limit:6};
const today=newYorkTaskDay(Date.now()),month=today.slice(0,7),first=month+'-01',last=new Date(first+'T00:00:00Z');
last.setUTCMonth(last.getUTCMonth()+1,0);
const period={period:'month',periodStart:first,periodEnd:last.toISOString().slice(0,10)};

test('saved budget, bill and holding widgets return only explicitly selected figures and preserve pending edits',async t=>{
 const {client,login}=privateWorkspaceFixture(t,{allowWidgetLayouts:true,allowManualFinance:true,allowManualBudgets:true,allowManualBills:true,allowHoldings:true}).tab();
 await login();await client.manualBudgetOpen(period);
 const budget={...period,plannedIncomeMinor:10000,allocations:[],transactions:[{category:'Food',amountMinor:2500,day:today}]};
 const prepared=await client.manualBudgetReview({budget});
 assert.deepEqual((await client.financeWidget('budget',hidden)).rows,[]);
 await client.manualBudgetSave(prepared.reviewId);
 const onlyPct=await client.financeWidget('budget',{...hidden,showPercentages:true});
 assert.deepEqual(onlyPct.rows[0],{label:'Recorded expenses',date:first,percentage:25});
 await client.manualBillList();
 const reviewedBill=await client.manualBillReview({bill:{label:'Water',frequency:'once',dueDay:today,amountMinor:2200,estimated:true,interval:1,endDay:''}});
 await client.manualBillSave(reviewedBill.reviewId);
 const bills=await client.financeWidget('bills',{...hidden,showAmounts:true});
 assert.deepEqual(bills.rows,[{label:'Water · Due (estimate)',date:today,amount:2200}]);
 await client.manualHoldingList();
 const preparedHolding=await client.manualHoldingReview({settings:{label:'Test holding',price:{day:today,amountMinor:1100},annualDividendMinor:null}});
 await client.manualHoldingSave(preparedHolding.reviewId);
 const {holdings}=await client.manualHoldingList();
 const trade=await client.manualHoldingReview({holdingToken:holdings[0].holdingToken,index:null,activity:{kind:'buy',day:today,amountMinor:1000,shareUnits:1000000}});
 await client.manualHoldingSave(trade.reviewId);
 const h=await client.financeWidget('investments',{...hidden,showAmounts:true,showPercentages:true});
 assert.deepEqual(h.rows,[{label:'Test holding',date:today,amount:1100,percentage:10}]);
 assert.deepEqual((await client.financeWidget('investments',hidden)).rows,[{label:'Test holding',date:today}]);
 await assert.rejects(client.financeWidget('investments',{...hidden,showAmounts:'true'}));
 await client.signOut();await assert.rejects(client.financeWidget('investments',hidden));
 const off=privateWorkspaceFixture(t,{allowWidgetLayouts:true}).tab();await off.login();await assert.rejects(off.client.financeWidget('budget',hidden));
});
test('individual amount and percentage choices survive layout save and never cross device or duplicate boundaries',async t=>{
 let layouts={desktop:[],tablet:[],phone:[]};
 layouts=editWidgetLayouts(layouts,'phone','add',null,'budget','first-widget');
 layouts=editWidgetLayouts(layouts,'phone','showPercentages','first-widget',true);
 layouts=editWidgetLayouts(layouts,'phone','duplicate','first-widget',null,'other-widget');
 layouts=editWidgetLayouts(layouts,'phone','showAmounts','other-widget',true);
 assert.equal(layouts.phone[0].showAmounts,undefined);
 const tab=privateWorkspaceFixture(t,{allowWidgetLayouts:true}).tab();await tab.login();
 const view=await tab.client.widgetLayoutRead(),review=await tab.client.widgetLayoutReview({layouts,baseTag:view.baseTag});
 await tab.client.widgetLayoutSave(review.reviewId);
 const saved=(await tab.client.widgetLayoutRead()).layouts;
 assert.deepEqual(saved,layouts);assert.match(widgetLayoutDescription(saved),/Amounts hidden \| Percentages shown/);
 assert.throws(()=>validatePrivateWidgetLayouts({...layouts,phone:[{...layouts.phone[0],type:'notes'}]}));
});
test('widget hides expired or concealed values, escapes labels, and refuses unexpected amounts or stale responses',async t=>{
 const now=Date.now();let hiddenScreen=false,reply;
 const widget={type:'investments',id:'investment-widget',...hidden,showPercentages:true};
 const client={financeWidget:()=>new Promise(r=>{reply=r;})};
 const ui=createFinanceWidgets({client,clock:()=>now,enabled:()=>true,concealed:()=>hiddenScreen,onChange(){}});
 t.after(()=>ui.reset());
 const response={type:'investments',month,total:1,rows:[{label:'<Test>',date:today,percentage:10}],expiresAt:now+10000};
 let work=ui.open(widget);reply(response);await work;
 assert.match(ui.render(widget),/&lt;Test&gt;.*10%/);assert.doesNotMatch(ui.render(widget),/\$|<Test>/);
 work=ui.open(widget);ui.reset();hiddenScreen=true;reply(response);await work;
 assert.doesNotMatch(ui.render(widget),/10%|Test/);hiddenScreen=false;assert.doesNotMatch(ui.render(widget),/10%/);
 work=ui.open(widget);reply({...response,rows:[{...response.rows[0],amount:500}]});await work;
 assert.match(ui.render(widget),/Could not open/);
 work=ui.open(widget);reply({...response,expiresAt:now});await work;assert.doesNotMatch(ui.render(widget),/10%/);
});

test('selected Brief date reads scheduled and paid bills with current status and no amounts or source handles',async t=>{
 const tab=privateWorkspaceFixture(t,{allowBriefLayout:true,allowManualFinance:true,allowManualBills:true}).tab();
 await tab.login();
 await tab.client.manualBillList();
 const due='2026-01-20';
 const review=await tab.client.manualBillReview({bill:{label:'January internet',frequency:'once',dueDay:due,amountMinor:4200,estimated:false,interval:1,endDay:''}});
 await tab.client.manualBillSave(review.reviewId);
 const list=await tab.client.manualBillList(),billToken=list.bills[0].billToken;
 const before=await tab.client.briefBills(due);
 assert.deepEqual(before.rows,[{label:'January internet',status:due<today?'Overdue':'Due'}]);
 await tab.client.manualBillRead({billToken,from:due,to:due});
 const confirmation=await tab.client.manualBillReview({billToken,dueDay:due,paidDay:due,amountMinor:4500});
 await tab.client.manualBillSave(confirmation.reviewId);
 const paid=await tab.client.briefBills(due);
 assert.equal(paid.day,due);assert.equal(paid.currentDay,today);assert.equal(paid.total,1);
 assert.deepEqual(paid.rows,[{label:'January internet',status:'Paid'}]);
 assert.doesNotMatch(JSON.stringify(paid),/4200|4500|amount|billToken|owner_id|accountId/);
 assert.equal((await tab.client.briefBills('2026-01-21')).total,0);
 await assert.rejects(tab.client.briefBills('2026-02-30'));
 await tab.client.signOut();await assert.rejects(tab.client.briefBills(due));
 for(const features of [{allowBriefLayout:true},{allowManualFinance:true,allowManualBills:true}]){
  const off=privateWorkspaceFixture(t,features).tab();await off.login();await assert.rejects(off.client.briefBills(due));
 }
});

test('identically named Brief bills open their own schedule without replacing a pending payment review',async t=>{
 const app=privateWorkspaceFixture(t,{allowBriefLayout:true,allowManualFinance:true,allowManualBills:true});
 const tab=app.tab(),other=app.tab();
 await tab.login();await other.login();
 for(const frequency of ['monthly','once']){
  await tab.client.manualBillList();
  const review=await tab.client.manualBillReview({bill:{label:'Same bill',dueDay:today,frequency,interval:1,endDay:'',amountMinor:3700,estimated:false}});
  await tab.client.manualBillSave(review.reviewId);
 }
 const manual=await tab.client.manualBillList(),billToken=manual.bills[0].billToken;
 await tab.client.manualBillRead({billToken,from:today,to:today});
 const review=await tab.client.manualBillReview({billToken,dueDay:today,paidDay:today,amountMinor:3700});
 const brief=await tab.client.briefBills(today,true);
 const titles=brief.rows.map(r=>r.label);assert.deepEqual(titles,['Same bill','Same bill']);
 const keys=brief.rows.map(r=>r.billReadToken);assert.equal(new Set(keys).size,2);
 await assert.rejects(other.client.briefBillSource(keys[0]));
 const frequencies=[];
 for(const key of keys){
  const read=await tab.client.briefBillSource(key);
  frequencies.push(read.frequency);assert.equal(read.firstDueDay,today);assert.equal(read.status,'Due');
  assert.equal(read.expiresAt,brief.expiresAt);
  assert.doesNotMatch(JSON.stringify(read),/amount|3700|billToken|account|ownerId/);
 }
 assert.deepEqual(frequencies.sort(),['monthly','once']);
 await tab.client.manualBillSave(review.reviewId);
 let refused=0;
 for(const key of keys){try{await tab.client.briefBillSource(key);}catch{refused++;}}
 assert.equal(refused,1);
 await tab.client.briefBills(today,true);
 await assert.rejects(tab.client.briefBillSource(keys[0]));
});

test('eleven bills page within one dated view and refuse changed inventory',async t=>{
 const app=privateWorkspaceFixture(t,{allowBriefLayout:true,allowManualFinance:true,allowManualBills:true});
 const tab=app.tab(),other=app.tab();await tab.login();await other.login();
 for(let i=0;i<11;i++){
  await tab.client.manualBillList();
  const bill={label:'Fixture bill '+String(i+1).padStart(2,'0'),dueDay:today,frequency:'once',interval:1,endDay:'',estimated:false,amountMinor:100};
  const review=await tab.client.manualBillReview({bill});await tab.client.manualBillSave(review.reviewId);
 }
 await assert.rejects(tab.client.briefBillsPage(today,10));
 const first=await tab.client.briefBillsPage(today,0);
 assert.equal(first.rows.length,10);assert.equal(first.total,11);
 await assert.rejects(other.client.briefBillsPage(today,10,first.viewToken));
 const second=await tab.client.briefBillsPage(today,10,first.viewToken);
 assert.equal(second.day,today);assert.equal(second.offset,10);assert.equal(second.total,11);
 assert.equal(second.expiresAt,first.expiresAt);assert.equal(second.viewToken,first.viewToken);
 assert.deepEqual(second.rows.map(r=>r.label),['Fixture bill 11']);
 assert.equal((await tab.client.briefBillSource(second.rows[0].billReadToken)).scheduleLabel,'Fixture bill 11');
 await assert.rejects(tab.client.briefBillSource(first.rows[0].billReadToken));
 const back=await tab.client.briefBillsPage(today,0,second.viewToken);
 assert.deepEqual(back.rows.map(r=>r.label),first.rows.map(r=>r.label));
 const manual=await other.client.manualBillList(),choice=manual.bills.find(b=>b.label==='Fixture bill 11');
 const selected=await other.client.manualBillRead({billToken:choice.billToken,from:today,to:today});
 const edit=await other.client.manualBillReview({billToken:choice.billToken,bill:{...selected.bill,label:'Renamed bill 11'}});
 await other.client.manualBillSave(edit.reviewId);
 await assert.rejects(tab.client.briefBillsPage(today,10,first.viewToken));
 await assert.rejects(tab.client.briefBillSource(back.rows[0].billReadToken));
});

test('the detailed week counts recurring, unpaid and confirmed bills on their due dates',async t=>{
 const features={allowBriefLayout:true,allowBriefDates:true,allowManualFinance:true,allowManualBills:true};
 const tab=privateWorkspaceFixture(t,features).tab();await tab.login();
 for(const bill of [
  {label:'Phone plan',frequency:'monthly',dueDay:'2025-12-20'},
  {label:'Storage',frequency:'once',dueDay:'2026-01-20'},
  {label:'Membership',frequency:'weekly',dueDay:'2026-01-18'}
 ]){
  await tab.client.manualBillList();
  const review=await tab.client.manualBillReview({bill:{...bill,amountMinor:4399,estimated:false,interval:1,endDay:''}});
  await tab.client.manualBillSave(review.reviewId);
 }
 const phone=(await tab.client.manualBillList()).bills.find(b=>b.label==='Phone plan');
 await tab.client.manualBillRead({billToken:phone.billToken,from:'2026-01-20',to:'2026-01-20'});
 const payment=await tab.client.manualBillReview({billToken:phone.billToken,dueDay:'2026-01-20',paidDay:'2026-01-19',amountMinor:4399});
 const fields={anchor:'2026-01-18',range:'rolling',weekStart:1};
 const before=await tab.client.briefBillWeek(fields);
 assert.deepEqual(before.days[2],{day:'2026-01-20',paid:0,unpaid:2});
 await tab.client.manualBillSave(payment.reviewId);
 const result=await tab.client.briefBillWeek(fields);
 assert.equal(result.days.length,7);
 assert.deepEqual(result.days.filter(row=>row.paid+row.unpaid),[
  {day:'2026-01-18',paid:0,unpaid:1},{day:'2026-01-20',paid:1,unpaid:1}
 ]);
 assert.doesNotMatch(JSON.stringify(result),/Phone|Storage|Membership|4399|amount|owner_id|Token/);
 const calendar=await tab.client.briefBillWeek({...fields,range:'calendar'});
 assert.equal(calendar.days[0].day,'2026-01-12');
 assert.deepEqual(calendar.days.filter(r=>r.paid+r.unpaid),[{day:'2026-01-18',paid:0,unpaid:1}]);
 const edge=await tab.client.briefBillWeek({...fields,anchor:'2100-12-31'});assert.equal(edge.days.length,1);
 await assert.rejects(tab.client.briefBillWeek({...fields,weekStart:7}));
 await tab.client.signOut();await assert.rejects(tab.client.briefBillWeek(fields));
 const off=privateWorkspaceFixture(t,{...features,allowBriefDates:false}).tab();await off.login();
 await assert.rejects(off.client.briefBillWeek(fields));
});
