import {assessmentHistoryRestoreCount} from './private-school-restore.mjs';
// Trusted authenticated SQL connection adapter, never a PostgREST write sequence.
// withConnection(actor, callback) supplies one exclusive connection with the actor's
// existing authenticated JWT claims; it must not use an administrator/service role.
export function createPrivateWorkspaceRestoreRepository({projectRef,withConnection,verifyTarget=async()=>false,allowTaskGraphRestore=false,allowHierarchyRestore=false,allowRecordHistoryVerification=false,allowRecordHistoryImport=false,allowArchivedDeletedRestore=false,allowDocumentRestore=false}){
 if(typeof allowHierarchyRestore!=='boolean')throw Error('Explicit private project hierarchy recovery scope required.');
 if(typeof allowArchivedDeletedRestore!=='boolean')throw Error('Explicit archived-deletion recovery scope required.');
 if(typeof allowRecordHistoryImport!=='boolean'||allowRecordHistoryImport&&!allowRecordHistoryVerification)throw Error('History import requires explicit retained-history verification.');
 if(typeof allowRecordHistoryVerification!=='boolean')throw Error('Explicit retained history verification scope required.');
 if(typeof allowTaskGraphRestore!=='boolean')throw Error('Explicit task graph recovery scope required.');
 if(typeof projectRef!=='string'||!/^[a-z0-9]{10,32}$/.test(projectRef)||typeof withConnection!=='function'||typeof verifyTarget!=='function')throw Error('Explicit recovery target and authenticated connection factory required.');
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
 async function verify(db,owner){
  if(!uuid(owner)||typeof db?.query!=='function')throw Error('Verified recovery connection required.');
  if(await verifyTarget(db,projectRef)!==true)throw Error('Recovery database target could not be verified.');
  const result=await db.query("select current_user='authenticated' and auth.uid()=$1::uuid and cc_private.development_session_active() as authorized",[owner]);
  if(result?.rows?.length!==1||result.rows[0].authorized!==true)throw Error('Authenticated archive owner required.');
 }
 async function readDocuments(db,owner,archived,lock=false){
  if(!allowDocumentRestore)throw Error('Document recovery is disabled.');
  await verify(db,owner);
  if(!Array.isArray(archived)||archived.length>100)throw Error('Bounded document selection required.');
  if(!archived.length)return [];
  const params=[owner,archived.map(r=>r.id),archived.map(r=>r.content_key)];
  const where=' where owner_id=$1 and (id=any($2::uuid[]) or content_key=any($3::text[]))';
  const stats=await db.query('select count(*)::int as items,coalesce(sum(length(file_envelope)),0)::int as size from public.cc_private_documents'+where,params);
  if(stats.rows[0].items>100||stats.rows[0].size>23*1024*1024)throw Error('Destination documents exceed the recovery limit.');
  const result=await db.query('select * from public.cc_private_documents'+where+' order by id'+(lock?' for share':''),params);
  await verify(db,owner);return result.rows;
 }
 async function read(db,owner){await verify(db,owner);const result=await db.query("select to_jsonb(r) as record from public.cc_records r where owner_id=$1::uuid and visibility='private' and household_id is null order by id limit 2001",[owner]);if(!Array.isArray(result?.rows)||result.rows.length>2000)throw Error('Complete bounded workspace required.');return result.rows.map(r=>r.record);}
 async function graphReady(db,owner){if(!allowTaskGraphRestore)return false;await verify(db,owner);try{const installed=await db.query("select pg_catalog.to_regprocedure('public.cc_private_common_task_links_ready()') is not null as installed");if(installed?.rows?.[0]?.installed!==true)return false;const value=await db.query('select public.cc_private_common_task_links_ready() as ready');return value?.rows?.length===1&&value.rows[0].ready===true;}catch{return false;}}
 async function hierarchyReady(db,owner){
  if(!allowHierarchyRestore)return false;
  await verify(db,owner);
  const installed=await db.query(`select to_regprocedure('public.cc_project_hierarchy_single_master_ready()') is not null
   and exists(select from pg_class v join pg_trigger t on t.tgrelid=v.oid
    where v.oid=to_regclass('cc_private.restore_new_project_hierarchy') and v.relkind='v'
    and v.reloptions @> array['security_invoker=true','security_barrier=true']
    and t.tgname='cc_restore_new_project_hierarchy' and t.tgenabled='O' and t.tgtype=69
    and t.tgfoid=to_regprocedure('cc_private.restore_new_project_hierarchy()')) as installed`);
  if(installed.rows?.[0]?.installed!==true)return false;
  const result=await db.query('select public.cc_project_hierarchy_single_master_ready() as ready');
  return result.rows?.[0]?.ready===true;
 }
 async function insertReviewedRows(db,owner,records){
  const links=records.filter(r=>['common_task_link','project_task_link'].includes(r.item_type));
  const edges=records.filter(r=>r.item_type==='project_project_link');
  if(links.length&&!await graphReady(db,owner))throw Error('Task graph recovery storage is unavailable.');
  if(edges.length&&!await hierarchyReady(db,owner))throw Error('Project hierarchy recovery storage is unavailable.');
  const taskIds=new Set(links.map(r=>r.item_type==='project_task_link'?r.payload.taskId:r.payload.task.recordId));
  const projectIds=new Set(edges.filter(r=>r.deleted_at===null).flatMap(r=>[r.payload.parentProjectId,r.payload.childProjectId]));
  const hierarchy=[],tasks=[],ordinary=[],retired=[];
  for(const row of records){
   if(row.item_type==='project_project_link'&&row.deleted_at!==null)retired.push(row);
   else if(row.item_type==='project_project_link'||projectIds.has(row.id))hierarchy.push(row);
   else if(['common_task_link','project_task_link'].includes(row.item_type)||taskIds.has(row.id))tasks.push(row);
   else ordinary.push(row);
  }
  const saved=[];
  if(ordinary.length){
   const result=await db.query('insert into public.cc_records select * from jsonb_populate_recordset(null::public.cc_records,$1::jsonb) returning to_jsonb(cc_records) as record',[JSON.stringify(ordinary)]);
   if(result.rows?.length!==ordinary.length)throw Error('Recovery insertion unverified.');
   saved.push(...result.rows.map(r=>r.record));
  }
  if(hierarchy.length){
   const result=await db.query('insert into cc_private.restore_new_project_hierarchy(records) values($1::jsonb) returning records',[JSON.stringify(hierarchy)]);
   if(result.rows?.[0]?.records?.length!==hierarchy.length)throw Error('Incomplete hierarchy receipt.');
   saved.push(...result.rows[0].records);
  }
  if(tasks.length){
   const result=await db.query('insert into cc_private.restore_new_task_graph(payload) values($1::jsonb) returning payload',[JSON.stringify({records:tasks})]);
   if(result.rows?.[0]?.payload?.records?.length!==tasks.length)throw Error('Task graph recovery acknowledgement unavailable.');
   saved.push(...result.rows[0].payload.records);
  }
  if(retired.length){
   // The ordinary relationship trigger leaves both project revisions intact for retired edges.
   const result=await db.query('insert into public.cc_records select * from jsonb_populate_recordset(null::public.cc_records,$1::jsonb) returning to_jsonb(cc_records) as record',[JSON.stringify(retired)]);
   if(result.rows?.length!==retired.length)throw Error('Incomplete retired relationship receipt.');
   saved.push(...result.rows.map(r=>r.record));
  }
  return saved;
 }
 async function historyReady(db,owner){await verify(db,owner);try{const installed=await db.query("select pg_catalog.to_regprocedure('public.cc_private_school_assessment_history_ready()') is not null as installed");if(installed?.rows?.[0]?.installed!==true)return false;const result=await db.query('select public.cc_private_school_assessment_history_ready() as ready');return result?.rows?.length===1&&result.rows[0].ready===true;}catch{return false;}}
 async function recordVersions(db,owner,locked=false){
  if(!allowRecordHistoryVerification)return{ready:false,versions:[]};await verify(db,owner);
  const installed=await db.query("select to_regclass('cc_private.record_versions') is not null and to_regprocedure('public.cc_private_record_versions_ready()') is not null and to_regprocedure('public.lock_private_record_versions_for_recovery()') is not null as installed");if(installed?.rows?.[0]?.installed!==true)return{ready:false,versions:[]};
  if(locked){const held=await db.query('select public.lock_private_record_versions_for_recovery() as held');if(held?.rows?.[0]?.held!==true)throw Error('Protected recovery history lock required.');}
  const status=await db.query('select public.cc_private_record_versions_ready() as ready');if(status?.rows?.[0]?.ready!==true)return{ready:false,versions:[]};
  const result=await db.query("with stats as materialized(select count(*) n,coalesce(sum(octet_length(to_jsonb(v)::text)),0) bytes from cc_private.record_versions v where owner_id=$1::uuid) select case when n<=20000 and bytes<=5242880 then coalesce((select jsonb_agg(to_jsonb(v) order by id) from cc_private.record_versions v where owner_id=$1::uuid),'[]'::jsonb) else null end as versions from stats",[owner]);
  if(!Array.isArray(result?.rows?.[0]?.versions))throw Error('Complete bounded retained history required.');await verify(db,owner);return{ready:true,versions:result.rows[0].versions};
 }
 async function importReady(db,owner,locked=false){if(!allowRecordHistoryImport)return false;await verify(db,owner);const installed=await db.query("select to_regprocedure('public.import_private_record_versions(uuid,jsonb)') is not null as installed");if(installed?.rows?.[0]?.installed!==true)return false;if(locked){const held=await db.query('select public.lock_private_record_versions_for_recovery() as held');if(held?.rows?.[0]?.held!==true)return false;}const result=await db.query('select public.cc_private_record_versions_ready() as ready');return result?.rows?.[0]?.ready===true;}
 async function schoolTombstonesReady(db,owner){if(!allowArchivedDeletedRestore)return false;await verify(db,owner);const installed=await db.query("select to_regprocedure('public.cc_private_school_tombstone_restore_ready()') is not null as installed");if(installed?.rows?.[0]?.installed!==true)return false;const result=await db.query('select public.cc_private_school_tombstone_restore_ready() ready');return result?.rows?.[0]?.ready===true;}
 return{
  projectRef,
  ...(allowDocumentRestore?{readDocuments:(actor,owner,archived)=>withConnection(actor,db=>readDocuments(db,owner,archived))}:{}),
  canRestoreSchoolTombstones:(actor,owner)=>withConnection(actor,db=>schoolTombstonesReady(db,owner)),
  canRestoreArchivedDeleted:(actor,owner)=>allowArchivedDeletedRestore?withConnection(actor,async db=>{await verify(db,owner);return true;}):Promise.resolve(false),
  canImportRecordVersions:(actor,owner)=>withConnection(actor,db=>importReady(db,owner)),
  readRecordVersionsSnapshot:(actor,owner)=>withConnection(actor,db=>recordVersions(db,owner)),
  canRestoreAssessmentHistory:(actor,owner)=>withConnection(actor,db=>historyReady(db,owner)),
  canRestoreHierarchy:(actor,owner)=>allowHierarchyRestore?withConnection(actor,db=>hierarchyReady(db,owner)):Promise.resolve(false),
  canRestoreTaskGraphs:(actor,owner)=>allowTaskGraphRestore?withConnection(actor,db=>graphReady(db,owner)):Promise.resolve(false),
  readPrivateRows:(actor,owner)=>withConnection(actor,db=>read(db,owner)),
  withLockedWorkspace:(actor,owner,callback)=>withConnection(actor,async db=>{
   let started=false;
   try{
    await db.query('begin isolation level read committed');started=true;
    await db.query("set local lock_timeout='3s'");await db.query("set local statement_timeout='20s'");await db.query("set local idle_in_transaction_session_timeout='20s'");
    await verify(db,owner);
    // Ordinary INSERT/UPDATE/DELETE acquire ROW EXCLUSIVE, conflicting with this
    // lock. An advisory owner lock alone would not serialize those writers.
    // Match School writers before taking the table lock to avoid lock-order inversion.
    await db.query("select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cc-private-school:'||$1::uuid::text,0))",[owner]);
    await db.query('lock table public.cc_records in share row exclusive mode nowait');
    let live=true;
    const tx={
     ...(allowDocumentRestore?{
      readDocuments:archived=>{if(!live)throw Error('Recovery transaction ended.');return readDocuments(db,owner,archived,true);},
      async insertDocuments(rows){
       if(!live||!Array.isArray(rows)||rows.length>100)throw Error('Bounded document recovery required.');
       await verify(db,owner);
       for(const r of rows){
        if(r.owner_id!==owner)throw Error('Document owner changed.');
        await db.query('select cc_private.restore_missing_document($1,$2,$3,$4,$5,$6)',[owner,r.id,r.content_key,r.metadata,r.file_envelope,r.version]);
       }
       await verify(db,owner);
      }
     }:{}),
     canRestoreSchoolTombstones:()=>{if(!live)throw Error('Recovery transaction ended.');return schoolTombstonesReady(db,owner);},
     canRestoreArchivedDeleted:async()=>{if(!live)throw Error('Recovery transaction ended.');if(!allowArchivedDeletedRestore)return false;await verify(db,owner);return true;},
     canImportRecordVersions:()=>{if(!live)throw Error('Recovery transaction ended.');return importReady(db,owner,true);},
     async importRecordVersions(snapshotId,versions){if(!live||!uuid(snapshotId)||!Array.isArray(versions)||versions.length>20000)throw Error('Bounded reviewed history import required.');await verify(db,owner);if(!await importReady(db,owner,true))throw Error('History import protections unavailable.');const result=await db.query('select to_jsonb(v) as version from public.import_private_record_versions($1,$2) v',[snapshotId,JSON.stringify(versions)]);if(!Array.isArray(result?.rows)||result.rows.length!==versions.length)throw Error('History import acknowledgement unavailable.');return result.rows.map(r=>r.version);},
     readRecordVersionsSnapshot:()=>{if(!live)throw Error('Recovery transaction ended.');return recordVersions(db,owner,true);},
     canRestoreAssessmentHistory:()=>{if(!live)throw Error('Recovery transaction ended.');return historyReady(db,owner);},
     canRestoreHierarchy:()=>{if(!live)throw Error('Recovery transaction ended.');return hierarchyReady(db,owner);},
     canRestoreTaskGraphs:()=>{if(!live)throw Error('Recovery transaction ended.');return graphReady(db,owner);},
     readPrivateRows:()=>{if(!live)throw Error('Recovery transaction ended.');return read(db,owner);},
     async insertMany(records){if(!live)throw Error('Recovery transaction ended.');if(records.some(r=>r.item_type==='project'&&r.payload.noteIds)){
      const check=await db.query("select count(*)::integer as installed from pg_trigger where tgrelid='public.cc_records'::regclass and tgname in ('cc_check_work_project_notes','cc_detach_unavailable_project_note') and tgenabled in ('O','A')");
      if(check.rows?.[0]?.installed!==2)throw Error('Work note link protections are unavailable.');
     }if(records.some(r=>r.deleted_at!==null)&&!allowArchivedDeletedRestore)throw Error('Archived deletion recovery scope is not enabled.');await verify(db,owner);if(records.some(r=>r.deleted_at!==null&&r.item_type==='school_fixture')&&!await schoolTombstonesReady(db,owner))throw Error('School tombstone recovery protections are unavailable.');if(assessmentHistoryRestoreCount(records)&&!await historyReady(db,owner))throw Error('Assessment history recovery protections are unavailable.');return insertReviewedRows(db,owner,records);}
    };
    let result;try{result=await callback(tx);}finally{live=false;}
    await verify(db,owner);await db.query('commit');started=false;return result;
   }catch{if(started){try{await db.query('rollback');}catch{}}throw Error('Atomic recovery transaction could not be confirmed.');}
  })
 };
}
