import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createDocumentStorage,openStoredDocument} from '../server/private-document-store.mjs';
import {categorySource,categoryRecordId,categoryRecordType} from '../server/private-transaction-category-record.mjs';
import {createTokenSealer} from '../server/token-sealer.mjs';
import {makeSchoolDegree} from '../src/dev-school-model.mjs';
import {makePrivateRecordQaFixture} from './fixtures/private-record-qa.mjs';
import {manualBudgetId} from '../server/private-budget-period.mjs';
import {decodeManualFinanceRow} from '../server/private-manual-finance-storage.mjs';
import {sealPrivateWorkspace,inspectPrivateWorkspace} from '../server/private-workspace-backup.mjs';
import {createPrivateWorkspaceRestoreExecutor} from '../server/private-workspace-restore-executor.mjs';
import {createPrivateWorkspaceRestoreRepository} from '../server/private-workspace-restore-repository.mjs';
import {createIsolatedDevelopmentDatabase,actor,identities} from './fixtures/isolated-development-database.mjs';
import {validateWorkspaceBackupArguments,backupPrivateWorkspace} from '../tools/backup-private-workspace.mjs';
import {validateWorkspacePreviewArguments} from '../tools/preview-workspace-restore.mjs';

const {a:owner,b:other,sa:session,sb:otherSession}=identities;
const projectRef='devproject12345',file=Buffer.from('%PDF-1.5\nFictional receipt original\n%%EOF');
async function sample(key){
 const rows=new Map(),subject={ownerId:owner};
 const store=createDocumentStorage({
  find:async()=>null,metadata:async(_,id)=>rows.get(id)
 },async()=>Buffer.from(key));
 const fields={name:'Receipt.pdf',folder:'',tags:[],mime:'application/pdf',bytes:file.length};
 const {row}=await store.prepare(subject,fields,file.toString('base64'));
 rows.set(row.id,{...row,version:1});
 const edit=await store.prepareEdit(subject,await store.inspect(subject,row.id),{name:'Filed.pdf',folder:'Home',tags:['Receipt']});
 const document={...row,metadata:edit.metadata,version:2},receiptFile={linkId:randomUUID(),documentId:row.id};
 const budget={period:'month',periodStart:'2026-11-01',periodEnd:'2026-11-30',plannedIncomeMinor:25000,allocations:[],transactions:[{day:'2026-11-01',category:'Food',amountMinor:1250,receiptFile}]};
 const id=manualBudgetId(owner,budget),plain={fictional:true,ownerId:owner,version:1,budget},version=3;
 const record={id,owner_id:owner,household_id:null,visibility:'private',section:'Finances',item_type:'manual_finance_budget',origin:'PRIVATE_MANUAL_FINANCE',version,
  created_at:'2026-11-01T12:00:00.000001Z',updated_at:'2026-11-02T12:00:00.000002Z',deleted_at:null,
  payload:{scheme:'manual-finance-v1',encrypted:createTokenSealer(key).seal(plain,['manual-budget-v1',owner,id,version].join(':'))}};
 return {document,record,receiptFile};
}

