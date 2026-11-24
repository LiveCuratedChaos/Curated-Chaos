import {calculateManualBudget,manualBudgetMonth} from '../src/private-finance-manual.mjs';
import {readFinanceWidget,readBriefBillWeek,createBriefBillSources} from '../server/private-finance-widget.mjs';
import {createPrivateWorkspaceRestoreRepository} from '../server/private-workspace-restore-repository.mjs';
import {createPrivateWorkspaceRestoreExecutor} from '../server/private-workspace-restore-executor.mjs';
import {sealPrivateWorkspace} from '../server/private-workspace-backup.mjs';
import {holdingType} from '../server/private-holding-record.mjs';
import {prepareExpenseReconciliation} from '../server/private-expense-reconciliation.mjs';
import {categorySource,categoryRecordId,categoryRecordType} from '../server/private-transaction-category-record.mjs';
import {billType,confirmationType,confirmationId} from '../server/private-bill-records.mjs';
import {createTokenSealer} from '../server/token-sealer.mjs';
import {billMatchCandidate} from '../server/private-manual-bill-review.mjs';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createIsolatedDevelopmentDatabase,identities,actor} from './fixtures/isolated-development-database.mjs';
import {createManualFinanceStorage} from '../server/private-manual-finance-storage.mjs';
import {incomeSourceType,incomePaymentType,paymentId,incomeMonth} from '../server/private-income-records.mjs';
import {nextFinanceSlot} from '../server/private-finance-identity.mjs';
import {manualBudgetId} from '../server/private-budget-period.mjs';
import {blockedManualFinanceRestores,supportsOrdinaryWorkspaceRestore} from '../server/private-workspace-restore-contract.mjs';
const {a,sa,b,sb}=identities;

