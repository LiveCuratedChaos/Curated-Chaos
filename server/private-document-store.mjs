import {createCipheriv,createDecipheriv,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {createTokenSealer} from './token-sealer.mjs';
import {documentFields,documentFilter,matchesDocument,isDocumentId} from '../src/private-document-fields.mjs';

export function verifyUpload(input,base64){
 const fields=documentFields(input);
 if(typeof base64!=='string'||base64.length!==4*Math.ceil(fields.bytes/3))throw Error('Invalid file size.');
 const bytes=Buffer.from(base64,'base64');
 if(bytes.length!==fields.bytes||bytes.toString('base64')!==base64)throw Error('Invalid file content.');
 verifySignature(fields,bytes);
 return {fields,bytes};
}
function verifySignature(fields,bytes){
 const mime=bytes.subarray(0,5).equals(Buffer.from('%PDF-'))?'application/pdf':bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))?'image/png':
  bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':'';
 if(mime!==fields.mime)throw Error('File type does not match its content.');
}

function documentKey(master,owner,purpose){
 if(!Buffer.isBuffer(master)||master.length!==32)throw Error('Private document key unavailable.');
 return createHmac('sha256',master).update('cc-private-document-v1/'+purpose+'/'+owner).digest();
}
const metadataContext=(row,version=row.version)=>'document:'+row.id+':'+row.content_key+(version===1?'':':v'+version);
function metadataFields(owner,row,key){
 if(!row||row.owner_id!==owner||!isDocumentId(row.id)||!Number.isInteger(row.version)||row.version<1||row.version>2147483647||!/^[a-f0-9]{64}$/.test(row.content_key))throw Error('Private document selection changed.');
 const fields=documentFields(createTokenSealer(key).unseal(row.metadata,metadataContext(row)));
 return {id:row.id,version:row.version,fields};
}
export function openStoredDocument(row,owner,master){
 const metaKey=documentKey(master,owner,'metadata'),fileKey=documentKey(master,owner,'file'),hashKey=documentKey(master,owner,'content-key');
 let bytes;
 try{
  const doc=metadataFields(owner,row,metaKey);
  if(typeof row.file_envelope!=='string'||row.file_envelope.length!==4*Math.ceil((doc.fields.bytes+28)/3))throw Error('Invalid private file size.');
  const sealed=Buffer.from(row.file_envelope,'base64');
  if(sealed.length!==doc.fields.bytes+28||sealed.toString('base64')!==row.file_envelope)throw Error('Invalid private file envelope.');
  const cipher=createDecipheriv('aes-256-gcm',fileKey,sealed.subarray(0,12));
  cipher.setAAD(Buffer.from('document:'+doc.id+':'+row.content_key));cipher.setAuthTag(sealed.subarray(12,28));
  bytes=Buffer.concat([cipher.update(sealed.subarray(28)),cipher.final()]);
  if(createHmac('sha256',hashKey).update(bytes).digest('hex')!==row.content_key)throw Error('Could not verify file content.');
  verifySignature(doc.fields,bytes);
  return {...doc,bytes};
 }catch(error){bytes?.fill(0);throw error;}
 finally{metaKey.fill(0);fileKey.fill(0);hashKey.fill(0);}
}

