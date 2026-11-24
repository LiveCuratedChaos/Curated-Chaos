// Unwired server-only Hosted Link orchestration for the local development/embedded flow.
// Actual SDK/hosting choice and real account access still need separate approval.
import {randomUUID,createHash} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=value=>typeof value==='string'&&value.length>0&&value.length<=256&&!/[\u0000-\u0020\u007f]/.test(value);
const hash=value=>createHash('sha256').update(value).digest('hex');
export const createChaseConnectionFlow=options=>createInstitutionFlow(options,{name:'Chase',id:'ins_56'},false);
export function createBrokerageConnectionFlow(options,institution){
 if(!id(institution?.id)||typeof institution.name!=='string'||!institution.name.trim()||institution.name!==institution.name.trim()||
    institution.name.length>140||/[\u0000-\u001f\u007f]/.test(institution.name))throw Error('Choose a verified investment institution.');
 return createInstitutionFlow(options,{id:institution.id,name:institution.name},true);
}
function createInstitutionFlow({environment='sandbox',productionApproved=false,client,attemptStore,connectionStore,sealer,confirmSession,now=()=>Date.now()},institution,investments){
 const product=investments?'investments':'transactions',attemptContext=investments?'brokerage-attempt:'+institution.id+':':'chase-attempt:';
 const options=investments?{account_filters:{investment:{account_subtypes:['all']}}}:{transactions:{days_requested:30},account_filters:{depository:{account_subtypes:['checking','savings']},credit:{account_subtypes:['credit card']}}};

 if(!['sandbox','production'].includes(environment)||environment==='production'&&productionApproved!==true||!client||!attemptStore?.put||!attemptStore.get||!attemptStore.consume||!connectionStore?.insert||!connectionStore.listOwner||!sealer?.seal||!sealer.unseal||typeof confirmSession!=='function')throw Error('Approved bank connection services required.');
 const token=(value,kind)=>id(value)&&value.startsWith(kind+'-'+environment+'-');
 async function session(ownerId,binding){if(!UUID.test(ownerId||'')||typeof binding!=='string'||binding.length<16||!await confirmSession(ownerId,hash(binding)))throw Error('Verified app session required.');return hash(binding);}
 return {
  async begin({ownerId,sessionBinding,confirmed}){
   const binding=await session(ownerId,sessionBinding);if(confirmed!==true)throw Error('Explicit bank-authorization approval required.');
   const existing=await connectionStore.listOwner(ownerId);
   if(existing.some(c=>c.provider==='plaid'&&c.institution===institution.name&&c.environment===environment&&c.status!=='disconnected'))throw Error('An existing connection requires review before linking this institution again.');
   const result=await client.linkTokenCreate({client_name:'Curated Chaos Development',user:{client_user_id:hash('curated-chaos:'+ownerId)},country_codes:['US'],language:'en',products:[product],...options,enable_multi_item_link:false,hosted_link:{url_lifetime_seconds:900,is_mobile_app:false}});
   const url=new URL(result.hosted_link_url),providerExpiry=Date.parse(result.expiration);
   if(!token(result.link_token,'link')||url.origin!=='https://secure.plaid.com'||!url.pathname.startsWith('/hl/')||url.username||url.password||!Number.isFinite(providerExpiry)||providerExpiry<=now())throw Error('Bank authorization destination could not be verified.');
   await session(ownerId,sessionBinding);
   const attemptId=randomUUID(),expiresAt=Math.min(providerExpiry,now()+900000);
   await attemptStore.put(attemptId,{expiresAt,encrypted:sealer.seal({ownerId,binding,linkToken:result.link_token,environment,expiresAt},attemptContext+attemptId)});
   return {attemptId,authorizationUrl:url.href,expiresAt,provider:'plaid',institution:institution.name,products:[product]};
  },
  async complete({ownerId,sessionBinding,attemptId}){
   const binding=await session(ownerId,sessionBinding);if(!UUID.test(attemptId||''))throw Error('Invalid bank authorization attempt.');
   const stored=await attemptStore.get(attemptId);if(!stored)throw Error('Bank authorization expired or was already used.');
   const attempt=sealer.unseal(stored.encrypted,attemptContext+attemptId);
   if(attempt.ownerId!==ownerId||attempt.binding!==binding||attempt.environment!==environment||attempt.expiresAt<=now())throw Error('Bank authorization does not match this session.');
   const data=await client.linkTokenGet({link_token:attempt.linkToken});
   if(data.link_token!==attempt.linkToken||!Array.isArray(data.link_sessions)||!Array.isArray(data.metadata?.initial_products)||data.metadata.initial_products.length!==1||data.metadata.initial_products[0]!==product)throw Error('Bank session result could not be verified.');
   const results=data.link_sessions.flatMap(s=>s.finished_at&&Array.isArray(s.results?.item_add_results)?s.results.item_add_results:[]);
   if(!results.length)return {status:'pending',attemptId};
   if(results.length!==1||results[0].institution?.institution_id!==institution.id||!token(results[0].public_token,'public')||!Array.isArray(results[0].accounts)||!results[0].accounts.length||results[0].accounts.length>10)throw Error('A single explicitly selected institution is required.');
   const accountIds=results[0].accounts.map(a=>a.id);
   if(accountIds.some(a=>!id(a))||new Set(accountIds).size!==accountIds.length)throw Error('Selected bank account identities are ambiguous.');
   // Atomic consume claims this exact attempt before exchanging its one-time token.
   const claimed=await attemptStore.consume(attemptId);if(!claimed||claimed.encrypted!==stored.encrypted)throw Error('Bank authorization already claimed.');
   let accessToken,saved=false;
   try{
    await session(ownerId,sessionBinding);
    const exchanged=await client.itemPublicTokenExchange({public_token:results[0].public_token});accessToken=exchanged.access_token;
    if(!token(accessToken,'access')||!id(exchanged.item_id))throw Error('Bank authorization exchange could not be verified.');
    const {item}=await client.itemGet({access_token:accessToken});
    const products=investments?(item?.consented_products??item?.products):item?.products;
    if(item?.item_id!==exchanged.item_id||item.institution_id!==institution.id||item.error||!Array.isArray(products)||
       products.length!==1||products[0]!==product)throw Error('Institution or granted products do not match approval.');
    const accounts=await client.accountsGet({access_token:accessToken,options:{account_ids:accountIds}});
    const correctType=a=>investments?a.type==='investment'&&typeof a.name==='string'&&a.name.trim()===a.name&&a.name.length>0&&a.name.length<=140&&!/[\u0000-\u001f\u007f]/.test(a.name):
     (a.type==='depository'&&['checking','savings'].includes(a.subtype)||a.type==='credit'&&a.subtype==='credit card')&&a.balances?.iso_currency_code==='USD';
    if(accounts.item?.item_id!==item.item_id||accounts.item.institution_id!==institution.id||accounts.item.error||!Array.isArray(accounts.accounts)||
     accounts.accounts.length!==accountIds.length||new Set(accounts.accounts.map(a=>a.account_id)).size!==accountIds.length||
     accounts.accounts.some(a=>!accountIds.includes(a.account_id)||!correctType(a)))throw Error('Selected supported accounts could not be verified.');
    await session(ownerId,sessionBinding);if(attempt.expiresAt<=now())throw Error('Bank authorization expired before saving.');
    const connectionId=randomUUID(),encrypted=sealer.seal({accessToken,itemId:item.item_id,accountIds,institutionId:institution.id,environment,products:[product],...(investments?{accounts:accounts.accounts.map(a=>({id:a.account_id,name:a.name})),institution:institution.name}:{})},'plaid:'+ownerId+':'+connectionId);
    await connectionStore.insert({ownerId,connectionId,provider:'plaid',institution:institution.name,environment,scope:product,...(investments?{status:'authorized',revision:1}:{}),encrypted,createdAt:now()});saved=true;
    return {connectionId,provider:'plaid',institution:institution.name,environment,status:'authorized',accountCount:accountIds.length,selectionRequired:true};
   }finally{
    // Only this newly exchanged Item is eligible for cleanup; never an existing connection.
    if(!saved&&token(accessToken,'access'))await client.itemRemove({access_token:accessToken});
   }
  }
 };
}
