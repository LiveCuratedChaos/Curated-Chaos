import test from 'node:test';
import assert from 'node:assert/strict';
import {createBriefBills} from '../src/private-brief-bills.mjs';

const now=Date.parse('2026-11-19T15:00:00Z');
const day='2026-11-18';
const result={day,offset:0,viewToken:'p'.repeat(43),currentDay:'2026-11-19',total:1,rows:[{label:'Rent <November>',status:'Overdue',billReadToken:'a'.repeat(43)}],expiresAt:now+5000};

test('source change, concealment and expiry remove previously requested bill labels',async t=>{
 let clock=now,context={day,expiresAt:now+1000},complete;
 const panel=createBriefBills({client:{briefBillsPage:()=>new Promise(resolve=>complete=resolve)},clock:()=>clock,context:()=>context,onChange(){}});
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
  const panel=createBriefBills({client:{briefBillsPage:async()=>value},clock:()=>now,context:()=>({day,expiresAt:now+300000}),onChange(){}});
  t.after(()=>panel.reset());await panel.open();
  const html=panel.render(day);assert.match(html,/Could not open/);assert.doesNotMatch(html,/Rent|4500/);
 }
});

test('original schedule details reject stale, mismatched or amount-bearing responses and clear on concealment',async t=>{
 let visible=true;
 const detail={day,label:'Rent <November>',scheduleLabel:'Current rent',status:'Overdue',firstDueDay:'2026-01-18',endDay:'',paidDay:'',frequency:'monthly',interval:1,expiresAt:result.expiresAt};
 let response=detail,reads=0;
 const panel=createBriefBills({client:{briefBillsPage:async()=>result,briefBillSource:async()=>{reads++;return response;}},clock:()=>now,context:()=>visible?{day,expiresAt:now+300000}:null,onChange(){}});
 t.after(()=>panel.reset());await panel.open();
 await panel.openSource('missing');assert.equal(reads,0);
 const token=result.rows[0].billReadToken;
 await panel.openSource(token);assert.match(panel.render(day),/Original bill schedule.*Monthly/);
 panel.closeSource();assert.doesNotMatch(panel.render(day),/Current rent/);
 for(response of [{...detail,amount:4500},{...detail,day:'2026-11-17'},{...detail,status:'Paid'},{...detail,expiresAt:now}]){
  await panel.openSource(token);assert.doesNotMatch(panel.render(day),/Original bill schedule|4500/);
 }
 response=detail;await panel.openSource(token);visible=false;
 assert.doesNotMatch(panel.render(day),/Rent|Current rent/);
});

test('bill page controls keep the selected view and reject an unrelated response',async t=>{
 const first={...result,total:11,rows:Array.from({length:10},(_,i)=>({...result.rows[0],label:'Bill '+String(i+1),billReadToken:String(i).repeat(43)}))};
 const last={...result,offset:10,total:11,rows:[{...result.rows[0],label:'Last bill'}]};
 const calls=[];let changed=false;
 const panel=createBriefBills({client:{briefBillsPage:async(d,offset,token)=>{
  calls.push([d,offset,token]);return changed?{...first,viewToken:'z'.repeat(43)}:offset===10?last:first;
 }},clock:()=>now,context:()=>({day,expiresAt:now+300000}),onChange(){}});
 t.after(()=>panel.reset());await panel.open();
 assert.match(panel.render(day),/Showing 1–10 of 11/);assert.doesNotMatch(panel.render(day),/Previous bills/);
 await panel.open(1);assert.match(panel.render(day),/Showing 11 of 11/);
 assert.doesNotMatch(panel.render(day),/More bills|Bill 1 ·/);assert.match(panel.render(day),/Last bill/);
 assert.deepEqual(calls,[[day,0,undefined],[day,10,result.viewToken]]);
 await panel.open(1);assert.equal(calls.length,2);
 changed=true;await panel.open(-1);
 assert.match(panel.render(day),/Could not open/);assert.doesNotMatch(panel.render(day),/Last bill|Bill 1 ·/);
});
