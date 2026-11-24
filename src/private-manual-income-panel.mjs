import {escapeHtml as esc} from './core.mjs';
import {newYorkTaskDay} from './private-smart-task.mjs';
import {parseManualAmount} from './private-finance-manual.mjs';
import {INCOME_CADENCES,manualIncomeSchedule,manualIncomePayment,manualIncomeForPeriod} from './private-manual-income.mjs';
import {savedAccountAmount as dollars} from './private-saved-finance-panel.mjs';

const names={weekly:'Weekly',biweekly:'Every two weeks',semi_monthly:'Twice a month',monthly:'Monthly',custom:'Custom dates'};
const button=(action,label)=>'<button type="button" class="btn" data-income-action="'+esc(action)+'">'+esc(label)+'</button>';
const input=(label,name,value,type='text',optional=false)=>'<label>'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(optional?'':'required')+'></label>';
const decimal=value=>dollars(value).replace(/[$,]/g,'');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const positive=v=>Number.isSafeInteger(v)&&v>0;
const key=p=>p.expectedDay+'#'+p.slot;
const keys=(value,expected)=>value&&Object.keys(value).sort().join(',')===expected;
function period(now){
 const today=newYorkTaskDay(now),last=new Date(today+'T00:00:00Z');last.setUTCMonth(last.getUTCMonth()+1,0);
 return {from:today.slice(0,8)+'01',to:last.toISOString().slice(0,10)};
}
function verifyRead(value,selection,range,expiresAt){
 if(!keys(value,'expiresAt,received,schedule,summary,version')||value.expiresAt!==expiresAt||value.version!==selection.version||
    !Array.isArray(value.received)||value.received.length>2000||!Array.isArray(value.summary?.payments)||value.summary.payments.length>2000)
  throw Error('Income details unavailable.');
 const schedule=manualIncomeSchedule(value.schedule),receipts=new Map(),received=new Set();
 if(schedule.label!==selection.label||schedule.cadence!==selection.cadence)throw Error('Schedule changed.');
 function add(row){
  const p=manualIncomePayment(row),prior=receipts.get(key(p));
  if(prior&&!equal(prior,p))throw Error('Conflicting receipt.');
  receipts.set(key(p),p);
 }
 for(const row of value.received){
  add(row);if(received.has(key(row))||row.receivedDay<range.from||row.receivedDay>range.to)throw Error('Unexpected receipt.');
  received.add(key(row));
 }
 for(const entry of value.summary.payments)if(entry.receipt)add(entry.receipt);
 for(const [id,p] of receipts)if(p.receivedDay>=range.from&&p.receivedDay<=range.to&&!received.has(id))throw Error('Missing receipt.');
 const summary=manualIncomeForPeriod(schedule,[...receipts.values()],range.from,range.to);
 if(!equal(summary,value.summary))throw Error('Unverified income totals.');
 return {schedule,summary,received:value.received};
}
function scheduleText(s){
 return esc(s.label)+' · '+esc(names[s.cadence])+' · '+esc(s.startDay)+(s.endDay?' through '+esc(s.endDay):' onward')+
  (s.monthDays.length?' · Pay days '+s.monthDays.join(' and '):'')+(s.customDates.length?' · '+s.customDates.map(esc).join(', '):'');
}
function paymentText(p){
 return 'Scheduled '+esc(p.expectedDay)+' · Payment '+p.slot+' · Expected '+esc(dollars(p.expectedNetMinor))+
  '<br>Received '+esc(p.receivedDay)+' · Net '+esc(dollars(p.netMinor))+
  (p.paystub?'<br>Gross '+esc(dollars(p.paystub.grossMinor))+' · Tax '+esc(dollars(p.paystub.taxMinor))+' · Other deductions '+esc(dollars(p.paystub.otherDeductionsMinor)):'');
}
export function createManualIncomePanel({client,clock=Date.now,canOpen=()=>true,onChange=()=>{}}){
 let list,selection,detail,range,draft,review,notice,shown,busy,timer,sequence=0;
 function reset(){sequence++;clearTimeout(timer);list=selection=detail=draft=review=null;range=period(clock());notice='';shown=busy=false;}
 reset();
 const fresh=()=>list&&list.expiresAt>clock();
 function arm(){
  timer=setTimeout(()=>{reset();notice='Your income view expired. Open it again.';onChange();},Math.max(1,list.expiresAt-clock()));timer.unref?.();
 }
 async function load(){
  reset();const run=sequence;busy=true;onChange();
  try{
   const result=await client.manualIncomeList();if(run!==sequence)return;
   if(!keys(result,'expiresAt,sources')||!Number.isFinite(result.expiresAt)||result.expiresAt<=clock()||result.expiresAt>clock()+300000||
      !Array.isArray(result.sources)||result.sources.length>100||new Set(result.sources.map(r=>r.sourceToken)).size!==result.sources.length||
      result.sources.some(r=>!keys(r,'cadence,label,sourceToken,version')||!token(r.sourceToken)||!positive(r.version)||!names[r.cadence]||typeof r.label!=='string'||r.label.length>100))throw Error();
   list=result;arm();
  }catch{if(run===sequence)notice='Could not open manual income.';}
  finally{if(run===sequence){busy=false;onChange();}}
 }
 async function read(){
  const run=sequence;busy=true;shown=false;detail=null;notice='';onChange();
  try{
   const result=await client.manualIncomeRead({sourceToken:selection.sourceToken,...range});
   if(run===sequence&&fresh())detail=verifyRead(result,selection,range,list.expiresAt);
  }catch{if(run===sequence)notice='Check the dates and open this income period again.';}
  finally{if(run===sequence){busy=false;onChange();}}
 }
 function editSchedule(s){
  draft={kind:'schedule',label:s?.label??'',cadence:s?.cadence??'biweekly',startDay:s?.startDay??newYorkTaskDay(clock()),endDay:s?.endDay??'',
   expected:s?decimal(s.expectedNetMinor):'',firstDay:s?.monthDays[0]??1,secondDay:s?.monthDays[1]??15,customDates:s?.customDates.join(', ')??''};
 }
 function editPayment(index){
  const expected=detail?.summary.payments[index];if(!expected)return;
  const p=expected.receipt;
  draft={kind:'payment',expectedDay:expected.expectedDay,slot:expected.slot,expectedNetMinor:expected.expectedNetMinor,
   receivedDay:p?.receivedDay??newYorkTaskDay(clock()),net:p?decimal(p.netMinor):'',stub:Boolean(p?.paystub),
   gross:p?.paystub?decimal(p.paystub.grossMinor):'',tax:p?.paystub?decimal(p.paystub.taxMinor):'',other:p?.paystub?decimal(p.paystub.otherDeductionsMinor):'0.00',existing:Boolean(p)};
 }
 async function prepare(){
  const run=sequence;busy=true;notice='';onChange();
  try{
   let values,expected,isEdit;
   if(draft.kind==='schedule'){
    const schedule=manualIncomeSchedule({label:draft.label.trim(),cadence:draft.cadence,startDay:draft.startDay,endDay:draft.endDay,expectedNetMinor:parseManualAmount(draft.expected),
     monthDays:draft.cadence==='semi_monthly'?[Number(draft.firstDay),Number(draft.secondDay)]:[],
     customDates:draft.cadence==='custom'?draft.customDates.split(',').map(d=>d.trim()).sort():[]});
    values={schedule,...(selection?{sourceToken:selection.sourceToken}:{})};expected=schedule;isEdit=Boolean(selection);
   }else{
    const payment=manualIncomePayment({expectedDay:draft.expectedDay,slot:draft.slot,expectedNetMinor:draft.expectedNetMinor,receivedDay:draft.receivedDay,netMinor:parseManualAmount(draft.net),
     paystub:draft.stub?{grossMinor:parseManualAmount(draft.gross),taxMinor:parseManualAmount(draft.tax),otherDeductionsMinor:parseManualAmount(draft.other)}:null});
    const {expectedNetMinor,...editable}=payment;values={sourceToken:selection.sourceToken,payment:editable};expected=payment;isEdit=draft.existing;
   }
   const r=await client.manualIncomeReview(values);if(run!==sequence||!fresh())return;
   if(r?.noChanges===true){notice='No income changes to save.';return;}
   const kind=draft.kind;
   if(!keys(r,['action','expiresAt','reviewId',kind].sort().join(','))||r.expiresAt!==list.expiresAt||!token(r.reviewId)||r.action!==(isEdit?'edit':'create')||
      !equal(kind==='schedule'?manualIncomeSchedule(r.schedule):manualIncomePayment(r.payment),expected))throw Error();
   review=r;
  }catch{if(run===sequence)notice=draft.kind==='schedule'?'Check the schedule, dates and expected pay.':'Check the receipt date and amounts. Gross pay minus taxes and deductions must equal net pay.';}
  finally{if(run===sequence){busy=false;onChange();}}
 }
 async function save(){
  const run=sequence;busy=true;onChange();
  try{
   const r=await client.manualIncomeSave(review.reviewId);if(run!==sequence)return;
   if(r?.saved!==true||!positive(r.version))throw Error();
   await load();
  }catch{if(run===sequence){reset();notice='Save could not be confirmed. Open income to check before retrying.';onChange();}}
 }
 function render(){
  const heading='<h2>Manual income</h2><p role="status">'+esc(busy?'Checking income…':notice)+'</p>';
  const group=html=>'<fieldset '+(busy?'disabled':'')+'>'+html+'</fieldset>';
  if(!fresh())return heading+button('load','Open manual income');
  if(review)return heading+group('<legend>Review '+(review.payment?'paycheck':'income schedule')+'</legend><p>'+
   (review.payment?paymentText(review.payment):scheduleText(review.schedule)+' · Expected net '+esc(dollars(review.schedule.expectedNetMinor)))+'</p>'+button('approve','Approve income save')+button('back','Back to edit'));
  if(draft){
   let body;
   if(draft.kind==='schedule')body='<legend>Income schedule</legend>'+input('Name','label',draft.label)+'<label>Frequency<select name="cadence">'+INCOME_CADENCES.map(c=>'<option value="'+c+'" '+(c===draft.cadence?'selected':'')+'>'+names[c]+'</option>').join('')+'</select></label>'+
    input('First eligible date','startDay',draft.startDay,'date')+input('End date (optional)','endDay',draft.endDay,'date',true)+input('Expected net pay','expected',draft.expected)+
    (draft.cadence==='semi_monthly'?input('First monthly pay day','firstDay',draft.firstDay,'number')+input('Second monthly pay day','secondDay',draft.secondDay,'number')+'<p>Pay days beyond the end of a month fall on its last date.</p>':'')+
    (draft.cadence==='custom'?input('Pay dates, separated by commas (YYYY-MM-DD)','customDates',draft.customDates):'');
   else body='<legend>Record paycheck</legend><p>Expected '+esc(draft.expectedDay)+' · '+esc(dollars(draft.expectedNetMinor))+'</p>'+input('Date received','receivedDay',draft.receivedDay,'date')+
    input('Actual net pay','net',draft.net)+'<label><input type="checkbox" name="stub" '+(draft.stub?'checked':'')+'>Include paystub details</label>'+
    (draft.stub?input('Gross pay','gross',draft.gross)+input('Taxes','tax',draft.tax)+input('Other deductions','other',draft.other):'');
   return heading+'<form id="income-edit">'+group(body+'<button>Review changes</button>'+button('discard','Discard edits'))+'</form>';
  }
  if(!selection)return heading+group('<legend>Income sources</legend>'+list.sources.map(s=>button('select-'+s.sourceToken,s.label+' · '+names[s.cadence])).join('')+
   button('add','Add income schedule')+button('close','Close income'));
  const amount=n=>shown?esc(dollars(n)):'Hidden';
  let html=heading+'<form id="income-period">'+group('<legend>'+esc(selection.label)+'</legend>'+input('From','from',range.from,'date')+input('Through','to',range.to,'date')+'<button>View period</button>')+'</form>';
  if(detail){
   const s=detail.summary;
   html+='<p>'+scheduleText(detail.schedule)+'</p><dl><dt>Expected in this period</dt><dd>'+amount(s.expectedNetMinor)+'</dd><dt>Received in this period</dt><dd>'+amount(s.receivedNetMinor)+'</dd><dt>Difference</dt><dd>'+amount(s.differenceMinor)+'</dd></dl>'+
    button('amounts',shown?'Hide amounts':'Show amounts')+button('edit','Edit income schedule');
   html+='<h3>Scheduled paychecks</h3>'+(s.payments.length?'<ul>'+s.payments.map((p,i)=>'<li>'+esc(p.expectedDay)+' · Expected '+amount(p.expectedNetMinor)+(p.receipt?' · Received '+esc(p.receipt.receivedDay)+' · '+amount(p.receipt.netMinor):' · Awaiting receipt')+' '+button('pay-'+i,p.receipt?'Review or edit receipt':'Record paycheck')+'</li>').join('')+'</ul>':'<p>No scheduled paychecks in this period.</p>');
   if(detail.received.length)html+='<h3>Receipts in this period</h3><ul>'+detail.received.map(p=>'<li>'+esc(p.receivedDay)+' · '+amount(p.netMinor)+' · Scheduled '+esc(p.expectedDay)+'</li>').join('')+'</ul>';
  }
  return html+button('sources','Back to income sources');
 }
 return {render,reset,blocked:()=>Boolean(draft||review||busy),input(event){
  const el=event.target;
  if(el.form?.id==='income-period'){if(!busy&&['from','to'].includes(el.name)&&range[el.name]!==el.value){range[el.name]=el.value;const clear=Boolean(detail);detail=null;if(clear)onChange();}return true;}
  if(el.form?.id!=='income-edit')return false;
  if(!busy&&!review&&draft&&Object.hasOwn(draft,el.name)&&!['kind','slot','expectedNetMinor','expectedDay','existing'].includes(el.name)){
   draft[el.name]=el.type==='checkbox'?el.checked:el.value;
   if(['stub','cadence'].includes(el.name))onChange();
  }
  return true;
 },submit(event){
  const id=event.target.id;if(!['income-period','income-edit'].includes(id))return false;event.preventDefault();
  if(!busy&&fresh()&&!review){if(id==='income-period'&&selection&&!draft&&canOpen())void read();else if(id==='income-edit'&&draft)void prepare();}
  return true;
 },click(event){
  const action=event.target.closest('[data-income-action]')?.dataset.incomeAction;
  if(!action)return false;if(busy)return true;
  if(action==='load'){if(canOpen())void load();return true;}
  if(!fresh())return true;
  if(review){if(action==='approve')void save();if(action==='back'){review=null;onChange();}return true;}
  if(draft){if(action==='discard'){draft=null;onChange();}return true;}
  if(!canOpen())return true;
  if(action==='close'){reset();void client.manualIncomeCancel().catch(()=>{});}
  if(action==='sources'){void load();return true;}
  if(action==='add'&&!selection)editSchedule(null);
  if(action.startsWith('select-')&&!selection){selection=list.sources.find(s=>s.sourceToken===action.slice(7));if(selection){void read();return true;}}
  if(action==='edit'&&detail)editSchedule(detail.schedule);
  if(action==='amounts'&&detail)shown=!shown;
  if(/^pay-\d+$/.test(action)&&detail)editPayment(Number(action.slice(4)));
  onChange();return true;
 }};
}
