import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createProjectWorkspaceFixture,PROJECT_FIXTURE_OWNER as owner,PROJECT_FIXTURE_ORIGIN as origin} from '../server/project-workspace-fixtures.mjs';
import {createProjectWorkspaceClient} from '../src/project-workspace-client.mjs';
import {createManualAutosaveSession} from '../src/manual-autosave-session.mjs';
import {makeManualTask,changeManualTask} from '../src/project-workspace-model.mjs';
function client(f){const calls=[];const c=createProjectWorkspaceClient({fetcher:async(path,options)=>{calls.push(path);return f.handle(new Request(origin+path,{...options,headers:{...options.headers,Cookie:'__Host-cc_workspace='+'a'.repeat(43),...(options.method==='POST'?{Origin:origin}:{})}}));}});return{c,calls};}
function session(record,c){return createManualAutosaveSession({record,ownerId:owner,client:c,schedule:()=>1,cancel:()=>{}});}
async function seed(c){return(await c.create({operationId:randomUUID(),record:makeManualTask({title:'Fictional autosave task',status:'Waiting',subtasks:[{id:randomUUID(),title:'Retained step',done:false}]},owner)})).record;}
test('routine autosave→cookie/CSRF client→SQL receipt/history→guarded Undo preserves status/checklist and exact text',async()=>{
 const f=await createProjectWorkspaceFixture();try{const {c,calls}=client(f);await c.status();const record=await seed(c),s=session(record,c),details='  \n'+'界'.repeat(9994)+'\n  ';
 s.edit({title:'Fictional renamed task'});s.edit({description:details,day:'2026-11-17',priority:'High'});assert.equal(calls.filter(p=>p.endsWith('/update')).length,0);await s.flush();assert.equal(s.state().status,'saved');assert.equal(s.state().undoAvailable,true);
 let saved=(await c.list())[0];assert.equal(saved.version,2);assert.equal(saved.payload.description,details);assert.equal(saved.payload.status,'Waiting');assert.deepEqual(saved.payload.subtasks,record.payload.subtasks);assert.equal((await c.history({id:record.id}))[0].kind,'update');
 await s.undo();saved=(await c.list())[0];assert.equal(saved.version,3);assert.deepEqual(saved.payload,record.payload);assert.equal((await c.history({id:record.id}))[0].kind,'undo');assert.equal(s.state().undoAvailable,false);await s.undo();assert.equal(calls.filter(p=>p.endsWith('/undo')).length,1);s.clear();await c.signOut();
 }finally{await f.close();}
});
test('another writer wins without autosave overwrite or automatic retry, including guarded Undo conflicts',async()=>{
 const f=await createProjectWorkspaceFixture();try{const {c,calls}=client(f);await c.status();const record=await seed(c),s=session(record,c);
 s.edit({title:'First saved edit'});await s.flush();let row=(await c.list())[0];await c.update({operationId:randomUUID(),id:row.id,expectedVersion:row.version,payload:changeManualTask(row,{title:'Other writer'},owner,[])});
 await s.undo();assert.equal(s.state().status,'uncertain');assert.equal((await c.list())[0].payload.title,'Other writer');await s.undo();assert.equal(calls.filter(p=>p.endsWith('/undo')).length,1);s.clear();
 const stale=session(record,c);stale.edit({title:'Stale edit'});await stale.flush();assert.equal(stale.state().status,'uncertain');const count=calls.filter(p=>p.endsWith('/update')).length;await stale.flush();assert.equal(calls.filter(p=>p.endsWith('/update')).length,count);assert.equal((await c.list())[0].payload.title,'Other writer');stale.clear();await c.signOut();
 }finally{await f.close();}
});
test('committed save with a lost response stays uncertain and cannot duplicate the SQL operation',async()=>{
 const f=await createProjectWorkspaceFixture();try{const {c,calls}=client(f);await c.status();const record=await seed(c),wrapped={update:async command=>{await c.update(command);throw Error('Response lost');},undo:c.undo,history:c.history},s=session(record,wrapped);
 s.edit({title:'Saved once despite lost response'});await s.flush();assert.equal(s.state().status,'uncertain');assert.equal(s.state().lastReceipt,null);s.edit({description:'Retained unsent correction'});await s.flush();assert.equal(calls.filter(p=>p.endsWith('/update')).length,1);const saved=(await c.list())[0];assert.equal(saved.version,2);assert.equal(saved.payload.title,'Saved once despite lost response');assert.notEqual(saved.payload.description,'Retained unsent correction');assert.equal((await c.history({id:record.id})).length,2);s.clear();await c.signOut();
 }finally{await f.close();}
});
test('signed-out sessions fail closed without provider access and pending drafts clear explicitly',async()=>{
 const f=await createProjectWorkspaceFixture();try{const {c,calls}=client(f);await c.status();const record=await seed(c),s=session(record,c);s.edit({description:'Do not send after sign out'});await c.signOut();await s.flush();assert.equal(s.state().status,'uncertain');assert.equal(calls.filter(p=>p.endsWith('/update')).length,0);s.clear();assert.equal(s.state().version,null);assert.deepEqual(s.state().patch,{});
 }finally{await f.close();}
});
