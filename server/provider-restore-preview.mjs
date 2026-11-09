// Read-only comparison. There is intentionally no executor, upsert, delete or restore operation.
import {inspectProviderSnapshot,validateProviderSnapshotRows} from './provider-snapshot-backup.mjs';import {createTokenSealer} from './token-sealer.mjs';import {stableStringify} from './stable-json.mjs';
function content(row,key){
 if(['provider_email','provider_event'].includes(row.item_type))return row.payload;const context=['provider_bank_account','provider_bank_transaction'].includes(row.item_type)?'finance-record:'+row.owner_id+':'+row.id:'mac-calendar-record:'+row.owner_id+':'+row.id+':'+row.origin;return createTokenSealer(key).unseal(row.payload.encrypted,context);
}
export function previewProviderRestore({bytes,key,projectRef,ownerId,existing=[],fixtureRunId=null}){
 const snapshot=inspectProviderSnapshot(bytes,{key,projectRef,ownerId,fixtureRunId});if(!Array.isArray(existing)||existing.length>snapshot.records.length)throw Error('Exact bounded current-copy inventory required.');
 const expectedIds=new Set(snapshot.records.map(row=>row.id)),current=new Map();for(const row of existing){if(!expectedIds.has(row?.id)||current.has(row.id))throw Error('Unexpected or duplicate current-copy identity.');current.set(row.id,row);}
 const actions=snapshot.records.map(record=>{
  const prior=current.get(record.id),base={id:record.id,itemType:record.item_type};
  if(!prior)return record.created_at?{...base,action:'insert',record:structuredClone(record)}:{...base,action:'blocked-metadata'};
  if(prior.owner_id!==ownerId||prior.household_id!==null||prior.visibility!=='private'||prior.section!==record.section||prior.item_type!==record.item_type||prior.origin!==record.origin)return{...base,action:'blocked-scope'};
  if(prior.deleted_at!=null)return{...base,action:'blocked-deleted'};
  if(!Number.isInteger(prior.version)||prior.version<record.version)return{...base,action:'blocked-version'};
  // Authenticate and whitelist current data before any comparison. Re-encryption alone is not a conflict.
  const verified=validateProviderSnapshotRows([prior],ownerId,key,{fixtureRunId})[0];return{...base,action:stableStringify(content(verified,key))===stableStringify(content(record,key))?'unchanged':'conflict',expectedVersion:prior.version};
 });
 const count=action=>actions.filter(row=>row.action===action).length,blocked=actions.filter(row=>row.action.startsWith('blocked-')).length;
 return{snapshotId:snapshot.snapshotId,recordCount:snapshot.records.length,insertCount:count('insert'),unchangedCount:count('unchanged'),conflictCount:count('conflict'),blockedCount:blocked,requiresApproval:true,executed:false,databaseWritten:false,canProposeInsertOnly:blocked===0&&count('conflict')===0,actions};
}
