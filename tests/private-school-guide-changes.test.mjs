import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {extractDocumentPages} from '../server/private-document-extraction.mjs';
import {proposeGuideChanges,schoolGuideChanges} from '../src/private-school-guide-changes.mjs';
import {schoolGuidePdf} from './fixtures/school-guide-pdf.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createIsolatedDevelopmentDatabase,actor,identities} from './fixtures/isolated-development-database.mjs';
import {createSchoolLibraryPanel} from '../src/private-school-library-panel.mjs';

const date='2026-11-22T12:00:00.123Z',scope={allowSchoolRead:true,allowSchoolEdit:true,allowDocuments:true};
const guide={kind:'course',documentId:randomUUID(),addedAt:date};
const payload={fictional:true,source:'M2E_SCHOOL_QA',kind:'course',code:'F1',title:'Fictional course 1',credits:3,officialOrder:1,studyOrder:2,guideDocuments:[guide]};
test('guide proposal requires an unambiguous matching source and quoted value, deduplicates evidence, and excludes order and grades',()=>{
 const pages=['Course code: F5\nCredits: 8','Course code: F1\nCredit hours: 4\nOfficial order: 5\nStatus: Completed','Course code: F1\nCredits: 4'];
 const [change]=proposeGuideChanges(payload,guide,pages);
 assert.deepEqual(change,{documentId:guide.documentId,kind:'course',field:'credits',before:3,after:4,page:2,anchor:'Course code: F1',quote:'Credit hours: 4'});
 for(const text of ['Credits: 4','Course code: F1\nCredits: 4\nCredits: 5','Course code: F1\nCredits: 4\nCourse code: F2','Course code: F1\nCredits: 32'])
  assert.deepEqual(proposeGuideChanges(payload,guide,[text]),[]);
 assert.deepEqual(proposeGuideChanges({...payload,guideChanges:[change]},guide,pages),[]);
 assert.deepEqual(proposeGuideChanges({...payload,guideDocuments:[guide,{...guide,documentId:randomUUID()}]},guide,pages),[]);
 assert.throws(()=>schoolGuideChanges({...payload,guideChanges:[{...change,quote:'Credits: 7'}]}));
 const program={...guide,kind:'program'},degree={kind:'degree',title:'Fictional degree',totalTerms:4,totalCredits:30,guideDocuments:[program]};
 assert.deepEqual(proposeGuideChanges(degree,program,['Program: Fictional degree\nTotal terms: 5\nTotal credits: 34.5']).map(c=>[c.field,c.after]),[['totalCredits',34.5],['totalTerms',5]]);
});
const bytes=schoolGuidePdf([['General introduction'],['Course code: F1','Credit hours: 4']]);
test('platform reader extracts distinct PDF pages locally or returns an explicit manual fallback',async()=>{
 assert.deepEqual(await extractDocumentPages(bytes,{platform:'linux'}),{status:'unavailable'});
 assert.deepEqual(await extractDocumentPages(Buffer.from('not a PDF')),{status:'unreadable'});
 if(process.platform==='darwin'){
  const result=await extractDocumentPages(bytes);assert.equal(result.status,'ready');assert.equal(result.pages.length,2);
  assert.match(result.pages[1],/Course code: F1\s+Credit hours: 4/);
  assert.deepEqual(await extractDocumentPages(Buffer.from('%PDF-no valid pages')),{status:'unreadable'});
 }
});
async function open(client){
 const overview=await client.schoolOverview(),course=overview.courses.find(c=>c.code==='F1');
 return {course,view:await client.schoolLibraryOpen(course.schoolReadToken)};
}
async function attach(client,name,content){
 await client.documentList(0);
 const proposal=await client.documentReview({name,folder:'School',tags:[],bytes:content.length,mime:'application/pdf'},content.toString('base64'));
 await client.documentSave(proposal.reviewId);
 const {view}=await open(client),file=view.files.find(f=>f.name===name);
 const review=await client.schoolGuideReview(view.viewId,file.choice,'course');await client.schoolGuideSave(view.viewId,review.reviewId);
}
test('signed-in guide review retains original page evidence, gates the approved field on the selected current file and refuses replay',async t=>{
 const app=privateWorkspaceFixture(t,scope),a=app.tab(),b=app.tab();await a.login();await b.login();await attach(a.client,'Guide.pdf',bytes);
 const left=await open(a.client),right=await open(b.client);
 const preview=await a.client.schoolGuideInspect(left.view.viewId,left.view.history[0].choice);
 if(process.platform!=='darwin'){assert.equal(preview.status,'unavailable');assert.equal(left.course.credits,3);return;}
 const [choice]=preview.changes;assert.equal(choice.quote,'Credit hours: 4');assert.equal(choice.page,2);
 const competing=await b.client.schoolGuideInspect(right.view.viewId,right.view.history[0].choice);
 assert.deepEqual((await a.client.schoolRead({schoolReadToken:left.course.schoolReadToken})).credits,3);
 assert.doesNotMatch(JSON.stringify(preview),/documentId|owner_id|General introduction/);
 await assert.rejects(b.client.schoolGuideApply(left.view.viewId,choice.choice));
 assert.deepEqual(await a.client.schoolGuideApply(left.view.viewId,choice.choice),{saved:true});
 await assert.rejects(a.client.schoolGuideApply(left.view.viewId,choice.choice));
 await assert.rejects(b.client.schoolGuideApply(right.view.viewId,competing.changes[0].choice));
 const fresh=await open(a.client);assert.equal(fresh.course.credits,4);assert.equal(fresh.course.studyOrder,left.course.studyOrder);
 const history=await a.client.schoolGuideInspect(fresh.view.viewId,fresh.view.history[0].choice);
 assert.equal(history.applied[0].page,2);assert.deepEqual(history.changes,[]);
 await attach(a.client,'Revised.pdf',schoolGuidePdf([['Course code: F1','Credits: 5']]));
 const newer=await open(a.client);
 const past=await a.client.schoolGuideInspect(newer.view.viewId,newer.view.history[0].choice);
 assert.equal(past.status,'historical');assert.equal(past.applied.length,1);assert.deepEqual(past.changes,[]);
});
test('SQL applies one source-bound change and its evidence together and refuses wrong owners, file revisions, unsupported fields and mismatched quotes',async t=>{
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());
 const {a,b,sa,sb}=identities;await actor(db,a,sa);const id=randomUUID();
 await db.query("insert into public.cc_private_documents(owner_id,id,content_key,metadata,file_envelope) values($1,$2,$3,'test metadata','test envelope')",[a,guide.documentId,'a'.repeat(64)]);
 await db.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values($1,$2,'private','School','school_fixture','M2E_SCHOOL_QA',$3)",[id,a,payload]);
 const [change]=proposeGuideChanges(payload,guide,['Course code: F1\nCredits: 4']);
 const call=(revision,docVersion,patch)=>db.query('select * from public.cc_apply_private_school_guide_change($1,$2,$3,$4)',[id,revision,docVersion,patch]);
 await actor(db,b,sb);await assert.rejects(call(1,1,change));await actor(db,a,sa);
 for(const patch of [{field:'officialOrder'},{anchor:'Course code: F2'},{quote:'Credits: 5'},{after:19},{before:10}])await assert.rejects(call(1,1,{...change,...patch}));
 await assert.rejects(call(1,2,change));const [r]=(await call(1,1,change)).rows;
 assert.deepEqual(r.payload,{...payload,credits:4,guideChanges:[change]});await assert.rejects(call(1,1,change));
 await db.query("update public.cc_records set payload=jsonb_set(payload,'{credits}','3') where id=$1",[id]);await assert.rejects(call(3,1,change));
});
test('School Library screen shows the proposed source, page, quotation and values before an explicit apply click',async t=>{
 const app=privateWorkspaceFixture(t,scope),a=app.tab();await a.login();await attach(a.client,'Guide.pdf',bytes);
 const {course}=await open(a.client);let finish,saved;
 const panel=createSchoolLibraryPanel({client:a.client,source:()=>({token:course.schoolReadToken,title:course.title,kind:'course',expiresAt:Date.now()+60000}),allowEdit:true,onChange:()=>finish?.(),onSaved:result=>{saved=result;finish?.();}});
 async function action(value){
  const done=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Panel did not finish')),4000);finish=()=>{if(!panel.blocked()){clearTimeout(timer);resolve();}};});
  panel.click({target:{closest:q=>q==='[data-school-library]'?{dataset:{schoolLibrary:value}}:null}});await done;
 }
 await action('open');await action(panel.render().match(/data-school-library="(inspect-[^"]+)"/)[1]);
 if(process.platform!=='darwin'){assert.match(panel.render(),/unavailable here/);return;}
 assert.match(panel.render(),/Page 2 · Course code: F1 · <q>Credit hours: 4<\/q>/);assert.match(panel.render(),/3 → 4/);assert.equal(saved,undefined);
 await action(panel.render().match(/data-school-library="(apply-[^"]+)"/)[1]);assert.equal(saved,'plan');
});
