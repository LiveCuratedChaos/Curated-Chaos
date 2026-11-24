import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateProjectTaskPanel} from '../src/private-project-task-panel.mjs';
import {projectProgress} from '../src/project-progress.mjs';
const projectToken='p'.repeat(43),taskToken='t'.repeat(43),readToken='d'.repeat(43),reviewId='r'.repeat(43),turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(t){
 let allowed=true,now=1;const calls={list:0,review:0,save:0,read:0,cancel:0},focus=[];
 const task={taskToken,taskReadToken:readToken,title:'Fictional private task',section:'Home',completed:false,recurring:false,linked:true};
 const details={title:task.title,section:'Home',completed:false,day:'',priority:'Normal',description:'PRIVATE_FICTIONAL_DETAIL',subtasks:[],subtaskCount:0,omittedSubtasks:0,readOnly:true,expiresAt:100};
 const client={
  async projectTasksList(v){calls.list++;return{...v,tasks:[task],matchCount:1,limit:50,viewId:projectToken,expiresAt:100,projectTitle:'Fictional project',progress:projectProgress([task]),hierarchyAvailable:true,includeSubprojects:v.includeSubprojects??false};},
  async projectTasksReview(v){calls.review++;return{reviewId,taskTitle:task.title,projectTitle:'Fictional project',linked:v.linked,expiresAt:100};},
  async projectTasksSave(){calls.save++;return{saved:true,linked:false};},
  async projectTasksCancel(){calls.cancel++;},
  async readTask(){calls.read++;return structuredClone(details);}
 };
 const panel=createPrivateProjectTaskPanel({client,clock:()=>now,canUse:()=>allowed,onChange:v=>focus.push(v)});t.after(()=>panel.dispose());
 const click=async(selector,dataset={})=>{panel.click({target:{closest:s=>s===selector?{dataset}:null}});await turn();};
 return{panel,client,calls,details,focus,click,load:()=>panel.open(projectToken,'Fictional project'),review:()=>click('[data-project-link-task]',{projectLinkTask:taskToken}),read:()=>click('[data-project-open-task]',{projectOpenTask:readToken}),allow:v=>allowed=v,time:v=>now=v};
}
test('project task lists and reviews cannot extend the five-minute or displayed-list lifetime',async t=>{
 for(const expiry of [300002,Infinity]){const f=fixture(t),original=f.client.projectTasksList;f.client.projectTasksList=async v=>({...await original(v),expiresAt:expiry});await f.load();assert.match(f.panel.render(),/could not be verified/);assert.doesNotMatch(f.panel.render(),/data-project-link-task=/);}
 for(const expiresAt of [101,300002]){const f=fixture(t),original=f.client.projectTasksReview;f.client.projectTasksReview=async v=>({...await original(v),expiresAt});await f.load();await f.review();await f.click('#private-project-link-save');assert.equal(f.calls.save,0);assert.doesNotMatch(f.panel.render(),/Approve project link change/);}
});
test('permission lost during list, review or selected read suppresses the late private reply',async t=>{
 for(const operation of ['list','review','read']){
  const f=fixture(t);let release,pending;
  if(operation==='list'){const original=f.client.projectTasksList;f.client.projectTasksList=v=>new Promise(resolve=>release=async()=>resolve(await original(v)));pending=f.load();}
  else{await f.load();if(operation==='review'){const original=f.client.projectTasksReview;f.client.projectTasksReview=v=>new Promise(resolve=>release=async()=>resolve(await original(v)));pending=f.review();}else{f.client.readTask=()=>new Promise(resolve=>release=()=>resolve(f.details));pending=f.read();}}
  f.allow(false);await release();await pending;await turn();assert.equal(f.panel.render(),'');assert.equal(f.calls.save,0);assert.equal(f.focus.at(-1),undefined);
  f.allow(true);assert.doesNotMatch(f.panel.render(),/PRIVATE_FICTIONAL_DETAIL|Approve project link change/);
 }
});
test('reset or offline during a save blocks further list, read, review and mutation until it settles',async t=>{
 for(const action of ['reset','offline']){
  const f=fixture(t);await f.load();await f.review();let release;f.client.projectTasksSave=()=>{f.calls.save++;return new Promise(resolve=>release=resolve);};await f.click('#private-project-link-save');f.panel[action]();
  await f.load();await f.click('#private-project-task-refresh');await f.click('#private-project-task-subprojects');await f.click('#private-project-task-mode');await f.review();await f.read();await f.click('#private-project-link-save');await f.click('#private-project-tasks-close');
  assert.deepEqual(f.calls,{list:1,review:1,save:1,read:0,cancel:0});assert.equal(f.panel.blocked(),true);
  const notifications=f.focus.length;release({saved:true,linked:false});await turn();await turn();assert.equal(f.calls.list,1);assert.ok(f.focus.length>notifications);assert.equal(f.focus.at(-1),undefined);
  if(action==='reset'){assert.equal(f.panel.render(),'');assert.equal(f.panel.blocked(),false);}else{assert.match(f.panel.render(),/Offline/);await f.click('#private-project-task-refresh');assert.equal(f.calls.list,2);}
 }
});
test('loss of permission during a saved acknowledgement never reloads or reports verified success',async t=>{
 const f=fixture(t);await f.load();await f.review();let release;f.client.projectTasksSave=()=>{f.calls.save++;return new Promise(resolve=>release=resolve);};await f.click('#private-project-link-save');f.allow(false);release({saved:true,linked:false});await turn();await turn();assert.equal(f.calls.list,1);assert.equal(f.panel.render(),'');f.allow(true);assert.doesNotMatch(f.panel.render(),/Project link saved/);await f.click('#private-project-link-save');assert.equal(f.calls.save,1);await f.click('#private-project-task-refresh');assert.equal(f.calls.list,2);
});
test('detail expiry clears private text without redirecting newer query focus',async t=>{
 const f=fixture(t);await f.load();f.details.expiresAt=2;await f.read();f.panel.input({target:{name:'project-task-query',value:'New query focus'}});await new Promise(resolve=>setTimeout(resolve,10));assert.doesNotMatch(f.panel.render(),/PRIVATE_FICTIONAL_DETAIL/);assert.match(f.panel.render(),/Temporary task details expired/);assert.equal(f.focus.at(-1),undefined);
});
