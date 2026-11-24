import {test} from 'node:test';import assert from 'node:assert/strict';
import {createPrivateProjectHierarchy} from '../server/private-project-hierarchy.mjs';
const id=n=>'11111111-1111-4111-a111-'+n.toString(16).padStart(12,'0'),owner=id(99),actor={ownerId:owner,accessToken:'fictional-token'};
function fixture(){let time=1,reads=0,writes=0;const projects=[1,2,3].map(n=>({id:id(n),owner_id:owner,household_id:null,visibility:'private',section:'Home',item_type:'project',origin:'PRIVATE_COOKIE_PROJECT',version:1,deleted_at:null,payload:{fictional:true,schemaVersion:1,title:'Fictional '+n,status:'Active'}})),data={projects,relationships:[],tasks:[],memberships:[]};
 const api={async projectHierarchySnapshot(){reads++;return structuredClone(data);},async setProjectHierarchyLink(token,v){writes++;const parent=projects.find(p=>p.id===v.parentProjectId),child=projects.find(p=>p.id===v.childProjectId);parent.version++;child.version++;let link=data.relationships.find(l=>l.payload.parentProjectId===parent.id&&l.payload.childProjectId===child.id);if(!link){link={id:id(20),owner_id:owner,household_id:null,visibility:'private',section:'Personal Life',item_type:'project_project_link',origin:'PRIVATE_COOKIE_PROJECT_PROJECT_LINK',version:0,deleted_at:null,payload:{fictional:true,schemaVersion:1,parentProjectId:parent.id,childProjectId:child.id}};data.relationships.push(link);}link.version++;link.deleted_at=v.linked?null:'2026-11-16T00:00:00Z';return{parentId:parent.id,parentVersion:parent.version,childId:child.id,childVersion:child.version,linkRecord:structuredClone(link)};}};
 const service=createPrivateProjectHierarchy({api,now:()=>time});return{service,data,api,actor,root:projects[0],setTime:v=>time=v,counts:()=>({reads,writes})};}
test('hierarchy uses opaque displayed choices and guarded one-use saves',async t=>{const f=fixture();t.after(()=>f.service.dispose());const view=await f.service.list('session',actor,100,f.root);assert.equal(JSON.stringify(view).includes(f.root.id),false);assert.equal(view.descendantCount,0);const choice=view.projects[0];const review=await f.service.prepare('session',actor,choice.projectToken,true);assert.equal(review.parentTitle,'Fictional 1');assert.equal(review.childTitle,'Fictional 2');const claim=f.service.claim('session',owner,review.reviewId);assert.equal(await f.service.authorize(claim,actor),true);assert.deepEqual(await f.service.save(claim,actor),{saved:true,linked:true});await assert.rejects(f.service.save(claim,actor));assert.equal(f.counts().writes,1);const next=await f.service.list('session',actor,100,f.root);assert.equal(next.descendantCount,1);assert.equal(next.projects[0].linked,true);});
test('stale structures and foreign sessions never authorize a pending relationship',async t=>{const f=fixture();t.after(()=>f.service.dispose());const view=await f.service.list('session',actor,100,f.root);await assert.rejects(f.service.prepare('session',{...actor,ownerId:id(100)},view.projects[0].projectToken,true));const review=await f.service.prepare('session',actor,view.projects[0].projectToken,true);f.data.projects[2].version++;const claim=f.service.claim('session',owner,review.reviewId);await assert.rejects(f.service.authorize(claim,actor),/changed/);assert.equal(f.counts().writes,0);});
test('clear, expiry and late reads cannot revive a hierarchy context',async t=>{const f=fixture();t.after(()=>f.service.dispose());const original=f.api.projectHierarchySnapshot;let release;f.api.projectHierarchySnapshot=()=>new Promise(resolve=>{release=()=>resolve(structuredClone(f.data));});const pending=f.service.list('session',actor,100,f.root);f.service.clear('session');release();await assert.rejects(pending);f.api.projectHierarchySnapshot=original;const v=await f.service.list('session',actor,100,f.root);f.setTime(101);await assert.rejects(f.service.prepare('session',actor,v.projects[0].projectToken,true));assert.equal(f.counts().writes,0);});
test('parent browsing names direction correctly and bad snapshots fail closed',async t=>{const f=fixture();t.after(()=>f.service.dispose());const view=await f.service.list('session',actor,100,f.root,{direction:'parents'}),review=await f.service.prepare('session',actor,view.projects[0].projectToken,true);assert.equal(review.parentTitle,'Fictional 2');assert.equal(review.childTitle,'Fictional 1');f.data.projects[1].owner_id=id(111);await assert.rejects(f.service.list('session',actor,100,f.root));});

