import test from 'node:test';
import assert from 'node:assert/strict';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {schoolGuidePdf} from './fixtures/school-guide-pdf.mjs';
import {suggestDocumentFields,suggestionFields} from '../src/private-document-suggestions.mjs';
import {documentFields} from '../src/private-document-fields.mjs';
import {createDocumentPanel} from '../src/private-document-panel.mjs';

const contents=[['Fictional item'],['LIMITED WARRANTY','Expiry date: February 29, 2028']];
const bytes=schoolGuidePdf(contents);
const fields={name:'Original.pdf',folder:'Personal',tags:['Appliance'],bytes:bytes.length,mime:'application/pdf'};
const parsed=pages=>({status:'ready',pages,methods:pages.map(()=>'text')});
test('document suggestions retain exact page evidence, omit ambiguous expiry dates and preserve existing owner choices',()=>{
 const proposals=suggestDocumentFields(fields,parsed(contents.map(p=>p.join('\n'))));
 assert.deepEqual(proposals.map(p=>[p.field,p.value,p.page]),[['classification','Warranty',2],['tag','Warranty',2],['expiresOn','2028-02-29',2]]);
 for(const p of proposals)assert.equal(suggestionFields(fields,p).bytes,fields.bytes);
 for(const line of ['Expires: 02/03/2028','Expiry date: 2027-02-29','Valid through: February 31, 2028'])
  assert.deepEqual(suggestDocumentFields(fields,parsed(['Expires: 2028-02-29\n'+line])),[]);
 assert.deepEqual(suggestDocumentFields(fields,parsed(['Invoice\nReceipt\nExpires: 2028-05-01\nExpires: 2029-05-01'])),[]);
 assert.deepEqual(suggestDocumentFields({...fields,classification:'Invoice',expiresOn:'2028-10-01'},parsed(contents.map(p=>p.join('\n')))),[]);
 assert.deepEqual(suggestDocumentFields(fields,{status:'ready',methods:['text','unavailable'],pages:['Warranty','']}),[]);
 assert.throws(()=>documentFields({...fields,expiresOn:'2027-02-29'}));assert.throws(()=>documentFields({...fields,classification:'Unknown'}));
});
async function setup(t){
 const app=privateWorkspaceFixture(t,{allowDocuments:true}),a=app.tab(),b=app.tab();await a.login();await b.login();
 await a.client.documentList(0);const review=await a.client.documentReview(fields,bytes.toString('base64'));await a.client.documentSave(review.reviewId);
 return {a:a.client,b:b.client};
}
async function inspect(client){
 const doc=(await client.documentList(0)).documents[0];const result=await client.documentText(doc.choice,1,'');
 return {doc,result,suggestions:result.status==='ready'?(await client.documentSuggest(doc.choice)).candidates:[]};
}
test('filing proposals require owner review and preserve the original bytes through separate type, tag, expiry, and removal approvals',async t=>{
 const {a,b}=await setup(t);const current=await inspect(a);
 if(process.platform!=='darwin'){assert.deepEqual(current.suggestions,[]);return;}
 const other=await inspect(b),expiry=current.suggestions.find(p=>p.field==='expiresOn');
 await assert.rejects(b.documentSuggestionReview(other.doc.choice,expiry.suggestion));
 const competing=await b.documentSuggestionReview(other.doc.choice,other.suggestions.find(p=>p.field==='expiresOn').suggestion);
 const review=await a.documentSuggestionReview(current.doc.choice,expiry.suggestion);
 assert.equal(review.fields.expiresOn,'2028-02-29');assert.equal(review.before.expiresOn,undefined);
 assert.equal((await b.documentList(0)).documents[0].expiresOn,undefined);
 await a.documentSave(review.reviewId);await assert.rejects(a.documentSave(review.reviewId));await assert.rejects(b.documentSave(competing.reviewId));
 for(const kind of ['classification','tag']){
  const {doc,suggestions}=await inspect(a);assert.equal(suggestions.some(p=>p.field==='expiresOn'),false);
  const item=suggestions.find(p=>p.field===kind),next=await a.documentSuggestionReview(doc.choice,item.suggestion);
  await a.documentSave(next.reviewId);
 }
 const final=await inspect(a);assert.deepEqual(final.suggestions,[]);assert.deepEqual(final.doc.tags,['Appliance','Warranty']);assert.equal(final.doc.classification,'Warranty');
 const original=await a.documentDownload(final.doc.choice);assert.deepEqual(Buffer.from(original.data,'base64'),bytes);
 const manual=await a.documentOrganize(final.doc.choice,{name:'Filed.pdf',folder:'Home',tags:final.doc.tags});assert.equal(manual.fields.expiresOn,'2028-02-29');await a.documentSave(manual.reviewId);
 const updated=(await a.documentList(0)).documents[0];
 const clear=await a.documentOrganize(updated.choice,{name:updated.name,folder:updated.folder,tags:updated.tags,expiresOn:'',classification:''});
 await a.documentSave(clear.reviewId);const cleared=(await a.documentList(0)).documents[0];assert.equal(cleared.expiresOn,undefined);assert.equal(cleared.classification,undefined);
});
test('filing screen displays page and quote, presents the actual metadata change, and requires approval',async t=>{
 const {a}=await setup(t);let finish;
 const panel=createDocumentPanel({client:a,onChange:()=>finish?.()});t.after(()=>panel.reset());
 async function click(value,done){
  const promise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Document screen did not settle')),5000);
   finish=()=>{if(done(panel.render())){clearTimeout(timer);resolve();}};});
  panel.click({target:{closest:q=>q==='[data-document-action]'?{dataset:{documentAction:value}}:null}});await promise;
 }
 await click('open',h=>h.includes('text-open-'));await click(panel.render().match(/data-document-action="(text-open-[^"]+)"/)[1],h=>h.includes('text-back'));
 if(process.platform!=='darwin'){assert.doesNotMatch(panel.render(),/Check for filing suggestions/);return;}
 await click('text-suggest',h=>h.includes('Review expiry date'));
 assert.match(panel.render(),/Page 2 · <q>Expiry date: February 29, 2028<\/q>/);
 const choose=panel.render().match(/data-document-action="(text-review-[^"]+)" [^>]*>Review expiry date/)[1];
 await click(choose,h=>h.includes('Approve document save'));assert.match(panel.render(),/Expires 2028-02-29/);assert.match(panel.render(),/Page 2/);
 await click('save',h=>h.includes('Document details saved'));assert.match(panel.render(),/Expires 2028-02-29/);
});
