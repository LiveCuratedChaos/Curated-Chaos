import {holdingType,validateHoldingRow} from './private-holding-record.mjs';
import {reconciliationType,validateExpenseReconciliation} from './private-expense-reconciliation.mjs';
import {categoryRecordType,validateCategoryRecord} from './private-transaction-category-record.mjs';
import {billType,confirmationType,validateBillRow,billIndexes} from './private-bill-records.mjs';
import {incomeSourceType,incomePaymentType,incomeMonthKeys,incomeMonth,validateIncomeRow} from './private-income-records.mjs';
import {validateBudgetRow} from './private-budget-period.mjs';
import {createTokenSealer} from './token-sealer.mjs';
import {validateManualFinanceEnvelope} from '../src/private-finance-manual.mjs';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const scheme = 'manual-finance-v1';

function collection(owner,kind='manual_finance_account') {
 if (!uuid(owner)) throw Error('Verified account owner required.');
 return '/rest/v1/cc_records?owner_id=eq.' + owner + '&section=eq.Finances&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.'+kind+'&origin=eq.PRIVATE_MANUAL_FINANCE';
}

function context(row) {
 const scope={manual_finance_account:scheme,manual_finance_budget:'manual-budget-v1',[incomeSourceType]:'manual-income-v1',[incomePaymentType]:'manual-payment-v1',[holdingType]:'manual-holding-v1',[reconciliationType]:'manual-expense-match-v1',[categoryRecordType]:'manual-transaction-categories-v1',[billType]:'manual-bill-v1',[confirmationType]:'manual-bill-confirmation-v1'}[row.item_type];
 return [scope,row.owner_id,row.id,row.version].join(':');
}

export function decodeManualFinanceRow(row, owner, sealer) {
 if (!uuid(row?.id) || row.owner_id!==owner || row.visibility!=='private' || row.household_id!==null ||
     row.section!=='Finances' || !['manual_finance_account','manual_finance_budget',incomeSourceType,incomePaymentType,billType,confirmationType,categoryRecordType,reconciliationType,holdingType].includes(row.item_type) || row.origin!=='PRIVATE_MANUAL_FINANCE' ||
     !Number.isSafeInteger(row.version) || row.version<1 || row.payload?.scheme!==scheme ||
     Object.keys(row.payload).sort().join(',')!==(row.item_type===confirmationType?'billId,encrypted,matchKey,scheme':row.item_type===incomePaymentType?'encrypted,expectedMonth,receivedMonth,scheme':'encrypted,scheme')) throw Error('Private manual account unavailable.');
 const decoded={...row,payload:sealer.unseal(row.payload.encrypted,context(row))};
 if(row.item_type===holdingType)validateHoldingRow(decoded,owner);
 else if(row.item_type===reconciliationType)validateExpenseReconciliation(decoded,owner);
 else if(row.item_type===categoryRecordType)validateCategoryRecord(decoded,owner);
 else if(row.item_type==='manual_finance_budget')validateBudgetRow(decoded,owner);
 else if([incomeSourceType,incomePaymentType].includes(row.item_type)){
  validateIncomeRow(decoded,owner);
  for(const [key,value] of Object.entries(incomeMonthKeys(decoded)))if(row.payload[key]!==value)throw Error('Income period index changed.');
 }else if([billType,confirmationType].includes(row.item_type)){
  validateBillRow(decoded,owner);
  for(const [key,value] of Object.entries(billIndexes(decoded)))if(row.payload[key]!==value)throw Error('Bill index changed.');
 }else validateManualFinanceEnvelope(decoded,owner);
 return decoded;
}

