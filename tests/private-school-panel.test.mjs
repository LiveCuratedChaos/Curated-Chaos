import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateSchoolPanel} from '../src/private-school-panel.mjs';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(t){let allowed=true,resolve,calls=0;const client={schoolOverview(){calls++;return new Promise(r=>resolve=r);}};const panel=createPrivateSchoolPanel({client,canUse:()=>allowed});t.after(()=>panel.dispose());const click=id=>panel.click({target:{closest:s=>s==='#private-school-'+id?{}:null}});return{panel,click,allow:v=>allowed=v,release:v=>resolve(v),calls:()=>calls};}
test('School stays closed without eager reads and suppresses duplicate explicit reads',t=>{const f=fixture(t);assert.match(f.panel.render(),/View saved School/);assert.equal(f.calls(),0);f.click('open');f.click('open');assert.equal(f.calls(),1);assert.equal(f.panel.blocked(),true);f.click('hide');assert.equal(f.panel.blocked(),false);assert.match(f.panel.render(),/View saved School/);});
test('reset offline and permission loss suppress late inventory and private errors',async t=>{for(const action of ['reset','offline','permission']){const f=fixture(t);f.click('open');if(action==='permission')f.allow(false);else f.panel[action]();f.release({title:'PRIVATE_UNVERIFIED'});await turn();assert.doesNotMatch(f.panel.render(),/PRIVATE_UNVERIFIED/);assert.equal(f.panel.blocked(),false);}});
test('malformed inventory is unavailable rather than false empty or echoed private data',async t=>{const f=fixture(t);f.click('open');f.release({title:'PRIVATE_UNVERIFIED'});await turn();assert.match(f.panel.render(),/could not be verified/);assert.doesNotMatch(f.panel.render(),/No saved School records|PRIVATE_UNVERIFIED/);});
test('verified saved courses reveal details only on explicit selection and preserve order choices',async t=>{
 const now=Date.parse('2026-11-18T12:00:00Z'),token='a'.repeat(43),calls=[];
 const course={schoolReadToken:token,title:'Fictional course',code:'F101',term:'Fall',status:'In Progress',credits:3,officialOrder:1,studyOrder:2,targetDate:'',programReadToken:'',programTitle:'Unassigned',association:'unassigned'};
 const overview={readOnly:true,providerRead:false,checkedAt:new Date(now).toISOString(),expiresAt:now+100000,viewId:'v'.repeat(43),programs:[],courses:[course]};
 const details={readOnly:true,expiresAt:now+100000,kind:'course',title:course.title,code:course.code,term:course.term,status:course.status,credits:3,officialOrder:1,studyOrder:2,targetDate:'',notes:'<script>fictional notes</script>',assessments:[],studySessions:[]};
 const client={async schoolOverview(){calls.push('overview');return overview;},async schoolRead(values){calls.push(values);return details;}};
 const panel=createPrivateSchoolPanel({client,clock:()=>now,canUse:()=>true});t.after(()=>panel.dispose());
 const click=async selector=>{panel.click({target:{closest:s=>s===selector?(selector==='[data-school-read]'?{dataset:{schoolRead:token}}:{}):null}});await turn();};
 await click('#private-school-open');assert.match(panel.render(),/Fictional course/);assert.doesNotMatch(panel.render(),/fictional notes/);assert.deepEqual(calls,['overview']);
 panel.input({target:{name:'school-order',value:'studyOrder'}});panel.input({target:{name:'school-program',value:'unassigned'}});assert.match(panel.render(),/value="studyOrder" selected/);assert.match(panel.render(),/1 matching saved courses/);
 await click('[data-school-read]');assert.deepEqual(calls[1],{schoolReadToken:token});assert.match(panel.render(),/&lt;script&gt;fictional notes/);assert.doesNotMatch(panel.render(),/<script>/);await click('#private-school-close');assert.doesNotMatch(panel.render(),/fictional notes/);
});
test('program progress and 51 course pagination retain full totals and expiry removes all facts',async t=>{let now=Date.parse('2026-11-18T12:00:00Z');const token='p'.repeat(43),courses=Array.from({length:51},(_,i)=>({schoolReadToken:String(i).padStart(43,'c'),title:'Course '+String(i).padStart(2,'0'),code:'',term:'',status:'Not Started',credits:3,officialOrder:i+1,studyOrder:51-i,targetDate:'',programReadToken:token,programTitle:'Fictional degree',association:'linked'}));const value={readOnly:true,providerRead:false,checkedAt:new Date(now).toISOString(),expiresAt:now+100000,viewId:'v'.repeat(43),programs:[{schoolReadToken:token,title:'Fictional degree',progressMetric:'classes',done:0,total:51,percentage:0,courseCount:51}],courses};const panel=createPrivateSchoolPanel({clock:()=>now,canUse:()=>true,client:{async schoolOverview(){return value;}}});t.after(()=>panel.dispose());const click=async id=>{panel.click({target:{closest:s=>s==='#private-school-'+id?{}:null}});await turn();};await click('open');assert.match(panel.render(),/51 courses|51 matching saved courses/);assert.match(panel.render(),/0 \/ 51/);assert.doesNotMatch(panel.render(),/Course 50/);await click('next');assert.match(panel.render(),/Course 50/);assert.doesNotMatch(panel.render(),/Course 00/);await click('next');assert.match(panel.render(),/Course 50/);panel.input({target:{name:'school-order',value:'studyOrder'}});assert.match(panel.render(),/Course 50/);assert.doesNotMatch(panel.render(),/Course 00/);now+=100001;assert.match(panel.render(),/expired/);assert.doesNotMatch(panel.render(),/Fictional degree|Course 50|Open School record/);});
test('changed and late selected details cannot expose private record contents',async t=>{for(const mode of ['changed','offline','permission']){let allowed=true,release;const now=Date.parse('2026-11-18T12:00:00Z'),token='p'.repeat(43),overview={readOnly:true,providerRead:false,checkedAt:new Date(now).toISOString(),expiresAt:now+100000,viewId:'v'.repeat(43),programs:[{schoolReadToken:token,title:'Degree',progressMetric:'classes',done:0,total:0,percentage:0,courseCount:0}],courses:[]};const panel=createPrivateSchoolPanel({clock:()=>now,canUse:()=>allowed,client:{async schoolOverview(){return overview;},schoolRead(){return new Promise(r=>release=r);}}});t.after(()=>panel.dispose());panel.click({target:{closest:s=>s==='#private-school-open'?{}:null}});await turn();panel.click({target:{closest:s=>s==='[data-school-read]'?{dataset:{schoolRead:token}}:null}});if(mode==='offline')panel.offline();if(mode==='permission')allowed=false;release({readOnly:true,expiresAt:now+100000,kind:'degree',title:mode==='changed'?'PRIVATE_CHANGED':'Degree',progressMetric:'classes',totalCredits:0,totalTerms:0,targetDate:''});await turn();assert.doesNotMatch(panel.render(),/PRIVATE_CHANGED|Total credits/);assert.equal(panel.blocked(),false);}});
test('offered sparse overview stays closed, opens without fetch and reads only a verified member',async t=>{let now=Date.parse('2026-11-18T12:00:00Z'),allowed=true;const token='p'.repeat(43),calls=[],callbacks=[];const value={readOnly:true,providerRead:false,checkedAt:new Date(now).toISOString(),expiresAt:now+100000,viewId:'v'.repeat(43),programs:[{schoolReadToken:token,title:'Cached degree',progressMetric:'classes',done:0,total:0,percentage:0,courseCount:0}],courses:[]};const panel=createPrivateSchoolPanel({clock:()=>now,canUse:()=>allowed,onOverview:v=>callbacks.push(v),client:{async schoolOverview(){calls.push('overview');return structuredClone(value);},async schoolRead(v){calls.push(v);return{readOnly:true,expiresAt:value.expiresAt,kind:'degree',title:'Cached degree',progressMetric:'classes',totalCredits:0,totalTerms:0,targetDate:''};}}});t.after(()=>panel.dispose());const click=async id=>{panel.click({target:{closest:s=>s==='#private-school-'+id?{}:null}});await turn();};assert.equal(panel.offerOverview(value),true);value.programs[0].title='Changed caller copy';assert.match(panel.render(),/View saved School/);assert.equal(calls.length,0);assert.equal(callbacks.length,0);await click('open');assert.match(panel.render(),/Cached degree/);assert.equal(calls.length,0);assert.equal(panel.openOverviewRecord({...value,programs:[{...value.programs[0],title:'Cached degree'}]},'x'.repeat(43)),false);assert.equal(calls.length,0);value.programs[0].title='Cached degree';assert.equal(panel.openOverviewRecord(value,token),true);await turn();assert.deepEqual(calls,[{schoolReadToken:token}]);assert.match(panel.render(),/Total credits/);await click('refresh');assert.equal(callbacks.length,1);assert.equal(calls.at(-1),'overview');allowed=false;assert.equal(panel.offerOverview(value),false);assert.equal(panel.openOverviewRecord(value,token),false);allowed=true;now+=100001;assert.equal(panel.offerOverview(value),false);});
test('offered snapshots cannot replace an in-flight source read or accept malformed records',async t=>{const f=fixture(t);assert.equal(f.panel.offerOverview({readOnly:true}),false);f.click('open');assert.equal(f.panel.offerOverview({readOnly:true}),false);assert.equal(f.panel.openOverviewRecord({},'x'.repeat(43)),false);f.release({});await turn();assert.equal(f.calls(),1);});

