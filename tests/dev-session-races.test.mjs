import test from 'node:test';
import assert from 'node:assert/strict';
import {createDevSessionManager,storageKey} from '../src/dev-session.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',ref='devproject123';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const token=(name,expiresAt=1_000_000)=>({accessToken:name,refreshToken:'refresh-token-'+name,expiresAt});
function storage(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
function api(){return {signIn:async()=>token('a'),refreshSession:async()=>token('fresh'),getUser:async t=>({id:t==='b'?B:A,email:'fixture@example.test'}),signOut:async()=>{}};}
test('a pending sign-in cannot restore a session after sign-out',async()=>{
 const wait=deferred(),a=api(),s=storage();a.signIn=()=>wait.promise;
 const manager=createDevSessionManager(a,ref,s,()=>1);
 const signing=manager.signIn('fixture','fixture');await manager.signOut();wait.resolve(token('a'));
 await assert.rejects(signing,/cancelled/);
 assert.equal(manager.get(),null);assert.equal(s.getItem(storageKey(ref)),null);
});
test('an old failed sign-in cannot clear a newer successful account',async()=>{
 const wait=deferred(),a=api(),s=storage();a.signIn=email=>email==='old'?wait.promise:Promise.resolve(token('b'));
 const manager=createDevSessionManager(a,ref,s,()=>1);
 const old=manager.signIn('old','fixture');await manager.signIn('new','fixture');wait.reject(Error('old failed'));
 await assert.rejects(old,/old failed/);
 assert.equal(manager.get().user.id,B);assert.equal(await manager.getAccessToken(),'b');
});
test('concurrent access-token refreshes share one rotation request',async()=>{
 const wait=deferred(),a=api(),s=storage();let clock=1,calls=0;
 a.signIn=async()=>token('a',100_000);a.refreshSession=()=>{calls++;return wait.promise;};
 const manager=createDevSessionManager(a,ref,s,()=>clock);await manager.signIn('fixture','fixture');clock=90_000;
 const one=manager.getAccessToken(),two=manager.getAccessToken();assert.equal(calls,1);
 wait.resolve(token('fresh'));assert.deepEqual(await Promise.all([one,two]),['fresh','fresh']);
 assert.equal(await manager.getAccessToken(),'fresh');
});
test('a pending refresh cannot return an old token or overwrite a new account',async()=>{
 const wait=deferred(),a=api(),s=storage();let clock=1;
 a.signIn=async email=>token(email==='new'?'b':'a',email==='new'?1_000_000:100_000);a.refreshSession=()=>wait.promise;
 const manager=createDevSessionManager(a,ref,s,()=>clock);await manager.signIn('old','fixture');clock=90_000;
 const refreshing=manager.getAccessToken();await manager.signOut();await manager.signIn('new','fixture');wait.resolve(token('fresh'));
 await assert.rejects(refreshing,/Session changed/);
 assert.equal(manager.get().user.id,B);assert.equal(await manager.getAccessToken(),'b');
});
test('concurrent restores share a refresh and sign-out cancels both',async()=>{
 const a=api(),s=storage();await createDevSessionManager(a,ref,s,()=>1).signIn('fixture','fixture');
 const wait=deferred();let calls=0;a.refreshSession=()=>{calls++;return wait.promise;};
 const manager=createDevSessionManager(a,ref,s,()=>2),one=manager.restore(),two=manager.restore();
 assert.equal(calls,1);await manager.signOut();wait.resolve(token('fresh'));
 assert.deepEqual(await Promise.all([one,two]),[null,null]);
 assert.equal(manager.get(),null);assert.equal(s.getItem(storageKey(ref)),null);
});
test('malformed or expired token responses never establish a development session',async()=>{
 for(const bad of [{...token('a'),expiresAt:NaN},{...token('a'),expiresAt:0},{...token('a'),accessToken:''},{...token('a'),refreshToken:null}]){
  const a=api(),s=storage();let verified=0;a.signIn=async()=>bad;a.getUser=async()=>{verified++;return{id:A,email:'fixture@example.test'};};const manager=createDevSessionManager(a,ref,s,()=>1);await assert.rejects(manager.signIn('fixture','fixture'),/token verification/);assert.equal(verified,0);assert.equal(manager.get(),null);assert.equal(s.getItem(storageKey(ref)),null);
 }
});
test('token expiry during identity verification prevents storing the session',async()=>{
 const a=api(),s=storage(),wait=deferred();let clock=1;a.signIn=async()=>token('a',100);a.getUser=()=>wait.promise;const manager=createDevSessionManager(a,ref,s,()=>clock);const pending=manager.signIn('fixture','fixture');await Promise.resolve();clock=101;wait.resolve({id:A,email:'fixture@example.test'});await assert.rejects(pending,/expired during verification/);assert.equal(manager.get(),null);assert.equal(s.getItem(storageKey(ref)),null);
});
test('12-hour limit cannot be extended by a delayed restore or refresh',async()=>{
 for(const action of ['restore','refresh']){
  const a=api(),s=storage();let clock=1;a.signIn=async()=>token('a',100000);await createDevSessionManager(a,ref,s,()=>clock).signIn('fixture','fixture');
  const wait=deferred();a.refreshSession=()=>wait.promise;let manager,pending;if(action==='restore'){manager=createDevSessionManager(a,ref,s,()=>clock);pending=manager.restore();}else{a.refreshSession=async()=>token('a',100000);manager=createDevSessionManager(a,ref,s,()=>clock);await manager.restore();a.refreshSession=()=>wait.promise;clock=90000;pending=manager.getAccessToken();}
  clock=12*60*60*1000+2;wait.resolve(token('fresh',clock+100000));if(action==='restore')assert.equal(await pending,null);else await assert.rejects(pending,/expired/);assert.equal(manager.get(),null);assert.equal(s.getItem(storageKey(ref)),null);
 }
});
