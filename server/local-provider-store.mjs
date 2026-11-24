// Local development only. Encrypted records live in a gitignored, private directory.
import {mkdir,lstat,writeFile,readFile,rename,unlink,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {validateGoogleSourceSelection} from './google-source-selection.mjs';
import {GMAIL_READ_SCOPE} from './gmail.mjs';
import {GOOGLE_CALENDAR_READ_SCOPE} from './google-calendar.mjs';
import {createTokenSealer} from './token-sealer.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function createLocalProviderStore(directory){
 await mkdir(directory,{recursive:true,mode:0o700});
 const info=await lstat(directory);if(!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077))throw Error('Provider storage must be a private local directory.');
 const keyFile=join(directory,'encryption-key');
 // Never silently replace a lost key while encrypted local records remain.
 let keyExists=true;
 try{await lstat(keyFile);}catch(err){if(err.code!=='ENOENT')throw err;keyExists=false;}
 if(!keyExists){
  if((await readdir(directory)).length)throw Error('Provider encryption key is missing. Restore the original key before opening saved connections; a replacement cannot decrypt existing records.');
  try{await writeFile(keyFile,randomBytes(32),{flag:'wx',mode:0o600});}catch(err){if(err.code!=='EEXIST')throw err;}
 }
 const keyInfo=await lstat(keyFile);if(!keyInfo.isFile()||keyInfo.isSymbolicLink()||(keyInfo.mode&0o077))throw Error('Provider key permissions are unsafe.');
 const sealer=createTokenSealer(await readFile(keyFile));
 const stateStore={
  async put(key,value){if(!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid authorization state.');await writeFile(join(directory,key+'.state'),JSON.stringify(value),{flag:'wx',mode:0o600});},
  async consume(key){
   if(!/^[a-f0-9]{64}$/.test(key))return null;
   const source=join(directory,key+'.state'),claimed=join(directory,key+'.claimed-'+randomUUID());
   try{await rename(source,claimed);}catch(err){if(err.code==='ENOENT')return null;throw err;}
   try{return JSON.parse(await readFile(claimed,'utf8'));}finally{await unlink(claimed);}
  }
 };
 async function latestSelections(ownerId){
  const latest=new Map();
  for(const file of await readdir(directory)){
   if(!/^[a-f0-9-]{36}\.selection$/i.test(file))continue;
   const path=join(directory,file),stat=await lstat(path);
   if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077))throw Error('Unsafe selection storage.');
   const row=JSON.parse(await readFile(path,'utf8'));if(row.ownerId!==ownerId)continue;
   if(!UUID.test(row.selectionId)||file!==row.selectionId+'.selection')throw Error('Invalid selection storage.');
   const data=sealer.unseal(row.encrypted,'selection:'+ownerId+':'+row.selectionId);
   if(!UUID.test(data.connectionId)||!Number.isFinite(data.createdAt))throw Error('Invalid source selection.');
   const previous=latest.get(data.connectionId);
   if(!previous||data.createdAt>previous.createdAt||(data.createdAt===previous.createdAt&&row.selectionId>previous.selectionId))latest.set(data.connectionId,{...data,selectionId:row.selectionId});
  }
  return latest;
 }
 async function readConnection(ownerId,connectionId){
  if(!UUID.test(ownerId)||!UUID.test(connectionId))throw Error('Verified connection required.');
  const path=join(directory,connectionId+'.connection'),stat=await lstat(path);
  if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077))throw Error('Unsafe connection storage.');
  const row=JSON.parse(await readFile(path,'utf8'));
  if(row.ownerId!==ownerId||row.connectionId!==connectionId)throw Error('Connection unavailable.');
  return row;
 }
 async function isPaused(ownerId,connectionId){
  const path=join(directory,connectionId+'.paused');let stat;
  try{stat=await lstat(path);}catch(err){if(err.code==='ENOENT')return false;throw err;}
  if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077))throw Error('Unsafe pause state.');
  const value=JSON.parse(await readFile(path,'utf8'));if(value.ownerId!==ownerId||value.connectionId!==connectionId)throw Error('Invalid pause state.');
  return true;
 }
 const connectionStore={
  async insert(row){if(!UUID.test(row.ownerId)||!UUID.test(row.connectionId))throw Error('Invalid connection owner.');await writeFile(join(directory,row.connectionId+'.connection'),JSON.stringify(row),{flag:'wx',mode:0o600});},
  async saveSelection(ownerId,connectionId,input){
   const row=await readConnection(ownerId,connectionId);
   if(await isPaused(ownerId,connectionId))throw Error('Connection paused on this Mac.');
   const selection=validateGoogleSourceSelection(row.provider,input),selectionId=randomUUID();
   const previous=(await latestSelections(ownerId)).get(connectionId),createdAt=Math.max(Date.now(),(previous?.createdAt||0)+1);
   const encrypted=sealer.seal({connectionId,selection,createdAt},'selection:'+ownerId+':'+selectionId);
   await writeFile(join(directory,selectionId+'.selection'),JSON.stringify({ownerId,selectionId,encrypted}),{flag:'wx',mode:0o600});
   return {connectionId,selectionId,selection,saved:true,importStarted:false};
  },
  async loadSelected(ownerId,connectionId,selectionId){
   if(!UUID.test(ownerId)||!UUID.test(connectionId)||!UUID.test(selectionId))throw Error('Verified connection required.');
   const row=await readConnection(ownerId,connectionId);
   if(await isPaused(ownerId,connectionId))throw Error('Connection paused on this Mac.');
   const saved=(await latestSelections(ownerId)).get(connectionId);
   if(!saved||saved.selectionId!==selectionId)throw Error('Source selection changed. Reload before previewing.');
   const selection=validateGoogleSourceSelection(row.provider,{source:row.provider==='gmail'?saved.selection.labelIds?.[0]:saved.selection.calendarIds?.[0],startDate:saved.selection.timeMin?.slice(0,10),endDate:saved.selection.timeMax?.slice(0,10)});
   if(JSON.stringify(selection)!==JSON.stringify(saved.selection))throw Error('Selection could not be verified.');
   return {...row,selection,selectionId,credentials:sealer.unseal(row.encrypted,'provider:'+ownerId+':'+connectionId)};
  },
  async setPaused(ownerId,connectionId,paused){
   await readConnection(ownerId,connectionId);if(typeof paused!=='boolean')throw Error('Choose pause or resume.');
   const current=await isPaused(ownerId,connectionId),path=join(directory,connectionId+'.paused');
   if(paused&&!current)await writeFile(path,JSON.stringify({ownerId,connectionId,pausedAt:Date.now()}),{flag:'wx',mode:0o600});
   if(!paused&&current)await rename(path,path+'-history-'+randomUUID());
   return {connectionId,paused,googleGrantRevoked:false};
  },
  async listOwner(ownerId){
   if(!UUID.test(ownerId))throw Error('Verified app owner required.');
   const result=[],selections=await latestSelections(ownerId);
   for(const file of await readdir(directory)){
    if(!/^[a-f0-9-]{36}\.connection$/i.test(file))continue;
    const path=join(directory,file),stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077))throw Error('Provider storage permissions are unsafe.');
    const row=JSON.parse(await readFile(path,'utf8'));if(row.ownerId!==ownerId)continue;
    const privateData=sealer.unseal(row.encrypted,'provider:'+ownerId+':'+row.connectionId);
    const paused=await isPaused(ownerId,row.connectionId);
    const permission=row.provider==='gmail'&&row.scope===GMAIL_READ_SCOPE?'Gmail read-only mailbox scope':row.provider==='google_calendar'&&row.scope===GOOGLE_CALENDAR_READ_SCOPE?'Google Calendar events read-only scope':null;
    if(!permission)throw Error('Provider authorization scope requires review.');
    result.push({connectionId:row.connectionId,provider:row.provider,accountLabel:privateData.email,status:paused?'paused':'authorized',permission,selectionRequired:!selections.has(row.connectionId),sourceSelection:selections.get(row.connectionId)||null});
   }
   return result;
  }
 };
 // Serialize mutations in this local server so rapid saves retain their true order.
 let pending=Promise.resolve();
 for(const name of ['saveSelection','setPaused']){const operation=connectionStore[name];connectionStore[name]=(...args)=>{const result=pending.then(()=>operation(...args));pending=result.catch(()=>{});return result;};}
 return {sealer,stateStore,connectionStore};
}
