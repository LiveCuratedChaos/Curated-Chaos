import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeFictionalEmail, emailSuggestions } from '../src/dev-email-model.mjs';
import { makeFictionalLife, lifeSuggestions } from '../src/dev-life-model.mjs';
import { makeSuggestionDismissal, isDuplicateTask } from '../src/dev-intelligence-model.mjs';
import { makeApprovalDecision, makeRestoreDecision, getDecisionState, decisionPreventsApproval } from '../src/dev-decision-model.mjs';

const owner='bb8f4c56-a302-48d3-8c40-dc2838a97221';
const other='aa8f4c56-a302-48d3-8c40-dc2838a97222';
const emailRow={...makeFictionalEmail('appointment',owner,'2026-10-31'),id:'3aef9b5f-89e1-4dc5-8a62-7d84d06eb6c3'};
const schoolRow={...makeFictionalLife('course-assessment',owner,'2026-10-31'),id:'e99e3134-0b12-4320-9c40-56f8a1a762c5'};
const suggested=[...emailSuggestions([emailRow]),...lifeSuggestions([schoolRow])];
const suggestion=suggested[0];
const task={id:'c99e3134-0b12-4320-9c40-56f8a1a762c5',owner_id:owner,household_id:null,visibility:'private',item_type:'task',payload:{fictional:true,title:'Edited fictional appointment',source:'M1A_APPROVED_'+suggestion.id,day:'2026-11-01'}};
const stamp=(decision,date,id)=>({...decision,id,created_at:date});

test('approval is recorded only after confirmed own task, not merely user click',()=>{
 const r=makeApprovalDecision(suggestion,owner,task);
 assert.equal(r.payload.status,'approved');assert.equal(r.payload.task_id,task.id);
 assert.equal(r.payload.task_title,task.payload.title);
 assert.equal(r.visibility,'private');assert.equal(r.household_id,null);
 assert.throws(()=>makeApprovalDecision(suggestion,owner,{...task,owner_id:other}));
 assert.throws(()=>makeApprovalDecision(suggestion,owner,{...task,payload:{...task.payload,source:'M1A_APPROVED_wrong'}}));
 assert.throws(()=>makeApprovalDecision(suggestion,owner,{...task,id:'broken'}));
});
test('saved approval independently suppresses suggestion without requiring corresponding task',()=>{
 const saved=stamp(makeApprovalDecision(suggestion,owner,task),'2026-10-31T20:00:00Z','40d03492-09a1-4fdb-86b0-0bdbe9b5b88b');
 const state=getDecisionState([saved],owner,suggested);
 assert.ok(state.approved.has(suggestion.id));
 assert.equal(state.dismissed.size,0);
 assert.equal(isDuplicateTask([],suggestion),false); // old behavior alone would show the suggestion
 assert.equal(state.approved.has(suggestion.id)||isDuplicateTask([],suggestion),true);
 assert.equal(getDecisionState([saved],other,suggested).approved.size,0);
 assert.equal(getDecisionState([{...saved,visibility:'household'}],owner,suggested).approved.size,0);
});
test('dismiss, restore and re-dismiss are ordered by latest saved decision',()=>{
 const dismissed=stamp(makeSuggestionDismissal(suggestion,owner),'2026-10-31T18:00:00Z','3f16ac13-47e1-458c-a590-9dd5715125a1');
 const restored=stamp(makeRestoreDecision(suggestion,owner),'2026-10-31T19:00:00Z','2d16ac13-47e1-458c-a590-9dd5715125a1');
 const secondDismiss=stamp(makeSuggestionDismissal(suggestion,owner),'2026-10-31T20:00:00Z','1d16ac13-47e1-458c-a590-9dd5715125a1');
 assert.ok(getDecisionState([dismissed],owner,suggested).dismissed.has(suggestion.id));
 const restoredState=getDecisionState([dismissed,restored],owner,suggested);
 assert.ok(!restoredState.dismissed.has(suggestion.id));
 assert.equal(restoredState.latest.get(suggestion.id).payload.status,'restored');
 assert.ok(getDecisionState([dismissed,restored,secondDismiss],owner,suggested).dismissed.has(suggestion.id));
});
test('forged or irrelevant history entries cannot affect known suggestion',()=>{
 const r=stamp(makeApprovalDecision(suggestion,owner,task),'2026-10-31T20:00:00Z','40d03492-09a1-4fdb-86b0-0bdbe9b5b88b');
 for(const modified of [
   {...r,payload:{...r.payload,suggestion_id:'fake-id'}},
   {...r,payload:{...r.payload,source:'finances'}},
   {...r,payload:{...r.payload,task_id:'invalid'}},
   {...r,payload:{...r.payload,fictional:false}}
 ])assert.equal(getDecisionState([modified],owner,suggested).approved.size,0);
});
test('workflow requires review and cloud recheck before creating task; restores only dismissal',()=>{
 const code=readFileSync(new URL('../src/dev-brief.mjs',import.meta.url),'utf8');
 assert.match(code,/Approve & save private task/);
 assert.match(code,/Promise\.all\(\[api\.listBriefRecords\(token\),api\.listSuggestionDecisions\(token,viewer\)\]\)/);
 assert.match(code,/currentFictionalSuggestion\(currentSourceRows,viewer,suggestion\)/);
 assert.match(code,/readOwnerBriefPreferences\(currentPreferencesRows,viewer\)/);
 assert.match(code,/makeApprovalDecision/);
 assert.match(code,/data-restore/);
 assert.match(code,/makeRestoreDecision/);
 assert.match(code,/Not an immutable audit log/);
 assert.doesNotMatch(code,/api\.deleteFictionalTask|api\.sendEmail|api\.payBill/);
});

