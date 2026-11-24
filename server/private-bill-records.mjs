import {financeRecordId} from './private-finance-identity.mjs';
import {manualBill,billConfirmation} from '../src/private-manual-bills.mjs';
export const billType='manual_finance_bill',confirmationType='manual_bill_confirmation';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const confirmationId=(owner,billId,day)=>financeRecordId('private-bill-confirmation',owner,billId,day);
export function validateBillRow(row,owner){
 const p=row?.payload;
 if(!uuid(owner)||!uuid(row?.id)||row.owner_id!==owner||row.visibility!=='private'||row.household_id!==null||row.section!=='Finances'||
    row.origin!=='PRIVATE_MANUAL_FINANCE'||row.deleted_at!==null||!Number.isSafeInteger(row.version)||row.version<1||
    p?.fictional!==true||p.ownerId!==owner||p.version!==1)throw Error('Verified private bill record required.');
 const keys=Object.keys(p).sort().join(',');
 if(row.item_type===billType&&keys==='bill,fictional,ownerId,version')return manualBill(p.bill);
 if(row.item_type!==confirmationType||keys!=='billId,confirmation,fictional,match,ownerId,version'||!uuid(p.billId))
  throw Error('Private payment confirmation required.');
 const payment=billConfirmation(p.confirmation);
 if(row.id!==confirmationId(owner,p.billId,payment.dueDay))throw Error('Payment identity changed.');
 if(payment.source==='manual'&&p.match!==null||payment.source==='saved_transaction'&&
   (!p.match||Object.keys(p.match).sort().join(',')!=='key,recordId,version'||!uuid(p.match.key)||!uuid(p.match.recordId)||
    !Number.isSafeInteger(p.match.version)||p.match.version<1))throw Error('Payment provenance changed.');
 return payment;
}
export function billIndexes(row){
 if(row.item_type!==confirmationType)return {};
 return {billId:row.payload.billId,matchKey:row.payload.match?.key??null};
}