export function createDocumentStorage(repository,keyLoader){
 const secret=async(owner,purpose)=>{
  const master=await keyLoader();
  try{return documentKey(master,owner,purpose);}finally{master?.fill?.(0);}
 };
 async function decode(actor,row){
  const key=await secret(actor.ownerId,'metadata');
  try{return metadataFields(actor.ownerId,row,key);}finally{key.fill(0);}
 }
 async function fingerprint(owner,bytes){
  const key=await secret(owner,'content-key');
  try{return createHmac('sha256',key).update(bytes).digest('hex');}finally{key.fill(0);}
 }
 async function prepare(actor,fields,data){
  const {bytes}=verifyUpload(fields,data),owner=actor.ownerId,contentKey=await fingerprint(owner,bytes);
  const existing=await repository.find(actor,contentKey);
  if(existing)return {existing:await decode(actor,existing)};
  const id=randomUUID(),aad=Buffer.from('document:'+id+':'+contentKey),fileKey=await secret(owner,'file');
  let envelope;
  try{
   const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',fileKey,iv);cipher.setAAD(aad);
   const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
   envelope=Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
  }finally{fileKey.fill(0);bytes.fill(0);}
  const key=await secret(owner,'metadata');
  try{return {row:{owner_id:owner,id,content_key:contentKey,metadata:createTokenSealer(key).seal(fields,aad.toString()),file_envelope:envelope}};}
  finally{key.fill(0);}
 }
 async function save(actor,row){
  if(row?.owner_id!==actor.ownerId)throw Error('Private document owner changed.');
  await repository.insert(actor,row);
  const stored=await repository.find(actor,row.content_key);
  if(!stored)throw Error('Could not confirm the saved document.');
  return {document:await decode(actor,stored),reused:stored.id!==row.id};
 }
 async function list(actor,offset){
  const rows=await repository.list(actor,offset);
  if(!Array.isArray(rows)||rows.length>26||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Incomplete document page.');
  return {documents:await Promise.all(rows.slice(0,25).map(r=>decode(actor,r))),hasMore:rows.length===26};
 }
 async function selectedMetadata(actor,ids){
  if(!Array.isArray(ids)||ids.length>500||new Set(ids).size!==ids.length||!ids.every(isDocumentId))throw Error('Choose current document references.');
  const documents=[];
  for(let offset=0;offset<ids.length;offset+=50){
   const batch=ids.slice(offset,offset+50),rows=await repository.byIds(actor,batch);
   if(!Array.isArray(rows)||rows.length>batch.length||new Set(rows.map(row=>row.id)).size!==rows.length||!rows.every(row=>batch.includes(row.id)))throw Error('Invalid document selection.');
   documents.push(...await Promise.all(rows.map(row=>decode(actor,row))));
  }
  return documents;
 }
 async function prepareEdit(actor,selected,changes){
  if(!changes||Object.keys(changes).filter(k=>!['classification','expiresOn'].includes(k)).sort().join(',')!=='folder,name,tags')throw Error('Choose a file name, folder and tags.');
  const row=await repository.metadata(actor,selected.id),current=await decode(actor,row);
  if(current.id!==selected.id||current.version!==selected.version)throw Error('Reopen the changed document.');
  const next={...current.fields,...changes};
  for(const key of ['classification','expiresOn'])if(next[key]==='')delete next[key];
  const fields=documentFields(next);
  if(JSON.stringify(fields)===JSON.stringify(current.fields))throw Error('Change a file detail before review.');
  const version=current.version+1,key=await secret(actor.ownerId,'metadata');
  try{
   return {owner:actor.ownerId,id:current.id,expected:current.version,fields,
    metadata:createTokenSealer(key).seal(fields,metadataContext(row,version))};
  }finally{key.fill(0);}
 }
 async function search(actor,criteria,after){
  const filter=documentFilter(criteria),documents=[];
  let scanned=0,cursor=after;
  while(scanned<100){
   const rows=await repository.after(actor,cursor);
   if(!Array.isArray(rows)||rows.length>26)throw Error('Invalid document search page.');
   for(const row of rows.slice(0,25)){
    if(cursor!==null&&row.id<=cursor)throw Error('Invalid document order.');
    const doc=await decode(actor,row);
    cursor=doc.id;scanned++;
    if(matchesDocument(doc.fields,filter))documents.push(doc);
    if(documents.length===25||scanned===100){
     return {documents,next:rows.at(-1).id===cursor?null:cursor};
    }
   }
   if(rows.length<=25)return {documents,next:null};
  }
 }
 async function textBatch(actor,cursor,limit){
  if(cursor!==null&&!isDocumentId(cursor)||!Number.isInteger(limit)||limit<1||limit>2)throw Error('Invalid document batch.');
  const rows=await repository.after(actor,cursor);
  if(!Array.isArray(rows)||rows.length>26||rows.some((row,i)=>!isDocumentId(row.id)||(i?row.id<=rows[i-1].id:cursor!==null&&row.id<=cursor)))throw Error('Invalid document order.');
  const documents=await Promise.all(rows.slice(0,limit).map(row=>decode(actor,row)));
  return {documents,hasMore:rows.length>limit};
 }
 async function saveEdit(actor,edit){
  if(actor.ownerId!==edit.owner)throw Error('Document owner changed.');
  const updated=await decode(actor,await repository.update(actor,edit.id,edit.expected,edit.metadata));
  if(updated.id!==edit.id||updated.version!==edit.expected+1||JSON.stringify(updated.fields)!==JSON.stringify(edit.fields))throw Error('Could not confirm document changes.');
  return updated;
 }
 async function read(actor,selected){
  const row=await repository.get(actor,selected.id);
  const master=await keyLoader();
  try{
   const {bytes,...doc}=openStoredDocument(row,actor.ownerId,master);
   try{
    if(doc.id!==selected.id||doc.version!==selected.version||JSON.stringify(doc.fields)!==JSON.stringify(selected.fields))throw Error('Private document changed.');
    return {...doc,data:bytes.toString('base64')};
   }finally{bytes.fill(0);}
  }finally{master?.fill?.(0);}
 }
 return {list,selectedMetadata,search,textBatch,prepare,save,prepareEdit,saveEdit,read,inspect:async(actor,id)=>decode(actor,await repository.metadata(actor,id))};
}

export function documentRepository(request){
 const table='/rest/v1/cc_private_documents',meta='id,owner_id,content_key,metadata,version';
 const select=(actor,query,columns=meta)=>request(table+'?select='+columns+'&owner_id=eq.'+encodeURIComponent(actor.ownerId)+'&'+query,{method:'GET'},actor.accessToken);
 async function one(rows){const values=await rows;if(!Array.isArray(values)||values.length>1)throw Error('Unexpected document result.');return values[0]??null;}
 return {list:(actor,offset)=>select(actor,'order=id.asc&limit=26&offset='+offset),
  byIds:(actor,ids)=>select(actor,'id=in.('+ids.join(',')+')&limit='+ids.length),
  after:(actor,cursor)=>select(actor,'order=id.asc&limit=26'+(cursor?'&id=gt.'+encodeURIComponent(cursor):'')),
  find:(actor,key)=>one(select(actor,'content_key=eq.'+encodeURIComponent(key)+'&limit=2')),
  metadata:(actor,id)=>one(select(actor,'id=eq.'+encodeURIComponent(id)+'&limit=2')),
  get:(actor,id)=>one(select(actor,'id=eq.'+encodeURIComponent(id)+'&limit=2',meta+',file_envelope')),
  update:(actor,id,expected,metadata)=>one(request(table+'?select='+meta+'&owner_id=eq.'+encodeURIComponent(actor.ownerId)+'&id=eq.'+encodeURIComponent(id)+'&version=eq.'+expected,
   {method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({metadata,version:expected+1})},actor.accessToken)),
  insert:(actor,row)=>request(table+'?on_conflict=owner_id,content_key',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(row)},actor.accessToken)};
}
