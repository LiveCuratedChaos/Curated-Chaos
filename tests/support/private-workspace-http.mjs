import assert from 'node:assert/strict';
import {request} from 'node:http';
import {makePrivateSessionPreview} from '../../tools/private-session-preview-server.mjs';
import {privateWorkspaceFixture} from './private-workspace-fixture.mjs';

export async function projectWorkspaceHttp(t, options) {
 let fetcher;
 if (process.env.CC_TEST_HTTP_TRANSPORT === 'handler') {
  fetcher = privateWorkspaceFixture(t,options).tab().fetcher;
 } else {
  const app = makePrivateSessionPreview(options);
  t.after(async ()=>{
   await app.dispose();
   if(app.server.listening)await new Promise(resolve=>app.server.close(resolve));
  });
  await new Promise((resolve,reject)=>{
   app.server.once('error',reject);
   app.server.listen(0,'127.0.0.1',()=>{
    app.server.off('error',reject);
    resolve();
   });
  });
  let cookie='';
  const origin='http://127.0.0.1:'+options.previewPort;
  fetcher=(path,options)=>new Promise((resolve,reject)=>{
   const req=request({hostname:'127.0.0.1',port:app.server.address().port,path,method:options.method,
    headers:{Host:new URL(origin).host,Origin:origin,Cookie:cookie,...options.headers}},res=>{
    const chunks=[];
    res.on('data',part=>chunks.push(part));
    res.on('error',reject);
    res.on('end',()=>{
     if(res.headers['set-cookie'])cookie=res.headers['set-cookie'].map(v=>v.split(';')[0]).join('; ');
     resolve({status:res.statusCode,json:()=>JSON.parse(Buffer.concat(chunks).toString())});
    });
   });
   req.on('error',reject);
   req.end(options.body);
  });
 }
 let csrf='';
 async function call(path,values) {
  const post=values!==undefined;
  const result=await fetcher('/auth/workspace/'+path,{method:post?'POST':'GET',
   headers:{'X-CC-Request':'workspace-session',...(post?{'Content-Type':'application/json','X-CC-CSRF':csrf}:{})},
   body:post?JSON.stringify(values):undefined});
  const data=await result.json();
  if(data.csrf)csrf=data.csrf;
  return {status:result.status,data};
 }
 await call('status');
 assert.equal((await call('login',{email:'demo@example.test',password:'fictional-only'})).status,200);
 async function create(title){
  await call('projects/list',{});
  const review=await call('projects/review',{action:'create',fields:{title,description:'',section:'Home',status:'Active',separateRecurring:false}});
  assert.equal(review.status,200);
  assert.equal((await call('projects/save',{reviewId:review.data.reviewId,approved:true})).status,200);
 }
 async function select(title){
  const list=await call('projects/list',{});
  assert.equal(list.status,200);
  return list.data.projects.find(p=>p.title===title).projectToken;
 }
 async function tasks(title,includeSubprojects=false){
  return call('projects/tasks-list',{projectToken:await select(title),offset:0,query:'',linkedOnly:true,includeSubprojects});
 }
 return {call,create,select,tasks};
}
