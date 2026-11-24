import test from 'node:test';
import assert from 'node:assert/strict';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createPrivateProjectPanel} from '../src/private-project-panel.mjs';
import {stageFromSubject} from '../server/private-application-mail.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const original={title:'Example application',section:'Work',status:'Active',description:'Private unrelated details',separateRecurring:true,
 career:{kind:'application',employer:'Fixture Labs',role:'QA Analyst',stage:'Phone screen',targetCompensation:'Private target',skills:[],certifications:[]}};
const projectFilters={offset:0,query:'',section:'all',status:'all'},filters={query:'',stage:'',offset:0};
function mail(i,subject='Interview invitation: QA Analyst at Fixture Labs'){
 return {id:'dddddddd-dddd-4ddd-8ddd-'+String(i).padStart(12,'0'),owner_id:owner,household_id:null,visibility:'private',section:'Personal Life',item_type:'provider_email',origin:'google_readonly',deleted_at:null,
  created_at:'2026-11-22T11:10:00Z',provider:'gmail',fictional:false,subject,sender:'unrelated-sender@example.test',received_at:'2026-11-21T12:30:00Z'};
}
async function setup(t,rows,allowSavedMailRead=true){
 const f=privateWorkspaceFixture(t,{allowProjects:true,allowSavedMailRead,fixtureSavedMail:rows}),a=f.tab(),b=f.tab();
 await a.login();await b.login();await a.client.projectsList(projectFilters);
 const r=await a.client.projectsReview({action:'create',fields:original});await a.client.projectsSave(r.reviewId);
 const open=async client=>{const v=await client.careerPipeline(filters);return (await client.projectsRead(v.applications[0].projectToken)).projectToken;};
 return {a:a.client,b:b.client,open,key:await open(a.client)};
}
test('only a directly stated status and exact selected role and employer can propose a stage',()=>{
 const hints=['Interview invitation: QA Analyst at Fixture Labs','Interview scheduled — Fixture Labs — QA Analyst','Application received - QA Analyst at Fixture Labs','Job offer: Fixture Labs - QA Analyst'];
 assert.deepEqual(hints.map(s=>stageFromSubject(s,original.career)),['Interviewing','Interviewing','Applied','Offer received']);
 for(const subject of ['Re: '+hints[0],'No interview scheduled: QA Analyst at Fixture Labs','Interview invitation: Senior QA Analyst at Fixture Labs','Job offer: QA Analyst at Fixture Labs West','Job offer: QA Analyst at Fixture Labs?','Job offer: QA Analyst at Fixture Labs\n','Application update','Interview invitation: Fixture Labs'])assert.equal(stageFromSubject(subject,original.career),null);
 assert.equal(stageFromSubject(hints[0],{...original.career,stage:'Interviewing'}),null);
});
test('selected saved subject shows only matched evidence; approval rechecks source and updates the original once',async t=>{
 const rows=[mail(1),mail(2,'Unrelated private subject')],{a,b,key,open}=await setup(t,rows);
 const page=await a.applicationMailOptions(key,0);assert.equal(page.choices.length,1);assert.doesNotMatch(JSON.stringify(page),/unrelated|sender|owner_id|Private target|dddddddd/);
 const chosen=page.choices[0];await assert.rejects(b.reviewApplicationMail(key,chosen.choice));
 const reviewed=await a.reviewApplicationMail(key,chosen.choice);assert.equal(reviewed.stageSource.before,'Phone screen');assert.equal(reviewed.stageSource.subject,rows[0].subject);
 assert.equal((await b.projectsRead(await open(b))).career.stage,'Phone screen');
 assert.equal((await a.projectsSave(reviewed.reviewId)).saved,true);await assert.rejects(a.projectsSave(reviewed.reviewId));
 const result=await b.projectsRead(await open(b));assert.equal(result.career.stage,'Interviewing');assert.equal(result.description,original.description);assert.equal(result.career.targetCompensation,'Private target');
 assert.doesNotMatch(JSON.stringify(result),/invitation|unrelated-sender/);
});
test('a changed or removed saved copy and a stale application cannot authorize a stage change',async t=>{
 const rows=[mail(1)],{a,b,key,open}=await setup(t,rows);
 let page=await a.applicationMailOptions(key,0);rows[0].subject='Changed';
 await assert.rejects(a.reviewApplicationMail(key,page.choices[0].choice));
 rows[0]=mail(1);page=await a.applicationMailOptions(key,0);const r=await a.reviewApplicationMail(key,page.choices[0].choice);rows.splice(0,1);
 await assert.rejects(a.projectsSave(r.reviewId));
 rows.push(mail(1));const fresh=await open(a);page=await a.applicationMailOptions(fresh,0);
 const other=await open(b);const update=await b.projectsReview({action:'edit',fields:{...original,description:'Owner change'},projectToken:other});await b.projectsSave(update.reviewId);
 await assert.rejects(a.reviewApplicationMail(fresh,page.choices[0].choice));
 assert.equal((await b.projectsRead(await open(b))).career.stage,'Phone screen');
});
test('pages and settings restrict the saved email stage picker',async t=>{
 const rows=Array.from({length:6},(_,i)=>mail(i,i===5?undefined:'Unrelated mail'));
 const {a,key}=await setup(t,rows);const first=await a.applicationMailOptions(key,0);assert.equal(first.hasMore,true);assert.equal(first.choices.length,0);
 const second=await a.applicationMailOptions(key,5);assert.equal(second.choices.length,1);await a.applicationMailOptions(key,0);
 await assert.rejects(a.reviewApplicationMail(key,second.choices[0].choice));await assert.rejects(a.applicationMailOptions(key,3));
 const off=await setup(t,rows,false);await assert.rejects(off.a.applicationMailOptions(off.key,0));
});
test('Work UI shows the source, previous and suggested stage; going back or dismissing keeps the original',async t=>{
 const rows=[mail(1)],{a,b,open}=await setup(t,rows),panel=createPrivateProjectPanel({client:a,allowCareerPipeline:true,allowApplicationMail:true,hideClosed:true});t.after(()=>panel.dispose());
 const turn=()=>new Promise(r=>setImmediate(r));async function click(sel,dataset={}){panel.click({target:{closest:q=>q===sel?{dataset}:null}});await turn();}
 const career=action=>click('[data-career-pipeline]',{careerPipeline:action}),source=action=>click('[data-application-mail]',{applicationMail:action});
 await career('open');await career(panel.render().match(/data-career-pipeline="(edit-[^"]+)"/)[1]);assert.doesNotMatch(panel.render(),/Interview invitation/);
 await source('open');assert.match(panel.render(),/Interview invitation/);await source('close');assert.doesNotMatch(panel.render(),/Interview invitation/);
 async function review(){await source('open');await source(panel.render().match(/data-application-mail="(review-[^"]+)"/)[1]);assert.match(panel.render(),/Phone screen → Interviewing/);}
 await review();await click('#private-project-back');assert.doesNotMatch(panel.render(),/Stage change from saved email/);await review();
 assert.equal((await b.projectsRead(await open(b))).career.stage,'Phone screen');await click('#private-project-save');assert.match(panel.render(),/Interviewing \(1\)/);
});
