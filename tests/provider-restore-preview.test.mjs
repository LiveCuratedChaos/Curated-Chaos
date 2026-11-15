import test from 'node:test';import assert from 'node:assert/strict';import {providerSnapshotFixture} from './fixtures/provider-snapshot-fixture.mjs';import {sealProviderSnapshot} from '../server/provider-snapshot-backup.mjs';import {previewProviderRestore} from '../server/provider-restore-preview.mjs';import {createTokenSealer} from '../server/token-sealer.mjs';
async function setup(){const f=await providerSnapshotFixture(),bytes=sealProviderSnapshot(f).bytes;return{f,preview:existing=>previewProviderRestore({...f,bytes,existing})};}
test('restore preview recognizes existing copies and proposes only missing records without modifying either inventory',async()=>{
 const {f,preview}=await setup(),before=structuredClone(f.rows);const same=preview(f.rows);assert.equal(same.unchangedCount,3);assert.equal(same.insertCount,0);const empty=preview([]);assert.equal(empty.insertCount,3);assert.equal(empty.executed,false);assert.equal(empty.requiresApproval,true);empty.actions[0].record.payload.content.subject='MUTATED REVIEW';assert.deepEqual(f.rows,before);assert.equal(preview([]).actions[0].record.payload.content.subject,'PRIVATE EMAIL TITLE');
});
test('changed contents conflict, while refreshed encryption and a higher unchanged revision preserve current records',async()=>{
 const {f,preview}=await setup(),sealer=createTokenSealer(f.key);f.rows[0].payload.content.subject='Changed private fixture';f.rows[0].version++;const bank=f.rows[1],context='finance-record:'+f.ownerId+':'+bank.id;bank.payload.encrypted=sealer.seal(sealer.unseal(bank.payload.encrypted,context),context);bank.version++;const plan=preview(f.rows);assert.equal(plan.conflictCount,1);assert.equal(plan.unchangedCount,2);assert.equal(plan.canProposeInsertOnly,false);assert.equal(f.rows[0].payload.content.subject,'Changed private fixture');
});
test('deleted, moved, foreign and older revisions block restoration rather than undoing later changes',async()=>{
 for(const patch of [{deleted_at:'2026-11-08T21:00:00Z'},{visibility:'household'},{owner_id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'},{version:0},{item_type:'task'}]){const {f,preview}=await setup();Object.assign(f.rows[0],patch);const plan=preview(f.rows);assert.equal(plan.blockedCount,1);assert.equal(plan.canProposeInsertOnly,false);assert.equal(plan.actions.some(row=>row.action==='update'||row.action==='delete'),false);}
});
test('unexpected, duplicate or corrupt current copies cannot produce a partial restore proposal',async()=>{
 const {f,preview}=await setup();assert.throws(()=>preview([f.rows[0],f.rows[0]]));assert.throws(()=>preview([{...f.rows[0],id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'}]));f.rows[1].payload.encrypted='corrupt';assert.throws(()=>preview(f.rows));
});
