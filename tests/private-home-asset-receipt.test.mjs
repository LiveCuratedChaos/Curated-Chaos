import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createPrivateProjectPanel} from '../src/private-project-panel.mjs';

const file=Buffer.from('%PDF-1.5\nFictional maintenance receipt\n%%EOF');
const fileFields={name:'Service receipt.pdf',folder:'Home',tags:['Service'],mime:'application/pdf',bytes:file.length};
const asset={kind:'vehicle',make:'Honda',model:'Civic',year:'2021',usageUnit:'miles',usageEntries:[{day:'2026-11-01',value:1200,note:'Maintenance'}],warrantyEndDay:'2027-11-01',receiptNote:'Warranty folder'};
const project={title:'Vehicle service',description:'Private service history',status:'Active',section:'Home',separateRecurring:false,homeAsset:asset};
const filters={offset:0,query:'',section:'all',status:'all'};
async function fixture(t){
 const app=privateWorkspaceFixture(t,{allowProjects:true,allowDocuments:true}),a=app.tab(),b=app.tab();await a.login();await b.login();
 await a.client.documentList(0);await a.client.documentSave((await a.client.documentReview(fileFields,file.toString('base64'))).reviewId);
 return {a:a.client,b:b.client};
}
test('maintenance editor reviews a receipt on a new profile, reopens the original, preserves the note and removes only its link',async t=>{
 const {a}=await fixture(t),downloads=[];
 const panel=createPrivateProjectPanel({client:a,allowDocuments:true,download:(data,f)=>downloads.push([Buffer.from(data),f.name])});t.after(()=>panel.dispose());
 const turn=()=>new Promise(r=>setImmediate(r));
 const click=async(selector,dataset={})=>{panel.click({target:{closest:s=>s===selector?{dataset}:null}});await turn();};
 const receipt=action=>click('[data-maintenance-receipt]',{maintenanceReceipt:action});
 const input=(name,value)=>panel.input({target:{name,value}}),submit=async()=>{panel.submit({target:{id:'private-project-editor'},preventDefault(){}});await turn();};
 await click('#private-projects-open');await click('#private-project-new');input('project-title',project.title);
 input('project-home-asset-kind','vehicle');input('project-home-asset-receiptNote',asset.receiptNote);
 await receipt('open');assert.match(panel.render(),/Choose Service receipt.pdf/);
 const choice=/data-maintenance-receipt="(receipt-choose-[^"]+)"/.exec(panel.render())[1];await receipt(choice);
 await submit();assert.match(panel.render(),/Maintenance receipt · Service receipt.pdf/);await click('#private-project-save');
 const token=/data-private-project="([^"]+)"/.exec(panel.render())[1];await click('[data-private-project]',{privateProject:token});
 await receipt('open');assert.match(panel.render(),/Attached document · Service receipt.pdf/);await receipt('receipt-download');assert.deepEqual(downloads,[[file,fileFields.name]]);
 await receipt('receipt-unlink');await submit();assert.match(panel.render(),/Remove link and keep the library file/);await click('#private-project-save');
 const current=await a.projectsRead((await a.projectsList(filters)).projects[0].projectToken);
 assert.equal(current.homeAsset.receiptNote,asset.receiptNote);assert.equal(current.homeAsset.receiptFile,undefined);
 assert.equal((await a.documentList(0)).documents.length,1);
});

test('project changes require a current file choice and cannot inject a file ID, erase a link or approve an out-of-date name',async t=>{
 const {a,b}=await fixture(t);
 await a.projectsList(filters);await b.projectsList(filters);
 const picker=await a.maintenanceReceipts(null,0);
 await assert.rejects(b.projectsReview({action:'create',fields:project,receiptChoice:picker.files[0].choice}));
 await assert.rejects(a.projectsReview({action:'create',fields:{...project,homeAsset:{...asset,receiptFile:{documentId:randomUUID(),linkId:randomUUID()}}}}));
 let review=await a.projectsReview({action:'create',fields:project,receiptChoice:picker.files[0].choice});
 const selected=(await b.documentList(0)).documents[0],change=await b.documentOrganize(selected.choice,{name:'Renamed.pdf',folder:'',tags:[]});await b.documentSave(change.reviewId);
 await assert.rejects(a.projectsSave(review.reviewId));await a.projectsList(filters);
 let fresh=await a.maintenanceReceipts(null,0);review=await a.projectsReview({action:'create',fields:project,receiptChoice:fresh.files[0].choice});
 await a.projectsSave(review.reviewId);
 const item=(await a.projectsList(filters)).projects[0];assert.equal(item.homeAsset,undefined);
 const saved=await a.projectsRead(item.projectToken),{projectToken,expiresAt,...fields}=saved;
 await assert.rejects(a.projectsReview({action:'edit',projectToken,fields:project}));
 const correction=await a.projectsReview({action:'edit',projectToken,fields:{...fields,homeAsset:{...fields.homeAsset,warrantyEndDay:'2028-01-01'}}});
 assert.deepEqual(correction.homeAsset.receiptFile,saved.homeAsset.receiptFile);await a.projectsSave(correction.reviewId);
 const result=await a.projectsRead((await a.projectsList(filters)).projects[0].projectToken);
 assert.deepEqual(result.homeAsset,{...asset,warrantyEndDay:'2028-01-01',receiptFile:saved.homeAsset.receiptFile});
});
