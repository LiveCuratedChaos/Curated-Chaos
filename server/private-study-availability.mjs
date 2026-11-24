import {parseStudyAvailability} from '../src/private-school-study-proposals.mjs';
import {validDay} from '../src/dev-brief-model.mjs';
import {privateAllDayEvent} from './private-event-all-day.mjs';
import {privateEventRange} from './private-event-range.mjs';

const clock=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const minute=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
const format=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');

export function availableStudyWindows({rows,owner,availability,sessionMinutes,notBefore}){
 const windows=parseStudyAvailability(availability,{notBefore});
 if(!Array.isArray(rows)||rows.length>4000||![25,30,45,60,90].includes(sessionMinutes))throw Error('Study availability could not be verified.');
 const occupied=new Map(windows.map(w=>[w.day,[]]));
 function reserve(first,last,start,end){
  for(const [day,ranges] of occupied){
   if(day>=first&&day<=last)ranges.push([day===first?start:0,day===last?end:1440]);
  }
 }
 for(const row of rows){
  if(!row||row.owner_id!==owner||row.visibility!=='private'||row.household_id!==null||row.deleted_at!==null)throw Error('Study schedule owner changed.');
  if(row.item_type==='event'&&row.section==='Calendar'){
   const p=row.payload;
   if(!p||!validDay(p.day)||!clock.test(p.time)||p.fictional!==true)throw Error('Calendar event timing is incomplete.');
   const {all_day}=privateAllDayEvent(p),{end_day}=privateEventRange(p);
   reserve(p.day,end_day||p.day,all_day?0:minute(p.time),all_day||!p.end_time?1440:minute(p.end_time));
  }else if(row.item_type==='school_fixture'&&row.section==='School'&&row.origin==='M2E_SCHOOL_QA'){
   if(row.payload?.kind!=='course'||row.payload.fictional!==true||!Array.isArray(row.payload.studySessions)||row.payload.studySessions.length>50)throw Error('School sessions are incomplete.');
   for(const s of row.payload.studySessions){
    if(!validDay(s?.day)||s.time!==''&&!clock.test(s.time)||s.endTime!=null&&(!clock.test(s.endTime)||!s.time||s.endTime<=s.time))throw Error('School session timing is incomplete.');
    reserve(s.day,s.day,s.time?minute(s.time):0,s.endTime?minute(s.endTime):1440);
   }
  }else throw Error('Unsupported schedule source.');
 }
 const available=[];
 for(const window of windows){
  let start=window.startMinute;
  for(const [from,to] of occupied.get(window.day).sort((a,b)=>a[0]-b[0])){
   if(to<=start)continue;
   if(start+sessionMinutes<=from)break;
   start=Math.max(start,to);
  }
  if(start+sessionMinutes<=window.endMinute)available.push({day:window.day,start:format(start),end:format(start+sessionMinutes)});
 }
 return available;
}
