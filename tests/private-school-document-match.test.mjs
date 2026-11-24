import test from 'node:test';
import assert from 'node:assert/strict';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {schoolGuidePdf} from './fixtures/school-guide-pdf.mjs';
import {schoolDocumentEvidence} from '../server/private-school-document-match.mjs';
import {createDocumentPanel} from '../src/private-document-panel.mjs';

const access={allowDocuments:true,allowSchoolRead:true,allowSchoolEdit:true};
const lines=[['Introduction'],['Course syllabus','Course code: F1']];
const parsed=pages=>({status:'ready',pages,methods:pages.map(()=>'text')});
async function setup(t,enabled=access,pages=lines){
 const app=privateWorkspaceFixture(t,enabled),a=app.tab(),b=app.tab();await a.login();await b.login();
 const bytes=schoolGuidePdf(pages);await a.client.documentList(0);
 const p=await a.client.documentReview({name:'Guide.pdf',folder:'',tags:[],mime:'application/pdf',bytes:bytes.length},bytes.toString('base64'));
 await a.client.documentSave(p.reviewId);return {a:a.client,b:b.client,bytes};
}
async function text(client){
 const doc=(await client.documentList(0)).documents[0];
 const read=await client.documentText(doc.choice,1,'');return {doc,read};
}
test('School link evidence requires one exact guide heading and anchored subject on the same page',()=>{
 const proof=schoolDocumentEvidence(parsed(['Other page','Course syllabus\nProgram: Degree A\nCourse code: F1']));
 assert.deepEqual(proof,{kind:'syllabus',heading:'Course syllabus',type:'course',subject:'f1',quote:'Course code: F1',page:2,method:'text'});
 for(const pages of [['Course guide','Course code: F1'],['Course guide\nCourse code: F1','Course code: F2'],['Course guide\nCourse code: F1','Syllabus'],['A syllabus about F1'],['Program guide\nCourse code: F1']])
  assert.equal(schoolDocumentEvidence(parsed(pages)),null);
 assert.equal(schoolDocumentEvidence(parsed(['Program guide\nProgram: Fictional learning program'])).kind,'program');
 assert.equal(schoolDocumentEvidence({status:'ready',pages:['Course guide\nCourse code: F1',''],methods:['text','unavailable']}),null);
});
test('document-originated approved link reuses the same original in School Library and refuses duplicate and cross-session approval',async t=>{
 const {a,b,bytes}=await setup(t);const {doc,read}=await text(a);
 if(read.status!=='ready'){assert.equal(process.platform==='darwin',false);return;}
 const suggestion=await a.documentSchoolMatch(doc.choice);assert.equal(suggestion.status,'ready');assert.equal(suggestion.number,1);assert.equal(suggestion.page,2);assert.equal(suggestion.program,'Fictional learning program');
 assert.doesNotMatch(JSON.stringify(suggestion),/recordId|documentId|schoolReadToken/);
 const {doc:other}=await text(b),competing=await b.documentSchoolMatch(other.choice);
 await assert.rejects(b.documentSchoolMatchSave(suggestion.reviewId));
 assert.deepEqual(await a.documentSchoolMatchSave(suggestion.reviewId),{saved:true});
 await assert.rejects(a.documentSchoolMatchSave(suggestion.reviewId));await assert.rejects(b.documentSchoolMatchSave(competing.reviewId));
 assert.deepEqual(await a.documentSchoolMatch(doc.choice),{status:'linked'});
 const overview=await a.schoolOverview(),course=overview.courses.find(c=>c.code==='F1'),view=await a.schoolLibraryOpen(course.schoolReadToken);
 assert.deepEqual(view.history.map(r=>[r.kind,r.number]),[['syllabus',1]]);
 assert.deepEqual(Buffer.from((await a.schoolGuideDownload(view.viewId,view.history[0].choice)).data,'base64'),bytes);
});
test('fresh school lookup refuses a new ambiguous course code or changed document metadata before a suggested link is approved',async t=>{
 const {a,b}=await setup(t),{doc,read}=await text(a);if(read.status!=='ready'){assert.equal(process.platform==='darwin',false);return;}
 const review=await a.documentSchoolMatch(doc.choice);
 const overview=await b.schoolOverview(),second=overview.courses.find(c=>c.code==='F2');
 const edit=await b.schoolEditRead(second.schoolReadToken),change=await b.schoolEditReview({editToken:edit.editToken,fields:{...edit.fields,code:'F1'}});await b.schoolEditSave(change.reviewId);
 await assert.rejects(a.documentSchoolMatchSave(review.reviewId));assert.deepEqual(await a.documentSchoolMatch(doc.choice),{status:'ambiguous'});
 const list=await b.documentList(0),rename=await b.documentOrganize(list.documents[0].choice,{name:'Changed.pdf',tags:[],folder:''});await b.documentSave(rename.reviewId);
 await assert.rejects(a.documentSchoolMatch(doc.choice));
});
test('School links remain unavailable with document-only or read-only School access',async t=>{
 const {a}=await setup(t,{allowDocuments:true,allowSchoolRead:true}),{doc}=await text(a);await assert.rejects(a.documentSchoolMatch(doc.choice));
});
test('document screen shows the matched program and source quotation before linking the selected file',async t=>{
 const {a}=await setup(t,access,[['Program guide','Program: Fictional learning program']]);let finish;
 const panel=createDocumentPanel({client:a,allowSchoolLinks:true,onChange:()=>finish?.()});t.after(()=>panel.reset());
 async function click(value,done){
  const promise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Document screen did not settle')),5000);
   finish=()=>{if(done(panel.render())){clearTimeout(timer);resolve();}};});
  panel.click({target:{closest:q=>q==='[data-document-action]'?{dataset:{documentAction:value}}:null}});await promise;
 }
 await click('open',h=>h.includes('text-open-'));await click(panel.render().match(/data-document-action="(text-open-[^"]+)"/)[1],h=>h.includes('text-back'));
 if(process.platform!=='darwin'){assert.doesNotMatch(panel.render(),/Check for a School link/);return;}
 await click('text-school',h=>h.includes('Approve guide link'));
 assert.match(panel.render(),/Version 1/);assert.match(panel.render(),/Page 1 · <q>Program guide<\/q> · <q>Program: Fictional learning program/);
 await click('text-school-save',h=>h.includes('Guide linked to Fictional learning program'));
 const overview=await a.schoolOverview(),view=await a.schoolLibraryOpen(overview.programs[0].schoolReadToken);
 assert.equal(view.history[0].kind,'program');
});
