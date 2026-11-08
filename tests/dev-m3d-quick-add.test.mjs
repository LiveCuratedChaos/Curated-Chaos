import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeTask,normalizeOrganizerRows,changeTask,addSubtask} from '../src/dev-organize-model.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID='44444444-4444-4444-8444-444444444444';
const record=(payload)=>({id:ID,owner_id:A,household_id:null,visibility:'private',section:'Personal Life',item_type:'task',created_at:'2026-11-02T00:00:00Z',deleted_at:null,payload});
test('M3D supports task title-only with no fabricated due date and private owner',()=>{
 const r=makeTask({title:'Plan next week'},A);
 assert.equal(r.payload.day,null);assert.equal(r.payload.status,'Not Started');assert.equal(r.payload.priority,'Normal');assert.equal(r.visibility,'private');
 assert.equal(normalizeOrganizerRows([record(r.payload)],A).tasks.length,1);
});
test('M3D optional date can be added then cleared without losing subtasks',()=>{
 const r=record(makeTask({title:'Plan next week'},A).payload);
 const withSub=record(addSubtask(r,'Draft outline','33333333-3333-4333-8333-333333333333'));
 const dated=changeTask(withSub,{day:'2026-11-20'},A);
 const cleared=changeTask(record(dated),{day:''},A);
 assert.equal(dated.day,'2026-11-20');assert.equal(cleared.day,null);assert.equal(cleared.subtasks[0].title,'Draft outline');
});
test('M3D task quick add has title required and optional advanced details',()=>{
 const src=readFileSync(new URL('../src/dev-organize.mjs',import.meta.url),'utf8');
 assert.match(src,/Optional details/);assert.match(src,/Due date \(optional\)/);
 assert.doesNotMatch(src,/name="day" type="date"[^>]*required/);
});
