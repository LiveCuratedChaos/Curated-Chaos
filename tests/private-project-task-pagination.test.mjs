import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateProjectTaskPanel} from '../src/private-project-task-panel.mjs';
import {projectProgress} from '../src/project-progress.mjs';
const token='a'.repeat(43),settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const requests=[],tasks=Array.from({length:120},(_,i)=>({taskToken:String(i).padStart(43,'0'),title:'Fictional task '+i,section:'Home',completed:false,linked:true,recurring:false}));
 const panel=createPrivateProjectTaskPanel({clock:()=>0,client:{async projectTasksList(request){requests.push(request);return {...request,tasks:tasks.slice(request.offset,request.offset+50),matchCount:120,limit:50,viewId:token,expiresAt:100,projectTitle:'Fictional project',progress:projectProgress(tasks)};}}});
 const click=async selector=>{panel.click({target:{closest:s=>s===selector?{}:null}});await settle();};
 const query=value=>panel.input({target:{name:'project-task-query',value}});
 return {panel,requests,click,query};
}
test('new project task search starts at page one when Next is selected',async()=>{
 const f=fixture();await f.panel.open(token,'Fictional project');f.query('new query');await f.click('#private-project-task-next');assert.equal(f.requests.at(-1).offset,0);assert.equal(f.requests.at(-1).query,'new query');
});
test('new project task search starts at page one when Previous is selected from page three',async()=>{
 const f=fixture();await f.panel.open(token,'Fictional project');await f.click('#private-project-task-next');await f.click('#private-project-task-next');assert.equal(f.requests.at(-1).offset,100);f.query('changed');await f.click('#private-project-task-prev');assert.equal(f.requests.at(-1).offset,0);
});
test('unchanged trimmed project task query retains ordinary paging',async()=>{
 const f=fixture();await f.panel.open(token,'Fictional project');f.query('   ');await f.click('#private-project-task-next');assert.equal(f.requests.at(-1).offset,50);await f.click('#private-project-task-prev');assert.equal(f.requests.at(-1).offset,0);
});
