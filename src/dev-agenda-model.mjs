// M1B fictional manual cloud events. This must never contact external calendars.
import { addDays, dayString } from './core.mjs';
import { validDay } from './dev-brief-model.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
export function makeFictionalEvent({title,day=dayString(),time='09:00'},ownerId){
  if(!UUID.test(ownerId||''))throw Error('A verified development test account is required.');
  const cleaned=String(title||'').trim();
  if(!cleaned || cleaned.length>140)throw Error('Use a fictional event title of 1–140 characters.');
  if(!validDay(day))throw Error('Enter a valid fictional event date.');
  if(!TIME.test(time||''))throw Error('Enter a valid 24-hour start time.');
  return {owner_id:ownerId,household_id:null,visibility:'private',section:'Calendar',item_type:'event',origin:'M1B_MANUAL_QA',payload:{title:cleaned,day,time,fictional:true,source:'M1B_DEV_AGENDA_TEST'}};
}
export function sevenDayDates(start=dayString()){
  if(!validDay(start))throw Error('Choose a valid starting date.');
  return Array.from({length:7},(_,i)=>addDays(start,i));
}
export function agendaForWeek(records,start=dayString()){
  const days=sevenDayDates(start);
  const tasks=(records?.tasks||[]).filter(x=>x?.item_type==='task' && x.payload?.fictional===true && validDay(x.payload?.day));
  const events=(records?.events||[]).filter(x=>x?.item_type==='event' && x.payload?.fictional===true && validDay(x.payload?.day) && TIME.test(x.payload?.time||''));
  return days.map(day=>({
    day,
    items:[
      ...events.filter(x=>x.payload.day===day).map(x=>({id:x.id,kind:'event',title:x.payload.title,time:x.payload.time,done:false,section:'Calendar'})),
      ...tasks.filter(x=>x.payload.day===day).map(x=>({id:x.id,kind:'task',title:x.payload.title,time:null,done:x.payload.done===true,section:x.section}))
    ].sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')||a.title.localeCompare(b.title))
  }));
}
