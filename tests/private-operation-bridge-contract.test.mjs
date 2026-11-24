import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorkspaceOperationIntent,verifyWorkspaceOperationReceipt,verifyWorkspaceOperationReplay} from '../server/private-operation-bridge-contract.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const taskId='22222222-2222-4222-8222-222222222222';
const projectA='33333333-3333-4333-8333-333333333333';
const projectB='44444444-4444-4444-8444-444444444444';
const stamp='2026-11-21T15:00:00.000Z';
function task({version=1,title='Original',payload={},origin='PRIVATE_COOKIE_TASK_CREATE',fictional=true}={}){
 return{id:taskId,owner_id:owner,household_id:null,visibility:'private',deleted_at:null,section:'Work',item_type:'task',origin,version,updated_at:stamp,payload:{fictional,schemaVersion:1,title,done:false,subtasks:[{id:'step-1',title:'Keep',done:false}],recurrence:{frequency:'weekly',interval:1},...payload}};
}
function manualTask({version=1,title='Original',payload={}}={}){
 return{id:taskId,owner_id:owner,household_id:null,visibility:'private',deleted_at:null,section:'Work',item_type:'task',origin:'CC_MANUAL_WORKSPACE',version,updated_at:stamp,payload:{source:'manual',schemaVersion:1,fictional:false,title,description:'',day:null,status:'Not Started',priority:'Normal',project_id:null,subtasks:[],done:false,...payload}};
}
function project({version=1,title='Project',payload={},origin='PRIVATE_COOKIE_PROJECT'}={}){
 return{id:projectA,owner_id:owner,household_id:null,visibility:'private',deleted_at:null,section:'Work',item_type:'project',origin,version,updated_at:stamp,payload:{fictional:true,schemaVersion:1,title,description:'',status:'Active',...payload}};
}
function receipt(intent,{replayed=false,createdAt=stamp}={}){
 return{schemaVersion:1,operationId:intent.operationId,ownerId:intent.ownerId,kind:intent.kind,recordId:intent.recordId,provenance:intent.provenance,itemType:intent.itemType,resultVersion:intent.resultVersion,intentDigest:intent.intentDigest,afterDigest:intent.afterDigest,relationshipDigest:intent.relationshipDigest,recurrenceDigest:intent.recurrenceDigest,createdAt,replayed};
}

test('native task intent preserves original identity, recurrence, checklist and reusable project memberships',()=>{
 const before=task(),after=task({version:2,title:'Renamed'}),links={before:{taskProjectIds:[projectA,projectB]},after:{taskProjectIds:[projectB,projectA]}};
 const intent=buildWorkspaceOperationIntent({operationId:'55555555-5555-4555-8555-555555555555',ownerId:owner,kind:'task.edit',before,after,relationships:links});
 assert.equal(intent.recordId,taskId);assert.equal(intent.provenance,'native');assert.equal(intent.expectedVersion,1);assert.equal(intent.resultVersion,2);
 const ack=verifyWorkspaceOperationReceipt(receipt(intent),intent,{now:()=>Date.parse(stamp)});
 assert.equal(ack.recordId,taskId);assert.equal(Object.hasOwn(ack,'payload'),false);assert.equal(Object.hasOwn(ack,'relationships'),false);
});

test('manual and native provenance stay separate even when record identities match',()=>{
 const before=manualTask(),after=manualTask({version:2,title:'Edited'});
 const intent=buildWorkspaceOperationIntent({operationId:'55555555-5555-4555-8555-555555555555',ownerId:owner,kind:'task.edit',before,after});
 assert.equal(intent.provenance,'manual');
 assert.throws(()=>buildWorkspaceOperationIntent({operationId:'55555555-5555-4555-8555-555555555555',ownerId:owner,kind:'task.edit',before:task(),after}),/could not be verified/);
});

