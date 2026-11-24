import test from 'node:test';
import assert from 'node:assert/strict';
import {makePrivateListTemplate,privateListTemplateFields,privateListTemplateState,instantiatePrivateListTemplate,LIST_TEMPLATE_ORIGIN} from '../src/private-list-template-model.mjs';

const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',created='2026-11-21T12:00:00.000Z';
const id=n=>'11111111-1111-4111-a111-'+String(n).padStart(12,'0');
const fields={name:'Sunday reset',taskTitle:'Reset the week',checklist:['Laundry','Plan meals','Review calendar']};
function record(){return{...makePrivateListTemplate(fields,owner,{idFactory:()=>id(1)}),version:3,created_at:created,updated_at:created,deleted_at:null};}

test('list template fields are bounded, normalized and reject duplicates or hidden extra authority',()=>{
 assert.deepEqual(privateListTemplateFields({...fields,name:' Sunday reset '}),fields);
 for(const invalid of [null,{...fields,owner_id:owner},{...fields,name:' '},{...fields,name:'x'.repeat(101)},{...fields,taskTitle:'bad\ntitle'},{...fields,checklist:Array(21).fill('Step')},{...fields,checklist:['Step',' step ']},{...fields,checklist:[' '.repeat(141)]}])assert.throws(()=>privateListTemplateFields(invalid));
});

test('template sources are exact owner-private Personal Life or Home records',()=>{
 const source=record();assert.deepEqual(privateListTemplateState(source,owner),source);
 const home={...source,section:'Home'};assert.deepEqual(privateListTemplateState(home,owner),home);
 for(const change of [r=>r.owner_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',r=>r.visibility='household',r=>r.section='Work',r=>r.item_type='task',r=>r.deleted_at=created,r=>r.payload.stepIds=[id(3)],r=>r.payload.checklist[0]='']){const bad=structuredClone(source);change(bad);assert.throws(()=>privateListTemplateState(bad,owner));}
});

test('explicit instantiation creates an undated canonical task and fresh open checklist IDs without changing template',()=>{
 const source=record(),before=structuredClone(source),task=instantiatePrivateListTemplate(source,owner,{taskIdFactory:()=>id(2),stepIdFactory:(()=>{let n=10;return()=>id(n++);})()});
 assert.equal(task.id,id(2));assert.equal(task.item_type,'task');assert.equal(task.origin,'PRIVATE_COOKIE_TASK_CREATE');assert.equal(task.section,'Personal Life');assert.equal(task.payload.title,fields.taskTitle);assert.equal(task.payload.day,null);assert.equal(task.payload.done,false);assert.deepEqual(task.payload.subtasks.map(({title,done})=>({title,done})),fields.checklist.map(title=>({title,done:false})));assert.equal(new Set(task.payload.subtasks.map(step=>step.id)).size,fields.checklist.length);assert.ok(task.payload.subtasks.every(step=>step.id!==id(1)&&step.done===false));assert.deepEqual(source,before);
});

test('instantiation rejects stale/ineligible source, malformed dates and colliding generated checklist IDs',()=>{
 const source=record();assert.throws(()=>instantiatePrivateListTemplate(source,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'));assert.throws(()=>instantiatePrivateListTemplate(source,owner,{day:'tomorrow'}));assert.throws(()=>instantiatePrivateListTemplate(source,owner,{stepIdFactory:()=>id(2)}));assert.equal(source.origin,LIST_TEMPLATE_ORIGIN);
});
