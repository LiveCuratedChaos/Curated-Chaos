import {randomBytes} from 'node:crypto';
import {validDay} from '../src/dev-brief-model.mjs';
import {ProviderReadError} from './provider-read-error.mjs';

const token=()=>randomBytes(32).toString('base64url');
const id=v=>typeof v==='string'&&v.length>0&&v.length<=256&&!/[\s\u0000-\u001f\u007f]/.test(v);
const label=v=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=140&&!/[\u0000-\u001f\u007f]/.test(v);
const number=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=Number.MAX_SAFE_INTEGER;
const fail=outcome=>{throw new ProviderReadError(outcome);};

// loadGrant resolves the signed-in owner's current, separately authorized investment connection.
// Provider credentials and account/security identities stay on the server.
export function createBrokerageHoldingsSource({environment='sandbox',productionApproved=false,clientId,secret,loadGrant,fetcher=fetch,now=Date.now}){
 if(!['sandbox','production'].includes(environment)||environment==='production'&&productionApproved!==true||
   !id(clientId)||!id(secret)||typeof loadGrant!=='function')throw Error('Approved brokerage configuration required.');
 const origin=environment==='sandbox'?'https://sandbox.plaid.com':'https://production.plaid.com';
 const views=new Map();
 function clear(context){clearTimeout(views.get(context)?.timer);views.delete(context);}
 async function activeGrant(actor){
  const grant=await loadGrant(actor);
  if(!grant)return null;
  if(grant.ownerId!==actor.ownerId||grant.environment!==environment||grant.status!=='authorized'||grant.scope!=='investments'||
     !id(grant.connectionId)||!id(grant.itemId)||!id(grant.institutionId)||!label(grant.institution)||!Number.isSafeInteger(grant.revision)||grant.revision<1||
     !id(grant.accessToken)||!grant.accessToken.startsWith('access-'+environment+'-')||
     !Array.isArray(grant.accounts)||!grant.accounts.length||grant.accounts.length>10||
     grant.accounts.some(a=>!id(a?.id)||!label(a.name))||new Set(grant.accounts.map(a=>a.id)).size!==grant.accounts.length)fail('access-denied');
  return grant;
 }
 // Labels and selections are part of consent. A concurrent account change requires a fresh choice.
 const signature=g=>JSON.stringify([g.connectionId,g.revision,g.itemId,g.institutionId,g.institution,g.accounts.map(a=>[a.id,a.name])]);
 async function open(context,actor,sessionExpiry){
  clear(context);
  if(!Number.isFinite(sessionExpiry)||sessionExpiry<=now())fail('session-ended');
  const v={owner:actor.ownerId,expiresAt:Math.min(now()+300000,sessionExpiry),accounts:new Map()};
  views.set(context,v);
  v.timer=setTimeout(()=>{if(views.get(context)===v)clear(context);},Math.max(1,v.expiresAt-now()));v.timer.unref?.();
  const g=await activeGrant(actor);if(views.get(context)!==v||now()>=v.expiresAt)fail('session-ended');
  if(!g){clear(context);return {connected:false};}
  v.signature=signature(g);
  for(const account of g.accounts)v.accounts.set(token(),account.id);
  return {connected:true,institution:g.institution,expiresAt:v.expiresAt,accounts:[...v.accounts.keys()].map((choice,i)=>({choice,name:g.accounts[i].name}))};
 }
 async function read(context,actor,choices){
  const v=views.get(context);
  if(!v?.signature||v.owner!==actor.ownerId||now()>=v.expiresAt||v.busy)fail('selection-changed');
  if(!Array.isArray(choices)||!choices.length||choices.length>10||new Set(choices).size!==choices.length||choices.some(key=>!v.accounts.has(key)))fail('selection-changed');
  const selected=choices.map(key=>v.accounts.get(key));
  const recheck=async()=>{
   const g=await activeGrant(actor);
   if(views.get(context)!==v||now()>=v.expiresAt)fail('session-ended');
   if(!g||signature(g)!==v.signature)fail('selection-changed');return g;
  };
  v.busy=true;
  try{
   const grant=await recheck();
   let response,data;
   try{
    response=await fetcher(origin+'/investments/holdings/get',{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),
     headers:{'Content-Type':'application/json',Accept:'application/json','Plaid-Version':'2020-09-14'},
     body:JSON.stringify({client_id:clientId,secret,access_token:grant.accessToken,options:{account_ids:selected}})});
    try{data=await response.json();}catch(error){if(response.status!==401&&response.status!==403)throw error;}
   }catch{fail('source-unavailable');}
   const code=data?.error_code??data?.item?.error?.error_code;
   if(response.status===401||['ITEM_LOGIN_REQUIRED','INVALID_ACCESS_TOKEN','ITEM_NOT_FOUND'].includes(code))fail('reconnect-required');
   if(response.status===403||['PRODUCT_NOT_ENABLED','ACCESS_NOT_GRANTED','NO_INVESTMENT_ACCOUNTS'].includes(code))fail('access-denied');
   if(code==='INVALID_ACCOUNT_ID')fail('selection-changed');
   if(!response.ok||code)fail('source-unavailable');
   if(data?.item?.item_id!==grant.itemId||data.item.institution_id!==grant.institutionId||data.item.error)fail('reconnect-required');
   if(!Array.isArray(data.accounts)||data.accounts.length!==selected.length||data.accounts.some(a=>!selected.includes(a?.account_id)||a.type!=='investment')||
     new Set(data.accounts.map(a=>a.account_id)).size!==selected.length)fail('selection-changed');
   if(!Array.isArray(data.holdings)||data.holdings.length>1000||!Array.isArray(data.securities)||data.securities.length>1000)fail('incomplete-read');
   const securities=new Map();
   for(const s of data.securities){if(!id(s?.security_id)||securities.has(s.security_id))fail('incomplete-read');securities.set(s.security_id,s);}
   const seen=new Set(),today=new Date(now()).toISOString().slice(0,10);
   const positions=data.holdings.map(h=>{
    const sec=securities.get(h?.security_id),account=grant.accounts.find(a=>a.id===h?.account_id),key=JSON.stringify([h?.account_id,h?.security_id]);
    if(!sec||!account||!selected.includes(h.account_id)||seen.has(key)||!number(h.quantity))fail('incomplete-read');
    seen.add(key);
    const name=label(sec.name)?sec.name:label(sec.ticker_symbol)?sec.ticker_symbol:'Unnamed security';
    const currency=h.iso_currency_code??null;
    if(currency!==null&&(typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency))||
       [h.institution_value,h.institution_price].some(value=>value!=null&&!number(value)))fail('incomplete-read');
    let asOf=h.institution_price_as_of??null;
    if(!asOf&&h.institution_price_datetime!=null){
     const dt=h.institution_price_datetime;
     if(typeof dt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(dt)||!Number.isFinite(Date.parse(dt)))fail('incomplete-read');
     asOf=dt.slice(0,10);
    }
    if(asOf!==null&&(!validDay(asOf)||asOf>today))fail('incomplete-read');
    return {account:account.name,name,quantity:h.quantity,currency,asOf,
     price:currency&&asOf?h.institution_price??null:null,value:currency&&asOf?h.institution_value??null:null};
   });
   await recheck();
   return {institution:grant.institution,checkedAt:new Date(now()).toISOString(),expiresAt:v.expiresAt,
    positions:positions.sort((a,b)=>a.account.localeCompare(b.account)||a.name.localeCompare(b.name))};
  }finally{v.busy=false;}
 }
 return {open,read,clear,dispose(){for(const context of views.keys())clear(context);}};
}
