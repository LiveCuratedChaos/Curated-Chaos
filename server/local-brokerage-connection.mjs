import {createHash,randomUUID} from 'node:crypto';
import {link,open,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {createLocalProviderStore} from './local-provider-store.mjs';
import {createLinkedBrokerageSource} from './linked-brokerage-source.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

// Local-development storage. Only an explicitly configured host creates this source.
// Publishing an encrypted grant uses an exclusive link so two successful Link sessions cannot replace one another.
export async function createLocalBrokerageSource(directory,settings){
 const {sealer}=await createLocalProviderStore(directory),pending=new Map(),{institution,environment='sandbox'}=settings;
 function location(owner){
  if(!uuid(owner))throw Error('Verified brokerage owner required.');
  const key=createHash('sha256').update(JSON.stringify([owner,environment,institution.id])).digest('hex');
  return join(directory,key+'.brokerage');
 }
 const connectionStore={
  async listOwner(owner){
   let file;
   try{file=await open(location(owner),constants.O_RDONLY|constants.O_NOFOLLOW);}
   catch(error){if(error.code==='ENOENT')return [];throw error;}
   try{
    const stat=await file.stat();
    if(!stat.isFile()||(stat.mode&0o077)||stat.size>100000)throw Error('Private brokerage storage required.');
    const record=JSON.parse(await file.readFile('utf8'));
    if(record.ownerId!==owner||record.scope!=='investments'||record.environment!==environment||record.institution!==institution.name||
      record.provider!=='plaid'||!uuid(record.connectionId))throw Error('Brokerage authorization could not be verified.');
    return [record];
   }finally{await file.close();}
  },
  async insert(row){
   const final=location(row.ownerId),temp=join(directory,randomUUID()+'.pending');
   if(!uuid(row.connectionId)||row.scope!=='investments'||row.institution!==institution.name||row.environment!==environment||
     row.status!=='authorized'||row.revision!==1)throw Error('Unexpected brokerage authorization.');
   const file=await open(temp,'wx',0o600);
   try{
    try{await file.writeFile(JSON.stringify(row));await file.sync();}finally{await file.close();}
    await link(temp,final);
   }finally{await unlink(temp);}
  }
 };
 const attemptStore={
  async put(id,value){
   const timer=setTimeout(()=>pending.delete(id),Math.max(1,value.expiresAt-(settings.now??Date.now)()));timer.unref?.();
   pending.set(id,{value,timer});
  },
  async get(id){return pending.get(id)?.value;},
  async consume(id){const a=pending.get(id);if(a){clearTimeout(a.timer);pending.delete(id);}return a?.value;}
 };
 const source=createLinkedBrokerageSource({...settings,connectionStore,attemptStore,sealer});
 return {...source,dispose(){for(const a of pending.values())clearTimeout(a.timer);pending.clear();source.dispose();}};
}
