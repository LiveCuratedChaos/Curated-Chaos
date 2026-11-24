import {isDocumentId} from '../src/private-document-fields.mjs';
import {financeRecordId} from './private-finance-identity.mjs';
import {savedFinanceRecords} from './saved-finance-records.mjs';
import {transactionCategories} from '../src/private-transaction-categories.mjs';
import {validDay} from '../src/dev-brief-model.mjs';

export const categoryRecordType='manual_transaction_categories';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const categoryRecordId=(owner,ref)=>financeRecordId('private-transaction-categories',owner,ref.connectionId,ref.sourceId);
export function categorySource(row,owner){
 if(row?.item_type!=='provider_bank_transaction'||row.origin!=='plaid_readonly'||row.deleted_at!==null||!Number.isInteger(row.version)||row.version<1)
  throw Error('Verified saved transaction required.');
 const [entry]=savedFinanceRecords([row],owner).transactions;
 const {connectionId,sourceId}=row.payload;
 return {source:{connectionId,sourceId,recordId:row.id,version:row.version,day:entry.date,amountMinor:entry.amountMinor},
  label:entry.merchant||entry.name||'Saved transaction',pending:entry.pending};
}
export function validateCategoryRecord(row,owner){
 const p=row?.payload,ref=p?.source;
 if(!uuid(owner)||!uuid(row?.id)||row.owner_id!==owner||row.visibility!=='private'||row.household_id!==null||row.deleted_at!==null||
    row.section!=='Finances'||row.origin!=='PRIVATE_MANUAL_FINANCE'||row.item_type!==categoryRecordType||!Number.isSafeInteger(row.version)||row.version<1||
    p?.ownerId!==owner||p.fictional!==true||p.version!==1||Object.keys(p).sort().join(',')!==(Object.hasOwn(p,'receiptDocumentId')?'categories,fictional,ownerId,receiptDocumentId,source,version':'categories,fictional,ownerId,source,version')||
    !ref||Object.keys(ref).sort().join(',')!=='amountMinor,connectionId,day,recordId,sourceId,version'||!uuid(ref.connectionId)||!uuid(ref.recordId)||
    !Number.isSafeInteger(ref.version)||ref.version<1||typeof ref.sourceId!=='string'||!ref.sourceId||ref.sourceId.length>256||/[\u0000-\u0020\u007f]/.test(ref.sourceId)||
    typeof ref.day!=='string'||!validDay(ref.day)||!Number.isSafeInteger(ref.amountMinor)||row.id!==categoryRecordId(owner,ref))throw Error('Invalid saved transaction category record.');
 if(Object.hasOwn(p,'receiptDocumentId')&&p.receiptDocumentId!==null&&!isDocumentId(p.receiptDocumentId))throw Error('Invalid receipt document.');
 if(p.categories===null&&Object.hasOwn(p,'receiptDocumentId'))return null;
 return transactionCategories(p.categories,ref);
}
