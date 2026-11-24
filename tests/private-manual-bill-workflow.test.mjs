import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createManualBillPanel} from '../src/private-manual-bill-panel.mjs';
import {validatePrivatePreviewArguments} from '../tools/private-session-preview-server.mjs';

const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const bill={label:'Fictional utilities',dueDay:'2026-01-31',frequency:'monthly',interval:1,endDay:'',estimated:true,amountMinor:9000};
const range={from:'2026-01-01',to:'2026-03-31'};
const options={allowManualFinance:true,allowManualBills:true};
function snapshot(overrides={}){
 return {id:randomUUID(),owner_id:owner,household_id:null,visibility:'private',deleted_at:null,section:'Finances',item_type:'provider_bank_transaction',origin:'plaid_readonly',version:2,
  created_at:'2026-02-01T12:00:00Z',payload:{provider:'plaid',institution:'Chase',fictional:false,sourceId:randomUUID(),connectionId:randomUUID(),
   content:{currency:'USD',name:'Utilities',merchant:'Fictional electric',accountId:'fixture',date:'2026-01-29',amountMinor:8173,pending:false,pendingTransactionId:null,...overrides}}};
}
async function open(tab){
 const {bills}=await tab.client.manualBillList();
 const {billToken}=bills[0];
 return {billToken,...await tab.client.manualBillRead({billToken,...range})};
}
async function create(tab){
 await tab.client.manualBillList();
 const review=await tab.client.manualBillReview({bill});
 return tab.client.manualBillSave(review.reviewId);
}
test('signed-in bills require current schedule and occurrence, consume approval once, and preserve payment history after edits',async t=>{
 const app=privateWorkspaceFixture(t,options),a=app.tab(),b=app.tab();
 await a.login();await b.login();await create(a);
 const one=await open(a),two=await open(b),manual={dueDay:bill.dueDay,paidDay:'2026-02-02',amountMinor:8173};
 const unpaid=await a.client.manualBillReview({billToken:one.billToken,...manual});
 const edit=await b.client.manualBillReview({billToken:two.billToken,bill:{...bill,amountMinor:9500}});
 await b.client.manualBillSave(edit.reviewId);await assert.rejects(a.client.manualBillSave(unpaid.reviewId));
 const fresh=await open(a);
 const pending=await a.client.manualBillReview({billToken:fresh.billToken,...manual});
 await a.client.manualBillCancel();await assert.rejects(a.client.manualBillSave(pending.reviewId));
 const first=await open(a),second=await open(b);
 const r=await a.client.manualBillReview({billToken:first.billToken,...manual});
 const competing=await b.client.manualBillReview({billToken:second.billToken,...manual});
 await a.client.manualBillSave(r.reviewId);
 await assert.rejects(b.client.manualBillSave(competing.reviewId));await assert.rejects(a.client.manualBillSave(r.reviewId));
 const view=await open(b);
 assert.deepEqual(view.occurrences.map(o=>o.status),['Paid','Overdue','Overdue']);
 const change=await b.client.manualBillReview({billToken:view.billToken,bill:{...bill,label:'Renamed',dueDay:'2026-03-15',estimated:false}});
 await b.client.manualBillSave(change.reviewId);
 const [historical]=(await open(b)).occurrences;
 assert.equal(historical.label,bill.label);assert.equal(historical.expectedMinor,9500);assert.equal(historical.payment.amountMinor,8173);
 await assert.rejects(b.client.manualBillCandidates({billToken:view.billToken,dueDay:bill.dueDay,offset:0}));
});
test('Finance panel creates a bill and reviews the exact posted transaction before matching and reopening',async t=>{
 const row=snapshot(),rows=[snapshot({pending:true}),snapshot({amountMinor:-500}),row];
 const tab=privateWorkspaceFixture(t,{...options,allowSavedFinanceRead:true,allowSavedTransactionsRead:true,fixtureSavedTransactions:rows}).tab();
 await tab.login();
 const panel=createManualBillPanel({client:tab.client,allowMatching:true});t.after(()=>panel.reset());
 const turn=()=>new Promise(r=>setImmediate(r));
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{billAction:action}})}});await turn();};
 const input=(form,name,value)=>panel.input({target:{form:{id:form},name,value,checked:value,type:typeof value==='boolean'?'checkbox':'text'}});
 const submit=async id=>{panel.submit({target:{id},preventDefault(){}});await turn();};
 await click('load');await click('add');input('bill-edit','label',bill.label);input('bill-edit','dueDay',bill.dueDay);input('bill-edit','frequency','monthly');
 input('bill-edit','amount','90');input('bill-edit','estimated',true);await submit('bill-edit');
 assert.match(panel.render(),/Estimated \$90\.00/);await click('approve');
 async function select(){
  const selection=/data-bill-action="(select-[^"]+)"/.exec(panel.render());assert.ok(selection,panel.render());
  await click(selection[1]);input('bill-period','from',range.from);input('bill-period','to',range.to);await submit('bill-period');
 }
 await select();assert.doesNotMatch(panel.render(),/90\.00/);
 await click('match-0');
 assert.match(panel.render(),/Fictional electric/);assert.equal(panel.render().match(/Review match/g).length,1);assert.doesNotMatch(panel.render(),/connectionId|accountId|sourceId/);
 await click('match-tx-0');assert.match(panel.render(),/Paid \$81\.73 on 2026-01-29/);await click('approve');
 await select();assert.match(panel.render(),/Matched transaction/);assert.doesNotMatch(panel.render(),/81\.73/);
 await click('amounts');assert.match(panel.render(),/81\.73/);
 await click('pay-1');input('bill-edit','paidDay','2026-02-26');input('bill-edit','amount','72.50');await submit('bill-edit');
 assert.match(panel.render(),/Manually confirmed/);await click('approve');await select();assert.match(panel.render(),/Manual confirmation/);
 const openBill=await open(tab);
 const request={billToken:openBill.billToken,dueDay:'2026-03-31'};
 const available=await tab.client.manualBillCandidates({...request,offset:0});
 assert.deepEqual(available.transactions,[]);
 const replacement=snapshot();rows.push(replacement);
 const next=await open(tab);assert.equal(next.occurrences[2].payment,null);
 const nextRequest={billToken:next.billToken,dueDay:'2026-03-31'};
 const tx=(await tab.client.manualBillCandidates({...nextRequest,offset:0})).transactions[0];
 const stale=await tab.client.manualBillReview({...nextRequest,transactionToken:tx.transactionToken});
 replacement.version++;await assert.rejects(tab.client.manualBillSave(stale.reviewId));
 panel.reset();assert.doesNotMatch(panel.render(),/utilities|electric|72\.50/i);
});
test('launcher scopes bills independently, serves panel and requires signed-in authenticated requests',async t=>{
 const args=['--fixtures-only','--serve-private-dashboard','--allow-private-brief-read','--allow-private-manual-finance-reviewed','--allow-private-manual-bills-reviewed'];
 assert.equal(validatePrivatePreviewArguments(args).allowManualBills,true);
 assert.throws(()=>validatePrivatePreviewArguments(args.filter(s=>s!=='--allow-private-manual-finance-reviewed')));
 for(const on of [false,true]){
  const tab=privateWorkspaceFixture(t,{...options,allowManualBills:on}).tab();
  assert.equal((await(await tab.fetcher('/dev-config.json')).json()).privateManualBills,on?true:undefined);
  await tab.login();
  assert.equal((await tab.fetcher('/auth/workspace/manual-bills/list',{method:'POST',body:'{}'})).status,on?403:404);
  assert.equal((await tab.fetcher('/auth/workspace/manual-bills/candidates',{method:'POST',body:'{}'})).status,404);
 }
});

