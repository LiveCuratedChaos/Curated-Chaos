import test from 'node:test';
import assert from 'node:assert/strict';
import {createFinancePrivacy} from '../src/private-finance-privacy.mjs';

test('concealment survives reload and a reveal in another tab cannot reveal this tab',()=>{
 const data=new Map(),events=new Map();
 const host={localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},
  addEventListener:(name,fn)=>events.set(fn,name),removeEventListener:(_,fn)=>events.delete(fn)};
 let changes=0;
 const a=createFinancePrivacy(host,()=>changes++);a.conceal();
 const b=createFinancePrivacy(host,()=>changes++);
 assert.equal(b.hidden,true);b.resume();
 for(const [fn] of events)fn({key:'curated-chaos.finance-concealed',newValue:null});
 assert.equal(a.hidden,true);assert.equal(b.hidden,false);
 for(const [fn] of events)fn({key:'curated-chaos.finance-concealed',newValue:'1'});
 assert.equal(b.hidden,true);assert.equal(changes,3);
 a.dispose();b.dispose();assert.equal(events.size,0);
});
