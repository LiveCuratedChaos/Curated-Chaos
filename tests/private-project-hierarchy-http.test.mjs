// In-process HTTP acceptance only. All records/authentication are fictional.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPrivateSessionHttp} from '../server/private-workspace-session-http.mjs';
import {validateHierarchyChange} from '../src/project-hierarchy.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',origin='http://127.0.0.1:5312';
async function setup(t,{hierarchy=true}={}){
 const stamp=new Date().toISOString(),projects=['Fictional parent A','Fictional parent B','Fictional child'].map(title=>({id:randomUUID(),owner_id:owner,household_id:null,visibility:'private',section:'Home',item_type:'project',origin:'PRIVATE_COOKIE_PROJECT',version:1,deleted_at:null,created_at:stamp,updated_at:stamp,payload:{fictional:true,schemaVersion:1,title,status:'Planned',description:'PRIVATE_PROJECT_BODY_NEVER_EXPOSE',separateRecurring:true}})),relationships=[],tokens=new Map(),state={reads:0,writes:0,lost:false};
 const snapshot=who=>({projects:structuredClone(projects.filter(p=>p.owner_id===who&&p.deleted_at===null)),relationships:structuredClone(relationships.filter(r=>r.owner_id===who)),tasks:[],memberships:[]});
 const identity=token=>{const value=tokens.get(token);if(!value)throw Error('Fictional session ended');return value;};
 const api={
  async signIn(email){const id=email==='other@example.test'?other:owner,token=randomUUID();tokens.set(token,id);return{accessToken:token,refreshToken:'fictional-refresh',expiresAt:Date.now()+3600000};},
  async getUser(token){const id=identity(token);return{id,email:id===owner?'demo@example.test':'other@example.test'};},async isSessionActive(token){return tokens.has(token);},async refreshSession(){throw Error('Refresh forbidden');},async signOutLocal(token){tokens.delete(token);},
  async listPrivateProjects(token,who){assert.equal(identity(token),who);return structuredClone(projects.filter(p=>p.owner_id===who&&p.deleted_at===null));},
  async getPrivateProject(token,id,who){assert.equal(identity(token),who);return structuredClone(projects.filter(p=>p.id===id&&p.owner_id===who&&p.deleted_at===null));},
  async addPrivateProject(){throw Error('Project writes forbidden');},async updatePrivateProject(){throw Error('Project writes forbidden');},
  async listProjectTaskChoices(){return[];},async getProjectTaskChoice(){return[];},async getProjectLinkTarget(){return[];},async listProjectTaskMemberships(){return[];},async getTaskProjectMembership(){return[];},async setTaskProjectLink(){throw Error('Task writes forbidden');},
  async projectHierarchySnapshot(token,who){assert.equal(identity(token),who);state.reads++;return snapshot(who);},
  async setProjectHierarchyLink(token,v){const who=identity(token),parent=projects.find(p=>p.id===v.parentProjectId&&p.owner_id===who),child=projects.find(p=>p.id===v.childProjectId&&p.owner_id===who),old=relationships.find(r=>r.payload.parentProjectId===v.parentProjectId&&r.payload.childProjectId===v.childProjectId);
   if(!parent||!child||parent.version!==v.parentVersion||child.version!==v.childVersion||(old?.version??0)!==v.linkVersion)throw Error('Fictional stale write');
   validateHierarchyChange({ownerId:who,...snapshot(who)},{parentProjectId:parent.id,childProjectId:child.id,linked:v.linked});state.writes++;
   const row=old??{id:randomUUID(),owner_id:who,household_id:null,visibility:'private',section:'Personal Life',item_type:'project_project_link',origin:'PRIVATE_COOKIE_PROJECT_PROJECT_LINK',version:0,deleted_at:null,created_at:stamp,updated_at:stamp,payload:{fictional:true,schemaVersion:1,parentProjectId:parent.id,childProjectId:child.id}};
   if(!old)relationships.push(row);row.version++;row.deleted_at=v.linked?null:stamp;parent.version++;child.version++;
   if(state.lost)throw Error('Fictional lost acknowledgement');return{parentId:parent.id,parentVersion:parent.version,childId:child.id,childVersion:child.version,linkRecord:structuredClone(row)};
  }
 };
 const router=createPrivateSessionHttp({origin,api,allowProjects:true,allowProjectTaskLinks:true,allowProjectHierarchy:hierarchy});t.after(()=>router.dispose());
 async function client(email='demo@example.test',signIn=true){let cookie='',csrf='';
  async function call(path,body,extra={}){const req={url:'/auth/workspace/'+path,method:body===undefined?'GET':'POST',headers:{host:'127.0.0.1:5312',origin,cookie,'content-type':'application/json','x-cc-request':'workspace-session','x-cc-csrf':csrf,...extra},async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},res={writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(value){this.body=value;}};
   const handled=await router.handle(req,res);if(!handled)return{status:404,data:{}};const data=JSON.parse(res.body);if(res.headers['Set-Cookie'])cookie=res.headers['Set-Cookie'].split(';')[0];if(data.csrf)csrf=data.csrf;return{status:res.status,data};}
  await call('status');if(signIn)assert.equal((await call('login',{email,password:'fictional-only'})).status,200);
  const send=(action,value={})=>call('projects/'+action,value);
  async function select(title){const result=await send('list');assert.equal(result.status,200);const project=result.data.projects.find(p=>p.title===title);assert.ok(project);return project.projectToken;}
  async function list(title,direction='children'){const projectToken=await select(title),result=await send('structure-list',{projectToken,direction,offset:0,query:''});assert.equal(result.status,200);return{...result,projectToken};}
  async function prepare(parent,child,linked=true){const view=await list(parent),selected=view.data.projects.find(p=>p.title===child);assert.ok(selected);return send('structure-review',{projectToken:selected.projectToken,linked});}
  async function change(parent,child,linked=true){const review=await prepare(parent,child,linked);assert.equal(review.status,200);return send('structure-save',{reviewId:review.data.reviewId,approved:true});}
  return{call,send,select,list,prepare,change};
 }
 return{...await client(),client,api,state,projects,relationships};
}

