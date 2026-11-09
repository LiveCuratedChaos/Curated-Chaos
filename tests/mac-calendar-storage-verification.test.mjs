import {makePrivateRecordQaFixture as fixture} from './fixtures/private-record-qa.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {validateMacStorageTestArguments,verifyMacCalendarStorage} from '../tools/verify-mac-calendar-storage.mjs';
const project='devproject12345',run='cccccccc-cccc-4ccc-8ccc-cccccccccccc',a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const config={CC_DEV_SUPABASE_URL:'https://'+project+'.supabase.co/',CC_DEV_PROJECT_REF:project,CC_ORIGINAL_PROJECT_REF:'originalproject123',CC_DEV_PUBLISHABLE_KEY:'sb_publishable_fictional_key',CC_CONFIRM_NEW_DEV_PROJECT:'I_CHECKED_THIS_IS_NOT_MY_EXISTING_PROJECT',CC_TEST_A_EMAIL:'a@example.test',CC_TEST_B_EMAIL:'b@example.test',CC_TEST_A_PASSWORD:'FICTIONAL_A',CC_TEST_B_PASSWORD:'FICTIONAL_B'};
test('calendar storage checker defaults offline and requires exact two-fixture approval',()=>{
 const output=execFileSync(process.execPath,['tools/verify-mac-calendar-storage.mjs'],{encoding:'utf8'});assert.match(output,/PLAN ONLY/);assert.match(output,/no credentials\/key read/);assert.equal(validateMacStorageTestArguments([]),null);
 for(const args of [['--allow-mac-storage-test'],['--allow-mac-storage-test','--project='+project,'--run='+run,'--fixtures=3'],['--allow-mac-storage-test','--project='+project,'--run=bad','--fixtures=2'],['--allow-mac-storage-test','--project='+project,'--run='+run,'--fixtures=2','--extra']])assert.throws(()=>validateMacStorageTestArguments(args));
 assert.deepEqual(validateMacStorageTestArguments(['--allow-mac-storage-test','--project='+project,'--run='+run,'--fixtures=2']),{project,run,resumeOnly:false});
});
test('checker proves ciphertext, duplicate-free retry, blocked changes and exact reversible cleanup without real services',async()=>{
 const f=fixture();await verifyMacCalendarStorage({project,run},f.deps);assert.equal(f.state.inserts,1);assert.equal(f.state.patches,2);assert.equal(f.state.rows.length,2);assert.ok(f.state.rows.every(row=>row.deleted_at&&row.payload.scheme==='mac-calendar-private-v1'));assert.doesNotMatch(JSON.stringify(f.state.rows),/QA FICTIONAL|fictional-event|fictional-calendar/);
 await verifyMacCalendarStorage({project,run,resumeOnly:true},f.deps);assert.equal(f.state.inserts,1);assert.equal(f.state.patches,2);
});
test('uncertain insert acknowledgement stops, and resuming the same run cannot create extra rows',async()=>{
 const f=fixture();f.state.uncertain=true;await assert.rejects(verifyMacCalendarStorage({project,run},f.deps),/Save not confirmed/);assert.equal(f.state.rows.length,2);assert.equal(f.state.patches,0);await verifyMacCalendarStorage({project,run,resumeOnly:true},f.deps);assert.equal(f.state.inserts,1);assert.equal(f.state.patches,2);
});
test('wrong project or resume of an absent run performs no key read or database insert',async()=>{
 const f=fixture();let keys=0;f.deps.keyLoader=async()=>{keys++;return Buffer.alloc(32,9);};await assert.rejects(verifyMacCalendarStorage({project:'differentdev123',run},f.deps));assert.equal(keys,0);await assert.rejects(verifyMacCalendarStorage({project,run,resumeOnly:true},f.deps),/cannot create/);assert.equal(f.state.inserts,0);
});

test('interrupted cleanup resumes only the remaining exact fixture without new inserts',async()=>{
 const f=fixture();f.state.failPatch=2;await assert.rejects(verifyMacCalendarStorage({project,run},f.deps),/interrupted cleanup/);assert.equal(f.state.rows.filter(row=>row.deleted_at).length,1);await verifyMacCalendarStorage({project,run,resumeOnly:true},f.deps);assert.equal(f.state.inserts,1);assert.equal(f.state.rows.filter(row=>row.deleted_at).length,2);
});
