import {MAX_WORKSPACE_FILE,compareArchivedDocuments,schoolDocumentIds} from './private-document-archive.mjs';
import {PRIVATE_RECOVERY_DAYS,privateRecoveryDeadline} from '../src/private-record-retention.mjs';
import {verifyRecordVersionRecovery} from './private-record-version-provenance.mjs';
import {stableStringify} from './stable-json.mjs';
import {retainedRecordVersionPlan} from './private-record-version-recovery.mjs';
import {taskGraphRestorePlan} from './private-task-graph-restore.mjs';
import {validatePrivateSchoolRestoreAssociations,orderPrivateSchoolRestoreRows,assessmentHistoryRestoreCount} from './private-school-restore.mjs';
// Server-only, opt-in recovery foundation. No HTTP/CLI or hosted adapter enables it.
// withLockedWorkspace MUST serialize writes and roll back on callback failure.
import {randomBytes} from 'node:crypto';
import {inspectPrivateWorkspace,validatePrivateWorkspaceRows,validatePrivateRecordVersions} from './private-workspace-backup.mjs';
import {previewPrivateWorkspaceRestore} from './private-workspace-restore-preview.mjs';
import {privateWorkspaceRestoreDigest as digest,restorableRoutineIds,blockedManualFinanceRestores,supportsOrdinaryWorkspaceRestore,supportsArchivedDeletedWorkspaceRestore,withinArchivedDeletedRetention} from './private-workspace-restore-contract.mjs';
const relationships=new Set(['project_task_link','project_project_link']);
const same=(a,b)=>a.ownerId===b.ownerId&&a.binding===b.binding;
export function createPrivateWorkspaceRestoreExecutor({repository,resolveActor,projectRef,key,authorizeWrite=async()=>false,now=Date.now,maxRecords=250,allowTaskGraphRestore=false,allowHierarchyRestore=false,allowRecordHistoryImport=false,allowArchivedDeletedRestore=false,allowManualFinanceRestore=false,allowDocumentRestore=false}){
 if(typeof allowHierarchyRestore!=='boolean'||allowHierarchyRestore&&typeof repository?.canRestoreHierarchy!=='function')throw Error('Project hierarchy recovery repository required.');
 if(typeof allowDocumentRestore!=='boolean'||allowDocumentRestore&&typeof repository?.readDocuments!=='function')throw Error('Document recovery repository required.');
 if(typeof allowManualFinanceRestore!=='boolean')throw Error('Explicit manual finance restore scope required.');
 if(typeof allowArchivedDeletedRestore!=='boolean'||allowArchivedDeletedRestore&&typeof repository?.canRestoreArchivedDeleted!=='function')throw Error('Explicit protected archived-deletion recovery scope required.');
 if(typeof allowRecordHistoryImport!=='boolean'||allowRecordHistoryImport&&typeof repository?.canImportRecordVersions!=='function')throw Error('Explicit protected history import scope required.');
 if(typeof allowTaskGraphRestore!=='boolean'||allowTaskGraphRestore&&typeof repository?.canRestoreTaskGraphs!=='function')throw Error('Explicit supported task graph recovery scope required.');
 if(!repository||repository.projectRef!==projectRef||typeof repository.readPrivateRows!=='function'||typeof repository.withLockedWorkspace!=='function'||typeof resolveActor!=='function'||typeof authorizeWrite!=='function'||typeof now!=='function'||!Buffer.isBuffer(key)||key.length!==32||!Number.isInteger(maxRecords)||maxRecords<1||maxRecords>2000||typeof projectRef!=='string'||!/^[a-z0-9]{10,32}$/.test(projectRef))throw Error('Bounded transactional private recovery context required.');
 const secret=Buffer.from(key),reviews=new Map(),pending=new Set(),active=new Set(),revokedBindings=new Set();let disposed=false;
 function forget(id){const entry=reviews.get(id);if(!entry)return;clearTimeout(entry.timer);reviews.delete(id);entry.bytes.fill(0);}
 async function session(actor){if(disposed)throw Error('Recovery context ended.');const s=await resolveActor(actor);if(disposed||!s||typeof s.ownerId!=='string'||typeof s.sessionBinding!=='string'||s.sessionBinding.length<16||revokedBindings.has(s.sessionBinding)||!Number.isFinite(s.expiresAt)||s.expiresAt<=now())throw Error('Active recovery owner and session required.');return{ownerId:s.ownerId,binding:s.sessionBinding,expiresAt:s.expiresAt};}
 async function inspect(bytes,s,existing,graphSchemaReady=false,deletedRestoreReady=false,readDocuments=null,checkHierarchy=null){
  const snapshot=inspectPrivateWorkspace(bytes,{key:secret,projectRef,ownerId:s.ownerId});if(snapshot.records.length>maxRecords)throw Error('Archive exceeds the approved record cap.');
  let documentPlan=null,documentBlocked=0;
  if(snapshot.documents?.length){
   if(!allowDocumentRestore||typeof readDocuments!=='function')documentBlocked=snapshot.documents.length;
   else{
    documentPlan=compareArchivedDocuments(snapshot.documents,await readDocuments(snapshot.documents),s.ownerId,secret);
    documentBlocked=documentPlan.conflicting;
   }
  }
  const rows=validatePrivateWorkspaceRows(existing,s.ownerId,secret),candidates=snapshot.records.filter(r=>r.deleted_at===null&&!rows.some(current=>current.id===r.id)),graph=allowTaskGraphRestore?taskGraphRestorePlan({inserts:candidates,existing:rows,ownerId:s.ownerId,key:secret}):null,supportedGraph=Boolean(allowTaskGraphRestore&&graphSchemaReady===true&&graph?.supported),supportedIds=new Set(supportedGraph?graph.membershipIds:[]);
  const newEdges=snapshot.records.filter(row=>row.item_type==='project_project_link'&&!rows.some(current=>current.id===row.id)
   &&(row.deleted_at===null||allowArchivedDeletedRestore&&withinArchivedDeletedRetention(row,{now:now()})));
  const hierarchyReady=allowHierarchyRestore&&newEdges.length>0&&await checkHierarchy?.()===true;
  const plan=previewPrivateWorkspaceRestore({bytes,key:secret,projectRef,ownerId:s.ownerId,existing:rows,allowNewTaskGraphTargets:supportedGraph,allowFreshHierarchy:hierarchyReady,allowArchivedDeletedRestore:allowArchivedDeletedRestore&&deletedRestoreReady,now:now()});
  const missing=new Set(plan.actions.filter(a=>a.action==='missing-needs-review'||a.action==='missing-deleted-needs-review').map(a=>a.id));
  const inserts=snapshot.records.filter(r=>missing.has(r.id)),relationshipCount=inserts.filter(r=>relationships.has(r.item_type)&&!supportedIds.has(r.id)&&!(hierarchyReady&&r.item_type==='project_project_link')).length;
  const routineIds=restorableRoutineIds({inserts,existing:rows,archive:snapshot.records,ownerId:s.ownerId,now:now()});
  digest(snapshot.records);const unsupportedRecordCount=(allowManualFinanceRestore?blockedManualFinanceRestores(inserts,rows,secret,documentPlan?.verifiedIds):0)+inserts.filter(r=>!relationships.has(r.item_type)&&!supportedIds.has(r.id)&&!(r.deleted_at===null&&r.item_type==='task'&&Object.hasOwn(r.payload,'recurrence')?routineIds.has(r.id):r.deleted_at!==null&&allowArchivedDeletedRestore&&deletedRestoreReady?supportsArchivedDeletedWorkspaceRestore(r,{now:now()}):supportsOrdinaryWorkspaceRestore(r,{manualFinanceKey:allowManualFinanceRestore?secret:null}))).length;
  const linkedRows=[...inserts,...(snapshot.recordVersions??[]).map(v=>v.snapshot)];
  documentBlocked+=linkedRows.flatMap(schoolDocumentIds).filter(id=>!documentPlan?.verifiedIds.has(id)).length;
  const referencedAssets=linkedRows.filter(row=>row.item_type==='project'&&row.payload?.homeAsset?.receiptFile);
  documentBlocked+=referencedAssets.filter(row=>!documentPlan?.verifiedIds.has(row.payload.homeAsset.receiptFile.documentId)).length;
  const unsupportedAcademicAssociationCount=validatePrivateSchoolRestoreAssociations({inserts,existing:rows,allowDeletedRecords:allowArchivedDeletedRestore&&deletedRestoreReady});
  return{hierarchyLinks:newEdges.length,hierarchyReady,documentPlan,documentBlocked,deletedRestoreReady,deletedScopeBlockedCount:allowArchivedDeletedRestore&&!deletedRestoreReady?snapshot.records.filter(r=>!rows.some(current=>current.id===r.id)&&withinArchivedDeletedRetention(r,{now:now()})).length:0,deletedSchoolRestoreCount:inserts.filter(r=>r.item_type==='school_fixture'&&r.deleted_at!==null).length,deletedSchoolBlockedCount:0,deletedRecordRestoreCount:inserts.filter(r=>r.deleted_at!==null).length,recordVersionsUnverifiedCount:snapshot.recordVersions?.length??0,recordVersionBlockedCount:snapshot.recordVersions?.length??0,assessmentHistoryCount:assessmentHistoryRestoreCount(inserts),assessmentHistoryBlockedCount:assessmentHistoryRestoreCount(inserts),historySchemaReady:false,snapshot,rows,plan,inserts,relationshipCount,unsupportedRecordCount,unsupportedAcademicAssociationCount,graphSchemaReady,taskGraphMembershipCount:inserts.filter(r=>supportedIds.has(r.id)).length,taskGraphBlockedCount:(graph?.membershipCount??0)-inserts.filter(r=>supportedIds.has(r.id)).length,fingerprint:digest(rows)+(newEdges.length?':hierarchy='+hierarchyReady:'')+(documentPlan?.fingerprint??String(documentBlocked))+(allowArchivedDeletedRestore?':deleted='+deletedRestoreReady+':'+digest(inserts):'')};
 }
 async function protectedHistory(value,getReady,getVersions,getImportReady,getSchoolTombstonesReady,getSavedSearchReady){
  if(value.deletedSchoolRestoreCount){const ready=typeof getSchoolTombstonesReady==='function'&&await getSchoolTombstonesReady()===true;value.deletedSchoolBlockedCount=ready?0:value.deletedSchoolRestoreCount;value.fingerprint+=':school-deleted='+ready;}
  if(value.recordVersionBlockedCount&&typeof getVersions==='function'){
   const current=await getVersions();
   if(current?.ready===true){
    const plan=retainedRecordVersionPlan({archived:value.snapshot.recordVersions,current:current.versions,records:value.rows,ownerId:value.snapshot.ownerId,key:secret});
    value.recordVersionBlockedCount=plan.blocked;value.recordVersionsUnverifiedCount=0;value.recordVersionsMissingCount=plan.missing;value.recordVersionsConflictCount=plan.conflicting;value.recordVersionsRetainedCount=plan.retained;value.recordVersionFingerprint=plan.fingerprint;value.recordVersionCurrentEntries=structuredClone(current.versions);value.recordVersionImports=[];
    const ready=allowRecordHistoryImport&&typeof getImportReady==='function'&&await getImportReady()===true;
    const missingShortcuts=plan.missingEntries.some(entry=>entry.item_type==='saved_search');
    const shortcutsReady=!missingShortcuts||ready&&typeof getSavedSearchReady==='function'&&await getSavedSearchReady()===true;
    if(ready&&!plan.conflicting){for(const entry of plan.missingEntries){if(entry.item_type==='saved_search'&&!shortcutsReady)continue;const source=[...value.rows,...value.inserts].find(r=>r.id===entry.record_id&&r.item_type===entry.item_type);if(!source)continue;try{verifyRecordVersionRecovery({version:1,snapshotId:value.snapshot.snapshotId,restoredAt:new Date(now()).toISOString(),previous:entry.recovery??null});}catch{continue;}value.recordVersionImports.push(entry);}}
    value.recordVersionBlockedCount-=value.recordVersionImports.length;value.recordHistoryImportReady=ready;value.fingerprint+=':'+plan.fingerprint+':import='+ready;
   }
  }
  if(value.assessmentHistoryCount){value.historySchemaReady=typeof getReady==='function'&&await getReady()===true;value.assessmentHistoryBlockedCount=value.historySchemaReady?0:value.assessmentHistoryCount;}return value;
 }

 function usable(value){return!value.documentBlocked&&!value.deletedScopeBlockedCount&&!value.deletedSchoolBlockedCount&&!value.recordVersionBlockedCount&&!value.plan.blockedCount&&!value.plan.conflictCount&&!value.relationshipCount&&!value.unsupportedRecordCount&&!value.unsupportedAcademicAssociationCount&&!value.taskGraphBlockedCount&&!value.assessmentHistoryBlockedCount;}
 function summary(value){return{...(allowHierarchyRestore?{hierarchyLinkCount:value.hierarchyLinks,hierarchyReady:value.hierarchyReady}:{}),...(value.snapshot.documents?{documentCount:value.snapshot.documents.length,documentsToRestore:value.documentPlan?.missing.length??0,documentBlockedCount:value.documentBlocked,documentsRetained:value.documentPlan?.retained??0}:{}),...(allowArchivedDeletedRestore?{deletedRecordRestoreCount:value.deletedRecordRestoreCount,deletedScopeBlockedCount:value.deletedScopeBlockedCount,deletedSchoolBlockedCount:value.deletedSchoolBlockedCount,retentionDays:PRIVATE_RECOVERY_DAYS}:{}),...(value.snapshot.recordVersions?.length?{recordVersionCount:value.snapshot.recordVersions.length,recordVersionImportCount:value.recordVersionImports?.length??0,recordVersionImportCountIsUpperBound:true,recordVersionsUnverifiedCount:value.recordVersionsUnverifiedCount,recordVersionsMissingCount:value.recordVersionsMissingCount??0,recordVersionsConflictCount:value.recordVersionsConflictCount??0,recordVersionsRetainedCount:value.recordVersionsRetainedCount??0,recordVersionBlockedCount:value.recordVersionBlockedCount}:{}),...(value.assessmentHistoryCount?{assessmentHistoryCount:value.assessmentHistoryCount,assessmentHistoryBlockedCount:value.assessmentHistoryBlockedCount}:{}),...(allowTaskGraphRestore?{taskGraphMembershipCount:value.taskGraphMembershipCount,taskGraphBlockedCount:value.taskGraphBlockedCount}:{}),snapshotId:value.snapshot.snapshotId,recordCount:value.plan.recordCount,insertCount:value.inserts.length,unchangedCount:value.plan.unchangedCount,archivedDeletedCount:value.plan.archivedDeletedCount,conflictCount:value.plan.conflictCount,blockedCount:value.plan.blockedCount,unsupportedRelationshipCount:value.relationshipCount,unsupportedRecordCount:value.unsupportedRecordCount,unsupportedAcademicAssociationCount:value.unsupportedAcademicAssociationCount,currentOnlyCount:value.plan.currentOnlyCount,canRestore:usable(value),executed:false};}
 function current(entry,n,s){if(disposed||entry.revoked||entry.expiresAt<=now()||!same(n,s))throw Error('Recovery session or review ended.');}
 return{
  async prepare(actor,{bytes}){
   if(!Buffer.isBuffer(bytes)||bytes.length>(allowDocumentRestore?MAX_WORKSPACE_FILE:8*1024*1024))throw Error('Bounded encrypted workspace archive required.');
   for(const[id,entry]of reviews)if(entry.expiresAt<=now())forget(id);
   if(reviews.size+pending.size+active.size>=20)throw Error('Too many pending recovery reviews.');
   const heldBytes=[...reviews.values(),...active,...pending].reduce((n,r)=>n+(r.bytes?.length??r.byteLength??0),0);
   if(heldBytes+bytes.length>160*1024*1024)throw Error('Pending archives exceed the bounded recovery capacity.');
   const owned=Buffer.from(bytes),marker={revoked:false,byteLength:bytes.length};let retained=false;pending.add(marker);
   try{
    const s=await session(actor);marker.binding=s.binding;
    const firstReady=allowTaskGraphRestore?await repository.canRestoreTaskGraphs(actor,s.ownerId):false;
    const firstDeletedReady=allowArchivedDeletedRestore&&await repository.canRestoreArchivedDeleted(actor,s.ownerId)===true;
    const first=await protectedHistory(await inspect(owned,s,await repository.readPrivateRows(actor,s.ownerId),firstReady,firstDeletedReady,rows=>repository.readDocuments(actor,s.ownerId,rows),()=>repository.canRestoreHierarchy(actor,s.ownerId)),repository.canRestoreAssessmentHistory?()=>repository.canRestoreAssessmentHistory(actor,s.ownerId):null,repository.readRecordVersionsSnapshot?()=>repository.readRecordVersionsSnapshot(actor,s.ownerId):null,repository.canImportRecordVersions?()=>repository.canImportRecordVersions(actor,s.ownerId):null,repository.canRestoreSchoolTombstones?()=>repository.canRestoreSchoolTombstones(actor,s.ownerId):null,repository.canImportSavedSearchVersions?()=>repository.canImportSavedSearchVersions(actor,s.ownerId):null);
    const nextReady=allowTaskGraphRestore?await repository.canRestoreTaskGraphs(actor,s.ownerId):false;
    const nextDeletedReady=allowArchivedDeletedRestore&&await repository.canRestoreArchivedDeleted(actor,s.ownerId)===true;
    const value=await protectedHistory(await inspect(owned,s,await repository.readPrivateRows(actor,s.ownerId),nextReady,nextDeletedReady,rows=>repository.readDocuments(actor,s.ownerId,rows),()=>repository.canRestoreHierarchy(actor,s.ownerId)),repository.canRestoreAssessmentHistory?()=>repository.canRestoreAssessmentHistory(actor,s.ownerId):null,repository.readRecordVersionsSnapshot?()=>repository.readRecordVersionsSnapshot(actor,s.ownerId):null,repository.canImportRecordVersions?()=>repository.canImportRecordVersions(actor,s.ownerId):null,repository.canRestoreSchoolTombstones?()=>repository.canRestoreSchoolTombstones(actor,s.ownerId):null,repository.canImportSavedSearchVersions?()=>repository.canImportSavedSearchVersions(actor,s.ownerId):null);
    const again=await session(actor);if(marker.revoked||!same(s,again)||first.fingerprint!==value.fingerprint||firstReady!==nextReady||first.historySchemaReady!==value.historySchemaReady)throw Error('Workspace or recovery session changed during review.');
    if(!usable(value))return summary(value);
    if(reviews.size>=20)throw Error('Too many pending recovery reviews.');
    const expiresAt=Math.min(now()+300000,s.expiresAt,again.expiresAt,...(allowArchivedDeletedRestore?value.inserts.filter(r=>r.deleted_at!==null).map(r=>privateRecoveryDeadline(r.deleted_at)):[])),reviewId=randomBytes(32).toString('base64url');
    if(expiresAt<=now())throw Error('Recovery review expired.');
    const entry={bytes:owned,binding:s.binding,ownerId:s.ownerId,expiresAt,fingerprint:value.fingerprint,revoked:false};
    entry.timer=setTimeout(()=>forget(reviewId),Math.max(1,expiresAt-now()));entry.timer.unref?.();reviews.set(reviewId,entry);retained=true;
    return{...summary(value),reviewId,expiresAt};
   }finally{pending.delete(marker);if(!retained)owned.fill(0);}
  },
  async execute(actor,{reviewId,approved}){
   if(approved!==true)throw Error('Explicit archive restore approval required.');
   const entry=reviews.get(reviewId);if(!entry||entry.expiresAt<=now()){forget(reviewId);throw Error('Recovery review expired or used.');}
   const s=await session(actor);if(s.ownerId!==entry.ownerId||s.binding!==entry.binding)throw Error('Recovery belongs to another session.');
   if(reviews.get(reviewId)!==entry)throw Error('Recovery review already claimed.');
   reviews.delete(reviewId);clearTimeout(entry.timer);active.add(entry);let attempted=false;
   try{
    // The transaction adapter is trusted server infrastructure, never supplied by a browser.
    const result=await repository.withLockedWorkspace(actor,s.ownerId,async tx=>{
     if(!tx||typeof tx.readPrivateRows!=='function'||typeof tx.insertMany!=='function')throw Error('Atomic recovery repository required.');
     current(entry,s,await session(actor));
     const graphReady=allowTaskGraphRestore&&typeof tx.canRestoreTaskGraphs==='function'?await tx.canRestoreTaskGraphs():false;
     const deletedReady=allowArchivedDeletedRestore&&typeof tx.canRestoreArchivedDeleted==='function'&&await tx.canRestoreArchivedDeleted()===true;
     const value=await protectedHistory(await inspect(entry.bytes,s,await tx.readPrivateRows(),graphReady,deletedReady,tx.readDocuments,tx.canRestoreHierarchy),typeof tx.canRestoreAssessmentHistory==='function'?()=>tx.canRestoreAssessmentHistory():null,typeof tx.readRecordVersionsSnapshot==='function'?()=>tx.readRecordVersionsSnapshot():null,typeof tx.canImportRecordVersions==='function'?()=>tx.canImportRecordVersions():null,typeof tx.canRestoreSchoolTombstones==='function'?()=>tx.canRestoreSchoolTombstones():null,typeof tx.canImportSavedSearchVersions==='function'?()=>tx.canImportSavedSearchVersions():null);
     if(value.fingerprint!==entry.fingerprint||!usable(value))throw Error('Workspace changed or recovery is blocked. Prepare a new review.');
     if(!await authorizeWrite(actor,{snapshotId:value.snapshot.snapshotId,recordCount:value.plan.recordCount,insertCount:value.inserts.length,projectRef,...(allowHierarchyRestore?{hierarchyLinkCount:value.hierarchyLinks}:{}),...(value.snapshot.documents?{documentInsertCount:value.documentPlan?.missing.length??0}:{}),...(allowArchivedDeletedRestore?{deletedRecordRestoreCount:value.deletedRecordRestoreCount}:{}),...(value.snapshot.recordVersions?.length?{recordVersionsRetainedCount:value.recordVersionsRetainedCount,recordVersionImportCount:value.recordVersionImports?.length??0}:{}),...(allowTaskGraphRestore?{taskGraphMembershipCount:value.taskGraphMembershipCount}:{})}))throw Error('Recovery database writes are not authorized.');
     current(entry,s,await session(actor));
     if(value.documentPlan?.missing.length){
      if(typeof tx.insertDocuments!=='function')throw Error('Atomic document recovery unavailable.');
      attempted=true;await tx.insertDocuments(value.documentPlan.missing);
     }
     if(value.inserts.length){attempted=true;const ordered=orderPrivateSchoolRestoreRows(value.inserts).sort((a,b)=>Number(Boolean(a.item_type==='project'&&a.payload.noteIds))-Number(Boolean(b.item_type==='project'&&b.payload.noteIds)));
      const response=await tx.insertMany(structuredClone(ordered));
      if(!Array.isArray(response)||response.length!==ordered.length)throw Error('Recovery acknowledgement differs.');
      const saved=validatePrivateWorkspaceRows([...value.rows,...response],s.ownerId,secret).slice(value.rows.length);
      if(digest(saved.slice().sort((a,b)=>a.id.localeCompare(b.id)))!==digest(value.inserts.slice().sort((a,b)=>a.id.localeCompare(b.id))))throw Error('Recovery acknowledgement differs.');
     }
     const after=validatePrivateWorkspaceRows(await tx.readPrivateRows(),s.ownerId,secret);
     // Source-dependent RLS may reveal retained history only after approved insertion.
     const expected=[...value.rows,...value.inserts].sort((a,b)=>a.id.localeCompare(b.id));
     if(digest(after.slice().sort((a,b)=>a.id.localeCompare(b.id)))!==digest(expected))throw Error('Recovered workspace did not match the reviewed insertion.');
     let importedVersions=[],retainedOrphanVersions=[],imports=value.recordVersionImports??[];
     if(value.recordVersionFingerprint){
      const history=await tx.readRecordVersionsSnapshot();if(history?.ready!==true)throw Error('Retained history protections changed.');
      const originalIds=new Set(value.recordVersionCurrentEntries.map(v=>v.id));
      const candidates=new Map(imports.map(v=>[v.id,v]));
      for(const row of history.versions){if(originalIds.has(row.id))continue;const archived=candidates.get(row.id);if(!archived||retainedRecordVersionPlan({archived:[archived],current:[row],records:after,ownerId:s.ownerId,key:secret}).blocked)throw Error('Unexpected retained history after source recovery.');retainedOrphanVersions.push(row);}
      const stable=retainedRecordVersionPlan({archived:[],current:[...value.recordVersionCurrentEntries,...retainedOrphanVersions],records:after,ownerId:s.ownerId,key:secret});
      const actual=retainedRecordVersionPlan({archived:[],current:history.versions,records:after,ownerId:s.ownerId,key:secret});
      if(stable.fingerprint!==actual.fingerprint)throw Error('Earlier history changed during source recovery.');
      const retainedIds=new Set(retainedOrphanVersions.map(v=>v.id));imports=imports.filter(v=>!retainedIds.has(v.id));
     }
     if(imports.length){if(typeof tx.importRecordVersions!=='function')throw Error('Atomic history import unavailable.');attempted=true;importedVersions=validatePrivateRecordVersions(await tx.importRecordVersions(value.snapshot.snapshotId,structuredClone(imports)),after,s.ownerId,secret);if(importedVersions.length!==imports.length)throw Error('Imported history acknowledgement differs.');for(const expected of imports){const saved=importedVersions.find(r=>r.id===expected.id);if(!saved||saved.recovery?.snapshotId!==value.snapshot.snapshotId||stableStringify(saved.recovery.previous)!==stableStringify(expected.recovery??null)||retainedRecordVersionPlan({archived:[expected],current:[saved],records:after,ownerId:s.ownerId,key:secret}).blocked)throw Error('Imported history differs from approved archive.');}}
     const finalRows=validatePrivateWorkspaceRows(await tx.readPrivateRows(),s.ownerId,secret);
     if(digest(finalRows.slice().sort((a,b)=>a.id.localeCompare(b.id)))!==digest(expected))throw Error('Recovered workspace changed during history recovery.');
     if(value.recordVersionFingerprint){const history=await tx.readRecordVersionsSnapshot();if(history?.ready!==true)throw Error('Retained history protections changed.');const plan=retainedRecordVersionPlan({archived:value.snapshot.recordVersions,current:history.versions,records:after,ownerId:s.ownerId,key:secret});const expected=retainedRecordVersionPlan({archived:[],current:[...value.recordVersionCurrentEntries,...retainedOrphanVersions,...importedVersions],records:after,ownerId:s.ownerId,key:secret});if(plan.blocked||plan.fingerprint!==expected.fingerprint)throw Error('Retained history changed during recovery.');}
     if(value.deletedRecordRestoreCount&&(!await tx.canRestoreArchivedDeleted()||value.deletedSchoolRestoreCount&&!await tx.canRestoreSchoolTombstones()))throw Error('Archived deletion recovery protections changed.');
     if(allowArchivedDeletedRestore&&value.inserts.some(r=>r.deleted_at!==null&&!(r.item_type==='project_project_link'&&value.hierarchyReady?withinArchivedDeletedRetention(r,{now:now()}):supportsArchivedDeletedWorkspaceRestore(r,{now:now()}))))throw Error('Archived deletion retention expired during recovery.');
     current(entry,s,await session(actor));
     if(value.documentPlan){
      const verified=compareArchivedDocuments(value.snapshot.documents,await tx.readDocuments(value.snapshot.documents),s.ownerId,secret);
      if(verified.conflicting||verified.missing.length||verified.retained!==value.snapshot.documents.length)throw Error('Recovered files differ from the reviewed archive.');
      current(entry,s,await session(actor));
     }
     return{executed:true,...(value.snapshot.documents?{documentsRestored:value.documentPlan?.missing.length??0,documentsRetained:value.documentPlan?.retained??0}:{}),snapshotId:value.snapshot.snapshotId,restored:value.inserts.length,...(allowArchivedDeletedRestore?{restoredDeleted:value.deletedRecordRestoreCount}:{}),...(value.snapshot.recordVersions?.length?{recoveredHistory:importedVersions.length,retainedHistory:value.recordVersionsRetainedCount+retainedOrphanVersions.length,retainedOrphanHistory:retainedOrphanVersions.length}:{}),alreadyPresent:value.plan.unchangedCount,skippedArchivedDeleted:value.plan.archivedDeletedCount,currentOnlyCount:value.plan.currentOnlyCount,verifiedAt:new Date(now()).toISOString()};
    });
    current(entry,s,await session(actor));return result;
   }catch{throw Error(attempted?'Recovery could not be confirmed. Inspect current copies before a new review; nothing was retried.':'Recovery stopped before insertion. Prepare a new review.');}
   finally{active.delete(entry);entry.bytes.fill(0);}
  },
  forgetSession(binding){revokedBindings.add(binding);for(const entry of [...pending,...active])if(entry.binding===binding)entry.revoked=true;for(const[id,entry]of reviews)if(entry.binding===binding)forget(id);},
  dispose(){disposed=true;for(const entry of [...pending,...active])entry.revoked=true;for(const id of reviews.keys())forget(id);secret.fill(0);}
 };
}