test('a project already assigned to one master cannot be added to another master',async t=>{
 const f=fixture();t.after(()=>f.service.dispose());const first=await f.service.list('first',actor,100,f.root),review=await f.service.prepare('first',actor,first.projects.find(p=>p.title==='Fictional 2').projectToken,true),claim=f.service.claim('first',owner,review.reviewId);
 assert.equal(await f.service.authorize(claim,actor),true);await f.service.save(claim,actor);
 const other=f.data.projects[2],next=await f.service.list('second',actor,100,other),choice=next.projects.find(p=>p.title==='Fictional 2');
 await assert.rejects(f.service.prepare('second',actor,choice.projectToken,true),error=>error.code==='PROJECT_HIERARCHY_SINGLE_PARENT');assert.equal(f.counts().writes,1);
});

test('selected-project metadata cannot silently advance to a newer project revision',async t=>{
 const f=fixture();t.after(()=>f.service.dispose());const selected=structuredClone(f.root);f.root.version++;
 await assert.rejects(f.service.list('session',actor,100,selected),/Selected private project changed/);assert.equal(f.counts().writes,0);
 for(const patch of [{owner_id:id(101)},{visibility:'household'},{household_id:id(102)},{item_type:'task'},{origin:'OTHER'},{deleted_at:'2026-11-17T12:00:00Z'}])await assert.rejects(f.service.list('session',actor,100,{...f.root,...patch}));
});

test('missing or failed authorization cannot write a claimed hierarchy review',async t=>{
 for(const mode of ['missing','failed','foreign']){
  const f=fixture();t.after(()=>f.service.dispose());const view=await f.service.list('session',actor,100,f.root),review=await f.service.prepare('session',actor,view.projects[0].projectToken,true),claim=f.service.claim('session',owner,review.reviewId);
  if(mode==='failed'){f.data.projects[2].version++;await assert.rejects(f.service.authorize(claim,actor),/changed/);}
  if(mode==='foreign')assert.equal(await f.service.authorize(claim,{...actor,ownerId:id(100)}),false);
  await assert.rejects(f.service.save(claim,actor),/review ended/);assert.equal(f.counts().writes,0);
 }
});

test('clearing, expiry or a superseding operation invalidates an authorized claim before saving',async t=>{
 for(const mode of ['clear','expired','superseded']){
  const f=fixture();t.after(()=>f.service.dispose());const view=await f.service.list('session',actor,100,f.root),review=await f.service.prepare('session',actor,view.projects[0].projectToken,true),claim=f.service.claim('session',owner,review.reviewId);
  assert.equal(await f.service.authorize(claim,actor),true);
  if(mode==='clear')f.service.clear('session');if(mode==='expired')f.setTime(100);if(mode==='superseded')await assert.rejects(f.service.prepare('session',actor,'no-displayed-token',true));
  await assert.rejects(f.service.save(claim,actor));assert.equal(f.counts().writes,0);
 }
});

test('a cleared context cannot be revived by a late preflight response',async t=>{
 const f=fixture();t.after(()=>f.service.dispose());const view=await f.service.list('session',actor,100,f.root),review=await f.service.prepare('session',actor,view.projects[0].projectToken,true),claim=f.service.claim('session',owner,review.reviewId);
 let release;f.api.projectHierarchySnapshot=()=>new Promise(resolve=>release=()=>resolve(structuredClone(f.data)));
 const pending=f.service.authorize(claim,actor);f.service.clear('session');release();await assert.rejects(pending);await assert.rejects(f.service.save(claim,actor));assert.equal(f.counts().writes,0);
});

test('uncertain hierarchy saves consume preflight and never retry the mutation',async t=>{
 const f=fixture();t.after(()=>f.service.dispose());const view=await f.service.list('session',actor,100,f.root),review=await f.service.prepare('session',actor,view.projects[0].projectToken,true),claim=f.service.claim('session',owner,review.reviewId),write=f.api.setProjectHierarchyLink;
 f.api.setProjectHierarchyLink=async(...args)=>{await write(...args);throw Error('Fictional lost acknowledgement');};assert.equal(await f.service.authorize(claim,actor),true);await assert.rejects(f.service.save(claim,actor),/lost acknowledgement/);assert.equal(await f.service.authorize(claim,actor),false);await assert.rejects(f.service.save(claim,actor));assert.equal(f.counts().writes,1);assert.equal(f.data.relationships.length,1);
});

test('invalid snapshots are not mislabeled as hierarchy cycles',async t=>{
 const f=fixture();t.after(()=>f.service.dispose());const view=await f.service.list('session',actor,100,f.root);f.data.projects[2].payload.status='Unsupported';
 await assert.rejects(f.service.prepare('session',actor,view.projects[0].projectToken,true),error=>error.code!=='PROJECT_HIERARCHY_CYCLE');assert.equal(f.counts().writes,0);
});