test('hierarchy HTTP routes default off and require a signed-in session',async t=>{
 const disabled=await setup(t,{hierarchy:false});assert.equal((await disabled.send('structure-list')).status,404);
 const enabled=await setup(t),anonymous=await enabled.client('demo@example.test',false);assert.equal((await anonymous.send('structure-list')).status,401);assert.equal(enabled.state.reads,0);
});

test('hierarchy HTTP uses exact origin, CSRF, approval and displayed opaque choices',async t=>{
 const s=await setup(t),view=await s.list('Fictional parent A'),child=view.data.projects.find(p=>p.title==='Fictional child');
 for(const headers of [{origin:'https://outside.example.test'},{'x-cc-csrf':'wrong'},{host:'outside.test'},{'content-type':'text/plain'}])assert.equal((await s.call('projects/structure-review',{projectToken:child.projectToken,linked:true},headers)).status,403);
 assert.equal((await s.send('structure-review',{projectToken:s.projects[2].id,linked:true})).status,409);
 assert.equal((await s.send('structure-review',{projectToken:child.projectToken,linked:true,owner_id:other})).status,409);
 const review=await s.send('structure-review',{projectToken:child.projectToken,linked:true});assert.equal(review.status,200);assert.equal((await s.send('structure-save',{reviewId:review.data.reviewId,approved:false})).status,409);assert.equal((await s.send('structure-cancel')).status,200);assert.equal((await s.send('structure-save',{reviewId:review.data.reviewId,approved:true})).status,409);assert.equal(s.state.writes,0);
 assert.doesNotMatch(JSON.stringify(view.data),/PRIVATE_PROJECT_BODY|owner_id|parentProjectId|childProjectId/);
});

