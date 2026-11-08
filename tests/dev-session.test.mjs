import test from 'node:test';
import assert from 'node:assert/strict';
import {createDevSessionManager,storageKey} from '../src/dev-session.mjs';
import {createDevApi} from '../src/dev-api.mjs';
import {allowedPublicPath} from '../tools/local-server.mjs';

const A='bb8f4c56-a302-48d3-8c40-dc2838a97221',B='aa8f4c56-a302-48d3-8c40-dc2838a97222';
function fakeStorage(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
function fakeApi(){let counter=0,attempts=0;return {
  signIn:async (email,pw)=>{assert.ok(pw);counter++;return {accessToken:'a'+counter,refreshToken:'r'+counter+'-longtoken',expiresAt:1000000};},
  refreshSession:async (refreshToken)=>{attempts++;assert.ok(refreshToken.startsWith('r'));counter++;return {accessToken:'a'+counter,refreshToken:'r'+counter+'-longtoken',expiresAt:1000000};},
  getUser:async()=>({id:A,email:'a@example.test'}),
  signOut:async()=>{},
  get calls(){return {attempts}}
};}
test('session restores across page reload with server verification, without saving password or access JWT',async()=>{
  const storage=fakeStorage(),api=fakeApi(),ref='devproject123';
  const manager=createDevSessionManager(api,ref,storage,()=>1);
  await manager.signIn('a@example.test','test-password');
  const json=storage.getItem(storageKey(ref));
  assert.ok(json);assert.ok(json.includes('r1-longtoken'));
  assert.ok(!json.includes('test-password'));
  assert.ok(!json.includes('a1'));
  const next=createDevSessionManager(api,ref,storage,()=>2);
  const restored=await next.restore();
  assert.equal(restored.user.id,A);
  assert.equal(await next.getAccessToken(),'a2');
  assert.equal(api.calls.attempts,1);
  assert.ok(storage.getItem(storageKey(ref)).includes('r2-longtoken'));
});
test('sign-out clears browser session before remote request and cannot restore',async()=>{
  const storage=fakeStorage(),api=fakeApi(),manager=createDevSessionManager(api,'devproject123',storage,()=>1);
  await manager.signIn('a','pw');await manager.signOut();
  assert.equal(storage.getItem(storageKey('devproject123')),null);
  assert.equal(await createDevSessionManager(api,'devproject123',storage,()=>2).restore(),null);
});
test('session storage is project-specific; a different project must not inherit it',async()=>{
  const storage=fakeStorage(),api=fakeApi();
  await createDevSessionManager(api,'devproject123',storage,()=>1).signIn('a','pw');
  assert.equal(await createDevSessionManager(api,'anotherproject12',storage,()=>2).restore(),null);
});
test('unexpected authenticated user invalidates stored session',async()=>{
  const storage=fakeStorage(),api=fakeApi(),manager=createDevSessionManager(api,'devproject123',storage,()=>1);
  await manager.signIn('a','pw');
  const imposter={...api,getUser:async()=>({id:B,email:'b@example.test'})};
  const newManager=createDevSessionManager(imposter,'devproject123',storage,()=>2);
  assert.equal(await newManager.restore(),null);
  assert.equal(storage.getItem(storageKey('devproject123')),null);
});
test('session expiration, corrupt data and stale data all fail closed',async()=>{
  const storage=fakeStorage(),api=fakeApi(),ref='devproject123';
  storage.setItem(storageKey(ref),'{unparseable');
  assert.equal(await createDevSessionManager(api,ref,storage).restore(),null);
  await createDevSessionManager(api,ref,storage,()=>1).signIn('a','pw');
  assert.equal(await createDevSessionManager(api,ref,storage,()=>13*60*60*1000).restore(),null);
});
test('refreshes tokens near expiry and removes stale credentials on failure',async()=>{
  const storage=fakeStorage(),api=fakeApi(),manager=createDevSessionManager(api,'devproject123',storage,()=>1);
  await manager.signIn('a','pw');
  const token=await manager.getAccessToken();assert.equal(token,'a1');
  const broken={...api,refreshSession:async()=>{throw Error('invalid refresh');}};
  const bad=createDevSessionManager(broken,'devproject123',storage,()=>2);
  assert.equal(await bad.restore(),null);
  assert.equal(storage.getItem(storageKey('devproject123')),null);
});
test('Supabase refresh calls correct endpoint and handles token rotation',async()=>{
  const calls=[];
  const fetcher=async(url,opts)=>{
    calls.push({url,opts});
    return {ok:true,status:200,text:async()=>JSON.stringify({access_token:'access-test',refresh_token:'next-refresh',expires_in:3600})};
  };
  const api=createDevApi({supabaseUrl:'https://devproject123.supabase.co/',projectRef:'devproject123',publishableKey:'sb_publishable_test'},fetcher);
  const next=await api.refreshSession('previous-refresh');
  assert.equal(next.refreshToken,'next-refresh');
  assert.match(calls[0].url,/grant_type=refresh_token/);
  assert.deepEqual(JSON.parse(calls[0].opts.body),{refresh_token:'previous-refresh'});
  assert.ok(allowedPublicPath('/src/dev-session.mjs'));
  assert.ok(!allowedPublicPath('/.env.local'));
});
