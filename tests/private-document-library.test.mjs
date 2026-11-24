import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createDocumentStorage,documentRepository,verifyUpload} from '../server/private-document-store.mjs';
import {createDocumentPanel} from '../src/private-document-panel.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createIsolatedDevelopmentDatabase,identities,actor as setActor,administrator} from './fixtures/isolated-development-database.mjs';

const bytes=Buffer.from('%PDF-1.5\nFictional receipt\n%%EOF');
const fields={name:'Example receipt.pdf',mime:'application/pdf',bytes:bytes.length,folder:'Receipts/Household',tags:['Receipt']};
test('signed-in document library reviews one private upload, rediscovers and downloads the original bytes, and reuses duplicate files',async t=>{
 const app=privateWorkspaceFixture(t,{allowDocuments:true}),a=app.tab(),b=app.tab();await a.login();await b.login();
 assert.equal((await(await a.fetcher('/dev-config.json')).json()).privateDocuments,true);
 const downloaded=[];const panel=createDocumentPanel({client:a.client,download:(value,f)=>downloaded.push([Buffer.from(value),f])});
 t.after(()=>panel.reset());
 const turn=()=>new Promise(r=>setImmediate(r));
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{documentAction:action}})}});await turn();};
 await click('open');await click('add');
 const input=(field,value)=>panel.input({type:'change',target:{dataset:{documentField:field},...(field==='file'?{files:[value]}:{value})}});
 const file={name:fields.name,type:fields.mime,size:bytes.length,arrayBuffer:()=>Uint8Array.from(bytes).buffer};
 input('file',file);input('folder',fields.folder);input('tags','Receipt');await click('review');assert.match(panel.render(),/Approve document save/);
 assert.deepEqual((await b.client.documentList(0)).documents,[]);await click('save');assert.match(panel.render(),/Document saved/);
 const row=(await a.client.documentList(0)).documents[0];const other=(await b.client.documentList(0)).documents[0];
 assert.notEqual(row.choice,other.choice);await assert.rejects(b.client.documentDownload(row.choice));
 await click('open');const choice=/data-document-action="get-([^"]+)"/.exec(panel.render())[1];await click('get-'+choice);
 assert.deepEqual(downloaded,[[bytes,fields]]);
 await click('add');input('file',file);input('name','A second title.pdf');await click('review');assert.match(panel.render(),/already in your library/);await click('existing');
 assert.equal(downloaded.length,2);assert.equal((await b.client.documentList(0)).documents.length,1);
 await b.client.signOut();await assert.rejects(b.client.documentDownload(other.choice));
 const off=privateWorkspaceFixture(t).tab();assert.equal((await off.fetcher('/auth/workspace/documents/list',{method:'POST',body:'{}'})).status,404);
});
test('upload rejects mismatched size, signature, invalid Base64, filename and folder',()=>{
 const s=bytes.toString('base64');assert.deepEqual(verifyUpload(fields,s).bytes,bytes);
 for(const change of [{bytes:2},{mime:'image/png'},{name:'../a.pdf'},{folder:'../receipts'},{tags:['Same','same']},{mime:'text/html'}])assert.throws(()=>verifyUpload({...fields,...change},s));
 assert.throws(()=>verifyUpload(fields,s.replace(/[A-Z]/,'!')));
});
test('isolated PostgreSQL stores opaque bytes and metadata, isolates owners, detects changed ciphertext and reuses a concurrent upload',async t=>{
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());const {a,b,sa,sb}=identities;
 const master=randomBytes(32),one={ownerId:a,accessToken:'a'},two={ownerId:b,accessToken:'b'};
 const data=bytes.toString('base64');
 async function request(path,o,access){
  const owner=access==='a'?a:b;await setActor(db,owner,access==='a'?sa:sb);
  const params=new URL(path,'https://fixture.invalid').searchParams;
  if(o.method==='PATCH'){
   const edit=JSON.parse(o.body);assert.equal(params.get('owner_id'),'eq.'+owner);
   assert.equal(params.get('select'),'id,owner_id,content_key,metadata,version');assert.deepEqual(Object.keys(edit).sort(),['metadata','version']);
   return (await db.query('update public.cc_private_documents set metadata=$1,version=$2 where owner_id=$3 and id=$4 and version=$5 returning id,owner_id,content_key,metadata,version',
    [edit.metadata,edit.version,owner,params.get('id').slice(3),Number(params.get('version').slice(3))])).rows;
  }
  if(o.method==='POST'){
   const r=JSON.parse(o.body);
   assert.doesNotMatch(o.body,/Example receipt|Fictional receipt|Receipts\/Household/);
   await db.query('insert into public.cc_private_documents(owner_id,id,content_key,metadata,file_envelope) values ($1,$2,$3,$4,$5) on conflict(owner_id,content_key) do nothing',[r.owner_id,r.id,r.content_key,r.metadata,r.file_envelope]);return null;
  }
  const ids=[params.get('owner_id').slice(3)];
  const filter=params.has('content_key')?'content_key':params.has('id')?'id':null;
  const cols=params.get('select');assert.ok(['id,owner_id,content_key,metadata,version','id,owner_id,content_key,metadata,version,file_envelope'].includes(cols));
  let sql='select '+cols+' from public.cc_private_documents where owner_id=$1';
  if(filter){ids.push(params.get(filter).slice(3));sql+=' and '+filter+'=$2';}
  return (await db.query(sql+' order by id limit 26',ids)).rows;
 }
 const store=createDocumentStorage(documentRepository(request),async()=>Buffer.from(master));
 const first=await store.prepare(one,fields,data),second=await store.prepare(one,{...fields,name:'Other.pdf'},data);
 const saved=await store.save(one,first.row),reused=await store.save(one,second.row);assert.equal(reused.reused,true);assert.deepEqual(saved.document,reused.document);
 assert.deepEqual((await store.list(two,0)).documents,[]);await assert.rejects(store.read(two,saved.document));
 assert.equal((await store.read(one,saved.document)).data,data);assert.equal((await store.list(one,0)).documents.length,1);
 const other=await store.prepare(two,fields,data);assert.notEqual(first.row.content_key,other.row.content_key);await store.save(two,other.row);
 const changes={name:'Warranty.pdf',folder:'Home/Warranties',tags:['Appliance']};
 const prepared=await store.prepareEdit(one,saved.document,changes);
 await assert.rejects(store.saveEdit(two,prepared));
 const edited=await store.saveEdit(one,prepared);
 assert.equal(edited.id,saved.document.id);assert.equal(edited.version,2);assert.deepEqual(edited.fields,{...fields,...changes});
 await assert.rejects(store.saveEdit(one,prepared));await assert.rejects(store.read(one,saved.document));
 assert.equal((await store.read(one,edited)).data,data);
 assert.equal((await db.query('select file_envelope from public.cc_private_documents where id=$1',[edited.id])).rows[0].file_envelope,first.row.file_envelope);
 await assert.rejects(db.query('update public.cc_private_documents set file_envelope=$1 where id=$2',['invalid',edited.id]));
 await assert.rejects(db.query('update public.cc_private_documents set version=8 where id=$1',[edited.id]));
 await setActor(db,b,sb);assert.equal((await db.query('select * from public.cc_private_documents where owner_id=$1',[a])).rows.length,0);
 await administrator(db);await db.query('update public.cc_private_documents set file_envelope=$1 where owner_id=$2',[other.row.file_envelope,a]);
 await assert.rejects(store.read(one,edited));assert.equal((await store.read(two,(await store.list(two,0)).documents[0])).data,data);
});
test('library owner searches folders and smart collections, reviews a move and rename, and downloads the same original',async t=>{
 const app=privateWorkspaceFixture(t,{allowDocuments:true}),a=app.tab(),b=app.tab();await a.login();await b.login();
 await a.client.documentList(0);await a.client.documentSave((await a.client.documentReview(fields,bytes.toString('base64'))).reviewId);
 const bList=await b.client.documentList(0),oldChoice=bList.documents[0].choice;
 const old=await b.client.documentOrganize(oldChoice,{name:'Old edit.pdf',folder:'',tags:[]});
 const downloaded=[],panel=createDocumentPanel({client:a.client,download:(value,f)=>downloaded.push([Buffer.from(value),f])});t.after(()=>panel.reset());
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{documentAction:action}})}});await new Promise(r=>setImmediate(r));};
 const input=(field,value)=>panel.input({type:'input',target:{dataset:{documentField:field},value}});
 await click('open');input('text','HOUSEHOLD');input('collection','pdf');await click('search');
 assert.match(panel.render(),/Showing PDFs/);
 const choice=/data-document-action="organize-([^"]+)"/.exec(panel.render())[1];await click('organize-'+choice);
 input('name','Receipt filed.pdf');input('tags','Archive, Grocery');input('folder','');
 await click('review');assert.match(panel.render(),/Current ·.*Example receipt.pdf/);assert.match(panel.render(),/After saving ·.*Receipt filed.pdf/);
 await click('save');assert.match(panel.render(),/Document details saved/);
 await assert.rejects(b.client.documentSave(old.reviewId));await assert.rejects(b.client.documentDownload(oldChoice));
 input('collection','images');await click('search');assert.match(panel.render(),/No matches/);
 input('text','GROCERY');input('collection','unfiled');await click('search');
 const download=/data-document-action="get-([^"]+)"/.exec(panel.render())[1];await click('get-'+download);
 assert.deepEqual(downloaded,[[bytes,{...fields,name:'Receipt filed.pdf',folder:'',tags:['Archive','Grocery']}]]);
});
test('search can continue after an empty scan and revisit earlier pages without disclosing file bytes or IDs',async t=>{
 const {createDocumentLibrary}=await import('../server/private-document-library.mjs');
 const {createDocumentFixture}=await import('../tools/document-library-fixture.mjs');
 const storage=createDocumentFixture(),actor={ownerId:'fixture'},lib=createDocumentLibrary({storage});t.after(()=>lib.dispose());
 for(let i=0;i<102;i++){
  const data=Buffer.from('%PDF-1.5 sample '+i);
  const pending=await storage.prepare(actor,{...fields,bytes:data.length},data.toString('base64'));await storage.save(actor,pending.row);
 }
 let docs=[];for(let offset=0;offset<102;offset+=25)docs.push(...(await storage.list(actor,offset)).documents);
 const last=docs.at(-1);await storage.saveEdit(actor,await storage.prepareEdit(actor,last,{name:'Tail.pdf',folder:'',tags:['target']}));
 await lib.list('s',actor,0,Date.now()+300000);
 const filter={text:'target',collection:'all'},find=direction=>lib.search('s',actor,filter,direction);
 assert.equal((await find('first')).hasMore,true);
 const end=await find('next');assert.equal(end.documents.length,1);assert.equal(end.hasMore,false);assert.equal(end.hasPrevious,true);
 assert.deepEqual(Object.keys(end.documents[0]).sort(),['bytes','choice','folder','mime','name','tags']);
 const page=await find('previous');assert.deepEqual(page.documents,[]);assert.equal(page.hasMore,true);
 await assert.rejects(lib.download('s',actor,end.documents[0].choice));
 const all={text:'',collection:'pdf'},first=await lib.search('s',actor,all,'first');
 assert.equal(first.documents.length,25);const collected=[...first.documents];let current=first;
 while(current.hasMore){current=await lib.search('s',actor,all,'next');collected.push(...current.documents);}
 assert.equal(collected.length,102);assert.equal(collected.filter(d=>d.name==='Tail.pdf').length,1);
});

