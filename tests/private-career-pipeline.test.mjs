import test from 'node:test';
import assert from 'node:assert/strict';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createPrivateProjectPanel} from '../src/private-project-panel.mjs';
import {createPrivateProjectApi} from '../src/private-project-api.mjs';

const filters={stage:'',query:'',offset:0},projectList={query:'',section:'all',status:'all',offset:0};
const fields=(title,employer,stage)=>({title,section:'Work',status:'Active',description:'Private application notes',
 separateRecurring:true,career:{kind:'application',role:'QA Analyst',employer,stage,targetCompensation:'Private salary target',skills:['Private skill'],certifications:[]}});
async function add(client,record){
 await client.projectsList(projectList);const p=await client.projectsReview({action:'create',fields:record});await client.projectsSave(p.reviewId);
}
async function setup(t){
 const app=privateWorkspaceFixture(t,{allowProjects:true}),a=app.tab(),b=app.tab();await a.login();await b.login();return {a:a.client,b:b.client};
}
test('Work pipeline filters real applications by owner-defined stage and employer, keeps other project fields private, and reopens the exact original',async t=>{
 const {a,b}=await setup(t);
 await add(a,fields('My first application','Example Labs','Phone screen'));
 await add(a,fields('Second application','Example Retail','Applied'));
 const goal=fields('Learning goal','','');goal.career.kind='goal';await add(a,goal);
 const all=await a.careerPipeline(filters);
 assert.equal(all.total,2);assert.deepEqual(all.stages,[{label:'Applied',count:1},{label:'Phone screen',count:1}]);assert.doesNotMatch(JSON.stringify(all),/Private salary|Private skill|notes|compensation|description|owner_id|Learning goal/);
 const selected=await a.careerPipeline({...filters,query:'LABS',stage:'Phone screen'});assert.equal(selected.total,1);
 await assert.rejects(b.projectsRead(selected.applications[0].projectToken));
 const full=await a.projectsRead(selected.applications[0].projectToken);assert.equal(full.title,'My first application');assert.equal(full.career.skills[0],'Private skill');
 const before=await b.careerPipeline(filters),stale=before.applications.find(p=>p.title===full.title);
 const {projectToken,expiresAt,...raw}=full;
 const review=await a.projectsReview({action:'edit',projectToken,fields:{...raw,career:{...raw.career,stage:'Final interview'}}});await a.projectsSave(review.reviewId);
 await assert.rejects(b.projectsRead(stale.projectToken));
 const after=await a.careerPipeline({...filters,stage:'Final interview'});assert.equal(after.total,1);assert.equal(after.applications[0].role,'QA Analyst');
 const empty=await a.careerPipeline({...filters,stage:'Phone screen'});assert.equal(empty.total,0);
});
test('application pages include at most 50 record actions and keep the stage totals across pages',async t=>{
 const {a}=await setup(t);
 for(let i=0;i<51;i++)await add(a,fields('App '+String(i).padStart(2,'0'),'Employer','My stage'));
 const first=await a.careerPipeline(filters),next=await a.careerPipeline({...filters,offset:50});
 assert.equal(first.applications.length,50);assert.equal(next.applications.length,1);assert.deepEqual(next.stages,[{label:'My stage',count:51}]);
 await assert.rejects(a.projectsRead(first.applications[0].projectToken));await assert.rejects(a.careerPipeline({...filters,offset:100}));
});
test('Work changes an application stage through the existing reviewed editor and returns to the pipeline',async t=>{
 const {a}=await setup(t);await add(a,fields('Application','Fictional Co','Applied'));
 const panel=createPrivateProjectPanel({client:a,allowCareerPipeline:true,canUse:()=>true,hideClosed:true});t.after(()=>panel.dispose());
 const turn=()=>new Promise(r=>setImmediate(r));
 async function click(selector,dataset={}){panel.click({target:{closest:q=>q===selector?{dataset}:null}});await turn();}
 const action=value=>click('[data-career-pipeline]',{careerPipeline:value});
 assert.match(panel.render(),/View job application pipeline/);await action('open');assert.match(panel.render(),/Fictional Co/);
 await action(panel.render().match(/data-career-pipeline="(edit-[^"]+)"/)[1]);
 panel.input({target:{name:'project-career-stage',value:'Interviewing'}});
 panel.submit({preventDefault(){},target:{id:'private-project-editor'}});await turn();
 assert.match(panel.render(),/Interviewing/);
 await click('#private-project-save');assert.match(panel.render(),/Application saved/);assert.match(panel.render(),/Interviewing \(1\)/);
});
test('project application query projects only the stage, employer and role on private Work originals',async()=>{
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',routes=[];
 const api=createPrivateProjectApi(async path=>{routes.push(new URL(path,'http://example.test'));return [{id,section:'Work',project_fictional:true,project_schema:1,project_title:'Application',project_status:'Active',application_role:'Role',application_employer:'Employer',application_stage:'Applied'}];});
 const [row]=await api.listPrivateProjects('fixture',owner,{applications:true});const qp=routes[0].searchParams;
 assert.deepEqual(row.application,{role:'Role',employer:'Employer',stage:'Applied'});assert.equal(qp.get('section'),'eq.Work');assert.equal(qp.get('payload->career->>kind'),'eq.application');
 assert.doesNotMatch(qp.get('select'),/description|Compensation|skills|certifications|\*/);
});
test('empty pipeline creates the first application only after reviewing and saving the Work original',async t=>{
 const {a,b}=await setup(t),panel=createPrivateProjectPanel({client:a,allowCareerPipeline:true,hideClosed:true});t.after(()=>panel.dispose());
 const turn=()=>new Promise(r=>setImmediate(r));
 async function click(selector,dataset={}){panel.click({target:{closest:q=>q===selector?{dataset}:null}});await turn();}
 const action=value=>click('[data-career-pipeline]',{careerPipeline:value});
 await action('open');assert.match(panel.render(),/Add application/);await action('new');
 for(const [name,value] of Object.entries({'project-title':'First application','project-career-role':'Analyst','project-career-employer':'Fictional employer'}))panel.input({target:{name,value}});
 panel.submit({preventDefault(){},target:{id:'private-project-editor'}});await turn();
 assert.match(panel.render(),/Approve|Save reviewed/i);assert.equal((await b.careerPipeline(filters)).total,0);
 await click('#private-project-save');assert.match(panel.render(),/Interested \(1\)/);
 const {applications}=await b.careerPipeline(filters);const original=await b.projectsRead(applications[0].projectToken);
 assert.equal(original.section,'Work');assert.equal(original.career.role,'Analyst');
});
const goalRecord=(title,skills,certifications)=>({
 ...fields(title,'',''),career:{...fields(title,'','').career,kind:'goal',skills,certifications}
});
test('career profile joins skills and certifications to their original goals without projecting compensation, notes or application requirements',async t=>{
 const {a,b}=await setup(t);
 await add(a,goalRecord('Build reporting',['Excel'],['Credential A']));
 await add(a,goalRecord('Lead reporting',['EXCEL','Writing'],[]));
 await add(a,fields('Application only','Fictional employer','Applied'));
 const page=await a.careerProfile({query:'exCel',offset:0});assert.equal(page.total,2);
 assert.doesNotMatch(JSON.stringify(page),/Private salary|Private skill|employer|Application only|description|owner_id/);
 assert.deepEqual(page.goals.map(g=>g.title),['Build reporting','Lead reporting']);
 await assert.rejects(b.projectsRead(page.goals[0].projectToken));
 const cert=await a.careerProfile({query:'credential a',offset:0});assert.equal(cert.total,1);
 const original=await a.projectsRead(cert.goals[0].projectToken);assert.equal(original.career.targetCompensation,'Private salary target');
 await assert.rejects(a.projectsRead(page.goals[0].projectToken));await assert.rejects(a.careerProfile({query:'',offset:50}));
});
test('Work profile creates and edits goals, groups the same skill across originals and preserves target compensation',async t=>{
 const {a,b}=await setup(t);await add(a,goalRecord('Build reporting',['Excel'],['Credential A']));
 const panel=createPrivateProjectPanel({client:a,allowCareerPipeline:true,hideClosed:true});t.after(()=>panel.dispose());
 const turn=()=>new Promise(r=>setImmediate(r)),input=(name,value)=>panel.input({target:{name,value}});
 async function click(selector,dataset={}){panel.click({target:{closest:q=>q===selector?{dataset}:null}});await turn();}
 const action=value=>click('[data-career-pipeline]',{careerPipeline:value});
 async function review(){panel.submit({preventDefault(){},target:{id:'private-project-editor'}});await turn();}
 await action('profile');await action('new');
 for(const [key,value] of Object.entries({'project-title':'Lead reporting','project-career-role':'Analyst','project-career-skills':'EXCEL','project-career-targetCompensation':'Fictional target'}))input(key,value);
 assert.match(panel.render(),/employer-confidential/);await review();
 assert.equal((await b.careerProfile({query:'lead',offset:0})).total,0);await click('#private-project-save');
 assert.match(panel.render(),/Career goal saved/);assert.match(panel.render(),/<dt>Excel<\/dt><dd>Build reporting, Lead reporting<\/dd>/);
 assert.doesNotMatch(panel.render(),/Fictional target/);const token=panel.render().match(/data-career-pipeline="(edit-[^"]+)"[^>]*>Open Lead reporting/)[1];
 await action(token);assert.match(panel.render(),/Fictional target/);input('project-career-certifications','Credential B');await review();await click('#private-project-save');
 assert.match(panel.render(),/Credential B<\/dt><dd>Lead reporting/);
});
test('goals on the network ask only for the Work goal role, skills and certifications',async()=>{
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';let qp;
 const api=createPrivateProjectApi(async path=>{qp=new URL(path,'http://example.test').searchParams;return [{id,section:'Work',project_fictional:true,project_schema:1,project_title:'Goal',project_status:'Active',goal_role:'Analyst',goal_skills:['Writing'],goal_certifications:[]}];});
 const [row]=await api.listPrivateProjects('fixture',owner,{careerGoals:true});assert.equal(qp.get('payload->career->>kind'),'eq.goal');assert.equal(qp.get('section'),'eq.Work');
 assert.doesNotMatch(qp.get('select'),/Compensation|description|employer|stage|\*/);assert.deepEqual(row.goal,{role:'Analyst',skills:['Writing'],certifications:[]});
});

