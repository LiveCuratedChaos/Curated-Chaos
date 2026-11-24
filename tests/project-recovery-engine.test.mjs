// Fictional embedded-engine recovery only; never opens a listener or hosted connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {hierarchyProgress} from '../src/project-hierarchy.mjs';
import {createIsolatedDevelopmentDatabase,actor,administrator,identities as i} from './fixtures/isolated-development-database.mjs';

test('full-engine recovery preserves recurring project memberships, retired links and version protection',async t=>{
 const source=await createIsolatedDevelopmentDatabase();let restored,closed=false;
 t.after(async()=>{if(!closed)await source.close();await restored?.close();});
 const task=randomUUID(),next=randomUUID(),projects=[randomUUID(),randomUUID()],operation=randomUUID();
 const day=(await source.query("select (timezone('America/New_York',statement_timestamp()))::date::text as day")).rows[0].day;
 const nextDay=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);
 await source.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,payload) values($1,$2,'private','Home','task',$3)",[task,i.a,JSON.stringify({fictional:true,title:'Fictional recovery chore',day,done:false,status:'Not Started',description:'Preserve exact\n<details>',subtasks:[{id:randomUUID(),title:'Saved step',done:true}]})]);
 for(const id of projects)await source.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values($1,$2,'private','Work','project','PRIVATE_COOKIE_PROJECT',$3)",[id,i.a,JSON.stringify({fictional:true,schemaVersion:1,title:'Recovery project',description:'',status:'Active',separateRecurring:true})]);
 await actor(source,i.a,i.sa);
 const row=async(db,id)=>(await db.query('select * from public.cc_records where id=$1',[id])).rows[0];
 const linkSql='select public.cc_set_task_project_link($1,$2,$3,$4,$5,$6) as result';
 for(const project of projects)await source.query(linkSql,[task,(await row(source,task)).version,project,1,0,true]);
 const completeSql='select public.cc_complete_recurring_chore($1,$2,$3::jsonb,$4::date,$5::date,$6,$7) as result';
 const args=[task,(await row(source,task)).version,JSON.stringify({anchorDay:day,frequency:'daily',interval:1}),nextDay,day,operation,next];
 await source.query(completeSql,args);
 const retired=(await source.query("select * from public.cc_records where item_type='project_task_link' and payload->>'taskId'=$1 and payload->>'projectId'=$2",[next,projects[1]])).rows[0];
 await source.query(linkSql,[next,(await row(source,next)).version,projects[1],1,retired.version,false]);
 await administrator(source);
 const before=(await source.query('select * from public.cc_records order by id')).rows;
 const snapshot=await source.dumpDataDir('none');await source.close();closed=true;
 restored=await PGlite.create({loadDataDir:snapshot});
 assert.deepEqual((await restored.query('select * from public.cc_records order by id')).rows,before);
 // Quarantine restored authentication before checking new access.
 await restored.exec('delete from auth.sessions');
 await actor(restored,i.a,i.sa);assert.equal(await row(restored,next),undefined);
 await administrator(restored);const fresh=randomUUID();await restored.query('insert into auth.sessions values($1,$2)',[fresh,i.a]);
 await actor(restored,i.a,fresh);
 assert.equal((await row(restored,task)).payload.done,true);
 assert.equal((await row(restored,next)).payload.subtasks[0].done,false);
 assert.equal((await row(restored,next)).payload.description,'Preserve exact\n<details>');
 const links=(await restored.query("select * from public.cc_records where item_type='project_task_link' and payload->>'taskId'=$1 order by id",[next])).rows;
 assert.equal(links.length,2);assert.equal(links.filter(r=>r.deleted_at===null).length,1);
 assert.notEqual((await row(restored,retired.id)).deleted_at,null);
 // The restored unique slot includes retired links: no duplicate link insertion.
 await assert.rejects(restored.query("insert into public.cc_records(owner_id,visibility,section,item_type,origin,payload) values($1,'private','Personal Life','project_task_link','PRIVATE_COOKIE_PROJECT_TASK_LINK',$2)",[i.a,JSON.stringify(retired.payload)]),/unique constraint/);
 const current=await row(restored,next);
 assert.equal((await restored.query('update public.cc_records set payload=payload where id=$1 and version=$2 returning id',[next,current.version-1])).rows.length,0);
 // Replay keeps the saved successor and its reviewed unlink, never reconnecting it.
 const replay=(await restored.query(completeSql,args)).rows[0].result;assert.equal(replay.alreadySaved,true);
 assert.deepEqual(await row(restored,next),current);assert.notEqual((await row(restored,retired.id)).deleted_at,null);
 const retiredVersion=(await row(restored,retired.id)).version;
 await actor(restored,i.b,i.sb);assert.equal(await row(restored,next),undefined);
 await assert.rejects(restored.query(linkSql,[next,current.version,projects[1],1,retiredVersion,true]),/Exact reviewed project membership/);
});

