// Current saved tasks/events only. No record identities or mutation capabilities.
import {briefDateRange} from './private-brief-dates.mjs';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const count=v=>Number.isInteger(v)&&v>=0&&v<=2000;
const title=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200;
const time=v=>typeof v==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
export function verifyPrivateBriefWeek(value,{anchor,dateView,now=Date.now(),includeRoutines=false}={}){
 const expected=briefDateRange(anchor,dateView);
 if(exact(value,['available'])&&value.available===false)return value;
 const stamp=typeof value?.checkedAt==='string'?Date.parse(value.checkedAt):NaN,rangeKeys=['anchor','range','weekStart','from','to','days','clipped'];
 if(!exact(value,['available','readOnly','providerRead','currentRecords','range','sourceRecords','omittedRecords','checkedAt','expiresAt','days'])||value.available!==true||value.readOnly!==true||value.providerRead!==false||value.currentRecords!==true||!Number.isFinite(now)||!Number.isFinite(stamp)||new Date(stamp).toISOString()!==value.checkedAt||stamp>now||stamp<now-300000||!Number.isFinite(value.expiresAt)||value.expiresAt<=now||value.expiresAt>stamp+300000||!exact(value.range,rangeKeys)||rangeKeys.some(k=>JSON.stringify(value.range[k])!==JSON.stringify(expected[k]))||!count(value.sourceRecords)||!count(value.omittedRecords)||value.omittedRecords>value.sourceRecords||!Array.isArray(value.days)||value.days.length!==expected.days.length)throw Error('The saved seven-day view could not be verified. Fetch latest to try again.');
 const supportedRecords=value.sourceRecords-value.omittedRecords;
 let routineOccurrences=0;
 for(let i=0;i<value.days.length;i++){
  const routines=value.days[i]?.routines;
  if(includeRoutines){
   if(!exact(routines,['due','complete'])||!count(routines.due)||!count(routines.complete))throw Error('Saved routine counts could not be verified.');
   // Each saved occurrence belongs to exactly one date in the week.
   routineOccurrences+=routines.due+routines.complete;
   if(routineOccurrences>supportedRecords)throw Error('Saved routine counts could not be verified.');
  }
  const d=value.days[i];if(!exact(d,['day','dueTasksCount','eventsCount','tasks','events',...(includeRoutines?['routines']:[])])||d.day!==expected.days[i]||!count(d.dueTasksCount)||!count(d.eventsCount)||d.dueTasksCount+d.eventsCount>value.sourceRecords-value.omittedRecords||!Array.isArray(d.tasks)||d.tasks.length!==Math.min(3,d.dueTasksCount)||!Array.isArray(d.events)||d.events.length!==Math.min(3,d.eventsCount)||d.tasks.some(t=>!exact(t,['title','section'])||!title(t.title)||!['Home','Personal Life','Work','School'].includes(t.section))||d.events.some(e=>!exact(e,['title','time','allDay','continuing','scheduleUnavailable'])||!title(e.title)||!time(e.time)||['allDay','continuing','scheduleUnavailable'].some(k=>typeof e[k]!=='boolean')||e.allDay&&e.time!=='00:00'))throw Error('A saved day summary could not be verified. Fetch latest to try again.');
 }
 return value;
}
