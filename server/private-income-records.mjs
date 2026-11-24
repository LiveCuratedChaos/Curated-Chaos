import {financeRecordId} from './private-finance-identity.mjs';
import {manualIncomeSchedule,manualIncomePayment} from '../src/private-manual-income.mjs';

export const incomeSourceType='manual_finance_income',incomePaymentType='manual_finance_payment';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const paymentId=(owner,sourceId,expectedDay,slot)=>financeRecordId('private-pay-v1',owner,sourceId,expectedDay,String(slot));
export const incomeMonth=(owner,sourceId,day)=>financeRecordId('private-income-month-v1',owner,sourceId,day.slice(0,7));

export function validateIncomeRow(row,owner){
 const p=row?.payload;
 if(!uuid(owner)||!uuid(row?.id)||row.owner_id!==owner||row.visibility!=='private'||row.household_id!==null||row.section!=='Finances'||
    row.origin!=='PRIVATE_MANUAL_FINANCE'||row.deleted_at!==null||!Number.isSafeInteger(row.version)||row.version<1||
    p?.fictional!==true||p.ownerId!==owner||p.version!==1)throw Error('Verified private income record required.');
 if(row.item_type===incomeSourceType&&Object.keys(p).sort().join(',')==='fictional,ownerId,schedule,version')return manualIncomeSchedule(p.schedule);
 if(row.item_type!==incomePaymentType||Object.keys(p).sort().join(',')!=='fictional,ownerId,payment,sourceId,version'||!uuid(p.sourceId))throw Error('Complete private payment required.');
 const payment=manualIncomePayment(p.payment);
 if(row.id!==paymentId(owner,p.sourceId,payment.expectedDay,payment.slot))throw Error('Paycheck identity changed.');
 return payment;
}
export function incomeMonthKeys(row){
 if(row.item_type!==incomePaymentType)return {};
 const {ownerId,sourceId,payment}=row.payload;
 return {expectedMonth:incomeMonth(ownerId,sourceId,payment.expectedDay),receivedMonth:incomeMonth(ownerId,sourceId,payment.receivedDay)};
}
