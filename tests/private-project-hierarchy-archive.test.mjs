import test from 'node:test';
import assert from 'node:assert/strict';
import {sealPrivateWorkspace,inspectPrivateWorkspace} from '../server/private-workspace-backup.mjs';
import {previewPrivateWorkspaceRestore} from '../server/private-workspace-restore-preview.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',foreignOwner='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',projectRef='fictionaldev123',key=Buffer.alloc(32,17),stamp='2026-11-16T12:00:00.000Z',deleted='2026-11-16T13:00:00.000Z';
const id=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
function row(n,type,origin,payload){return{id:id(n),owner_id:ownerId,household_id:null,visibility:'private',section:'Personal Life',item_type:type,origin,payload,version:1,deleted_at:null,created_at:stamp,updated_at:stamp};}
const project=n=>row(n,'project','PRIVATE_COOKIE_PROJECT',{fictional:true,schemaVersion:1,title:'Fictional project '+n,description:'Fictional details',status:'Planned',separateRecurring:true});
const relationship=(n,parent,child)=>row(n,'project_project_link','PRIVATE_COOKIE_PROJECT_PROJECT_LINK',{fictional:true,schemaVersion:1,parentProjectId:id(parent),childProjectId:id(child)});
const seal=rows=>sealPrivateWorkspace({ownerId,projectRef,key,rows,now:Date.parse(stamp)});
const inspect=bytes=>inspectPrivateWorkspace(bytes,{ownerId,projectRef,key});
function preview(records,existing){return previewPrivateWorkspaceRestore({bytes:seal(records).bytes,key,ownerId,projectRef,existing});}
function action(plan,n){return plan.actions.find(r=>r.id===id(n)).action;}
test('fake-key archive round-trip preserves one subproject in several larger projects without copies',()=>{
 const records=[project(1),project(2),project(3),relationship(10,1,3),relationship(11,2,3)],sealed=seal(records),restored=inspect(sealed.bytes);
 assert.deepEqual(restored.records,records);assert.equal(restored.records.filter(r=>r.item_type==='project').length,3);assert.equal(restored.records.filter(r=>r.payload.childProjectId===id(3)).length,2);assert.doesNotMatch(sealed.bytes.toString(),/Fictional project|Fictional details|parentProjectId|childProjectId/);
 const plan=preview(records,records);assert.equal(plan.unchangedCount,5);assert.equal(plan.blockedCount,0);assert.equal(plan.executed,false);assert.equal(plan.databaseWritten,false);assert.equal(plan.restoreAvailable,false);assert.doesNotMatch(JSON.stringify(plan),/Fictional project|Fictional details|parentProjectId|childProjectId|payload/);
});
test('archive preserves canonical retired relationship identity without reactivating it',()=>{
 const records=[project(1),project(2),{...relationship(10,1,2),version:4,deleted_at:deleted,updated_at:deleted}],restored=inspect(seal(records).bytes);
 assert.deepEqual(restored.records,records);const plan=preview(records,[project(1),project(2)]);assert.equal(action(plan,10),'archived-deleted');assert.equal(plan.missingCount,0);
});
test('archive rejects direct self-links and cycles across multiple project branches',()=>{
 for(const records of [[project(1),relationship(10,1,1)],[project(1),project(2),relationship(10,1,2),relationship(11,2,1)],[project(1),project(2),project(3),relationship(10,1,2),relationship(11,2,3),relationship(12,3,1)]])assert.throws(()=>seal(records));
});
test('archive rejects duplicate canonical pairs even with separate row IDs or a retired copy',()=>{
 for(const retired of [false,true]){const duplicate={...relationship(11,1,2),...(retired?{deleted_at:deleted,updated_at:deleted}:{})};assert.throws(()=>seal([project(1),project(2),relationship(10,1,2),duplicate]));}
});
test('archive rejects missing, wrong-type and foreign hierarchy targets',()=>{
 assert.throws(()=>seal([project(1),relationship(10,1,2)]));
 assert.throws(()=>seal([project(1),{...project(2),item_type:'note'},relationship(10,1,2)]));
 assert.throws(()=>seal([project(1),{...project(2),owner_id:foreignOwner},relationship(10,1,2)]));
 assert.throws(()=>seal([project(1),project(2),{...relationship(10,1,2),owner_id:foreignOwner}]));
});
test('archive rejects active links to deleted, shared and malformed project scope',()=>{
 for(const patch of [{deleted_at:deleted,updated_at:deleted},{visibility:'household',household_id:id(90)},{origin:'OTHER_PROJECT_ORIGIN'},{payload:{...project(2).payload,schemaVersion:2}}])assert.throws(()=>seal([project(1),{...project(2),...patch},relationship(10,1,2)]));
});
test('restore comparison blocks an absent current target even when the archive includes it',()=>{
 const records=[project(1),project(2),relationship(10,1,2)],plan=preview(records,[project(1)]);assert.equal(action(plan,10),'blocked-link-targets');assert.equal(plan.blockedCount,1);assert.equal(plan.databaseWritten,false);
});
test('restore comparison blocks deleted current hierarchy targets rather than reviving links',()=>{
 const records=[project(1),project(2),relationship(10,1,2)],plan=preview(records,[project(1),{...project(2),deleted_at:deleted,updated_at:deleted}]);assert.equal(action(plan,10),'blocked-link-targets');assert.equal(action(plan,2),'blocked-deletion-state');assert.equal(plan.executed,false);
});
test('restore comparison blocks occupied canonical pairs including retired membership rows',()=>{
 const records=[project(1),project(2),relationship(10,1,2)];for(const retired of [false,true]){const occupied={...relationship(11,1,2),...(retired?{deleted_at:deleted,updated_at:deleted}:{})},plan=preview(records,[project(1),project(2),occupied]);assert.equal(action(plan,10),'blocked-unique-slot');assert.equal(plan.blockedCount,1);assert.equal(plan.currentOnlyCount,1);}
});
test('restore comparison blocks an archived edge which would cycle through the current graph',()=>{
 const archived=[project(1),project(2),relationship(10,1,2)],current=[project(1),project(2),project(3),relationship(11,2,3),relationship(12,3,1)],plan=preview(archived,current);assert.equal(action(plan,10),'blocked-hierarchy-cycle');assert.equal(plan.blockedCount,1);assert.equal(plan.executed,false);assert.equal(plan.databaseWritten,false);
});
test('missing archived edge with exact current targets remains a review-only candidate',()=>{
 const records=[project(1),project(2),relationship(10,1,2)],plan=preview(records,[project(1),project(2)]);assert.equal(action(plan,10),'missing-needs-review');assert.equal(plan.missingCount,1);assert.equal(plan.restoreAvailable,false);assert.equal(plan.databaseWritten,false);assert.equal(plan.executed,false);
});
test('archive authentication is still bound to fictional owner, project and fake key',()=>{
 const bytes=seal([project(1),project(2),relationship(10,1,2)]).bytes;for(const patch of [{ownerId:foreignOwner},{projectRef:'otherfictional123'},{key:Buffer.alloc(32,18)}])assert.throws(()=>inspectPrivateWorkspace(bytes,{ownerId,projectRef,key,...patch}),/authenticated/);
});
test('restore comparison rejects a combined candidate cycle even when each missing edge alone is valid',()=>{
 const projects=[project(1),project(2),project(3)],archive=[...projects,relationship(10,1,2),relationship(11,3,1)],current=[...projects,relationship(12,2,3)];const plan=preview(archive,current);assert.equal(action(plan,10),'blocked-hierarchy-cycle');assert.equal(action(plan,11),'blocked-hierarchy-cycle');assert.equal(plan.executed,false);
});
