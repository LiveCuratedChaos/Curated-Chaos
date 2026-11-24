import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createTransactionCategoryPanel} from '../src/private-transaction-category-panel.mjs';
import {validatePrivatePreviewArguments} from '../tools/private-session-preview-server.mjs';

const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const enabled={allowManualFinance:true,allowSavedFinanceRead:true,allowSavedTransactionsRead:true,allowTransactionCategories:true};
function saved(amountMinor,pending=false){
 return {id:randomUUID(),owner_id:owner,visibility:'private',household_id:null,section:'Finances',item_type:'provider_bank_transaction',origin:'plaid_readonly',deleted_at:null,version:1,
  created_at:'2026-01-02T14:00:00Z',payload:{fictional:false,connectionId:randomUUID(),sourceId:randomUUID(),provider:'plaid',institution:'Chase',
   content:{currency:'USD',date:'2026-01-02',name:'Fictional purchase',merchant:'Fictional vendor',accountId:'demo',pendingTransactionId:null,pending,amountMinor}}};
}
async function open(tab){
 const page=await tab.client.transactionCategoryOpen(0),{transactionToken}=page.items[0];
 assert.doesNotMatch(JSON.stringify(page),/amountMinor|sourceId|connectionId/);
 return {transactionToken,...await tab.client.transactionCategoryRead(transactionToken)};
}
test('posted categorization supports reimported sources and refuses stale, competing and repeated approvals',async t=>{
 const rows=[saved(4000)],source=structuredClone(rows),app=privateWorkspaceFixture(t,{...enabled,fixtureSavedTransactions:rows}),a=app.tab(),b=app.tab();
 await a.login();await b.login();const one=await open(a),two=await open(b);
 const categories={category:'Groceries',receiptReference:'Fictional R1'};
 const first=await a.client.transactionCategoryReview({transactionToken:one.transactionToken,categories});
 const second=await b.client.transactionCategoryReview({transactionToken:two.transactionToken,categories:{category:'Other'}});
 assert.deepEqual((await open(b)).categories,null);
 await a.client.transactionCategorySave(first.reviewId);await assert.rejects(a.client.transactionCategorySave(first.reviewId));await assert.rejects(b.client.transactionCategorySave(second.reviewId));
 assert.deepEqual(rows,source);assert.deepEqual((await open(b)).categories,categories);
 rows[0]={...rows[0],id:randomUUID(),version:1};
 const reimport=await open(a);assert.deepEqual(reimport.previous,{day:'2026-01-02',amountMinor:4000});assert.deepEqual(reimport.categories,categories);
 const review=await a.client.transactionCategoryReview({transactionToken:reimport.transactionToken,categories});
 rows[0].version++;await assert.rejects(a.client.transactionCategorySave(review.reviewId));
 rows[0].payload.content.pending=true;const pending=await open(a);await assert.rejects(a.client.transactionCategoryReview({transactionToken:pending.transactionToken,categories}));
});
test('selected credit can be split in the signed-in panel without changing its sign or exposing amounts after reopening',async t=>{
 const rows=[saved(-1200)],tab=privateWorkspaceFixture(t,{...enabled,fixtureSavedTransactions:rows}).tab();await tab.login();
 const panel=createTransactionCategoryPanel({client:tab.client});t.after(()=>panel.reset());
 const tick=()=>new Promise(r=>setImmediate(r));const click=async action=>{panel.click({target:{closest:()=>({dataset:{txCategory:action}})}});await tick();};
 const select=()=>click(/data-tx-category="(select-[^"]+)"/.exec(panel.render())[1]);
 const input=(name,value)=>panel.input({target:{form:{id:'saved-category-edit'},name,value}});
 const submit=async()=>{panel.submit({target:{id:'saved-category-edit'},preventDefault(){}});await tick();};
 await click('load');await select();assert.doesNotMatch(panel.render(),/12\.00/);await click('edit');await click('split');
 input('category-0','Food');input('amount-0','8');input('category-1','Travel');input('amount-1','3');await submit();assert.doesNotMatch(panel.render(),/Approve categories/);
 input('amount-1','4');input('receiptReference','Return 1');await submit();assert.match(panel.render(),/Inflow/);assert.match(panel.render(),/Return 1/);await click('approve');
 await select();assert.doesNotMatch(panel.render(),/8\.00|12\.00/);await click('amounts');assert.match(panel.render(),/Food · \$8\.00/);assert.match(panel.render(),/Travel · \$4\.00/);
 assert.equal(rows[0].payload.content.amountMinor,-1200);
 const cfg=await(await tab.fetcher('/dev-config.json')).json();assert.equal(cfg.privateTransactionCategories,true);
});
test('category route requires saved-source and manual write scopes',async t=>{
 const args=['--fixtures-only','--serve-private-dashboard','--allow-private-brief-read','--allow-private-manual-finance-reviewed','--allow-private-saved-finance-read','--allow-private-saved-transactions-read','--allow-private-transaction-categories-reviewed'];
 const off=privateWorkspaceFixture(t,{allowManualFinance:true}).tab();await off.login();
 assert.equal((await off.fetcher('/auth/workspace/transaction-categories/open',{method:'POST',body:'{}'})).status,404);
 const tab=privateWorkspaceFixture(t,enabled).tab();await tab.login();
 assert.equal((await tab.fetcher('/auth/workspace/transaction-categories/open',{method:'POST',body:'{}'})).status,403);
 assert.equal(validatePrivatePreviewArguments(args).allowTransactionCategories,true);
 assert.throws(()=>validatePrivatePreviewArguments(args.filter(x=>x!=='--allow-private-manual-finance-reviewed')));
});

