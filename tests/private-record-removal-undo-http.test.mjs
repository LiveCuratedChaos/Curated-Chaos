import test from 'node:test';
import assert from 'node:assert/strict';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';

async function setup(t,options={}){
 const fixture=privateWorkspaceFixture(t,{allowRecentlyDeleted:true,...options});
 const tab=fixture.tab();
 await tab.client.status();await tab.login();
 const remove=async(target,offerUndo=true)=>{
  const review=await tab.client.reviewRecord(target.recordToken);
  return tab.client.saveRecord(review.reviewId,{offerUndo});
 };
 return {tab,fixture,remove};
}

test('confirmed note removal can be undone through the original restore approval after the Brief refresh',async t=>{
 const {tab,fixture,remove}=await setup(t),source=(await tab.client.brief()).notes[0];
 const ack=await remove(source);
 assert.deepEqual(Object.keys(ack.undo).sort(),['deletedAt','expiresAt','recordToken']);
 assert.match(ack.undo.recordToken,/^[A-Za-z0-9_-]{43}$/);
 assert.equal((await tab.client.brief()).notes.length,0);
 const other=fixture.tab();await other.client.status();await other.login();
 await assert.rejects(other.client.reviewRecord(ack.undo.recordToken));
 const restore=await tab.client.reviewRecord(ack.undo.recordToken);
 assert.equal(restore.title,source.title);assert.equal(restore.restoring,true);
 assert.equal((await other.client.brief()).notes.length,0);
 assert.deepEqual(await tab.client.saveRecord(restore.reviewId,{offerUndo:true}),{saved:true,restored:true});
 assert.equal((await tab.client.brief()).notes[0].title,source.title);
 await assert.rejects(tab.client.reviewRecord(ack.undo.recordToken));
});

test('a new removal replaces the old Undo, and legacy callers receive the original acknowledgment',async t=>{
 const {tab,remove}=await setup(t);
 const first=await remove((await tab.client.brief()).notes[0]);
 const second=await remove((await tab.client.brief()).dueTasks[0]);
 await assert.rejects(tab.client.reviewRecord(first.undo.recordToken));
 assert.equal((await tab.client.reviewRecord(second.undo.recordToken)).type,'task');
 await tab.client.cancelRecord();
 await assert.rejects(tab.client.reviewRecord(second.undo.recordToken));
 const legacy=await remove((await tab.client.brief()).eventsToday[0],false);
 assert.deepEqual(legacy,{saved:true,restored:false});
});

test('Undo for duplicate note titles restores the selected body and refuses a later deletion of the same note',async t=>{
 const {tab,fixture,remove}=await setup(t,{allowNoteRead:true,allowNoteCreate:true});
 const original=(await tab.client.brief()).notes[0],newBody='Fictional second copy with the same title';
 const draft=await tab.client.reviewNewNote({title:original.title,body:newBody});
 await tab.client.createNote(draft.reviewId);
 async function matching(client){
  const rows=(await client.brief()).notes.filter(row=>row.title===original.title);
  const result=[];
  for(const row of rows)result.push({...row,body:(await client.readNote(row.noteToken)).body});
  return result;
 }
 const both=await matching(tab.client);
 assert.equal(both.length,2);
 const duplicate=both.find(note=>note.body===newBody);
 const ack=await remove(duplicate);
 assert.deepEqual((await matching(tab.client)).map(note=>note.body),both.filter(note=>note.body!==newBody).map(note=>note.body));
 const other=fixture.tab();await other.client.status();await other.login();
 const list=await other.client.deletedRecords(0);
 const restore=await other.client.reviewRecord(list.records[0].recordToken);
 await other.client.saveRecord(restore.reviewId);
 assert.ok((await matching(other.client)).some(note=>note.body===newBody));
 const changed=(await matching(other.client)).find(note=>note.body===newBody);
 const secondDeletion=await other.client.reviewRecord(changed.recordToken);
 await other.client.saveRecord(secondDeletion.reviewId);
 await assert.rejects(tab.client.reviewRecord(ack.undo.recordToken));
 assert.equal((await matching(tab.client)).length,1);
});

test('sign-out invalidates an unused Undo selection before a later sign-in',async t=>{
 const {tab,remove}=await setup(t);
 const ack=await remove((await tab.client.brief()).notes[0]);
 await tab.client.signOut();await tab.client.status();await tab.login();
 await assert.rejects(tab.client.reviewRecord(ack.undo.recordToken));
 assert.equal((await tab.client.deletedRecords(0)).matchCount,1);
});