test('expired selected School details cannot open a new editor before the timer runs',async t=>{
 let now=Date.parse('2026-11-18T12:00:00Z'),editorReads=0;
 const token='a'.repeat(43),course={schoolReadToken:token,title:'Fictional course',code:'F101',term:'Fall',status:'In Progress',
  credits:3,officialOrder:1,studyOrder:2,targetDate:'',programReadToken:'',programTitle:'Unassigned',association:'unassigned'};
 const panel=createPrivateSchoolPanel({clock:()=>now,canUse:()=>true,allowEdit:true,client:{
  schoolOverview:async()=>({readOnly:true,providerRead:false,checkedAt:new Date(now).toISOString(),
   expiresAt:now+100000,viewId:'v'.repeat(43),programs:[],courses:[course]}),
  schoolRead:async()=>({readOnly:true,expiresAt:now+10000,kind:'course',title:course.title,code:course.code,term:course.term,
   status:course.status,credits:3,officialOrder:1,studyOrder:2,targetDate:'',notes:'Private stale notes',assessments:[],studySessions:[]}),
  schoolEditRead:async()=>{editorReads++;throw Error();}
 }});
 t.after(()=>panel.dispose());
 const click=selector=>panel.click({target:{closest:query=>query===selector?{dataset:{schoolRead:token}}:null}});
 click('#private-school-open');await turn();
 click('[data-school-read]');await turn();
 assert.match(panel.render(),/Private stale notes/);
 now+=10000;
 click('#private-school-edit');await turn();
 assert.equal(editorReads,0);
 assert.doesNotMatch(panel.render(),/Private stale notes/);
 assert.match(panel.render(),/School record details expired/);
});

