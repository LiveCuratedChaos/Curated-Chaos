import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaidConnectionClient} from '../server/plaid-connection-client.mjs';
import {loadPlaidProductionConfig} from '../server/plaid-sandbox-config.mjs';
const config={environment:'sandbox',clientId:'fixture-client',secret:'fixture-secret'};
test('Plaid connection client confines operations and credentials to the selected environment',async()=>{
 const calls=[],client=createPlaidConnectionClient(config,{fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({fixture:true})};}});
 await client.itemGet({access_token:'access-sandbox-fixture'});assert.equal(calls[0].url,'https://sandbox.plaid.com/item/get');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.method,'POST');assert.equal(JSON.parse(calls[0].options.body).secret,'fixture-secret');assert.throws(()=>client.itemGet({access_token:'access-production-fixture'}));assert.equal(calls.length,1);assert.equal(client.transferCreate,undefined);
});
test('Production credentials and expanded Link product requests are rejected by default',()=>{
 assert.throws(()=>createPlaidConnectionClient({...config,environment:'production'}));assert.throws(()=>loadPlaidProductionConfig('/does-not-exist'));
 const client=createPlaidConnectionClient(config);assert.throws(()=>client.linkTokenCreate({products:['auth','transactions']}));
});
test('provider response bodies never leak through client errors',async()=>{
 const client=createPlaidConnectionClient(config,{fetcher:async()=>({ok:false,json:async()=>({error_message:'fixture-secret private account detail'})})});await assert.rejects(client.itemGet({access_token:'access-sandbox-fixture'}),e=>!e.message.includes('fixture-secret')&&!e.message.includes('private account'));
});
test('Link cannot add delivery channels, redirect destinations or broader account filters',()=>{
 const client=createPlaidConnectionClient(config),valid={client_name:'Curated Chaos Development',user:{client_user_id:'fixture-user'},country_codes:['US'],language:'en',products:['transactions'],transactions:{days_requested:30},account_filters:{depository:{account_subtypes:['checking','savings']},credit:{account_subtypes:['credit card']}},enable_multi_item_link:false,hosted_link:{url_lifetime_seconds:900,is_mobile_app:false}};
 assert.throws(()=>client.linkTokenCreate({...valid,hosted_link:{...valid.hosted_link,delivery_method:'email'}}));assert.throws(()=>client.linkTokenCreate({...valid,account_filters:{depository:{account_subtypes:['all']}}}));assert.throws(()=>client.linkTokenCreate({...valid,hosted_link:{...valid.hosted_link,completion_redirect_uri:'https://other.example'}}));
});
