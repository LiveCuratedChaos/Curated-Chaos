import {validDay} from '../src/dev-brief-model.mjs';
import {privateEventRange,eventLastDisplayDay} from './private-event-range.mjs';
export function privateSearchDates(values){
 const dateFrom=values.dateFrom===undefined?'':values.dateFrom,dateTo=values.dateTo===undefined?'':values.dateTo;
 if([dateFrom,dateTo].some(day=>typeof day!=='string'||day!==''&&!validDay(day))||dateFrom&&dateTo&&dateFrom>dateTo)throw Error('Choose valid search dates in order between 2000 and 2100.');
 if((dateFrom||dateTo)&&!['task','event'].includes(values.type))throw Error('Date filters apply to tasks or workspace events.');
 return{dateFrom,dateTo};
}
export function searchRecordInterval(row){
 if(!validDay(row?.payload?.day))return null;
 if(row.item_type==='task')return{first:row.payload.day,last:row.payload.day};
 if(row.item_type!=='event')return null;
 try{const p=row.payload;privateEventRange(p);if(p.all_day===true&&(p.time!=='00:00'||p.end_time!=null&&p.end_time!==''))return null;return{first:p.day,last:eventLastDisplayDay(p)};}catch{return null;}
}
export function matchesSearchDates(interval,{dateFrom,dateTo}){return Boolean(interval&&(!dateTo||interval.first<=dateTo)&&(!dateFrom||interval.last>=dateFrom));}
