import test from 'node:test';
import assert from 'node:assert/strict';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createManualBudgetPanel} from '../src/private-manual-budget-panel.mjs';
import {newYorkTaskDay} from '../src/private-smart-task.mjs';

const bytes=Buffer.from('%PDF-1.5\nFictional private receipt\n%%EOF'),fields={name:'Receipt.pdf',mime:'application/pdf',bytes:bytes.length,folder:'',tags:[]};
const day=newYorkTaskDay(Date.now()),first=day.slice(0,7)+'-01',last=new Date(first+'T00:00:00Z');last.setUTCMonth(last.getUTCMonth()+1,0);
const period={period:'month',periodStart:first,periodEnd:last.toISOString().slice(0,10)};
const expense={category:'Food',amountMinor:1245,day,receiptReference:'Original receipt note'};
async function setup(t){
 const app=privateWorkspaceFixture(t,{allowManualFinance:true,allowManualBudgets:true,allowDocuments:true}),a=app.tab(),b=app.tab();
 await a.login();await b.login();
 await a.client.documentList(0);await a.client.documentSave((await a.client.documentReview(fields,bytes.toString('base64'))).reviewId);
 await a.client.manualBudgetOpen(period);await a.client.manualBudgetSave((await a.client.manualBudgetReview({budget:{...period,plannedIncomeMinor:9000,allocations:[],transactions:[expense]}})).reviewId);
 return {a,b};
}
test('transaction history attaches an existing file by review, downloads its original bytes, and unlinks it without deleting anything',async t=>{
 const {a}=await setup(t),downloads=[];
 const panel=createManualBudgetPanel({client:a.client,allowDocuments:true,download:(data,f)=>downloads.push([Buffer.from(data),f.name])});t.after(()=>panel.reset());
 const turn=()=>new Promise(r=>setImmediate(r));
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{budgetAction:action}})}});await turn();};
 await click('transactions');assert.match(panel.render(),/Attach receipt file/);
 await click('receipt-at-0');assert.match(panel.render(),/Choose Receipt.pdf/);
 const choice=/data-budget-action="(receipt-choose-[^"]+)"/.exec(panel.render())[1];
 await click(choice);assert.match(panel.render(),/Link library file · Receipt.pdf/);assert.match(panel.render(),/Original receipt note/);
 await click('approve');assert.match(panel.render(),/Manage receipt file/);assert.doesNotMatch(panel.render(),/12\.45/);
 await click('receipt-at-0');await click('receipt-download');assert.deepEqual(downloads,[[bytes,'Receipt.pdf']]);
 const selected=(await a.client.documentList(0)).documents[0];
 const edit=await a.client.documentOrganize(selected.choice,{name:'Filed original.pdf',folder:'Receipts',tags:['Food']});
 await a.client.documentSave(edit.reviewId);await click('receipt-download');
 assert.match(panel.render(),/Reopen the transaction/);assert.equal(downloads.length,1);
 await click('receipt-close');await click('receipt-at-0');await click('receipt-download');assert.deepEqual(downloads.at(-1),[bytes,'Filed original.pdf']);
 await click('receipt-unlink');assert.match(panel.render(),/keep the library file/);await click('approve');
 assert.equal((await a.client.documentList(0)).documents.length,1);
 const v=await a.client.manualBudgetOpen(period);assert.deepEqual(v.budget.transactions,[expense]);
});
test('receipt choices stay bound to the original budget view and survive category corrections and concurrent conflicts',async t=>{
 const {a,b}=await setup(t);
 await a.client.manualBudgetOpen(period);await b.client.manualBudgetOpen(period);
 const choices=await a.client.manualExpenseReceipts(0,0);
 await assert.rejects(b.client.manualBudgetReview({index:0,receiptChoice:choices.files[0].choice}));
 const r=await a.client.manualBudgetReview({index:0,receiptChoice:choices.files[0].choice});
 const bUpdate=await b.client.manualBudgetReview({index:0,expense:{...expense,label:'Edited'}});
 await b.client.manualBudgetSave(bUpdate.reviewId);await assert.rejects(a.client.manualBudgetSave(r.reviewId));
 await a.client.manualBudgetOpen(period);const refreshed=await a.client.manualExpenseReceipts(0,0);
 await a.client.manualBudgetSave((await a.client.manualBudgetReview({index:0,receiptChoice:refreshed.files[0].choice})).reviewId);
 const stored=(await a.client.manualBudgetOpen(period)).budget.transactions[0];
 await assert.rejects(a.client.manualBudgetReview({index:0,expense}));
 const correction=await a.client.manualBudgetReview({index:0,expense:{...stored,category:'Groceries'}});
 await a.client.manualBudgetSave(correction.reviewId);await a.client.manualBudgetOpen(period);
 const downloaded=await a.client.manualExpenseReceiptDownload(0);assert.equal(downloaded.data,bytes.toString('base64'));
});