test('regression: restoring an earlier dismissal permits saving on cloud recheck',()=>{
  const dismissed=stamp(makeSuggestionDismissal(suggestion,owner),'2026-10-31T18:00:00Z','3f16ac13-47e1-458c-a590-9dd5715125a1');
  const restored=stamp(makeRestoreDecision(suggestion,owner),'2026-10-31T19:00:00Z','2d16ac13-47e1-458c-a590-9dd5715125a1');
  const approved=stamp(makeApprovalDecision(suggestion,owner,task),'2026-10-31T20:00:00Z','40d03492-09a1-4fdb-86b0-0bdbe9b5b88b');
  const beforeRestore=getDecisionState([dismissed],owner,suggested);
  const afterRestore=getDecisionState([dismissed,restored],owner,suggested);
  const afterApproval=getDecisionState([dismissed,restored,approved],owner,suggested);
  assert.equal(decisionPreventsApproval(beforeRestore,suggestion.id),true);
  assert.equal(afterRestore.latest.has(suggestion.id),true);
  assert.equal(afterRestore.latest.get(suggestion.id).payload.status,'restored');
  assert.equal(decisionPreventsApproval(afterRestore,suggestion.id),false,'restored decisions must not block approval');
  assert.equal(decisionPreventsApproval(afterApproval,suggestion.id),true);
  assert.equal(decisionPreventsApproval(afterRestore,'nonexistent'),false);
  const code=readFileSync(new URL('../src/dev-brief.mjs',import.meta.url),'utf8');
  assert.match(code,/if\(decisionPreventsApproval\(decisions,suggestion\.id\)\|\|isDuplicateTask\(remote\.tasks/);
  assert.doesNotMatch(code,/decisions\.latest\.has\(suggestion\.id\)/);
});
test('removed or household-associated decisions cannot suppress private suggestions',()=>{
 const row=stamp(makeSuggestionDismissal(suggestion,owner),'2026-11-08T12:00:00Z','40d03492-09a1-4fdb-86b0-0bdbe9b5b88b');for(const modified of [{...row,deleted_at:'2026-11-08T13:00:00Z'},{...row,household_id:other}]){const state=getDecisionState([modified],owner,suggested);assert.equal(state.dismissed.size,0);assert.equal(state.history.length,0);}
});
test('a removed task cannot be treated as a newly confirmed approval',()=>{
 assert.throws(()=>makeApprovalDecision(suggestion,owner,{...task,deleted_at:'2026-11-08T12:00:00Z'}),/confirmed/);
});
