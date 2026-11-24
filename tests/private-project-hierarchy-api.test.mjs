import test from 'node:test';import assert from 'node:assert/strict';import {createPrivateProjectHierarchyApi} from '../src/private-project-hierarchy-api.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',parent='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',child='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const snapshot=()=>({projects:[],relationships:[],tasks:[],memberships:[]});
const readiness='/rest/v1/rpc/cc_project_hierarchy_single_master_ready';
const readyCall=token=>({path:readiness,options:{method:'POST',body:'{}'},token});
function setup(result=snapshot()){const calls=[],api=createPrivateProjectHierarchyApi(async(path,options,token)=>{calls.push({path,options,token});return path===readiness?true:result;});return{api,calls};}
test('hierarchy reads one bounded owner-scoped snapshot with no write fallback',async()=>{const s=setup();assert.deepEqual(await s.api.projectHierarchySnapshot('fictional',owner),snapshot());assert.deepEqual(s.calls,[readyCall('fictional'),{path:'/rest/v1/rpc/cc_project_hierarchy_snapshot',options:{method:'POST',body:'{}'},token:'fictional'}]);await assert.rejects(s.api.projectHierarchySnapshot('fictional','bad'));assert.equal(s.calls.length,2);});
test('hierarchy refuses incomplete, oversize, duplicate or foreign snapshot rows',async()=>{const row={id:parent,owner_id:owner,household_id:null,visibility:'private'};for(const value of [null,[],{...snapshot(),extra:[]},{...snapshot(),tasks:null},{...snapshot(),relationships:Array(2001).fill(row)},{...snapshot(),projects:[row,row]},{...snapshot(),projects:[{...row,owner_id:child}]},{...snapshot(),memberships:[{...row,visibility:'household'}]}])await assert.rejects(setup(value).api.projectHierarchySnapshot('x',owner));});
test('hierarchy uses exact version-bound RPC arguments and no upsert or automatic retry',async()=>{const s=setup({parentId:parent,childId:child}),review={parentProjectId:parent,parentVersion:2,childProjectId:child,childVersion:3,linkVersion:0,linked:true};await s.api.setProjectHierarchyLink('fixture-token',review);assert.deepEqual(s.calls,[readyCall('fixture-token'),{path:'/rest/v1/rpc/cc_set_project_hierarchy_link',options:{method:'POST',body:JSON.stringify({p_parent_project_id:parent,p_parent_version:2,p_child_project_id:child,p_child_version:3,p_link_version:0,p_linked:true})},token:'fixture-token'}]);for(const patch of [{parentProjectId:child},{childProjectId:'bad'},{parentVersion:0},{childVersion:1.1},{linkVersion:-1},{linked:'yes'},{owner_id:owner}])await assert.rejects(s.api.setProjectHierarchyLink('x',{...review,...patch}));assert.equal(s.calls.length,2);});
test('hierarchy does not accept absent or array mutation acknowledgements',async()=>{const review={parentProjectId:parent,parentVersion:1,childProjectId:child,childVersion:1,linkVersion:0,linked:false};for(const result of [null,[]])await assert.rejects(setup(result).api.setProjectHierarchyLink('x',review));});

test('hierarchy transport failures are surfaced after one request with no retry',async()=>{
 let requests=0;const api=createPrivateProjectHierarchyApi(async path=>{if(path===readiness)return true;requests++;throw Error('Fictional uncertain transport');});
 await assert.rejects(api.setProjectHierarchyLink('fictional',{parentProjectId:parent,parentVersion:1,childProjectId:child,childVersion:1,linkVersion:0,linked:true}),/uncertain transport/);assert.equal(requests,1);
});


test('unready or malformed schema readiness blocks reads and writes before record access',async()=>{
 const review={parentProjectId:parent,parentVersion:1,childProjectId:child,childVersion:1,linkVersion:0,linked:true};
 for(const value of [false,null,undefined,0,1,'true',[],{},[true],{ready:true}])for(const action of ['read','write']){
  const calls=[],api=createPrivateProjectHierarchyApi(async(path,options,token)=>{calls.push({path,options,token});return value;});
  await assert.rejects(action==='read'?api.projectHierarchySnapshot('fictional',owner):api.setProjectHierarchyLink('fictional',review),/not ready/);
  assert.deepEqual(calls,[readyCall('fictional')]);
 }
});

test('missing readiness RPC rejects before snapshot or mutation and is not retried',async()=>{
 const review={parentProjectId:parent,parentVersion:1,childProjectId:child,childVersion:1,linkVersion:0,linked:true};
 for(const action of ['read','write']){
  const calls=[],api=createPrivateProjectHierarchyApi(async(path,options,token)=>{calls.push({path,options,token});throw Error('Fictional missing RPC');});
  await assert.rejects(action==='read'?api.projectHierarchySnapshot('fictional',owner):api.setProjectHierarchyLink('fictional',review),/missing RPC/);assert.deepEqual(calls,[readyCall('fictional')]);
 }
});

test('schema readiness is rechecked for every read and mutation rather than cached',async()=>{
 let ready=true;const calls=[],review={parentProjectId:parent,parentVersion:1,childProjectId:child,childVersion:1,linkVersion:0,linked:true};
 const api=createPrivateProjectHierarchyApi(async path=>{calls.push(path);return path===readiness?ready:snapshot();});
 await api.projectHierarchySnapshot('fictional',owner);ready=false;
 await assert.rejects(api.projectHierarchySnapshot('fictional',owner),/not ready/);await assert.rejects(api.setProjectHierarchyLink('fictional',review),/not ready/);
 assert.deepEqual(calls,[readiness,'/rest/v1/rpc/cc_project_hierarchy_snapshot',readiness,readiness]);
});
