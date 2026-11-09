// Development only; not wired to public routes. Uses the caller's user token, never an admin key.
import {validatePublicDevConfig} from '../src/dev-api.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createDevProviderRepository(config,{expectedProjectRef,fetcher=fetch}){
 const {origin,ref,key}=validatePublicDevConfig(config);
 if(!expectedProjectRef||ref!==expectedProjectRef)throw Error('Expected isolated development project required.');
 const allowedInsert=r=>({provider_mac_event:{section:'Calendar',origins:['apple_readonly','apple_import_qa']},provider_email:{section:'Personal Life',origins:['google_readonly','google_import_qa']},provider_event:{section:'Calendar',origins:['google_readonly','google_import_qa']},provider_bank_account:{section:'Finances',origins:['plaid_readonly','plaid_import_qa']},provider_bank_transaction:{section:'Finances',origins:['plaid_readonly','plaid_import_qa']}}[r?.item_type]);
 const columns='id,owner_id,household_id,visibility,section,item_type,origin,payload,version,deleted_at,created_at';
 const token=actor=>{if(typeof actor?.accessToken!=='string'||!actor.accessToken||/\s/.test(actor.accessToken))throw Error('Verified development session required.');return actor.accessToken;};
 async function request(actor,path,options={}){
  let response,data;try{response=await fetcher(origin+path,{...options,headers:{apikey:key,Authorization:'Bearer '+token(actor),Accept:'application/json',...(options.body?{'Content-Type':'application/json',Prefer:'return=representation'}:{})},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});data=await response.json();}catch{throw Error('Development import request failed. Review current records before retrying.');}
  if(!response.ok||!Array.isArray(data))throw Error('Development import response could not be verified.');return data;
 }
 return {
  async listSaved(actor,ownerId){
   if(!UUID.test(ownerId||''))throw Error('Verified owner required.');
   const rows=[];
   for(let offset=0;offset<1000;offset+=100){
    const data=await request(actor,'/rest/v1/cc_records?select='+columns+'&owner_id=eq.'+ownerId+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=in.(provider_email,provider_event)&origin=in.(google_readonly,google_import_qa)&order=created_at.desc,id.asc&limit=100&offset='+offset);
    if(data.length>100||data.some(r=>r?.owner_id!==ownerId))throw Error('Saved source list could not be verified.');
    rows.push(...data);if(data.length<100)return rows;
   }throw Error('Too many saved source records. No partial list is shown.');
  },
  async listSavedMacCalendar(actor,ownerId){
   if(!UUID.test(ownerId||''))throw Error('Verified calendar owner required.');const rows=[];
   for(let offset=0;offset<1000;offset+=100){const data=await request(actor,'/rest/v1/cc_records?select='+columns+'&owner_id=eq.'+ownerId+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.provider_mac_event&origin=in.(apple_readonly,apple_import_qa)&order=created_at.desc,id.asc&limit=100&offset='+offset);if(data.length>100||data.some(row=>row?.owner_id!==ownerId))throw Error('Saved Mac calendar list could not be verified.');rows.push(...data);if(data.length<100)return rows;}throw Error('Too many Mac snapshots; no partial list is shown.');
  },
  async listSavedFinance(actor,ownerId){
   if(!UUID.test(ownerId||''))throw Error('Verified financial owner required.');const rows=[];
   for(let offset=0;offset<1000;offset+=100){const data=await request(actor,'/rest/v1/cc_records?select='+columns+',updated_at&owner_id=eq.'+ownerId+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=in.(provider_bank_account,provider_bank_transaction)&origin=in.(plaid_readonly,plaid_import_qa)&order=created_at.desc,id.asc&limit=100&offset='+offset);if(data.length>100||data.some(r=>r?.owner_id!==ownerId))throw Error('Saved financial list could not be verified.');rows.push(...data);if(data.length<100)return rows;}throw Error('Too many financial records; no partial list is shown.');
  },
  async readByIds(actor,ownerId,ids){
   if(!UUID.test(ownerId||'')||!Array.isArray(ids)||ids.length>250||ids.some(id=>!UUID.test(id)))throw Error('Invalid private import lookup.');
   const rows=[];for(let start=0;start<ids.length;start+=50){const batch=ids.slice(start,start+50);const data=await request(actor,'/rest/v1/cc_records?select='+columns+'&owner_id=eq.'+ownerId+'&id=in.('+batch.join(',')+')');
    if(data.some(r=>r?.owner_id!==ownerId||!batch.includes(r.id))||new Set(data.map(r=>r.id)).size!==data.length)throw Error('Import lookup returned unexpected records.');rows.push(...data);
   }return rows;
  },
  async insertMany(actor,ownerId,records){
   if(!UUID.test(ownerId||'')||!Array.isArray(records)||!records.length||records.length>250||new Set(records.map(r=>r?.id)).size!==records.length||records.some(r=>!UUID.test(r?.id||'')||r.owner_id!==ownerId||r.visibility!=='private'||r.household_id!==null||!allowedInsert(r)||r.section!==allowedInsert(r).section||!allowedInsert(r).origins.includes(r.origin)))throw Error('Invalid private provider insert.');
   // One PostgREST bulk INSERT is atomic. There is deliberately no upsert, PATCH or DELETE.
   return request(actor,'/rest/v1/cc_records?select='+columns,{method:'POST',body:JSON.stringify(records)});
  }
 };
}
