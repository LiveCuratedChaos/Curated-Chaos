import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyCommonProjectEdit} from '../src/private-common-project-edit.mjs';
const now=Date.parse('2026-11-19T12:00:00Z'),expiresAt=now+100000;
const manual=()=>({sourceKind:'project',expiresAt,edit:{projectToken:'p'.repeat(43),expiresAt,title:'Original project',description:'\nLiteral <details>\n',section:'Work',status:'Active',separateRecurring:false}});
const degree=()=>({sourceKind:'school-degree',expiresAt,edit:{editToken:'e'.repeat(43),expiresAt,kind:'degree',fields:{title:'Original program',progressMetric:'classes',totalCredits:120,totalTerms:6,targetDate:''}}});
test('common editor envelopes preserve source-specific editors, exact text and bounded authority',()=>{for(const value of [manual(),degree()])assert.equal(verifyCommonProjectEdit(value,{now}),value);const legacy=manual();delete legacy.edit.separateRecurring;assert.equal(verifyCommonProjectEdit(legacy,{now}),legacy);});
test('common editor envelopes reject wrong kinds, extra authority, malformed fields and extended expiry',()=>{
 for(const mutate of [v=>v.sourceKind='task',v=>v.owner_id='foreign',v=>v.edit.owner_id='foreign',v=>v.edit.projectToken='bad',v=>v.edit.title=' Untrimmed ',v=>v.edit.status='Archived',v=>v.edit.separateRecurring='false',v=>v.edit.description=null,v=>v.edit.expiresAt++,v=>v.expiresAt=now,v=>{v.expiresAt=now+300001;v.edit.expiresAt=v.expiresAt;}]){const value=manual();mutate(value);assert.throws(()=>verifyCommonProjectEdit(value,{now}));}
 const wrong=degree();wrong.sourceKind='school-course';assert.throws(()=>verifyCommonProjectEdit(wrong,{now}));for(const clock of [NaN,Infinity,'now'])assert.throws(()=>verifyCommonProjectEdit(manual(),{now:clock}));
});
