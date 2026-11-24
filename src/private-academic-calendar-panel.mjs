import {escapeHtml as e} from './core.mjs';
import {calendarMonthBounds} from './calendar-month-summary.mjs';
import {newYorkTaskDay} from './private-smart-task.mjs';

const kinds={study:'Study session',courseTarget:'Course target',programTarget:'Program target'};
const exact=(v,keys)=>v&&Object.keys(v).sort().join(',')===keys;
const clockTime=t=>typeof t==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t);
const btn=(action,label,off=false)=>'<button type="button" class="btn" data-academic-calendar="'+e(action)+'" '+(off?'disabled':'')+'>'+e(label)+'</button>';

function verify(page,view,query){
 const {last}=calendarMonthBounds(query.day);
 if(!exact(page,'day,days,entries,hasMore,offset,program,viewId')||Object.entries(query).some(([key,val])=>page[key]!==val)||
  !Array.isArray(page.days)||page.days.length!==Number(last.slice(8))||page.days.some(n=>!Number.isSafeInteger(n)||n<0||n>102000)||
  !Array.isArray(page.entries)||typeof page.hasMore!=='boolean')throw Error();
 const count=page.days[Number(page.day.slice(8))-1];
 if(page.entries.length!==Math.min(50,count-page.offset)||page.hasMore!==(count>page.offset+50))throw Error();
 const sources=new Map([...view.programs,...view.courses].map(item=>[item.schoolReadToken,item]));
 for(const entry of page.entries){
  const source=sources.get(entry?.schoolReadToken),degree=source&&Object.hasOwn(source,'progressMetric');
  if(!exact(entry,'endTime,kind,schoolReadToken,sourceTitle,time,title')||!source||entry.sourceTitle!==source.title||
   (query.program!=='all'&&entry.schoolReadToken!==query.program&&source.programReadToken!==query.program)||
   !Object.hasOwn(kinds,entry.kind)||degree!==(entry.kind==='programTarget')||
   typeof entry.title!=='string'||!entry.title.trim()||entry.title.length>140||entry.time!==''&&!clockTime(entry.time)||
   entry.endTime!==''&&(!clockTime(entry.endTime)||!entry.time||entry.endTime<=entry.time)||
   entry.kind!=='study'&&(entry.time||entry.endTime||entry.title!==source.title||source.targetDate&&source.targetDate!==page.day))throw Error();
 }
 return page;
}
export function createAcademicCalendarPanel({client,source,clock=Date.now,onChange,onOpen}){
 let seq=0,opened=false,busy=false,page=null,day='',program='all',error='';
 function reset(){seq++;opened=busy=false;page=null;day=error='';program='all';}
 async function fetchDay(next,scope,offset=0){
  const view=source();if(!view||busy)return;
  try{calendarMonthBounds(next);}catch{return;}
  if(scope!=='all'&&!view.programs.some(p=>p.schoolReadToken===scope))return;
  const n=++seq,query={viewId:view.viewId,program:scope,day:next,offset};
  day=next;program=scope;page=null;busy=opened=true;error='';onChange();
  const current=()=>seq===n&&source()?.viewId===view.viewId&&view.expiresAt>clock();
  try{
   const result=await client.academicCalendar(query);
   if(current())page=verify(result,view,query);
  }catch{if(current())error='The academic calendar could not be verified. Fetch latest School and reopen the month.';}
  finally{if(n===seq){busy=false;onChange();}}
 }
 function render(){
  const view=source();if(!view)return '';
  if(!opened)return btn('open','Open academic calendar');
  let html='<section aria-label="Academic calendar"><h3>Academic calendar</h3><label>Program <select name="school-calendar-program" '+(busy?'disabled':'')+'><option value="all">All programs</option>'+
   view.programs.map(p=>'<option value="'+e(p.schoolReadToken)+'" '+(program===p.schoolReadToken?'selected':'')+'>'+e(p.title)+'</option>').join('')+'</select></label>'+
   '<label>Go to date <input type="date" name="school-calendar-day" min="2000-01-01" max="2100-12-31" value="'+e(day)+'" '+(busy?'disabled':'')+'></label>'+
   btn('prev','Previous month',busy||day.startsWith('2000-01'))+btn('next','Next month',busy||day.startsWith('2100-12'))+
   btn('close','Close academic calendar');
  if(error)return html+'<p role="alert">'+e(error)+'</p></section>';
  if(!page)return html+'<p role="status">Loading academic calendar…</p></section>';
  const start=day.slice(0,8)+'01',weekday=new Date(start+'T12:00:00Z').getUTCDay();
  const heading=new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(start+'T12:00:00Z'));
  html+='<table><caption>'+e(heading)+'</caption><thead><tr>'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>'<th scope="col">'+d+'</th>').join('')+'</tr></thead><tbody>';
  const cells=Array.from({length:7*Math.ceil((weekday+page.days.length)/7)},(_,i)=>{
   const num=i-weekday+1;if(num<1||num>page.days.length)return '<td></td>';
   const date=day.slice(0,8)+String(num).padStart(2,'0'),count=page.days[num-1];
   return '<td><button type="button" class="btn" data-academic-calendar="day-'+date+'" aria-pressed="'+(date===day)+'" aria-label="'+date+', '+count+' academic entries">'+num+(count?' ('+count+')':'')+'</button></td>';
  });
  for(let i=0;i<cells.length;i+=7)html+='<tr>'+cells.slice(i,i+7).join('')+'</tr>';
  html+='</tbody></table><h4>'+e(day)+'</h4>';
  if(!page.entries.length)html+='<p>No academic entries for this date.</p>';
  else html+='<ul>'+page.entries.map((row,index)=>'<li>'+e(kinds[row.kind])+' · '+(row.time?e(row.time+(row.endTime?'–'+row.endTime:''))+' · ':'')+e(row.title)+' '+btn('source-'+index,'Open '+row.sourceTitle)+'</li>').join('')+'</ul>';
  return html+(page.offset?btn('previousPage','Previous entries'):'')+(page.hasMore?btn('nextPage','More entries'):'')+'</section>';
 }
 return {render,reset,blocked:()=>busy,click(event){
  const target=event?.target?.closest?.('[data-academic-calendar]');if(!target)return false;
  const action=target.dataset.academicCalendar;
  if(action==='close'){reset();onChange();return true;}
  if(busy||!source())return true;
  if(action==='open')void fetchDay(newYorkTaskDay(clock()),'all');
  else if(action==='prev'||action==='next'){
   const date=new Date(day.slice(0,8)+'01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+(action==='prev'?-1:1));void fetchDay(date.toISOString().slice(0,10),program);
  }else if(action.startsWith('day-'))void fetchDay(action.slice(4),program);
  else if(action==='nextPage'&&page?.hasMore)void fetchDay(day,program,page.offset+50);
  else if(action==='previousPage'&&page?.offset)void fetchDay(day,program,page.offset-50);
  else if(/^source-\d{1,2}$/.test(action)){
   const entry=page?.entries[Number(action.slice(7))];if(entry)onOpen(entry.schoolReadToken);
  }
  return true;
 },input(event){
  if(event.target?.name==='school-calendar-day'){void fetchDay(event.target.value,program);return true;}
  if(event.target?.name==='school-calendar-program'){void fetchDay(day,event.target.value);return true;}
  return false;
 }};
}