function financeStorage(db,key){
 const sourceId=nextFinanceSlot(a,incomeSourceType,[]);
 async function transport(path,options,token){
  await actor(db,token==='a'?a:b,token==='a'?sa:sb);
  const url=new URL(path,'https://fixture.invalid'),params=url.searchParams;
  const eq=name=>params.get(name)?.replace(/^eq\./,'');
  if(options.body){
   const row=JSON.parse(options.body);
   assert.doesNotMatch(options.body,/Gross|paystub|label|expectedNetMinor|netMinor|Fictional income|plannedIncomeMinor/);
   if(url.pathname==='/rest/v1/rpc/cc_match_private_expense'){
    assert.doesNotMatch(options.body,/Fixture match|sourceId|paidDay|amountMinor/);
    return (await db.query('select * from public.cc_match_private_expense($1,$2,$3,$4,$5,$6,$7)',
     [row.p_source,row.p_source_version,row.p_budget,row.p_budget_version,JSON.stringify(row.p_budget_payload),row.p_match,JSON.stringify(row.p_match_payload)])).rows;
   }
   if(url.pathname==='/rest/v1/rpc/cc_save_transaction_categories'){
    assert.doesNotMatch(options.body,/Fixture category|sourceId|receiptReference/);
    return (await db.query('select * from public.cc_save_transaction_categories($1,$2,$3,$4,$5)',
     [row.p_source,row.p_source_version,row.p_annotation,row.p_prior_version,JSON.stringify(row.p_payload)])).rows;
   }
   if(url.pathname==='/rest/v1/rpc/cc_record_bill_confirmation'){
    assert.doesNotMatch(options.body,/Fictional electric|expectedMinor|amountMinor|paidDay|estimated/);
    return (await db.query('select * from public.cc_record_bill_confirmation($1,$2,$3,$4,$5,$6)',
     [row.p_bill,row.p_bill_version,row.p_occurrence,JSON.stringify(row.p_payload),row.p_transaction,row.p_transaction_version])).rows;
   }
   if(options.method==='POST'){
    const values=['id','owner_id','household_id','visibility','section','item_type','origin'].map(k=>row[k]);
    return (await db.query('insert into public.cc_records (id,owner_id,household_id,visibility,section,item_type,origin,payload) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *',[...values,JSON.stringify(row.payload)])).rows;
   }
   return (await db.query('update public.cc_records set payload=$1 where owner_id=$2 and id=$3 and version=$4 and item_type=$5 and household_id is null and deleted_at is null returning *',
    [JSON.stringify(row.payload),eq('owner_id'),eq('id'),eq('version'),eq('item_type')])).rows;
  }
  const parameters=[eq('owner_id'),eq('item_type'),eq('section'),eq('visibility'),eq('origin')];
  let sql='select * from public.cc_records where owner_id=$1 and item_type=$2 and section=$3 and visibility=$4 and origin=$5 and household_id is null and deleted_at is null';
  if(params.get('select')==='id'){
   assert.equal(eq('item_type'),'manual_finance_budget');assert.equal(params.get('limit'),'13');
   const matches=/^in\.\(([^)]+)\)$/.exec(params.get('id'));
   assert.ok(matches);parameters.push(matches[1].split(','));
   return (await db.query(sql.replace('select *','select id')+' and id=any($6::uuid[]) limit 13',parameters)).rows;
  }
  if(params.has('payload->>billId')){
   sql+=" and payload->>'billId'=$6";parameters.push(eq('payload->>billId'));
  }else if(params.has('payload->>matchKey')){
   sql+=" and payload->>'matchKey'=any($6::text[])";parameters.push(params.get('payload->>matchKey').slice(4,-1).split(','));
  }else if(params.has('or')){
   assert.equal(params.get('or'),'(payload->>expectedMonth.in.('+incomeMonth(a,sourceId,'2026-02')+'),payload->>receivedMonth.in.('+incomeMonth(a,sourceId,'2026-02')+'))');
   sql+=" and (payload->>'expectedMonth'=$6 or payload->>'receivedMonth'=$6)";
   parameters.push(incomeMonth(a,sourceId,'2026-02'));
  }else if(params.has('id')){sql+=' and id=$6';parameters.push(eq('id'));}
  return (await db.query(sql+' order by id',parameters)).rows;
 }
 return createManualFinanceStorage(transport,async()=>Buffer.from(key));
}

