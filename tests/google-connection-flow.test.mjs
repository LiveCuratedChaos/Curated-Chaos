import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createTokenSealer} from '../server/token-sealer.mjs';
import {createGoogleConnectionFlow} from '../server/google-connection-flow.mjs';
import {GMAIL_READ_SCOPE} from '../server/gmail.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sessionBinding='fictional-server-session-binding';
function setup(){
 const states=new Map(),saved=[],sealer=createTokenSealer(randomBytes(32)),control={clock:1000,active:true,payload:{},tokens:{}};
 const oauthClient={
  generateCodeVerifierAsync:async()=>({codeVerifier:'fixture-pkce-verifier',codeChallenge:'fixture-pkce-challenge'}),
  generateAuthUrl(options){control.options=options;return 'https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({state:options.state,nonce:options.nonce});},
  async getToken(input){control.exchange=input;return {tokens:{refresh_token:'fixture-refresh-secret',id_token:'fixture-id-token',scope:'openid email '+GMAIL_READ_SCOPE,...control.tokens}};},
  async verifyIdToken(input){control.verification=input;return {getPayload:()=>({sub:'fixture-google-subject',email:'fixture@example.test',email_verified:true,nonce:control.options.nonce,...control.payload})};}
 };
 const flow=createGoogleConnectionFlow({clientId:'fixture.apps.googleusercontent.com',oauthClient,stateStore:{async put(key,value){states.set(key,value);},async consume(key){const value=states.get(key);states.delete(key);return value;}},connectionStore:{async insert(row){saved.push(row);}},sealer,confirmSession:async()=>control.active,now:()=>control.clock});
 const begin=()=>flow.begin({ownerId,sessionBinding,provider:'gmail'});
 const complete=async(start,changes={})=>flow.complete({ownerId,sessionBinding,state:new URL(start.authorizationUrl).searchParams.get('state'),code:'fixture-code',...changes});
 return {flow,begin,complete,states,saved,sealer,control};
}
test('token encryption binds owner/context, uses randomized ciphertext, and rejects tampering',()=>{
 const sealer=createTokenSealer(randomBytes(32)),secret={refreshToken:'fixture-secret'};
 const one=sealer.seal(secret,'owner-A'),two=sealer.seal(secret,'owner-A');
 assert.notEqual(one,two);assert.doesNotMatch(one,/fixture-secret/);assert.deepEqual(sealer.unseal(one,'owner-A'),secret);
 assert.throws(()=>sealer.unseal(one,'owner-B'),/could not be verified/);
 const value=JSON.parse(one);value.data='AAAA';assert.throws(()=>sealer.unseal(JSON.stringify(value),'owner-A'));
 assert.throws(()=>createTokenSealer(Buffer.alloc(16)),/32-byte/);
});
test('Google begin requests only identity plus selected read permission with state, nonce and PKCE',async()=>{
 const s=setup();await s.begin();
 assert.deepEqual(s.control.options.scope,['openid','email',GMAIL_READ_SCOPE]);
 assert.equal(s.control.options.code_challenge_method,'S256');assert.equal(s.control.options.include_granted_scopes,false);
 const serialized=JSON.stringify([...s.states]);assert.doesNotMatch(serialized,/fixture-pkce-verifier|fictional-server-session-binding/);
 await assert.rejects(s.flow.begin({ownerId,sessionBinding,provider:'__proto__'}),/Unsupported/);
});
test('Google completion verifies identity, encrypts refresh credentials and returns no tokens',async()=>{
 const s=setup(),start=await s.begin(),result=await s.complete(start);
 assert.equal(s.control.exchange.codeVerifier,'fixture-pkce-verifier');
 assert.equal(s.control.verification.audience,'fixture.apps.googleusercontent.com');
 assert.equal(result.selectionRequired,true);assert.equal(result.provider,'gmail');
 assert.doesNotMatch(JSON.stringify(result),/fixture-refresh-secret|fixture-id-token|fixture-google-subject/);
 assert.equal(s.saved.length,1);assert.doesNotMatch(s.saved[0].encrypted,/fixture-refresh-secret|fixture@example/);
 assert.equal(s.sealer.unseal(s.saved[0].encrypted,'provider:'+ownerId+':'+result.connectionId).refreshToken,'fixture-refresh-secret');
 await assert.rejects(s.complete(start),/already used/);
});
test('Google callback rejects another session, expires in five minutes, and is consumed once',async()=>{
 const s=setup(),start=await s.begin();
 await assert.rejects(s.complete(start,{sessionBinding:'another-server-session-binding'}),/current app session/);
 assert.equal(s.saved.length,0);await assert.rejects(s.complete(start),/already used/);
 const late=await s.begin();s.control.clock+=300001;
 await assert.rejects(s.complete(late),/current app session/);assert.equal(s.saved.length,0);
});
test('nonce mismatches, unverified email, missing refresh credentials and missing scopes cannot persist a connection',async()=>{
 for(const changes of [{payload:{nonce:'wrong'}},{payload:{email_verified:false}},{tokens:{refresh_token:''}},{tokens:{scope:'openid email'}}]){
  const s=setup(),start=await s.begin();Object.assign(s.control,changes);
  await assert.rejects(s.complete(start),/required verified read authorization/);assert.equal(s.saved.length,0);
 }
});
test('a revoked app session after token exchange cannot save provider credentials',async()=>{
 const s=setup(),start=await s.begin();
 Object.defineProperty(s.control.payload,'nonce',{get(){s.control.active=false;return s.control.options.nonce;},enumerable:true});
 await assert.rejects(s.complete(start),/App session ended/);assert.equal(s.saved.length,0);
});
