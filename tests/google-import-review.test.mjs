import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleImportReview} from '../server/google-import-review.mjs';
import {createTokenSealer} from '../server/token-sealer.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',selectionId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function fixture(){
 const state={valid:true,current:true,time:100,loads:0};
 const service=createGoogleImportReview({sealer:createTokenSealer(Buffer.alloc(32,7)),now:()=>state.time,confirmSession:async()=>state.valid,connectionStore:{loadSelected:async()=>{state.loads++;if(!state.current)throw Error('Changed selection');}}});
 const preview={previewOnly:true,persisted:false,selectionId,result:{provider:'gmail',ownerId,connectionId,complete:true,content:'metadata-only',messages:[{key:'fictional-key',ownerId,connectionId,provider:'gmail',visibility:'private',messageId:'fixture-id',threadId:'fixture-thread',subject:'Fictional subject',sender:'fixture@example.test',receivedAt:'2026-11-03T12:00:00Z'}]}};
 const saved=service.remember({ownerId,binding:'fixture-session',connectionId,preview});
 return {service,state,args:{ownerId,binding:'fixture-session',previewId:saved.previewId,selectedKeys:['fictional-key']}};
}
test('review accepts only selected cached items and never executes or compares database records',async()=>{
 const f=fixture(),result=await f.service.review(f.args);assert.equal(result.selectedCount,1);assert.equal(result.executed,false);assert.equal(result.databaseCompared,false);assert.equal(result.requiresApproval,true);assert.doesNotMatch(JSON.stringify(result),/Fictional subject|fixture@example/);
 assert.equal((await f.service.review({...f.args,selectedKeys:[]})).selectedCount,0);
 await assert.rejects(f.service.review({...f.args,selectedKeys:['browser-invented-key']}));
});
test('review rejects another session, owner, expired preview and signed-out session',async()=>{
 for(const change of [{binding:'other-session'},{ownerId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}]){const f=fixture();await assert.rejects(f.service.review({...f.args,...change}));}
 const expired=fixture();expired.state.time+=300000;await assert.rejects(expired.service.review(expired.args));
 const ended=fixture();ended.state.valid=false;await assert.rejects(ended.service.review(ended.args));
});
test('changed or paused selections and forgotten sessions cannot be reviewed',async()=>{
 const f=fixture();f.state.current=false;await assert.rejects(f.service.review(f.args),/Changed selection/);
 const g=fixture();g.service.forgetSession(g.args.binding);await assert.rejects(g.service.review(g.args));assert.equal(g.state.loads,0);
});