test('isolated PostgreSQL preserves encrypted finance forms, owner isolation, period queries and receipt recovery dependencies',async t=>{
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());
 const key=Buffer.alloc(32,12);
 const api=financeStorage(db,key);
 const sourceId=nextFinanceSlot(a,incomeSourceType,[]);
 const draft=(id,item_type,fields)=>({id,owner_id:a,section:'Finances',origin:'PRIVATE_MANUAL_FINANCE',visibility:'private',household_id:null,item_type,
  payload:{fictional:true,ownerId:a,version:1,...fields}});
 const schedule={label:'Fictional income',cadence:'monthly',startDay:'2026-01-31',endDay:'',monthDays:[],customDates:[],expectedNetMinor:60000};
 await api.saveIncomeRecord('a',a,draft(sourceId,incomeSourceType,{schedule}),null);
 assert.equal((await api.listIncomeSources('a',a))[0].payload.schedule.label,schedule.label);
 assert.deepEqual(await api.listIncomeSources('b',a),[]);
 const payment={slot:1,expectedDay:'2026-01-31',receivedDay:'2026-02-02',expectedNetMinor:60000,netMinor:58000,paystub:null};
 const id=paymentId(a,sourceId,payment.expectedDay,1),cash=draft(id,incomePaymentType,{sourceId,payment});
 const [first]=await api.saveIncomeRecord('a',a,cash,null);
 const [second]=await api.saveIncomeRecord('a',a,{...cash,payload:{...cash.payload,payment:{...payment,netMinor:57500}}},first);
 assert.equal(second.version,2);assert.deepEqual(await api.saveIncomeRecord('a',a,cash,first),[]);
 assert.equal((await api.listIncomePayments('a',a,sourceId,'2026-02-01','2026-02-28'))[0].payload.payment.netMinor,57500);
 assert.deepEqual(await api.getIncomeRecord('b',a,incomePaymentType,id),[]);
 await actor(db,a,sa);
 const stored=(await db.query('select * from public.cc_records where id=any($1::uuid[])',[[sourceId,id]])).rows;
 const paymentRow=stored.find(row=>row.id===id),incomeRow=stored.find(row=>row.id===sourceId);
 assert.equal(supportsOrdinaryWorkspaceRestore(paymentRow,{manualFinanceKey:key}),true);
 assert.equal(blockedManualFinanceRestores([paymentRow],[],key),1);
 assert.equal(blockedManualFinanceRestores([paymentRow],[incomeRow],key),0);
 assert.equal(blockedManualFinanceRestores([paymentRow,{...incomeRow,deleted_at:new Date()}],[],key),1);
 const budget={period:'month',periodStart:'2026-01-01',periodEnd:'2026-01-31',plannedIncomeMinor:50000,allocations:[],transactions:[]};
 const budgetId=manualBudgetId(a,budget);
 const [saved]=await api.saveManualBudget('a',a,draft(budgetId,'manual_finance_budget',{budget}),null);
 assert.equal(saved.payload.budget.plannedIncomeMinor,50000);assert.deepEqual(await api.getManualBudget('b',budgetId,a),[]);
 const monthIds=Array.from({length:12},(_,month)=>manualBudgetId(a,manualBudgetMonth('2026-01-01',month)));
 assert.deepEqual(await api.listManualBudgetIds('a',a,monthIds),[budgetId]);
 assert.deepEqual(await api.listManualBudgetIds('b',a,monthIds),[]);

 const billId=nextFinanceSlot(a,billType,[]);
 const bill={label:'Fictional electric',dueDay:'2026-02-14',endDay:'',frequency:'monthly',interval:1,estimated:true,amountMinor:7000};
 const [scheduleRow]=await api.saveBill('a',a,draft(billId,billType,{bill}),null);
 assert.equal((await api.listBills('a',a))[0].payload.bill.label,bill.label);assert.deepEqual(await api.listBills('b',a),[]);
 const snapshotId=randomUUID(),plain={connectionId:randomUUID(),sourceId:'example',provider:'plaid',institution:'Chase',fictional:false,
  content:{currency:'USD',name:'Vendor',merchant:'Fictional electric',date:'2026-02-15',accountId:'example',amountMinor:6671,pending:false,pendingTransactionId:null}};
 const providerPayload={scheme:'chase-private-v1',version:1,encrypted:createTokenSealer(key).seal(plain,'finance-record:'+a+':'+snapshotId)};
 await actor(db,a,sa);
 const snapshot=(await db.query("insert into public.cc_records (id,owner_id,visibility,section,item_type,origin,payload) values($1,$2,'private','Finances','provider_bank_transaction','plaid_readonly',$3) returning *",[snapshotId,a,JSON.stringify(providerPayload)])).rows[0];
 const {match}=billMatchCandidate({...snapshot,payload:plain},a,'2026-02-16');
 const confirmation={label:bill.label,dueDay:bill.dueDay,estimated:true,expectedMinor:7000,amountMinor:6671,paidDay:'2026-02-15',source:'saved_transaction'};
 const confirmId=confirmationId(a,billId,bill.dueDay);
 const approved=draft(confirmId,confirmationType,{billId,confirmation,match});
 await api.confirmBill('a',a,approved,scheduleRow);
 await assert.rejects(api.confirmBill('a',a,approved,scheduleRow),/duplicate key/);
 assert.deepEqual(await api.usedBillMatchKeys('a',a,[match.key]),[match.key]);
 assert.deepEqual(await api.usedBillMatchKeys('b',a,[match.key]),[]);
 assert.deepEqual((await api.getBillRecord('a',a,confirmationType,confirmId))[0].payload.confirmation,confirmation);
 assert.equal((await api.listBillConfirmations('a',a,billId,'2026-03-01','2026-03-31')).length,0);
 assert.equal((await api.listBillConfirmations('a',a,billId,'2026-02-01','2026-02-28')).length,1);
 const sealed=(await db.query('select * from public.cc_records where id=any($1::uuid[])',[[billId,confirmId]])).rows;
 const encryptedBill=sealed.find(row=>row.id===billId),confirmed=sealed.find(row=>row.id===confirmId);
 assert.equal(supportsOrdinaryWorkspaceRestore(confirmed,{manualFinanceKey:key}),true);
 assert.equal(supportsOrdinaryWorkspaceRestore({...confirmed,payload:{...confirmed.payload,matchKey:null}},{manualFinanceKey:key}),false);
 assert.equal(blockedManualFinanceRestores([confirmed],[encryptedBill],key),1);
 assert.equal(blockedManualFinanceRestores([confirmed],[encryptedBill,snapshot],key),0);
 assert.equal(blockedManualFinanceRestores([confirmed],[encryptedBill,{...snapshot,version:2}],key),1);
 assert.equal(blockedManualFinanceRestores([confirmed],[snapshot],key),1);
 const categoryRef=categorySource({...snapshot,payload:plain},a).source;
 const categoryId=categoryRecordId(a,categoryRef);
 const assignment=draft(categoryId,categoryRecordType,{source:categoryRef,categories:{category:'Fixture category'}});
 const [annotation]=await api.saveTransactionCategories('a',a,assignment,null);
 assert.deepEqual((await api.getTransactionCategories('a',a,categoryId))[0].payload,assignment.payload);
 assert.deepEqual(await api.getTransactionCategories('b',a,categoryId),[]);
 assert.deepEqual(await api.saveTransactionCategories('b',a,assignment,annotation).catch(()=>[]),[]);
 const revised={...assignment,payload:{...assignment.payload,categories:{category:'Other'}}};
 assert.equal((await api.saveTransactionCategories('a',a,revised,annotation))[0].version,2);
 assert.deepEqual(await api.saveTransactionCategories('a',a,revised,annotation),[]);
 await actor(db,a,sa);
 const sealedAnnotation=(await db.query('select * from public.cc_records where id=$1',[categoryId])).rows[0];
 assert.equal(supportsOrdinaryWorkspaceRestore(sealedAnnotation,{manualFinanceKey:key}),true);
 assert.equal(blockedManualFinanceRestores([sealedAnnotation],[snapshot],key),0);
 assert.equal(blockedManualFinanceRestores([sealedAnnotation],[],key),1);
 assert.equal(blockedManualFinanceRestores([sealedAnnotation],[{...snapshot,version:2}],key),1);
 assert.deepEqual((await db.query('select payload from public.cc_records where id=$1',[snapshotId])).rows[0].payload,providerPayload);
 const expenses=[{day:'2026-01-02',label:'Fixture match',amountMinor:6500,category:'Other'},{day:'2026-01-03',amountMinor:6000,category:'Food'}];
 const budgetDraft=draft(budgetId,'manual_finance_budget',{budget:{...budget,transactions:expenses}});
 const [beforeMatch]=await api.saveManualBudget('a',a,budgetDraft,saved);
 const entry=categorySource({...snapshot,payload:plain},a),plan=prepareExpenseReconciliation(a,entry,beforeMatch,0);
 const [matched]=await api.matchExpense('a',a,plan,beforeMatch);
 assert.deepEqual((await api.getExpenseMatch('a',a,matched.id))[0].payload,matched.payload);
 assert.deepEqual(await api.getExpenseMatch('b',a,matched.id),[]);
 const [afterMatch]=await api.getManualBudget('a',budgetId,a);
 assert.equal(afterMatch.version,beforeMatch.version+1);
 assert.equal(afterMatch.payload.budget.transactions[0].reconciliationId,matched.id);
 const duplicate=prepareExpenseReconciliation(a,entry,afterMatch,1);
 await assert.rejects(api.matchExpense('a',a,duplicate,afterMatch),/duplicate key/);
 assert.deepEqual((await api.getManualBudget('a',budgetId,a))[0],afterMatch);
 await assert.rejects(api.matchExpense('a',a,plan,beforeMatch),/Budget changed/);
 const sealedMatch=(await db.query('select * from public.cc_records where id=$1',[matched.id])).rows[0];
 const sealedBudget=(await db.query('select * from public.cc_records where id=$1',[budgetId])).rows[0];
 assert.equal(supportsOrdinaryWorkspaceRestore(sealedMatch,{manualFinanceKey:key}),true);
 assert.equal(blockedManualFinanceRestores([sealedMatch,sealedBudget],[snapshot],key),0);
 assert.equal(blockedManualFinanceRestores([sealedMatch],[],key),1);
 assert.equal(blockedManualFinanceRestores([sealedBudget],[],key),1);
 assert.equal(blockedManualFinanceRestores([sealedMatch],[sealedBudget],key),1);
 const positionId=nextFinanceSlot(a,holdingType,[]),holding={label:'Manual position',price:{day:'2026-01-01',amountMinor:400},annualDividendMinor:null,
  activities:[{kind:'buy',day:'2026-01-01',amountMinor:300,shareUnits:1000000}]};
 const position=draft(positionId,holdingType,{holding});
 const [recorded]=await api.saveHolding('a',a,position,null);
 assert.deepEqual((await api.listHoldings('a',a))[0].payload.holding,holding);
 assert.deepEqual(await api.getHolding('b',a,positionId),[]);
 await api.saveHolding('a',a,{...position,payload:{...position.payload,holding:{...holding,label:'Changed'}}},recorded);
 assert.deepEqual(await api.saveHolding('a',a,position,recorded),[]);
 const sealedHolding=(await db.query('select * from public.cc_records where id=$1',[positionId])).rows[0];
 assert.doesNotMatch(JSON.stringify(sealedHolding),/Manual position|shareUnits|annualDividendMinor/);
 assert.equal(supportsOrdinaryWorkspaceRestore(sealedHolding,{manualFinanceKey:key}),true);
});

