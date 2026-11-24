import {briefDateRange} from './private-brief-dates.mjs';
import {escapeHtml as e} from './core.mjs';
import {BILL_FREQUENCIES} from './private-manual-bills.mjs';
import {validDay} from './dev-brief-model.mjs';
import {newYorkTaskDay} from './private-smart-task.mjs';

export function createBriefBills({client,clock=Date.now,context,onChange}){
 let current=null,timer=null;
 let week=null,weekTimer=null;
 const billDate=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'});
 function resetDay(){clearTimeout(timer);current=null;}
 function resetWeek(){clearTimeout(weekTimer);week=null;}
 function reset(){resetDay();resetWeek();}
 function weekActive(view){
  const source=context();
  return week===view&&source?.day===view.anchor&&source.expiresAt>clock()&&
   source.week?.range===view.range&&source.week.weekStart===view.weekStart;
 }
 async function openWeek(){
  const source=context();
  if(!source?.week||source.expiresAt<=clock()||week?.busy)return;
  const fields={anchor:source.day,range:source.week.range,weekStart:source.week.weekStart};
  const expected=briefDateRange(fields.anchor,fields).days;
  resetWeek();const view={...fields,busy:true};week=view;onChange();
  try{
   const result=await client.briefBillWeek(fields);
   if(!weekActive(view))return;
   const now=clock();
   if(!result||Object.keys(result).sort().join(',')!=='currentDay,days,expiresAt'||
      result.currentDay!==newYorkTaskDay(now)||!Number.isFinite(result.expiresAt)||result.expiresAt<=now||result.expiresAt>now+300000||
      !Array.isArray(result.days)||result.days.length!==expected.length)throw Error();
   for(const [i,row] of result.days.entries()){
    if(!row||Object.keys(row).sort().join(',')!=='day,paid,unpaid'||row.day!==expected[i]||
       ![row.paid,row.unpaid].every(n=>Number.isInteger(n)&&n>=0)||row.paid+row.unpaid>100)throw Error();
   }
   view.result=result;view.expiresAt=Math.min(source.expiresAt,result.expiresAt);
   weekTimer=setTimeout(()=>{if(week===view){resetWeek();onChange();}},Math.max(0,view.expiresAt-now));weekTimer.unref?.();
  }catch{if(week===view)view.failed=true;}
  finally{if(week===view){view.busy=false;if(!weekActive(view))resetWeek();onChange();}}
 }
 function renderWeek(){
  if(week&&(!weekActive(week)||week.result&&(week.expiresAt<=clock()||week.result.currentDay!==newYorkTaskDay(clock()))))resetWeek();
  const source=context();
  if(!source?.week||source.expiresAt<=clock())return '';
  const button='<button class="btn" type="button" id="private-brief-week-bills"'+(week?.busy?' disabled':'')+'>'+(week?.result?'Refresh weekly bills':'View bills for this week')+'</button>';
  if(week?.busy)return '<p role="status">Loading bills for this week…</p>'+button;
  if(!week?.result)return (week?.failed?'<p role="status">Could not load bills for this week.</p>':'')+button;
  const due=week.result.days.filter(row=>row.paid+row.unpaid>0);
  const summary=due.length?'<ul>'+due.map(row=>'<li><button type="button" class="btn" data-private-brief-day="'+e(row.day)+'" aria-label="Open bill date '+e(row.day)+'">'+e(billDate.format(new Date(row.day+'T00:00:00Z')))+'</button> · '+row.unpaid+' unpaid · '+row.paid+' paid</li>').join('')+'</ul>':'<p>No bills are due this week.</p>';
  return '<section aria-label="Weekly bills"><h3>Bills this week</h3>'+summary+'<p>Payment status as of '+e(week.result.currentDay)+'.</p>'+button+'</section>';
 }
 function available(day){
  const source=context();
  return source?.day===day&&source.expiresAt>clock();
 }
 function verify(value,day,offset,previous){
  const now=clock();
  if(!value||Object.keys(value).sort().join(',')!=='currentDay,day,expiresAt,offset,rows,total,viewToken'||value.day!==day||value.offset!==offset||
     typeof value.viewToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value.viewToken)||
     previous&&['total','expiresAt','viewToken','currentDay'].some(k=>value[k]!==previous[k])||
     value.currentDay!==newYorkTaskDay(now)||!Number.isInteger(value.total)||value.total<0||value.total>100||
     !Array.isArray(value.rows)||offset>0&&offset>=value.total||value.rows.length!==Math.min(10,value.total-offset)||!Number.isFinite(value.expiresAt)||
     value.expiresAt<=now||value.expiresAt>now+300000)throw Error();
  const tokens=new Set();
  for(const row of value.rows){
   if(!row||Object.keys(row).sort().join(',')!=='billReadToken,label,status'||typeof row.billReadToken!=='string'||
      !/^[A-Za-z0-9_-]{43}$/.test(row.billReadToken)||tokens.has(row.billReadToken)||typeof row.label!=='string'||!row.label.trim()||
      row.label.length>120||!['Paid',day<value.currentDay?'Overdue':'Due'].includes(row.status))throw Error();
   tokens.add(row.billReadToken);
  }
 }
 async function open(direction=0){
  const source=context(),day=source?.day;
  if(!validDay(day)||!available(day)||current?.busy||![-1,0,1].includes(direction))return;
  const previous=direction&&current?.day===day&&current.expiresAt>clock()?current.result:null;
  if(direction&&!previous)return;
  const offset=previous?previous.offset+direction*10:0;
  if(offset<0||previous&&offset>=previous.total)return;
  resetDay();const view={day,busy:true};current=view;onChange();
  try{
   const result=await client.briefBillsPage(day,offset,previous?.viewToken);
   if(current!==view||!available(day))return;
   verify(result,day,offset,previous);
   view.result=result;view.expiresAt=Math.min(result.expiresAt,source.expiresAt);
   timer=setTimeout(()=>{if(current===view){resetDay();onChange();}},Math.max(0,view.expiresAt-clock()));timer.unref?.();
  }catch{if(current===view)view.failed=true;}
  finally{if(current===view){view.busy=false;if(!available(day))resetDay();onChange();}}
 }
 async function openSource(token){
  const view=current,row=view?.result?.rows.find(r=>r.billReadToken===token);
  if(!row||view.busy||view.expiresAt<=clock()||!available(view.day))return;
  view.busy=true;view.detail=null;view.sourceError=false;onChange();
  try{
   const d=await client.briefBillSource(token);
   if(current!==view||!available(view.day)||view.expiresAt<=clock())return;
   if(!d||Object.keys(d).sort().join(',')!=='day,endDay,expiresAt,firstDueDay,frequency,interval,label,paidDay,scheduleLabel,status'||
      d.day!==view.day||d.label!==row.label||d.status!==row.status||d.expiresAt!==view.result.expiresAt||
      typeof d.scheduleLabel!=='string'||!d.scheduleLabel.trim()||d.scheduleLabel.length>120||
      !validDay(d.firstDueDay)||d.endDay!==''&&(!validDay(d.endDay)||d.endDay<d.firstDueDay)||
      !BILL_FREQUENCIES.includes(d.frequency)||!Number.isInteger(d.interval)||d.interval<1||d.interval>365||
      d.frequency==='once'&&(d.interval!==1||d.endDay!=='')||
      (d.status==='Paid'?(!validDay(d.paidDay)||d.paidDay>view.result.currentDay):d.paidDay!==''))throw Error();
   view.detail=d;
  }catch{if(current===view)view.sourceError=true;}
  finally{if(current===view){view.busy=false;onChange();}}
 }
 function closeSource(){if(current){current.detail=null;current.sourceError=false;onChange();}}
 function render(day){
  if(current&&(current.day!==day||!available(day)||current.expiresAt<=clock()||current.result&&current.result.currentDay!==newYorkTaskDay(clock())))resetDay();
  if(!available(day))return '<p role="status">The bill schedule is unavailable.</p>';
  const result=current?.result;
  const button='<button class="btn" type="button" id="private-brief-bills-open"'+(current?.busy?' disabled':'')+'>'+(result?'Refresh bill schedule':'View bills due')+'</button>';
  if(current?.busy&&!result)return '<p role="status">Loading the bill schedule…</p>'+button;
  if(!result)return (current?.failed?'<p role="status">Could not open the saved bill schedule.</p>':'')+button;
  const position=result.rows.length===1?String(result.offset+1):(result.offset+1)+'–'+(result.offset+result.rows.length);
  const summary=result.total?'Showing '+position+' of '+result.total+' bills due on '+e(day)+'.':'No saved bills are due on '+e(day)+'.';
  const detail=current.detail;
  const units={weekly:'week',monthly:'month',yearly:'year'};
  const frequencyLabels={once:'One time',weekly:'Weekly',monthly:'Monthly',yearly:'Yearly'};
  const recurrence=detail&&(detail.interval===1?frequencyLabels[detail.frequency]:'Every '+detail.interval+' '+units[detail.frequency]+'s');
  const original=detail?'<section aria-label="Original bill schedule"><h3>'+e(detail.scheduleLabel)+'</h3><p>'+recurrence+' · First due '+e(detail.firstDueDay)+(detail.endDay?' · Ends '+e(detail.endDay):'')+'</p><p>'+e(detail.label)+' · '+e(detail.day)+' · '+e(detail.status)+(detail.paidDay?' on '+e(detail.paidDay):'')+'</p><button class="btn" type="button" id="private-brief-bill-close">Close schedule</button></section>':'';
  return '<p>'+summary+' Payment status as of '+e(result.currentDay)+'.</p>'+
   (result.rows.length?'<ul>'+result.rows.map(row=>'<li>'+e(row.label)+' · '+e(row.status)+' <button type="button" class="btn" data-brief-bill-source="'+e(row.billReadToken)+'" aria-label="Open schedule for '+e(row.label)+'"'+(current.busy?' disabled':'')+'>Open schedule</button></li>').join('')+'</ul>':'')+
   (result.offset>0?'<button class="btn" type="button" data-brief-bills-page="previous"'+(current.busy?' disabled':'')+'>Previous bills</button>':'')+
   (result.offset+result.rows.length<result.total?'<button class="btn" type="button" data-brief-bills-page="next"'+(current.busy?' disabled':'')+'>More bills</button>':'')+
   (current.sourceError?'<p role="status">The bill changed or its schedule expired. Refresh bills due.</p>':'')+original+button;
 }
 return {open,openWeek,openSource,closeSource,render,renderWeek,reset};
}
