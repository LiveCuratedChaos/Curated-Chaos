// Deterministic, fictional records only. No EventKit, credentials or provider access.
import {macCalendarItemKey} from './mac-calendar-import-plan.mjs';
export function macCalendarFixtureArgs(ownerId,run){
 const events=[{calendarId:'fictional-calendar-'+run,eventId:'fictional-event-'+run+'-1',occurrenceStart:null,title:'QA FICTIONAL timed appointment',calendarTitle:'QA FICTIONAL Calendar',allDay:false,start:'2026-11-09T12:00:00-05:00',end:'2026-11-09T13:00:00-05:00'},{calendarId:'fictional-calendar-'+run,eventId:'fictional-series-'+run+'-2',occurrenceStart:'2026-11-10T05:00:00Z',title:'QA FICTIONAL two-day event',calendarTitle:'QA FICTIONAL Calendar',allDay:true,startDate:'2026-11-10',endDateExclusive:'2026-11-12'}];
 return{selectionId:run,fixtureRunId:run,selectedKeys:events.map(macCalendarItemKey),preview:{ownerId,selectionId:run,provider:'mac_calendar',previewOnly:true,persisted:false,complete:true,scope:{calendarCount:1,maxEvents:2,startDate:'2026-11-08',endDateExclusive:'2026-11-13',timeZone:'America/New_York'},events}};
}
