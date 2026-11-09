import test from 'node:test';
import assert from 'node:assert/strict';
import {planChaseImport} from '../server/chase-import-plan.mjs';
import {savedFinanceRecords} from '../server/saved-finance-records.mjs';
import {createProviderImportExecutor} from '../server/provider-import-executor.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',selectionId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const common={ownerId,connectionId,provider:'plaid',institution:'Chase',visibility:'private',currency:'USD',accountId:'fixture-account'};
const args=()=>({ownerId,connectionId,selectionId,selectedKeys:['account-key','transaction-key'],preview:{ownerId,connectionId,selectionId,complete:true,previewOnly:true,databaseWritten:false,provider:'plaid',institution:'Chase',startDate:'2026-11-01',endDateExclusive:'2026-11-08',accounts:[{...common,key:'account-key',name:'Fictional checking',type:'depository',subtype:'checking',currentMinor:12345,availableMinor:null,balanceFreshness:'provider-cached',routing_number:'excluded-secret'}],transactions:[{...common,key:'transaction-key',transactionId:'fixture-transaction',date:'2026-11-03',name:'Fictional purchase <script>',merchant:'Fixture shop',amountMinor:1999,pending:true,pendingTransactionId:null,raw_account_number:'excluded-secret'}]}});
test('financial plan saves only explicit private snapshots and never creates payments or tasks',()=>{
 const result=planChaseImport(args());assert.equal(result.executed,false);assert.equal(result.requiresApproval,true);assert.deepEqual(result.deletes,[]);assert.deepEqual(result.actions.map(a=>a.record.item_type),['provider_bank_account','provider_bank_transaction']);assert.ok(result.actions.every(a=>a.record.section==='Finances'&&a.record.household_id===null&&a.record.visibility==='private'));assert.doesNotMatch(JSON.stringify(result),/excluded-secret|routing_number|raw_account_number/);assert.deepEqual(planChaseImport({...args(),selectedKeys:[]}).actions,[]);
});
test('financial retries are deterministic; changed, manual and deleted records cannot be overwritten',()=>{
 const first=planChaseImport(args()),existing=first.actions.map(a=>({...a.record,version:1}));const retry=planChaseImport({...args(),existing});assert.ok(retry.actions.every(a=>a.action==='unchanged'));
 const changed=args();changed.preview.accounts[0].currentMinor=999;assert.equal(planChaseImport({...changed,existing}).actions[0].action,'review-update');
 for(const change of [{origin:'manual'},{deleted_at:'2026-11-08T00:00:00Z'},{visibility:'household'}])assert.throws(()=>planChaseImport({...args(),existing:[{...existing[0],...change},existing[1]]}));
});
test('mixed owners, invalid money, unknown selections and out-of-window transactions fail closed',()=>{
 const mixed=args();mixed.preview.transactions[0].ownerId=connectionId;assert.throws(()=>planChaseImport(mixed));
 const money=args();money.preview.accounts[0].currentMinor=12.34;assert.throws(()=>planChaseImport(money));
 const outside=args();outside.preview.transactions[0].date='2026-11-08';assert.throws(()=>planChaseImport(outside));assert.throws(()=>planChaseImport({...args(),selectedKeys:['invented']}));
});
test('saved financial view minimizes fields, namespaces account links and keeps null/pending values',()=>{
 const records=planChaseImport(args()).actions.map(a=>({...a.record,created_at:'2026-11-08T12:00:00Z'})),view=savedFinanceRecords(records,ownerId);assert.equal(view.saved,true);assert.equal(view.accounts[0].availableMinor,null);assert.equal(view.transactions[0].pending,true);assert.equal(view.transactions[0].accountId,view.accounts[0].accountId);assert.equal(view.transactions[0].amountMinor,1999);assert.doesNotMatch(JSON.stringify(view),/excluded-secret/);
 assert.throws(()=>savedFinanceRecords([{...records[0],owner_id:connectionId}],ownerId));assert.throws(()=>savedFinanceRecords([records[0],records[0]],ownerId));
});
test('generic executor supports financial plans without enabling writes by default',async()=>{
 const state={rows:[],writes:0},actor={binding:'fixture-owner-session'},repository={readByIds:async()=>state.rows,insertMany:async(_actor,_owner,records)=>{state.writes++;state.rows=records.map(r=>({...r,version:1,deleted_at:null}));return state.rows;}};
 const resolveActor=async()=>({ownerId,sessionBinding:actor.binding}),disabled=createProviderImportExecutor({repository,resolveActor,planImport:planChaseImport});let review=await disabled.prepare(actor,args());await assert.rejects(disabled.execute(actor,{reviewId:review.reviewId,approved:true}));assert.equal(state.writes,0);
 const enabled=createProviderImportExecutor({repository,resolveActor,planImport:planChaseImport,authorizeWrite:async()=>true});review=await enabled.prepare(actor,args());assert.equal((await enabled.execute(actor,{reviewId:review.reviewId,approved:true})).inserted,2);review=await enabled.prepare(actor,args());assert.equal(review.unchangedCount,2);await enabled.execute(actor,{reviewId:review.reviewId,approved:true});assert.equal(state.writes,1);
});
test('financial import CLI stays offline and requires an exact transaction cap',async()=>{
 const {validateChaseImportArguments}=await import('../tools/import-reviewed-chase.mjs');assert.equal(validateChaseImportArguments([]),null);
 const flags=['--allow-financial-import','--project=fngauurauwvbawlfzbbe','--accounts=3','--max-transactions=29','--start=2026-11-01','--end=2026-11-08'];assert.equal(validateChaseImportArguments(flags).maxTransactions,29);assert.throws(()=>validateChaseImportArguments(flags.filter(a=>!a.startsWith('--max-transactions='))));assert.throws(()=>validateChaseImportArguments(flags.map(a=>a.startsWith('--max-transactions=')?'--max-transactions=250':a)));
 const {execFileSync}=await import('node:child_process'),{fileURLToPath}=await import('node:url'),output=execFileSync(process.execPath,[fileURLToPath(new URL('../tools/import-reviewed-chase.mjs',import.meta.url))],{cwd:'/private/tmp',encoding:'utf8'});assert.match(output,/PLAN ONLY/);assert.match(output,/no credentials read, no network requests, no database writes/);
});
