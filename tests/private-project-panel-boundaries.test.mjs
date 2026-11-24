import test from 'node:test';import assert from 'node:assert/strict';
import {createPrivateProjectPanel} from '../src/private-project-panel.mjs';
const now=Date.parse('2026-11-17T12:00:00Z'),projectToken='p'.repeat(43),turn=()=>new Promise(r=>setImmediate(r));
function setup(t){let allowed=true,clock=now;const changes=[],calls={list:0,read:0,review:0,save:0,cancel:0};
 const summary={projectToken,title:'Fictional project',section:'Work',status:'Active'},fields={title:summary.title,description:'Exact fictional\n<details>',section:'Work',status:'Active',separateRecurring:true};
 const response={projects:[summary],query:'',section:'all',status:'all',matchCount:1,offset:0,limit:50,viewId:'v'.repeat(43),expiresAt:now+300000};
 const client={async projectsList(v){calls.list++;return{...response,query:v.query,section:v.section,status:v.status,offset:v.offset};},async projectsRead(){calls.read++;return{...fields,projectToken,expiresAt:now+300000};},async projectsReview(v){calls.review++;this.lastCareer=v.fields.career;this.lastFields=v.fields;return{...v.fields,action:v.action,reviewId:'r'.repeat(43),expiresAt:now+300000};},async projectsSave(){calls.save++;return{saved:true};},async projectsCancel(){calls.cancel++;return{cancelled:true};}};
 const panel=createPrivateProjectPanel({client,clock:()=>clock,canUse:()=>allowed,onChange:f=>changes.push(f)});t.after(()=>panel.dispose());
 const click=(selector,dataset={})=>panel.click({target:{closest:s=>s===selector?{dataset}:null}}),input=(name,value)=>panel.input({target:{name,value}}),submit=()=>panel.submit({target:{id:'private-project-editor'},preventDefault(){}});
 async function draft(){click('#private-projects-open');await turn();click('#private-project-new');input('project-title','Fictional retained new project');input('project-description','Retained exact\n<draft>');submit();await turn();}
 return{panel,client,calls,changes,response,fields,click,input,submit,draft,setAllowed:v=>{allowed=v;},advance:ms=>{clock+=ms;}};
}
test('a pending project save survives reset and cannot start another request or creation until settled',async t=>{
 const s=setup(t);await s.draft();let release;s.client.projectsSave=async()=>{s.calls.save++;return new Promise(r=>{release=r;});};s.click('#private-project-save');await turn();assert.equal(s.calls.save,1);s.panel.reset();assert.equal(s.panel.blocked(),true);const lists=s.calls.list;
 s.click('#private-projects-open');s.click('#private-project-save');s.input('project-title','Must not mutate');await turn();assert.equal(s.calls.list,lists);assert.equal(s.calls.save,1);
 s.changes.length=0;release({saved:true});await turn();assert.equal(s.panel.blocked(),false);assert.doesNotMatch(s.panel.render(),/Fictional retained|Project saved/);assert.ok(s.changes.every(v=>v===undefined));s.click('#private-projects-open');await turn();assert.equal(s.calls.list,lists+1);
});
test('offline during save retains a locked draft, blocks discard/refresh/review, and never retries after acknowledgement',async t=>{
 const s=setup(t);await s.draft();let release;s.client.projectsSave=async()=>{s.calls.save++;return new Promise(r=>{release=r;});};s.click('#private-project-save');await turn();s.panel.offline();const before={...s.calls};s.click('#private-project-discard');s.click('#private-project-refresh');s.submit();await turn();assert.deepEqual(s.calls,before);assert.match(s.panel.render(),/Retained project draft/);assert.match(s.panel.render(),/Retained exact\n&lt;draft&gt;/);assert.match(s.panel.render(),/id="private-project-discard" disabled/);
 release({saved:true});await turn();assert.equal(s.calls.save,1);assert.match(s.panel.render(),/Retained project draft/);assert.doesNotMatch(s.panel.render(),/Project saved\./);s.click('#private-project-discard');await turn();assert.equal(s.calls.cancel,1);assert.equal(s.calls.list,before.list+1);
});
test('a lost project-save acknowledgement keeps the draft and refuses a second save until explicit reconciliation',async t=>{
 const s=setup(t);await s.draft();s.client.projectsSave=async()=>{s.calls.save++;throw Error('Fictional lost acknowledgement');};s.click('#private-project-save');await turn();assert.match(s.panel.render(),/may have saved/);assert.match(s.panel.render(),/Retained project draft/);s.click('#private-project-save');s.submit();await turn();assert.equal(s.calls.save,1);assert.equal(s.calls.review,1);
});
test('confirmed save with failed refresh reports acknowledgement without claiming current projects were verified',async t=>{
 const s=setup(t);await s.draft();s.client.projectsList=async()=>{s.calls.list++;throw Error('Fictional unavailable list');};s.click('#private-project-save');await turn();assert.match(s.panel.render(),/save was acknowledged, but current projects could not be checked/);assert.doesNotMatch(s.panel.render(),/Project saved\. Current filters/);assert.equal(s.calls.save,1);
});
test('permission loss suppresses delayed project list/read/review/save responses and later releases busy safely',async t=>{
 for(const stage of ['list','read','review','save']){const s=setup(t);let release;const gate=new Promise(r=>{release=r;});
  if(stage==='list'){const fn=s.client.projectsList;s.client.projectsList=async v=>{await gate;return fn(v);};s.click('#private-projects-open');}
  if(stage==='read'){s.click('#private-projects-open');await turn();const fn=s.client.projectsRead;s.client.projectsRead=async()=>{await gate;return fn();};s.click('[data-private-project]',{privateProject:projectToken});}
  if(stage==='review'){s.click('#private-projects-open');await turn();s.click('#private-project-new');s.input('project-title','Hidden review');const fn=s.client.projectsReview;s.client.projectsReview=async v=>{await gate;return fn(v);};s.submit();}
  if(stage==='save'){await s.draft();const fn=s.client.projectsSave;s.client.projectsSave=async()=>{await gate;return fn();};s.click('#private-project-save');}
  await turn();s.setAllowed(false);s.changes.length=0;release();await turn();assert.equal(s.panel.render(),'');assert.ok(s.changes.every(f=>f===undefined));s.setAllowed(true);assert.doesNotMatch(s.panel.render(),/id="private-project-review-title"|Project saved\./);if(stage==='read')assert.doesNotMatch(s.panel.render(),/Exact fictional/);
 }
});
test('unbounded expiry, duplicate capability tokens and wrong requested page fail before showing choices',async t=>{
 for(const patch of [{expiresAt:now+300001},{projects:[{projectToken,title:'Fictional project',status:'Active',section:'Work'},{projectToken,title:'Other title',status:'Active',section:'Work'}],matchCount:2}]){const s=setup(t);Object.assign(s.response,patch);s.click('#private-projects-open');await turn();assert.match(s.panel.render(),/Projects could not be verified/);assert.doesNotMatch(s.panel.render(),/data-private-project=/);}
 const s=setup(t);s.client.projectsList=async()=>({...s.response,projects:[],offset:50,matchCount:50});s.click('#private-projects-open');await turn();assert.match(s.panel.render(),/could not be verified/);
});
test('same-title or same-token substituted selection and extended review expiry cannot authorize edits',async t=>{
 const s=setup(t);s.click('#private-projects-open');await turn();s.client.projectsRead=async()=>({...s.fields,projectToken,status:'Completed',expiresAt:now+300000});s.click('[data-private-project]',{privateProject:projectToken});await turn();assert.match(s.panel.render(),/Selected project changed/);assert.doesNotMatch(s.panel.render(),/id="private-project-editor"/);
 const q=setup(t);await q.draft();q.click('#private-project-back');q.client.projectsReview=async v=>({...v.fields,action:v.action,reviewId:'r'.repeat(43),expiresAt:now+300001});q.submit();await turn();assert.match(q.panel.render(),/review could not be verified/);assert.doesNotMatch(q.panel.render(),/id="private-project-review-title"/);
});
test('expired draft prevents a review and keeps a copyable draft rather than silently discarding it',async t=>{
 const s=setup(t);s.click('#private-projects-open');await turn();s.click('#private-project-new');s.input('project-title','Fictional expired draft');s.advance(300001);s.submit();await turn();assert.equal(s.calls.review,0);assert.match(s.panel.render(),/draft view expired/);assert.match(s.panel.render(),/Retained project draft/);
});

