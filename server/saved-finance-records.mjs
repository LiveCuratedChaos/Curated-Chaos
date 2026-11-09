import {safeSavedAt} from './snapshot-freshness.mjs';
// Whitelisted owner-private financial snapshots, never a live bank feed.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=value=>typeof value==='string'&&value.length>0&&value.length<=256&&!/[\u0000-\u0020\u007f]/.test(value);
const text=(value,max)=>typeof value==='string'&&value.length<=max;
const minor=(value,nullable=false)=>Number.isSafeInteger(value)||nullable&&value===null;
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function savedFinanceRecords(rows,ownerId){
 if(!UUID.test(ownerId||'')||!Array.isArray(rows))throw Error('Verified financial owner required.');
 const accounts=[],transactions=[],seen=new Set();
 for(const row of rows){const p=row?.payload,c=p?.content;
  if(!UUID.test(row?.id||'')||seen.has(row.id)||row.owner_id!==ownerId||row.household_id!==null||row.visibility!=='private'||row.deleted_at!=null||row.section!=='Finances'||!['provider_bank_account','provider_bank_transaction'].includes(row.item_type)||!UUID.test(p?.connectionId||'')||!id(p.sourceId)||p.provider!=='plaid'||p.institution!=='Chase'||!(row.origin==='plaid_readonly'&&p.fictional===false||row.origin==='plaid_import_qa'&&p.fictional===true&&UUID.test(p.fixtureRunId||''))||c?.currency!=='USD')throw Error('Saved financial record permissions or identity could not be verified.');seen.add(row.id);
  const base={savedAt:safeSavedAt(row.created_at),fictional:p.fictional,currency:'USD'};
  if(row.item_type==='provider_bank_account'){
   if(!text(c.name,140)||!minor(c.currentMinor,true)||!minor(c.availableMinor,true)||c.balanceFreshness!=='provider-cached'||!(c.type==='depository'&&['checking','savings'].includes(c.subtype)||c.type==='credit'&&c.subtype==='credit card'))throw Error('Saved bank snapshot is invalid.');
   accounts.push({...base,accountId:p.connectionId+':'+p.sourceId,name:c.name,type:c.type,subtype:c.subtype,currentMinor:c.currentMinor,availableMinor:c.availableMinor});
  }else{
   if(!id(c.accountId)||!day(c.date)||!text(c.name,300)||!text(c.merchant,140)||!minor(c.amountMinor)||typeof c.pending!=='boolean'||c.pendingTransactionId!==null&&!id(c.pendingTransactionId))throw Error('Saved bank transaction is invalid.');
   transactions.push({...base,accountId:p.connectionId+':'+c.accountId,date:c.date,name:c.name,merchant:c.merchant,amountMinor:c.amountMinor,direction:c.amountMinor>0?'outflow':c.amountMinor<0?'inflow':'neutral',pending:c.pending,pendingTransactionId:c.pendingTransactionId});
  }
 }
 return {saved:true,provider:'plaid',institution:'Chase',freshness:'saved-snapshot',sourceUpdatedAt:null,accounts,transactions};
}
