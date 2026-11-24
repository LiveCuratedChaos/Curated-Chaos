import {readHomeGrocery} from './private-home-grocery.mjs';
import {readHomeCleaning} from './private-home-cleaning.mjs';
import {readHomeDelivery} from './private-home-delivery.mjs';
// Milestone 0D: PLAIN fictional private records, separated from the local fixture.
// No provider tokens, financial details, or real personal information are supported.
import { AREAS, dayString } from './core.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const TASK_SECTIONS=['Home','Personal Life','Work','School'];
const YMD=/^\d{4}-\d{2}-\d{2}$/;
export function validDay(value){
  if(!YMD.test(String(value||'')))return false;
  const [y,m,d]=String(value).split('-').map(Number);
  const candidate=new Date(y,m-1,d,12);
  return y>=2000 && y<=2100 && candidate.getFullYear()===y && candidate.getMonth()+1===m && candidate.getDate()===d;
}
export function validBriefRoutines(value,supportedRecords){
  if(!value||Object.keys(value).sort().join(',')!=='completed,count,rows')return false;
  const {count,completed,rows}=value;
  if(!Number.isInteger(count)||count<0||count>2000||!Number.isInteger(supportedRecords)||count>supportedRecords||
     !Number.isInteger(completed)||completed<0||completed>count||
     !Array.isArray(rows)||rows.length!==Math.min(20,count))return false;
  let shownComplete=0;
  const tokens=new Set();
  for(const row of rows){
    if(!row||Object.keys(row).sort().join(',')!==(Object.hasOwn(row,'taskReadToken')?'done,section,taskReadToken,title':'done,section,title')||
       typeof row.title!=='string'||!row.title.trim()||row.title.length>200||/[\u0000-\u001f\u007f]/.test(row.title)||
       !TASK_SECTIONS.includes(row.section)||typeof row.done!=='boolean')return false;
    if(Object.hasOwn(row,'taskReadToken')){
      if(typeof row.taskReadToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(row.taskReadToken)||tokens.has(row.taskReadToken))return false;
      tokens.add(row.taskReadToken);
    }
    if(row.done)shownComplete++;
  }
  return shownComplete<=completed&&rows.length-shownComplete<=count-completed;
}
export const isUndatedTaskDay=value=>value===undefined||value===null||value==='';
export function makeFictionalTask({title,day=dayString(),section='Personal Life'},ownerId,{allowUndated=false}={}){
  if(typeof allowUndated!=='boolean')throw Error('Explicit undated-task scope required.');
  if(!UUID.test(ownerId||''))throw Error('Sign in to your fictional test account.');
  title=String(title||'').trim();
  if(!title||title.length>140)throw Error('Enter a fictional task title (1–140 characters).');
  if(!(allowUndated&&day===''||typeof day==='string'&&validDay(day)))throw Error('Enter a valid task date.');
  if(!TASK_SECTIONS.includes(section) || !AREAS.includes(section)) throw Error('Choose a permitted section.');
  return {owner_id:ownerId,household_id:null,visibility:'private',section,item_type:'task',origin:'manual-test',payload:{title,day:day===''?null:day,done:false,fictional:true,source:'M0D_DEV_BRIEF_TEST'}};
}
export function normalizeCloudRecords(raw,ownerId,{allowUndated=false,allowHomeCleaning=false,allowHomeGroceries=false,allowHomeDeliveries=false}={}){
  if(typeof allowUndated!=='boolean'||typeof allowHomeCleaning!=='boolean'||typeof allowHomeGroceries!=='boolean'||typeof allowHomeDeliveries!=='boolean')throw Error('Explicit undated-task read scope required.');
  if(!Array.isArray(raw) || !UUID.test(ownerId||''))return {tasks:[],notes:[],events:[]};
  // Defense in depth in the UI; Supabase RLS enforces isolation server-side.
  const own=raw.filter(r=>r && r.owner_id===ownerId && r.visibility==='private' && r.household_id===null && r.payload?.fictional===true && r.deleted_at==null);
  const tasks=own.filter(r=>r.item_type==='task' && TASK_SECTIONS.includes(r.section) && (!allowHomeCleaning||!Object.hasOwn(r.payload,'homeCleaning')||r.section==='Home'&&readHomeCleaning(r.payload.homeCleaning)!==null) && (!allowHomeGroceries||!Object.hasOwn(r.payload,'homeGrocery')||r.section==='Home'&&readHomeGrocery(r.payload.homeGrocery)!==null) && (!allowHomeDeliveries||!Object.hasOwn(r.payload,'homeDelivery')||r.section==='Home'&&readHomeDelivery(r.payload.homeDelivery)!==null) && typeof r.payload?.title==='string' && r.payload.title.trim().length>0 && r.payload.title.length<=140 && typeof r.payload.done==='boolean' && (typeof r.payload?.day==='string'&&validDay(r.payload.day)||allowUndated&&isUndatedTaskDay(r.payload?.day)));
  const notes=own.filter(r=>r.item_type==='note' && r.section==='Personal Life' && typeof r.payload?.title==='string');
  const events=own.filter(r=>r.item_type==='event' && r.section==='Calendar'
    && typeof r.payload?.title==='string' && r.payload.title.trim().length>0 && r.payload.title.length<=140
    && validDay(r.payload?.day) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(r.payload?.time||''));
  return {tasks:tasks.sort((a,b)=>String(a.payload.day||'9999-12-31').localeCompare(String(b.payload.day||'9999-12-31'))||String(a.created_at||'').localeCompare(String(b.created_at||''))),notes:notes.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))),events:events.sort((a,b)=>a.payload.day.localeCompare(b.payload.day)||a.payload.time.localeCompare(b.payload.time))};
}
export function briefForDate(records,day=dayString()){
  const {tasks=[],notes=[]}=records;
  return {due:tasks.filter(r=>!r.payload.done && r.payload.day<=day),doneToday:tasks.filter(r=>r.payload.done && r.payload.day===day),upcoming:tasks.filter(r=>!r.payload.done && r.payload.day>day).slice(0,8),notes:notes.slice(0,8)};
}
export function toggledTaskPayload(record,{allowUndated=false}={}){
  if(typeof allowUndated!=='boolean')throw Error('Explicit undated completion scope required.');
  if(record?.item_type!=='task' || record?.payload?.fictional!==true || record.deleted_at!=null || !(validDay(record.payload.day)||allowUndated&&isUndatedTaskDay(record.payload.day)))throw Error('This test task cannot be updated.');
  const {title,day,done}=record.payload;
  if(typeof done!=='boolean'||typeof title!=='string'||title.length>140)throw Error('Malformed test task.');
  return {...record.payload,done:!done,...(typeof record.payload.status==='string'?{status:!done?'Completed':'Not Started'}:{})};
}
