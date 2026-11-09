import test from 'node:test';import assert from 'node:assert/strict';import {safeSavedAt,snapshotFreshness} from '../server/snapshot-freshness.mjs';
const now=Date.parse('2026-11-08T20:00:00Z');
test('save-time parser accepts database microseconds but rejects rolled dates and ambiguous local times',()=>{
 assert.equal(safeSavedAt('2026-11-08T12:00:00.123456-05:00'),'2026-11-08T17:00:00.123Z');
 for(const value of ['2026-11-31T00:00:00Z','2026-11-08','2026-11-08T24:00:00Z','2026-11-08T12:00:00',null])assert.equal(safeSavedAt(value),null);
});
test('inventory reports oldest and newest real save times, unknowns and absent sources without claiming source freshness',()=>{
 const result=snapshotFreshness({now,records:[{provider:'gmail',fictional:false,savedAt:'2026-11-08T10:00:00Z'},{provider:'gmail',fictional:false,savedAt:'2026-11-07T10:00:00Z'},{provider:'gmail',fictional:false,savedAt:'2026-11-09T10:00:00Z'},{provider:'gmail',fictional:false},{provider:'gmail',fictional:true,savedAt:'2020-01-01T00:00:00Z'}],finance:{accounts:[{fictional:false,savedAt:'invalid',currentMinor:999}],transactions:[]}});
 const mail=result.sources[0];assert.equal(mail.count,4);assert.equal(mail.oldestSavedAt,'2026-11-07T10:00:00.000Z');assert.equal(mail.newestSavedAt,'2026-11-08T10:00:00.000Z');assert.equal(mail.unknownSavedAtCount,2);assert.equal(mail.sourceCheckedAt,null);assert.equal(result.sources[1].count,0);assert.equal(result.sources[2].unknownSavedAtCount,1);assert.doesNotMatch(JSON.stringify(result),/999|2020/);
});
