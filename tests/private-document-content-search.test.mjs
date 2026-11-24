import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentLibrary} from '../server/private-document-library.mjs';
import {createDocumentFixture} from '../tools/document-library-fixture.mjs';
import {createDocumentPanel} from '../src/private-document-panel.mjs';
import {appendContentResults} from '../src/private-document-content-search.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {schoolGuidePdf} from './fixtures/school-guide-pdf.mjs';

const actor={ownerId:'fictional-owner'},other={ownerId:'other-fictional-owner'};
const fields=(name,len)=>({name,folder:'',tags:[],mime:'application/pdf',bytes:len});
async function insert(storage,actor,name,bytes){
 const doc=await storage.prepare(actor,fields(name,bytes.length),bytes.toString('base64'));
 return (await storage.save(actor,doc.row)).document;
}
test('private full-text search uses current owner originals, paginates 25 matching files and never returns their text in a hit',async t=>{
 const store=createDocumentFixture();let instant=Date.now();const extract=async bytes=>({status:'ready',methods:['text','text'],pages:['private excerpt',bytes.toString().includes('source')?'Needle secret':'other']});
 const library=createDocumentLibrary({storage:store,now:()=>instant,extract});t.after(()=>library.dispose());
 for(let i=0;i<27;i++)await insert(store,actor,'Document '+i+'.pdf',Buffer.from('%PDF-source '+i));
 await insert(store,other,'Hidden.pdf',Buffer.from('%PDF-source hidden'));
 await library.list('signed',actor,0,instant+300000);const q={query:'NEEDLE',continuation:null,direction:'first'};
 let batch=await library.searchContents('signed',actor,q);const first=batch.documents[0];let matches=0;
 for(;;){
  assert.doesNotMatch(JSON.stringify(batch),/private excerpt|Needle secret|Hidden|ownerId|content_key|file_envelope/);
  assert.ok(batch.scanned<=2);for(const hit of batch.documents)assert.deepEqual(hit.pages,[2]);matches+=batch.documents.length;
  if(matches===25)break;const next={...q,continuation:batch.continuation,direction:'next'};
  batch=await library.searchContents('signed',actor,next);await assert.rejects(library.searchContents('signed',actor,next));
 }
 assert.equal((await library.readText('signed',actor,{choice:first.choice,page:2,query:'needle'})).text,'Needle secret');
 await assert.rejects(library.searchContents('signed',other,{...q,continuation:batch.continuation,direction:'more'}));
 batch=await library.searchContents('signed',actor,{...q,continuation:batch.continuation,direction:'more'});assert.equal(batch.documents.length,2);assert.equal(batch.continuation,null);
 await assert.rejects(library.readText('signed',actor,{choice:first.choice,page:2,query:'needle'}));
 instant+=300001;await assert.rejects(library.readText('signed',actor,{choice:batch.documents[0].choice,page:2,query:'needle'}));
});
test('partial extraction is reported and changed or cancelled files cannot return a stale match',async t=>{
 const storage=createDocumentFixture(),doc=await insert(storage,actor,'Changed.pdf',Buffer.from('%PDF-test'));
 let hook=()=>{};const lib=createDocumentLibrary({storage,extract:async()=>{await hook();return {status:'ready',methods:['text','unavailable'],pages:['Example','']};}});t.after(()=>lib.dispose());
 const q={query:'example',direction:'first',continuation:null},open=()=>lib.list('s',actor,0,Date.now()+300000);
 await open();const first=await lib.searchContents('s',actor,q);assert.equal(first.incomplete,1);assert.deepEqual(first.documents[0].pages,[1]);
 hook=async()=>storage.saveEdit(actor,await storage.prepareEdit(actor,doc,{name:'Revised.pdf',tags:[],folder:''}));
 await assert.rejects(lib.searchContents('s',actor,q));await assert.rejects(lib.readText('s',actor,{choice:first.documents[0].choice,page:1,query:''}));
 await open();hook=()=>lib.clear('s');await assert.rejects(lib.searchContents('s',actor,q));
});
test('a query from main search checks all saved files, displays only matching page buttons and opens an original PDF page',async t=>{
 const f=privateWorkspaceFixture(t,{allowDocuments:true}),tab=f.tab();await tab.login();const a=tab.client;
 for(let i=0;i<4;i++){
  const bytes=schoolGuidePdf([['Cover '+i],[i===3?'Fictional reference 4321':'Other text '+i]]);
  await a.documentList(0);const r=await a.documentReview(fields('File '+i+'.pdf',bytes.length),bytes.toString('base64'));await a.documentSave(r.reviewId);
 }
 let resolveClick;const panel=createDocumentPanel({client:a,onChange:()=>{if(!panel.blocked())resolveClick?.();}});t.after(()=>panel.reset());
 await panel.openContentSearch('REFERENCE 4321');const result=panel.render();assert.match(result,/4 files checked/);
 if(process.platform!=='darwin'){assert.match(result,/4 files could only be searched/);return;}
 assert.match(result,/File 3.pdf/);assert.doesNotMatch(result,/File 2.pdf|Fictional reference/);
 const action=result.match(/data-document-action="(content-page-[^"]+-2)"/)[1];
 const done=new Promise(r=>{resolveClick=r;});panel.click({target:{closest:()=>({dataset:{documentAction:action}})}});await done;
 assert.match(panel.render(),/Page 2 of 2/);assert.match(panel.render(),/Fictional reference 4321/);
});
test('content search refuses malformed replies and does not reuse a cancelled result',async()=>{
 let returned,started;const start=new Promise(r=>{started=r;}),answer=new Promise(r=>{returned=r;});
 const expiry=Date.now()+60000,client={documentList:async()=>({documents:[],offset:0,hasMore:false,expiresAt:expiry}),searchDocumentContents:()=>{started();return answer;},documentClose:async()=>({closed:true})};
 const panel=createDocumentPanel({client});const job=panel.openContentSearch('private');await start;
 assert.match(panel.render(),/Stop content search/);
 panel.click({target:{closest:()=>({dataset:{documentAction:'content-stop'}})}});returned({bad:true});await job;
 assert.doesNotMatch(panel.render(),/No matches|private|found file/);
 assert.throws(()=>appendContentResults({query:'x',hits:[]},{query:'x'},expiry));panel.reset();
});

