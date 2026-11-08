import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditSnapshot,acceptanceProgress,ACCEPTANCE_CASES} from '../src/dev-acceptance-model.mjs';
import {allowedPublicPath} from '../tools/local-server.mjs';
const id='48b87aa5-7051-4c59-9477-8d731183d731';
const rec=(item_type,idSuffix)=>({id:`53b87aa5-7051-4c59-9477-8d731183d73${idSuffix}`,owner_id:id,household_id:null,visibility:'private',item_type});
test('M1H accepts only allowed public QA routes and keeps secrets private',()=>{
  for(const x of ['/dev-acceptance.html','/src/dev-acceptance.mjs','/src/dev-acceptance-model.mjs'])assert.equal(allowedPublicPath(x),true,x);
  for(const x of ['/.env.local','/tools/local-server.mjs','/tests/dev-acceptance.test.mjs'])assert.equal(allowedPublicPath(x),false,x);
});
test('M1H successful read-only bounded scan reports observed count and does not claim full security',()=>{
  const x=auditSnapshot({core:[rec('task','1'),rec('event','2')],email:[rec('email_fixture','3')],life:[rec('school_fixture','4')],decisions:[rec('suggestion_decision','5')],preferences:[rec('brief_preferences','6')]},id);
  assert.equal(x.status,'verified');assert.equal(x.returnedRecords,6);assert.equal(x.counts.tasks,1);assert.equal(x.counts.decisions,1);
  assert.match(x.description,/bounded cloud read/);
});
test('M1H flags cross-account returned record metadata as a failure',()=>{
  const x=auditSnapshot({core:[{...rec('task','1'),owner_id:'b'}]},id);
  assert.equal(x.status,'fail');assert.ok(x.findings.some(f=>f.level==='fail'));
});
test('M1H flags shared visibility or household data in private response',()=>{
  const x=auditSnapshot({core:[{...rec('task','1'),visibility:'household'}]},id);assert.equal(x.status,'fail');
});
test('M1H missing fixture rows never counts as manual acceptance',()=>{
  const a=auditSnapshot({},id);assert.ok(a.findings.some(f=>f.level==='warn'));
  assert.equal(acceptanceProgress({}).passed,0);assert.equal(acceptanceProgress({}).complete,false);
});
test('M1H manual acceptance requires all seven results passed',()=>{
  const p=Object.fromEntries(ACCEPTANCE_CASES.map(c=>[c.id,'passed']));
  assert.equal(acceptanceProgress(p).complete,true);p.isolation='blocked';
  assert.equal(acceptanceProgress(p).complete,false);assert.equal(acceptanceProgress(p).blocked,1);
});
test('M1H page makes no data writes and only scans authenticated private cloud',()=>{
  const t=readFileSync(new URL('../src/dev-acceptance.mjs',import.meta.url),'utf8');
  assert.match(t,/Promise\.all/);assert.match(t,/listBriefRecords/);assert.match(t,/listSuggestionDecisions/);
  for(const s of ['addFictionalTask','addSuggestionDecision','toggleFictionalTask','deleteRecord'])assert.doesNotMatch(t,new RegExp(s));
});

test('M1H decision read includes household scope metadata for read-only scan',()=>{
  const s=readFileSync(new URL('../src/dev-api.mjs',import.meta.url),'utf8');
  assert.match(s,/select=id,owner_id,household_id,visibility,item_type,payload,created_at&visibility=eq.private&owner_id=eq.\$\{encodeURIComponent\(ownerId\)\}&item_type=eq.suggestion_decision/);
});
