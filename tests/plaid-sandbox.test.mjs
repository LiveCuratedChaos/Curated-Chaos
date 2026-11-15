import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPlaidSandbox} from '../tools/verify-plaid-sandbox.mjs';
import {validatePlaidSandboxConfig,loadPlaidSandboxConfig} from '../server/plaid-sandbox-config.mjs';
import {mkdtemp,mkdir,writeFile,chmod,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const config={environment:'sandbox',clientId:'fixtureclientid123456',secret:'fixturesecret123456'};
function fixture({badItem=false}={}){
 const calls=[],item={item_id:'fixture-item',institution_id:'ins_56',error:null},account={account_id:'fixture-account',name:'Fictional checking',type:'depository',subtype:'checking',balances:{current:120.25,available:null,iso_currency_code:'USD',unofficial_currency_code:null}};
 const fetcher=async(url,options)=>{assert.equal(new URL(url).origin,'https://sandbox.plaid.com');const path=new URL(url).pathname,body=JSON.parse(options.body);calls.push({path,body});let data;
  if(path==='/sandbox/public_token/create')data={public_token:'public-sandbox-fixture'};
  else if(path==='/item/public_token/exchange')data={item_id:'fixture-item',access_token:'access-sandbox-fixture'};
  else if(path==='/accounts/get')data={item:badItem?{...item,item_id:'other'}:item,accounts:[account]};
  else if(path==='/transactions/get')data={item,total_transactions:0,transactions:[]};
  else if(path==='/item/remove')data={request_id:'fixture-request'};
  else throw Error('Unapproved endpoint');return {ok:true,json:async()=>data};};
 return {calls,fetcher};
}
test('Sandbox workflow creates only fake Transactions access, returns a summary, and cleans up',async()=>{
 const f=fixture(),result=await verifyPlaidSandbox(config,{fetcher:f.fetcher});assert.equal(result.temporaryItemRemoved,true);assert.equal(result.liveBankConnected,false);assert.equal(result.databaseWritten,false);assert.doesNotMatch(JSON.stringify(result),/fixturesecret|access-sandbox|12025|fixture-account/);assert.deepEqual(f.calls[0].body.initial_products,['transactions']);assert.equal(f.calls.at(-1).path,'/item/remove');
});
test('Sandbox workflow cleans up its own fake Item when validation fails',async()=>{
 const f=fixture({badItem:true});await assert.rejects(verifyPlaidSandbox(config,{fetcher:f.fetcher}));assert.equal(f.calls.at(-1).path,'/item/remove');
});
test('private credential loader rejects production, extra keys and unsafe permissions',async t=>{
 assert.throws(()=>validatePlaidSandboxConfig({...config,environment:'production'}));assert.throws(()=>validatePlaidSandboxConfig({...config,productionSecret:'not-allowed'}));
 const root=await mkdtemp(join(tmpdir(),'cc-plaid-config-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'.local'),{mode:0o700});const file=join(root,'.local/plaid-sandbox.json');await writeFile(file,JSON.stringify(config),{mode:0o600});assert.deepEqual(await loadPlaidSandboxConfig(root),config);await chmod(file,0o644);await assert.rejects(loadPlaidSandboxConfig(root));
});
test('Sandbox CLI defaults to an offline plan even without a local configuration',async t=>{
 const root=await mkdtemp(join(tmpdir(),'cc-plaid-offline-'));t.after(()=>rm(root,{recursive:true,force:true}));const output=execFileSync(process.execPath,[fileURLToPath(new URL('../tools/verify-plaid-sandbox.mjs',import.meta.url))],{cwd:root,encoding:'utf8'});assert.match(output,/PLAN ONLY/);assert.match(output,/no credentials read, no network requests, no database writes/);
});
