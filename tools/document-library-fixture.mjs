// Per-preview in-memory repository of ciphertext, isolated from every real account.
import {randomBytes} from 'node:crypto';
import {createDocumentStorage} from '../server/private-document-store.mjs';
export function createDocumentFixture(){
 const rows=new Map(),master=randomBytes(32);
 const owned=actor=>[...rows.values()].filter(r=>r.owner_id===actor.ownerId);
 const metadata=row=>{if(!row)return null;const {file_envelope,...rest}=row;return rest;};
 return createDocumentStorage({list:async(actor,offset)=>owned(actor).sort((a,b)=>a.id.localeCompare(b.id)).slice(offset,offset+26).map(metadata),
  find:async(actor,key)=>metadata(owned(actor).find(r=>r.content_key===key)),
  after:async(actor,cursor)=>owned(actor).filter(row=>!cursor||row.id>cursor).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,26).map(metadata),
  metadata:async(actor,id)=>metadata(owned(actor).find(r=>r.id===id)),
  get:async(actor,id)=>owned(actor).find(r=>r.id===id),
  update:async(actor,id,expected,sealed)=>{
   const row=owned(actor).find(r=>r.id===id&&r.version===expected);
   if(!row)return null;
   row.metadata=sealed;row.version++;return metadata(row);
  },
  insert:async(actor,row)=>{
   if(actor.ownerId!==row.owner_id)throw Error('Invalid document owner.');
   const key=row.owner_id+':'+row.content_key;if(!rows.has(key))rows.set(key,{...row,version:1});
  }},async()=>Buffer.from(master));
}
