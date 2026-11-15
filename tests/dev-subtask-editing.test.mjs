import test from 'node:test';
import assert from 'node:assert/strict';
import {changeSubtasks} from '../src/dev-organize-model.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const one='11111111-1111-4111-8111-111111111111',two='22222222-2222-4222-8222-222222222222';
const task=()=>({owner_id:owner,visibility:'private',household_id:null,item_type:'task',payload:{fictional:true,title:'Plan trip',project_id:'keep-project',priority:'High',subtasks:[{id:one,title:'Book train',done:true},{id:two,title:'Pack bag',done:false}]}});
test('subtask rename and removal preserve metadata, completion, order and original data',()=>{
 const r=task(),before=structuredClone(r);
 const renamed=changeSubtasks(r,[{id:one,title:'  Book return train  ',remove:false}],owner);
 assert.deepEqual(renamed.subtasks,[{id:one,title:'Book return train',done:true},{id:two,title:'Pack bag',done:false}]);
 const removed=changeSubtasks({...r,payload:renamed},[{id:two,title:'',remove:true}],owner);
 assert.deepEqual(removed,{...r.payload,subtasks:[{id:one,title:'Book return train',done:true}]});
 assert.deepEqual(r,before);
 assert.deepEqual(changeSubtasks(r,[{id:one,remove:true},{id:two,remove:true}],owner).subtasks,[]);
});
test('subtask changes reject invalid or stale IDs and invalid titles atomically',()=>{
 const r=task(),before=structuredClone(r);
 for(const changes of [
  [{id:one,title:'',remove:false}],
  [{id:one,title:'x'.repeat(141),remove:false}],
  [{id:owner,title:'Unknown',remove:false}],
  [{id:one,title:'First',remove:false},{id:one,title:'Second',remove:false}],
  [{id:one,title:'Oops',remove:'false'}],null
 ])assert.throws(()=>changeSubtasks(r,changes,owner));
 assert.deepEqual(r,before);
});
test('subtask editing refuses other owners, shared scope, and non-fictional records',()=>{
 const r=task(),changes=[{id:one,title:'Changed',remove:false}];
 for(const invalid of [{...r,owner_id:two},{...r,visibility:'household'},{...r,household_id:two},{...r,item_type:'project'},{...r,payload:{...r.payload,fictional:false}}])assert.throws(()=>changeSubtasks(invalid,changes,owner));
});