async function financeRecovery(t,projectRef){
 const key=Buffer.alloc(32,16);
 const source=await createIsolatedDevelopmentDatabase(),destination=await createIsolatedDevelopmentDatabase();
 t.after(async()=>{await source.close();await destination.close();});
 const who={owner:a,session:sa},viewer={ownerId:a,accessToken:'a'};
 const repository=db=>createPrivateWorkspaceRestoreRepository({
  projectRef,verifyTarget:async(connection,ref)=>connection===db&&ref===projectRef,
  withConnection:async(identity,callback)=>{await actor(db,identity.owner,identity.session);return callback(db);}
 });
 const sourceRepo=repository(source),destinationRepo=repository(destination);
 const api=financeStorage(source,key),restored=financeStorage(destination,key);
 const executor=createPrivateWorkspaceRestoreExecutor({projectRef,key,repository:destinationRepo,allowManualFinanceRestore:true,
  resolveActor:async identity=>({ownerId:identity.owner,sessionBinding:identity.session,expiresAt:Date.now()+300000}),authorizeWrite:async()=>true});
 t.after(()=>executor.dispose());
 return {key,projectRef,source,destination,who,viewer,sourceRepo,destinationRepo,api,restored,executor};
}

async function insertSavedTransaction(db,key,transactionId,fields){
 const payload={scheme:'chase-private-v1',version:1,encrypted:createTokenSealer(key).seal(fields,'finance-record:'+a+':'+transactionId)};
 await actor(db,a,sa);
 return (await db.query("insert into public.cc_records (id,owner_id,visibility,section,item_type,origin,payload) values($1,$2,'private','Finances','provider_bank_transaction','plaid_readonly',$3) returning *",
  [transactionId,a,JSON.stringify(payload)])).rows[0];
}


