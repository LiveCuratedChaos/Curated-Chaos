import {nextTaskOccurrence,validateTaskRecurrence} from '../src/task-recurrence.mjs';
import {newYorkTaskDay} from '../src/private-smart-task.mjs';

const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const activeArea=section=>section==='Home'||section==='Personal Life';
const unavailable=()=>{throw Error('The complete routine history could not be verified.');};
export function analyzeRoutineSeries(rows,{owner,selected,now=Date.now()},areaAllowed){
 const today=newYorkTaskDay(now),series=selected?.payload?.recurrence?.seriesId;
 if(!uuid(series)||!uuid(owner)||!areaAllowed(selected.section)||!Array.isArray(rows)||!rows.length||rows.length>2000)unavailable();
 const byOrdinal=new Map(),ids=new Set();
 let sourceMatched=false;
 const {anchorDay,frequency,interval}=selected.payload.recurrence;
 const schedule=validateTaskRecurrence({anchorDay,frequency,interval});
 for(const row of rows){
  const p=row?.payload,r=p?.recurrence;
  if(!uuid(row?.id)||ids.has(row.id)||row.owner_id!==owner||row.visibility!=='private'||row.household_id!==null||
     row.deleted_at!==null||row.item_type!=='task'||!areaAllowed(row.section)||p?.fictional!==true||
     typeof p.done!=='boolean'||r?.seriesId!==series||r.anchorDay!==anchorDay||r.frequency!==frequency||
     r.interval!==interval||!Number.isInteger(r.ordinal)||r.ordinal<0||byOrdinal.has(r.ordinal))unavailable();
  if(row.id===selected.id && row.version===selected.version)sourceMatched=true;
  ids.add(row.id);byOrdinal.set(r.ordinal,row);
 }
 if(!sourceMatched)unavailable();
 let streak=0,completed=0,previous=null,expected;
 const occurrences=[...byOrdinal.entries()].sort(([a],[b])=>a-b);
 for(const [ordinal,row] of occurrences){
  const p=row.payload,marker=p.recurrence_completion;
  if(previous){
   if(row.id!==previous.payload.recurrence_completion?.successorId||p.recurrence_predecessor!==previous.id||
      ordinal!==expected.ordinal||p.day!==expected.day)unavailable();
   if(expected.skippedOccurrences)streak=0;
  }else if(row.id!==series||p.recurrence_predecessor!=null)unavailable();
  const reviewed=nextTaskOccurrence({schedule,currentDueDay:p.day,completedOn:marker?.reviewDay??p.day});
  if(ordinal!==reviewed.ordinal-reviewed.skippedOccurrences-1)unavailable();
  if(marker){
   if(typeof marker.reviewDay!=='string'||!uuid(marker.successorId)||marker.reviewDay>today||reviewed.day!==marker.nextDay||
      ['anchorDay','frequency','interval'].some(k=>marker.schedule?.[k]!==schedule[k]))unavailable();
   if(p.done)completed++;
   streak=p.done&&marker.reviewDay<=p.day?streak+1:0;
   expected=reviewed;
  }else{
   if(p.done&&!p.recurrenceStopped)unavailable();
   if(p.day<today || p.recurrenceStopped)streak=0;
  }
  previous=row;
 }
 if(previous.payload.recurrence_completion)unavailable();
 return {scheduled:true,streak,completed,asOf:today,stopped:previous.payload.recurrenceStopped===true};
}

export function routineProgress(rows,options){
 return analyzeRoutineSeries(rows,options,activeArea);
}

export async function readRoutineProgress({reader,contextId,actor,taskReadToken,api,now}){
 const selection=await reader.selectedRecord(contextId,actor,taskReadToken);
 const source=selection.record;
 if(!activeArea(source.section))unavailable();
 const records=await api.getPrivateTask(actor.accessToken,source.id,actor.ownerId);
 if(!Array.isArray(records)||records.length!==1)unavailable();
 const [full]=records;
 if(!full||full.id!==source.id||full.owner_id!==actor.ownerId||full.section!==source.section||full.version!==source.version||
    full.household_id!==null||full.visibility!=='private'||full.deleted_at!==null||full.item_type!=='task'||full.payload?.fictional!==true)unavailable();
 const series=full.payload.recurrence?.seriesId;
 const result=full.payload.recurrence==null?{scheduled:false}:routineProgress(await api.listRoutineOccurrences(actor.accessToken,actor.ownerId,series),{owner:actor.ownerId,selected:full,now:now()});
 if(!reader.current(contextId,taskReadToken) || selection.expiresAt<=now())unavailable();
 return {...result,expiresAt:selection.expiresAt};
}
