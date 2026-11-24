import {calendarMonthBounds} from '../src/calendar-month-summary.mjs';
import {validDay} from '../src/dev-brief-model.mjs';

const fail=()=>{throw Error('Refresh School before opening the academic calendar.');};
const time=v=>typeof v==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);

export async function academicCalendar({api,actor,snapshot,program,day,offset,current}){
 if(!validDay(day)||!Number.isInteger(offset)||offset<0||offset%50||offset>102000)fail();
 const {first,last}=calendarMonthBounds(day);
 const actions=[...snapshot.actions.values()];
 const selected=program==='all'?null:actions.find(a=>a.token===program&&a.fields.kind==='degree');
 if(!selected&&program!=='all')fail();
 const expected=new Map(actions.filter(a=>!selected||a.id===selected.id||a.degreeId===selected.id).map(a=>[a.id,a]));
 const rows=await api.listPrivateAcademicSources(actor.accessToken,actor.ownerId,selected?.id??null);
 if(!current()||!Array.isArray(rows)||rows.length!==expected.size)fail();
 const counts=new Map(),entries=[];
 function add(date,item){
  if(date<first||date>last)return;
  counts.set(date,(counts.get(date)??0)+1);
  if(date===day)entries.push(item);
 }
 for(const row of rows){
  const source=expected.get(row.id);
  if(!source||row.version!==source.version||row.kind!==source.fields.kind)fail();
  expected.delete(row.id);
  const ref={schoolReadToken:source.token,sourceTitle:source.fields.title};
  if(source.fields.targetDate)add(source.fields.targetDate,{...ref,kind:row.kind==='degree'?'programTarget':'courseTarget',title:source.fields.title,time:'',endTime:''});
  if(row.kind==='degree'){if(row.sessions!=null)fail();continue;}
  if(!Array.isArray(row.sessions)||row.sessions.length>50)fail();
  for(const s of row.sessions){
   if(!s||!validDay(s.day)||s.time!==''&&!time(s.time)||typeof s.title!=='string'||!s.title.trim()||s.title.length>100||
      s.endTime!=null&&(!time(s.endTime)||!s.time||s.endTime<=s.time))fail();
   add(s.day,{...ref,kind:'study',title:s.title,time:s.time,endTime:s.endTime??''});
  }
 }
 if(expected.size||offset>0&&offset>=entries.length)fail();
 entries.sort((a,b)=>a.time.localeCompare(b.time)||a.sourceTitle.localeCompare(b.sourceTitle)||a.title.localeCompare(b.title)||a.schoolReadToken.localeCompare(b.schoolReadToken));
 return {viewId:snapshot.viewId,program,day,offset,days:Array.from({length:Number(last.slice(8))},(_,i)=>counts.get(first.slice(0,8)+String(i+1).padStart(2,'0'))??0),
  entries:entries.slice(offset,offset+50),hasMore:entries.length>offset+50};
}
