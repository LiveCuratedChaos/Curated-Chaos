import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {schoolGuidePdf} from './fixtures/school-guide-pdf.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createDocumentPanel} from '../src/private-document-panel.mjs';
import {verifyDocumentText,renderDocumentText} from '../src/private-document-text.mjs';
import {extractDocumentPages} from '../server/private-document-extraction.mjs';

const bytes=schoolGuidePdf([['Fictional cover'],['Semester reference'],['SEMESTER archive']]);
const fields={name:'Term.pdf',bytes:bytes.length,mime:'application/pdf',folder:'School',tags:[]};
async function uploaded(t){
 const app=privateWorkspaceFixture(t,{allowDocuments:true}),a=app.tab(),b=app.tab();await a.login();await b.login();
 await a.client.documentList(0);const review=await a.client.documentReview(fields,bytes.toString('base64'));await a.client.documentSave(review.reviewId);
 const page=await a.client.documentList(0);return {a:a.client,b:b.client,choice:page.documents[0].choice};
}
test('selected original text supports page navigation and private exact-file search, expires with the view and refuses changed metadata',async t=>{
 const {a,b,choice}=await uploaded(t);
 await b.documentList(0);await assert.rejects(b.documentText(choice,1,''));
 const result=await a.documentText(choice,1,'semester');
 if(process.platform!=='darwin'){assert.deepEqual(result,{name:'Term.pdf',status:'unavailable'});return;}
 assert.deepEqual(result.matches,[2,3]);assert.equal(result.text,'Fictional cover');assert.equal(result.pages,3);assert.deepEqual(result.unreadPages,[]);
 assert.doesNotMatch(JSON.stringify(result),/SEMESTER archive|Semester reference|owner_id|documentId|file_envelope/);
 assert.match((await a.documentText(choice,3,'semester')).text,/SEMESTER archive/);
 await assert.rejects(a.documentText(choice,4,''));await assert.rejects(a.documentText(choice,1,'a'.repeat(151)));
 const other=(await b.documentList(0)).documents[0],rename=await b.documentOrganize(other.choice,{name:'Renamed.pdf',folder:'',tags:[]});
 await b.documentSave(rename.reviewId);await assert.rejects(a.documentText(choice,1,''));await a.documentClose();await assert.rejects(a.documentText(choice,1,''));
});
test('library screen searches across pages, selects a matching page and closes the extracted text',async t=>{
 const {a}=await uploaded(t);let finish;
 const panel=createDocumentPanel({client:a,onChange:()=>finish?.()});t.after(()=>panel.reset());
 async function click(action){
  const done=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Panel did not finish')),5000);finish=()=>{if(!panel.blocked()){clearTimeout(timer);resolve();}};});
  panel.click({target:{closest:q=>q==='[data-document-action]'?{dataset:{documentAction:action}}:null}});await done;
 }
 await click('open');await click(panel.render().match(/data-document-action="(text-open-[^"]+)"/)[1]);
 if(process.platform!=='darwin'){assert.match(panel.render(),/unavailable on this host/);return;}
 assert.match(panel.render(),/Page 1 of 3/);
 panel.input({target:{dataset:{documentField:'textQuery'},value:'semester'}});await click('text-find');
 assert.match(panel.render(),/Matching pages/);await click('text-page-3');assert.match(panel.render(),/SEMESTER archive/);
 await click('text-back');assert.doesNotMatch(panel.render(),/SEMESTER archive/);
});
test('image recognition uses a bounded local raster or reports its unavailable state truthfully',async t=>{
 if(process.platform!=='darwin'){assert.equal((await extractDocumentPages(bytes,{recognize:true})).status,'unavailable');return;}
 const dir=await mkdtemp(join(tmpdir(),'cc-doc-text-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const original=join(dir,'sample.pdf'),png=join(dir,'sample.png');
 await writeFile(original,schoolGuidePdf([['FICTIONAL SCHOOL GUIDE']]));
 execFileSync('/usr/bin/sips',['-s','format','png',original,'--out',png],{stdio:'ignore'});
 const result=await extractDocumentPages(await readFile(png),{mime:'image/png',recognize:true});
 if(result.status==='ready'){assert.equal(result.methods[0],'ocr');assert.match(result.pages[0],/fictional/i);}
 else assert.deepEqual(result,{status:'unavailable'});
});
test('unreadable pages are visibly excluded from search and text is escaped in the rendered page',()=>{
 const sample={status:'ready',name:'File',page:1,pages:2,method:'text',text:'<example>',query:'sample',matches:[],unreadPages:[2]};
 assert.equal(verifyDocumentText(sample,'File',1,'sample'),sample);const html=renderDocumentText(sample,'sample',()=>'<button></button>');
 assert.match(html,/could not read page 2/);assert.match(html,/&lt;example&gt;/);assert.doesNotMatch(html,/<example>/);
 assert.throws(()=>verifyDocumentText({...sample,matches:[2]},'File',1,'sample'));
});
