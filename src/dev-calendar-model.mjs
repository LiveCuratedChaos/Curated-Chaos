// M2D: private fictional calendar; no external providers or scheduled notifications.
import {addDays,dayString} from './core.mjs';
import {validDay} from './dev-brief-model.mjs';
import {makeFictionalEvent} from './dev-agenda-model.mjs';
export const CALENDARS=Object.freeze(['Personal','Work','School','Household']);
export const CATEGORIES=Object.freeze(['Personal Life','Work','School','Home']);
export const VIEWS=Object.freeze(['month','week','day']);
export const MONTH_STYLES=Object.freeze(['details','dots']);
export const REMINDERS=Object.freeze(['None','At time','5 minutes','15 minutes','1 hour','1 day']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const nice=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
const timeNum=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
export function initialCalendarPrefs(){return {view:'month',monthStyle:'details',showTasks:true,calendars:[...CALENDARS],categories:[...CATEGORIES],defaultCalendar:'Personal',defaultCategory:'Personal Life',defaultReminder:'None'};}
export function normalizeCalendarPrefs(input){
 const d=initialCalendarPrefs();
 if(!input||typeof input!=='object')return d;
 const selected=(key,options)=>Array.isArray(input[key])?options.filter(x=>input[key].includes(x)):d[key];
 return {view:nice(input.view,VIEWS,d.view),monthStyle:nice(input.monthStyle,MONTH_STYLES,d.monthStyle),showTasks:typeof input.showTasks==='boolean'?input.showTasks:d.showTasks,calendars:selected('calendars',CALENDARS),categories:selected('categories',CATEGORIES),defaultCalendar:nice(input.defaultCalendar,CALENDARS,d.defaultCalendar),defaultCategory:nice(input.defaultCategory,CATEGORIES,d.defaultCategory),defaultReminder:nice(input.defaultReminder,REMINDERS,d.defaultReminder)};
}
export function readCalendarPrefs(rows,owner){
 if(!UUID.test(owner))throw Error('A verified private test account is required.');
 const filtered=Array.isArray(rows)?rows.filter(x=>x?.owner_id===owner&&x.item_type==='calendar_preferences'&&x.section==='Calendar'&&x.visibility==='private'&&x.household_id===null&&x.payload?.fictional===true).sort((a,b)=>String(b.updated_at||b.created_at).localeCompare(String(a.updated_at||a.created_at))):[];
 return {record:filtered[0]||null,prefs:normalizeCalendarPrefs(filtered[0]?.payload?.settings),duplicates:Math.max(0,filtered.length-1)};
}
export function makeCalendarPrefsRecord(owner,prefs){
 if(!UUID.test(owner))throw Error('A verified private test account is required.');
 return {owner_id:owner,household_id:null,visibility:'private',section:'Calendar',item_type:'calendar_preferences',origin:'m2d-fictional',payload:{fictional:true,settings:normalizeCalendarPrefs(prefs),source:'M2D_CALENDAR_PREFERENCES'}};
}
export function normalizedCalendarEvent(record){
 if(record?.item_type!=='event'||record.section!=='Calendar'||record.visibility!=='private'||record.household_id!==null||record.payload?.fictional!==true||!validDay(record.payload.day)||!TIME.test(record.payload.time||'')||typeof record.payload.title!=='string'||!record.payload.title.trim())return null;
 const p=record.payload;
 return {id:record.id,day:p.day,time:p.time,endTime:TIME.test(p.end_time||'')?p.end_time:'',title:p.title,category:nice(p.category,CATEGORIES,'Personal Life'),calendar:nice(p.calendar,CALENDARS,'Personal'),reminder:nice(p.reminder,REMINDERS,'None'),description:String(p.description||''),kind:'event',record};
}
export function makeCalendarEvent(form,owner){
 const base=makeFictionalEvent(form,owner),p=base.payload;
 const endTime=String(form.end_time||'').trim();
 if(endTime&&(!TIME.test(endTime)||timeNum(endTime)<=timeNum(p.time)))throw Error('End time must be after the start time on the same date.');
 const category=String(form.category||'Personal Life'),calendar=String(form.calendar||'Personal'),reminder=String(form.reminder||'None');
 if(!CATEGORIES.includes(category)||!CALENDARS.includes(calendar)||!REMINDERS.includes(reminder))throw Error('Choose a valid fictional event calendar, category and reminder.');
 const description=String(form.description||'').trim();if(description.length>1000)throw Error('Event description must be at most 1,000 characters.');
 return {...base,origin:'M2D_CALENDAR_MANUAL_QA',payload:{...p,end_time:endTime,category,calendar,reminder,description,source:'M2D_CALENDAR_TEST'}};
}
export function editCalendarEvent(record,form,owner){
 if(!UUID.test(owner)||record?.owner_id!==owner||record.visibility!=='private'||record.household_id!==null||record.item_type!=='event'||record.payload?.fictional!==true)throw Error('Only your own fictional events may be edited.');
 const next=makeCalendarEvent(form,owner);
 return {...record.payload,...next.payload,source:record.payload.source||'M2D_CALENDAR_TEST'};
}
export function selectedDayItems(rows,day,prefs=initialCalendarPrefs()){
 if(!validDay(day))throw Error('Choose a valid calendar date.');
 const settings=normalizeCalendarPrefs(prefs);
 const results=[];
 for(const record of rows||[]){
  if(record?.payload?.day!==day)continue;
  if(record.item_type==='event'){
   const event=normalizedCalendarEvent(record);
   if(event&&settings.calendars.includes(event.calendar)&&settings.categories.includes(event.category))results.push(event);
  } else if(record.item_type==='task'&&settings.showTasks&&CATEGORIES.includes(record.section)&&settings.categories.includes(record.section)&&record.payload?.fictional===true&&typeof record.payload?.title==='string'&&record.payload.title.trim()){
   results.push({id:record.id,day,time:'',title:record.payload.title,category:record.section,calendar:'',kind:'task',done:record.payload.done===true||record.payload.status==='Completed',record});
  }
 }
 return results.sort((a,b)=>(a.time||'25:00').localeCompare(b.time||'25:00')||a.title.localeCompare(b.title));
}
export function monthDays(focus){
 if(!validDay(focus))throw Error('Choose a valid month date.');
 const [year,month]=focus.split('-').map(Number),first=dayString(new Date(year,month-1,1,12)),offset=new Date(year,month-1,1,12).getDay(),length=new Date(year,month,0,12).getDate();
 const weeks=Math.ceil((offset+length)/7);
 return Array.from({length:weeks*7},(_,i)=>addDays(first,i-offset));
}
export function weekDays(focus){
 if(!validDay(focus))throw Error('Choose a valid week date.');
 const [y,m,d]=focus.split('-').map(Number),offset=new Date(y,m-1,d,12).getDay();
 return Array.from({length:7},(_,i)=>addDays(focus,i-offset));
}
export function stepCalendarDate(focus,view,direction){
 if(!validDay(focus)||!VIEWS.includes(view)||![-1,1].includes(direction))throw Error('Invalid calendar navigation.');
 if(view==='day')return addDays(focus,direction);
 if(view==='week')return addDays(focus,direction*7);
 const [y,m,d]=focus.split('-').map(Number);
 const month=new Date(y,m-1+direction,1,12);
 return dayString(new Date(month.getFullYear(),month.getMonth(),Math.min(d,new Date(month.getFullYear(),month.getMonth()+1,0,12).getDate()),12));
}