// The request transport supplies the signed-in user's token. Only the server opens the existing key.
export function createManualFinanceStorage(request, loadKey) {
 async function withKey(operation) {
  const key = await loadKey();
  try { return await operation(createTokenSealer(key)); }
  finally { key.fill(0); }
 }

 async function open(rows, owner, limit, selectedId, kind='manual_finance_account') {
  if (!Array.isArray(rows) || rows.length > limit) throw Error('Incomplete manual finance response.');
  if (!rows.length) return [];
  if(rows.some(row=>row?.item_type!==kind||row.deleted_at!==null||selectedId&&row.id!==selectedId))throw Error('Private finance selection changed.');
  return withKey(sealer => rows.map(row => decodeManualFinanceRow(row,owner,sealer)));
 }
 async function write(token, owner, draft, prior, kind='manual_finance_account') {
  if (!uuid(owner) || !uuid(draft?.id) || prior && (prior.id !== draft.id || prior.owner_id !== owner)) throw Error('Reviewed account required.');
  if(draft.item_type!==kind||kind===confirmationType)throw Error('Reviewed finance record type required.');
  const validate=kind===holdingType?validateHoldingRow:kind===billType?validateBillRow:kind==='manual_finance_budget'?validateBudgetRow:[incomeSourceType,incomePaymentType].includes(kind)?validateIncomeRow:validateManualFinanceEnvelope;
  if (prior) validate(prior,owner);
  const version = prior ? prior.version+1 : 1;
  const row = {...draft,version,deleted_at:null};
  validate(row,owner);
  const payload = await withKey(sealer => ({scheme,...incomeMonthKeys(row),encrypted:sealer.seal(draft.payload,context(row))}));
  const path = prior ? collection(owner,kind)+'&id=eq.'+draft.id+'&version=eq.'+prior.version : '/rest/v1/cc_records';
  const body = prior ? {payload} : {id:draft.id,owner_id:owner,household_id:null,visibility:'private',section:'Finances',
   item_type:kind,origin:'PRIVATE_MANUAL_FINANCE',payload};
  const rows = await request(path,{method:prior?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)},token);
  return open(rows,owner,1,draft.id,kind);
 }
 return {
  async listHoldings(token,owner){
   return open(await request(collection(owner,holdingType)+'&order=id.asc&limit=101',{},token),owner,100,null,holdingType);
  },
  async getHolding(token,owner,id){
   if(!uuid(id))throw Error('Select a holding.');
   return open(await request(collection(owner,holdingType)+'&id=eq.'+id+'&limit=2',{},token),owner,1,id,holdingType);
  },
  saveHolding:(token,owner,draft,prior)=>write(token,owner,draft,prior,holdingType),
  async getExpenseMatch(token,owner,id){
   if(!uuid(id))throw Error('Select a saved transaction.');
   return open(await request(collection(owner,reconciliationType)+'&id=eq.'+id+'&limit=2',{},token),owner,1,id,reconciliationType);
  },
  async matchExpense(token,owner,plan,prior){
   validateBudgetRow(prior,owner);
   const budget={...plan.budget,version:prior.version+1};
   const match={...plan.receipt,version:1,deleted_at:null};
   validateBudgetRow(budget,owner);validateExpenseReconciliation(match,owner);
   if(prior.id!==budget.id||budget.id!==match.payload.budgetId)throw Error('Budget selection changed.');
   const [budgetPayload,matchPayload]=await withKey(sealer=>[budget,match].map(row=>({scheme,encrypted:sealer.seal(row.payload,context(row))})));
   const source=match.payload.source;
   const body={p_source:source.recordId,p_source_version:source.version,p_budget:prior.id,p_budget_version:prior.version,p_budget_payload:budgetPayload,p_match:match.id,p_match_payload:matchPayload};
   return open(await request('/rest/v1/rpc/cc_match_private_expense',{method:'POST',body:JSON.stringify(body)},token),owner,1,match.id,reconciliationType);
  },
  async getTransactionCategories(token,owner,id){
   if(!uuid(id))throw Error('Select a saved transaction.');
   return open(await request(collection(owner,categoryRecordType)+'&id=eq.'+id+'&limit=2',{},token),owner,1,id,categoryRecordType);
  },
  async saveTransactionCategories(token,owner,draft,prior){
   if(prior){validateCategoryRecord(prior,owner);if(prior.id!==draft.id)throw Error('Category selection changed.');}
   const row={...draft,version:(prior?.version??0)+1,deleted_at:null};
   validateCategoryRecord(row,owner);
   const payload=await withKey(sealer=>({scheme,encrypted:sealer.seal(row.payload,context(row))}));
   const source=row.payload.source;
   const body={p_source:source.recordId,p_source_version:source.version,p_annotation:row.id,p_prior_version:prior?.version??0,p_payload:payload};
   return open(await request('/rest/v1/rpc/cc_save_transaction_categories',{method:'POST',body:JSON.stringify(body)},token),owner,1,row.id,categoryRecordType);
  },
  async listBills(token,owner){
   return open(await request(collection(owner,billType)+'&order=id.asc&limit=101',{},token),owner,100,null,billType);
  },
  async getBillRecord(token,owner,kind,id){
   if(![billType,confirmationType].includes(kind)||!uuid(id))throw Error('Select a bill record.');
   return open(await request(collection(owner,kind)+'&id=eq.'+id+'&limit=2',{},token),owner,1,id,kind);
  },
  saveBill:(token,owner,draft,prior)=>write(token,owner,draft,prior,billType),
  async listBillConfirmations(token,owner,billId,from,to){
   if(!uuid(billId))throw Error('Select a bill.');
   const path=collection(owner,confirmationType)+'&payload->>billId=eq.'+billId+'&order=id.asc&limit=100';
   const selected=[];let cursor='';
   for(;;){
    const rows=await open(await request(path+(cursor?'&id=gt.'+cursor:''),{},token),owner,100,null,confirmationType);
    for(const row of rows){
     if(row.id<=cursor||row.payload.billId!==billId)throw Error('Incomplete bill history.');
     cursor=row.id;
     const day=row.payload.confirmation.dueDay;
     if(day>=from&&day<=to)selected.push(row);
    }
    if(rows.length<100)return selected;
   }
  },
  async usedBillMatchKeys(token,owner,keys){
   if(!Array.isArray(keys)||keys.length>20||keys.some(k=>!uuid(k)))throw Error('Invalid transaction page.');
   if(!keys.length)return [];
   const path=collection(owner,confirmationType)+'&payload->>matchKey=in.('+keys.join(',')+')&limit=21';
   const rows=await open(await request(path,{},token),owner,20,null,confirmationType);
   return rows.map(row=>{
    const key=row.payload.match?.key;
    if(!keys.includes(key))throw Error('Transaction selection changed.');
    return key;
   });
  },
  async confirmBill(token,owner,draft,bill){
   validateBillRow(bill,owner);
   const row={...draft,deleted_at:null,version:1};
   validateBillRow(row,owner);
   if(row.item_type!==confirmationType||bill.item_type!==billType||bill.id!==row.payload.billId)throw Error('Bill selection changed.');
   const payload=await withKey(sealer=>({scheme,...billIndexes(row),encrypted:sealer.seal(row.payload,context(row))}));
   const match=row.payload.match;
   const body={p_bill:bill.id,p_bill_version:bill.version,p_occurrence:row.id,p_payload:payload,p_transaction:match?.recordId??null,p_transaction_version:match?.version??null};
   const rows=await request('/rest/v1/rpc/cc_record_bill_confirmation',{method:'POST',body:JSON.stringify(body)},token);
   return open(rows,owner,1,row.id,confirmationType);
  },
  async listIncomeSources(token,owner){
   return open(await request(collection(owner,incomeSourceType)+'&order=id.asc&limit=101',{},token),owner,100,null,incomeSourceType);
  },
  async getIncomeRecord(token,owner,kind,id){
   if(![incomeSourceType,incomePaymentType].includes(kind)||!uuid(id))throw Error('Select an income record.');
   return open(await request(collection(owner,kind)+'&id=eq.'+id+'&limit=2',{},token),owner,1,id,kind);
  },
  saveIncomeRecord:(token,owner,draft,prior)=>write(token,owner,draft,prior,draft.item_type),
  async listIncomePayments(token,owner,sourceId,from,to){
   if(!uuid(sourceId))throw Error('Select an income source.');
   const months=[],start=new Date(from+'T00:00:00Z');
   start.setUTCDate(1);
   while(start.toISOString().slice(0,10)<=to){
    if(months.length>=13)throw Error('Choose up to one year.');
    months.push(incomeMonth(owner,sourceId,start.toISOString()));
    start.setUTCMonth(start.getUTCMonth()+1);
   }
   const indexes=months.join(',');
   const path=collection(owner,incomePaymentType)+'&or=(payload->>expectedMonth.in.('+indexes+'),payload->>receivedMonth.in.('+indexes+'))&order=id.asc&limit=100';
   const rows=[];let cursor='';
   for(;;){
    const result=await request(path+(cursor?'&id=gt.'+cursor:''),{},token);
    const page=await open(result,owner,100,null,incomePaymentType);
    for(const row of page){
     if(row.id<=cursor||row.payload.sourceId!==sourceId||rows.length>=2000)throw Error('Complete selected income period required.');
     cursor=row.id;rows.push(row);
    }
    if(page.length<100)return rows;
   }
  },
  async listManualBudgetPage(token,owner,cursor){
   let path=collection(owner,'manual_finance_budget')+'&order=created_at.desc,id.desc&limit=11';
   if(cursor){
    if(!uuid(cursor.id)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor.createdAt))throw Error('Choose a valid budget cursor.');
    const boundary=encodeURIComponent(cursor.createdAt);
    path+='&or=(created_at.lt.'+boundary+',and(created_at.eq.'+boundary+',id.lt.'+cursor.id+'))';
   }
   return open(await request(path,{},token),owner,11,null,'manual_finance_budget');
  },
  async listManualBudgetIds(token,owner,ids){
   if(!Array.isArray(ids)||ids.length!==12||new Set(ids).size!==12||!ids.every(uuid))throw Error('Choose one budget year.');
   const path=collection(owner,'manual_finance_budget')+'&select=id&id=in.('+ids.join(',')+')&limit=13';
   const rows=await request(path,{},token);
   if(!Array.isArray(rows)||rows.length>12||rows.some(row=>Object.keys(row??{}).join(',')!=='id'||!ids.includes(row.id)))
    throw Error('Unexpected budget month response.');
   return rows.map(row=>row.id);
  },
  async getManualBudget(token,id,owner) {
   if (!uuid(id)) throw Error('Select a budget period.');
   const kind='manual_finance_budget';
   return open(await request(collection(owner,kind)+'&id=eq.'+id+'&limit=2',{},token),owner,1,id,kind);
  },
  saveManualBudget:(token,owner,draft,prior)=>write(token,owner,draft,prior,'manual_finance_budget'),
  async listManualFinanceAccounts(token,owner) {
   return open(await request(collection(owner)+'&order=id.asc&limit=101',{},token),owner,100);
  },
  async getManualFinanceAccount(token,id,owner) {
   if (!uuid(id)) throw Error('Select a manual account.');
   return open(await request(collection(owner)+'&id=eq.'+id+'&limit=2',{},token),owner,1,id);
  },
  addManualFinanceAccount:(token,draft)=>write(token,draft.owner_id,draft,null),
  updateManualFinanceAccount:(token,prior,owner,draft)=>write(token,owner,draft,prior)
 };
}
