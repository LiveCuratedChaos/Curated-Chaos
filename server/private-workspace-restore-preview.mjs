// Comparison only: no database client, file writes, insertion payloads or restore executor.
import {inspectPrivateWorkspace,validatePrivateWorkspaceRows} from './private-workspace-backup.mjs';import {stableStringify} from './stable-json.mjs';import {safeSavedAt} from './snapshot-freshness.mjs';
const singleton=row=>['brief_preferences','dashboard_layout'].includes(row.item_type)&&row.deleted_at==null;
const approvalSource=row=>row.item_type==='task'&&row.payload?.fictional===true&&/^M1A_APPROVED_/.test(row.payload?.source||'')?row.payload.source:null;
export function previewPrivateWorkspaceRestore({bytes,key,projectRef,ownerId,existing=[]}){
 const snapshot=inspectPrivateWorkspace(bytes,{key,projectRef,ownerId}),currentRows=validatePrivateWorkspaceRows(existing,ownerId,key),current=new Map(currentRows.map(row=>[row.id,row]));
 const actions=snapshot.records.map(record=>{
  const prior=current.get(record.id),base={id:record.id,itemType:record.item_type};
  if(!prior){
   if(record.deleted_at!=null)return{...base,action:'archived-deleted'};
   const occupied=currentRows.some(row=>row.id!==record.id&&(singleton(record)&&singleton(row)&&row.item_type===record.item_type||approvalSource(record)&&approvalSource(record)===approvalSource(row)));
   if(occupied)return{...base,action:'blocked-unique-slot'};
   // Two archived active singleton/source records must never be proposed together.
   const archiveCollision=snapshot.records.some(row=>row.id!==record.id&&(singleton(record)&&singleton(row)&&row.item_type===record.item_type||approvalSource(record)&&approvalSource(record)===approvalSource(row)));
   return{...base,action:archiveCollision?'blocked-archive-duplicate':'missing-needs-review'};
  }
  if(prior.section!==record.section||prior.item_type!==record.item_type||prior.origin!==record.origin)return{...base,action:'blocked-scope'};
  if((prior.deleted_at==null)!==(record.deleted_at==null))return{...base,action:'blocked-deletion-state'};
  if(prior.version<record.version)return{...base,action:'blocked-version'};
  if(safeSavedAt(prior.created_at)!==safeSavedAt(record.created_at))return{...base,action:'blocked-created-time'};
  const sameDeletion=prior.deleted_at==null||safeSavedAt(prior.deleted_at)===safeSavedAt(record.deleted_at),samePayload=stableStringify(prior.payload)===stableStringify(record.payload);
  return{...base,action:sameDeletion&&samePayload?'unchanged':'conflict',newerRevision:prior.version>record.version};
 });
 const count=action=>actions.filter(row=>row.action===action).length;
 return{snapshotId:snapshot.snapshotId,recordCount:snapshot.records.length,unchangedCount:count('unchanged'),missingCount:count('missing-needs-review'),archivedDeletedCount:count('archived-deleted'),conflictCount:count('conflict'),blockedCount:actions.filter(row=>row.action.startsWith('blocked-')).length,currentOnlyCount:currentRows.filter(row=>!snapshot.records.some(record=>record.id===row.id)).length,executed:false,databaseWritten:false,restoreAvailable:false,actions};
}
