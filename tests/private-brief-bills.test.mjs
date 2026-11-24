import test from 'node:test';
import assert from 'node:assert/strict';
import {createBriefBills} from '../src/private-brief-bills.mjs';

const now=Date.parse('2026-11-19T15:00:00Z');
const day='2026-11-18';
const result={day,currentDay:'2026-11-19',total:1,rows:[{label:'Rent <November>',status:'Overdue'}],expiresAt:now+5000};

test('source change, concealment and expiry remove previously requested bill labels',async t=>{
 let clock=now,context={day,expiresAt:now+1000},complete;
 const panel=createBriefBills({client:{briefBills:()=>new Promise(resolve=>complete=resolve)},clock:()=>clock,context:()=>context,onChange(){}});
 t.after(()=>panel.reset());
 const pending=panel.open();
 context=null;panel.reset();complete(result);await pending;
 assert.doesNotMatch(panel.render(day),/Rent/);
 context={day,expiresAt:now+1000};
 const next=panel.open();complete(result);await next;
 assert.match(panel.render(day),/Rent &lt;November&gt; · Overdue/);
 clock+=1000;
 assert.doesNotMatch(panel.render(day),/Rent/);
 clock=now;const changed=panel.open();context={day:'2026-11-20',expiresAt:now+1000};
 complete(result);await changed;
 assert.doesNotMatch(panel.render(context.day),/Rent/);
});
test('mismatched selected dates and unexpected financial fields cannot enter the Brief',async t=>{
 for(const value of [{...result,day:'2026-11-17'},{...result,total:2},{...result,rows:[{...result.rows[0],amount:4500}]},{...result,rows:[{label:'Rent',status:'Due'}]}]){
  const panel=createBriefBills({client:{briefBills:async()=>value},clock:()=>now,context:()=>({day,expiresAt:now+300000}),onChange(){}});
  t.after(()=>panel.reset());await panel.open();
  const html=panel.render(day);assert.match(html,/Could not open/);assert.doesNotMatch(html,/Rent|4500/);
 }
});