test('expired Work pipeline clears application metadata and drops a pending original-editor handoff',async t=>{
 const {createCareerPipelinePanel}=await import('../src/private-career-pipeline-panel.mjs');
 const {a}=await setup(t);
 await add(a,fields('Fictional application','Fictional employer','Applied'));
 const page=await a.careerPipeline(filters);
 let now=page.expiresAt-30000,finish;
 const panel=createCareerPipelinePanel({clock:()=>now,canUse:()=>true,onChange:()=>{},onEdit:assert.fail,client:{
  careerPipeline:async()=>page,projectsRead:()=>new Promise(resolve=>{finish=resolve;})
 }});
 t.after(()=>panel.reset());
 const click=action=>panel.click({target:{closest:()=>({dataset:{careerPipeline:action}})}});
 click('open');await new Promise(resolve=>setImmediate(resolve));
 assert.match(panel.render(),/Fictional employer/);
 click('edit-'+page.applications[0].projectToken);
 assert.equal(typeof finish,'function');
 now=page.expiresAt;
 assert.doesNotMatch(panel.render(),/Fictional employer/);
 assert.match(panel.render(),/Application details expired/);
 finish(await a.projectsRead(page.applications[0].projectToken));
 await new Promise(resolve=>setImmediate(resolve));
 assert.doesNotMatch(panel.render(),/Fictional employer/);
});