test('reviewed recovery preserves original attachment bytes, file revision and receipt link in one authenticated transaction',async t=>{
 const key=randomBytes(32),{document,record,receiptFile}=await sample(key);
 const args={key,ownerId:owner,projectRef,rows:[record]},archive=sealPrivateWorkspace({...args,documents:[document]});
 assert.equal(JSON.parse(archive.bytes).v,2);
 assert.doesNotMatch(archive.bytes.toString(),/Filed|Fictional|receiptFile|document_id/);
 assert.deepEqual(inspectPrivateWorkspace(archive.bytes,args).documents,[document]);
 assert.throws(()=>sealPrivateWorkspace({...args,documents:[]}),/missing an original/);
 assert.throws(()=>sealPrivateWorkspace({...args,documents:[{...document,version:1}]}));
 assert.throws(()=>sealPrivateWorkspace({...args,documents:[{...document,owner_id:other}]}));
 assert.throws(()=>sealPrivateWorkspace({...args,documents:[document,document]}));
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());
 const repository=createPrivateWorkspaceRestoreRepository({projectRef,allowDocumentRestore:true,verifyTarget:async conn=>conn===db,
  withConnection:async(who,callback)=>{await actor(db,who.owner,who.session);return callback(db);}});
 const who={owner,session},otherUser={owner:other,session:otherSession};
 function executor(repo=repository,enabled=true){
  const value=createPrivateWorkspaceRestoreExecutor({projectRef,key,repository:repo,allowDocumentRestore:enabled,allowManualFinanceRestore:true,
   resolveActor:async who=>({ownerId:who.owner,sessionBinding:who.session,expiresAt:Date.now()+300000}),authorizeWrite:async()=>true});
  t.after(()=>value.dispose());return value;
 }
 const restore=executor(),legacy=sealPrivateWorkspace(args);
 assert.equal((await restore.prepare(who,{bytes:legacy.bytes})).canRestore,false);
 assert.equal((await executor(repository,false).prepare(who,{bytes:archive.bytes})).canRestore,false);
 await assert.rejects(restore.prepare(otherUser,{bytes:archive.bytes}));
 const failing=executor({...repository,withLockedWorkspace:(a,o,fn)=>repository.withLockedWorkspace(a,o,tx=>fn({...tx,insertMany:async()=>{throw Error('Simulated failed record acknowledgement');}}))});
 const failedReview=await failing.prepare(who,{bytes:archive.bytes});assert.equal(failedReview.documentsToRestore,1);
 await assert.rejects(failing.execute(who,{reviewId:failedReview.reviewId,approved:true}));
 assert.deepEqual(await repository.readDocuments(who,owner,[document]),[]);
 const review=await restore.prepare(who,{bytes:archive.bytes});assert.equal(review.canRestore,true);assert.equal(review.insertCount,1);
 const result=await restore.execute(who,{reviewId:review.reviewId,approved:true});
 assert.equal(result.documentsRestored,1);assert.equal(result.restored,1);
 await assert.rejects(restore.execute(who,{reviewId:review.reviewId,approved:true}));
 const restored=(await repository.readPrivateRows(who,owner)).find(r=>r.id===record.id);
 const expense=decodeManualFinanceRow(restored,owner,createTokenSealer(key)).payload.budget.transactions[0];
 assert.deepEqual(expense.receiptFile,receiptFile);
 const [recovered]=await repository.readDocuments(who,owner,[document]);assert.deepEqual(recovered,document);
 const opened=openStoredDocument(recovered,owner,key);assert.deepEqual(opened.bytes,file);assert.equal(opened.fields.name,'Filed.pdf');assert.equal(opened.version,2);
 assert.deepEqual(await repository.readDocuments(otherUser,other,[document]),[]);
 const repeat=await restore.prepare(who,{bytes:archive.bytes});assert.equal(repeat.documentsToRestore,0);assert.equal(repeat.documentsRetained,1);assert.equal(repeat.insertCount,0);
 const docStore=createDocumentStorage({metadata:async()=>recovered},async()=>Buffer.from(key));
 const newer=await docStore.prepareEdit({ownerId:owner},opened,{name:'Newer.pdf',folder:'',tags:[]});
 await actor(db,owner,session);await db.query('update public.cc_private_documents set metadata=$1,version=3 where id=$2',[newer.metadata,document.id]);
 await assert.rejects(restore.execute(who,{reviewId:repeat.reviewId,approved:true}));
 const conflict=await restore.prepare(who,{bytes:archive.bytes});assert.equal(conflict.canRestore,false);assert.equal(conflict.documentBlockedCount,1);
 await actor(db,other,otherSession);
 await assert.rejects(db.query('select cc_private.restore_missing_document($1,$2,$3,$4,$5,$6)',[owner,randomUUID(),document.content_key,document.metadata,document.file_envelope,2]),/owner/);
});

