import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStudyAvailability,proposeSchoolStudyTimes} from '../src/private-school-study-proposals.mjs';
import {createPrivateSchoolPanel} from '../src/private-school-panel.mjs';

const token=n=>String(n).repeat(43);
function course(n,{title=`Course ${n}`,status='In Progress',targetDate='',studyOrder=n,officialOrder=n,credits=3}={}){return{schoolReadToken:token(n),title,code:`C${n}`,term:'Term 1',status,credits,officialOrder,studyOrder,targetDate,programReadToken:token(9),programTitle:'Saved program',association:'linked'};}
function overview(courses,now){return{readOnly:true,providerRead:false,checkedAt:new Date(now).toISOString(),expiresAt:now+60000,viewId:token(8),programs:[{schoolReadToken:token(9),title:'Saved program',progressMetric:'classes',done:courses.filter(c=>c.status==='Completed').length,total:courses.length,percentage:courses.length?Math.round(courses.filter(c=>c.status==='Completed').length/courses.length*100):0,courseCount:courses.length}],courses};}

test('available study windows validate order, duration, duplicates, overlaps and bounds',()=>{
 assert.deepEqual(parseStudyAvailability('2026-11-24 18:00-20:00\n2026-11-23 17:00-18:00').map(x=>x.day),['2026-11-23','2026-11-24']);
 for(const text of ['2026-02-30 18:00-20:00','2026-11-23 20:00-18:00','2026-11-23 18:00-20:00\n2026-11-23 19:00-21:00','2026-11-23 18:00-20:00\n2026-11-23 18:00-20:00','2026-11-22 18:00-20:00'])assert.throws(()=>parseStudyAvailability(text,{notBefore:'2026-11-23'}));
});

test('study proposals rank by target date then independent study order and do not schedule completed classes',()=>{
 const courses=[course(1,{title:'Completed',status:'Completed',targetDate:'2026-11-22'}),course(2,{title:'Later target',targetDate:'2026-12-01',studyOrder:1}),course(3,{title:'Earlier target',targetDate:'2026-11-25',studyOrder:9}),course(4,{title:'Same target later study order',targetDate:'2026-11-25',studyOrder:2})];
 const result=proposeSchoolStudyTimes({courses,availability:'2026-11-23 18:00-19:00\n2026-11-24 18:00-19:00\n2026-11-25 18:00-19:00',sessionMinutes:45,notBefore:'2026-11-23'});
 assert.deepEqual(result.map(row=>[row.title,row.day,row.start,row.end]),[['Same target later study order','2026-11-23','18:00','18:45'],['Earlier target','2026-11-24','18:00','18:45'],['Later target','2026-11-25','18:00','18:45']]);
 assert.throws(()=>proposeSchoolStudyTimes({courses,availability:'2026-11-23 18:00-19:00',sessionMinutes:40}));
});

test('protected School panel previews escaped proposals from owner-entered free time without writes',async t=>{
 const now=Date.parse('2026-11-21T12:00:00Z'),courses=[course(1,{title:'<D253>',targetDate:'2026-11-26',studyOrder:1}),course(2,{title:'Later course',targetDate:'2026-11-28',studyOrder:2})],value=overview(courses,now);let writes=0,changed=0;
 const panel=createPrivateSchoolPanel({client:{async schoolOverview(){return value;}},clock:()=>now,canUse:()=>true,onChange:()=>changed++,onOverview:()=>{},allowEdit:false});t.after(()=>panel.dispose());
 panel.click({target:{closest:s=>s==='#private-school-open'?{}:null}});await new Promise(resolve=>setImmediate(resolve));
 assert.match(panel.render(),/does not inspect the main Calendar, save sessions, or move commitments/);
 let prevented=false;assert.equal(panel.submit({target:{id:'private-school-study-planner-form',querySelector:selector=>({value:selector.includes('availability')?'2026-11-23 18:00-20:00\n2026-11-24 18:00-20:00':'45'})},preventDefault(){prevented=true;}}),true);
 const html=panel.render();assert.equal(prevented,true);assert.match(html,/Suggested study times/);assert.match(html,/&lt;D253&gt;/);assert.match(html,/2026-11-23 · 18:00–18:45/);assert.match(html,/2026-11-24 · 18:00–18:45/);assert.equal(writes,0);assert.ok(changed>0);
 panel.input({target:{name:'availability',value:'invalid',closest:selector=>selector==='#private-school-study-planner-form'?{}:null}});assert.doesNotMatch(panel.render(),/Suggested study times/);
});
