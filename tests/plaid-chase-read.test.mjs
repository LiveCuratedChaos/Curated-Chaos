import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaidChaseRead,usdMinor} from '../server/plaid-chase-read.mjs';
import {ProviderReadError} from '../server/provider-read-error.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const input=()=>({ownerId,connectionId,grant:{ownerId,connectionId,provider:'plaid',environment:'sandbox',institutionId:'ins_56',itemId:'fixture-item',products:['transactions'],accountIds:['fixture-account']},selectedAccountIds:['fixture-account'],accessToken:'access-sandbox-fixture',startDate:'2026-11-01',endDateExclusive:'2026-11-08'});
const item={item_id:'fixture-item',institution_id:'ins_56',error:null};
const transaction=(id='fixture-transaction')=>({transaction_id:id,account_id:'fixture-account',amount:19.99,date:'2026-11-03',name:'Fictional purchase',merchant_name:'Fixture shop',pending:false,pending_transaction_id:null,iso_currency_code:'USD',unofficial_currency_code:null,location:{address:'never return'},account_owner:'never return'});
function client(data){const calls=[];return {calls,api:createPlaidChaseRead({clientId:'fixture-client',secret:'fixture-secret'},async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>typeof data==='function'?data(calls.length):data};})};}
test('Chase adapter is limited to approved selected accounts and environment before any request',async()=>{
 const f=client({});for(const change of [{ownerId:connectionId},{selectedAccountIds:['unapproved']},{accessToken:'access-production-fixture'}])await assert.rejects(f.api.accounts({...input(),...change}));assert.equal(f.calls.length,0);
 assert.throws(()=>createPlaidChaseRead({clientId:'fixture-client',secret:'fixture-secret',environment:'production'}));
 const other=input();other.grant.institutionId='ins_other';await assert.rejects(f.api.accounts(other));assert.equal(f.calls.length,0);
});
test('account preview excludes identity details and preserves unavailable cached balances',async()=>{
 const f=client({item,accounts:[{account_id:'fixture-account',name:'Fictional Checking',type:'depository',subtype:'checking',balances:{current:105.25,available:null,iso_currency_code:'USD',unofficial_currency_code:null},routing_number:'never return',account_number:'never return'}]});
 const result=await f.api.accounts(input());assert.equal(result.accounts[0].currentMinor,10525);assert.equal(result.accounts[0].availableMinor,null);assert.equal(result.freshness,'provider-cached');assert.equal(result.sourceUpdatedAt,null);assert.doesNotMatch(JSON.stringify(result),/never return|fixture-secret|access-sandbox/);assert.equal(f.calls[0].url,'https://sandbox.plaid.com/accounts/get');assert.deepEqual(JSON.parse(f.calls[0].options.body).options.account_ids,['fixture-account']);assert.equal(f.calls[0].options.redirect,'error');
});
test('transaction preview enforces exact dates, signed amounts and no extra fields',async()=>{
 const row=transaction();row.amount=-150.25;const f=client({item,total_transactions:1,transactions:[row]}),result=await f.api.transactions(input());
 assert.equal(result.transactions[0].amountMinor,-15025);assert.equal(result.transactions[0].direction,'inflow');assert.doesNotMatch(JSON.stringify(result),/never return|fixture-secret|access-sandbox/);
 const request=JSON.parse(f.calls[0].options.body);assert.equal(request.start_date,'2026-11-01');assert.equal(request.end_date,'2026-11-07');assert.equal(f.calls[0].url,'https://sandbox.plaid.com/transactions/get');
});
test('pending and posted transactions keep their replacement relationship without automatic totals',async()=>{
 const posted=transaction('posted');posted.pending_transaction_id='pending';const pending={...transaction('pending'),pending:true};const f=client({item,total_transactions:2,transactions:[posted,pending]});const result=await f.api.transactions(input());assert.equal(result.transactions[0].pendingTransactionId,'pending');assert.equal(result.transactions[1].pending,true);assert.equal(result.total,undefined);
});
test('complete pagination succeeds but changing counts, duplicates or missing pages fail closed',async()=>{
 const f=client(page=>({item,total_transactions:2,transactions:[transaction('row'+page)]}));assert.equal((await f.api.transactions(input())).transactions.length,2);assert.equal(JSON.parse(f.calls[1].options.body).options.offset,1);
 for(const response of [page=>({item,total_transactions:page+1,transactions:[transaction('row'+page)]}),()=>({item,total_transactions:2,transactions:[transaction('duplicate')]}),page=>({item,total_transactions:2,transactions:page===1?[transaction()]:[]})])await assert.rejects(client(response).api.transactions(input()));
});
test('wrong item, unexpected account, currency, dates and excessive result sizes are rejected',async()=>{
 for(const data of [{item:{...item,item_id:'other'},total_transactions:1,transactions:[transaction()]},{item,total_transactions:501,transactions:[]},{item,total_transactions:1,transactions:[{...transaction(),account_id:'other'}]},{item,total_transactions:1,transactions:[{...transaction(),iso_currency_code:'EUR'}]},{item,total_transactions:1,transactions:[{...transaction(),date:'2026-11-08'}]}])await assert.rejects(client(data).api.transactions(input()));
 const f=client({});await assert.rejects(f.api.transactions({...input(),endDateExclusive:'2027-01-01'}));assert.equal(f.calls.length,0);
});
test('USD precision remains exact and invalid amounts never become zero',()=>{
 assert.equal(usdMinor(0),0);assert.equal(usdMinor(-19.99),-1999);assert.equal(usdMinor(null,{nullable:true}),null);for(const value of [NaN,Infinity,undefined,'12',1.001,1e20])assert.throws(()=>usdMinor(value));
});
test('provider failures do not expose raw response errors or credentials',async()=>{
 const api=createPlaidChaseRead({clientId:'fixture-client',secret:'fixture-secret'},async()=>({ok:false,json:async()=>({error_message:'sensitive provider detail fixture-secret'})}));await assert.rejects(api.transactions(input()),error=>!error.message.includes('fixture-secret')&&!error.message.includes('sensitive provider detail'));
});
test('bank failures distinguish reconnect, denied permission, changed selection and incomplete snapshots',async()=>{
 for(const [response,expected] of [
  [{ok:false,status:401,json:async()=>({error_code:'ITEM_LOGIN_REQUIRED',error_message:'private-bank-detail'})},'reconnect-required'],
  [{ok:false,status:403,json:async()=>({error_code:'PRIVATE_DENIAL'})},'access-denied'],
  [{ok:true,status:200,json:async()=>({error_code:'INVALID_ACCOUNT_ID',error_message:'private-bank-detail'})},'selection-changed'],
 ]){
  const api=createPlaidChaseRead({clientId:'fixture-client',secret:'fixture-secret'},async()=>response);
  await assert.rejects(api.transactions(input()),error=>error instanceof ProviderReadError&&error.outcome===expected&&!error.message.includes('private-bank-detail'));
 }
 let page=0;const api=createPlaidChaseRead({clientId:'fixture-client',secret:'fixture-secret'},async()=>({ok:true,status:200,json:async()=>++page===1?{item,total_transactions:2,transactions:[transaction('first-page')]}:{item,total_transactions:2,transactions:[]}}));
 await assert.rejects(api.transactions(input()),error=>error instanceof ProviderReadError&&error.outcome==='incomplete-read');
});
test('production calls require both approved environment and explicit live-data grant',async()=>{
 let calls=0;const api=createPlaidChaseRead({clientId:'fixture-client',secret:'fixture-secret',environment:'production',productionApproved:true},async()=>{calls++;return {ok:true,json:async()=>({})};});
 const request=input();request.grant.environment='production';request.accessToken='access-production-fixture';await assert.rejects(api.accounts(request));assert.equal(calls,0);
});
