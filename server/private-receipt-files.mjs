import {randomBytes,randomUUID} from 'node:crypto';
const token=()=>randomBytes(32).toString('base64url');
export async function receiptChoices(storage,actor,offset){
 if(!Number.isInteger(offset)||offset<0||offset>100000||offset%25)throw Error('Select a receipt file page.');
 const {documents,hasMore}=await storage.list(actor,offset),options=new Map();
 const files=documents.map(doc=>{const choice=token();options.set(choice,doc);return {choice,name:doc.fields.name};});
 return {options,reply:{files,hasMore,offset}};
}
export function selectedReceipt(picker,choice,original){
 if(choice===null){if(!original)throw Error('No attachment to remove.');return {file:null,name:null};}
 const doc=picker?.options.get(choice);
 if(!doc)throw Error('Choose a document from this receipt view.');
 return {file:{linkId:original?.linkId??randomUUID(),documentId:doc.id},name:doc.fields.name};
}
export async function downloadReceipt(storage,actor,link){
 if(!link)throw Error('No receipt file attached.');
 const meta=await storage.inspect(actor,link.documentId),r=await storage.read(actor,meta);
 return {fields:r.fields,data:r.data};
}
