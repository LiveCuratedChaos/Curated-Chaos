import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLocalBrokerageSource} from '../server/local-brokerage-connection.mjs';
import {createTokenSealer} from '../server/token-sealer.mjs';
import {createLinkedBrokerageSource} from '../server/linked-brokerage-source.mjs';
import {createPlaidConnectionClient,createPlaidBrokerageConnectionClient} from '../server/plaid-connection-client.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createBrokeragePanel} from '../src/private-brokerage-panel.mjs';
const institution={name:'Fictional broker',id:'fictional-broker-id'};
function simulated(){
 const data={rows:[],attempts:new Map(),requests:[],pending:true,wrong:false,session:true};
 const account={account_id:'fictional-investment',type:'investment',name:'Fictional taxable account'};
 const item={item_id:'fixture-item',institution_id:institution.id,consented_products:['investments']};
 const config={institution,clientId:'fixture',secret:'fixture',confirmSession:async()=>data.session,sealer:createTokenSealer(randomBytes(32)),
  attemptStore:{put:async(id,row)=>data.attempts.set(id,row),get:async id=>data.attempts.get(id),consume:async id=>{const r=data.attempts.get(id);data.attempts.delete(id);return r;}},
  connectionStore:{listOwner:async owner=>data.rows.filter(r=>r.ownerId===owner),insert:async row=>{if(data.rows.length)throw Error();data.rows.push(row);}},
  fetcher:async(url,o)=>{
   const path=new URL(url).pathname,body=JSON.parse(o.body);data.requests.push({path,body});
   const response={
    '/link/token/create':{link_token:'link-sandbox-flow',hosted_link_url:'https://secure.plaid.com/hl/fixture',expiration:new Date(Date.now()+900000).toISOString()},
    '/link/token/get':{link_token:'link-sandbox-flow',metadata:{initial_products:['investments']},link_sessions:data.pending?[]:[{finished_at:'2026-11-22T12:00:00Z',results:{item_add_results:[{institution:{institution_id:institution.id},public_token:'public-sandbox-flow',accounts:[{id:account.account_id}]}]}}]},
    '/item/public_token/exchange':{access_token:'access-sandbox-private',item_id:item.item_id},
    '/item/get':{item:data.wrong?{...item,consented_products:['transactions']}:item},
    '/accounts/get':{item,accounts:[account]},
    '/investments/holdings/get':{item,accounts:[account],securities:[],holdings:[]},
    '/item/remove':{removed:true}
   };
   if(!response[path])throw Error('Unexpected provider operation.');
   return {ok:true,json:async()=>response[path]};
  }};
 data.config=config;data.source=createLinkedBrokerageSource(config);return data;
}
test('Finance links only selected investment accounts, seals credentials and checks current consent on every read',async t=>{
 const f=simulated(),app=privateWorkspaceFixture(t,{brokerageSource:f.source}),a=app.tab(),b=app.tab();
 await a.login();await b.login();
 const panel=createBrokeragePanel({client:a.client});t.after(()=>panel.reset());
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{brokerageAction:action}})}});await new Promise(r=>setImmediate(r));};
 await click('open');assert.match(panel.render(),/Start read-only brokerage authorization/);assert.equal(f.requests.length,0);
 await click('begin');assert.match(panel.render(),/https:\/\/secure\.plaid\.com\/hl\/fixture/);
 const request=f.requests[0].body;assert.deepEqual(request.products,['investments']);assert.deepEqual(request.account_filters,{investment:{account_subtypes:['all']}});assert.equal(request.transactions,undefined);
 await assert.rejects(b.client.brokerageFinish());await click('finish');assert.match(panel.render(),/has not completed authorization/);
 f.pending=false;await click('finish');assert.match(panel.render(),/Fictional taxable account/);assert.equal(f.rows.length,1);
 assert.equal(f.rows[0].scope,'investments');assert.doesNotMatch(JSON.stringify(f.rows[0]),/access-sandbox-private|fictional-investment/);
 const choice=/data-brokerage-account="([^"]+)"/.exec(panel.render())[1];panel.input({type:'change',target:{dataset:{brokerageAccount:choice},checked:true}});
 await click('read');assert.match(panel.render(),/No holdings were reported/);assert.deepEqual(f.requests.at(-1).body.options.account_ids,['fictional-investment']);
 f.rows[0].status='disconnected';await assert.rejects(a.client.brokerageRead([choice]),err=>err.code==='selection-changed');
 await assert.rejects(a.client.brokerageFinish());assert.equal(f.requests.filter(r=>r.path==='/item/public_token/exchange').length,1);
});
test('unexpected consent scope cleans up a newly exchanged fictional item and keeps all accounts disconnected',async t=>{
 const f=simulated(),tab=privateWorkspaceFixture(t,{brokerageSource:f.source}).tab();await tab.login();
 await tab.client.brokerageBegin();f.wrong=true;f.pending=false;await assert.rejects(tab.client.brokerageFinish());
 assert.equal(f.rows.length,0);assert.equal(f.requests.at(-1).path,'/item/remove');
 assert.deepEqual(await tab.client.brokerageOpen(),{connected:false,linkInstitution:institution.name});
});
test('bank and brokerage clients cannot request each other’s products',()=>{
 const valid={client_name:'Curated Chaos Development',user:{client_user_id:'fixture-user'},country_codes:['US'],language:'en',products:['investments'],
  account_filters:{investment:{account_subtypes:['all']}},enable_multi_item_link:false,hosted_link:{url_lifetime_seconds:900,is_mobile_app:false}};
 const config={clientId:'fixture',secret:'fixture'};
 assert.throws(()=>createPlaidConnectionClient(config).linkTokenCreate(valid));
 const brokerage=createPlaidBrokerageConnectionClient(config);
 assert.throws(()=>brokerage.linkTokenCreate({...valid,products:['investments','transactions']}));
 assert.throws(()=>brokerage.linkTokenCreate({...valid,transactions:{days_requested:30}}));
});

test('reopening the local service restores the sealed grant and refuses a concurrent duplicate connection',async t=>{
 const root=await mkdtemp(join(tmpdir(),'curated-brokerage-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const f=simulated();t.after(()=>f.source.dispose());f.pending=false;
 const source=await createLocalBrokerageSource(root,f.config);t.after(()=>source.dispose());
 const actor={ownerId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},expiry=Date.now()+300000;
 const a='first-private-session-example',b='second-private-session-example';
 await Promise.all([source.begin(a,actor,expiry),source.begin(b,actor,expiry)]);
 const results=await Promise.allSettled([source.finish(a,actor),source.finish(b,actor)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 const files=await readdir(root),grants=files.filter(name=>name.endsWith('.brokerage'));
 assert.equal(grants.length,1);assert.equal(files.some(name=>name.endsWith('.pending')),false);
 const sealed=await readFile(join(root,grants[0]),'utf8');
 assert.doesNotMatch(sealed,/access-sandbox-private|fictional-investment|Fictional taxable account/);
 source.dispose();const restored=await createLocalBrokerageSource(root,f.config);t.after(()=>restored.dispose());
 const v=await restored.open(a,actor,expiry);assert.equal(v.connected,true);assert.equal(v.accounts[0].name,'Fictional taxable account');
 assert.equal((await restored.read(a,actor,[v.accounts[0].choice])).positions.length,0);
});
