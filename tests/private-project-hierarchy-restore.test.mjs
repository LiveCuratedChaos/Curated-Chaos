import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createIsolatedDevelopmentDatabase,actor,administrator,identities} from './fixtures/isolated-development-database.mjs';
import {recoveryGraph,meta,id,owner} from './fixtures/common-task-memberships.mjs';
import {createPrivateWorkspaceRestoreRepository} from '../server/private-workspace-restore-repository.mjs';
import {createPrivateWorkspaceRestoreExecutor} from '../server/private-workspace-restore-executor.mjs';
import {sealPrivateWorkspace} from '../server/private-workspace-backup.mjs';
import {privateWorkspaceRestoreDigest as digest} from '../server/private-workspace-restore-contract.mjs';

const projectRef='fictionalhierarchy',key=Buffer.alloc(32,11);
const sql=name=>readFile(new URL('../supabase/drafts/'+name+'.sql',import.meta.url),'utf8');
const archive=rows=>sealPrivateWorkspace({projectRef,ownerId:owner,rows,key}).bytes;
function hierarchy(){
 const graph=recoveryGraph();
 const master={...graph.f.project,id:id(801),version:12},child=graph.f.project,leaf={...master,id:id(802),version:9};
 const edge=(number,parent,sub)=>({...meta({section:'Personal Life',item_type:'project_project_link',origin:'PRIVATE_COOKIE_PROJECT_PROJECT_LINK',
  payload:{fictional:true,schemaVersion:1,parentProjectId:parent.id,childProjectId:sub.id}},number),version:3});
 const edges=[edge(810,master,child),edge(811,child,leaf)];
 return {graph,master,child,leaf,edges,rows:[...edges,master,leaf,child]};
}
async function setup(t,{mixed=false,deleted=false}={}){
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());
 const scripts=['private_project_hierarchy','private_project_single_master','private_project_hierarchy_restore'];
 if(mixed)scripts.push('private_school_records','private_school_academic_recovery','private_school_records_ready','private_school_academic_recovery_ready','private_common_task_memberships_forward');
 for(const name of scripts)await db.exec(await sql(name));
 const who={owner,session:identities.sa};
 const repository=createPrivateWorkspaceRestoreRepository({projectRef,allowTaskGraphRestore:mixed,allowHierarchyRestore:true,allowArchivedDeletedRestore:deleted,
  verifyTarget:async(connection,ref)=>connection===db&&ref===projectRef,
  withConnection:async(a,callback)=>{await actor(db,a.owner,a.session);return callback(db);}});
 let approved;
 const executor=createPrivateWorkspaceRestoreExecutor({repository,projectRef,key,allowHierarchyRestore:true,allowArchivedDeletedRestore:deleted,allowTaskGraphRestore:mixed,
  resolveActor:async a=>({ownerId:a.owner,sessionBinding:a.session,expiresAt:Date.now()+600000}),
  authorizeWrite:async(_actor,summary)=>{approved=summary;return true;}});
 t.after(()=>executor.dispose());
 return{db,executor,who,repository,approved:()=>approved,rows:()=>repository.readPrivateRows(who,owner)};
}
test('a reviewed fresh project hierarchy and its academic and manual task memberships restore atomically and reopen',async t=>{
 const s=await setup(t,{mixed:true}),h=hierarchy(),before=await s.rows();
 const records=[...h.graph.records,...h.edges,h.master,h.leaf];
 const bytes=archive(records),review=await s.executor.prepare(s.who,{bytes});
 assert.equal(review.canRestore,true,JSON.stringify(review));
 assert.equal(review.hierarchyLinkCount,2);assert.equal(review.taskGraphMembershipCount,3);
 assert.equal(digest(await s.rows()),digest(before));
 const result=await s.executor.execute(s.who,{reviewId:review.reviewId,approved:true});
 assert.equal(result.restored,records.length);assert.equal(s.approved().hierarchyLinkCount,2);
 assert.equal(digest(await s.rows()),digest([...before,...records]));
 const replay=await s.executor.prepare(s.who,{bytes});assert.equal(replay.insertCount,0);
 const snapshot=(await s.db.query('select public.cc_project_hierarchy_snapshot() as result')).rows[0].result;
 assert.equal(snapshot.relationships.filter(r=>h.edges.some(e=>e.id===r.id)).length,2);
 const first=h.edges[0];
 const unlink=(await s.db.query('select public.cc_set_project_hierarchy_link($1,$2,$3,$4,$5,false) as result',
  [h.master.id,h.master.version,h.child.id,h.child.version,first.version])).rows[0].result;
 assert.equal(unlink.linkRecord.id,first.id);assert.ok(unlink.linkRecord.deleted_at);
 await actor(s.db,identities.b,identities.sb);
 assert.deepEqual((await s.db.query('select id from public.cc_records where id=any($1::uuid[])',[records.map(r=>r.id)])).rows,[]);
});
test('existing hierarchy endpoints and protections changed after review stop recovery without side effects',async t=>{
 const s=await setup(t),h=hierarchy(),bytes=archive(h.rows);
 const review=await s.executor.prepare(s.who,{bytes});assert.equal(review.canRestore,true);
 const before=await s.rows();await administrator(s.db);
 await s.db.exec('alter table public.cc_records disable trigger cc_validate_single_project_parent');
 await assert.rejects(s.executor.execute(s.who,{reviewId:review.reviewId,approved:true}));
 assert.equal(digest(await s.rows()),digest(before));
 assert.equal((await s.executor.prepare(s.who,{bytes})).canRestore,false);
 await administrator(s.db);await s.db.exec('alter table public.cc_records enable trigger cc_validate_single_project_parent');
 const one=await s.executor.prepare(s.who,{bytes:archive([h.master])});
 await s.executor.execute(s.who,{reviewId:one.reviewId,approved:true});
 const blocked=await s.executor.prepare(s.who,{bytes});assert.equal(blocked.canRestore,false);assert.equal(blocked.reviewId,undefined);
 assert.equal(digest(await s.rows()),digest([...before,h.master]));
 await assert.rejects(s.db.query('insert into cc_private.restore_new_project_hierarchy(records) values($1::jsonb)',[JSON.stringify(h.rows.filter(r=>r.id!==h.master.id))]));
 assert.equal(digest(await s.rows()),digest([...before,h.master]));
});
test('storage rejects a second master and a cycle, rolling back fresh project inserts and retaining the originals',async t=>{
 const s=await setup(t),h=hierarchy(),before=await s.rows();
 for(const childProjectId of [h.child.id,h.master.id]){
  const extra={...h.edges[1],id:id(812),payload:{...h.edges[1].payload,parentProjectId:h.leaf.id,childProjectId}};
  await assert.rejects(s.db.query('insert into cc_private.restore_new_project_hierarchy(records) values($1::jsonb)',[JSON.stringify([...h.rows,extra])]));
  assert.equal(digest(await s.rows()),digest(before));
 }
 await administrator(s.db);await s.db.exec(await sql('private_project_hierarchy_restore_rollback'));
 const result=await s.executor.prepare(s.who,{bytes:archive(h.rows)});
 assert.equal(result.canRestore,false);assert.equal(digest(await s.rows()),digest(before));
});

