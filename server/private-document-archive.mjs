import {createHash} from 'node:crypto';
import {openStoredDocument} from './private-document-store.mjs';
import {stableStringify} from './stable-json.mjs';
import {schoolGuideChanges} from '../src/private-school-guide-changes.mjs';
import {schoolGuideVersions} from '../src/private-school-guides.mjs';
import {categoryRecordType} from './private-transaction-category-record.mjs';
import {decodeManualFinanceRow} from './private-manual-finance-storage.mjs';
import {createTokenSealer} from './token-sealer.mjs';

export const MAX_ARCHIVE_DOCUMENTS=100;
export const MAX_DOCUMENT_ENVELOPES=23*1024*1024;
export const MAX_WORKSPACE_FILE=40*1024*1024;
const columns='content_key,file_envelope,id,metadata,owner_id,version';
const digest=row=>createHash('sha256').update(stableStringify(row)).digest('hex');

export function verifyArchivedDocuments(rows,owner,key){
 if(!Array.isArray(rows)||rows.length>MAX_ARCHIVE_DOCUMENTS)throw Error('Document archive exceeds its file count.');
 const ids=new Set(),contents=new Set();
 let size=0;
 for(const row of rows){
  if(!row||Object.keys(row).sort().join(',')!==columns||typeof row.metadata!=='string'||row.metadata.length>8192||
     typeof row.file_envelope!=='string'||ids.has(row.id)||contents.has(row.content_key))throw Error('Unexpected document archive row.');
  size+=row.file_envelope.length;
  if(size>MAX_DOCUMENT_ENVELOPES)throw Error('Documents exceed the bounded archive size.');
  const opened=openStoredDocument(row,owner,key);opened.bytes.fill(0);
  ids.add(row.id);contents.add(row.content_key);
 }
 return rows;
}

export function schoolDocumentIds(row){
 if(row.item_type!=='school_fixture')return [];
 schoolGuideChanges(row.payload);
 return schoolGuideVersions(row.payload).map(guide=>guide.documentId);
}

export function verifyArchivedReceiptLinks(records,documents,owner,key){
 const ids=new Set(documents.map(row=>row.id)),sealer=createTokenSealer(key);
 for(const row of records){
  if(schoolDocumentIds(row).some(id=>!ids.has(id)))throw Error('The archive is missing an original School guide.');
  if(row.item_type==='project'){
   const link=row.payload?.homeAsset?.receiptFile;
   if(link&&!ids.has(link.documentId))throw Error('The archive is missing an original maintenance receipt.');
   continue;
  }
  if(row.item_type!=='manual_finance_budget'&&row.item_type!==categoryRecordType)continue;
  const {payload}=decodeManualFinanceRow({...row,deleted_at:null},owner,sealer);
  const links=row.item_type===categoryRecordType?[payload.receiptDocumentId]:payload.budget.transactions.map(expense=>expense.receiptFile?.documentId);
  if(links.some(id=>id&&!ids.has(id)))throw Error('The archive is missing an original receipt document.');
 }
}

export function compareArchivedDocuments(archived,current,owner,key){
 verifyArchivedDocuments(current,owner,key);
 const ids=new Map(current.map(row=>[row.id,row])),contents=new Set(current.map(row=>row.content_key));
 const missing=[],verifiedIds=new Set();
 let conflicting=0;
 for(const row of archived){
  const existing=ids.get(row.id);
  if(existing?digest(existing)!==digest(row):contents.has(row.content_key)){conflicting++;continue;}
  if(!existing)missing.push(row);
  verifiedIds.add(row.id);
 }
 return {missing,conflicting,verifiedIds,retained:archived.length-missing.length-conflicting,
  fingerprint:digest(current.map(row=>[row.id,digest(row)]).sort(([a],[b])=>a.localeCompare(b)))};
}
