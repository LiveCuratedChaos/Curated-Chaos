import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cloudFreshness,safeSnapshotAge,verifiedSnapshotCounts,FRESH_AFTER_MS} from '../src/dev-sync-model.mjs';
import {allowedPublicPath,makeHandler} from '../tools/local-server.mjs';
const now=1793475000000;
const src=readFileSync(new URL('../src/dev-brief.mjs',import.meta.url),'utf8');
test('M1G no snapshot never claims current, no writes',()=>{
  const r=cloudFreshness({now});assert.equal(r.state,'unverified');assert.equal(r.allowWrite,false);
  assert.equal(cloudFreshness({loading:true,now}).state,'loading');
  assert.equal(cloudFreshness({offline:true,now}).state,'offline');
});
test('M1G recent fully checked cloud QA snapshot permits writes only after successful check',()=>{
  assert.deepEqual(cloudFreshness({lastSuccessAt:now-1000,now}),{state:'fresh',readable:'Development cloud checked recently',allowWrite:true});
  assert.equal(cloudFreshness({lastSuccessAt:now-FRESH_AFTER_MS,now}).state,'fresh');
  assert.equal(cloudFreshness({lastSuccessAt:now-FRESH_AFTER_MS-1,now}).state,'stale');
});
test('M1G refresh underway, failure and outage fail closed with old snapshot',()=>{
  for(const options of [{loading:true},{failed:true},{offline:true}]){
    const r=cloudFreshness({lastSuccessAt:now-5000,now,...options});assert.equal(r.allowWrite,false);assert.notEqual(r.state,'fresh');
  }
});
test('M1G stale or impossible clocks do not claim freshness',()=>{
  assert.equal(cloudFreshness({lastSuccessAt:now+1000,now}).state,'stale');
  assert.match(safeSnapshotAge(now+1000,now),/verification/);
  assert.equal(safeSnapshotAge(0,now),'Never checked');
  assert.equal(safeSnapshotAge(now-125000,now),'2 minute(s) ago');
});
test('M1G snapshot counts expose only supplied lengths, never invented live providers',()=>{
  assert.deepEqual(verifiedSnapshotCounts(),{tasks:0,events:0,notes:0,email:0,life:0,decisions:0});
  assert.deepEqual(verifiedSnapshotCounts({records:{tasks:[{},{}],events:[{}]},emails:[{}],decisions:[{}]}),{tasks:2,events:1,notes:0,email:1,life:0,decisions:1});
});
test('M1G browser layer warns on failed/offline snapshot and gates all consequential Daily Brief actions',()=>{
  for(const phrase of ['renderSyncPanel()','lastSuccessAt=Date.now()','refreshFailed=true','last confirmed snapshot','id="brief-simulate-offline"','id="brief-reload"','canWrite()','window.addEventListener(\'offline\'','document.addEventListener(\'visibilitychange\''])assert.ok(src.includes(phrase),phrase);
  assert.match(src,/if\(!canWrite\(\)\)return message\(syncWarning\(\),'error'\)/);
  assert.match(src,/lastSuccessAt=0/);
  assert.match(src,/refreshFailed=true;notice=simulateOutage/); // restoring requires another successful cloud fetch
  assert.match(src,/No test data has been verified for this session/);
  assert.match(src,/Promise\.all\(\[api\.listBriefRecords\(token\),api\.listSuggestionDecisions/);
  assert.doesNotMatch(src,/localStorage|sb_secret_|service_role/);
});
test('M1G freshness module route is public, development secrets still blocked',()=>{
  assert.equal(allowedPublicPath('/src/dev-sync-model.mjs'),true);
  for(const f of ['/.env.local','/tools/dev-env.mjs','/tests/dev-sync.test.mjs']) assert.equal(allowedPublicPath(f),false);
});
