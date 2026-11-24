import {createBrokerageConnectionFlow} from './plaid-chase-connection.mjs';
import {createPlaidBrokerageConnectionClient} from './plaid-connection-client.mjs';
import {createBrokerageHoldingsSource} from './private-brokerage-holdings.mjs';

// The institution is chosen by the server from its approved provider configuration.
// The caller supplies owner-filtered connection storage and a live app session verifier.
export function createLinkedBrokerageSource({institution,connectionStore,attemptStore,sealer,confirmSession,clientId,secret,environment='sandbox',productionApproved=false,fetcher=fetch,now=Date.now}){
 const client=createPlaidBrokerageConnectionClient({environment,clientId,secret},{fetcher,productionApproved});
 const flow=createBrokerageConnectionFlow({client,connectionStore,attemptStore,sealer,confirmSession,environment,productionApproved,now},institution);
 const attempts=new Map();
 async function loadGrant(actor){
  const items=await connectionStore.listOwner(actor.ownerId);
  if(!Array.isArray(items))throw Error('Could not verify brokerage connections.');
  const rows=items.filter(r=>r.ownerId===actor.ownerId&&r.provider==='plaid'&&r.environment===environment&&r.scope==='investments'&&r.institution===institution.name&&r.status==='authorized');
  if(!rows.length)return null;
  if(rows.length!==1)throw Error('Choose one active brokerage authorization.');
  const row=rows[0];
  const grant=sealer.unseal(row.encrypted,'plaid:'+actor.ownerId+':'+row.connectionId);
  if(grant.institution!==institution.name||grant.institutionId!==institution.id||grant.environment!==environment||
     JSON.stringify(grant.products)!=='["investments"]'||!Array.isArray(grant.accounts)||!Array.isArray(grant.accountIds)||
     grant.accounts.length!==grant.accountIds.length||new Set(grant.accountIds).size!==grant.accountIds.length||
     !grant.accounts.every(a=>grant.accountIds.includes(a.id)))throw Error('Invalid brokerage authorization.');
  return {ownerId:row.ownerId,connectionId:row.connectionId,scope:row.scope,revision:row.revision,status:row.status,
   environment,institution:grant.institution,institutionId:grant.institutionId,itemId:grant.itemId,accessToken:grant.accessToken,accounts:grant.accounts};
 }
 const holdings=createBrokerageHoldingsSource({clientId,secret,environment,productionApproved,loadGrant,fetcher,now});
 function clear(context){
  const a=attempts.get(context);clearTimeout(a?.timer);attempts.delete(context);holdings.clear(context);
 }
 async function open(context,actor,expiresAt){
  const view=await holdings.open(context,actor,expiresAt);
  return view.connected?view:{connected:false,linkInstitution:institution.name};
 }
 async function begin(context,actor,expiresAt){
  if(attempts.has(context)||expiresAt<=now())throw Error('Brokerage authorization is already open or expired.');
  const a={owner:actor.ownerId};attempts.set(context,a);
  try{
   const result=await flow.begin({ownerId:actor.ownerId,sessionBinding:context,confirmed:true});
   if(attempts.get(context)!==a||expiresAt<=now())throw Error('Private session changed.');
   a.attemptId=result.attemptId;a.expiresAt=Math.min(result.expiresAt,expiresAt);
   a.timer=setTimeout(()=>{if(attempts.get(context)===a)clear(context);},Math.max(1,a.expiresAt-now()));a.timer.unref?.();
   return {institution:result.institution,authorizationUrl:result.authorizationUrl,expiresAt:a.expiresAt};
  }catch(err){if(attempts.get(context)===a)clear(context);throw err;}
 }
 async function finish(context,actor){
  const a=attempts.get(context);
  if(!a?.attemptId||a.owner!==actor.ownerId||a.expiresAt<=now()||a.busy)throw Error('Authorization expired. Open a fresh request.');
  a.busy=true;
  try{
   const result=await flow.complete({ownerId:actor.ownerId,sessionBinding:context,attemptId:a.attemptId});
   if(attempts.get(context)!==a||a.expiresAt<=now())throw Error('Private session changed.');
   if(result.status==='pending')return {authorized:false};
   clear(context);return {authorized:true};
  }catch(err){if(attempts.get(context)===a)clear(context);throw err;}
  finally{a.busy=false;}
 }
 return {open,begin,finish,read:holdings.read,clear,dispose(){for(const context of attempts.keys())clear(context);holdings.dispose();}};
}
