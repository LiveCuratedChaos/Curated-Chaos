import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {manualBill,billDueDates,billOccurrences} from '../src/private-manual-bills.mjs';
import {billType,confirmationType,confirmationId,validateBillRow} from '../server/private-bill-records.mjs';
import {actor,createIsolatedDevelopmentDatabase,identities} from './fixtures/isolated-development-database.mjs';

const schedule={label:'Fictional utility',dueDay:'2028-01-31',endDay:'',frequency:'monthly',interval:1,estimated:true,amountMinor:9000};
const payment={label:schedule.label,dueDay:'2028-02-29',paidDay:'2028-03-02',estimated:true,expectedMinor:9000,amountMinor:8173,source:'manual'};

test('bill schedules include anchored month ends, explicit end dates and one-off bills',()=>{
 assert.deepEqual(billDueDates(schedule,'2028-02-01','2028-04-30'),['2028-02-29','2028-03-31','2028-04-30']);
 assert.deepEqual(billDueDates({...schedule,endDay:'2028-03-01'},'2028-02-01','2028-04-30'),['2028-02-29']);
 assert.deepEqual(billDueDates({...schedule,frequency:'once'},'2028-01-01','2028-02-29'),[schedule.dueDay]);
 assert.deepEqual(billDueDates({...schedule,frequency:'once'},'2028-02-01','2028-02-29'),[]);
 assert.deepEqual(billDueDates({...schedule,dueDay:'2028-02-29',frequency:'yearly'},'2029-01-01','2029-12-31'),['2029-02-28']);
 assert.deepEqual(billDueDates({...schedule,frequency:'weekly',interval:2},'2028-02-01','2028-02-29'),['2028-02-14','2028-02-28']);
 assert.throws(()=>manualBill({...schedule,amountMinor:0.5}));
 assert.throws(()=>billDueDates(schedule,'2028-01-01','2029-01-02'));
});

test('a payment keeps the original estimate and actual date after a schedule edit',()=>{
 const changed={...schedule,label:'Changed',dueDay:'2028-03-10',estimated:false,amountMinor:9500};
 const rows=billOccurrences(changed,[payment],'2028-02-01','2028-04-30','2028-04-01');
 assert.deepEqual(rows.map(({dueDay,status})=>[dueDay,status]),[['2028-02-29','Paid'],['2028-03-10','Overdue'],['2028-04-10','Due']]);
 assert.equal(rows[0].expectedMinor,9000);
 assert.deepEqual(rows[0].payment,payment);
 assert.throws(()=>billOccurrences(changed,[payment,payment],'2028-02-01','2028-04-30','2028-04-01'));
});

test('each confirmation belongs to one owner, bill and date and requires the reviewed match provenance',()=>{
 const {a,b}=identities,billId=randomUUID(),id=confirmationId(a,billId,payment.dueDay);
 const row={id,owner_id:a,visibility:'private',section:'Finances',household_id:null,item_type:confirmationType,origin:'PRIVATE_MANUAL_FINANCE',
  deleted_at:null,version:1,payload:{version:1,ownerId:a,fictional:true,billId,confirmation:payment,match:null}};
 assert.deepEqual(validateBillRow(row,a),payment);
 assert.throws(()=>validateBillRow(row,b));
 assert.throws(()=>validateBillRow({...row,id:randomUUID()},a));
 const matched={...payment,source:'saved_transaction'},match={key:randomUUID(),recordId:randomUUID(),version:1};
 assert.throws(()=>validateBillRow({...row,payload:{...row.payload,confirmation:matched}},a));
 assert.deepEqual(validateBillRow({...row,payload:{...row.payload,confirmation:matched,match}},a),matched);
});

test('local database requires the reviewed revisions and allows one occurrence and one use of a matched transaction',async t=>{
 const db=await createIsolatedDevelopmentDatabase();
 t.after(()=>db.close());
 const {a,b,sa,sb}=identities;
 await actor(db,a,sa);
 const billId=randomUUID(),transaction=randomUUID(),matchKey=randomUUID(),envelope={billId,matchKey:null,scheme:'manual-finance-v1',encrypted:'opaque fixture'};
 const insert="insert into public.cc_records (id,owner_id,section,visibility,item_type,origin,payload) values ($1,$2,'Finances','private',$3,$4,'{}') returning version";
 const bill=(await db.query(insert,[billId,a,billType,'PRIVATE_MANUAL_FINANCE'])).rows[0];
 const source=(await db.query(insert,[transaction,a,'provider_bank_transaction','plaid_readonly'])).rows[0];
 const confirm=(id,payload=envelope,billVersion=bill.version,tx=null,txVersion=null)=>db.query(
  'select * from public.cc_record_bill_confirmation($1,$2,$3,$4,$5,$6)',[billId,billVersion,id,JSON.stringify(payload),tx,txVersion]);
 await assert.rejects(confirm(randomUUID(),{...envelope,extra:'private label'}),/Invalid private bill confirmation/);
 await assert.rejects(confirm(randomUUID(),envelope,bill.version+1),/Bill changed/);
 await actor(db,b,sb);
 await assert.rejects(confirm(randomUUID()),/Bill changed/);
 await actor(db,a,sa);
 const paidId=confirmationId(a,billId,payment.dueDay);
 assert.equal((await confirm(paidId)).rows[0].item_type,confirmationType);
 await assert.rejects(confirm(paidId),/duplicate key/);
 const matched={...envelope,matchKey};
 await assert.rejects(confirm(randomUUID(),matched,bill.version,transaction,source.version+1),/Transaction changed/);
 assert.equal((await confirm(randomUUID(),matched,bill.version,transaction,source.version)).rows.length,1);
 await assert.rejects(confirm(randomUUID(),matched,bill.version,transaction,source.version),/duplicate key/);
});