test('optional document backup reads two matching complete inventories and refuses missing files or a changed revision',async()=>{
 const key=randomBytes(32),{document,record}=await sample(key),project=projectRef;
 assert.deepEqual(validateWorkspaceBackupArguments(['--allow-private-workspace-backup','--include-documents','--project='+project]),{project,includeDocuments:true});
 const archiveId=randomUUID();
 assert.deepEqual(validateWorkspacePreviewArguments(['--allow-readonly-workspace-comparison','--project='+project,'--archive='+archiveId,'--records=0','--documents=1']),{project,archiveId,recordCount:0,documentCount:1});
 for(const mode of ['consistent','changed','unavailable']){
  let documentReads=0,writes=0,closed=false;
  const apiFactory=()=>({signIn:async()=>({accessToken:'fictional'}),getUser:async()=>({id:owner}),isSessionActive:async()=>true,signOutLocal:async()=>{closed=true;}});
  const deps={configLoader:makePrivateRecordQaFixture().deps.configLoader,apiFactory,keyLoader:async()=>Buffer.from(key),
   fetcher:async url=>{
    const u=new URL(url);
    if(u.pathname.endsWith('/cc_records'))return {ok:true,json:async()=>[record]};
    if(u.pathname.endsWith('_ready'))return {ok:false,status:404,json:async()=>({code:'PGRST202',message:'public.cc_private_record_versions_ready'})};
    assert.ok(u.pathname.endsWith('/cc_private_documents'));assert.equal(u.searchParams.get('owner_id'),'eq.'+owner);
    if(mode==='unavailable')return {ok:false,status:403};
    if(u.searchParams.has('id'))return {ok:true,json:async()=>[]};
    documentReads++;return{ok:true,json:async()=>[mode==='changed'&&documentReads===2?{...document,version:3}:document]};
   },writer:async options=>{writes++;const sealed=sealPrivateWorkspace(options);assert.deepEqual(inspectPrivateWorkspace(sealed.bytes,options).documents,[document]);return{verified:true,recordCount:1,documentCount:1};},log:()=>{}};
  const task=backupPrivateWorkspace({project,includeDocuments:true},deps);
  if(mode==='consistent'){await task;assert.equal(documentReads,2);assert.equal(writes,1);}
  else{await assert.rejects(task);assert.equal(writes,0);}
  assert.equal(closed,true);
 }
});

test('saved bank receipt recovery also requires the exact original transaction before inserting its annotation and file',async t=>{
 const key=randomBytes(32),{document,record}=await sample(key),sealer=createTokenSealer(key),sourceId=randomUUID();
 const bank={connectionId:randomUUID(),sourceId:'fixture',provider:'plaid',institution:'Chase',fictional:false,
  content:{currency:'USD',name:'Fictional shop',merchant:'Fictional shop',date:'2026-11-01',accountId:'fixture',amountMinor:1250,pending:false,pendingTransactionId:null}};
 const source={...record,id:sourceId,version:1,item_type:'provider_bank_transaction',origin:'plaid_readonly',payload:bank};
 const {source:ref}=categorySource(source,owner),id=categoryRecordId(owner,ref);
 const body={fictional:true,ownerId:owner,version:1,source:ref,categories:null,receiptDocumentId:document.id};
 const annotation={...record,id,item_type:categoryRecordType,version:1,payload:{scheme:'manual-finance-v1',encrypted:sealer.seal(body,'manual-transaction-categories-v1:'+owner+':'+id+':1')}};
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());
 const repo=createPrivateWorkspaceRestoreRepository({projectRef,allowDocumentRestore:true,verifyTarget:async conn=>conn===db,withConnection:async(_,fn)=>{await actor(db,owner,session);return fn(db);}});
 const executor=createPrivateWorkspaceRestoreExecutor({repository:repo,projectRef,key,allowManualFinanceRestore:true,allowDocumentRestore:true,
  resolveActor:async()=>({ownerId:owner,sessionBinding:session,expiresAt:Date.now()+300000}),authorizeWrite:async()=>true});t.after(()=>executor.dispose());
 const bytes=sealPrivateWorkspace({key,ownerId:owner,projectRef,rows:[annotation],documents:[document]}).bytes;
 assert.equal((await executor.prepare({}, {bytes})).canRestore,false);
 const stored={scheme:'chase-private-v1',version:1,encrypted:sealer.seal(bank,'finance-record:'+owner+':'+sourceId)};
 await actor(db,owner,session);
 await db.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values($1,$2,'private','Finances','provider_bank_transaction','plaid_readonly',$3)",[sourceId,owner,stored]);
 const review=await executor.prepare({}, {bytes});assert.equal(review.canRestore,true);
 const result=await executor.execute({},{reviewId:review.reviewId,approved:true});assert.equal(result.documentsRestored,1);
 const rows=await repo.readPrivateRows({},owner);
 assert.deepEqual(decodeManualFinanceRow(rows.find(r=>r.id===id),owner,sealer).payload,body);
 assert.deepEqual(rows.find(r=>r.id===sourceId).payload,stored);
});

test('the largest supported private file survives an encrypted archive round trip',async()=>{
 const key=randomBytes(32),original=Buffer.alloc(8*1024*1024,1);file.copy(original);
 const fields={name:'Large.pdf',mime:'application/pdf',bytes:original.length,folder:'',tags:[]};
 const storage=createDocumentStorage({find:async()=>null},async()=>Buffer.from(key));
 const {row}=await storage.prepare({ownerId:owner},fields,original.toString('base64'));
 const options={key,ownerId:owner,projectRef,rows:[],documents:[{...row,version:1}]};
 const {bytes}=sealPrivateWorkspace(options);assert.ok(bytes.length>8*1024*1024);
 const [doc]=inspectPrivateWorkspace(bytes,options).documents;assert.deepEqual(openStoredDocument(doc,owner,key).bytes,original);
});

