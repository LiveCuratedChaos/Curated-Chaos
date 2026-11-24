import test from 'node:test';
import assert from 'node:assert/strict';
import {createBriefSnapshotsPanel} from '../src/private-brief-snapshots-panel.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';

const turn=()=>new Promise(resolve=>setImmediate(resolve));

test('private Brief snapshots review server counts, reopen saved captures and review removal',async t=>{
 const fixture=privateWorkspaceFixture(t,{allowBriefLayout:true}),a=fixture.tab(),b=fixture.tab();
 await assert.rejects(a.client.briefSnapshotsRead());
 await a.login();await b.login();
 const first=await a.client.briefSnapshotsRead();
 assert.deepEqual(first.layout.items,[]);
 const review=await a.client.briefSnapshotsReview(first.baseTag);
 const [entry]=review.layout.items;
 assert.equal(review.layout.items.length,1);
 assert.deepEqual(Object.keys(entry).sort(),['capturedAt','counts','day']);
 assert.ok(Object.values(entry.counts).every(Number.isInteger));
 assert.doesNotMatch(JSON.stringify(entry),/Fictional|Token|owner|title/i);
 assert.deepEqual((await b.client.briefSnapshotsRead()).layout.items,[]);
 await assert.rejects(b.client.briefSnapshotsSave(review.reviewId));
 await a.client.briefSnapshotsSave(review.reviewId);
 await assert.rejects(a.client.briefSnapshotsSave(review.reviewId));
 const reopened=await b.client.briefSnapshotsRead();
 assert.deepEqual(reopened.layout.items,[entry]);
 await assert.rejects(b.client.briefSnapshotsReview(reopened.baseTag));
 const remove=await b.client.briefSnapshotsReview(reopened.baseTag,entry.day);
 assert.deepEqual(remove.layout.items,[]);
 await b.client.briefSnapshotsSave(remove.reviewId);
 assert.deepEqual((await a.client.briefSnapshotsRead()).layout.items,[]);
});

test('snapshot panel reviews and approves through the authenticated app client',async t=>{
 const fixture=privateWorkspaceFixture(t,{allowBriefLayout:true}),tab=fixture.tab();
 await tab.login();
 const panel=createBriefSnapshotsPanel({client:tab.client,canUse:()=>true,onChange:()=>{}});
 t.after(()=>panel.reset());
 const click=async action=>{
  panel.click({target:{closest:()=>({dataset:{briefSnapshot:action}})}});
  for(let i=0;i<4;i++)await turn();
 };
 await click('open');await click('capture');
 assert.match(panel.render(),/Approve snapshot save/);
 await click('approve');
 assert.match(panel.render(),/<details>/);
 assert.doesNotMatch(panel.render(),/Approve snapshot save|Fictional planning note/);
});

test('snapshot routes require reviewed Brief layout scope',async t=>{
 const tab=privateWorkspaceFixture(t).tab();await tab.login();
 await assert.rejects(tab.client.briefSnapshotsRead(),/route not available/);
});
