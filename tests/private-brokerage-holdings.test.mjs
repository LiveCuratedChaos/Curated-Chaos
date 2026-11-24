import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrokerageHoldingsSource} from '../server/private-brokerage-holdings.mjs';
import {createBrokeragePanel} from '../src/private-brokerage-panel.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {validatePrivatePreviewArguments} from '../tools/private-session-preview-server.mjs';

const now=Date.parse('2026-11-22T12:00:00Z'),actor={ownerId:'fixture-owner'};
function fixture(){
 const grant={scope:'investments',ownerId:actor.ownerId,environment:'sandbox',status:'authorized',institution:'Example brokerage',institutionId:'fixture-institution',
  itemId:'fixture-item',revision:1,connectionId:'fixture-connection',accessToken:'access-sandbox-sample',accounts:[{id:'chosen',name:'Retirement'},{id:'other',name:'Taxable'}]};
 const data={item:{item_id:grant.itemId,institution_id:grant.institutionId},accounts:[{account_id:'chosen',type:'investment'}],securities:[{security_id:'fund',name:'Index fund'}],
  holdings:[{security_id:'fund',account_id:'chosen',quantity:10.5,institution_price:1.234567,institution_value:13.04,iso_currency_code:'USD',institution_price_as_of:'2026-11-20'}]};
 const f={grant,data,requests:[],calls:0,status:200};
 f.source=createBrokerageHoldingsSource({clientId:'fixture',secret:'fixture',now:()=>now,loadGrant:async()=>{f.calls++;return f.get?f.get():grant;},
  fetcher:async(url,options)=>{f.requests.push({url,body:JSON.parse(options.body)});return {ok:f.status===200,status:f.status,json:async()=>data};}});
 return f;
}
test('brokerage selection reads only consented accounts and uses dated institution amounts without deriving a position from bank activity',async t=>{
 const f=fixture();t.after(()=>f.source.dispose());const opened=await f.source.open('tab',actor,now+200000);
 assert.equal(f.requests.length,0);assert.deepEqual(opened.accounts.map(a=>a.name),['Retirement','Taxable']);
 assert.doesNotMatch(JSON.stringify(opened),/fixture-item|access-sandbox|fixture-connection/);
 const read=()=>f.source.read('tab',actor,[opened.accounts[0].choice]);
 let v=await read();assert.equal(v.positions[0].price,1.234567);assert.equal(v.positions[0].value,13.04);
 assert.equal(v.positions[0].asOf,'2026-11-20');assert.equal(v.positions[0].quantity,10.5);
 assert.equal(f.requests[0].url,'https://sandbox.plaid.com/investments/holdings/get');
 assert.deepEqual(f.requests[0].body.options,{account_ids:['chosen']});
 f.data.holdings[0].institution_price_as_of=null;
 v=await read();assert.equal(v.positions[0].asOf,null);assert.equal(v.positions[0].value,null);
 f.data.holdings[0].institution_price_datetime='2026-11-19T16:00:00-05:00';
 assert.equal((await read()).positions[0].asOf,'2026-11-19');
 await assert.rejects(f.source.read('tab',{ownerId:'another'},[opened.accounts[0].choice]));
 await assert.rejects(f.source.read('tab',actor,['chosen']));
});
test('revoked, changed, incomplete or foreign brokerage results cannot be displayed',async t=>{
 for(const change of ['selection','mismatch','duplicate','foreign institution','wrong product','revoked','no access','failed','missing currency']){
  const f=fixture();t.after(()=>f.source.dispose());const v=await f.source.open('tab',actor,now+300000);
  if(change==='selection')f.grant.accounts.reverse();
  if(change==='mismatch')f.data.holdings[0].account_id='other';
  if(change==='duplicate')f.data.holdings.push(f.data.holdings[0]);
  if(change==='foreign institution')f.data.item.institution_id='other';
  if(change==='wrong product')f.grant.scope='transactions';
  if(change==='revoked')f.get=()=>f.calls>=3?null:f.grant;
  if(change==='no access')f.status=403;
  if(change==='failed')f.data.error_code='ITEM_LOGIN_REQUIRED';
  if(change==='missing currency')f.data.holdings[0].iso_currency_code=null;
  const request=f.source.read('tab',actor,[v.accounts[0].choice]);
  if(change==='missing currency'){const result=await request;assert.equal(result.positions[0].price,null);assert.equal(result.positions[0].value,null);}
  else await assert.rejects(request);
 }
});
test('signed-in Finance reviews the brokerage selection, hides amounts on reopen, and supports a disconnected source',async t=>{
 const app=privateWorkspaceFixture(t,{fixtureBrokerage:true}),tab=app.tab();await tab.login();
 assert.equal((await(await tab.fetcher('/dev-config.json')).json()).privateBrokerageHoldings,true);
 const panel=createBrokeragePanel({client:tab.client});t.after(()=>panel.reset());
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{brokerageAction:action}})}});await new Promise(r=>setImmediate(r));};
 await click('open');const key=/data-brokerage-account="([^"]+)"/.exec(panel.render())[1];
 assert.match(panel.render(),/Read holdings from selected accounts"?.*disabled|disabled[^>]*>Read holdings from selected accounts/);
 panel.input({type:'change',target:{dataset:{brokerageAccount:key},checked:true}});
 await click('read');assert.match(panel.render(),/Fictional index fund/);assert.match(panel.render(),/Price as of 2026-11-18/);assert.doesNotMatch(panel.render(),/270\.00/);
 await click('amounts');assert.match(panel.render(),/270\.00/);await click('open');assert.doesNotMatch(panel.render(),/270\.00/);
 await tab.client.signOut();await assert.rejects(tab.client.brokerageRead([key]));
 const off=privateWorkspaceFixture(t).tab();assert.equal((await off.fetcher('/auth/workspace/brokerage/open',{method:'POST',body:'{}'})).status,404);
 const disconnected=fixture();t.after(()=>disconnected.source.dispose());disconnected.get=()=>null;
 assert.deepEqual(await disconnected.source.open('tab',actor,now+300000),{connected:false});
 assert.throws(()=>validatePrivatePreviewArguments(['--start-private-session-preview','--fictional-brokerage-holdings']));
});

test('an expired investment selection hides financial metadata and cannot start a stale read',async t=>{
 let now=100,reads=0;
 const choice='c'.repeat(43),panel=createBrokeragePanel({clock:()=>now,client:{
  brokerageOpen:async()=>({connected:true,institution:'Fictional Brokerage',expiresAt:10000,accounts:[{choice,name:'Fictional account'}]}),
  brokerageRead:async()=>{reads++;throw Error();}
 }});
 t.after(()=>panel.reset());
 const click=action=>panel.click({target:{closest:()=>({dataset:{brokerageAction:action}})}});
 click('open');await new Promise(resolve=>setImmediate(resolve));
 assert.match(panel.render(),/Fictional account/);
 panel.input({type:'change',target:{checked:true,dataset:{brokerageAccount:choice}}});
 now=10000;
 assert.doesNotMatch(panel.render(),/Fictional account|Fictional Brokerage/);
 assert.match(panel.render(),/investment view expired/);
 click('read');
 assert.equal(reads,0);
});
