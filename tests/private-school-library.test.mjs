import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPrivateSchoolPanel} from '../src/private-school-panel.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createIsolatedDevelopmentDatabase,actor,identities} from './fixtures/isolated-development-database.mjs';
import {schoolGuideVersions} from '../src/private-school-guides.mjs';

const access={allowSchoolRead:true,allowSchoolEdit:true,allowDocuments:true};
const file=name=>Buffer.from('%PDF-1.5\n'+name+'\n%%EOF');
async function upload(client,name){
 const bytes=file(name);await client.documentList(0);
 const review=await client.documentReview({name,folder:'School',tags:[],mime:'application/pdf',bytes:bytes.length},bytes.toString('base64'));
 await client.documentSave(review.reviewId);
}
async function open(client,type='course'){
 const whole=await client.schoolOverview();
 const record=(type==='course'?whole.courses:whole.programs)[0];
 const library=await client.schoolLibraryOpen(record.schoolReadToken);
 return {record,library};
}
async function pick(client,library,name,kind){
 const doc=library.files.find(f=>f.name===name);
 return client.schoolGuideReview(library.viewId,doc.choice,kind);
}

test('School Library keeps per-kind versions, reopens each original and preserves official and accelerated course order',async t=>{
 const app=privateWorkspaceFixture(t,access),a=app.tab();await a.login();const client=a.client;
 for(const name of ['First.pdf','Second.pdf'])await upload(client,name);
 const original=await open(client);
 let library=original.library;
 for(const [name,kind,number] of [['First.pdf','syllabus',1],['Second.pdf','syllabus',2],['First.pdf','course',1]]){
  const review=await pick(client,library,name,kind);assert.equal(review.number,number);assert.equal(review.title,original.record.title);
  assert.deepEqual(await client.schoolGuideSave(library.viewId,review.reviewId),{saved:true});await assert.rejects(client.schoolGuideSave(library.viewId,review.reviewId));
  library=(await open(client)).library;
 }
 assert.deepEqual(library.history.map(g=>[g.name,g.number]),[['First.pdf',1],['Second.pdf',2],['First.pdf',1]]);
 for(const guide of library.history){
  const download=await client.schoolGuideDownload(library.viewId,guide.choice);assert.deepEqual(Buffer.from(download.data,'base64'),file(guide.name));
  assert.doesNotMatch(JSON.stringify(guide),/documentId|owner_id/);
 }
 await assert.rejects(pick(client,library,'First.pdf','syllabus'));
 await assert.rejects(pick(client,library,'First.pdf','program'));
 const {record}=await open(client);assert.equal(record.officialOrder,original.record.officialOrder);assert.equal(record.studyOrder,original.record.studyOrder);
 const detail=await client.schoolRead({schoolReadToken:record.schoolReadToken});assert.doesNotMatch(JSON.stringify(detail),/First.pdf|guideDocuments|documentId/);
 const program=(await open(client,'degree')).library,review=await pick(client,program,'First.pdf','program');await client.schoolGuideSave(program.viewId,review.reviewId);
 assert.equal((await open(client,'degree')).library.history[0].kind,'program');
});
test('guide approvals are bound to the original tab, source and document revision',async t=>{
 const app=privateWorkspaceFixture(t,access),a=app.tab(),b=app.tab();await a.login();await b.login();await upload(a.client,'Guide.pdf');
 const left=(await open(a.client)).library,right=(await open(b.client)).library;
 const one=await pick(a.client,left,'Guide.pdf','course'),two=await pick(b.client,right,'Guide.pdf','course');
 await assert.rejects(b.client.schoolGuideSave(left.viewId,one.reviewId));
 await a.client.schoolGuideSave(left.viewId,one.reviewId);await assert.rejects(b.client.schoolGuideSave(right.viewId,two.reviewId));
 const fresh=(await open(b.client)).library,third=await pick(b.client,fresh,'Guide.pdf','syllabus');
 const list=await a.client.documentList(0),candidate=list.documents[0];
 const rename=await a.client.documentOrganize(candidate.choice,{name:'Updated.pdf',folder:'School',tags:[]});
 await a.client.documentSave(rename.reviewId);await assert.rejects(b.client.schoolGuideSave(fresh.viewId,third.reviewId));
 await assert.rejects(b.client.schoolGuideDownload(fresh.viewId,fresh.history[0].choice));
 const active=(await open(b.client)).library;assert.equal(active.history[0].name,'Updated.pdf');assert.equal(active.history.length,1);
 assert.deepEqual(Buffer.from((await b.client.schoolGuideDownload(active.viewId,active.history[0].choice)).data,'base64'),file('Guide.pdf'));
});
test('School record panel offers the file and requires explicit approval to record the first syllabus',async t=>{
 const app=privateWorkspaceFixture(t,access),a=app.tab();await a.login();await upload(a.client,'Sample.pdf');
 const panel=createPrivateSchoolPanel({client:a.client,allowDocuments:true,allowEdit:true,canUse:()=>true});t.after(()=>panel.dispose());
 const turn=()=>new Promise(r=>setImmediate(r));
 async function click(selector,dataset={}){panel.click({target:{closest:q=>q===selector?{dataset}:null}});await turn();}
 const choose=async action=>click('[data-school-library]',{schoolLibrary:action});
 await click('#private-school-open');const token=panel.render().match(/data-school-read="([^"]+)"[^>]*>[^<]*Fictional course 1/)?.[1];
 assert.ok(token);await click('[data-school-read]',{schoolRead:token});await choose('open');
 assert.match(panel.render(),/No guides linked yet/);panel.input({target:{name:'school-guide-kind',value:'syllabus'}});
 await choose(panel.render().match(/data-school-library="(choose-[^"]+)"/)[1]);assert.match(panel.render(),/Syllabus · Version 1/);
 await choose('save');assert.match(panel.render(),/Guide version saved/);
 assert.equal((await open(a.client)).library.history[0].kind,'syllabus');
});
test('isolated SQL locks the original file revision and restricts append to the selected owner and course or program',async t=>{
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());const {a,b,sa,sb}=identities;
 await actor(db,a,sa);const school=randomUUID(),doc=randomUUID(),guide={kind:'syllabus',documentId:doc,addedAt:'2026-11-22T12:00:00.000Z'};
 const payload={fictional:true,source:'M2E_SCHOOL_QA',kind:'course',officialOrder:4,studyOrder:1,extension:{keep:true}};
 await db.query("insert into public.cc_private_documents(owner_id,id,content_key,metadata,file_envelope) values($1,$2,$3,'test metadata','test envelope')",[a,doc,'a'.repeat(64)]);
 await db.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values($1,$2,'private','School','school_fixture','M2E_SCHOOL_QA',$3)",[school,a,payload]);
 const call=(version,docVersion,g)=>db.query('select * from public.cc_append_private_school_guide($1,$2,$3,$4)',[school,version,docVersion,g]);
 await assert.rejects(call(1,2,guide));await assert.rejects(call(1,1,{...guide,kind:'program'}));
 await actor(db,b,sb);await assert.rejects(call(1,1,guide));await actor(db,a,sa);
 const saved=(await call(1,1,guide)).rows[0];assert.deepEqual(saved.payload,{...payload,guideDocuments:[guide]});
 await assert.rejects(call(1,1,{...guide,kind:'course'}));await assert.rejects(call(2,1,guide));
 assert.throws(()=>schoolGuideVersions({...payload,guideDocuments:[guide,guide]}));
});