test('a restored bill reopens its paid occurrence and preserves a later payment across archive replay',async t=>{
 const {key,projectRef,source,destination,who,viewer,sourceRepo,destinationRepo,api,restored,executor}=await financeRecovery(t,'fictionalbillrecovery');
 const billId=nextFinanceSlot(a,billType,[]),dueDay='2026-02-13',nextDay='2026-03-13';
 const bill={label:'Fictional monthly bill',dueDay,endDay:'',frequency:'monthly',interval:1,estimated:false,amountMinor:4300};
 const draft=(id,item_type,fields)=>({id,owner_id:a,visibility:'private',household_id:null,section:'Finances',origin:'PRIVATE_MANUAL_FINANCE',item_type,
  payload:{fictional:true,ownerId:a,version:1,...fields}});
 const [schedule]=await api.saveBill('a',a,draft(billId,billType,{bill}),null);
 const payment=day=>draft(confirmationId(a,billId,day),confirmationType,{billId,match:null,
  confirmation:{label:bill.label,dueDay:day,paidDay:day,estimated:false,expectedMinor:4300,amountMinor:4300,source:'manual'}});
 await api.confirmBill('a',a,payment(dueDay),schedule);
 const ids=new Set([billId,confirmationId(a,billId,dueDay)]);
 const original=(await sourceRepo.readPrivateRows(who,a)).filter(row=>ids.has(row.id));
 assert.equal(original.length,2);
 const archive=rows=>sealPrivateWorkspace({projectRef,ownerId:a,key,rows}).bytes;
 const bytes=archive(original);
 const missingBill=await executor.prepare(who,{bytes:archive(original.filter(row=>row.id!==billId))});
 assert.equal(missingBill.canRestore,false);assert.equal(missingBill.reviewId,undefined);
 const review=await executor.prepare(who,{bytes});assert.equal(review.canRestore,true);assert.equal(review.insertCount,2);
 assert.equal((await executor.execute(who,{reviewId:review.reviewId,approved:true})).restored,2);
 assert.deepEqual((await destinationRepo.readPrivateRows(who,a)).filter(row=>ids.has(row.id)),original);
 const now=Date.parse('2026-05-01T12:00:00Z');
 const weekly=anchor=>readBriefBillWeek({api:restored,actor:viewer,fields:{anchor,range:'rolling',weekStart:1},now,expiresAt:now+300000});
 assert.deepEqual((await weekly(dueDay)).days[0],{day:dueDay,paid:1,unpaid:0});
 assert.deepEqual((await weekly(nextDay)).days[0],{day:nextDay,paid:0,unpaid:1});
 const daily=createBriefBillSources({api:restored,now:()=>now});t.after(()=>daily.dispose());
 const page=await daily.list('recover',viewer,dueDay,now+300000,{offset:0});
 const detail=await daily.read('recover',viewer,page.rows[0].billReadToken);
 assert.equal(detail.scheduleLabel,bill.label);assert.equal(detail.frequency,'monthly');assert.equal(detail.paidDay,dueDay);
 const [originalSchedule]=await restored.getBillRecord('a',a,billType,billId);
 await restored.confirmBill('a',a,payment(nextDay),originalSchedule);
 const beforeReplay=await destinationRepo.readPrivateRows(who,a);
 const again=await executor.prepare(who,{bytes});assert.equal(again.insertCount,0);assert.equal(again.canRestore,true);
 assert.equal((await executor.execute(who,{reviewId:again.reviewId,approved:true})).restored,0);
 assert.deepEqual(await destinationRepo.readPrivateRows(who,a),beforeReplay);
 assert.deepEqual((await weekly(nextDay)).days[0],{day:nextDay,paid:1,unpaid:0});
 assert.equal((await restored.listBillConfirmations('a',a,billId,dueDay,nextDay)).length,2);

 const matchedDay='2026-04-13',transactionId=randomUUID();
 const savedTransaction={connectionId:randomUUID(),sourceId:'fixture-april-payment',provider:'plaid',institution:'Chase',fictional:false,
  content:{currency:'USD',name:'Fictional merchant',merchant:'Fictional biller',date:matchedDay,accountId:'fixture-account',
   amountMinor:4300,pending:false,pendingTransactionId:null}};
 const snapshot=await insertSavedTransaction(source,key,transactionId,savedTransaction);
 const {match}=billMatchCandidate({...snapshot,payload:savedTransaction},a,matchedDay);
 const bankPayment=payment(matchedDay);bankPayment.payload.match=match;bankPayment.payload.confirmation.source='saved_transaction';
 await api.confirmBill('a',a,bankPayment,schedule);
 const matchedRows=(await sourceRepo.readPrivateRows(who,a)).filter(row=>row.id===bankPayment.id);
 assert.equal(matchedRows.length,1);
 const matchedArchive=archive(matchedRows);
 assert.equal((await executor.prepare(who,{bytes:matchedArchive})).canRestore,false);
 await destination.exec('begin');
 try{
  await insertSavedTransaction(destination,key,transactionId,{...savedTransaction,content:{...savedTransaction.content,amountMinor:4400}});
  const changed=await executor.prepare(who,{bytes:matchedArchive});
  assert.equal(changed.canRestore,false);assert.equal(changed.reviewId,undefined);
 }finally{await destination.exec('rollback');}
 await insertSavedTransaction(destination,key,transactionId,savedTransaction);
 const ready=await executor.prepare(who,{bytes:matchedArchive});
 assert.equal(ready.canRestore,true);assert.equal(ready.insertCount,1);
 assert.equal((await executor.execute(who,{reviewId:ready.reviewId,approved:true})).restored,1);
 assert.deepEqual((await weekly(matchedDay)).days[0],{day:matchedDay,paid:1,unpaid:0});
 assert.deepEqual(await restored.usedBillMatchKeys('a',a,[match.key]),[match.key]);
 const matchedReplay=await executor.prepare(who,{bytes:matchedArchive});
 assert.equal(matchedReplay.insertCount,0);
 assert.equal((await executor.execute(who,{reviewId:matchedReplay.reviewId,approved:true})).restored,0);
 assert.deepEqual(await restored.listBills('b',a),[]);
});