test('retired parent links keep their dates and identities without reclaiming the child or changing surviving projects',async t=>{
 const s=await setup(t,{deleted:true}),h=hierarchy(),former={...h.master,id:id(803)},before=await s.rows();
 const deletion=new Date(Date.now()-86400000).toISOString();
 const retired={...h.edges[0],id:id(813),version:7,deleted_at:deletion,updated_at:deletion,payload:{...h.edges[0].payload,parentProjectId:former.id}};
 const prior=await s.executor.prepare(s.who,{bytes:archive([former])});
 await s.executor.execute(s.who,{reviewId:prior.reviewId,approved:true});
 const records=[former,retired,...h.rows],bytes=archive(records),review=await s.executor.prepare(s.who,{bytes});
 assert.equal(review.canRestore,true,JSON.stringify(review));assert.equal(review.deletedRecordRestoreCount,1);assert.equal(review.hierarchyLinkCount,3);
 await s.executor.execute(s.who,{reviewId:review.reviewId,approved:true});
 assert.equal(digest(await s.rows()),digest([...before,...records]));
 assert.equal((await s.executor.prepare(s.who,{bytes})).insertCount,0);
 const snap=(await s.db.query('select public.cc_project_hierarchy_snapshot() as result')).rows[0].result;
 assert.equal(snap.relationships.filter(r=>r.payload.childProjectId===h.child.id&&r.deleted_at===null).length,1);
 assert.ok(snap.relationships.find(r=>r.id===retired.id).deleted_at);
});
