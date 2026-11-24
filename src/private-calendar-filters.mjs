const manualOrigins=new Set(['M1B_MANUAL_QA','PRIVATE_COOKIE_EVENT_CREATE']);
const text=value=>typeof value==='string'?value.trim():'';

// Calendar source labels are derived from trusted event provenance, never from source IDs.
export function calendarEventSource(row){
 if(!row||row.item_type!=='event')throw Error('Calendar source could not be verified.');
 if(manualOrigins.has(row.origin))return 'Manual calendar';
 if(['google_readonly','google_import_qa','mac_calendar_import'].includes(row.origin))return 'Saved calendar';
 return 'Other saved calendar';
}

export function calendarEventCategory(row){
 const value=text(row?.payload?.calendarCategory);
 if(!value)return 'Uncategorized';
 if(value.length>48||/[\u0000-\u001f\u007f]/.test(value))throw Error('Calendar category could not be verified.');
 return value;
}

export function calendarFilterDimensions(row){return{source:calendarEventSource(row),category:calendarEventCategory(row),householdVisible:row?.visibility==='household'&&row?.household_id!==null&&typeof row?.household_id==='string'};}

export const CALENDAR_FILTER_KEYS=Object.freeze(['eventKind','eventSource','eventCategory']);
export function validCalendarShortcut(filters){
 const category=filters?.eventCategory;
 return filters?.type==='event'&&['Calendar','all'].includes(filters.section)&&
  ['all','timed','allDay'].includes(filters.eventKind)&&['all','manual','saved','other'].includes(filters.eventSource)&&
  typeof category==='string'&&category.length>0&&category.length<=48&&category===category.trim()&&!/[\u0000-\u001f\u007f]/.test(category);
}

export function appliedCalendarFilters(values){
 const filters=Object.fromEntries(CALENDAR_FILTER_KEYS.map(key=>[key,Object.hasOwn(values,key)?values[key]:'all']));
 if(!validCalendarShortcut({...filters,type:'event',section:'Calendar'}))throw Error('Choose valid Calendar filters.');
 return Object.fromEntries(Object.entries(filters).filter(([,value])=>value!=='all'));
}

export function eventMatchesCalendarFilters(row,filters){
 const {eventKind='all',eventSource='all',eventCategory='all'}=filters;
 return (eventKind==='all'||(row.allDay===true)===(eventKind==='allDay'))
  &&(eventSource==='all'||row.eventSource?.toLowerCase().split(' ')[0]===eventSource)
  &&(eventCategory==='all'||row.eventCategory===eventCategory);
}