test('recovering a reconciled budget counts its split expense once and preserves newer spending',async t=>{
 const {key,projectRef,source,destination,who,viewer,sourceRepo,destinationRepo,api,restored,executor}=await financeRecovery(t,'fictionalbudgetrestore');
 const day='2026-04-03',postedDay='2026-04-04',transactionId=randomUUID();
 const plain={connectionId:randomUUID(),sourceId:'fixture-april-budget',provider:'plaid',institution:'Chase',fictional:false,
  content:{currency:'USD',name:'Fictional merchant',merchant:'Fictional shop',date:postedDay,accountId:'fixture-account',
   amountMinor:4550,pending:false,pendingTransactionId:null}};
 const snapshot=await insertSavedTransaction(source,key,transactionId,plain);
 const period={period:'month',periodStart:'2026-04-01',periodEnd:'2026-04-30'};
 const budget={...period,plannedIncomeMinor:20000,allocations:[{category:'Food',plannedMinor:8000},{category:'Household',plannedMinor:6000}],
  transactions:[{day,label:'Fictional groceries',category:'',amountMinor:4500,splits:[{category:'Food',amountMinor:3500},{category:'Household',amountMinor:1000}]}]};
 const budgetId=manualBudgetId(a,period);
 const draft={id:budgetId,owner_id:a,visibility:'private',household_id:null,section:'Finances',origin:'PRIVATE_MANUAL_FINANCE',item_type:'manual_finance_budget',
  payload:{fictional:true,ownerId:a,version:1,budget}};
 const [initial]=await api.saveManualBudget('a',a,draft,null);
 const plan=prepareExpenseReconciliation(a,categorySource({...snapshot,payload:plain},a),initial,0);
 const [match]=await api.matchExpense('a',a,plan,initial);
 const rows=(await sourceRepo.readPrivateRows(who,a)).filter(row=>row.id===budgetId||row.id===match.id);
 assert.equal(rows.length,2);
 const archive=entries=>sealPrivateWorkspace({projectRef,ownerId:a,key,rows:entries}).bytes;
 const bytes=archive(rows);
 const missingSource=await executor.prepare(who,{bytes});
 assert.equal(missingSource.canRestore,false);assert.equal(missingSource.reviewId,undefined);
 await insertSavedTransaction(destination,key,transactionId,plain);
 for(const row of rows){
  const incomplete=await executor.prepare(who,{bytes:archive([row])});
  assert.equal(incomplete.canRestore,false);assert.equal(incomplete.reviewId,undefined);
 }
 const review=await executor.prepare(who,{bytes});
 assert.equal(review.canRestore,true);assert.equal(review.insertCount,2);
 assert.equal((await executor.execute(who,{reviewId:review.reviewId,approved:true})).restored,2);
 assert.deepEqual((await destinationRepo.readPrivateRows(who,a)).filter(row=>row.id===budgetId||row.id===match.id),rows);
 const [recovered]=await restored.getManualBudget('a',budgetId,a);
 const [receipt]=await restored.getExpenseMatch('a',a,match.id);
 assert.equal(recovered.payload.budget.transactions[0].reconciliationId,receipt.id);
 assert.equal(receipt.payload.expense.amountMinor,4500);assert.equal(receipt.payload.source.amountMinor,4550);
 const totals=calculateManualBudget(recovered.payload.budget);
 assert.deepEqual(totals.categories.map(({category,actualMinor})=>[category,actualMinor]),[['Food',3500],['Household',1000]]);
 const now=Date.parse('2026-04-22T12:00:00Z');
 const widget=showAmounts=>readFinanceWidget({api:restored,actor:viewer,type:'budget',now,expiresAt:now+300000,options:{showAmounts,showPercentages:false,limit:2}});
 assert.deepEqual((await widget(true)).rows.map(({label,amount})=>[label,amount]),[['Recorded expenses',4500],['Left to spend',15500]]);
 assert.ok((await widget(false)).rows.every(row=>!Object.hasOwn(row,'amount')));
 const idempotent=await executor.prepare(who,{bytes});
 assert.equal(idempotent.insertCount,0);
 assert.equal((await executor.execute(who,{reviewId:idempotent.reviewId,approved:true})).restored,0);
 const transactions=[...recovered.payload.budget.transactions,{day:'2026-04-12',category:'Food',amountMinor:2100}];
 const updated={...recovered,payload:{...recovered.payload,budget:{...recovered.payload.budget,transactions}}};
 const [later]=await restored.saveManualBudget('a',a,updated,recovered);
 const replay=await executor.prepare(who,{bytes});
 assert.equal(replay.canRestore,false);assert.equal(replay.conflictCount,1);assert.equal(replay.reviewId,undefined);
 assert.deepEqual((await restored.getManualBudget('a',budgetId,a))[0],later);
 assert.deepEqual((await restored.getExpenseMatch('a',a,match.id))[0],receipt);
 assert.deepEqual((await widget(true)).rows.map(row=>row.amount),[6600,13400]);
 assert.deepEqual(await restored.getManualBudget('b',budgetId,a),[]);
});
