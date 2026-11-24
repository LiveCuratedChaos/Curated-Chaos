import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { EMAIL_EXAMPLES, makeFictionalEmail, normalizeFictionalEmails, emailSuggestions, isEmailFixtureSuggestion } from '../src/dev-email-model.mjs';
import { isDuplicateTask, currentFictionalSuggestion, normalizedDismissals, makeSuggestionDismissal, validateSuggestedTask } from '../src/dev-intelligence-model.mjs';
import { allowedPublicPath, makeHandler } from '../tools/local-server.mjs';
import { renderConnectedShell } from '../src/dev-cloud-shell.mjs';
const owner='bb8f4c56-a302-48d3-8c40-dc2838a97221',other='aa8f4c56-a302-48d3-8c40-dc2838a97222',id='1f3ab922-5969-421d-9741-ad4fcab22359';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const sample=(type='appointment')=>({id,...makeFictionalEmail(type,owner,'2026-10-30'),created_at:'2026-10-30T15:00:00Z'});

test('M1C only has fictional fixed sample email templates and no provider addresses',()=>{
  assert.equal(EMAIL_EXAMPLES.length,3);
  assert.ok(EMAIL_EXAMPLES.every(x=>x.sender.endsWith('@example.invalid>') && x.subject.startsWith('Sample:')));
  const message=makeFictionalEmail('appointment',owner,'2026-10-30');
  assert.equal(message.item_type,'email_fixture');assert.equal(message.owner_id,owner);assert.equal(message.visibility,'private');
  assert.equal(message.household_id,null);assert.equal(message.payload.fictional,true);assert.equal(message.payload.action_day,'2026-10-31');
  assert.throws(()=>makeFictionalEmail('unknown',owner));assert.throws(()=>makeFictionalEmail('appointment',other.slice(3)));
  assert.throws(()=>makeFictionalEmail('appointment',owner,'2026-02-30'));
});
test('only owner private, valid and unmodified known fictional emails survive normalization',()=>{
  const row=sample(), altered={...row, payload:{...row.payload,subject:'Actual inbox email'}};
  assert.deepEqual(normalizeFictionalEmails([row],owner).map(x=>x.id),[id]);
  assert.equal(normalizeFictionalEmails([row],other).length,0);
  assert.equal(normalizeFictionalEmails([{...row,owner_id:other}],owner).length,0);
  assert.equal(normalizeFictionalEmails([{...row,visibility:'household'}],owner).length,0);
  assert.equal(normalizeFictionalEmails([altered],owner).length,0);
  assert.equal(normalizeFictionalEmails([{...row,payload:{...row.payload,received_day:'2026-10-29'}}],owner).length,0);
});
test('same template added twice only produces one visible email and insight',()=>{
  const first=sample(),second={...first,id:'1f3ab922-5969-421d-9741-ad4fcab22360',created_at:'2026-10-31T15:00:00Z'};
  const rows=normalizeFictionalEmails([second,first],owner);
  assert.equal(rows.length,1);assert.equal(rows[0].id,id);assert.equal(emailSuggestions(rows).length,1);
});
test('only actionable appointment and school examples suggest tasks; receipt does not',()=>{
  const appointment=sample('appointment');
  const study={...sample('study'),id:'2f3ab922-5969-421d-9741-ad4fcab22359'};
  const receipt={...sample('receipt'),id:'3f3ab922-5969-421d-9741-ad4fcab22359'};
  const rows=normalizeFictionalEmails([appointment,study,receipt],owner);
  const suggestions=emailSuggestions(rows);
  assert.equal(suggestions.length,2);
  assert.equal(suggestions[0].rule,'email_to_task');
  assert.equal(suggestions[1].section,'School');
  assert.equal(suggestions.some(x=>x.title.includes('receipt')),false);
  assert.equal(suggestions[0].day,'2026-10-31');
  assert.ok(suggestions.every(x=>isEmailFixtureSuggestion(x)));
});
test('email suggestion requires explicit task validation, task confirmation and allows persisted dismissal',()=>{
  const sug=emailSuggestions([sample()])[0];
  const validated=validateSuggestedTask(sug,{title:sug.title,day:sug.day,section:sug.section});
  assert.equal(validated.title,sug.title);
  assert.equal(isDuplicateTask([],sug),false);
  assert.equal(isDuplicateTask([{item_type:'task',payload:{fictional:true,source:'M1A_APPROVED_'+sug.id,title:'Edited test task',day:'2026-11-02'}}],sug),true);
  const decision=makeSuggestionDismissal(sug,owner);
  assert.equal(decision.payload.suggestion_id,sug.id);
  assert.equal(normalizedDismissals([decision],owner,[sug.id]).has(sug.id),true);
  assert.equal(normalizedDismissals([decision],owner).has(sug.id),false);
  assert.equal(normalizedDismissals([decision],other,[sug.id]).has(sug.id),false);
  assert.throws(()=>makeSuggestionDismissal({id:'email-fixture-FAKE',source:'email',rule:'email_to_task'},owner));
});
test('email test screen, sources and shell are allowlisted; credentials are not',()=>{
  for(const path of ['/dev-email.html','/src/dev-email.mjs','/src/dev-email-model.mjs'])assert.equal(allowedPublicPath(path),true);
  for(const path of ['/.env.local','/tests/dev-email.test.mjs','/supabase/migrations/001_dev_isolation.sql'])assert.equal(allowedPublicPath(path),false);
  assert.match(renderConnectedShell('hello',{active:'email'}),/EMAIL INSIGHTS · QA ONLY/);
  assert.match(read('dev-email.html'),/dev-email.mjs/);
  assert.match(read('src/dev-brief.mjs'),/listFictionalEmails/);
  assert.match(read('src/dev-email.mjs'),/addFictionalEmail/);
  assert.doesNotMatch(read('src/dev-email.mjs'),/accounts.google.com|gmail.google.com|api.gmail.com|localStorage/);
  assert.doesNotMatch(read('src/dev-email-model.mjs'),/accounts.google.com|gmail.google.com|api.gmail.com/);
});
test('removed sample email never returns to inbox or suggestions and cannot hide a replacement',()=>{
 const removed={...sample(),deleted_at:'2026-11-08T12:00:00Z'},replacement={...sample(),id:'2f3ab922-5969-421d-9741-ad4fcab22359',created_at:'2026-11-08T13:00:00Z'};assert.deepEqual(normalizeFictionalEmails([null,removed,replacement],owner),[replacement]);assert.deepEqual(emailSuggestions([removed]),[]);
});

test('reviewed email suggestions lose eligibility when their source disappears or changes revision',()=>{
 const row={...sample(),version:1};
 const [suggestion]=emailSuggestions(normalizeFictionalEmails([row],owner));
 assert.deepEqual(currentFictionalSuggestion([row],owner,suggestion),suggestion);
 for(const changed of [
  [],[{...row,version:2}],[{...row,deleted_at:'2026-10-31T12:00:00Z'}],
  [{...row,owner_id:other}],[{...row,visibility:'household'}],[row,row]
 ])assert.equal(currentFictionalSuggestion(changed,owner,suggestion),null);
});
