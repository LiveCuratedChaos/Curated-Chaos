import test from 'node:test';
import assert from 'node:assert/strict';
import {GMAIL_READ_SCOPE,normalizeGmailMetadata,readGmailWindow} from '../server/gmail.mjs';
import {allowedPublicPath} from '../tools/local-server.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const config={ownerId,connectionId,grant:{ownerId,connectionId,provider:'gmail',scopes:[GMAIL_READ_SCOPE],labelIds:['Label_test']},selectedLabelIds:['Label_test'],accessToken:'fixture-token',timeMin:'2026-11-01T00:00:00Z',timeMax:'2026-11-09T00:00:00Z'};
const message=(id='abc123')=>({id,threadId:'thread123',internalDate:String(Date.parse('2026-11-08T14:00:00Z')),labelIds:['Label_test'],payload:{headers:[{name:'Subject',value:'Fictional appointment'},{name:'From',value:'Fictional sender <fixture@example.test>'}],body:{data:'must-never-leak'}},snippet:'private-snippet',raw:'private-raw'});
const response=data=>({ok:true,json:async()=>data});
test('Gmail importer is not public and requires owner-scoped read grants and selected labels',async()=>{
 assert.equal(allowedPublicPath('/server/gmail.mjs'),false);
 for(const change of [{grant:{...config.grant,ownerId:connectionId}},{grant:{...config.grant,scopes:[]}},{selectedLabelIds:[]},{selectedLabelIds:['INBOX']},{selectedLabelIds:['TRASH'],grant:{...config.grant,labelIds:['TRASH']}}]){
  await assert.rejects(readGmailWindow({...config,...change},()=>{throw Error('Must not fetch without approval')}),err=>!err.message.includes('Must not fetch'));
 }
});
test('Gmail metadata excludes body, raw content, snippets and tokens; identities stay private',()=>{
 const r=normalizeGmailMetadata(message(),config);
 assert.equal(r.subject,'Fictional appointment');assert.equal(r.visibility,'private');
 assert.doesNotMatch(JSON.stringify(r),/must-never-leak|private-snippet|private-raw|fixture-token/);
 assert.notEqual(r.key,normalizeGmailMetadata(message(),{...config,connectionId:ownerId}).key);
 assert.notEqual(r.key,normalizeGmailMetadata(message(),{...config,ownerId:connectionId}).key);
});
test('Gmail reads all pages, deduplicates IDs, requests metadata only and uses only GET',async()=>{
 const calls=[];let page=0;
 const r=await readGmailWindow(config,async(url,options)=>{const u=new URL(url);calls.push({u,options});if(u.pathname.endsWith('/messages'))return response(++page===1?{messages:[{id:'abc123'}],nextPageToken:'next'}:{messages:[{id:'abc123'},{id:'def456'}]});return response(message(u.pathname.split('/').at(-1)));});
 assert.equal(r.messages.length,2);assert.equal(r.complete,true);assert.equal(calls.length,4);
 for(const {u,options} of calls){assert.equal(u.origin,'https://gmail.googleapis.com');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.doesNotMatch(u.href,/fixture-token/);}
 const get=calls.at(-1).u;assert.equal(get.searchParams.get('format'),'metadata');assert.deepEqual(get.searchParams.getAll('metadataHeaders'),['Subject','From']);
 assert.deepEqual(calls[0].u.searchParams.getAll('labelIds'),['Label_test']);assert.match(calls[0].u.searchParams.get('q'),/after:\d+ before:\d+/);
});
test('Gmail skips messages that moved outside selected labels, exact time bounds or allowed folders',async()=>{
 for(const changed of [{labelIds:['INBOX']},{labelIds:['Label_test','TRASH']},{internalDate:String(Date.parse(config.timeMax))}]){
  const r=await readGmailWindow(config,async url=>response(new URL(url).pathname.endsWith('/messages')?{messages:[{id:'abc123'}]}:{...message(),...changed}));assert.equal(r.messages.length,0);
 }
});
test('failed detail reads reject the whole result without echoing private provider errors',async()=>{
 await assert.rejects(readGmailWindow(config,async url=>new URL(url).pathname.endsWith('/messages')?response({messages:[{id:'abc123'}]}):{ok:false,status:500,json:async()=>({message:'private-provider-secret'})}),err=>/No partial/.test(err.message)&&!err.message.includes('private-provider-secret'));
});
test('Gmail rejects looping pagination, mismatched message IDs and ambiguous headers',async()=>{
 await assert.rejects(readGmailWindow(config,async()=>response({messages:[],nextPageToken:'same'})),/pagination/);
 await assert.rejects(readGmailWindow(config,async url=>response(new URL(url).pathname.endsWith('/messages')?{messages:[{id:'abc123'}]}:message('different'))),/identity changed/);
 const m=message();m.payload.headers.push({name:'subject',value:'Conflicting subject'});assert.throws(()=>normalizeGmailMetadata(m,config),/ambiguous/);
});
test('Gmail rejects invalid and oversized windows before any request',async()=>{
 for(const changes of [{timeMin:'2026-02-30T00:00:00Z'},{timeMax:'2027-01-01T00:00:00Z'},{timeMin:config.timeMax},{timeMin:'2026-11-01T00:00:00'}])await assert.rejects(readGmailWindow({...config,...changes},()=>{throw Error('Must not fetch')}),err=>!err.message.includes('Must not fetch'));
});