test('reviewed document favorites reopen the current original with its saved collection',async t=>{
 const collection='540fb908-c8c9-4e0a-a8c7-ade4caeb6793';
 const app=privateWorkspaceFixture(t,{allowDocuments:true,allowFavorites:true});
 const first=app.tab(),second=app.tab();
 await first.login();await second.login();
 const a=first.client,b=second.client;
 const layout=await a.favoritesRead();
 await a.favoritesSave((await a.favoritesReview({baseTag:layout.baseTag,layout:{...layout.layout,collections:[{id:collection,name:'Receipts'}]}})).reviewId);
 await a.documentList(0);
 await a.documentSave((await a.documentReview(fields,bytes.toString('base64'))).reviewId);
 const [file]=(await a.documentList(0)).documents;
 await assert.rejects(b.favoriteDocumentRead(file.choice));
 const selection=await a.favoriteDocumentRead(file.choice);
 const review=await a.favoriteDocumentReview({baseTag:selection.baseTag,favorite:true,members:[collection]});
 assert.deepEqual((await b.favoriteDocumentsList(0,collection)).documents,[]);
 await a.favoriteDocumentSave(review.reviewId);
 const [saved]=(await a.favoriteDocumentsList(0,collection)).documents;
 assert.deepEqual(Object.keys(saved).sort(),['collections','documentToken','title']);
 assert.deepEqual(saved.collections,['Receipts']);
 await assert.rejects(b.favoriteDocumentOpen(saved.documentToken));
 await assert.rejects(a.documentDownload(saved.documentToken));
 const [other]=(await b.documentList(0)).documents;
 const name='Renamed receipt.pdf';
 await b.documentSave((await b.documentOrganize(other.choice,{name,folder:fields.folder,tags:fields.tags})).reviewId);
 await assert.rejects(a.favoriteDocumentOpen(saved.documentToken));
 const fresh=await a.favoriteDocumentsList(0,collection);
 assert.equal(fresh.documents[0].title,name);
 const downloaded=[];
 const panel=createDocumentPanel({client:a,allowFavorites:true,download:data=>downloaded.push(Buffer.from(data))});
 t.after(()=>panel.reset());
 const key=fresh.documents[0].documentToken;
 await panel.openFavorite(key,fresh.documents[0],fresh.expiresAt);
 assert.match(panel.render(),/Renamed receipt.pdf/);
 assert.match(panel.render(),/Manage document favorite/);
 const choice=/data-document-action="get-([^"]+)"/.exec(panel.render())[1];
 panel.click({target:{closest:()=>({dataset:{documentAction:'get-'+choice}})}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(downloaded,[bytes]);
 await assert.rejects(a.favoriteDocumentOpen(key));
 const remove=await a.favoriteDocumentRead(choice);
 assert.deepEqual(remove.members,[collection]);
 await a.favoriteDocumentSave((await a.favoriteDocumentReview({baseTag:remove.baseTag,favorite:false,members:[]})).reviewId);
 assert.equal((await a.favoriteDocumentsList(0,collection)).count,0);
 assert.equal((await a.documentList(0)).documents[0].name,name);
 const off=privateWorkspaceFixture(t,{allowFavorites:true}).tab();await off.login();
 await assert.rejects(off.client.favoriteDocumentsList(0));
});
