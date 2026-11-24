import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPrivateRecoveryList,verifyPrivateRecoveryReview} from '../src/private-record-recovery-view.mjs';
const now=Date.parse('2026-11-17T12:00:00Z'),token='a'.repeat(43);
const row={title:'Fictional removed note',type:'note',section:'Personal Life',deletedAt:new Date(now).toISOString(),recordToken:token};
const list=()=>({retentionDays:90,offset:0,limit:50,matchCount:1,expiresAt:now+300000,records:[{...row}]});
const review=()=>({title:row.title,type:row.type,section:row.section,reviewId:token,restoring:true,retentionDays:90,expiresAt:now+300000});
test('recovery views accept sparse bounded lists, empty pages and each supported type',()=>{
 for(const [type,section] of [['task','Work'],['note','Personal Life'],['event','Calendar']]){
  const value=list();Object.assign(value.records[0],{type,section});assert.equal(verifyPrivateRecoveryList(value,{now}),value);
  const r={...review(),type,section,restoring:false};assert.equal(verifyPrivateRecoveryReview(r,{now}),r);
 }
 assert.doesNotThrow(()=>verifyPrivateRecoveryList({...list(),records:[],matchCount:0},{now}));
 assert.doesNotThrow(()=>verifyPrivateRecoveryList({...list(),offset:50,records:[],matchCount:0},{offset:50,now}));
});
test('expiry cannot be extended beyond the five-minute server review bound',()=>{
 for(const expiresAt of [undefined,NaN,Infinity,now,now-1,now+300001,'future'])for(const verify of [verifyPrivateRecoveryList,verifyPrivateRecoveryReview]){
  assert.throws(()=>verify({...((verify===verifyPrivateRecoveryList)?list():review()),expiresAt},{now}));
 }
});
test('removed list rejects false pagination, duplicate capabilities and malformed records',()=>{
 for(const patch of [{offset:50},{limit:100},{matchCount:-1},{matchCount:2001},{matchCount:0},{matchCount:1.5},{matchCount:2},{payload:'Unexpected field'},{records:null},{records:[row,row],matchCount:2},{records:[null]}])assert.throws(()=>verifyPrivateRecoveryList({...list(),...patch},{now}));
 for(const patch of [{description:'Unexpected field'},{title:''},{title:' '},{title:'x'.repeat(201)},{type:'project'},{type:'__proto__'},{section:'Work'},{deletedAt:'bad'},{deletedAt:new Date(now+1).toISOString()},{deletedAt:new Date(now-90*86400000-1).toISOString()},{recordToken:'bad'}])assert.throws(()=>verifyPrivateRecoveryList({...list(),records:[{...row,...patch}]},{now}));
 for(const offset of [-1,1,2000,'0'])assert.throws(()=>verifyPrivateRecoveryList(list(),{offset,now}));
});
test('exact 90-day removal boundary and equivalent timestamp formats remain eligible',()=>{
 for(const deletedAt of [new Date(now-90*86400000).toISOString(),'2026-11-17T12:00:00+00:00'])assert.doesNotThrow(()=>verifyPrivateRecoveryList({...list(),records:[{...row,deletedAt}]},{now}));
});
test('recovery review refuses unsupported scope or ambiguous approval identity',()=>{
 for(const patch of [{description:'Unexpected field'},{title:''},{title:' '.repeat(5)},{title:'x'.repeat(201)},{type:'note',section:'Calendar'},{type:'task',section:'Calendar'},{type:'project'},{restoring:1},{reviewId:'bad'},{retentionDays:30}])assert.throws(()=>verifyPrivateRecoveryReview({...review(),...patch},{now}));
 for(const value of [null,undefined,[],{}]){assert.throws(()=>verifyPrivateRecoveryList(value,{now}));assert.throws(()=>verifyPrivateRecoveryReview(value,{now}));}
});
test('an older reply cannot display a removed title past the inclusive cutoff',()=>{
 const response=list(),boundary=now+1;
 response.records[0].deletedAt=new Date(boundary-90*86400000).toISOString();
 for(const time of [now,boundary])assert.equal(verifyPrivateRecoveryList(response,{now:time}).expiresAt,boundary+1);
 assert.throws(()=>verifyPrivateRecoveryList(response,{now:boundary+1}));
 assert.equal(response.expiresAt,now+300000);
});
