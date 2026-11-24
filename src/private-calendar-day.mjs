import {appliedCalendarFilters,CALENDAR_FILTER_KEYS,eventMatchesCalendarFilters} from './private-calendar-filters.mjs';
import {CATEGORY_COLOR_TOKENS} from './private-category-colors.mjs';
// Selected-day read presentation only. Never accepts edit or removal capabilities.
import {verifyCalendarWorkspaceList} from './private-calendar-workspace.mjs';
const exact=(value,keys)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key)));
const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const date=value=>typeof value==='string'&&/^(?:20\d\d|2100)-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const count=value=>Number.isInteger(value)&&value>=0&&value<=2000;
export function validateCalendarDayFields(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['day','query','offset',...CALENDAR_FILTER_KEYS].includes(key))||!date(value.day))throw Error('Choose a supported Calendar day and title filter.');
 const query=value.query===undefined?'':value.query,offset=value.offset===undefined?0:value.offset;
 if(typeof query!=='string'||query.trim().length>100||/[\u0000-\u001f\u007f]/.test(query)||!Number.isInteger(offset)||offset<0||offset>1950||offset%50)throw Error('Choose a supported Calendar day and title filter.');
 return{day:value.day,query:query.trim(),offset,...appliedCalendarFilters(value)};
}
export function verifyCalendarDay(value,fields,{now=Date.now()}={}){
 const requested=validateCalendarDayFields(fields),keys=['day','query','offset','limit','matchCount','omittedRecords','dateRangeUnavailableRecords','checkedAt','expiresAt','events','readOnly','providerRead','viewId'],rowKeys=['displayColor','type','title','section','day','time','allDay','endDay','endTime','endTimeUnavailable','endDateUnavailable','eventReadToken'];
 const filters=appliedCalendarFilters(requested),activeKeys=Object.keys(filters);
 keys.push(...activeKeys);
 if(activeKeys.length)rowKeys.push('eventSource','eventCategory','householdVisible');
 const checked=typeof value?.checkedAt==='string'?Date.parse(value.checkedAt):NaN;
 if(!exact(value,keys)||activeKeys.some(k=>value[k]!==filters[k])||value.day!==requested.day||value.query!==requested.query||value.offset!==requested.offset||!token(value.viewId)||value.readOnly!==true||value.providerRead!==false||!Number.isFinite(now)||!Number.isFinite(checked)||new Date(checked).toISOString()!==value.checkedAt||checked>now||checked<now-300000||!Number.isFinite(value.expiresAt)||value.expiresAt<=now||value.expiresAt>checked+300000||!['matchCount','omittedRecords','dateRangeUnavailableRecords'].every(key=>count(value[key]))||value.matchCount+value.omittedRecords+value.dateRangeUnavailableRecords>2000||!Array.isArray(value.events)||new Set(value.events.map(row=>row?.eventReadToken)).size!==value.events.length||value.events.some(row=>!row||Array.isArray(row)||activeKeys.length&&(!eventMatchesCalendarFilters(row,filters)||!['eventSource','eventCategory','householdVisible'].every(k=>Object.hasOwn(row,k)))||Object.keys(row).some(key=>!rowKeys.includes(key))||Object.hasOwn(row,'displayColor')&&!CATEGORY_COLOR_TOKENS.includes(row.displayColor)||!token(row.eventReadToken)))throw Error('The selected Calendar day could not be verified. Fetch the day again.');
 const calendarFields={query:requested.query,type:'event',section:'Calendar',status:'all',dateFrom:requested.day,dateTo:requested.day};
 verifyCalendarWorkspaceList({...calendarFields,offset:value.offset,limit:value.limit,matchCount:value.matchCount,omittedRecords:value.omittedRecords,dateRangeUnavailableRecords:value.dateRangeUnavailableRecords,checkedAt:value.checkedAt,expiresAt:value.expiresAt,readOnly:true,providerRead:false,sortOrder:'date-time-title',results:value.events.map(({eventReadToken,...row})=>({...row,eventEditToken:eventReadToken}))},calendarFields,{now,offset:requested.offset});
 return value;
}
