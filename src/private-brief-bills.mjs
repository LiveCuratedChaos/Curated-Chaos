import {escapeHtml as e} from './core.mjs';
import {validDay} from './dev-brief-model.mjs';
import {newYorkTaskDay} from './private-smart-task.mjs';

export function createBriefBills({client,clock=Date.now,context,onChange}){
 let current=null,timer=null;
 function reset(){clearTimeout(timer);current=null;}
 function available(day){
  const source=context();
  return source?.day===day&&source.expiresAt>clock();
 }
 function verify(value,day){
  const now=clock();
  if(!value||Object.keys(value).sort().join(',')!=='currentDay,day,expiresAt,rows,total'||value.day!==day||
     value.currentDay!==newYorkTaskDay(now)||!Number.isInteger(value.total)||value.total<0||value.total>100||
     !Array.isArray(value.rows)||value.rows.length!==Math.min(10,value.total)||!Number.isFinite(value.expiresAt)||
     value.expiresAt<=now||value.expiresAt>now+300000)throw Error();
  for(const row of value.rows){
   if(!row||Object.keys(row).sort().join(',')!=='label,status'||typeof row.label!=='string'||!row.label.trim()||
      row.label.length>120||!['Paid',day<value.currentDay?'Overdue':'Due'].includes(row.status))throw Error();
  }
 }
 async function open(){
  const source=context(),day=source?.day;
  if(!validDay(day)||!available(day)||current?.busy)return;
  reset();const view={day,busy:true};current=view;onChange();
  try{
   const result=await client.briefBills(day);
   if(current!==view||!available(day))return;
   verify(result,day);
   view.result=result;view.expiresAt=Math.min(result.expiresAt,source.expiresAt);
   timer=setTimeout(()=>{if(current===view){reset();onChange();}},Math.max(0,view.expiresAt-clock()));timer.unref?.();
  }catch{if(current===view)view.failed=true;}
  finally{if(current===view){view.busy=false;if(!available(day))reset();onChange();}}
 }
 function render(day){
  if(current&&(current.day!==day||!available(day)||current.expiresAt<=clock()||current.result&&current.result.currentDay!==newYorkTaskDay(clock())))reset();
  if(!available(day))return '<p role="status">The bill schedule is unavailable.</p>';
  const result=current?.result;
  const button='<button class="btn" type="button" id="private-brief-bills-open"'+(current?.busy?' disabled':'')+'>'+(result?'Refresh bill schedule':'View bills due')+'</button>';
  if(!result)return (current?.failed?'<p role="status">Could not open the saved bill schedule.</p>':'')+button;
  const summary=result.total?'Showing '+result.rows.length+' of '+result.total+' bills due on '+e(day)+'.':'No saved bills are due on '+e(day)+'.';
  return '<p>'+summary+' Payment status as of '+e(result.currentDay)+'.</p>'+
   (result.rows.length?'<ul>'+result.rows.map(row=>'<li>'+e(row.label)+' · '+e(row.status)+'</li>').join('')+'</ul>':'')+button;
 }
 return {open,render,reset};
}
