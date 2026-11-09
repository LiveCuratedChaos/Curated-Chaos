import test from 'node:test';
import assert from 'node:assert/strict';
import {createChaseConnectionFlow} from '../server/plaid-chase-connection.mjs';
import {createTokenSealer} from '../server/token-sealer.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sessionBinding='fixture-session-binding-strong';
function fixture(){
 const state={valid:true,time:1000,pending:false,exchanges:0,removed:0,institution:'ins_56',existing:[]},attempts=new Map(),connections=[],sealer=createTokenSealer(Buffer.alloc(32,3));
 const client={linkTokenCreate:async options=>{state.options=options;return {link_token:'link-sandbox-fixture',hosted_link_url:'https://secure.plaid.com/hl/fixture',expiration:new Date(state.time+900000).toISOString()};},linkTokenGet:async()=>({link_token:'link-sandbox-fixture',metadata:{initial_products:['transactions']},link_sessions:state.pending?[]:[{finished_at:'2026-11-08T12:00:00Z',results:{item_add_results:[{institution:{institution_id:state.institution},public_token:'public-sandbox-fixture',accounts:[{id:'fixture-account'}]}]}}]}),itemPublicTokenExchange:async()=>{state.exchanges++;return {access_token:'access-sandbox-fixture',item_id:'fixture-item'};},itemGet:async()=>({item:{item_id:'fixture-item',institution_id:'ins_56',products:['transactions'],error:null}}),accountsGet:async()=>({item:{item_id:'fixture-item',institution_id:'ins_56'},accounts:[{account_id:'fixture-account',type:'depository',subtype:'checking',balances:{iso_currency_code:'USD'}}]}),itemRemove:async()=>{state.removed++;}};
 const services={client,attemptStore:{put:async(id,row)=>attempts.set(id,row),get:async id=>attempts.get(id),consume:async id=>{const row=attempts.get(id);attempts.delete(id);return row;}},connectionStore:{listOwner:async()=>state.existing,insert:async row=>connections.push(row)},sealer,confirmSession:async()=>state.valid,now:()=>state.time};
 return {state,client,services,connections,sealer,flow:createChaseConnectionFlow(services),args:{ownerId,sessionBinding,confirmed:true}};
}
test('bank authorization requests only Transactions and minimizes identity/history/account scope',async()=>{
 const f=fixture(),result=await f.flow.begin(f.args);assert.deepEqual(f.state.options.products,['transactions']);assert.equal(f.state.options.transactions.days_requested,30);assert.equal(f.state.options.user.email_address,undefined);assert.equal(f.state.options.user.phone_number,undefined);assert.notEqual(f.state.options.user.client_user_id,ownerId);assert.equal(f.state.options.enable_multi_item_link,false);assert.equal(result.authorizationUrl,'https://secure.plaid.com/hl/fixture');assert.doesNotMatch(JSON.stringify(result),/link-sandbox/);
});
test('completed link is bound to the verified server session and saved encrypted without tokens in output',async()=>{
 const f=fixture(),start=await f.flow.begin(f.args),result=await f.flow.complete({...f.args,attemptId:start.attemptId});assert.equal(result.accountCount,1);assert.equal(result.selectionRequired,true);assert.doesNotMatch(JSON.stringify(result),/access-sandbox|fixture-account/);assert.doesNotMatch(f.connections[0].encrypted,/access-sandbox/);
 const row=f.connections[0];assert.equal(f.sealer.unseal(row.encrypted,'plaid:'+ownerId+':'+row.connectionId).accessToken,'access-sandbox-fixture');await assert.rejects(f.flow.complete({...f.args,attemptId:start.attemptId}));assert.equal(f.state.exchanges,1);
});
test('pending sessions retain the attempt without exchanging, and other app sessions cannot claim it',async()=>{
 const f=fixture(),start=await f.flow.begin(f.args);f.state.pending=true;assert.equal((await f.flow.complete({...f.args,attemptId:start.attemptId})).status,'pending');assert.equal(f.state.exchanges,0);
 await assert.rejects(f.flow.complete({...f.args,attemptId:start.attemptId,sessionBinding:'other-session-binding-strong'}));assert.equal(f.state.exchanges,0);
});
test('expired sessions and wrong institutions stop before exchange',async()=>{
 const f=fixture(),start=await f.flow.begin(f.args);f.state.time+=900001;await assert.rejects(f.flow.complete({...f.args,attemptId:start.attemptId}));assert.equal(f.state.exchanges,0);
 const g=fixture(),other=await g.flow.begin(g.args);g.state.institution='ins_other';await assert.rejects(g.flow.complete({...g.args,attemptId:other.attemptId}));assert.equal(g.state.exchanges,0);
});
test('failed verification cleans up only the newly exchanged Item',async()=>{
 const f=fixture(),start=await f.flow.begin(f.args);f.client.itemGet=async()=>({item:{item_id:'fixture-item',institution_id:'ins_other',products:['transactions']}});await assert.rejects(f.flow.complete({...f.args,attemptId:start.attemptId}));assert.equal(f.state.removed,1);assert.equal(f.connections.length,0);
});
test('duplicate new links and production access are blocked without approval',async()=>{
 const f=fixture();f.state.existing=[{provider:'plaid',institution:'Chase',environment:'sandbox',status:'authorized'}];await assert.rejects(f.flow.begin(f.args));assert.throws(()=>createChaseConnectionFlow({...f.services,environment:'production'}));await assert.rejects(f.flow.begin({...f.args,confirmed:false}));
});