test('expired bill views drop an in-flight review and let the user reopen bills',async t=>{
 let now=Date.parse('2026-01-31T17:00:00Z'), resolveReview;
 const expiresAt=now+300000;
 const panel=createManualBillPanel({clock:()=>now,client:{
  manualBillList:async()=>({bills:[],expiresAt:now+300000}),
  manualBillReview:()=>new Promise(resolve=>{resolveReview=resolve;}),
 }});
 t.after(()=>panel.reset());
 const click=action=>panel.click({target:{closest:()=>({dataset:{billAction:action}})}});
 const turn=()=>new Promise(resolve=>setImmediate(resolve));
 click('load');await turn();click('add');
 for(const [name,value] of [['label','Fictional utilities'],['amount','90']]){
  panel.input({target:{form:{id:'bill-edit'},name,value,type:'text'}});
 }
 panel.submit({target:{id:'bill-edit'},preventDefault(){}});
 now=expiresAt;
 assert.equal(panel.blocked(),false);
 assert.match(panel.render(),/bill view expired/);
 click('load');await turn();
 resolveReview({bill:{...bill,frequency:'once',estimated:false},reviewId:'r'.repeat(43),expiresAt});await turn();
 assert.match(panel.render(),/Add bill/);
 assert.doesNotMatch(panel.render(),/Fictional utilities|Approve and save/);
});
