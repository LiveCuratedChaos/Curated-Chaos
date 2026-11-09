import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleSourcePreview} from '../server/google-source-preview.mjs';
import {GMAIL_READ_SCOPE} from '../server/gmail.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',selectionId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function fixture(){
 const state={valid:true,reads:0,refreshes:0,loads:0,change:false,revokeOnRead:false};
 const preview=createGoogleSourcePreview({confirmSession:async()=>state.valid,refreshAccessToken:async()=>{state.refreshes++;return 'fixture-access';},connectionStore:{loadSelected:async()=>{
  state.loads++;if(state.change&&state.loads>1)throw Error('Changed selection');
  return {provider:'gmail',scope:GMAIL_READ_SCOPE,credentials:{refreshToken:'fixture-refresh'},selection:{timeMin:'2026-11-01T00:00:00.000Z',timeMax:'2026-11-08T00:00:00.000Z',labelIds:['INBOX']}};
 }},fetcher:async()=>{state.reads++;if(state.revokeOnRead)state.valid=false;return {ok:true,json:async()=>({messages:[]})};}});
 return {state,preview,args:{ownerId,connectionId,selectionId,binding:'fixture-binding',confirmed:true}};
}
test('preview requires explicit approval and session before refreshing or reading',async()=>{
 const f=fixture();await assert.rejects(f.preview({...f.args,confirmed:false}));assert.equal(f.state.refreshes,0);
 f.state.valid=false;await assert.rejects(f.preview(f.args));assert.equal(f.state.reads,0);
});
test('preview reads the stored bounded selection without returning credentials or persisting data',async()=>{
 const f=fixture(),data=await f.preview(f.args);assert.equal(data.previewOnly,true);assert.equal(data.persisted,false);assert.equal(data.result.complete,true);assert.equal(f.state.loads,3);assert.equal(f.state.reads,1);assert.doesNotMatch(JSON.stringify(data),/fixture-access|fixture-refresh/);
});
test('changed selection or ended session rejects a completed preview',async()=>{
 const f=fixture();f.state.change=true;await assert.rejects(f.preview(f.args),/Changed selection/);
 const g=fixture();g.state.revokeOnRead=true;await assert.rejects(g.preview(g.args),/App session ended/);assert.equal(g.state.reads,1);
});
