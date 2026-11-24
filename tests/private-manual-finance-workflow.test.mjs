import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePrivatePreviewArguments} from '../tools/private-session-preview-server.mjs';
import {createManualFinancePanel} from '../src/private-manual-finance-panel.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createManualFinanceStorage} from '../server/private-manual-finance-storage.mjs';

const account={label:'Rainy day',type:'savings',balanceMinor:13250,showInAccountList:false,includeInBudget:true};
const fixture=(t,enabled=true)=>privateWorkspaceFixture(t,{allowManualFinance:enabled});
async function turn(){await new Promise(resolve=>setImmediate(resolve));}
test('manual account routes use sign-in, explicit approval, single-use reviews and versioned edits across sessions',async t=>{
 const f=fixture(t),a=f.tab(),b=f.tab();
 await a.login();await b.login();
 assert.equal((await a.client.manualAccountsList()).accounts.length,0);
 await assert.rejects(a.client.manualAccountsReview({account,owner_id:'foreign'}));
 const review=await a.client.manualAccountsReview({account});
 await assert.rejects(b.client.manualAccountsSave(review.reviewId));
 assert.equal((await b.client.manualAccountsList()).accounts.length,0);
 await a.client.manualAccountsSave(review.reviewId);
 await assert.rejects(a.client.manualAccountsSave(review.reviewId));
 const [one,two]=await Promise.all([a.client.manualAccountsList(),b.client.manualAccountsList()]);
 assert.deepEqual(one.accounts[0].account,account);
 const reviewedA=await a.client.manualAccountsReview({accountToken:one.accounts[0].accountToken,account:{...account,label:'Updated'}});
 const reviewedB=await b.client.manualAccountsReview({accountToken:two.accounts[0].accountToken,account:{...account,label:'Older change'}});
 await a.client.manualAccountsSave(reviewedA.reviewId);
 await assert.rejects(b.client.manualAccountsSave(reviewedB.reviewId));
 const latest=await b.client.manualAccountsList();
 assert.equal(latest.accounts[0].account.label,'Updated');
 const cancel=await b.client.manualAccountsReview({accountToken:latest.accounts[0].accountToken,account});
 await b.client.manualAccountsCancel();
 await assert.rejects(b.client.manualAccountsSave(cancel.reviewId));
});
test('private finance panel creates a hidden account, includes its balance, edits it, and removes private state on reset',async t=>{
 const a=fixture(t).tab();await a.login();const panel=createManualFinancePanel({client:a.client});t.after(()=>panel.reset());
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{manualAccount:action}})}});await turn();};
 const field=(name,value)=>panel.input({target:{form:{id:'manual-account-edit'},name,value,checked:value,type:typeof value==='boolean'?'checkbox':'text'}});
 const submit=async()=>{panel.submit({target:{id:'manual-account-edit'},preventDefault(){}});await turn();};
 await click('load');await click('add');field('label','Fictional hidden');field('balance','123.40');field('showInAccountList',false);
 await submit();assert.match(panel.render(),/Hidden from accounts.*Included in total/);await click('save');
 assert.doesNotMatch(panel.render(),/123.40|Fictional hidden/);await click('amounts');
 assert.match(panel.render(),/Total balance: \$123.40/);await click('manage');assert.match(panel.render(),/Fictional hidden/);
 await click('edit-'+/data-manual-account="edit-([^"]+)"/.exec(panel.render())[1]);field('includeInBudget',false);field('showInAccountList',true);await submit();await click('save');
 assert.match(panel.render(),/Fictional hidden/);await click('amounts');assert.match(panel.render(),/Total balance: \$0.00/);panel.reset();assert.doesNotMatch(panel.render(),/123.40|Fictional hidden/);
});
test('manual account activation is explicit, independent of the bank reader, and CSRF protected',async t=>{
 const args=['--fixtures-only','--serve-private-dashboard','--allow-private-brief-read','--allow-private-manual-finance-reviewed'];
 assert.equal(validatePrivatePreviewArguments(args).allowManualFinance,true);assert.throws(()=>validatePrivatePreviewArguments(args.filter(a=>a!=='--allow-private-brief-read')));
 for(const enabled of [false,true]){
  const a=fixture(t,enabled).tab();const conf=await(await a.fetcher('/dev-config.json')).json();
  assert.equal(conf.privateManualFinance,enabled?true:undefined);assert.equal(conf.privateSavedFinance,undefined);
  await a.login();
  const res=await a.fetcher('/auth/workspace/manual-accounts/list',{method:'POST',body:'{}'});
  assert.equal(res.status,enabled?403:404);
 }
});
test('database transport seals balances, scopes reads, binds ciphertext to version and uses version on write',async()=>{
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 let stored,previous,reads=0;
 const api=createManualFinanceStorage(async(path,options,token)=>{
  assert.equal(token,'test');
  if(options.body){
   assert.doesNotMatch(options.body,/Rainy day|balanceMinor|13250/);
   const body=JSON.parse(options.body);
   if(options.method==='POST')stored={...body,version:1,deleted_at:null};
   else {assert.match(path,/&version=eq.1/);previous=stored.payload;stored={...stored,...body,version:2};}
  }
  else {assert.match(path,/owner_id=eq.aaaaaaaa/);assert.match(path,/item_type=eq.manual_finance_account/);}
  return stored?[structuredClone(stored)]:[];
 },async()=>{reads++;return Buffer.alloc(32,4);});
 assert.deepEqual(await api.listManualFinanceAccounts('test',owner),[]);assert.equal(reads,0);
 const record={id,owner_id:owner,household_id:null,visibility:'private',section:'Finances',item_type:'manual_finance_account',origin:'PRIVATE_MANUAL_FINANCE',payload:{account,fictional:true,version:1,ownerId:owner}};
 const [created]=await api.addManualFinanceAccount('test',record);
 const [updated]=await api.updateManualFinanceAccount('test',created,owner,{...record,payload:{...record.payload,account:{...account,includeInBudget:false}}});
 assert.equal(updated.payload.account.includeInBudget,false);
 stored.payload=previous;
 await assert.rejects(api.getManualFinanceAccount('test',id,owner));
});
test('concurrent manual-account creation cannot reserve different identities for the last slot',async t=>{
 const f=fixture(t),a=f.tab(),b=f.tab();await a.login();await b.login();
 for(let i=0;i<99;i++){
  await a.client.manualAccountsList();
  const proposal=await a.client.manualAccountsReview({account:{...account,label:'Fictional '+i}});
  await a.client.manualAccountsSave(proposal.reviewId);
 }
 await Promise.all([a.client.manualAccountsList(),b.client.manualAccountsList()]);
 const one=await a.client.manualAccountsReview({account}),two=await b.client.manualAccountsReview({account:{...account,label:'Other label'}});
 const results=await Promise.allSettled([a.client.manualAccountsSave(one.reviewId),b.client.manualAccountsSave(two.reviewId)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await b.client.manualAccountsList()).accounts.length,100);
 await assert.rejects(b.client.manualAccountsReview({account}));
});
