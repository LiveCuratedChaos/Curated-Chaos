import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {availableStudyWindows} from '../server/private-study-availability.mjs';
import {createPrivateSchoolPanel} from '../src/private-school-panel.mjs';
import {createIsolatedDevelopmentDatabase,identities,actor} from './fixtures/isolated-development-database.mjs';
const {a:owner,b:other,sa,sb}=identities;
const day='2090-10-05',range=day+' 12:00-15:00';
const access={allowSchoolRead:true,allowSchoolEdit:true,allowSearch:true,allowSearchDates:true,allowEventEdit:true,allowEventDetails:true,allowCalendarWorkspace:true,allowCalendarDayRead:true,allowEventCreate:true};
const base={owner_id:owner,household_id:null,visibility:'private',deleted_at:null,version:1};
function event(start,end,changes={}){
 return {...base,id:randomUUID(),item_type:'event',section:'Calendar',payload:{fictional:true,day,time:start,end_time:end,...changes}};
}
function course(sessions){
 return {...base,id:randomUUID(),item_type:'school_fixture',section:'School',origin:'M2E_SCHOOL_QA',payload:{fictional:true,kind:'course',studySessions:sessions}};
}
test('availability excludes all-day, overnight, overlapping and open-ended commitments and reveals only free times',()=>{
 const check=rows=>availableStudyWindows({rows,owner,availability:range,sessionMinutes:45,notBefore:day});
 assert.deepEqual(check([event('11:00','12:30'),event('12:00','13:15'),course([{day,time:'13:15',endTime:'13:45',title:'Hidden'}])]),[{day,start:'13:45',end:'14:30'}]);
 assert.deepEqual(check([event('00:00','',{all_day:true})]),[]);
 assert.deepEqual(check([event('20:00','12:20',{day:'2090-10-04',end_day:day})]),[{day,start:'12:20',end:'13:05'}]);
 assert.deepEqual(check([event('20:00','00:00',{day:'2090-10-04',end_day:day})]),[{day,start:'12:00',end:'12:45'}]);
 assert.deepEqual(check([course([{day,time:'',title:'Legacy undated time'}])]),[]);assert.deepEqual(check([event('12:10','')]),[]);
 assert.throws(()=>check([{...event('12:00','13:00'),owner_id:other}]));assert.throws(()=>check([event('12:00','09:00')]));
});
test('a checked proposal saves one course session after review and a second tab cannot reserve the same time',async t=>{
 const app=privateWorkspaceFixture(t,access),a=app.tab(),b=app.tab();await a.login();await b.login();
 async function propose(tab){
  const view=await tab.client.schoolOverview(),course=view.courses.find(c=>c.status!=='Completed');assert.ok(course);
  const {windows}=await tab.client.studyAvailability(view.viewId,range,45);assert.equal(windows[0].start,'12:00');
  assert.deepEqual(Object.keys(windows[0]).sort(),['day','end','start']);
  return tab.client.studySessionReview({viewId:view.viewId,schoolReadToken:course.schoolReadToken,...windows[0]});
 }
 const first=await propose(a),second=await propose(b);assert.equal(first.title,second.title);
 await assert.rejects(b.client.studySessionSave(first.reviewId));await a.client.studySessionSave(first.reviewId);
 await assert.rejects(a.client.studySessionSave(first.reviewId));await assert.rejects(b.client.studySessionSave(second.reviewId));
 const refreshed=await b.client.schoolOverview(),picked=refreshed.courses.find(c=>c.status!=='Completed');
 const detail=await b.client.schoolRead({schoolReadToken:picked.schoolReadToken});
 assert.deepEqual(detail.studySessions.filter(s=>s.day===day),[{day,time:'12:00',title:'Study session',endTime:'12:45'}]);
 const updated=await b.client.studyAvailability(refreshed.viewId,range,45);assert.equal(updated.windows[0].start,'12:45');
});
test('School screen offers a checked time, shows the course and interval for approval and reopens its saved agenda',async t=>{
 const app=privateWorkspaceFixture(t,access),tab=app.tab();await tab.login();
 const panel=createPrivateSchoolPanel({client:tab.client,allowStudySchedule:true,allowEdit:true,canUse:()=>true});t.after(()=>panel.dispose());
 const turn=()=>new Promise(r=>setImmediate(r));
 const click=async(selector,dataset={})=>{panel.click({target:{closest:k=>k===selector?{dataset}:null}});await turn();};
 await click('#private-school-open');assert.match(panel.render(),/checks your saved Calendar/);
 panel.submit({target:{id:'private-school-study-planner-form',querySelector:selector=>({value:selector.includes('availability')?range:'45'})},preventDefault(){}});await turn();
 assert.match(panel.render(),/Review adding to course/);await click('[data-study-review]',{studyReview:'0'});assert.match(panel.render(),/Save this study session to your course/);
 await click('#private-study-save');assert.match(panel.render(),/Study session saved to your course/);
 const view=await tab.client.schoolOverview(),current=await tab.client.schoolRead({schoolReadToken:view.courses.find(c=>c.status==='In Progress').schoolReadToken});
 assert.equal(current.studySessions.filter(s=>s.day===day).length,1);
});

