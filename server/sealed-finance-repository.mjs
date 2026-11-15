// Application-layer protection for financial snapshots in addition to database RLS.
// Keys stay on the private server. Provider identifiers and financial content are sealed together.
const types=new Set(['provider_bank_account','provider_bank_transaction']);
export function createSealedFinanceRepository(repository,sealer){
 function sealRecord(row,ownerId){
  if(row.owner_id!==ownerId||!types.has(row.item_type)||row.section!=='Finances'||row.visibility!=='private'||row.household_id!==null)throw Error('Owner-private financial record required.');
  return {...row,payload:{version:1,scheme:'chase-private-v1',encrypted:sealer.seal(row.payload,'finance-record:'+ownerId+':'+row.id)}};
 }
 function openRecord(row,ownerId){
  if(row?.owner_id!==ownerId)throw Error('Financial record owner mismatch.');
  if(!types.has(row.item_type))return row; // Let the planner detect unrelated deterministic-ID collisions.
  if(row.section!=='Finances'||row.visibility!=='private'||row.household_id!==null||row.payload?.version!==1||row.payload.scheme!=='chase-private-v1'||typeof row.payload.encrypted!=='string'||Object.keys(row.payload).some(k=>!['version','scheme','encrypted'].includes(k)))throw Error('Encrypted private financial snapshot required.');
  return {...row,payload:sealer.unseal(row.payload.encrypted,'finance-record:'+ownerId+':'+row.id)};
 }
 return {
  async readByIds(actor,ownerId,ids){return (await repository.readByIds(actor,ownerId,ids)).map(row=>openRecord(row,ownerId));},
  async insertMany(actor,ownerId,records){return (await repository.insertMany(actor,ownerId,records.map(row=>sealRecord(row,ownerId)))).map(row=>openRecord(row,ownerId));},
  async listSavedFinance(actor,ownerId){return (await repository.listSavedFinance(actor,ownerId)).map(row=>openRecord(row,ownerId));}
 };
}
