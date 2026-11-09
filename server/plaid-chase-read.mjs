// Server-only Chase preparation through Plaid. No credentials, routes or live connections enabled.
import {createHash} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=value=>typeof value==='string'&&value.length>0&&value.length<=256&&!/[\u0000-\u0020\u007f]/.test(value);
const clean=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
function day(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('Choose valid bank preview dates.');return Date.parse(value+'T00:00:00Z');}
export function usdMinor(value,{nullable=false}={}){
 if(value===null&&nullable)return null;
 if(typeof value!=='number'||!Number.isFinite(value)||!Number.isSafeInteger(Math.round(value*100))||Math.abs(value*100-Math.round(value*100))>0.000001)throw Error('Bank amount precision could not be verified.');
 return Math.round(value*100)||0;
}
export function createPlaidChaseRead({clientId,secret,environment='sandbox',productionApproved=false,now=()=>Date.now()},fetcher=fetch){
 if(!['sandbox','production'].includes(environment)||environment==='production'&&productionApproved!==true||!id(clientId)||!id(secret))throw Error('Approved Plaid environment and server credentials required.');
 const origin=environment==='sandbox'?'https://sandbox.plaid.com':'https://production.plaid.com';
 function context(input){
  const {ownerId,connectionId,grant,selectedAccountIds,accessToken}=input;
  if(!UUID.test(ownerId||'')||!UUID.test(connectionId||'')||grant?.ownerId!==ownerId||grant.connectionId!==connectionId||grant.provider!=='plaid'||grant.environment!==environment||grant.institutionId!=='ins_56'||!id(grant.itemId)||!Array.isArray(grant.products)||!grant.products.includes('transactions')||environment==='production'&&grant.liveReadApproved!==true)throw Error('Verified owner-approved Chase read connection required.');
  if(!Array.isArray(selectedAccountIds)||!selectedAccountIds.length||selectedAccountIds.length>10||!selectedAccountIds.every(id)||new Set(selectedAccountIds).size!==selectedAccountIds.length||!Array.isArray(grant.accountIds)||!selectedAccountIds.every(a=>grant.accountIds.includes(a)))throw Error('Select only explicitly approved bank accounts.');
  if(!id(accessToken)||!accessToken.startsWith('access-'+environment+'-'))throw Error('Bank authorization does not match this environment.');
  return {ownerId,connectionId,grant,selectedAccountIds,accessToken};
 }
 const key=(ctx,kind,sourceId)=>createHash('sha256').update(JSON.stringify([ctx.ownerId,'plaid',ctx.connectionId,ctx.grant.itemId,kind,sourceId])).digest('hex');
 async function request(path,ctx,body){
  let response,data;
  try{response=await fetcher(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Plaid-Version':'2020-09-14'},body:JSON.stringify({client_id:clientId,secret,access_token:ctx.accessToken,...body}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});data=await response.json();}
  catch{throw Error('Bank preview could not be reached. No partial snapshot was accepted.');}
  if(!response.ok||!data||typeof data!=='object'||Array.isArray(data))throw Error('Bank preview failed. Review connection permissions before retrying.');
  if(data.item?.item_id!==ctx.grant.itemId||data.item.institution_id!==ctx.grant.institutionId||data.item.error)throw Error('Bank connection identity or status could not be verified.');
  return data;
 }
 function account(row,ctx){
  if(!id(row?.account_id)||!ctx.selectedAccountIds.includes(row.account_id)||!['depository','credit'].includes(row.type)||row.balances?.iso_currency_code!=='USD'||row.balances.unofficial_currency_code)throw Error('Supported selected USD bank account required.');
  return {key:key(ctx,'account',row.account_id),ownerId:ctx.ownerId,connectionId:ctx.connectionId,provider:'plaid',institution:'Chase',visibility:'private',accountId:row.account_id,name:clean(row.name,140)||'Bank account',type:row.type,subtype:clean(row.subtype,64),currency:'USD',currentMinor:usdMinor(row.balances.current,{nullable:true}),availableMinor:usdMinor(row.balances.available,{nullable:true}),balanceFreshness:'provider-cached'};
 }
 function transaction(row,ctx,startDate,endDateExclusive){
  if(!id(row?.transaction_id)||!id(row.account_id)||!ctx.selectedAccountIds.includes(row.account_id)||typeof row.pending!=='boolean'||row.iso_currency_code!=='USD'||row.unofficial_currency_code)throw Error('Selected USD transaction identity could not be verified.');
  day(row.date);if(row.date<startDate||row.date>=endDateExclusive)throw Error('Transaction is outside the selected bank window.');
  const amountMinor=usdMinor(row.amount);
  if(row.pending_transaction_id!==null&&row.pending_transaction_id!==undefined&&!id(row.pending_transaction_id))throw Error('Pending transaction relationship is invalid.');
  return {key:key(ctx,'transaction',row.transaction_id),ownerId:ctx.ownerId,connectionId:ctx.connectionId,provider:'plaid',institution:'Chase',visibility:'private',transactionId:row.transaction_id,accountId:row.account_id,date:row.date,name:clean(row.name,300)||'Transaction',merchant:clean(row.merchant_name,140),amountMinor,currency:'USD',direction:amountMinor>0?'outflow':amountMinor<0?'inflow':'neutral',pending:row.pending,pendingTransactionId:row.pending_transaction_id||null};
 }
 return {
  async accounts(input){
   const ctx=context(input),data=await request('/accounts/get',ctx,{options:{account_ids:ctx.selectedAccountIds}});
   if(!Array.isArray(data.accounts)||data.accounts.length!==ctx.selectedAccountIds.length||new Set(data.accounts.map(a=>a.account_id)).size!==data.accounts.length)throw Error('Complete selected account list could not be verified.');
   return {provider:'plaid',institution:'Chase',environment,ownerId:ctx.ownerId,connectionId:ctx.connectionId,complete:true,retrievedAt:new Date(now()).toISOString(),sourceUpdatedAt:null,freshness:'provider-cached',accounts:data.accounts.map(row=>account(row,ctx))};
  },
  async transactions(input){
   const ctx=context(input),start=day(input.startDate),end=day(input.endDateExclusive);
   if(end<=start||end-start>31*86400000)throw Error('Choose a bank window of up to 31 days.');
   const inclusiveEnd=new Date(end-86400000).toISOString().slice(0,10),transactions=[],seen=new Set();let expectedTotal;
   for(let page=0;page<10;page++){
    const data=await request('/transactions/get',ctx,{start_date:input.startDate,end_date:inclusiveEnd,options:{account_ids:ctx.selectedAccountIds,count:100,offset:transactions.length}});
    if(!Number.isInteger(data.total_transactions)||data.total_transactions<0||data.total_transactions>500||!Array.isArray(data.transactions)||data.transactions.length>100||expectedTotal!==undefined&&expectedTotal!==data.total_transactions)throw Error('Bank transaction window changed or exceeds the preview limit. No partial snapshot was accepted.');
    expectedTotal=data.total_transactions;
    for(const row of data.transactions){const normalized=transaction(row,ctx,input.startDate,input.endDateExclusive);if(seen.has(normalized.transactionId))throw Error('Bank pagination changed. Retry the complete preview.');seen.add(normalized.transactionId);transactions.push(normalized);}
    if(transactions.length>expectedTotal)throw Error('Bank transaction counts could not be verified.');
    if(transactions.length===expectedTotal)return {provider:'plaid',institution:'Chase',environment,ownerId:ctx.ownerId,connectionId:ctx.connectionId,complete:true,startDate:input.startDate,endDateExclusive:input.endDateExclusive,retrievedAt:new Date(now()).toISOString(),sourceUpdatedAt:null,freshness:'provider-cached',transactions};
    if(!data.transactions.length)throw Error('Bank pagination ended before the complete window.');
   }throw Error('Bank preview requires too many pages. Choose a smaller window.');
  }
 };
}
