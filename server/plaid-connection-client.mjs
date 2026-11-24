import {stableStringify} from './stable-json.mjs';
// Fixed-endpoint server client. No payment/transfer/trade/refresh API is exposed.
export const createPlaidConnectionClient=(config,options)=>createConnectionClient(config,options,false);
export const createPlaidBrokerageConnectionClient=(config,options)=>createConnectionClient(config,options,true);
function createConnectionClient({environment='sandbox',clientId,secret},{productionApproved=false,fetcher=fetch}={},investments){
 const opaque=value=>typeof value==='string'&&value.length>0&&value.length<=256&&!/[\u0000-\u0020\u007f]/.test(value);
 if(!['sandbox','production'].includes(environment)||environment==='production'&&productionApproved!==true||!opaque(clientId)||!opaque(secret))throw Error('Approved Plaid environment and private credentials required.');
 const origin=environment==='sandbox'?'https://sandbox.plaid.com':'https://production.plaid.com';
 const token=(value,kind)=>{if(!opaque(value)||!value.startsWith(kind+'-'+environment+'-'))throw Error('Plaid token environment mismatch.');return value;};
 async function request(path,body){
  let response,data;try{response=await fetcher(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Plaid-Version':'2020-09-14'},body:JSON.stringify({...body,client_id:clientId,secret}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});data=await response.json();}catch{throw Error('Bank authorization request could not be verified.');}
  if(!response.ok||!data||typeof data!=='object'||Array.isArray(data)){const error=Error('Bank authorization failed. No provider details or credentials are displayed.');error.code=['INVALID_API_KEYS','INVALID_FIELD','MISSING_FIELDS','INVALID_REDIRECT_URI','PRODUCT_NOT_ENABLED','INVALID_PRODUCT','INSTITUTION_NOT_SUPPORTED','UNAUTHORIZED_INSTITUTION'].includes(data?.error_code)?data.error_code:'PLAID_REQUEST_FAILED';throw error;}return data;
 }
 return {
  linkTokenCreate(options){
   const product=investments?'investments':'transactions';
   const filters=investments?{investment:{account_subtypes:['all']}}:{depository:{account_subtypes:['checking','savings']},credit:{account_subtypes:['credit card']}};
   const allowed=['client_name','user','country_codes','language','products','account_filters','enable_multi_item_link','hosted_link',...(investments?[]:['transactions'])];
   if(!options||options.client_name!=='Curated Chaos Development'||Object.keys(options).some(k=>!allowed.includes(k))||
      JSON.stringify(options.products)!==JSON.stringify([product])||stableStringify(options.account_filters)!==stableStringify(filters)||
      !investments&&(options.transactions?.days_requested!==30||Object.keys(options.transactions).some(k=>k!=='days_requested'))||
      options.enable_multi_item_link!==false||JSON.stringify(options.country_codes)!=='["US"]'||options.language!=='en'||
      !opaque(options.user?.client_user_id)||Object.keys(options.user).some(k=>k!=='client_user_id')||
      options.hosted_link?.url_lifetime_seconds!==900||options.hosted_link.is_mobile_app!==false||
      Object.keys(options.hosted_link).some(k=>!['url_lifetime_seconds','is_mobile_app'].includes(k)))
     throw Error('Only the reviewed read-only authorization request is allowed.');
   return request('/link/token/create',options);
  },
  linkTokenGet({link_token}){return request('/link/token/get',{link_token:token(link_token,'link')});},
  itemPublicTokenExchange({public_token}){return request('/item/public_token/exchange',{public_token:token(public_token,'public')});},
  itemGet({access_token}){return request('/item/get',{access_token:token(access_token,'access')});},
  accountsGet({access_token,options}){if(!Array.isArray(options?.account_ids)||!options.account_ids.length||options.account_ids.length>10||!options.account_ids.every(opaque))throw Error('Select approved bank accounts.');return request('/accounts/get',{access_token:token(access_token,'access'),options:{account_ids:options.account_ids}});},
  itemRemove({access_token}){return request('/item/remove',{access_token:token(access_token,'access')});}
 };
}
