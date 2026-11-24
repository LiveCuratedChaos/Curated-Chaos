import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewAutomationSuggestion,automationActionPolicy} from '../src/private-automation-policy.mjs';

const suggestion={id:'email-suggestion-1',source:'email',sourceId:'source-row-1',sourceVersion:3,rule:'email_to_task',confidence:0.8,uncertainty:'Confirm that the saved source means a task is needed.',reason:'A saved source may suggest a follow-up.'};

test('Automatic surfaces a provenance-bound suggestion but cannot write or take external action',()=>{
 const result=reviewAutomationSuggestion(suggestion,{mode:'automatic'});
 assert.equal(result.visible,true);assert.equal(result.effectiveMode,'automatic');assert.equal(result.requiresExplicitApproval,true);assert.equal(result.recordWriteAllowed,false);assert.equal(result.externalActionAllowed,false);
 assert.deepEqual(result.provenance,{source:'email',sourceId:'source-row-1',sourceVersion:3,rule:'email_to_task'});assert.equal(result.confidence,0.8);assert.match(result.uncertainty,/Confirm/);
});
test('Ask preserves approval and Disabled hides the suggestion',()=>{
 assert.equal(reviewAutomationSuggestion(suggestion,{mode:'ask'}).requiresExplicitApproval,true);
 const hidden=reviewAutomationSuggestion(suggestion,{mode:'disabled'});assert.equal(hidden.visible,false);assert.equal(hidden.recordWriteAllowed,false);
});
test('mandatory email-to-task approval overrides Automatic and every action remains non-automatic',()=>{
 const result=reviewAutomationSuggestion(suggestion,{mode:'automatic'});assert.equal(result.effectiveMode,'automatic');assert.equal(result.actionMode,'ask');
 for(const action of ['create','edit','delete','send','payment','trade','share','permission-change']){assert.equal(automationActionPolicy(action).requiresExplicitApproval,true);assert.equal(automationActionPolicy(action).automaticAllowed,false);}
 assert.throws(()=>reviewAutomationSuggestion({...suggestion,uncertainty:''}),/provenance and uncertainty/);
 assert.throws(()=>reviewAutomationSuggestion({...suggestion,confidence:2}),/provenance and uncertainty/);
});
