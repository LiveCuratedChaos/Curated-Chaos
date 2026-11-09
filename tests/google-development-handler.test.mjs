import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,lstat,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OAuth2Client} from 'google-auth-library';
import {createLocalProviderStore} from '../server/local-provider-store.mjs';
import {makeGoogleDevelopmentHandler} from '../server/google-development-handler.mjs';
import {makeConnectionsServer,GOOGLE_CALLBACK} from '../tools/connections-server.mjs';
import {GMAIL_READ_SCOPE} from '../server/gmail.mjs';
const origin='http://127.0.0.1:5301',ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function call(handler,path,{method='GET',headers={},body={}}={}){
 const req={url:path,method,headers:{host:'127.0.0.1:5301',...headers},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}};
 const res={writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(body){this.body=body;}};
 assert.equal(await handler(req,res),true);return res;
}
async function configured(t,options={}){
 const dir=await mkdtemp(join(tmpdir(),'cc-google-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const stores=await createLocalProviderStore(dir),control={valid:true,exchanges:0};
 const oauthClient={generateCodeVerifierAsync:async()=>({codeVerifier:'fixture-verifier',codeChallenge:'fixture-challenge'}),generateAuthUrl(options){control.options=options;return 'https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({state:options.state});},async getToken(){control.exchanges++;return {tokens:{id_token:'fixture-id',refresh_token:'fixture-refresh',scope:'openid email '+GMAIL_READ_SCOPE}};},verifyIdToken:async()=>({getPayload:()=>({sub:'fixture-subject',email:'fixture@example.test',email_verified:true,nonce:control.options.nonce})})};
 const handler=makeGoogleDevelopmentHandler({origin,stores,oauthClient,clientId:'fixture.apps.googleusercontent.com',supabaseOrigin:'https://devproject123.supabase.co',devApi:{getUser:async token=>control.valid&&token==='fixture-access'?{id:ownerId}:null},...options});
 const login=await call(handler,'/auth/google/session',{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer fixture-access'}});
 assert.equal(login.status,200);
 const cookie=login.headers['Set-Cookie'].split(';')[0],csrf=JSON.parse(login.body).csrf;
 return {handler,control,stores,dir,cookie,csrf,headers:{origin,'content-type':'application/json',cookie,'x-cc-csrf':csrf}};
}
test('unconfigured Google gateway is honest and does not expose server files',async()=>{
 const h=makeGoogleDevelopmentHandler({origin});
 const r=await call(h,'/auth/google/status');assert.equal(JSON.parse(r.body).configured,false);
 const denied=await call(h,'/auth/google/status',{headers:{host:'evil.example'}});assert.equal(denied.status,403);
 assert.equal(await h({url:'/.local/google-oauth.json'},{}),false);
});
test('development gateway rejects cross-site bootstrap and missing CSRF',async t=>{
 const s=await configured(t);
 const cross=await call(s.handler,'/auth/google/session',{method:'POST',headers:{origin:'https://other.example','content-type':'application/json',authorization:'Bearer fixture-access'}});assert.equal(cross.status,403);
 const denied=await call(s.handler,'/auth/google/begin',{method:'POST',headers:{origin,'content-type':'application/json',cookie:s.cookie},body:{provider:'gmail'}});assert.equal(denied.status,403);
});
test('Google callback requires the app cookie, verifies the flow, and returns no tokens',async t=>{
 const s=await configured(t);
 const begin=await call(s.handler,'/auth/google/begin',{method:'POST',headers:s.headers,body:{provider:'gmail',ownerId:'ignored-browser-owner'}});
 const state=new URL(JSON.parse(begin.body).authorizationUrl).searchParams.get('state'),path='/auth/google/callback?state='+state+'&code=fixture-code';
 const noCookie=await call(s.handler,path);assert.equal(noCookie.status,401);assert.equal(s.control.exchanges,0);
 const done=await call(s.handler,path,{headers:{cookie:s.cookie}});assert.equal(done.status,303);assert.equal(done.headers.Location,'/auth/google/?result=authorized');assert.doesNotMatch(done.body,/fixture-refresh|fixture-id/);
 const replay=await call(s.handler,path,{headers:{cookie:s.cookie}});assert.equal(replay.status,400);assert.equal(s.control.exchanges,1);
 const status=JSON.parse((await call(s.handler,'/auth/google/status',{headers:{cookie:s.cookie}})).body);
 assert.equal(status.connections.length,1);assert.equal(status.connections[0].selectionRequired,true);assert.doesNotMatch(JSON.stringify(status),/fixture-refresh|fixture-access/);
});
test('revoked app sessions do not disclose connection metadata',async t=>{
 const s=await configured(t);s.control.valid=false;
 const result=JSON.parse((await call(s.handler,'/auth/google/status',{headers:{cookie:s.cookie}})).body);
 assert.equal(result.signedIn,false);assert.deepEqual(result.connections,[]);
});
test('optional database session guard rejects revoked bootstrap tokens and hides saved sources after revocation',async t=>{
 let active=true,reads=0;const devApi={getUser:async()=>({id:ownerId}),isSessionActive:async()=>active};
 const s=await configured(t,{requireActiveSession:true,devApi,providerRepository:{listSaved:async()=>{reads++;return[];}}});
 active=false;
 const status=JSON.parse((await call(s.handler,'/auth/google/status',{headers:{cookie:s.cookie}})).body);assert.equal(status.signedIn,false);assert.deepEqual(status.connections,[]);
 const records=await call(s.handler,'/auth/google/records',{headers:{cookie:s.cookie}});assert.equal(records.status,401);assert.equal(reads,0);
 const bootstrap=await call(s.handler,'/auth/google/session',{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer fixture-access'}});assert.equal(bootstrap.status,401);assert.equal(bootstrap.headers['Set-Cookie'],undefined);
});
test('optional database session guard fails closed when its check fails',async t=>{
 let fail=false;const s=await configured(t,{requireActiveSession:true,devApi:{getUser:async()=>({id:ownerId}),isSessionActive:async()=>{if(fail)throw Error('Fictional unavailable check');return true;}}});fail=true;
 assert.equal(JSON.parse((await call(s.handler,'/auth/google/status',{headers:{cookie:s.cookie}})).body).signedIn,false);
});
test('a revoked password login cannot issue a new private-connection cookie',async t=>{
 let active=true;const s=await configured(t,{requireActiveSession:true,devApi:{getUser:async()=>({id:ownerId}),isSessionActive:async()=>active,signIn:async()=>({accessToken:'fixture-access',expiresAt:Date.now()+60000})}});active=false;
 const login=await call(s.handler,'/auth/google/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:{email:'fictional@example.test',password:'fictional-password'}});assert.notEqual(login.status,200);assert.equal(login.headers['Set-Cookie'],undefined);
});
test('revocation while saved records are loading withholds their late response',async t=>{
 let active=true,release;const s=await configured(t,{requireActiveSession:true,devApi:{getUser:async()=>({id:ownerId}),isSessionActive:async()=>active},providerRepository:{listSaved:async()=>new Promise(resolve=>release=resolve)}});
 const pending=call(s.handler,'/auth/google/records',{headers:{cookie:s.cookie}});while(!release)await new Promise(resolve=>setImmediate(resolve));active=false;release([]);assert.equal((await pending).status,401);
});
test('sign-out during the database session check cannot revive a gateway session',async t=>{
 let release;const devApi={getUser:async()=>({id:ownerId}),isSessionActive:async()=>true};const s=await configured(t,{requireActiveSession:true,devApi});
 devApi.isSessionActive=()=>new Promise(resolve=>release=resolve);const pending=call(s.handler,'/auth/google/status',{headers:{cookie:s.cookie}});while(!release)await new Promise(resolve=>setImmediate(resolve));
 await call(s.handler,'/auth/google/signout',{method:'POST',headers:s.headers});release(true);assert.equal(JSON.parse((await pending).body).signedIn,false);
});
test('active session checks require an explicit development target before opening local stores',async()=>{
 await assert.rejects(makeConnectionsServer('/fictional/missing-root',{requireActiveSession:true}),/Exact development target/);
 assert.throws(()=>makeGoogleDevelopmentHandler({origin,requireActiveSession:true}),/checker required/);
});
test('local state consumption is atomic and local encryption keys are private and stable',async t=>{
 const s=await configured(t),key='a'.repeat(64);
 await s.stores.stateStore.put(key,{encrypted:'fixture-encrypted'});
 const results=await Promise.all([s.stores.stateStore.consume(key),s.stores.stateStore.consume(key)]);
 assert.equal(results.filter(Boolean).length,1);
 const first=await readFile(join(s.dir,'encryption-key'));await createLocalProviderStore(s.dir);
 assert.deepEqual(await readFile(join(s.dir,'encryption-key')),first);assert.equal((await lstat(join(s.dir,'encryption-key'))).mode&0o077,0);
 assert.deepEqual((await readdir(s.dir)).filter(name=>name.includes('state')||name.includes('claimed')),[]);
});
test('official Google library generates the expected exact development callback',async()=>{
 const client=new OAuth2Client({clientId:'fixture.apps.googleusercontent.com',clientSecret:'fixture-secret',redirectUri:GOOGLE_CALLBACK});
 const pkce=await client.generateCodeVerifierAsync();assert.ok(pkce.codeVerifier.length>=43);
 const url=new URL(client.generateAuthUrl({scope:[GMAIL_READ_SCOPE],state:'fixture',code_challenge:pkce.codeChallenge,code_challenge_method:'S256'}));
 assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('redirect_uri'),'http://127.0.0.1:5301/auth/google/callback');assert.doesNotMatch(url.href,/fixture-secret/);
});
test('connection server starts unconfigured without creating secret files',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'cc-unconfigured-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const server=await makeConnectionsServer(dir);server.close();assert.deepEqual(await readdir(dir),[]);
});
test('source selections stay encrypted, owner-bound and separate from import authorization',async t=>{
 const s=await configured(t),connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 await s.stores.connectionStore.insert({ownerId,connectionId,provider:'gmail',encrypted:s.stores.sealer.seal({refreshToken:'fixture-refresh',email:'fixture@example.test'},'provider:'+ownerId+':'+connectionId)});
 const selection={source:'INBOX',startDate:'2026-11-01',endDate:'2026-11-08',importApproved:true};
 await assert.rejects(s.stores.connectionStore.saveSelection('cccccccc-cccc-4ccc-8ccc-cccccccccccc',connectionId,selection));
 const noCsrf=await call(s.handler,'/auth/google/selection',{method:'POST',headers:{origin,'content-type':'application/json',cookie:s.cookie},body:{connectionId,selection}});assert.equal(noCsrf.status,403);
 const saved=await call(s.handler,'/auth/google/selection',{method:'POST',headers:s.headers,body:{connectionId,selection}});
 assert.equal(saved.status,200);const data=JSON.parse(saved.body);assert.equal(data.importStarted,false);assert.equal(data.selection.importApproved,false);
 const file=(await readdir(s.dir)).find(name=>name.endsWith('.selection'));assert.ok(file);
 const bytes=await readFile(join(s.dir,file),'utf8');assert.doesNotMatch(bytes,/INBOX|2026-11|fixture-refresh/);assert.equal((await lstat(join(s.dir,file))).mode&0o077,0);
 const row=JSON.parse(bytes),payload=s.stores.sealer.unseal(row.encrypted,'selection:'+ownerId+':'+row.selectionId);assert.deepEqual(payload.selection.labelIds,['INBOX']);
 s.control.valid=false;
 const revoked=await call(s.handler,'/auth/google/selection',{method:'POST',headers:s.headers,body:{connectionId,selection}});assert.equal(revoked.status,401);
 assert.equal((await readdir(s.dir)).filter(name=>name.endsWith('.selection')).length,1);
});
test('saved source choices survive reopening the store and cannot load for another owner',async t=>{
 const s=await configured(t),connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 await s.stores.connectionStore.insert({ownerId,connectionId,provider:'gmail',scope:GMAIL_READ_SCOPE,encrypted:s.stores.sealer.seal({refreshToken:'fixture-refresh',email:'fixture@example.test'},'provider:'+ownerId+':'+connectionId)});
 const saved=await s.stores.connectionStore.saveSelection(ownerId,connectionId,{source:'INBOX',startDate:'2026-11-01',endDate:'2026-11-08'});
 const reopened=await createLocalProviderStore(s.dir),rows=await reopened.connectionStore.listOwner(ownerId);
 assert.equal(rows[0].selectionRequired,false);assert.equal(rows[0].sourceSelection.selectionId,saved.selectionId);
 assert.equal((await reopened.connectionStore.loadSelected(ownerId,connectionId,saved.selectionId)).selection.timeMin,'2026-11-01T00:00:00.000Z');
 await assert.rejects(reopened.connectionStore.loadSelected('dddddddd-dddd-4ddd-8ddd-dddddddddddd',connectionId,saved.selectionId));
 assert.deepEqual(await reopened.connectionStore.listOwner('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),[]);
 assert.doesNotMatch(JSON.stringify(rows),/fixture-refresh/);
});
test('rapid source saves retain order and reject older preview choices',async t=>{
 const s=await configured(t),connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 await s.stores.connectionStore.insert({ownerId,connectionId,provider:'gmail',scope:GMAIL_READ_SCOPE,encrypted:s.stores.sealer.seal({refreshToken:'fixture-refresh',email:'fixture@example.test'},'provider:'+ownerId+':'+connectionId)});
 const saved=await Promise.all(Array.from({length:12},(_,i)=>s.stores.connectionStore.saveSelection(ownerId,connectionId,{source:'INBOX',startDate:'2026-11-01',endDate:'2026-11-'+String(i+2).padStart(2,'0')})));
 const row=(await s.stores.connectionStore.listOwner(ownerId))[0];assert.equal(row.sourceSelection.selectionId,saved.at(-1).selectionId);assert.equal(row.sourceSelection.selection.timeMax,'2026-11-13T00:00:00.000Z');
 await assert.rejects(s.stores.connectionStore.loadSelected(ownerId,connectionId,saved[0].selectionId),/changed/);
});
test('pause is owner-bound, survives restart and blocks reads without deleting credentials',async t=>{
 const s=await configured(t),connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 await s.stores.connectionStore.insert({ownerId,connectionId,provider:'gmail',scope:GMAIL_READ_SCOPE,encrypted:s.stores.sealer.seal({refreshToken:'fixture-refresh',email:'fixture@example.test'},'provider:'+ownerId+':'+connectionId)});
 const input={source:'INBOX',startDate:'2026-11-01',endDate:'2026-11-08'},saved=await s.stores.connectionStore.saveSelection(ownerId,connectionId,input);
 await assert.rejects(s.stores.connectionStore.setPaused('dddddddd-dddd-4ddd-8ddd-dddddddddddd',connectionId,true));
 const denied=await call(s.handler,'/auth/google/pause',{method:'POST',headers:{origin,'content-type':'application/json',cookie:s.cookie},body:{connectionId,paused:true}});assert.equal(denied.status,403);
 const paused=await call(s.handler,'/auth/google/pause',{method:'POST',headers:s.headers,body:{connectionId,paused:true}});assert.equal(paused.status,200);assert.equal(JSON.parse(paused.body).googleGrantRevoked,false);
 const reopened=await createLocalProviderStore(s.dir);assert.equal((await reopened.connectionStore.listOwner(ownerId))[0].status,'paused');
 await assert.rejects(reopened.connectionStore.loadSelected(ownerId,connectionId,saved.selectionId),/paused/);
 await assert.rejects(reopened.connectionStore.saveSelection(ownerId,connectionId,input),/paused/);
 await reopened.connectionStore.setPaused(ownerId,connectionId,false);assert.equal((await reopened.connectionStore.loadSelected(ownerId,connectionId,saved.selectionId)).credentials.refreshToken,'fixture-refresh');
 assert.equal((await readdir(s.dir)).filter(x=>x.endsWith('.connection')).length,1);
 s.control.valid=false;const revoked=await call(s.handler,'/auth/google/pause',{method:'POST',headers:s.headers,body:{connectionId,paused:true}});assert.equal(revoked.status,401);
});
test('saved source endpoint rechecks identity and never reads Google or returns raw payloads',async t=>{
 let calls=0;const repository={listSaved:async(actor,owner)=>{calls++;assert.equal(actor.accessToken,'fixture-access');assert.equal(owner,ownerId);return [{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',owner_id:ownerId,visibility:'private',household_id:null,item_type:'provider_email',origin:'google_import_qa',payload:{fictional:true,fixtureRunId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',provider:'gmail',connectionId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',sourceId:'fixture-id',content:{subject:'Fictional saved item',sender:'fixture@example.test',receivedAt:'2026-11-03T12:00:00.000Z'},refreshToken:'must-stay-private'}}];}};
 const s=await configured(t,{providerRepository:repository});const denied=await call(s.handler,'/auth/google/records');assert.equal(denied.status,401);assert.equal(calls,0);
 const saved=await call(s.handler,'/auth/google/records',{headers:{cookie:s.cookie}});assert.equal(saved.status,200);assert.equal(JSON.parse(saved.body).googleRead,false);assert.equal(JSON.parse(saved.body).records.length,1);assert.doesNotMatch(saved.body,/must-stay-private|refreshToken/);assert.equal(s.control.exchanges,0);
 s.control.valid=false;const revoked=await call(s.handler,'/auth/google/records',{headers:{cookie:s.cookie}});assert.equal(revoked.status,401);assert.equal(calls,1);
});
test('server-held development login returns only an HttpOnly session and CSRF, never app tokens',async t=>{
 const s=await configured(t,{devApi:{signIn:async(email,password)=>{assert.equal(email,'fixture@example.test');assert.equal(password,'fixture-password');return {accessToken:'fixture-access',refreshToken:'fixture-private-refresh',expiresAt:Date.now()+3600000};},getUser:async token=>token==='fixture-access'?{id:ownerId}:null}});
 const cross=await call(s.handler,'/auth/google/login',{method:'POST',headers:{origin:'https://other.example','content-type':'application/json'},body:{email:'fixture@example.test',password:'fixture-password'}});assert.equal(cross.status,403);
 const login=await call(s.handler,'/auth/google/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:{email:'fixture@example.test',password:'fixture-password'}});assert.equal(login.status,200);assert.match(login.headers['Set-Cookie'],/HttpOnly; SameSite=Lax/);assert.doesNotMatch(login.body,/fixture-access|fixture-private-refresh|fixture-password/);
 assert.match(login.headers['Content-Security-Policy'],/connect-src 'self';/);assert.doesNotMatch(login.headers['Content-Security-Policy'],/supabase/);
 const cookie=login.headers['Set-Cookie'].split(';')[0],status=await call(s.handler,'/auth/google/status',{headers:{cookie}});assert.equal(JSON.parse(status.body).signedIn,true);assert.match(JSON.parse(status.body).legacySessionKey,/^cc_m0e_dev_session_/);
 const csrf=JSON.parse(login.body).csrf;const logout=await call(s.handler,'/auth/google/signout',{method:'POST',headers:{origin,'content-type':'application/json',cookie,'x-cc-csrf':csrf}});assert.equal(logout.status,200);assert.equal(JSON.parse((await call(s.handler,'/auth/google/status',{headers:{cookie}})).body).signedIn,false);
});
test('development login attempts are bounded and sessions expire at the earlier token expiry',async t=>{
 let clock=100;const s=await configured(t,{now:()=>clock,devApi:{signIn:async()=>({accessToken:'fixture-access',refreshToken:'fixture-private-refresh',expiresAt:clock+1000}),getUser:async token=>token==='fixture-access'?{id:ownerId}:null}});
 let login;for(let i=0;i<5;i++){login=await call(s.handler,'/auth/google/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:{email:'fixture@example.test',password:'fixture-password'}});assert.equal(login.status,200);}
 const denied=await call(s.handler,'/auth/google/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:{email:'fixture@example.test',password:'fixture-password'}});assert.equal(denied.status,429);
 const cookie=login.headers['Set-Cookie'].split(';')[0];clock+=1001;assert.equal(JSON.parse((await call(s.handler,'/auth/google/status',{headers:{cookie}})).body).signedIn,false);
 const script=await call(s.handler,'/auth/google/ui.mjs');assert.doesNotMatch(script.body,/sessionStorage\.(?:setItem|getItem)|createDevSessionManager|getAccessToken/);assert.match(script.body,/sessionStorage.removeItem/);
});
test('real-source save routes compare cached items but cannot write without exact server approval',async t=>{
 const rows=[];let writes=0;
 const providerRepository={readByIds:async(_actor,owner,ids)=>structuredClone(rows.filter(r=>r.owner_id===owner&&ids.includes(r.id))),insertMany:async(_actor,_owner,records)=>{writes++;const inserted=records.map(r=>({...structuredClone(r),version:1,deleted_at:null}));rows.push(...inserted);return inserted;}};
 const previewFetcher=async url=>({ok:true,json:async()=>new URL(url).pathname.endsWith('/messages')?{messages:[{id:'fixture-message'}]}:{id:'fixture-message',threadId:'fixture-thread',internalDate:String(Date.parse('2026-11-03T12:00:00Z')),labelIds:['INBOX'],payload:{headers:[{name:'Subject',value:'Fixture real-source pathway'},{name:'From',value:'fixture@example.test'}]}}});
 const s=await configured(t,{providerRepository,previewFetcher,refreshAccessToken:async()=> 'fixture-google-access'}),connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 await s.stores.connectionStore.insert({ownerId,connectionId,provider:'gmail',scope:GMAIL_READ_SCOPE,encrypted:s.stores.sealer.seal({refreshToken:'fixture-refresh',email:'fixture@example.test'},'provider:'+ownerId+':'+connectionId)});
 const selection=await s.stores.connectionStore.saveSelection(ownerId,connectionId,{source:'INBOX',startDate:'2026-11-01',endDate:'2026-11-08'});
 async function prepareAndSave(handler,headers,enabled){
  const preview=await call(handler,'/auth/google/preview',{method:'POST',headers,body:{connectionId,selectionId:selection.selectionId,confirmed:true}});assert.equal(preview.status,200);const data=JSON.parse(preview.body);
  const review=await call(handler,'/auth/google/save-review',{method:'POST',headers,body:{previewId:data.previewId,selectedKeys:[data.result.messages[0].key]}});assert.equal(review.status,200);const prepared=JSON.parse(review.body);assert.equal(prepared.saveEnabled,enabled);assert.equal(writes,0);
  return call(handler,'/auth/google/save',{method:'POST',headers,body:{reviewId:prepared.reviewId,approved:true}});
 }
 const blocked=await prepareAndSave(s.handler,s.headers,false);assert.equal(blocked.status,400);assert.equal(writes,0);
 const approved=makeGoogleDevelopmentHandler({origin,stores:s.stores,clientId:'fixture.apps.googleusercontent.com',oauthClient:new OAuth2Client({clientId:'fixture.apps.googleusercontent.com'}),supabaseOrigin:'https://devproject123.supabase.co',devApi:{getUser:async token=>token==='fixture-access'?{id:ownerId}:null},providerRepository,previewFetcher,refreshAccessToken:async()=> 'fixture-google-access',approvedImportSelections:[selection.selectionId],maxReviewedImportItems:1});
 const login=await call(approved,'/auth/google/session',{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer fixture-access'}});
 const headers={origin,'content-type':'application/json',cookie:login.headers['Set-Cookie'].split(';')[0],'x-cc-csrf':JSON.parse(login.body).csrf};
 const saved=await prepareAndSave(approved,headers,true);assert.equal(saved.status,200);assert.equal(writes,1);assert.equal(rows.length,1);
});
test('saved financial endpoint requires verified owner and keeps finance separate from Google records',async t=>{
 let calls=0;const repository={listSavedFinance:async(actor,owner)=>{calls++;assert.equal(actor.accessToken,'fixture-access');assert.equal(owner,ownerId);return [];}};
 const s=await configured(t,{providerRepository:repository,financeRepository:repository});const denied=await call(s.handler,'/auth/google/finance-records');assert.equal(denied.status,401);assert.equal(calls,0);
 const page=await call(s.handler,'/auth/google/finances/',{headers:{cookie:s.cookie}});assert.equal(page.status,200);assert.match(page.body,/Saved financial snapshots/);assert.doesNotMatch(page.body,/accessToken|fixture-access/);
 const data=JSON.parse((await call(s.handler,'/auth/google/finance-records',{headers:{cookie:s.cookie}})).body);assert.equal(data.saved,true);assert.deepEqual(data.accounts,[]);assert.deepEqual(data.transactions,[]);assert.equal(s.control.exchanges,0);
 s.control.valid=false;assert.equal((await call(s.handler,'/auth/google/finance-records',{headers:{cookie:s.cookie}})).status,401);assert.equal(calls,1);
});
test('saved-source brief reads only private saved repositories and excludes credentials and fixtures',async t=>{
 let reads=0;const s=await configured(t,{providerRepository:{listSaved:async()=>{reads++;return[];}},financeRepository:{listSavedFinance:async()=>{reads++;return[];}}});
 const denied=await call(s.handler,'/auth/google/saved-brief');assert.equal(denied.status,401);assert.equal(reads,0);
 const allowed=await call(s.handler,'/auth/google/saved-brief?day=2026-11-08',{headers:{cookie:s.cookie}});assert.equal(allowed.status,200);const data=JSON.parse(allowed.body);assert.equal(data.providerRead,false);assert.equal(data.timeZone,'UTC');assert.equal(data.financialAccounts,0);assert.equal(reads,2);assert.doesNotMatch(allowed.body,/fixture-access|owner_id|amountMinor|sender/);assert.equal(allowed.headers['Cache-Control'],'no-store');
});
test('saved-source brief rejects responses after sign-in is revoked during reads',async t=>{
 let s;s=await configured(t,{providerRepository:{listSaved:async()=>{s.control.valid=false;return[];}},financeRepository:{listSavedFinance:async()=>[]}});
 const result=await call(s.handler,'/auth/google/saved-brief',{headers:{cookie:s.cookie}});assert.equal(result.status,401);assert.doesNotMatch(result.body,/financialAccounts/);
});
test('slow identity confirmation cannot validate a session signed out or expired during the check',async t=>{
 for(const outcome of ['signout','expiry']){
  let delay=false,release,clock=1000,started;const checking=new Promise(resolve=>started=resolve),gate=new Promise(resolve=>release=resolve);
  const s=await configured(t,{now:()=>clock,devApi:{getUser:async()=>{if(delay){started();await gate;}return{id:ownerId};}}});delay=true;
  const pending=call(s.handler,'/auth/google/status',{headers:{cookie:s.cookie}});await checking;
  if(outcome==='signout')assert.equal((await call(s.handler,'/auth/google/signout',{method:'POST',headers:s.headers})).status,200);else clock+=31*60000;
  release();const result=JSON.parse((await pending).body);assert.equal(result.signedIn,false);assert.equal(result.csrf,null);assert.deepEqual(result.connections,[]);
 }
});
test('connection labels are withheld if sign-out occurs during the storage read',async t=>{
 const s=await configured(t);let release,started;const reading=new Promise(resolve=>started=resolve),gate=new Promise(resolve=>release=resolve);
 s.stores.connectionStore.listOwner=async()=>{started();await gate;return[{accountLabel:'PRIVATE FIXTURE LABEL'}];};
 const pending=call(s.handler,'/auth/google/status',{headers:{cookie:s.cookie}});await reading;
 await call(s.handler,'/auth/google/signout',{method:'POST',headers:s.headers});release();const result=await pending;assert.equal(JSON.parse(result.body).signedIn,false);assert.doesNotMatch(result.body,/PRIVATE FIXTURE LABEL/);
});
test('saved Brief validates time zone before saved reads and returns the selected local day',async t=>{
 let reads=0;const s=await configured(t,{now:()=>Date.parse('2026-11-09T02:00:00Z'),providerRepository:{listSaved:async()=>{reads++;return[];}},financeRepository:{listSavedFinance:async()=>{reads++;return[];}}});const bad=await call(s.handler,'/auth/google/saved-brief?day=2026-11-08&timeZone=Invalid%2FZone',{headers:{cookie:s.cookie}});assert.equal(bad.status,400);assert.equal(reads,0);const good=await call(s.handler,'/auth/google/saved-brief?timeZone=America%2FNew_York',{headers:{cookie:s.cookie}});assert.equal(good.status,200);assert.equal(JSON.parse(good.body).day,'2026-11-08');assert.equal(JSON.parse(good.body).timeZone,'America/New_York');
});
test('Mac bridge is disabled by default and an approved fictional transfer is owner-bound, one-use and temporary',async t=>{
 const off=await configured(t);assert.equal((await call(off.handler,'/auth/google/mac-calendar-prepare',{method:'POST',headers:off.headers})).status,403);
 let grant;const scope={calendarCount:1,maxEvents:1,startDate:'2026-11-08',endDateExclusive:'2026-11-09',timeZone:'America/New_York'};
 const s=await configured(t,{approvedMacCalendarScope:scope,publishMacCalendarGrant:async value=>{grant=value;}});
 const prep=await call(s.handler,'/auth/google/mac-calendar-prepare',{method:'POST',headers:s.headers});assert.equal(prep.status,200);assert.doesNotMatch(prep.body,/capability/);
 const headers={'content-type':'application/json','x-cc-mac-transfer':grant.capability},payload={kind:'mac-calendar-preview-v1',...scope,events:[{title:'Fictional appointment',calendarTitle:'Fictional Home',allDay:false,start:'2026-11-08T12:00:00-05:00',end:'2026-11-08T13:00:00-05:00'}]};
 assert.equal((await call(s.handler,'/auth/google/mac-calendar-transfer',{method:'POST',headers:{...headers,origin},body:payload})).status,403);
 assert.equal((await call(s.handler,'/auth/google/mac-calendar-transfer',{method:'POST',headers,body:payload})).status,200);
 assert.equal((await call(s.handler,'/auth/google/mac-calendar-transfer',{method:'POST',headers,body:payload})).status,400);
 const path='/auth/google/mac-calendar-brief?day=2026-11-08&timeZone=America%2FNew_York';assert.equal((await call(s.handler,path)).status,403);
 const result=await call(s.handler,path,{headers:{cookie:s.cookie}});assert.equal(JSON.parse(result.body).events[0].title,'Fictional appointment');assert.equal(JSON.parse(result.body).persisted,false);
 await call(s.handler,'/auth/google/signout',{method:'POST',headers:s.headers});assert.equal((await call(s.handler,path,{headers:{cookie:s.cookie}})).status,403);
});
test('Mac event identity review is owner-bound, exposes only opaque keys, and cannot execute database writes',async t=>{
 let grant,reads=0,writes=0;const s=await configured(t,{approvedMacCalendarScope:{calendarCount:1,maxEvents:1,startDate:'2026-11-08',endDateExclusive:'2026-11-09',timeZone:'America/New_York'},allowMacCalendarIdentityReview:true,publishMacCalendarGrant:async value=>grant=value,macCalendarRepository:{readByIds:async()=>{reads++;return[];},insertMany:async()=>{writes++;throw Error('Must not write');}}});
 await call(s.handler,'/auth/google/mac-calendar-prepare',{method:'POST',headers:s.headers});const payload={kind:'mac-calendar-preview-v1',identityReview:true,calendarCount:1,startDate:'2026-11-08',endDateExclusive:'2026-11-09',timeZone:'America/New_York',events:[{calendarId:'PRIVATE_CALENDAR_ID',eventId:'PRIVATE_EVENT_ID',occurrenceStart:null,title:'Fictional appointment',calendarTitle:'Fictional Home',allDay:false,start:'2026-11-08T12:00:00-05:00',end:'2026-11-08T13:00:00-05:00'}]};
 assert.equal((await call(s.handler,'/auth/google/mac-calendar-transfer',{method:'POST',headers:{'content-type':'application/json','x-cc-mac-transfer':grant.capability},body:payload})).status,200);
 assert.equal((await call(s.handler,'/auth/google/mac-calendar-items')).status,403);const items=await call(s.handler,'/auth/google/mac-calendar-items',{headers:{cookie:s.cookie}});assert.doesNotMatch(items.body,/PRIVATE_CALENDAR_ID|PRIVATE_EVENT_ID|occurrenceStart/);const key=JSON.parse(items.body).events[0].key;
 const response=await call(s.handler,'/auth/google/mac-calendar-review',{method:'POST',headers:s.headers,body:{selectedKeys:[key]}}),review=JSON.parse(response.body);assert.equal(response.status,200);assert.equal(review.insertCount,1);assert.equal(review.saveEnabled,false);assert.ok(reads>0);assert.equal(writes,0);
 assert.equal((await call(s.handler,'/auth/google/mac-calendar-save',{method:'POST',headers:s.headers,body:{reviewId:review.reviewId,approved:true}})).status,403);assert.equal(writes,0);
 await call(s.handler,'/auth/google/signout',{method:'POST',headers:s.headers});assert.equal((await call(s.handler,'/auth/google/mac-calendar-items',{headers:{cookie:s.cookie}})).status,403);
});
test('separately approved Mac save inserts encrypted snapshots once and saved reads hide native identifiers',async t=>{
 const {createSealedMacCalendarRepository}=await import('../server/sealed-mac-calendar-repository.mjs'),{createTokenSealer}=await import('../server/token-sealer.mjs');let grant,writes=0,releaseInsert,holdInsert=false;const rawRows=[];
 const raw={readByIds:async(_actor,_owner,ids)=>structuredClone(rawRows.filter(row=>ids.includes(row.id))),insertMany:async(_actor,_owner,rows)=>{writes++;if(holdInsert)await new Promise(resolve=>releaseInsert=resolve);rawRows.push(...structuredClone(rows).map(row=>({...row,version:1,deleted_at:null,created_at:'2026-11-08T12:00:00Z'})));return structuredClone(rawRows);},listSavedMacCalendar:async()=>structuredClone(rawRows)};
 const s=await configured(t,{approvedMacCalendarScope:{calendarCount:1,maxEvents:1,startDate:'2026-11-08',endDateExclusive:'2026-11-09',timeZone:'America/New_York'},allowMacCalendarIdentityReview:true,allowMacCalendarSave:true,publishMacCalendarGrant:async value=>grant=value,macCalendarRepository:createSealedMacCalendarRepository(raw,createTokenSealer(Buffer.alloc(32,4)))});
 await call(s.handler,'/auth/google/mac-calendar-prepare',{method:'POST',headers:s.headers});await call(s.handler,'/auth/google/mac-calendar-transfer',{method:'POST',headers:{'content-type':'application/json','x-cc-mac-transfer':grant.capability},body:{kind:'mac-calendar-preview-v1',identityReview:true,calendarCount:1,startDate:'2026-11-08',endDateExclusive:'2026-11-09',timeZone:'America/New_York',events:[{calendarId:'PRIVATE_CALENDAR_ID',eventId:'PRIVATE_EVENT_ID',occurrenceStart:null,title:'Fictional appointment',calendarTitle:'Fictional Home',allDay:false,start:'2026-11-08T12:00:00-05:00',end:'2026-11-08T13:00:00-05:00'}]}});
 const items=JSON.parse((await call(s.handler,'/auth/google/mac-calendar-items',{headers:{cookie:s.cookie}})).body),key=items.events[0].key;
 const prepare=()=>call(s.handler,'/auth/google/mac-calendar-review',{method:'POST',headers:s.headers,body:{selectedKeys:[key]}});const review=JSON.parse((await prepare()).body);assert.equal(review.saveEnabled,true);assert.equal(writes,0);
 const secondReview=JSON.parse((await prepare()).body);holdInsert=true;const pendingSave=call(s.handler,'/auth/google/mac-calendar-save',{method:'POST',headers:s.headers,body:{reviewId:review.reviewId,approved:true}});while(!releaseInsert)await new Promise(resolve=>setImmediate(resolve));assert.equal((await call(s.handler,'/auth/google/mac-calendar-save',{method:'POST',headers:s.headers,body:{reviewId:secondReview.reviewId,approved:true}})).status,403);releaseInsert();const save=await pendingSave;assert.equal(save.status,200);assert.equal(JSON.parse(save.body).inserted,1);assert.equal(writes,1);assert.doesNotMatch(JSON.stringify(rawRows),/PRIVATE_CALENDAR_ID|PRIVATE_EVENT_ID|Fictional appointment|Fictional Home/);
 assert.equal((await call(s.handler,'/auth/google/mac-calendar-save',{method:'POST',headers:s.headers,body:{reviewId:review.reviewId,approved:true}})).status,403);assert.equal(writes,1);
 const saved=await call(s.handler,'/auth/google/mac-calendar-saved',{headers:{cookie:s.cookie}});assert.equal(saved.status,200);assert.equal(JSON.parse(saved.body).records[0].title,'Fictional appointment');assert.doesNotMatch(saved.body,/PRIVATE_CALENDAR_ID|PRIVATE_EVENT_ID|occurrenceStart|encrypted/);assert.equal(JSON.parse((await prepare()).body).saveEnabled,false);
 s.control.valid=false;assert.equal((await call(s.handler,'/auth/google/mac-calendar-saved',{headers:{cookie:s.cookie}})).status,401);
});
test('Mac save startup requires a bounded scope and exact confirmed development project before key-store creation',async t=>{
 const {mkdir,writeFile}=await import('node:fs/promises'),dir=await mkdtemp(join(tmpdir(),'cc-mac-save-target-'));t.after(()=>rm(dir,{recursive:true,force:true}));const scope={calendarCount:1,maxEvents:2,startDate:'2026-11-08',endDateExclusive:'2026-11-09',timeZone:'America/New_York'};
 await assert.rejects(makeConnectionsServer(dir,{approvedMacCalendarScope:scope,allowMacCalendarIdentityReview:true,allowMacCalendarSave:true}),/Exact development target/);assert.deepEqual(await readdir(dir),[]);
 await mkdir(join(dir,'.local'),{mode:0o700});await writeFile(join(dir,'.local/google-oauth.json'),JSON.stringify({web:{client_id:'fictional.apps.googleusercontent.com',client_secret:'FICTIONAL_SECRET',redirect_uris:[GOOGLE_CALLBACK]}}));
 await writeFile(join(dir,'.env.local'),['CC_DEV_SUPABASE_URL=https://fictionaldev123.supabase.co/','CC_DEV_PROJECT_REF=fictionaldev123','CC_ORIGINAL_PROJECT_REF=originalproject123','CC_DEV_PUBLISHABLE_KEY=sb_publishable_fictional','CC_CONFIRM_NEW_DEV_PROJECT=I_CHECKED_THIS_IS_NOT_MY_EXISTING_PROJECT','CC_TEST_A_EMAIL=a@example.test','CC_TEST_B_EMAIL=b@example.test','CC_TEST_A_PASSWORD=FICTIONAL_A','CC_TEST_B_PASSWORD=FICTIONAL_B'].join('\n'));
 await assert.rejects(makeConnectionsServer(dir,{approvedMacCalendarScope:scope,allowMacCalendarIdentityReview:true,allowMacCalendarSave:true,expectedMacSaveProject:'differentdev123'}),/Unexpected Mac save development target/);assert.deepEqual(await readdir(join(dir,'.local')),['google-oauth.json']);
});
test('saved-source lookup combines whitelisted Mac and Google copies and fails closed on a bad Mac row',async t=>{
 const {macCalendarFixtureArgs}=await import('../server/mac-calendar-fixtures.mjs'),{planMacCalendarImport}=await import('../server/mac-calendar-import-plan.mjs');const rows=planMacCalendarImport({ownerId,...macCalendarFixtureArgs(ownerId,'cccccccc-cccc-4ccc-8ccc-cccccccccccc')}).actions.map(({record})=>({...record,version:1,deleted_at:null}));let macReads=0;
 const s=await configured(t,{providerRepository:{listSaved:async()=>[]},macCalendarRepository:{listSavedMacCalendar:async()=>{macReads++;return structuredClone(rows);}}});
 const result=await call(s.handler,'/auth/google/records',{headers:{cookie:s.cookie}});assert.equal(result.status,200);assert.equal(JSON.parse(result.body).records.length,2);assert.equal(JSON.parse(result.body).providerRead,false);assert.doesNotMatch(result.body,/fictional-calendar-|fictional-event-|fictional-series-|occurrenceStart|sourceId/);assert.equal(macReads,1);
 rows[0].deleted_at='2026-11-08T00:00:00Z';const malformed=await call(s.handler,'/auth/google/records',{headers:{cookie:s.cookie}});assert.equal(malformed.status,400);assert.doesNotMatch(malformed.body,/QA FICTIONAL/);
});
test('sign-out while Mac saved copies are loading cannot disclose a partial or late combined inventory',async t=>{
 let release;const gate=new Promise(resolve=>release=resolve);const s=await configured(t,{providerRepository:{listSaved:async()=>[]},macCalendarRepository:{listSavedMacCalendar:async()=>gate}});const pending=call(s.handler,'/auth/google/records',{headers:{cookie:s.cookie}});await new Promise(resolve=>setImmediate(resolve));await call(s.handler,'/auth/google/signout',{method:'POST',headers:s.headers});release([]);const result=await pending;assert.equal(result.status,401);assert.doesNotMatch(result.body,/records/);
});
