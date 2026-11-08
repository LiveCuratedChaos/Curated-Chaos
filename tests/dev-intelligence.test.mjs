import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fictionalSources, visibleFixtures, isDuplicateTask, validateSuggestedTask, intelligentSummary, INTEGRATION_SOURCES, makeSuggestionDismissal, normalizedDismissals } from '../src/dev-intelligence-model.mjs';
import { allowedPublicPath } from '../tools/local-server.mjs';

const day='2026-10-30',fx=fictionalSources(day);
test('fixture sources have fictional examples and clear provenance',()=>{
  assert.equal(INTEGRATION_SOURCES.length,5);
  for(const source of INTEGRATION_SOURCES){assert.ok(fx[source].length>0);assert.ok(fx[source].every(x=>typeof x.title==='string' && x.day));}
  assert.equal(fx.suggestions.length,3);
});
test('source hiding excludes fixtures in disabled sections',()=>{
  const choices={calendar:true,email:false,school:false,finances:true,household:false};
  const shown=visibleFixtures(fx,choices);
  assert.equal(shown.email.length,0);assert.ok(shown.calendar.length>0);assert.ok(shown.finances.length>0);
});
test('intelligent summary keeps cloud counts and sample data separate',()=>{
  const data={tasks:[{payload:{day,done:false}},{payload:{day:'2026-11-01',done:false}},{payload:{day,done:true}}]};
  const result=intelligentSummary(data,fx,{calendar:true,email:false,school:false,finances:false,household:false},day);
  assert.equal(result.open,1);assert.equal(result.upcoming,1);assert.equal(result.sampleToday,1);assert.equal(result.activeSources,1);
});
test('suggestion drafts validate length, section, calendar date',()=>{
  const s=fx.suggestions[0];
  assert.deepEqual(validateSuggestedTask(s,{title:'  Updated fake task  ',day,section:'School'}),{title:'Updated fake task',day,section:'School'});
  assert.throws(()=>validateSuggestedTask(s,{title:' ',day,section:'School'}));
  assert.throws(()=>validateSuggestedTask(s,{title:'X',day:'2026-02-30',section:'School'}));
  assert.throws(()=>validateSuggestedTask(s,{title:'X',day,section:'Finances'}));
  assert.throws(()=>validateSuggestedTask({},{}));
});
test('duplicate suggestion cannot create another identical fictional cloud task',()=>{
  const sug=fx.suggestions[0];
  assert.equal(isDuplicateTask([{item_type:'task',payload:{fictional:true,title:sug.title.toUpperCase(),day:sug.day}}],sug),true);
  assert.equal(isDuplicateTask([{item_type:'task',payload:{fictional:true,title:sug.title,day:'2030-01-01'}}],sug),false);
  assert.equal(isDuplicateTask([],sug),false);
  assert.equal(isDuplicateTask([{item_type:'task',payload:{fictional:true,title:'Renamed after approval',day:sug.day,source:'M1A_APPROVED_'+sug.id}}],sug),true);
});
test('intelligence view uses explicit review and does not fetch email, financial or calendar providers',()=>{
  const code=readFileSync(new URL('../src/dev-brief.mjs',import.meta.url),'utf8');
  assert.match(code,/sample-approve/);assert.match(code,/Approve & save private task/);assert.match(code,/isDuplicateTask/);
  assert.doesNotMatch(code,/accounts\.google\.com|gmail\.google\.com|plaid\.com|api\.chase\.com/);
  assert.doesNotMatch(code,/localStorage/);
});
test('server provides only the existing approved dashboard path, source module must be allowlisted',()=>{
  assert.equal(allowedPublicPath('/dev-dashboard.html'),true);
  assert.equal(allowedPublicPath('/.env.local'),false);
  assert.equal(allowedPublicPath('/src/dev-intelligence-model.mjs'),true);
});

test('fictional dismissal writes strictly private, owner-bound record',()=>{
  const owner='bb8f4c56-a302-48d3-8c40-dc2838a97221';
  const sample=fx.suggestions[1];
  const decision=makeSuggestionDismissal(sample,owner);
  assert.equal(decision.owner_id,owner);
  assert.equal(decision.visibility,'private');
  assert.equal(decision.household_id,null);
  assert.equal(decision.item_type,'suggestion_decision');
  assert.equal(decision.payload.suggestion_id,sample.id);
  assert.equal(decision.payload.status,'dismissed');
  assert.throws(()=>makeSuggestionDismissal(sample,'other-person'));
  assert.throws(()=>makeSuggestionDismissal({id:'unknown',source:'email'},owner));
});
test('dismissed suggestions reload only for their original account',()=>{
  const a='bb8f4c56-a302-48d3-8c40-dc2838a97221',b='aa8f4c56-a302-48d3-8c40-dc2838a97222';
  const decision=makeSuggestionDismissal(fx.suggestions[0],a);
  const row={...decision};
  assert.equal(normalizedDismissals([row],a).has(fx.suggestions[0].id),true);
  assert.equal(normalizedDismissals([row],b).size,0);
  assert.equal(normalizedDismissals([{...row,visibility:'household'}],a).size,0);
  assert.equal(normalizedDismissals([{...row,payload:{...row.payload,status:'approved'}}],a).size,0);
  assert.equal(normalizedDismissals([{...row,payload:{...row.payload,suggestion_id:'forged'}}],a).size,0);
});