test('maintenance project and its earlier receipt references require the original document during recovery',async t=>{
 const key=randomBytes(32),{document,receiptFile}=await sample(key);
 const homeAsset={kind:'possession',make:'Fixture',model:'Oven',year:'2022',usageUnit:'hours',usageEntries:[],warrantyEndDay:'2027-02-12',receiptNote:'Box',receiptFile};
 const project={id:randomUUID(),owner_id:owner,household_id:null,visibility:'private',section:'Home',item_type:'project',origin:'PRIVATE_COOKIE_PROJECT',version:3,
  created_at:'2026-11-01T12:00:00.000001Z',updated_at:'2026-11-02T12:00:00.000002Z',deleted_at:null,
  payload:{fictional:true,schemaVersion:1,title:'Oven',description:'Warranty',status:'Active',homeAsset}};
 const args={key,ownerId:owner,projectRef,rows:[project]};
 assert.throws(()=>sealPrivateWorkspace({...args,documents:[]}),/maintenance receipt/);
 const history={id:randomUUID(),owner_id:owner,record_id:project.id,source_version:2,item_type:'project',operation:'UPDATE',captured_at:project.updated_at,snapshot:{...project,version:2}};
 const withoutFile=structuredClone(project);delete withoutFile.payload.homeAsset.receiptFile;
 assert.throws(()=>sealPrivateWorkspace({...args,rows:[withoutFile],recordVersions:[history],documents:[]}),/maintenance receipt/);
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());
 const repo=createPrivateWorkspaceRestoreRepository({projectRef,allowDocumentRestore:true,verifyTarget:async conn=>conn===db,withConnection:async(_,fn)=>{await actor(db,owner,session);return fn(db);}});
 const executor=createPrivateWorkspaceRestoreExecutor({projectRef,key,repository:repo,allowDocumentRestore:true,
  resolveActor:async()=>({ownerId:owner,sessionBinding:session,expiresAt:Date.now()+300000}),authorizeWrite:async()=>true});t.after(()=>executor.dispose());
 assert.equal((await executor.prepare({},{bytes:sealPrivateWorkspace(args).bytes})).canRestore,false);
 const review=await executor.prepare({},{bytes:sealPrivateWorkspace({...args,documents:[document]}).bytes});
 assert.equal(review.documentsToRestore,1);assert.equal(review.canRestore,true);
 const result=await executor.execute({},{approved:true,reviewId:review.reviewId});
 assert.equal(result.restored,1);assert.deepEqual((await repo.readPrivateRows({},owner)).find(r=>r.id===project.id).payload.homeAsset,homeAsset);
 const [row]=await repo.readDocuments({},owner,[document]);assert.deepEqual(openStoredDocument(row,owner,key).bytes,file);
});

test('School Library archives require originals for current and historical guide versions and recover the program and file together',async t=>{
 const key=randomBytes(32),{document}=await sample(key);
 const degree={...makeSchoolDegree(owner,{title:'Fictional program'}),id:randomUUID(),version:3,deleted_at:null,
  created_at:'2026-11-01T12:00:00.000001Z',updated_at:'2026-11-02T12:00:00.000002Z'};
 const guide={kind:'program',documentId:document.id,addedAt:'2026-11-01T13:00:00.000Z'};
 degree.payload.guideDocuments=[guide];
 const args={key,ownerId:owner,projectRef,rows:[degree]};
 assert.throws(()=>sealPrivateWorkspace({...args,documents:[]}),/original School guide/);
 const earlier={id:randomUUID(),owner_id:owner,record_id:degree.id,source_version:2,item_type:'school_fixture',operation:'UPDATE',captured_at:degree.updated_at,snapshot:{...degree,version:2}};
 const noGuides=structuredClone(degree);delete noGuides.payload.guideDocuments;
 assert.throws(()=>sealPrivateWorkspace({...args,rows:[noGuides],recordVersions:[earlier],documents:[]}),/original School guide/);
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());
 const repo=createPrivateWorkspaceRestoreRepository({projectRef,allowDocumentRestore:true,verifyTarget:async conn=>conn===db,withConnection:async(_,fn)=>{await actor(db,owner,session);return fn(db);}});
 const executor=createPrivateWorkspaceRestoreExecutor({projectRef,key,repository:repo,allowDocumentRestore:true,
  resolveActor:async()=>({ownerId:owner,sessionBinding:session,expiresAt:Date.now()+300000}),authorizeWrite:async()=>true});t.after(()=>executor.dispose());
 assert.equal((await executor.prepare({},{bytes:sealPrivateWorkspace(args).bytes})).canRestore,false);
 const review=await executor.prepare({},{bytes:sealPrivateWorkspace({...args,documents:[document]}).bytes});
 assert.equal(review.canRestore,true);const result=await executor.execute({},{approved:true,reviewId:review.reviewId});
 assert.equal(result.documentsRestored,1);assert.deepEqual((await repo.readPrivateRows({},owner)).find(r=>r.id===degree.id).payload,degree.payload);
 const [row]=await repo.readDocuments({},owner,[document]);assert.deepEqual(openStoredDocument(row,owner,key).bytes,file);
});