test('editing study availability clears the displayed review and invalidates its save',async t=>{
 const now=Date.parse('2026-11-18T12:00:00Z'),token='a'.repeat(43),viewId='v'.repeat(43);
 const course={schoolReadToken:token,title:'Fictional course',code:'F101',term:'Fall',status:'In Progress',
  credits:3,officialOrder:1,studyOrder:2,targetDate:'',programReadToken:'',programTitle:'Unassigned',association:'unassigned'};
 const client={schoolOverview:async()=>({readOnly:true,providerRead:false,checkedAt:new Date(now).toISOString(),
  expiresAt:now+100000,viewId,programs:[],courses:[course]}),
  studyAvailability:async()=>({providerRead:false,viewId,windows:[{day:'2026-11-18',start:'18:00',end:'18:45'}]}),
  studySessionReview:async({day,start,end})=>({title:course.title,day,start,end,reviewId:'r'.repeat(43),expiresAt:now+50000}),
  studySessionSave:assert.fail};
 const panel=createPrivateSchoolPanel({client,clock:()=>now,canUse:()=>true,allowEdit:true,allowStudySchedule:true});
 t.after(()=>panel.dispose());
 const click=selector=>panel.click({target:{closest:query=>query===selector?{dataset:{studyReview:'0'}}:null}});
 click('#private-school-open');await turn();
 panel.submit({preventDefault(){},target:{id:'private-school-study-planner-form',querySelector:selector=>({
  value:selector.includes('availability')?'2026-11-18 18:00-20:00':'45'
 })}});
 await turn();
 click('[data-study-review]');await turn();
 const proposal=panel.render().split('id="private-school-study-proposal-result">')[1]?.split('</div></section>')[0];
 assert.match(proposal,/id="private-study-save"/);
 let cleared=0;
 panel.input({target:{name:'availability',value:'2026-11-19 18:00-20:00',closest:selector=>({
  querySelector:selector=>selector==='#private-school-study-proposal-result'?{replaceChildren:()=>cleared++}:null
 })}});
 assert.equal(cleared,1);
 assert.doesNotMatch(panel.render(),/id="private-study-save"/);
 click('#private-study-save');await turn();
});
