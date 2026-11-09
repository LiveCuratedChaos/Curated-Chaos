import test from 'node:test';
import assert from 'node:assert/strict';
import {createTokenSealer} from '../server/token-sealer.mjs';
import {createSealedFinanceRepository} from '../server/sealed-finance-repository.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',record={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',owner_id:ownerId,household_id:null,visibility:'private',section:'Finances',item_type:'provider_bank_account',origin:'plaid_readonly',payload:{fictional:false,provider:'plaid',institution:'Chase',connectionId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',sourceId:'private-account-id',content:{name:'Private checking name',currency:'USD',currentMinor:1234567}}};
function fixture(){const state={rows:[]},repository={readByIds:async()=>state.rows,listSavedFinance:async()=>state.rows,insertMany:async(_actor,_owner,rows)=>{state.rows=structuredClone(rows).map(r=>({...r,version:1}));return state.rows;}};return {state,sealed:createSealedFinanceRepository(repository,createTokenSealer(Buffer.alloc(32,8)))};}
test('financial contents reach storage only as authenticated ciphertext and round-trip for the owner',async()=>{
 const f=fixture(),saved=await f.sealed.insertMany({},ownerId,[record]);assert.deepEqual(saved[0].payload,record.payload);assert.equal(f.state.rows[0].payload.scheme,'chase-private-v1');assert.doesNotMatch(JSON.stringify(f.state.rows),/private-account-id|Private checking name|1234567/);assert.deepEqual((await f.sealed.listSavedFinance({},ownerId))[0].payload,record.payload);
});
test('swapped record identity, foreign owners and plaintext financial rows fail closed',async()=>{
 const f=fixture();await f.sealed.insertMany({},ownerId,[record]);f.state.rows[0].id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';await assert.rejects(f.sealed.readByIds({},ownerId,[f.state.rows[0].id]));
 const g=fixture();g.state.rows=[record];await assert.rejects(g.sealed.listSavedFinance({},ownerId));await assert.rejects(g.sealed.insertMany({},'dddddddd-dddd-4ddd-8ddd-dddddddddddd',[record]));
});
test('ciphertext corruption is detected before financial records can be displayed',async()=>{
 const f=fixture();await f.sealed.insertMany({},ownerId,[record]);const envelope=JSON.parse(f.state.rows[0].payload.encrypted);envelope.tag=Buffer.alloc(16,1).toString('base64url');f.state.rows[0].payload.encrypted=JSON.stringify(envelope);await assert.rejects(f.sealed.listSavedFinance({},ownerId));
});
test('reviewed financial execution verifies encrypted acknowledgements and duplicate-free rereads',async()=>{
 const {createProviderImportExecutor}=await import('../server/provider-import-executor.mjs'),{planChaseImport}=await import('../server/chase-import-plan.mjs');
 const f=fixture(),connectionId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',selectionId='dddddddd-dddd-4ddd-8ddd-dddddddddddd',actor={sessionBinding:'fixture-private-session'};
 const preview={ownerId,connectionId,selectionId,complete:true,previewOnly:true,databaseWritten:false,provider:'plaid',institution:'Chase',startDate:'2026-11-01',endDateExclusive:'2026-11-08',accounts:[{key:'fixture-key',ownerId,connectionId,provider:'plaid',institution:'Chase',visibility:'private',accountId:'private-account-id',currency:'USD',name:'Private checking name',type:'depository',subtype:'checking',currentMinor:1234567,availableMinor:null,balanceFreshness:'provider-cached'}],transactions:[]};
 const executor=createProviderImportExecutor({repository:f.sealed,planImport:planChaseImport,resolveActor:async()=>({ownerId,sessionBinding:actor.sessionBinding}),authorizeWrite:async()=>true}),args={connectionId,selectionId,preview,selectedKeys:['fixture-key']};
 let review=await executor.prepare(actor,args);assert.equal((await executor.execute(actor,{reviewId:review.reviewId,approved:true})).inserted,1);assert.doesNotMatch(JSON.stringify(f.state.rows),/Private checking name|1234567|private-account-id/);
 review=await executor.prepare(actor,args);assert.equal(review.unchangedCount,1);assert.equal((await executor.execute(actor,{reviewId:review.reviewId,approved:true})).inserted,0);
});
