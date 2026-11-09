import {createHash} from 'node:crypto';import {stableStringify} from './stable-json.mjs';import {safeSavedAt} from './snapshot-freshness.mjs';
const identity=value=>typeof value==='string'&&value.length>0&&value.length<=1024&&!/[\u0000-\u001f\u007f]/.test(value);
export function macCalendarSource(event){
 if(!identity(event?.calendarId)||!identity(event.eventId)||event.occurrenceStart!==null&&!safeSavedAt(event.occurrenceStart))throw Error('Verified Mac event identity required.');
 return{calendarId:event.calendarId,eventId:event.eventId,occurrenceStart:event.occurrenceStart===null?null:safeSavedAt(event.occurrenceStart)};
}
export function macCalendarItemKey(event){return createHash('sha256').update(stableStringify(macCalendarSource(event))).digest('hex');}
