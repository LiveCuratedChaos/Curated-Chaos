import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {makePrivateSessionPreview,validatePrivatePreviewArguments} from '../tools/private-session-preview-server.mjs';
const origin='http://127.0.0.1:5316';
const scope={fixtures:true,previewPort:5316,serveWorkspace:true,allowBriefRead:true,allowTaskWorkspace:true,allowSearch:true,allowTaskPriorityLists:true,allowSearchDates:true,allowUndatedTasks:true,allowTaskCreate:true,allowTaskRead:true,allowTaskDescriptionEdit:true,allowTaskEdit:true,allowTaskCompletion:true,allowTaskReopen:true,allowProjects:true,allowProjectTaskLinks:true,allowProjectHierarchy:true};
async function setup(t,overrides={}){
 const app=makePrivateSessionPreview({...scope,...overrides},{configLoader:()=>{throw Error('Configuration forbidden');},apiFactory:()=>{throw Error('Real API forbidden');}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await app.dispose();await new Promise(resolve=>app.server.close(resolve));});
 let cookie='',csrf='';
 async function call(path,values,extra={}){return new Promise((resolve,reject)=>{const request=httpRequest({hostname:'127.0.0.1',port:app.server.address().port,path:'/auth/workspace/'+path,method:values===undefined?'GET':'POST',headers:{Host:'127.0.0.1:5316',Origin:origin,'X-CC-Request':'workspace-session',...(cookie?{Cookie:cookie}:{}),...(values===undefined?{}:{'Content-Type':'application/json','X-CC-CSRF':csrf}),...extra}},response=>{let text='';response.on('data',chunk=>text+=chunk);response.on('end',()=>{if(response.headers['set-cookie'])cookie=response.headers['set-cookie'].map(x=>x.split(';')[0]).join('; ');const data=JSON.parse(text);if(data.csrf)csrf=data.csrf;resolve({status:response.statusCode,data});});});request.on('error',reject);request.end(values===undefined?undefined:JSON.stringify(values));});}
 await call('status');assert.equal((await call('login',{email:'demo@example.test',password:'fictional-only'})).status,200);
 async function create(title){assert.equal((await call('projects/list',{})).status,200);const review=await call('projects/review',{action:'create',fields:{title,description:'Fictional hierarchy detail',section:'Home',status:'Planned',separateRecurring:true}});assert.equal(review.status,200);assert.equal((await call('projects/save',{reviewId:review.data.reviewId,approved:true})).status,200);}
 async function list(title,direction='children'){const projects=await call('projects/list',{});assert.equal(projects.status,200);const selected=projects.data.projects.find(p=>p.title===title);assert.ok(selected);return call('projects/hierarchy-list',{projectToken:selected.projectToken,direction,offset:0,query:''});}
 async function change(parent,child,linked=true){const view=await list(parent);assert.equal(view.status,200);const choice=view.data.projects.find(p=>p.title===child);assert.ok(choice);const review=await call('projects/hierarchy-review',{projectToken:choice.projectToken,linked});assert.equal(review.status,200);return call('projects/hierarchy-save',{reviewId:review.data.reviewId,approved:true});}
 return{call,create,list,change};
}
test('hierarchy requires explicit dependency scopes and defaults disabled',async t=>{
 assert.throws(()=>makePrivateSessionPreview({fixtures:true,allowProjectHierarchy:true}),/hierarchy/);
 assert.throws(()=>validatePrivatePreviewArguments(['--fixtures-only','--allow-private-project-hierarchy-reviewed']),/hierarchy/);
 const s=await setup(t,{allowProjectHierarchy:false});assert.equal((await s.call('projects/hierarchy-list',{})).status,404);
});
test('reviewed hierarchy supports several parents and refuses self and cyclic relationships',async t=>{
 const s=await setup(t);for(const title of ['Fictional A','Fictional B','Fictional child'])await s.create(title);
 assert.equal((await s.change('Fictional A','Fictional child')).status,200);assert.equal((await s.change('Fictional B','Fictional child')).status,200);
 const parents=await s.list('Fictional child','parents');assert.equal(parents.status,200);assert.deepEqual(parents.data.projects.filter(p=>p.linked).map(p=>p.title).sort(),['Fictional A','Fictional B']);assert.doesNotMatch(JSON.stringify(parents.data),/owner_id|parentProjectId|childProjectId|Fictional hierarchy detail/);
 const view=await s.list('Fictional child');assert.equal(view.status,200);assert.equal(view.data.projects.some(p=>p.title==='Fictional child'),false);const a=view.data.projects.find(p=>p.title==='Fictional A');assert.equal((await s.call('projects/hierarchy-review',{projectToken:a.projectToken,linked:true})).status,409);
 assert.equal((await s.change('Fictional A','Fictional child',false)).status,200);const after=await s.list('Fictional child','parents');assert.deepEqual(after.data.projects.filter(p=>p.linked).map(p=>p.title),['Fictional B']);
});
test('hierarchy changes require origin, CSRF, exact approval and selected opaque tokens; cancellation consumes review',async t=>{
 const s=await setup(t);await s.create('Fictional parent');await s.create('Fictional child');const view=await s.list('Fictional parent');const child=view.data.projects.find(p=>p.title==='Fictional child');
 assert.equal((await s.call('projects/hierarchy-review',{projectToken:child.projectToken,linked:true},{Origin:'https://outside.example.test'})).status,403);
 assert.equal((await s.call('projects/hierarchy-review',{projectToken:child.projectToken,linked:true},{'X-CC-CSRF':'wrong'})).status,403);
 assert.equal((await s.call('projects/hierarchy-review',{projectToken:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',linked:true})).status,409);
 const review=await s.call('projects/hierarchy-review',{projectToken:child.projectToken,linked:true});assert.equal(review.status,200);assert.equal((await s.call('projects/hierarchy-save',{reviewId:review.data.reviewId,approved:false})).status,409);assert.equal((await s.call('projects/hierarchy-cancel',{})).status,200);assert.equal((await s.call('projects/hierarchy-save',{reviewId:review.data.reviewId,approved:true})).status,409);
 const again=await s.list('Fictional parent');assert.equal(again.data.projects.find(p=>p.title==='Fictional child').linked,false);assert.equal((await s.call('logout',{})).status,200);assert.ok([401,403].includes((await s.call('projects/hierarchy-list',{})).status));
});
test('project refresh invalidates hierarchy reviews, and another reviewed link invalidates old endpoint versions',async t=>{
 const s=await setup(t);for(const title of ['Fictional parent','Fictional child','Fictional other'])await s.create(title);let view=await s.list('Fictional parent'),child=view.data.projects.find(p=>p.title==='Fictional child'),review=await s.call('projects/hierarchy-review',{projectToken:child.projectToken,linked:true});assert.equal(review.status,200);assert.equal((await s.call('projects/list',{})).status,200);assert.equal((await s.call('projects/hierarchy-save',{reviewId:review.data.reviewId,approved:true})).status,409);assert.equal((await s.change('Fictional parent','Fictional other')).status,200);view=await s.list('Fictional parent');assert.equal(view.data.projects.find(p=>p.title==='Fictional child').linked,false);assert.equal(view.data.projects.find(p=>p.title==='Fictional other').linked,true);
});
test('hierarchy routes reject surplus fields and saves cannot replay; relink preserves one canonical relationship',async t=>{
 const s=await setup(t);await s.create('Fictional parent');await s.create('Fictional child');let view=await s.list('Fictional parent');const child=view.data.projects.find(p=>p.title==='Fictional child');assert.equal((await s.call('projects/hierarchy-review',{projectToken:child.projectToken,linked:true,ownerId:'other'})).status,409);let review=await s.call('projects/hierarchy-review',{projectToken:child.projectToken,linked:true});assert.equal(review.status,200);const approved={reviewId:review.data.reviewId,approved:true};assert.equal((await s.call('projects/hierarchy-save',approved)).status,200);assert.equal((await s.call('projects/hierarchy-save',approved)).status,409);assert.equal((await s.change('Fictional parent','Fictional child',false)).status,200);assert.equal((await s.change('Fictional parent','Fictional child')).status,200);view=await s.list('Fictional child','parents');assert.equal(view.data.projects.filter(p=>p.linked).length,1);
});