test('project intent permits at most one unchanged master and preserves progress settings',()=>{
 const before=project({payload:{separateRecurring:true}}),after=project({version:2,title:'Edited',payload:{separateRecurring:true}});
 const intent=buildWorkspaceOperationIntent({operationId:'55555555-5555-4555-8555-555555555555',ownerId:owner,kind:'project.edit',before,after,relationships:{before:{projectMasterIds:[projectB]},after:{projectMasterIds:[projectB]}}});
 assert.equal(intent.relationshipDigest.length,64);
 assert.throws(()=>buildWorkspaceOperationIntent({operationId:'55555555-5555-4555-8555-555555555555',ownerId:owner,kind:'project.edit',before,after,relationships:{before:{projectMasterIds:[projectB]},after:{projectMasterIds:[]}}}),/could not be verified/);
 assert.throws(()=>buildWorkspaceOperationIntent({operationId:'55555555-5555-4555-8555-555555555555',ownerId:owner,kind:'project.edit',before,after:project({version:2,title:'Edited',payload:{separateRecurring:false}}),relationships:{before:{projectMasterIds:[projectB]},after:{projectMasterIds:[projectB]}}}),/could not be verified/);
 assert.throws(()=>buildWorkspaceOperationIntent({operationId:'55555555-5555-4555-8555-555555555555',ownerId:owner,kind:'project.edit',before,after,relationships:{before:{projectMasterIds:[projectB,projectA]},after:{projectMasterIds:[projectB,projectA]}}}),/could not be verified/);
});

test('task lifecycle, recurrence, checklist and unsupported source changes cannot enter edit receipts',()=>{
 const before=task({payload:{customExtension:{keep:'exact'}}}),base={operationId:'55555555-5555-4555-8555-555555555555',ownerId:owner,kind:'task.edit',before};
 assert.throws(()=>buildWorkspaceOperationIntent({...base,after:task({version:2,payload:{done:true}})}),/could not be verified/);
 assert.throws(()=>buildWorkspaceOperationIntent({...base,after:task({version:2,payload:{recurrence:{frequency:'daily',interval:1}}})}),/could not be verified/);
 assert.throws(()=>buildWorkspaceOperationIntent({...base,after:task({version:2,payload:{subtasks:[{id:'step-1',title:'Removed',done:false}]}})}),/could not be verified/);
 assert.throws(()=>buildWorkspaceOperationIntent({...base,after:task({version:2,payload:{customExtension:{keep:'changed'}}})}),/could not be verified/);
 assert.throws(()=>buildWorkspaceOperationIntent({...base,kind:'task.complete',after:task({version:2,payload:{done:true}})}),/could not be verified/);
 assert.throws(()=>buildWorkspaceOperationIntent({...base,after:task({version:2,origin:'UNKNOWN_ORIGIN'})}),/could not be verified/);
});

test('receipt replay accepts the identical intent only and enforces exact approved result facts',()=>{
 const intent=buildWorkspaceOperationIntent({operationId:'55555555-5555-4555-8555-555555555555',ownerId:owner,kind:'task.edit',before:task(),after:task({version:2,title:'Renamed'})});
 const original=receipt(intent),replay=receipt(intent,{replayed:true});
 assert.equal(verifyWorkspaceOperationReplay(replay,intent,{now:()=>Date.parse(stamp)}).replayed,true);
 assert.throws(()=>verifyWorkspaceOperationReplay(original,intent,{now:()=>Date.parse(stamp)}),/could not be verified/);
 assert.throws(()=>verifyWorkspaceOperationReplay({...replay,intentDigest:'0'.repeat(64)},intent,{now:()=>Date.parse(stamp)}),/could not be verified/);
 assert.throws(()=>verifyWorkspaceOperationReceipt(original,{...intent,resultVersion:3},{now:()=>Date.parse(stamp)}),/could not be verified/);
 assert.throws(()=>verifyWorkspaceOperationReceipt({...original,resultVersion:3},intent,{now:()=>Date.parse(stamp)}),/could not be verified/);
 assert.throws(()=>verifyWorkspaceOperationReceipt({...original,createdAt:'2026-11-21T15:01:00.000Z'},intent,{now:()=>Date.parse(stamp)}),/could not be verified/);
});
