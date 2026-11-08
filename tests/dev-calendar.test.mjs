import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDevApi} from '../src/dev-api.mjs';
import {allowedPublicPath} from '../tools/local-server.mjs';
import {workspaceHref,MOBILE_TABS} from '../src/dev-navigation-model.mjs';
import {renderConnectedShell} from '../src/dev-cloud-shell.mjs';
import {CALENDARS,CATEGORIES,VIEWS,REMINDERS,initialCalendarPrefs,normalizeCalendarPrefs,readCalendarPrefs,makeCalendarPrefsRecord,makeCalendarEvent,editCalendarEvent,normalizedCalendarEvent,selectedDayItems,monthDays,weekDays,stepCalendarDate} from '../src/dev-calendar-model.mjs';
import {makeProject,visibleProjectStatus,PROJECT_STATUSES,changeProject} from '../src/dev-organize-model.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const uuid='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const form={title:'QA 2D - practice appointment',day:'2026-11-05',time:'14:30',end_time:'15:30',category:'Work',calendar:'Work',reminder:'15 minutes',description:'Fictional test record'};
function rec(input=form,owner=A){return {id:uuid,version:2,...makeCalendarEvent(input,owner)};}
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('M2D calendar view, categories and reminder options are bounded with month as default',()=>{
 const p=initialCalendarPrefs();assert.equal(p.view,'month');assert.equal(p.monthStyle,'details');assert.equal(p.showTasks,true);
 assert.deepEqual(p.calendars,CALENDARS);assert.deepEqual(p.categories,CATEGORIES);
 assert.deepEqual(VIEWS,['month','week','day']);assert.ok(REMINDERS.includes('15 minutes'));
 const n=normalizeCalendarPrefs({view:'what',monthStyle:'fake',calendars:['Work','evil'],categories:['School'],showTasks:false,defaultCalendar:'evil'});
 assert.equal(n.view,'month');assert.equal(n.monthStyle,'details');assert.deepEqual(n.calendars,['Work']);assert.deepEqual(n.categories,['School']);assert.equal(n.defaultCalendar,'Personal');assert.equal(n.showTasks,false);
 assert.deepEqual(normalizeCalendarPrefs({calendars:[],categories:[]}).calendars,[]);
});
test('M2D private calendar settings are owner-scoped and keep saved view and display choices',()=>{
 const pref=makeCalendarPrefsRecord(A,{view:'week',calendars:['Work'],categories:['Work'],monthStyle:'dots'});
 assert.equal(pref.section,'Calendar');assert.equal(pref.visibility,'private');assert.equal(pref.household_id,null);
 const rows=[{id:uuid,...pref,updated_at:'2026-11-03'},{id:'old',...pref,owner_id:B,updated_at:'2026-11-06'}];
 const result=readCalendarPrefs(rows,A);assert.equal(result.record.id,uuid);assert.equal(result.prefs.view,'week');assert.equal(result.prefs.monthStyle,'dots');assert.deepEqual(result.prefs.calendars,['Work']);
 assert.throws(()=>makeCalendarPrefsRecord('not-uuid',{}));assert.equal(readCalendarPrefs(rows,B).record.owner_id,B);
});
test('M2D manually created fictional events validate date, hours and metadata before writes',()=>{
 const entry=makeCalendarEvent(form,A);assert.equal(entry.item_type,'event');assert.equal(entry.origin,'M2D_CALENDAR_MANUAL_QA');assert.equal(entry.payload.end_time,'15:30');assert.equal(entry.payload.reminder,'15 minutes');assert.equal(entry.payload.fictional,true);
 assert.throws(()=>makeCalendarEvent({...form,time:'15:30',end_time:'14:30'},A),/End time/);
 assert.throws(()=>makeCalendarEvent({...form,calendar:'Google'},A),/valid fictional event/);
 assert.throws(()=>makeCalendarEvent({...form,category:'Finance'},A),/valid fictional event/);
 assert.throws(()=>makeCalendarEvent({...form,description:'a'.repeat(1001)},A),/1,000/);
 assert.throws(()=>makeCalendarEvent({...form,day:'2026-02-30'},A));
 assert.throws(()=>makeCalendarEvent({...form,title:'<script>'.repeat(30)},A));
});
test('M2D event edits preserve prior valid data and reject other owners',()=>{
 const previous=rec(),edited=editCalendarEvent(previous,{...form,title:'QA revised'},A);
 assert.equal(edited.title,'QA revised');assert.equal(edited.time,'14:30');assert.equal(previous.payload.title,form.title);
 assert.throws(()=>editCalendarEvent(previous,form,B));
 assert.throws(()=>editCalendarEvent({...previous,visibility:'household'},form,A));
 const prior={...previous,payload:{title:'Old sample',day:'2026-11-05',time:'09:00',fictional:true,source:'M1B_DEV_AGENDA_TEST'}};
 assert.equal(normalizedCalendarEvent(prior).calendar,'Personal');assert.equal(normalizedCalendarEvent(prior).reminder,'None');
 assert.equal(editCalendarEvent(prior,form,A).source,'M1B_DEV_AGENDA_TEST');
});
test('M2D item filtering includes tasks in selected areas and supports hidden calendars',()=>{
 const evt=rec(),task={id:'task',item_type:'task',section:'Home',payload:{title:'QA storage bins',day:form.day,fictional:true,done:true}};
 const rows=[evt,task,{...rec({...form,title:'Separate day',day:'2026-11-06'}),id:'next'}];
 assert.equal(selectedDayItems(rows,form.day).length,2);
 assert.deepEqual(selectedDayItems(rows,form.day,{calendars:['Personal'],categories:['Home']}).map(x=>x.kind),['task']);
 assert.equal(selectedDayItems(rows,form.day,{showTasks:false,calendars:['Work'],categories:['Work']}).length,1);
 assert.deepEqual(selectedDayItems(rows,form.day,{calendars:[],categories:[]}),[]);
 assert.deepEqual(selectedDayItems(rows,'2026-11-06').map(x=>x.title),['Separate day']);
});
test('M2D month grid has Sunday leading dates, includes leap February, and date stepping clamps',()=>{
 const nov=monthDays('2026-11-17');assert.equal(nov[0],'2026-11-01');assert.equal(nov.at(-1),'2026-12-05');assert.equal(nov.length,35);
 const feb=monthDays('2028-02-10');assert.ok(feb.includes('2028-02-29'));assert.equal(feb.length%7,0);
 assert.deepEqual(weekDays('2026-11-05'),['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07']);
 assert.equal(stepCalendarDate('2026-01-31','month',1),'2026-02-28');assert.equal(stepCalendarDate('2028-01-31','month',1),'2028-02-29');
 assert.equal(stepCalendarDate('2026-11-05','week',-1),'2026-10-29');assert.equal(stepCalendarDate('2026-11-05','day',1),'2026-11-06');
 assert.throws(()=>stepCalendarDate('2026-11-05','year',1));
});
test('M2D cloud calls scope owner and enforce version guards for event edits and preferences',async()=>{
 const calls=[],fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,text:async()=>JSON.stringify([{}])};};
 const api=createDevApi({supabaseUrl:'https://aaaaaaaaaaaa.supabase.co',projectRef:'aaaaaaaaaaaa',publishableKey:'sb_publishable_test'},fetcher);
 await api.listCalendarRecords('token',A);await api.listCalendarPreferences('token',A);await api.updateCalendarEvent('token',rec(),A,rec().payload);
 await api.addCalendarPreferences('token',makeCalendarPrefsRecord(A,{}));await api.updateCalendarPreferences('token',{id:uuid,version:2},A,makeCalendarPrefsRecord(A,{}).payload);
 assert.match(calls[0].url,/owner_id=eq\.aaaaaaaa/);assert.match(calls[0].url,/item_type=in\.\(event,task\)/);assert.match(calls[0].url,/deleted_at=is.null/);
 assert.match(calls[1].url,/calendar_preferences/);assert.match(calls[2].url,/version=eq\.2/);assert.match(calls[4].url,/version=eq\.2/);
 assert.equal(calls[2].options.method,'PATCH');assert.equal(calls[4].options.method,'PATCH');
 assert.throws(()=>api.updateCalendarEvent('token',{id:uuid,version:0},A,rec().payload));
 assert.throws(()=>api.addCalendarPreferences('token',{...makeCalendarPrefsRecord(A,{}),visibility:'household'}));
});
test('M2D status wording displays In Progress for existing Active projects and on new saves',()=>{
 assert.ok(PROJECT_STATUSES.includes('In Progress'));assert.ok(!PROJECT_STATUSES.includes('Active'));
 assert.equal(visibleProjectStatus('Active'),'In Progress');
 const p={id:uuid,owner_id:A,...makeProject({title:'QA Home',section:'Home',status:'Active'},A)};
 assert.equal(p.payload.status,'In Progress');
 const prior={...p,payload:{...p.payload,status:'Active'}};
 assert.equal(changeProject(prior,{status:'In Progress'},A).status,'In Progress');
 assert.throws(()=>makeProject({title:'QA',section:'Home',status:'Invented'},A));
});
test('M2D menu, calendar route and local server are accessible but secrets stay private',()=>{
 assert.equal(workspaceHref('calendar'),'/dev-calendar.html');assert.equal(MOBILE_TABS.find(x=>x.id==='calendar').href,'/dev-calendar.html');
 assert.match(renderConnectedShell('testing',{active:'calendar'}),/aria-current="page" href="\/dev-calendar.html"/);
 for(const route of ['/dev-calendar.html','/src/dev-calendar.mjs','/src/dev-calendar-model.mjs'])assert.equal(allowedPublicPath(route),true,route);
 for(const route of ['/.env.local','/tests/dev-calendar.test.mjs','/supabase/migrations/001_dev_isolation.sql'])assert.equal(allowedPublicPath(route),false,route);
 assert.match(read('dev-calendar.html'),/src="\/src\/dev-calendar.mjs"/);
 for(const id of ['cal-add-event','cal-edit-event','cal-save-prefs','cal-settings-toggle','cal-signout','cal-show-tasks','cal-close-day','cal-overlay-close'])assert.match(read('src/dev-calendar.mjs'),new RegExp(id));
 assert.doesNotMatch(read('src/dev-calendar.mjs'),/fetch\(['"]https?:\/\//);
 assert.match(read('src/styles.css'),/cc-cal-drawer-open/);assert.match(read('src/styles.css'),/cc-cal-overlay/);
});
