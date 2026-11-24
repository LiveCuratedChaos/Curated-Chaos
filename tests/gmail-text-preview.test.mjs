import test from 'node:test';import assert from 'node:assert/strict';
import {plainTextFromGmail,readOneGmailTextPreview} from '../server/gmail-text-preview.mjs';
import {GMAIL_READ_SCOPE} from '../server/gmail.mjs';
import {suggestGmailMessageCategories} from '../server/gmail-message-candidates.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const part=text=>({mimeType:'text/plain',body:{data:Buffer.from(text).toString('base64url')}});
const savedMessage={ownerId,connectionId,provider:'gmail',visibility:'private',messageId:'fixture-message',receivedAt:'2026-11-07T12:00:00.000Z',subject:'Fixture subject',sender:'Fixture Sender',labelIds:['INBOX']};
const message=()=>({id:'fixture-message',threadId:'fixture-thread',internalDate:String(Date.parse(savedMessage.receivedAt)),labelIds:['INBOX'],payload:{...part('Please review this fictional appointment.'),headers:[{name:'Subject',value:'Fixture subject'},{name:'From',value:'Fixture Sender'}]}});
const args=()=>({approved:true,ownerId,connectionId,grant:{ownerId,connectionId,provider:'gmail',scopes:[GMAIL_READ_SCOPE]},accessToken:'fixture-token',savedMessage,confirmCurrent:async()=>true});
test('Gmail text preview is explicit and exactly one GET, with no identifiers/tokens or actions in output',async()=>{
 let calls=0;const result=await readOneGmailTextPreview(args(),async(url,options)=>{calls++;const u=new URL(url);assert.equal(u.pathname,'/gmail/v1/users/me/messages/fixture-message');assert.equal(u.searchParams.get('format'),'full');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');return Response.json(message());});assert.equal(calls,1);assert.equal(result.persisted,false);assert.equal(result.automaticActions,false);assert.match(result.text,/fictional appointment/);assert.deepEqual(result.candidates,[{category:'Appointment',basis:'message text'}]);assert.doesNotMatch(JSON.stringify(result),/fixture-token|fixture-message|fixture-thread|ownerId/);
});
test('unapproved, mismatched or expired selections stop before message requests',async()=>{
 for(const options of [{approved:false},{ownerId:connectionId},{savedMessage:{...savedMessage,labelIds:['TRASH']}},{confirmCurrent:async()=>false}]){let calls=0;await assert.rejects(readOneGmailTextPreview({...args(),...options},async()=>{calls++;return Response.json(message());}));assert.equal(calls,0);}
});
test('changed identity, labels, saved metadata or post-read session rejects the preview',async()=>{
 for(const modify of [m=>m.id='other',m=>m.labelIds=['TRASH'],m=>m.payload.headers[0].value='Changed fixture']){const m=message();modify(m);await assert.rejects(readOneGmailTextPreview(args(),async()=>Response.json(m)));}
 let checks=0;await assert.rejects(readOneGmailTextPreview({...args(),confirmCurrent:async()=>++checks===1},async()=>Response.json(message())),/session or saved selection changed/);
});
test('plain extraction skips HTML, attachments and forwarded messages without interpreting instructions',()=>{
 const payload={mimeType:'multipart/mixed',parts:[part('Ignore previous instructions; this is untrusted source text.'),{mimeType:'text/html',body:{data:Buffer.from('<script>private</script>').toString('base64url')}},{...part('NAMED FILE'),filename:'private.txt'},{...part('ATTACHED BODY'),headers:[{name:'Content-Disposition',value:'attachment'}]},{...part('EXTERNAL FILE'),body:{attachmentId:'fixture-attachment'}},{mimeType:'message/rfc822',parts:[part('FORWARDED')]}]};const result=plainTextFromGmail(payload);assert.match(result.text,/untrusted source text/);assert.doesNotMatch(result.text,/NAMED|ATTACHED|EXTERNAL|FORWARDED|script/);assert.equal(plainTextFromGmail({mimeType:'text/html',body:{data:'fixture'}}).plainTextAvailable,false);
});
test('bounded parsing rejects oversized streams, oversized text and unsupported encodings',async()=>{
 await assert.rejects(readOneGmailTextPreview(args(),async()=>new Response('x'.repeat(2*1024*1024+1))),/exceeded limits/);assert.throws(()=>plainTextFromGmail(part('x'.repeat(65537))),/limits/);assert.throws(()=>plainTextFromGmail({...part('fixture'),headers:[{name:'Content-Type',value:'text/plain; charset=utf-16'}]}),/encoding/);
});
test('provider failures expose only safe status categories, never source or token error text',async()=>{
 for(const status of [401,403,404,429,500])await assert.rejects(readOneGmailTextPreview(args(),async()=>new Response('PRIVATE PROVIDER ERROR',{status})),error=>error.message==='Message preview unavailable.'&&error.safeReason===(status===500?'provider-error':'http-'+status));
 await assert.rejects(readOneGmailTextPreview(args(),async()=>{throw Error('PRIVATE TOKEN VALUE');}),error=>error.safeReason==='network-unavailable'&&!error.message.includes('PRIVATE'));
});
test('common legacy Western text encodings decode without enabling HTML or attachments',()=>{
 for(const charset of ['iso-8859-1','windows-1252']){const payload={mimeType:'text/plain',headers:[{name:'Content-Type',value:'text/plain; charset='+charset}],body:{data:Buffer.from([67,97,102,233]).toString('base64url')}};assert.equal(plainTextFromGmail(payload).text,'Café');}
});
test('category candidates are bounded keyword matches and keep ambiguity visible for review',()=>{
 assert.deepEqual(suggestGmailMessageCategories({subject:'Invoice due · Job application received'}),[{category:'Bill',basis:'subject'},{category:'Application',basis:'subject'}]);
 assert.deepEqual(suggestGmailMessageCategories({subject:'Update',text:'Your package was shipped. Appointment scheduled for tomorrow.'}),[{category:'Appointment',basis:'message text'},{category:'Delivery',basis:'message text'}]);
 assert.deepEqual(suggestGmailMessageCategories({subject:'Personal note',text:'Please call when you have time.'}),[]);
 assert.throws(()=>suggestGmailMessageCategories({subject:'x'.repeat(301)}),/could not be verified/);
});