test('encrypted recovery preserves document Favorites and reopens the original bytes from their collection',async t=>{
 const {makeBriefPreferencesRecord}=await import('../src/dev-preferences-model.mjs');
 const {createDocumentLibrary}=await import('../server/private-document-library.mjs');
 const {createPrivateFavoriteDocuments}=await import('../server/private-favorite-records.mjs');
 const key=randomBytes(32),{document}=await sample(key),subject={ownerId:owner},who={owner,session};
 const collection=randomUUID(),profile={...makeBriefPreferencesRecord({},owner),id:randomUUID(),version:1,created_at:'2026-11-01T12:00:00Z',updated_at:'2026-11-01T12:00:00Z',deleted_at:null};
 profile.payload.favorites={version:1,collections:[{id:collection,name:'File cabinet'}],pages:[]};
 profile.payload.favoriteItems={version:1,items:[{type:'document',id:document.id,collections:[collection]}]};
 const archive=sealPrivateWorkspace({projectRef,ownerId:owner,key,rows:[profile],documents:[document]});
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());
 const repository=createPrivateWorkspaceRestoreRepository({projectRef,allowDocumentRestore:true,verifyTarget:async(connection,ref)=>connection===db&&ref===projectRef,
  withConnection:async(a,callback)=>{await actor(db,a.owner,a.session);return callback(db);}});
 const restore=createPrivateWorkspaceRestoreExecutor({repository,projectRef,key,allowDocumentRestore:true,resolveActor:async a=>({ownerId:a.owner,sessionBinding:a.session,expiresAt:Date.now()+300000}),authorizeWrite:async()=>true});
 t.after(()=>restore.dispose());
 const plan=await restore.prepare(who,{bytes:archive.bytes});
 assert.equal(plan.canRestore,true);
 const saved=await restore.execute(who,{reviewId:plan.reviewId,approved:true});
 assert.equal(saved.documentsRestored,1);assert.equal(saved.restored,1);
 const [restored]=await repository.readDocuments(who,owner,[document]);
 let accessible=true,now=Date.now();
 const select=(a,id)=>accessible&&a.ownerId===owner&&id===restored.id?restored:null;
 const storage=createDocumentStorage({metadata:select,get:select,byIds:async(a,ids)=>ids.map(id=>select(a,id)).filter(Boolean)},async()=>Buffer.from(key));
 const api={documentStorage:storage,listBriefPreferences:async()=>(await repository.readPrivateRows(who,owner)).filter(r=>r.id===profile.id),updateBriefPreferences:assert.fail,addBriefPreferences:assert.fail};
 const documents=createDocumentLibrary({storage,now:()=>now});
 const service=createPrivateFavoriteDocuments({api,now:()=>now,documents,favoriteReader:documents});
 t.after(()=>{service.dispose();documents.dispose();});
 const list=()=>service.list('tab',subject,now+1000,0,()=>true,collection);
 const item=(await list()).documents[0];assert.deepEqual(item.collections,['File cabinet']);assert.equal(item.title,'Filed.pdf');
 assert.equal((await documents.download('tab',subject,item.documentReadToken)).data,file.toString('base64'));
 accessible=false;await assert.rejects(documents.selected('tab',subject,item.documentReadToken));
 assert.equal((await list()).count,0);
 accessible=true;const fresh=(await list()).documents[0];now+=1000;
 await assert.rejects(documents.download('tab',subject,fresh.documentReadToken));
});
