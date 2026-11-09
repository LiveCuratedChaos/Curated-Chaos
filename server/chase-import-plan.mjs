// Pure financial snapshot planning. No transactions, payments, decisions or database writes.
import {createHash} from 'node:crypto';
import {stableStringify} from './stable-json.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=value=>typeof value==='string'&&value.length>0&&value.length<=256&&!/[\u0000-\u0020\u007f]/.test(value);
const minor=(value,nullable=false)=>Number.isSafeInteger(value)||nullable&&value===null;
const text=(value,max)=>typeof value==='string'&&value.length<=max;
const recordId=parts=>{const h=createHash('sha256').update(stableStringify(parts)).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-8'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function planChaseImport({ownerId,connectionId,selectionId,preview,selectedKeys,existing=[],fixtureRunId=null}){
 if(![ownerId,connectionId,selectionId].every(v=>UUID.test(v||''))||fixtureRunId!==null&&!UUID.test(fixtureRunId))throw Error('Verified financial owner, connection and review required.');
 if(preview?.complete!==true||preview.previewOnly!==true||preview.databaseWritten!==false||preview.provider!=='plaid'||preview.institution!=='Chase'||preview.ownerId!==ownerId||preview.connectionId!==connectionId||preview.selectionId!==selectionId||!day(preview.startDate)||!day(preview.endDateExclusive)||preview.endDateExclusive<=preview.startDate||Date.parse(preview.endDateExclusive)-Date.parse(preview.startDate)>31*86400000||!Array.isArray(preview.accounts)||!preview.accounts.length||preview.accounts.length>10||!Array.isArray(preview.transactions)||preview.transactions.length>500)throw Error('Use a complete bounded owner-approved financial preview.');
 if(!Array.isArray(selectedKeys)||selectedKeys.length>250||new Set(selectedKeys).size!==selectedKeys.length||selectedKeys.some(k=>!id(k))||!Array.isArray(existing))throw Error('Explicit bounded financial item selection required.');
 const accounts=new Set(preview.accounts.map(a=>a.accountId));if(accounts.size!==preview.accounts.length||[...accounts].some(a=>!id(a)))throw Error('Ambiguous account identities.');
 const byKey=new Map();
 for(const [kind,rows] of [['account',preview.accounts],['transaction',preview.transactions]])for(const row of rows){
  if(!id(row?.key)||byKey.has(row.key)||row.ownerId!==ownerId||row.connectionId!==connectionId||row.provider!=='plaid'||row.institution!=='Chase'||row.visibility!=='private'||row.currency!=='USD'||!accounts.has(row.accountId))throw Error('Financial preview scope could not be verified.');byKey.set(row.key,{kind,row});
 }
 const records=selectedKeys.map(key=>{
  const found=byKey.get(key);if(!found)throw Error('Select only items from the verified financial preview.');const {kind,row}=found;let content,sourceId;
  if(kind==='account'){
   if(!text(row.name,140)||!minor(row.currentMinor,true)||!minor(row.availableMinor,true)||row.balanceFreshness!=='provider-cached'||!(row.type==='depository'&&['checking','savings'].includes(row.subtype)||row.type==='credit'&&row.subtype==='credit card'))throw Error('Supported bank snapshot required.');
   sourceId=row.accountId;content={name:row.name,type:row.type,subtype:row.subtype,currency:'USD',currentMinor:row.currentMinor,availableMinor:row.availableMinor,balanceFreshness:'provider-cached',sourceUpdatedAt:null};
  }else{
   if(!id(row.transactionId)||!minor(row.amountMinor)||!day(row.date)||row.date<preview.startDate||row.date>=preview.endDateExclusive||!text(row.name,300)||!text(row.merchant,140)||typeof row.pending!=='boolean'||row.pendingTransactionId!==null&&!id(row.pendingTransactionId))throw Error('Valid selected transaction snapshot required.');
   sourceId=row.transactionId;content={accountId:row.accountId,date:row.date,name:row.name,merchant:row.merchant,amountMinor:row.amountMinor,currency:'USD',direction:row.amountMinor>0?'outflow':row.amountMinor<0?'inflow':'neutral',pending:row.pending,pendingTransactionId:row.pendingTransactionId};
  }
  return {id:recordId([ownerId,'plaid',connectionId,kind,sourceId]),owner_id:ownerId,household_id:null,visibility:'private',section:'Finances',item_type:kind==='account'?'provider_bank_account':'provider_bank_transaction',origin:fixtureRunId?'plaid_import_qa':'plaid_readonly',payload:{fictional:Boolean(fixtureRunId),...(fixtureRunId?{fixtureRunId}:{}),provider:'plaid',institution:'Chase',connectionId,sourceId,content}};
 });
 const actions=records.map(record=>{
  const matches=existing.filter(r=>r?.id===record.id);if(!matches.length)return {action:'insert',record};const old=matches[0];
  if(matches.length!==1||old.deleted_at!=null||old.owner_id!==ownerId||old.household_id!==null||old.visibility!=='private'||old.section!=='Finances'||old.origin!==record.origin||old.item_type!==record.item_type||old.payload?.connectionId!==connectionId||old.payload?.sourceId!==record.payload.sourceId)throw Error('Saved financial record conflicts with the reviewed source. Nothing may be overwritten.');
  const unchanged=stableStringify(old.payload)===stableStringify(record.payload);if(!unchanged&&(!Number.isInteger(old.version)||old.version<1))throw Error('A verified financial record revision is required.');return {action:unchanged?'unchanged':'review-update',record,expectedVersion:old.version};
 });
 return {ownerId,connectionId,selectionId,requiresApproval:true,executed:false,deletes:[],actions};
}
