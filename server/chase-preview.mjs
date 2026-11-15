import {randomUUID} from 'node:crypto';
// Explicit financial preview only; no writes or financial actions.
import {readFile,lstat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createTokenSealer} from './token-sealer.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=256&&!/[\u0000-\u0020\u007f]/.test(value);
async function privateFile(path){const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077))throw Error('Private bank connection storage required.');return readFile(path);}
export async function loadChasePreviewGrant(root,ownerId){
 if(!UUID.test(ownerId||''))throw Error('Verified owner required.');
 const directory=join(root,'.local/plaid-connections'),stat=await lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077))throw Error('Private bank connection directory required.');
 const matches=[];
 for(const file of await readdir(directory)){
  if(!/^[a-f0-9-]{36}\.connection$/i.test(file))continue;
  const row=JSON.parse(await privateFile(join(directory,file)));if(row.ownerId!==ownerId)continue;
  if(!UUID.test(row.connectionId||'')||file!==row.connectionId+'.connection'||row.provider!=='plaid'||row.institution!=='Chase'||row.environment!=='production'||row.scope!=='transactions')throw Error('Bank connection metadata could not be verified.');matches.push(row);
 }
 if(matches.length!==1)throw Error('Exactly one verified Chase connection is required.');
 const row=matches[0],sealer=createTokenSealer(await privateFile(join(root,'.local/provider-storage/encryption-key'))),data=sealer.unseal(row.encrypted,'plaid:'+ownerId+':'+row.connectionId);
 if(data.environment!=='production'||data.institutionId!=='ins_56'||!identifier(data.itemId)||!identifier(data.accessToken)||!data.accessToken.startsWith('access-production-')||!Array.isArray(data.accountIds)||!data.accountIds.length||data.accountIds.length>10||data.accountIds.some(id=>!identifier(id))||new Set(data.accountIds).size!==data.accountIds.length||JSON.stringify(data.products)!=='["transactions"]')throw Error('Bank grant could not be verified.');
 return {ownerId,connectionId:row.connectionId,accessToken:data.accessToken,accountIds:data.accountIds,grant:{ownerId,connectionId:row.connectionId,provider:'plaid',environment:'production',institutionId:'ins_56',itemId:data.itemId,products:['transactions'],accountIds:data.accountIds}};
}
export function createChasePreview({loadGrant,confirmSession,adapter}){
 return async({ownerId,binding,confirmed,expectedAccountCount,startDate,endDateExclusive})=>{
  if(confirmed!==true||!UUID.test(ownerId||'')||typeof binding!=='string'||binding.length<16||!Number.isInteger(expectedAccountCount)||expectedAccountCount<1||expectedAccountCount>10||!await confirmSession(ownerId,binding))throw Error('Explicit financial-preview approval and verified app session required.');
  const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  if(!day(startDate)||!day(endDateExclusive)||endDateExclusive<=startDate||Date.parse(endDateExclusive)-Date.parse(startDate)>31*86400000)throw Error('Choose a valid bank preview window of up to 31 days.');
  const stored=await loadGrant(ownerId);
  if(stored.ownerId!==ownerId||stored.accountIds.length!==expectedAccountCount)throw Error('The approved bank account selection changed.');
  const input={ownerId,connectionId:stored.connectionId,accessToken:stored.accessToken,selectedAccountIds:[...stored.accountIds],grant:{...stored.grant,liveReadApproved:true},startDate,endDateExclusive};
  const accounts=await adapter.accounts(input);if(!await confirmSession(ownerId,binding))throw Error('App session ended during bank preview.');
  const transactions=await adapter.transactions(input);
  const current=await loadGrant(ownerId);
  if(current.connectionId!==stored.connectionId||current.accessToken!==stored.accessToken||JSON.stringify(current.accountIds)!==JSON.stringify(stored.accountIds)||!await confirmSession(ownerId,binding))throw Error('Bank source or app session changed. No partial preview is shown.');
  return {ownerId,connectionId:stored.connectionId,selectionId:randomUUID(),complete:true,previewOnly:true,databaseWritten:false,provider:'plaid',institution:'Chase',freshness:'provider-cached',sourceUpdatedAt:null,startDate,endDateExclusive,retrievedAt:transactions.retrievedAt,accounts:accounts.accounts,transactions:transactions.transactions};
 };
}
