// Approved fake-data workflow only. Default mode reads no credentials or network.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {loadPlaidSandboxConfig,validatePlaidSandboxConfig} from '../server/plaid-sandbox-config.mjs';
import {createPlaidChaseRead} from '../server/plaid-chase-read.mjs';
export async function verifyPlaidSandbox(configuration,{fetcher=fetch,now=()=>Date.now(),wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const config=validatePlaidSandboxConfig(configuration),paths=new Set(['/sandbox/public_token/create','/item/public_token/exchange','/accounts/get','/transactions/get','/item/remove']);
 async function request(path,body){
  if(!paths.has(path))throw Error('Sandbox endpoint not approved.');
  let response,data;try{response=await fetcher('https://sandbox.plaid.com'+path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Plaid-Version':'2020-09-14'},body:JSON.stringify({client_id:config.clientId,secret:config.secret,...body}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});data=await response.json();}catch{throw Error('Sandbox request could not be verified.');}
  if(!response.ok||!data||typeof data!=='object'||Array.isArray(data)){const error=Error('Sandbox request failed.');if(data?.error_code==='PRODUCT_NOT_READY')error.code='PRODUCT_NOT_READY';throw error;}return data;
 }
 const created=await request('/sandbox/public_token/create',{institution_id:'ins_56',initial_products:['transactions']});
 if(typeof created.public_token!=='string'||!created.public_token.startsWith('public-sandbox-'))throw Error('Unexpected Sandbox public token.');
 const exchanged=await request('/item/public_token/exchange',{public_token:created.public_token});
 if(typeof exchanged.access_token!=='string'||!exchanged.access_token.startsWith('access-sandbox-')||typeof exchanged.item_id!=='string'||!exchanged.item_id)throw Error('Unexpected Sandbox Item authorization.');
 const accessToken=exchanged.access_token;let result;
 try{
  const data=await request('/accounts/get',{access_token:accessToken});
  if(data.item?.item_id!==exchanged.item_id||data.item.institution_id!=='ins_56'||!Array.isArray(data.accounts))throw Error('Unexpected Sandbox bank/account identity.');
  const selected=data.accounts.find(a=>a.type==='depository'&&a.subtype==='checking'&&a.balances?.iso_currency_code==='USD')||data.accounts.find(a=>['depository','credit'].includes(a.type)&&a.balances?.iso_currency_code==='USD');
  if(!selected?.account_id)throw Error('No supported fictional Sandbox account returned.');
  const ownerId=randomUUID(),connectionId=randomUUID(),end=new Date(now());end.setUTCHours(0,0,0,0);end.setUTCDate(end.getUTCDate()+1);
  const start=new Date(end.getTime()-7*86400000),input={ownerId,connectionId,accessToken,selectedAccountIds:[selected.account_id],grant:{ownerId,connectionId,provider:'plaid',environment:'sandbox',institutionId:'ins_56',itemId:exchanged.item_id,products:['transactions'],accountIds:[selected.account_id]},startDate:start.toISOString().slice(0,10),endDateExclusive:end.toISOString().slice(0,10)};
  const adapter=createPlaidChaseRead({...config,now},fetcher),accounts=await adapter.accounts(input);
  // Only bounded Sandbox readiness retries; this never polls or refreshes a real bank.
  let ready=false;for(let attempt=0;attempt<5;attempt++){
   try{await request('/transactions/get',{access_token:accessToken,start_date:input.startDate,end_date:new Date(end.getTime()-86400000).toISOString().slice(0,10),options:{account_ids:input.selectedAccountIds,count:1,offset:0}});ready=true;break;}
   catch(error){if(error.code!=='PRODUCT_NOT_READY')throw error;if(attempt<4)await wait(1000);}
  }
  if(!ready)throw Error('Sandbox transaction data is not ready.');
  const transactions=await adapter.transactions(input);
  result={verified:true,environment:'sandbox',fictional:true,accountCount:accounts.accounts.length,transactionCount:transactions.transactions.length,readOnlyProducts:['transactions'],liveBankConnected:false,databaseWritten:false};
 }finally{await request('/item/remove',{access_token:accessToken});}
 return {...result,temporaryItemRemoved:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--allow-sandbox-requests')){
  try{const result=await verifyPlaidSandbox(await loadPlaidSandboxConfig(process.cwd()));console.log(JSON.stringify(result));console.log('Fictional Sandbox test completed and temporary Item removed. No account details, amounts, secrets or tokens printed.');}
  catch{console.error('Sandbox verification STOPPED. Credentials and source contents are not printed. A temporary fictional Sandbox Item may require cleanup; do not connect a live bank to troubleshoot.');process.exitCode=1;}
 }else{console.log('PLAN ONLY — no credentials read, no network requests, no database writes.');console.log('After explicit approval, --allow-sandbox-requests reads the private Sandbox-only configuration, creates one temporary fictional Chase Item, reads selected-account cached balances/transactions, and removes that temporary Item. No live Chase account, production request, paid service or app database write.');}
}
