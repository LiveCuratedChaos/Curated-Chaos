import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultQuickAddLayout,validateQuickAddLayout} from '../src/private-quick-add-layout.mjs';
import {createQuickAddSettings} from '../src/private-quick-add-settings.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';

test('profile defaults accept only supported destinations and boolean field presentation for each type',()=>{
 const base=defaultQuickAddLayout();
 assert.deepEqual(validateQuickAddLayout(base),base);
 for(const [kind,patch] of [['note',{destination:'Work'}],['grocery',{destination:'School'}],['event',{destination:'Gmail'}],['project',{expanded:1}],['task',{source:'secret'}]]){
  assert.throws(()=>validateQuickAddLayout({...base,[kind]:{...base[kind],...patch}}));
 }
});
test('approved Quick Add choices follow the signed-in profile and conflict with concurrent presentation edits',async t=>{
 const app=privateWorkspaceFixture(t,{allowTaskCreate:true,allowQuickAddPreferences:true,allowBriefLayout:true});
 const one=app.tab(),two=app.tab();await one.login();await two.login();
 const a=one.client,b=two.client,old=await a.quickAddLayoutRead(),other=await b.quickAddLayoutRead();
 const layout=old.layout;layout.task={destination:'School',expanded:true};layout.note.expanded=true;
 const first=await a.quickAddLayoutReview({baseTag:old.baseTag,layout}),stale=await b.quickAddLayoutReview({baseTag:other.baseTag,layout});
 assert.deepEqual((await a.quickAddLayoutSave(first.reviewId)).layout,layout);
 await assert.rejects(b.quickAddLayoutSave(stale.reviewId));assert.deepEqual((await b.quickAddLayoutRead()).layout,layout);
 const brief=await b.briefLayoutRead();brief.layout.sections.reverse();const edit=await b.briefLayoutReview({baseTag:brief.baseTag,layout:brief.layout});
 await b.briefLayoutSave(edit.reviewId);assert.deepEqual((await a.quickAddLayoutRead()).layout,layout);
 const off=privateWorkspaceFixture(t,{allowTaskCreate:true}).tab();await off.login();await assert.rejects(off.client.quickAddLayoutRead());
});
test('a cancelled or reset settings panel cannot publish a late choice and never saves when opening a record',async()=>{
 let finishRead,saves=0;const expiry=Date.now()+120000,layout=defaultQuickAddLayout(),client={quickAddLayoutRead:()=>new Promise(r=>finishRead=r),quickAddLayoutSave:()=>{saves++;}};
 const panel=createQuickAddSettings({client,clock:Date.now,enabledKinds:()=>['task','routine'],canUse:()=>true,onChange:()=>{}});
 const read=panel.choice('task');panel.reset();finishRead({readOnly:false,layout,baseTag:'a'.repeat(43),viewId:'b'.repeat(43),expiresAt:expiry});
 assert.equal(await read,undefined);assert.equal(panel.blocked(),false);assert.equal(saves,0);
});
