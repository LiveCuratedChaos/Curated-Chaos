import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {makePrivateRecordQaFixture} from './fixtures/private-record-qa.mjs';import {validateRecoveryDrillArguments,verifyProviderRestore} from '../tools/verify-provider-restore.mjs';
const project='devproject12345',run='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
test('fictional restore drill defaults offline and requires an exact named two-record approval',()=>{
 const output=execFileSync(process.execPath,['tools/verify-provider-restore.mjs'],{encoding:'utf8'});assert.match(output,/PLAN ONLY/);assert.match(output,/no credentials, encryption key, real backup/);const args=['--allow-fictional-restore-test','--project='+project,'--run='+run,'--fixtures=2'];assert.deepEqual(validateRecoveryDrillArguments(args),{project,run,resumeOnly:false});for(const bad of [[...args,'--real-backup'],args.map(arg=>arg==='--fixtures=2'?'--fixtures=3':arg),args.filter(arg=>!arg.startsWith('--run='))])assert.throws(()=>validateRecoveryDrillArguments(bad));
});
test('fictional restore drill proves encrypted original-time recovery, privacy, no duplicates and exact cleanup',async()=>{
 const f=makePrivateRecordQaFixture();await verifyProviderRestore({project,run},f.deps);assert.equal(f.state.inserts,1);assert.equal(f.state.patches,2);assert.equal(f.state.rows.length,2);assert.ok(f.state.rows.every(row=>row.deleted_at&&row.created_at==='2026-11-01T12:00:00.000Z'&&row.payload.scheme==='mac-calendar-private-v1'));assert.doesNotMatch(JSON.stringify(f.state.rows),/QA FICTIONAL|fictional-event|fictional-calendar/);await verifyProviderRestore({project,run,resumeOnly:true},f.deps);assert.equal(f.state.inserts,1);assert.equal(f.state.patches,2);
});
test('uncertain recovery insert stops and a named resume cannot create extra records',async()=>{
 const f=makePrivateRecordQaFixture();f.state.uncertain=true;await assert.rejects(verifyProviderRestore({project,run},f.deps),/not confirmed/);assert.equal(f.state.rows.length,2);assert.equal(f.state.patches,0);await verifyProviderRestore({project,run,resumeOnly:true},f.deps);assert.equal(f.state.inserts,1);assert.equal(f.state.patches,2);
});
test('interrupted recovery cleanup resumes only the remaining verified fictional record',async()=>{
 const f=makePrivateRecordQaFixture();f.state.failPatch=2;await assert.rejects(verifyProviderRestore({project,run},f.deps),/interrupted cleanup/);assert.equal(f.state.rows.filter(row=>row.deleted_at).length,1);await verifyProviderRestore({project,run,resumeOnly:true},f.deps);assert.equal(f.state.inserts,1);assert.equal(f.state.rows.filter(row=>row.deleted_at).length,2);
});
test('existing unrelated records stay unchanged and malformed resumed fixtures are never cleaned',async()=>{
 const f=makePrivateRecordQaFixture(),unrelated={id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',owner_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',item_type:'task',origin:'manual',payload:{title:'Fictional original task'},version:1,deleted_at:null};f.state.rows.push(structuredClone(unrelated));await verifyProviderRestore({project,run},f.deps);assert.deepEqual(f.state.rows.find(row=>row.id===unrelated.id),unrelated);
 const g=makePrivateRecordQaFixture();g.state.uncertain=true;await assert.rejects(verifyProviderRestore({project,run},g.deps));g.state.rows[0].payload.encrypted='corrupt';await assert.rejects(verifyProviderRestore({project,run,resumeOnly:true},g.deps),/fixtures changed/);assert.equal(g.state.patches,0);assert.equal(g.state.inserts,1);
});
test('wrong targets and absent-run resume cannot read an encryption key or create records respectively',async()=>{
 const f=makePrivateRecordQaFixture();let keys=0;f.deps.keyLoader=async()=>{keys++;return Buffer.alloc(32,9);};await assert.rejects(verifyProviderRestore({project:'differentdev123',run},f.deps),/Unexpected/);assert.equal(keys,0);await assert.rejects(verifyProviderRestore({project,run,resumeOnly:true},f.deps),/cannot create/);assert.equal(f.state.inserts,0);
});