test('full-engine recovery retains single-master guards, relationship history and deduplicated task progress',async t=>{
 const source=await createIsolatedDevelopmentDatabase();let restored,closed=false;
 t.after(async()=>{if(!closed)await source.close();await restored?.close();});
 for(const file of ['private_project_hierarchy.sql','private_project_single_master.sql'])await source.exec(await readFile(new URL('../supabase/drafts/'+file,import.meta.url),'utf8'));
 const [root,child,other]=Array.from({length:3},()=>randomUUID()),task=randomUUID();
 for(const [id,title]of [[root,'Fictional recovery master'],[child,'Fictional recovery child'],[other,'Fictional former master']])await source.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values($1,$2,'private','Work','project','PRIVATE_COOKIE_PROJECT',$3)",[id,i.a,JSON.stringify({fictional:true,schemaVersion:1,title,description:'Exact recovery text\n<literal>',status:'Active',separateRecurring:false})]);
 await source.query("insert into public.cc_records(id,owner_id,visibility,section,item_type,payload) values($1,$2,'private','Home','task',$3)",[task,i.a,JSON.stringify({fictional:true,title:'Fictional shared recovery task',done:true,description:'One canonical task',subtasks:[]})]);
 const row=async(db,id)=>(await db.query('select * from public.cc_records where id=$1',[id])).rows[0];
 const link=async(db,parent,linked=true,version=0)=>(await db.query('select public.cc_set_project_hierarchy_link($1,$2,$3,$4,$5,$6) as result',[parent,(await row(db,parent)).version,child,(await row(db,child)).version,version,linked])).rows[0].result;
 await actor(source,i.a,i.sa);
 const former=await link(source,other);await link(source,other,false,former.linkRecord.version);const active=await link(source,root);
 for(const project of [root,child])await source.query('select public.cc_set_task_project_link($1,$2,$3,$4,$5,$6)',[task,(await row(source,task)).version,project,(await row(source,project)).version,0,true]);
 const snapshotSql='select public.cc_project_hierarchy_snapshot() as result';
 const beforeGraph=(await source.query(snapshotSql)).rows[0].result;
 const beforeProgress=hierarchyProgress({...beforeGraph,ownerId:i.a,rootProjectId:root});
 assert.equal(beforeProgress.progress.linkedTotal,1);assert.equal(beforeProgress.progress.completed,1);
 await administrator(source);const before=(await source.query('select * from public.cc_records order by id')).rows;
 const bytes=await source.dumpDataDir('none');await source.close();closed=true;
 restored=await PGlite.create({loadDataDir:bytes});
 assert.deepEqual((await restored.query('select * from public.cc_records order by id')).rows,before);
 // A snapshot contains old sessions: quarantine it before evaluating application access.
 await restored.exec('delete from auth.sessions');await actor(restored,i.a,i.sa);
 assert.equal(await row(restored,root),undefined);await assert.rejects(restored.query(snapshotSql),/Active private project sign-in/);
 await administrator(restored);const fresh=randomUUID();await restored.query('insert into auth.sessions values($1,$2)',[fresh,i.a]);await actor(restored,i.a,fresh);
 assert.equal((await restored.query('select public.cc_project_hierarchy_single_master_ready() as ready')).rows[0].ready,true);
 const restoredGraph=(await restored.query(snapshotSql)).rows[0].result;
 assert.deepEqual(restoredGraph,beforeGraph);
 assert.deepEqual(hierarchyProgress({...restoredGraph,ownerId:i.a,rootProjectId:root}),beforeProgress);
 const taskBefore=await row(restored,task),childBefore=await row(restored,child);
 await assert.rejects(link(restored,other,true,(await row(restored,former.linkRecord.id)).version),/only one master/);
 await assert.rejects(restored.query('update public.cc_records set deleted_at=statement_timestamp() where id=$1',[root]),/Unlink/);
 await assert.rejects(restored.query('update public.cc_records set deleted_at=statement_timestamp() where id=$1',[child]),/Unlink/);
 assert.deepEqual(await row(restored,child),childBefore);assert.deepEqual(await row(restored,task),taskBefore);
 const oldVersion=childBefore.version;await link(restored,root,false,active.linkRecord.version);
 const relink=await link(restored,other,true,(await row(restored,former.linkRecord.id)).version);
 assert.equal(relink.linkRecord.id,former.linkRecord.id);assert.equal(relink.linkRecord.created_at,former.linkRecord.created_at);
 assert.notEqual((await row(restored,active.linkRecord.id)).deleted_at,null);
 assert.equal((await restored.query('update public.cc_records set payload=payload where id=$1 and version=$2 returning id',[child,oldVersion])).rows.length,0);
 assert.deepEqual(await row(restored,task),taskBefore);
 await actor(restored,i.b,i.sb);assert.equal(await row(restored,child),undefined);await assert.rejects(restored.query(snapshotSql),/Active private project sign-in/);
 await administrator(restored);const foreignSession=randomUUID();await restored.query('insert into auth.sessions values($1,$2)',[foreignSession,i.b]);await actor(restored,i.b,foreignSession);
 assert.deepEqual((await restored.query(snapshotSql)).rows[0].result,{projects:[],relationships:[],tasks:[],memberships:[]});
});