const documentShortcutScope={allowDocuments:true,allowSavedSearches:true,allowSearch:true,allowTaskPriorityLists:true,allowSearchDates:true,allowUndatedTasks:true,allowTaskCreate:true,allowTaskRead:true,allowTaskDescriptionEdit:true,allowTaskEdit:true,allowTaskCompletion:true,allowTaskReopen:true};
test('reviewed document shortcuts store only the criteria and rerun against fresh file contents and collections',async t=>{
 const f=privateWorkspaceFixture(t,documentShortcutScope),tab=f.tab();await tab.login();const client=tab.client;
 await client.documentList(0);await assert.rejects(client.documentSearchOffer());
 let offered=null,complete;
 const panel=createDocumentPanel({client,onNameSearch:(offer,expected)=>{assert.deepEqual(offer.filters,expected);offered=offer;return true;},onChange:()=>{if(!panel.blocked())complete?.();}});t.after(()=>panel.reset());
 const name=async(label,filters)=>{
  assert.match(panel.render(),/Name this document search/);const done=new Promise(r=>{complete=r;});
  panel.click({target:{closest:()=>({dataset:{documentAction:'name-search'}})}});await done;complete=null;
  assert.deepEqual(offered.filters,filters);
  const r=await client.reviewSavedSearch({action:'create',name:label,saveSearchToken:offered.saveSearchToken});
  assert.deepEqual(r.filters,filters);assert.deepEqual(await client.saveSavedSearch(r.reviewId),{saved:true,action:'create'});
 };
 const term='Fictional reference 4321',textFilters={type:'document-text',query:term},metaFilters={type:'document-library',query:'Guide',collection:'pdf'};
 await panel.openContentSearch(term);await name('Guide contents',textFilters);
 await panel.openSavedSearch(metaFilters);await name('Guide collection',metaFilters);
 const items=(await client.savedSearches()).records;assert.equal(items.length,2);assert.doesNotMatch(JSON.stringify(items),/continuation|documentId|Reference page|file_envelope|documents":/);
 const open=async label=>{const rows=(await client.savedSearches()).records;const saved=await client.loadSavedSearch(rows.find(r=>r.name===label).savedSearchToken);await panel.openSavedSearch(saved.filters);};
 const bytes=schoolGuidePdf([['Cover'],[term]]);await client.documentList(0);
 const review=await client.documentReview(fields('Guide.pdf',bytes.length),bytes.toString('base64'));await client.documentSave(review.reviewId);
 await open('Guide collection');assert.match(panel.render(),/Guide.pdf/);
 await open('Guide contents');assert.match(panel.render(),/1 files? checked/);if(process.platform==='darwin')assert.match(panel.render(),/Guide.pdf/);
 await client.documentClose();await assert.rejects(client.documentSearchOffer());
});

test('document shortcut contracts preserve long literal queries, distinct collections and reject result data',async()=>{
 const {savedSearchFilters}=await import('../server/private-saved-searches.mjs');
 const {validSavedSearchFilters,savedSearchSummary}=await import('../src/private-saved-search-panel.mjs');
 const long={type:'document-text',query:'x'.repeat(150)};assert.deepEqual(savedSearchFilters(long),long);assert.equal(validSavedSearchFilters(long),true);
 assert.match(savedSearchSummary(long),/File contents/);
 for(const value of [{...long,query:''},{...long,query:'x'.repeat(151)},{...long,choice:'file'},{...long,pages:[1]},{...long,query:'test\n'},{type:'document-library',query:'ok',collection:'bogus'}]){
  assert.throws(()=>savedSearchFilters(value));assert.equal(validSavedSearchFilters(value),false);
 }
});
