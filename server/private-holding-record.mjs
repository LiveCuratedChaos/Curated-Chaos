import {holdingInputs,holdingSummary} from '../src/private-holdings.mjs';
export const holdingType='manual_investment_holding';
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
export function validateHoldingRow(row,owner){
 const p=row?.payload;
 if(!uuid(owner)||!uuid(row?.id)||row.owner_id!==owner||row.visibility!=='private'||row.household_id!==null||row.section!=='Finances'||row.deleted_at!==null||
    row.origin!=='PRIVATE_MANUAL_FINANCE'||row.item_type!==holdingType||!Number.isSafeInteger(row.version)||row.version<1||p?.ownerId!==owner||p.fictional!==true||p.version!==1||
    Object.keys(p).sort().join(',')!=='fictional,holding,ownerId,version')throw Error('Verified owner-private investment holding required.');
 const holding=holdingInputs(p.holding);holdingSummary(holding);return holding;
}
