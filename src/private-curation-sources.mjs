import {CATEGORY_COLOR_TOKENS} from './private-category-colors.mjs';
import {readHomeGrocery} from './private-home-grocery.mjs';
// Bounded title/action summaries only; never accepts source bodies or raw record identities.
import {TASK_FILTERS} from './private-widget-layout.mjs';
import {validDay} from './dev-brief-model.mjs';
import {TASK_PRIORITIES} from './task-priorities.mjs';
import {readHomeCleaning} from './private-home-cleaning.mjs';import {readHomeDelivery} from './private-home-delivery.mjs';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(','),token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v),time=v=>typeof v==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
const capabilities=['recordToken','taskReadToken','completionToken','editToken','eventEditToken','noteToken'];
const required={tasks:['title','day','section'],schedule:['title','time','section'],notes:['title','section']};
const optional={tasks:['displayColor','homeCleaning','homeGrocery','homeDelivery','priority','priorityUnavailable','recordToken','taskReadToken','completionToken','editToken'],schedule:['displayColor','day','allDay','endDay','endTime','endTimeUnavailable','endDateUnavailable','recordToken','eventEditToken'],notes:['displayColor','recordToken','noteToken']};
export function verifyCurationWidgetSources(value){
 if(!exact(value,['schemaVersion','tasks','schedule','notes',...(Object.hasOwn(value??{},'futureTasks')?['futureTasks','futureSchedule']:[]),...(Object.hasOwn(value??{},'priorityTasks')?['priorityTasks']:[])])||value.schemaVersion!==1)throw Error('Complete bounded widget summaries required.');
 for(const sourceType of ['tasks','schedule','notes',...(Object.hasOwn(value,'futureTasks')?['futureTasks','futureSchedule']:[]),...(Object.hasOwn(value,'priorityTasks')?['priorityTasks']:[])]){
  const type=['priorityTasks','futureTasks'].includes(sourceType)?'tasks':sourceType==='futureSchedule'?'schedule':sourceType;
  if(!exact(value[sourceType],TASK_FILTERS))throw Error('Complete widget area filters required.');
  for(const filter of TASK_FILTERS){const bucket=value[sourceType][filter];if(!exact(bucket,['count','rows'])||!Number.isInteger(bucket.count)||bucket.count<0||bucket.count>2000||!Array.isArray(bucket.rows)||bucket.rows.length!==Math.min(10,bucket.count))throw Error('Exact bounded widget count and titles required.');
   if(['priorityTasks','futureTasks','futureSchedule'].includes(sourceType)&&bucket.count>value[type][filter].count)throw Error('Filtered counts cannot exceed their complete source.');
   for(const row of bucket.rows){if(sourceType==='priorityTasks'&&!['High','Urgent'].includes(row?.priority))throw Error('Saved High or Urgent priority required.');if(!row||typeof row!=='object'||Array.isArray(row)||required[type].some(k=>!Object.hasOwn(row,k))||Object.keys(row).some(k=>!required[type].includes(k)&&!optional[type].includes(k))||typeof row.title!=='string'||!row.title.trim()||row.title.length>200||!['Home','Personal Life','Work','School','Calendar'].includes(row.section)||filter!=='all'&&row.section!==filter||type==='tasks'&&!['Home','Personal Life','Work','School'].includes(row.section)||type==='schedule'&&row.section!=='Calendar'||type==='notes'&&row.section!=='Personal Life')throw Error('Permitted sparse widget titles required.');
    for(const key of capabilities)if(Object.hasOwn(row,key)&&!token(row[key]))throw Error('Original opaque widget actions required.');
    if(Object.hasOwn(row,'homeCleaning')&&(type!=='tasks'||row.section!=='Home'||!readHomeCleaning(row.homeCleaning))||Object.hasOwn(row,'homeGrocery')&&(type!=='tasks'||row.section!=='Home'||!readHomeGrocery(row.homeGrocery))||Object.hasOwn(row,'homeDelivery')&&(type!=='tasks'||row.section!=='Home'||!readHomeDelivery(row.homeDelivery))||Object.hasOwn(row,'day')&&(typeof row.day!=='string'||row.day!==''&&!validDay(row.day))||type==='schedule'&&!time(row.time)||Object.hasOwn(row,'endDay')&&!validDay(row.endDay)||Object.hasOwn(row,'endTime')&&!time(row.endTime)||Object.hasOwn(row,'displayColor')&&!CATEGORY_COLOR_TOKENS.includes(row.displayColor)||Object.hasOwn(row,'priority')&&!TASK_PRIORITIES.includes(row.priority)||['allDay','priorityUnavailable','endTimeUnavailable','endDateUnavailable'].some(k=>Object.hasOwn(row,k)&&row[k]!==true)||Object.hasOwn(row,'priorityUnavailable')&&Object.hasOwn(row,'priority')||row.allDay===true&&(row.time!=='00:00'||Object.hasOwn(row,'endTime'))||Object.hasOwn(row,'endTime')&&Object.hasOwn(row,'endTimeUnavailable')||Object.hasOwn(row,'endDay')&&Object.hasOwn(row,'endDateUnavailable'))throw Error('Supported widget dates and display facts required.');
   }
  }
 }
 if(value.priorityTasks&&TASK_FILTERS.filter(f=>f!=='all').reduce((n,f)=>n+value.priorityTasks[f].count,0)!==value.priorityTasks.all.count)throw Error('Complete priority area counts required.');
 return value;
}