test('one master is enforced until reviewed unlink, then explicit reparent preserves the child',async t=>{
 const s=await setup(t),before=structuredClone(s.projects.map(p=>p.payload));assert.equal((await s.change('Fictional parent A','Fictional child')).status,200);
 const rejected=await s.prepare('Fictional parent B','Fictional child');assert.equal(rejected.status,409);assert.match(rejected.data.error,/only one master project/);assert.doesNotMatch(JSON.stringify(rejected.data),/PRIVATE_PROJECT_BODY|Fictional parent|Fictional child|owner_id|parentProjectId/);assert.equal(s.state.writes,1);
 assert.equal((await s.change('Fictional parent A','Fictional child',false)).status,200);assert.equal((await s.change('Fictional parent B','Fictional child')).status,200);
 const view=await s.list('Fictional child','parents');assert.deepEqual(view.data.projects.filter(p=>p.linked).map(p=>p.title),['Fictional parent B']);assert.deepEqual(s.projects.map(p=>p.payload),before);
});

test('confirmed hierarchy save reloads through the same selected root token with advanced endpoint versions',async t=>{
 const s=await setup(t),view=await s.list('Fictional parent A'),child=view.data.projects.find(p=>p.title==='Fictional child'),review=await s.send('structure-review',{projectToken:child.projectToken,linked:true});assert.equal(review.status,200);
 const saved=await s.send('structure-save',{reviewId:review.data.reviewId,approved:true});assert.deepEqual(saved,{status:200,data:{saved:true,linked:true}});
 const reloaded=await s.send('structure-list',{projectToken:view.projectToken,direction:'children',offset:0,query:''});assert.equal(reloaded.status,200);assert.equal(reloaded.data.descendantCount,1);assert.equal(reloaded.data.projects.find(p=>p.title==='Fictional child').linked,true);assert.equal(s.state.writes,1);
});

test('stale project choices or structure reviews cannot overwrite a newer project revision',async t=>{
 const s=await setup(t),root=await s.select('Fictional parent A');s.projects[0].version++;
 assert.equal((await s.send('structure-list',{projectToken:root})).status,409);
 const review=await s.prepare('Fictional parent A','Fictional child');assert.equal(review.status,200);s.projects[1].version++;
 assert.equal((await s.send('structure-save',{reviewId:review.data.reviewId,approved:true})).status,409);assert.equal(s.state.writes,0);
});

test('foreign sessions and sign-out cannot use another session hierarchy tokens',async t=>{
 const s=await setup(t),view=await s.list('Fictional parent A'),foreign=await s.client('other@example.test');
 const result=await foreign.send('structure-list',{projectToken:view.projectToken});assert.equal(result.status,409);assert.doesNotMatch(JSON.stringify(result.data),/Fictional|PRIVATE_PROJECT_BODY/);
 const child=view.data.projects.find(p=>p.title==='Fictional child');assert.equal((await foreign.send('structure-review',{projectToken:child.projectToken,linked:true})).status,409);
 const review=await s.send('structure-review',{projectToken:child.projectToken,linked:true});assert.equal(review.status,200);assert.equal((await s.call('logout',{})).status,200);assert.ok([401,403].includes((await s.send('structure-save',{reviewId:review.data.reviewId,approved:true})).status));assert.equal(s.state.writes,0);
});

test('uncertain hierarchy HTTP saves never retry and fresh structure shows the saved relationship',async t=>{
 const s=await setup(t),review=await s.prepare('Fictional parent A','Fictional child');assert.equal(review.status,200);s.state.lost=true;
 const approval={reviewId:review.data.reviewId,approved:true};assert.equal((await s.send('structure-save',approval)).status,503);assert.equal((await s.send('structure-save',approval)).status,409);assert.equal(s.state.writes,1);
 s.state.lost=false;const refreshed=await s.list('Fictional parent A');assert.equal(refreshed.data.projects.find(p=>p.title==='Fictional child').linked,true);assert.equal(s.relationships.length,1);
});

test('successful hierarchy saves cannot replay and project refresh retires pending reviews',async t=>{
 const s=await setup(t),review=await s.prepare('Fictional parent A','Fictional child'),approval={reviewId:review.data.reviewId,approved:true};assert.equal((await s.send('structure-save',approval)).status,200);assert.equal((await s.send('structure-save',approval)).status,409);
 const next=await s.prepare('Fictional parent A','Fictional parent B');assert.equal(next.status,200);assert.equal((await s.send('list')).status,200);assert.equal((await s.send('structure-save',{reviewId:next.data.reviewId,approved:true})).status,409);assert.equal(s.state.writes,1);
});