test('isolated SQL atomically compares the whole owner schedule and preserves course fields and canonical event rows',async t=>{
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());await actor(db,owner,sa);
 const id=randomUUID(),session={day,time:'12:00',endTime:'12:45',title:'Study session'};
 const original={fictional:true,source:'M2E_SCHOOL_QA',kind:'course',title:'Fixture course',status:'In Progress',studySessions:[],assessments:[],otherField:'keep'};
 await db.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values($1,$2,'private','School','school_fixture','M2E_SCHOOL_QA',$3)",[id,owner,original]);
 const call=(revision,schedule)=>db.query('select * from public.cc_append_private_study_session($1,$2,$3,$4)',[id,revision,JSON.stringify(schedule),session]);
 const manifest=async()=>(await db.query("select id,version from public.cc_records where owner_id=$1 and visibility='private' and household_id is null and deleted_at is null and ((section='Calendar' and item_type='event') or (section='School' and item_type='school_fixture' and origin='M2E_SCHOOL_QA' and payload->>'kind'='course')) order by id",[owner])).rows.map(r=>[r.id,r.version]);
 const before=await manifest(),eventId=randomUUID();
 await db.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values($1,$2,'private','Calendar','event','PRIVATE_COOKIE_EVENT_CREATE',$3)",[eventId,owner,{...event('16:00','17:00').payload,title:'Unmoved',source:'M1B_DEV_AGENDA_TEST'}]);
 await assert.rejects(call(1,before),/schedule changed/);
 const updated=await manifest(),saved=(await call(1,updated)).rows[0];assert.deepEqual(saved.payload,{...original,studySessions:[session]});
 await assert.rejects(call(1,updated),/schedule changed/);
 await assert.rejects(call(2,await manifest()),/overlaps/);
 assert.equal((await db.query('select version from public.cc_records where id=$1',[eventId])).rows[0].version,1);
 await actor(db,other,sb);assert.equal((await call(2,[])).rows.length,0);
});

test('study transport reads only private Calendar timing and course sessions and binds the reviewed write to its exact inventory',async()=>{
 const {createPrivateSchoolStudyApi}=await import('../src/private-school-study-api.mjs'),calls=[];
 const eventId=randomUUID(),courseId=randomUUID();
 const adapter=createPrivateSchoolStudyApi(async(path,options,accessToken)=>{
  calls.push({path,options});assert.equal(accessToken,'fictional');
  if(path.startsWith('/rest/v1/rpc/'))return [];
  const params=new URL(path,'https://fixture.invalid').searchParams;
  assert.equal(params.get('owner_id'),'eq.'+owner);assert.equal(params.get('visibility'),'eq.private');assert.equal(params.get('deleted_at'),'is.null');
  assert.doesNotMatch(params.get('select'),/location|description|notes|assessments|title/);
  if(params.get('item_type')==='eq.event')return [{...base,id:eventId,section:'Calendar',item_type:'event',study_fictional:true,study_day:day,study_time:'11:00',study_end_time:'12:30'}];
  assert.equal(params.get('payload->>kind'),'eq.course');return [{...base,id:courseId,section:'School',origin:'M2E_SCHOOL_QA',item_type:'school_fixture',study_fictional:true,study_kind:'course',study_studySessions:[]}];
 });
 const rows=await adapter.listPrivateStudySchedule('fictional',owner);
 assert.deepEqual(availableStudyWindows({rows,owner,availability:range,sessionMinutes:45}),[{day,start:'12:30',end:'13:15'}]);
 const manifest=rows.map(r=>[r.id,r.version]),session={day,time:'12:30',endTime:'13:15',title:'Study session'};
 await adapter.appendPrivateStudySession('fictional',courseId,1,manifest,session);
 assert.deepEqual(JSON.parse(calls[2].options.body),{p_course:courseId,p_version:1,p_schedule:manifest,p_session:session});
});

test('a Calendar event approved in another tab invalidates an overlapping study review',async t=>{
 const app=privateWorkspaceFixture(t,access),school=app.tab().client,calendar=app.tab().client;
 await school.signIn('demo@example.test','fictional-only');
 await calendar.signIn('demo@example.test','fictional-only');
 const view=await school.schoolOverview(),course=view.courses.find(c=>c.status==='In Progress');
 assert.ok(course);
 const {windows:[slot]}=await school.studyAvailability(view.viewId,range,45);
 assert.deepEqual(slot,{day,start:'12:00',end:'12:45'});
 const review=await school.studySessionReview({viewId:view.viewId,schoolReadToken:course.schoolReadToken,...slot});
 const eventFields={title:'Fictional appointment',day,time:'12:20',end_time:'13:00',
  location:'',description:'',calendarCategory:'Uncategorized'};
 const proposedEvent=await calendar.reviewNewEvent(eventFields);
 await calendar.createEvent(proposedEvent.reviewId);
 await assert.rejects(school.studySessionSave(review.reviewId),/could not be confirmed/);
 await assert.rejects(school.studySessionReview({viewId:view.viewId,schoolReadToken:course.schoolReadToken,...slot}),/Check availability again/);
 const refreshed=await school.schoolOverview();
 const current=refreshed.courses.find(c=>c.status==='In Progress');
 const detail=await school.schoolRead({schoolReadToken:current.schoolReadToken});
 assert.equal(detail.studySessions.some(s=>s.day===day),false);
 const {windows}=await school.studyAvailability(refreshed.viewId,range,45);
 assert.deepEqual(windows,[{day,start:'13:00',end:'13:45'}]);
});