test('career application details are reviewed and saved on the existing private Work project',async t=>{
 const s=setup(t),career={kind:'application',employer:'Fictional Employer',role:'Analyst',stage:'Phone screen',targetCompensation:'At least $90,000',skills:['Excel'],certifications:['CFE']};
 s.client.projectsRead=async()=>({...s.fields,career,projectToken,expiresAt:now+300000});
 s.click('#private-projects-open');await turn();s.click('[data-private-project]',{privateProject:projectToken});await turn();assert.match(s.panel.render(),/Fictional Employer/);
 s.input('project-career-stage','Final interview');s.submit();await turn();
 assert.equal(s.calls.review,1);assert.equal(s.client.lastCareer.stage,'Final interview');
 assert.match(s.panel.render(),/Career details being saved/);assert.match(s.panel.render(),/Final interview/);
 s.click('#private-project-save');await turn();assert.equal(s.calls.save,1);
});

test('new applications move into Work and use the existing private project create approval',async t=>{const s=setup(t);s.click('#private-projects-open');await turn();s.click('#private-project-new');s.input('project-title','Analyst opening');s.input('project-career-kind','application');assert.match(s.panel.render(),/<option selected>Work<\/option>/);s.input('project-career-employer','Fictional Employer');s.input('project-career-role','Analyst');s.submit();await turn();assert.equal(s.calls.review,1);assert.equal(s.client.lastCareer.kind,'application');assert.match(s.panel.render(),/Approve project save/);});

