import test from 'node:test';
import assert from 'node:assert/strict';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createPrivateSchoolPanel} from '../src/private-school-panel.mjs';
import {academicCalendar} from '../server/private-academic-calendar.mjs';
import {createAcademicCalendarApi} from '../src/private-academic-calendar-api.mjs';
import {newYorkTaskDay} from '../src/private-smart-task.mjs';

const day='2028-02-29',p='00000000-0000-4000-8000-000000000001',c='00000000-0000-4000-8000-000000000002';
const scope={allowSchoolRead:true,allowSchoolEdit:true,allowDocuments:true};

test('academic month counts program targets, course targets and every session, pages a full day and refuses incomplete snapshots',async()=>{
 const program={id:p,token:'program',version:3,fields:{kind:'degree',title:'Program',targetDate:day}};
 const course={id:c,token:'course',version:4,degreeId:p,fields:{kind:'course',title:'Course',targetDate:day}};
 const snapshot={viewId:'view',actions:new Map([['program',program],['course',course]])};
 const sessions=Array.from({length:50},(_,i)=>({day,time:'09:00',endTime:'09:45',title:'Study '+i}));
 const rows=[{id:c,version:4,kind:'course',sessions},{id:p,version:3,kind:'degree',sessions:null}];
 const query={actor:{ownerId:p},snapshot,program:'program',day,offset:0,current:()=>true,api:{listPrivateAcademicSources:async(token,owner,id)=>{assert.equal(id,p);return structuredClone(rows);}}};
 const first=await academicCalendar(query),last=await academicCalendar({...query,offset:50});
 assert.equal(first.days.length,29);assert.equal(first.days[28],52);assert.equal(first.entries.length,50);
 assert.equal(last.entries.length,2);assert.equal(last.hasMore,false);assert.ok(first.entries.some(e=>e.kind==='programTarget'));
 assert.doesNotMatch(JSON.stringify(first),/degreeId|ownerId|00000000-/);
 assert.ok((await academicCalendar({...query,day:'2028-03-01'})).days.every(n=>n===0));
 await assert.rejects(academicCalendar({...query,program:'foreign'}));await assert.rejects(academicCalendar({...query,day:'2027-02-29'}));
 await assert.rejects(academicCalendar({...query,current:()=>false}));rows[0].version++;await assert.rejects(academicCalendar(query));rows.pop();await assert.rejects(academicCalendar(query));
});
test('signed-in School calendar opens protected originals, preserves school-only sessions and rejects a stale source',async t=>{
 const app=privateWorkspaceFixture(t,scope),a=app.tab(),b=app.tab();await a.login();await b.login();
 const overview=await a.client.schoolOverview(),program=overview.programs[0].schoolReadToken;
 const currentDay=newYorkTaskDay(Date.now()),values={viewId:overview.viewId,program,day:currentDay,offset:0};
 const month=await a.client.academicCalendar(values);
 assert.equal(month.days[Number(currentDay.slice(8))-1],4);assert.equal(month.entries[0].kind,'study');
 const detail=await a.client.schoolRead({schoolReadToken:month.entries[0].schoolReadToken});
 assert.equal(detail.studySessions[0].title,month.entries[0].title);assert.doesNotMatch(JSON.stringify(month),/notes|assessment|academicId|owner_id|guideDocuments/);
 await assert.rejects(b.client.academicCalendar(values));
 const other=await b.client.schoolOverview(),source=other.courses[0];
 const edit=await b.client.schoolEditRead(source.schoolReadToken);
 const review=await b.client.schoolEditReview({editToken:edit.editToken,fields:{...edit.fields,title:'Revised course'}});
 await b.client.schoolEditSave(review.reviewId);await assert.rejects(a.client.academicCalendar(values));
});
test('academic calendar panel navigates across months, filters a program, selects a day and opens its original course',async t=>{
 const app=privateWorkspaceFixture(t,scope),tab=app.tab();await tab.login();
 const panel=createPrivateSchoolPanel({client:tab.client,canUse:()=>true});t.after(()=>panel.dispose());
 const turn=()=>new Promise(r=>setImmediate(r));
 async function click(selector,dataset={}){panel.click({target:{closest:q=>q===selector?{dataset}:null}});await turn();}
 const act=value=>click('[data-academic-calendar]',{academicCalendar:value});
 await click('#private-school-open');await act('open');assert.match(panel.render(),/<table><caption>/);
 const current=newYorkTaskDay(Date.now());assert.match(panel.render(),/Study session · 18:00/);
 await act('next');assert.match(panel.render(),/No academic entries for this date/);
 panel.input({target:{name:'school-calendar-day',value:current}});await turn();
 const program=panel.render().match(/name="school-calendar-program"[^>]*><option[^>]*>All programs<\/option><option value="([^"]+)"/)[1];
 panel.input({target:{name:'school-calendar-program',value:program}});await turn();
 await act('day-'+current);await act('source-0');assert.match(panel.render(),/id="private-school-details-title"/);
});
test('academic calendar adapter reads only owned School sources and session projections with ordered keyset pages',async()=>{
 const routes=[],owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const api=createAcademicCalendarApi(async(route,options,token)=>{routes.push(route);assert.equal(token,'fictional');return [{id:c,version:1,owner_id:owner,kind:'course',sessions:[]}];});
 assert.deepEqual(await api.listPrivateAcademicSources('fictional',owner,p),[{id:c,version:1,kind:'course',sessions:[]}]);
 assert.match(routes[0],/sessions:payload->studySessions/);assert.match(routes[0],/visibility=eq.private/);assert.match(routes[0],/payload->>degreeId.eq/);
 assert.doesNotMatch(routes[0],/assessments|notes|guideDocuments|select=\*/);
 await assert.rejects(api.listPrivateAcademicSources('fictional',owner,'bad'));
});
