import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createProjectWorkspaceFixture,PROJECT_FIXTURE_OWNER,PROJECT_FIXTURE_ORIGIN} from '../server/project-workspace-fixtures.mjs';
import {createProjectWorkspaceClient} from '../src/project-workspace-client.mjs';
import {makeManualProject,makeManualTask,changeManualTask,projectWorkspaceView} from '../src/project-workspace-model.mjs';
import {createServerOnlyRpcClient} from '../server/server-only-rpc-client.mjs';
import {validateProjectPreviewArguments,makeProjectWorkspaceFixturePreview} from '../tools/preview-project-workspace.mjs';
function client(fixture){let ended=0;const calls=[];const value=createProjectWorkspaceClient({onSessionEnded:()=>ended++,fetcher:async(path,options)=>{
 calls.push(path);return fixture.handle(new Request(PROJECT_FIXTURE_ORIGIN+path,{...options,headers:{...options.headers,Cookie:'__Host-cc_workspace='+'a'.repeat(43),...(options.method==='POST'?{Origin:PROJECT_FIXTURE_ORIGIN}:{})}}));
}});return{value,calls,ended:()=>ended};}
test('cookie client→actor service→SQL project/task/subtasks/progress/history/Undo workflow',async()=>{
 const f=await createProjectWorkspaceFixture();try{const {value:c}=client(f);const owner=PROJECT_FIXTURE_OWNER;await c.status();
 const p=await c.create({operationId:randomUUID(),record:makeManualProject({title:'Fictional launch',summary:'Synthetic only',section:'Personal Life'},owner)});
 const operationId=randomUUID(),request={operationId,record:makeManualTask({title:'Fictional first step',day:'2026-11-12',project_id:p.record.id,subtasks:[{id:randomUUID(),title:'Fictional check',done:false}]},owner,[p.record])};
 const task=await c.create(request),replay=await c.create(request);assert.equal(replay.record.id,task.record.id);assert(replay.replayed);
 let rows=await c.list();assert.equal(rows.length,2);assert.equal(projectWorkspaceView(rows,owner,{day:'2026-11-12'}).counts.projectCounts[0].completed,0);
 const payload=changeManualTask(task.record,{status:'Completed',subtasks:task.record.payload.subtasks.map(s=>({...s,done:true}))},owner,[p.record]);
 const edit={operationId:randomUUID(),id:task.record.id,expectedVersion:task.record.version,payload};const completed=await c.update(edit);
 const editReplay=await c.update(edit);assert(editReplay.replayed);assert.equal(editReplay.record.version,completed.record.version);
 rows=await c.list();assert.equal(projectWorkspaceView(rows,owner,{day:'2026-11-12',view:'completed'}).tasks.length,1);assert.equal(projectWorkspaceView(rows,owner,{day:'2026-11-12'}).counts.projectCounts[0].completed,1);
 const history=await c.history({id:task.record.id});assert.equal(history[0].resultVersion,2);assert(history.every(r=>!Object.hasOwn(r,'payload')));
 const undo=await c.undo({operationId:randomUUID(),targetOperationId:completed.operationId});assert.equal(undo.record.version,3);assert.equal(undo.record.payload.done,false);assert.equal(undo.record.payload.subtasks[0].done,false);
 await assert.rejects(c.update({...edit,operationId:randomUUID()}));assert.equal((await c.list()).find(r=>r.id===task.record.id).version,3);
 await c.signOut();await assert.rejects(c.list());
 }finally{await f.close();}
});
test('actor-bound commands reject forged ownership/provenance/links and extra command fields before writes',async()=>{
 const f=await createProjectWorkspaceFixture();try{const {value:c}=client(f);await c.status();const record=makeManualProject({title:'Fictional scope'},PROJECT_FIXTURE_OWNER);
 for(const altered of [{...record,owner_id:'22222222-2222-4222-8222-222222222222'},{...record,origin:'m2c-fictional'},{...record,payload:{...record.payload,fictional:true}},{...record,id:randomUUID()}])await assert.rejects(c.create({operationId:randomUUID(),record:altered}));
 await assert.rejects(c.create({operationId:randomUUID(),record,approved:true}));assert.equal((await c.list()).length,0);
 const response=await f.handle(new Request(PROJECT_FIXTURE_ORIGIN+'/api/workspace/projects/create',{method:'POST',headers:{Cookie:'__Host-cc_workspace='+'a'.repeat(43),Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'}));assert.equal(response.status,403);
 const noCsrf=await f.handle(new Request(PROJECT_FIXTURE_ORIGIN+'/api/workspace/projects/create',{method:'POST',headers:{Cookie:'__Host-cc_workspace='+'a'.repeat(43),Origin:PROJECT_FIXTURE_ORIGIN,'Content-Type':'application/json'},body:'{}'}));assert.equal(noCsrf.status,403);
 assert.equal((await c.list()).length,0);
 }finally{await f.close();}
});
test('immutable create receipts remain available after task and its project were undone without restoring either',async()=>{
 const f=await createProjectWorkspaceFixture();try{const {value:c}=client(f);await c.status();const owner=PROJECT_FIXTURE_OWNER;
 const createProject={operationId:randomUUID(),record:makeManualProject({title:'Fictional removable project'},owner)};
 const p=await c.create(createProject),createTask={operationId:randomUUID(),record:makeManualTask({title:'Fictional removable task',project_id:p.record.id},owner,[p.record])};
 const t=await c.create(createTask);await c.undo({operationId:randomUUID(),targetOperationId:t.operationId});await c.undo({operationId:randomUUID(),targetOperationId:p.operationId});assert.equal((await c.list()).length,0);
 const replay=await c.create(createTask);assert(replay.replayed);assert.equal(replay.record.id,t.record.id);assert.equal((await c.list()).length,0);
 await assert.rejects(c.create({...createTask,record:{...createTask.record,payload:{...createTask.record.payload,title:'Changed intent'}}}));
 }finally{await f.close();}
});
test('client session clearing suppresses late private responses and never retries writes',async()=>{
 let release,calls=0;const data=new Promise(resolve=>release=resolve),client=createProjectWorkspaceClient({fetcher:async()=>{calls++;await data;return new Response('[]',{headers:{'Content-Type':'application/json'}});}});
 const pending=client.list();client.clear();release();await assert.rejects(pending);assert.equal(calls,1);await assert.rejects(client.create({}));assert.equal(calls,1);
 let ended=0;const signedOut=createProjectWorkspaceClient({onSessionEnded:()=>ended++,fetcher:async()=>new Response('{}',{status:401})});await assert.rejects(signedOut.list());assert.equal(ended,1);
});
test('a changed account in a passive session response clears the old client before further reads',async()=>{
 let count=0,ended=0;const c=createProjectWorkspaceClient({onSessionEnded:()=>ended++,fetcher:async()=>new Response(JSON.stringify({signedIn:true,csrf:'b'.repeat(43),user:{id:count++===0?PROJECT_FIXTURE_OWNER:'22222222-2222-4222-8222-222222222222'}}),{headers:{'Content-Type':'application/json'}})});
 await c.status();await assert.rejects(c.status(),/account changed/);assert.equal(ended,1);await assert.rejects(c.list());assert.equal(count,2);
});
test('workspace paged responses can exceed64KiB without widening session RPC limits',async()=>{
 const config={supabaseOrigin:'https://syntheticproject1234.supabase.co',expectedProjectRef:'syntheticproject1234',serviceRoleKey:'sb_secret_'+'synthetic_'.repeat(4)};
 const data={text:'x'.repeat(70000)},rpc=createServerOnlyRpcClient({...config,fetchImpl:async()=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}})});
 assert.equal((await rpc.rpc('cc_project_workspace',{operation:'list',input:{}})).data.text.length,70000);
 await assert.rejects(rpc.rpc('cc_durable_session',{operation:'read',input:{}}));
 const tooLarge=createServerOnlyRpcClient({...config,fetchImpl:async()=>new Response(JSON.stringify({text:'x'.repeat(512*1024)}),{headers:{'Content-Type':'application/json'}})});await assert.rejects(tooLarge.rpc('cc_project_workspace',{operation:'list',input:{}}));
});
test('fictional preview requires explicit mode and serves only reviewed public assets',async()=>{
 assert.equal(validateProjectPreviewArguments([]),null);assert.deepEqual(validateProjectPreviewArguments(['--fixtures-only']),{fixtures:true});
 for(const args of [['--start'],['--fixtures-only','--project=real'],['--port=5312']])assert.throws(()=>validateProjectPreviewArguments(args));
 const app=await makeProjectWorkspaceFixturePreview();try{await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+app.server.address().port;
 const page=await fetch(origin+'/project-workspace.html');assert.equal(page.status,200);assert.match(await page.text(),/project-workspace-entry/);
 for(const path of ['/server/project-workspace-fixtures.mjs','/.env.local','/docs/APPROVED_BLUEPRINT.md','/package.json'])assert.equal((await fetch(origin+path)).status,404);
 assert.equal((await fetch(origin+'/api/workspace/session',{headers:{Origin:'https://evil.example'}})).status,403);
 }finally{await app.close();}
});