test('current-source original editor handoff discards late or cancelled selections without creating a draft',async t=>{
 for(const reason of ['selection','reset','permission']){const s=setup(t);let release,current=true;s.client.manageSearchProject=()=>new Promise(resolve=>release=resolve);const pending=s.panel.manageCurrent({projectReadToken:'s'.repeat(43)},{current:()=>current});if(reason==='selection')current=false;if(reason==='reset')s.panel.reset();if(reason==='permission')s.setAllowed(false);release({...s.fields,projectToken,expiresAt:now+100000});assert.equal(await pending,false);if(reason==='permission')s.setAllowed(true);assert.doesNotMatch(s.panel.render(),/private-project-editor|Exact fictional/);assert.equal(s.calls.review,0);assert.equal(s.calls.save,0);}
});
test('Home asset editor captures, reviews and scopes a private vehicle profile',async t=>{const s=setup(t);s.click('#private-projects-open');await turn();s.click('#private-project-new');s.input('project-title','Vehicle service record');s.input('project-home-asset-kind','vehicle');s.input('project-home-asset-make','Honda');s.input('project-home-asset-model','CR-V');s.input('project-home-asset-year','2024');s.input('project-home-asset-usage','2026-01-02,120,Oil change');s.input('project-home-asset-warrantyEndDay','2029-05-11');s.input('project-home-asset-receiptNote','Dealer folder');assert.match(s.panel.render(),/Private Home asset profile/);assert.match(s.panel.render(),/<option selected>Home<\/option>/);s.submit();await turn();assert.equal(s.calls.review,1);assert.equal(s.client.lastFields.section,'Home');assert.deepEqual(s.client.lastFields.homeAsset,{kind:'vehicle',make:'Honda',model:'CR-V',year:'2024',usageUnit:'miles',usageEntries:[{day:'2026-01-02',value:120,note:'Oil change'}],warrantyEndDay:'2029-05-11',receiptNote:'Dealer folder'});assert.match(s.panel.render(),/Home asset profile review/);assert.match(s.panel.render(),/Dealer folder/);s.click('#private-project-back');s.input('project-section','Work');assert.doesNotMatch(s.panel.render(),/Home asset profile review/);});