test('manual expense reconciliation compares differing dates and amounts, preserves cash flow, and excludes each matched purchase',async t=>{
 const rows=[saved(4000),saved(3800)],app=privateWorkspaceFixture(t,{...enabled,allowManualBudgets:true,fixtureSavedTransactions:rows});
 const a=app.tab(),b=app.tab();await a.login();await b.login();
 const period={period:'month',periodStart:'2026-01-01',periodEnd:'2026-01-31'};
 const expense={day:'2026-01-01',amountMinor:3900,category:'Home',label:'Fictional manual purchase'};
 const budget={...period,allocations:[],transactions:[expense],plannedIncomeMinor:9000};
 await a.client.manualBudgetOpen(period);const put=await a.client.manualBudgetReview({budget});await a.client.manualBudgetSave(put.reviewId);
 const other=await open(b);
 const otherPage=await b.client.transactionExpenseCandidates({transactionToken:other.transactionToken,period,offset:0});
 const otherReview=await b.client.transactionCategoryReview({transactionToken:other.transactionToken,expenseToken:otherPage.items[0].expenseToken});
 const panel=createTransactionCategoryPanel({client:a.client,allowExpenseMatching:true});t.after(()=>panel.reset());
 const tick=()=>new Promise(r=>setImmediate(r));const click=async action=>{panel.click({target:{closest:()=>({dataset:{txCategory:action}})}});await tick();};
 async function select(){await click(/data-tx-category="(select-[^"]+)"/.exec(panel.render())[1]);}
 await click('load');await select();await click('start-match');assert.match(panel.render(),/Fictional manual purchase/);
 await click('expense-0');assert.match(panel.render(),/Posted minus recorded · \$1\.00/);
 assert.match(panel.render(),/Posted debit · 2026-01-02 · \$40\.00/);assert.match(panel.render(),/Manual expense · 2026-01-01 · \$39\.00/);
 await click('back');assert.match(panel.render(),/Review this match/);await click('expense-0');await click('approve');
 await assert.rejects(b.client.transactionCategorySave(otherReview.reviewId));
 await select();assert.match(panel.render(),/Matched manual expense/);assert.doesNotMatch(panel.render(),/39\.00|40\.00/);
 const result=(await a.client.manualBudgetOpen(period)).budget;
 assert.equal(result.transactions.length,1);assert.equal(result.transactions[0].amountMinor,3900);assert.equal(result.transactions[0].day,expense.day);
 assert.ok(result.transactions[0].reconciliationId);
 await assert.rejects(a.client.manualBudgetReview({budget}));await assert.rejects(a.client.manualBudgetReview({index:0,expense:{...result.transactions[0],amountMinor:4000}}));
 const unrelated=await a.client.manualBudgetReview({index:0,expense:{...result.transactions[0],category:'Updated'}});await a.client.manualBudgetSave(unrelated.reviewId);
 const otherTx=(await b.client.transactionCategoryOpen(0)).items[1].transactionToken;
 await b.client.transactionCategoryRead(otherTx);assert.deepEqual((await b.client.transactionExpenseCandidates({transactionToken:otherTx,period,offset:0})).items,[]);
});

test('a posted debit can link and reopen a private receipt before categorization, preserve it through editing and unlink only the reference',async t=>{
 const rows=[saved(4000)],original=structuredClone(rows),app=privateWorkspaceFixture(t,{...enabled,allowDocuments:true,fixtureSavedTransactions:rows}),tab=app.tab();
 await tab.login();
 const file=Buffer.from('%PDF-1.4\nFictional receipt\n%%EOF'),fields={name:'Merchant receipt.pdf',mime:'application/pdf',bytes:file.length,folder:'',tags:[]};
 await tab.client.documentList(0);await tab.client.documentSave((await tab.client.documentReview(fields,file.toString('base64'))).reviewId);
 const downloads=[],panel=createTransactionCategoryPanel({client:tab.client,allowDocuments:true,download:(data,meta)=>downloads.push([Buffer.from(data),meta.name])});
 t.after(()=>panel.reset());
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{txCategory:action}})}});await new Promise(r=>setImmediate(r));};
 const select=async()=>{const m=/data-tx-category="(select-[^"]+)"/.exec(panel.render());assert.ok(m,panel.render());await click(m[1]);};
 await click('load');await select();await click('receipts');
 const choice=/data-tx-category="(receipt-choose-[^"]+)"/.exec(panel.render());assert.ok(choice,panel.render());
 await click(choice[1]);assert.match(panel.render(),/Link library file · Merchant receipt.pdf/);await click('approve');await select();
 await click('receipts');await click('receipt-download');assert.deepEqual(downloads,[[file,fields.name]]);
 await click('receipt-close');await click('edit');
 panel.input({target:{form:{id:'saved-category-edit'},name:'category',value:'Household'}});
 panel.submit({target:{id:'saved-category-edit'},preventDefault(){}});await new Promise(r=>setImmediate(r));await click('approve');await select();
 await click('receipts');assert.match(panel.render(),/Attached document · Merchant receipt.pdf/);
 await click('receipt-unlink');assert.match(panel.render(),/keep the library file/);await click('approve');
 const detail=await open(tab);assert.equal(detail.categories.category,'Household');await assert.rejects(tab.client.savedTransactionReceiptDownload(detail.transactionToken));
 assert.equal((await tab.client.documentList(0)).documents.length,1);assert.deepEqual(rows,original);
});
