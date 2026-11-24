import {escapeHtml as esc} from './core.mjs';
import {validDay} from './dev-brief-model.mjs';
import {BILL_FREQUENCIES,manualBill,billConfirmation,billOccurrences} from './private-manual-bills.mjs';
import {parseManualAmount} from './private-finance-manual.mjs';
import {savedAccountAmount as dollars} from './private-saved-finance-panel.mjs';
import {newYorkTaskDay} from './private-smart-task.mjs';

const frequencies={once:'One time',weekly:'Weekly',monthly:'Monthly',yearly:'Yearly'};
const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const keys=(value,fields)=>value&&Object.keys(value).sort().join(',')===fields;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const amount=value=>dollars(value).replace(/[$,]/g,'');
const button=(action,label)=>'<button class="btn" type="button" data-bill-action="'+esc(action)+'">'+esc(label)+'</button>';
const field=(name,label,value,type='text')=>'<label>'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(String(value))+'"></label>';
const estimate=(value,estimated)=>(estimated?'Estimated ':'Expected ')+esc(dollars(value));
function scheduleText(bill){
 return esc(bill.label)+' · '+estimate(bill.amountMinor,bill.estimated)+' · '+esc(bill.dueDay)+' · '+esc(frequencies[bill.frequency])+
  (bill.interval>1?' (every '+bill.interval+' periods)':'')+(bill.endDay?' through '+esc(bill.endDay):'');
}
function confirmText(payment){
 return esc(payment.label)+' · Due '+esc(payment.dueDay)+' · '+estimate(payment.expectedMinor,payment.estimated)+'<br>Paid '+
  esc(dollars(payment.amountMinor))+' on '+esc(payment.paidDay);
}
export function createManualBillPanel({client,clock=Date.now,canOpen=()=>true,onChange=()=>{},allowMatching=false}){
 let list,selected,detail,range,draft,review,shown,notice,busy,timer,sequence=0;
 function reset(){
  sequence++;clearTimeout(timer);list=selected=detail=draft=review=null;shown=busy=false;notice='';
  const today=newYorkTaskDay(clock()),last=new Date(today+'T00:00:00Z');last.setUTCMonth(last.getUTCMonth()+1,0);
  range={from:today.slice(0,8)+'01',to:last.toISOString().slice(0,10)};
 }
 reset();
 const fresh=()=>list?.expiresAt>clock();
 async function request(operation,apply,error){
  const run=sequence;busy=true;notice='';onChange();
  try{const result=await operation();if(sequence===run)apply(result);}
  catch{if(sequence===run)notice=error;}
  finally{if(sequence===run){busy=false;onChange();}}
 }
 function load(){
  reset();
  return request(()=>client.manualBillList(),value=>{
   if(!keys(value,'bills,expiresAt')||!Number.isFinite(value.expiresAt)||value.expiresAt<=clock()||value.expiresAt>clock()+300000||
      !Array.isArray(value.bills)||value.bills.length>100||new Set(value.bills.map(b=>b.billToken)).size!==value.bills.length||
      value.bills.some(b=>!keys(b,'billToken,label,version')||!token(b.billToken)||typeof b.label!=='string'||b.label.length>120||
       !Number.isInteger(b.version)||b.version<1))throw Error();
   list=value;timer=setTimeout(()=>{reset();notice='Your bill view expired.';onChange();},Math.max(1,list.expiresAt-clock()));timer.unref?.();
  },'Could not open bills.');
 }
 function read(){
  detail=null;shown=false;
  return request(()=>client.manualBillRead({billToken:selected.billToken,...range}),value=>{
   if(!fresh()||!keys(value,'bill,expiresAt,occurrences,today,version')||value.expiresAt!==list.expiresAt||value.version!==selected.version||
      !Array.isArray(value.occurrences)||value.occurrences.length>367)throw Error();
   const bill=manualBill(value.bill);
   const history=value.occurrences.filter(o=>o.payment).map(o=>o.payment);
   const occurrences=billOccurrences(bill,history,range.from,range.to,value.today);
   if(bill.label!==selected.label||!same(occurrences,value.occurrences))throw Error();
   detail={bill,occurrences};
  },'Check the date range and reopen the bill.');
 }
 function edit(bill){
  draft={kind:'bill',label:bill?.label??'',dueDay:bill?.dueDay??newYorkTaskDay(clock()),frequency:bill?.frequency??'once',
   interval:bill?.interval??1,endDay:bill?.endDay??'',estimated:bill?.estimated??false,amount:bill?amount(bill.amountMinor):''};
 }
 function paymentDraft(index,kind){
  const occurrence=detail?.occurrences[index];
  if(!occurrence||occurrence.payment)return;
  draft={kind,occurrence,paidDay:newYorkTaskDay(clock()),amount:'',page:null,offset:0};
 }
 function matchPage(offset){
  draft.page=null;
  return request(()=>client.manualBillCandidates({billToken:selected.billToken,dueDay:draft.occurrence.dueDay,offset}),value=>{
   if(!fresh()||!keys(value,'expiresAt,more,transactions')||value.expiresAt!==list.expiresAt||typeof value.more!=='boolean'||
      !Array.isArray(value.transactions)||value.transactions.length>20||new Set(value.transactions.map(tx=>tx.transactionToken)).size!==value.transactions.length||
      value.transactions.some(tx=>!keys(tx,'amountMinor,label,paidDay,transactionToken')||!token(tx.transactionToken)||typeof tx.label!=='string'||
       tx.label.length>300||!validDay(tx.paidDay)||!Number.isSafeInteger(tx.amountMinor)||tx.amountMinor<=0))throw Error();
   draft.offset=offset;draft.page=value;
  },'Saved transactions could not be opened.');
 }
 async function prepare(tx=null){
  let expected,summary,body;
  try{
   if(draft.kind==='bill'){
    expected=manualBill({label:draft.label.trim(),dueDay:draft.dueDay,frequency:draft.frequency,
     interval:draft.frequency==='once'?1:Number(draft.interval),endDay:draft.frequency==='once'?'':draft.endDay,
     estimated:draft.estimated,amountMinor:parseManualAmount(draft.amount)});
    body={bill:expected,...(selected?{billToken:selected.billToken}:{})};
   }else{
    const {label,dueDay,estimated,expectedMinor}=draft.occurrence;
    const paidDay=tx?.paidDay??draft.paidDay,amountMinor=tx?.amountMinor??parseManualAmount(draft.amount);
    expected=billConfirmation({label,dueDay,estimated,expectedMinor,paidDay,amountMinor,source:tx?'saved_transaction':'manual'});
    if(paidDay>newYorkTaskDay(clock()))throw Error();
    if(tx)summary={label:tx.label,paidDay,amountMinor};
    body={billToken:selected.billToken,dueDay,...(tx?{transactionToken:tx.transactionToken}:{paidDay,amountMinor})};
   }
  }catch{notice='Check the dates, frequency and amount.';onChange();return;}
  await request(()=>client.manualBillReview(body),value=>{
   if(keys(value,'noChanges')&&value.noChanges===true){notice='No bill changes to save.';return;}
   const isBill=draft.kind==='bill';
   const fields=isBill?'bill,expiresAt,reviewId':tx?'confirmation,expiresAt,reviewId,transaction':'confirmation,expiresAt,reviewId';
   if(!fresh()||!keys(value,fields)||!token(value.reviewId)||value.expiresAt!==list.expiresAt||
      !same(isBill?manualBill(value.bill):billConfirmation(value.confirmation),expected)||
      tx&&(!keys(value.transaction,'amountMinor,label,paidDay')||value.transaction.label!==summary.label||value.transaction.paidDay!==summary.paidDay||value.transaction.amountMinor!==summary.amountMinor))throw Error();
   review=value;
  },'The bill or transaction changed. Reopen it before reviewing again.');
 }
 async function save(){
  const run=sequence;busy=true;notice='';onChange();
  try{const result=await client.manualBillSave(review.reviewId);if(run!==sequence)return;
   if(result?.saved!==true||!Number.isInteger(result.version)||result.version<1)throw Error();
   await load();
  }catch{if(run===sequence){reset();notice='Save could not be confirmed. Reopen bills to check the payment.';onChange();}}
 }
 function render(){
  const heading='<h2>Bills</h2><p role="status">'+esc(busy?'Checking bills…':notice)+'</p>';
  let body;
  if(!fresh())body=button('load','Open bills');
  else if(review)body='<legend>Review '+(review.bill?'bill schedule':'payment confirmation')+'</legend><p>'+
   (review.bill?scheduleText(review.bill):confirmText(review.confirmation)+(review.transaction?'<br>Saved transaction · '+esc(review.transaction.label):'<br>Manually confirmed'))+
   '</p>'+button('approve','Approve and save')+button('back','Back to edit');
  else if(draft?.kind==='match')body='<legend>Match a saved transaction</legend><p>'+esc(draft.occurrence.label)+' · '+esc(draft.occurrence.dueDay)+' · '+estimate(draft.occurrence.expectedMinor,draft.occurrence.estimated)+'</p>'+
   (draft.page?.transactions.map((tx,i)=>'<p>'+esc(tx.label)+' · '+esc(tx.paidDay)+' · '+esc(dollars(tx.amountMinor))+' '+button('match-tx-'+i,'Review match')+'</p>').join('')||'<p>No eligible saved transactions on this page.</p>')+
   (draft.offset>0?button('previous','Previous page'):'')+(draft.page?.more?button('next','Next page'):'')+button('discard','Back to bill');
  else if(draft){
   let fields;
   if(draft.kind==='bill')fields=field('label','Bill name',draft.label)+field('dueDay','First due date',draft.dueDay,'date')+
    '<label>Frequency<select name="frequency">'+BILL_FREQUENCIES.map(f=>'<option value="'+f+'" '+(f===draft.frequency?'selected':'')+'>'+frequencies[f]+'</option>').join('')+'</select></label>'+
    (draft.frequency==='once'?'':field('interval','Repeat every (periods)',draft.interval,'number')+field('endDay','End date (optional)',draft.endDay,'date'))+
    field('amount','Expected amount',draft.amount)+'<label><input type="checkbox" name="estimated" '+(draft.estimated?'checked':'')+'>Amount is an estimate</label>';
   else fields='<p>'+esc(draft.occurrence.label)+' · Due '+esc(draft.occurrence.dueDay)+' · '+estimate(draft.occurrence.expectedMinor,draft.occurrence.estimated)+'</p>'+
    field('paidDay','Date paid',draft.paidDay,'date')+field('amount','Actual amount paid',draft.amount);
   body='<form id="bill-edit">'+fields+'<button type="submit" class="btn">Review '+(draft.kind==='bill'?'bill':'payment')+'</button></form>'+button('discard','Cancel edit');
  }else if(selected){
   body='<legend>'+esc(selected.label)+'</legend><form id="bill-period">'+field('from','From',range.from,'date')+field('to','Through',range.to,'date')+'<button type="submit" class="btn">Open period</button></form>';
   if(detail){
    body+=button('edit','Edit schedule')+button('amounts',shown?'Hide amounts':'Show amounts');
    body+=detail.occurrences.map((o,i)=>'<p>'+esc(o.label)+' · '+esc(o.dueDay)+' · '+esc(o.status)+(o.estimated?' · Estimated':'')+
     (shown?' · '+esc(dollars(o.expectedMinor)):'')+(o.payment?' · '+esc(o.payment.paidDay)+' · '+(o.payment.source==='manual'?'Manual confirmation':'Matched transaction')+
      (shown?' · Paid '+esc(dollars(o.payment.amountMinor)):''):' '+button('pay-'+i,'Confirm payment')+(allowMatching?button('match-'+i,'Match saved transaction'):''))+'</p>').join('');
    if(!detail.occurrences.length)body+='<p>No bills due in this period.</p>';
   }
   body+=button('list','Back to bills');
  }else body=list.bills.map(b=>button('select-'+b.billToken,b.label)).join('')+button('add','Add bill')+button('close','Close bills');
  return heading+'<fieldset '+(busy?'disabled':'')+'>'+body+'</fieldset>';
 }
 return {render,reset,blocked:()=>Boolean(busy||draft||review),input(event){
  const el=event.target;
  if(el.form?.id==='bill-period'){
   if(!busy&&['from','to'].includes(el.name)&&range[el.name]!==el.value){range[el.name]=el.value;const redraw=Boolean(detail);detail=null;if(redraw)onChange();}
   return true;
  }
  if(el.form?.id!=='bill-edit')return false;
  if(!busy&&!review&&draft&&['label','dueDay','frequency','interval','endDay','amount','paidDay','estimated'].includes(el.name)){
   draft[el.name]=el.type==='checkbox'?el.checked:el.value;if(el.name==='frequency')onChange();
  }
  return true;
 },submit(event){
  const id=event.target.id;
  if(!['bill-period','bill-edit'].includes(id))return false;
  event.preventDefault();
  if(!busy&&fresh()&&!review){if(id==='bill-period'&&selected&&!draft&&canOpen())void read();else if(id==='bill-edit'&&draft)void prepare();}
  return true;
 },click(event){
  const action=event.target.closest('[data-bill-action]')?.dataset.billAction;
  if(!action)return false;if(busy)return true;
  if(action==='load'){if(canOpen())void load();return true;}
  if(!fresh())return true;
  if(review){if(action==='approve')void save();if(action==='back'){review=null;onChange();}return true;}
  if(draft){
   if(action==='discard'){draft=null;notice='';onChange();}
   else if(draft.kind==='match'){
    if(action==='previous'&&draft.offset>=20)void matchPage(draft.offset-20);
    else if(action==='next'&&draft.page?.more)void matchPage(draft.offset+20);
    else if(/^match-tx-\d+$/.test(action)){const tx=draft.page?.transactions[Number(action.slice(9))];if(tx)void prepare(tx);}
   }
   return true;
  }
  if(!canOpen())return true;
  if(action==='close'){reset();void client.manualBillCancel().catch(()=>{});}
  if(action==='list'){void load();return true;}
  if(action.startsWith('select-')&&!selected){selected=list.bills.find(b=>b.billToken===action.slice(7));if(selected){void read();return true;}}
  if(action==='add'&&!selected)edit(null);
  if(action==='edit'&&detail)edit(detail.bill);
  if(action==='amounts'&&detail)shown=!shown;
  if(/^pay-\d+$/.test(action))paymentDraft(Number(action.slice(4)),'manual');
  if(allowMatching&&/^match-\d+$/.test(action)){paymentDraft(Number(action.slice(6)),'match');if(draft){void matchPage(0);return true;}}
  onChange();return true;
 }};
}
