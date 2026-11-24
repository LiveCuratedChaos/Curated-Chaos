import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createIsolatedDevelopmentDatabase,actor,administrator,identities as i} from './fixtures/isolated-development-database.mjs';

const sql=await readFile(new URL('../supabase/drafts/private_widget_source_associations.sql',import.meta.url),'utf8');
const alias='0f9f1b7a-5d5d-4f89-a910-21e1aaf8dd61',projectAlias='40a1b2c3-4d5e-4f60-8123-abcdefabcdef',layoutId='10a1b2c3-4d5e-4f60-8123-abcdefabcdef';
async function setup(t){const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());await db.exec(sql);return db;}

test('widget aliases resolve only to current owned note/project rows and never enter settings as source IDs',async t=>{
 const db=await setup(t),noteId='20a1b2c3-4d5e-4f60-8123-abcdefabcdef',projectId='30a1b2c3-4d5e-4f60-8123-abcdefabcdef';
 await actor(db,i.a,i.sa);
 await db.query("insert into public.cc_records(id,owner_id,section,item_type,origin,payload) values($1,$2,'Personal Life','note','M2B_DEV_NOTES',$3),($4,$2,'Work','project','PRIVATE_COOKIE_PROJECT',$5),($6,$2,'Personal Life','dashboard_layout','M2B_DEV_WIDGETS',$7)",[noteId,i.a,JSON.stringify({fictional:true,title:'Private note',body:'Private body'}),projectId,JSON.stringify({fictional:true,schemaVersion:1,title:'Private project',status:'Active'}),layoutId,JSON.stringify({fictional:true,source:'M2B_DEV_WIDGETS',layoutVersion:1,layouts:{desktop:[{id:'note-widget',type:'notes',sourceAssociationId:alias},{id:'project-widget',type:'projects',sourceAssociationId:projectAlias}],tablet:[],phone:[]}})]);
 await assert.rejects(db.query('select * from cc_private.widget_source_associations'));
 assert.deepEqual((await db.query('select * from public.cc_resolve_widget_source_association($1)',[alias])).rows,[]);
 const note=(await db.query('select public.cc_set_widget_source_association($1,$2,$3,$4,$5,$6) result',[alias,noteId,'note',layoutId,1,1])).rows[0].result;
 assert.deepEqual(note,{associationId:alias,saved:true});
 await assert.rejects(db.query("select public.cc_set_widget_source_association($1,$2,'project',$3,1,1)",[alias,projectId,layoutId]),/not current/);
 await db.query("select public.cc_set_widget_source_association($1,$2,'project',$3,1,1)",[projectAlias,projectId,layoutId]);
 await assert.rejects(db.query("select public.cc_set_widget_source_association($1,$2,'note',$3,2,1)",[alias,noteId,layoutId]),/not current/);
 const resolved=(await db.query('select * from public.cc_resolve_widget_source_association($1)',[alias])).rows[0];
 assert.equal(resolved.record_id,noteId);assert.equal(resolved.item_type,'note');
 const resolvedProject=(await db.query('select * from public.cc_resolve_widget_source_association($1)',[projectAlias])).rows[0];assert.equal(resolvedProject.record_id,projectId);assert.equal(resolvedProject.item_type,'project');
 const settings=(await db.query('select payload from public.cc_records where id=$1',[layoutId])).rows[0].payload;
 assert.match(JSON.stringify(settings),new RegExp(alias));assert.match(JSON.stringify(settings),new RegExp(projectAlias));assert.doesNotMatch(JSON.stringify(settings),new RegExp(noteId));assert.doesNotMatch(JSON.stringify(settings),new RegExp(projectId));
 await db.query('update public.cc_records set deleted_at=statement_timestamp() where id=$1',[noteId]);
 assert.deepEqual((await db.query('select * from public.cc_resolve_widget_source_association($1)',[alias])).rows,[]);
 await actor(db,i.b,i.sb);
 assert.deepEqual((await db.query('select * from public.cc_resolve_widget_source_association($1)',[alias])).rows,[]);
});

test('aliases cannot bind foreign, shared, deleted, wrong-type or unreferenced records',async t=>{
 const db=await setup(t),otherAlias='40a1b2c3-4d5e-4f60-8123-abcdefabcdef',noteId='20a1b2c3-4d5e-4f60-8123-abcdefabcdef';
 await actor(db,i.a,i.sa);
 await db.query("insert into public.cc_records(id,owner_id,section,item_type,origin,payload) values($1,$2,'Personal Life','note','M2B_DEV_NOTES',$3),($4,$2,'Personal Life','dashboard_layout','M2B_DEV_WIDGETS',$5)",[noteId,i.a,JSON.stringify({fictional:true,title:'Private note',body:'Private body'}),layoutId,JSON.stringify({fictional:true,source:'M2B_DEV_WIDGETS',layoutVersion:1,layouts:{desktop:[],tablet:[],phone:[]}})]);
 await assert.rejects(db.query('select public.cc_set_widget_source_association($1,$2,\'note\',$3,1,1)',[otherAlias,noteId,layoutId]),/not current/);
 await db.query("update public.cc_records set payload=jsonb_set(payload,'{layouts,desktop}','[{\"id\":\"note-widget\",\"type\":\"notes\",\"sourceAssociationId\":\""+otherAlias+"\"}]'::jsonb) where id=$1",[layoutId]);
 await assert.rejects(db.query("select public.cc_set_widget_source_association($1,$2,'project',$3,2,1)",[otherAlias,noteId,layoutId]),/not current/);
 await db.query('update public.cc_records set deleted_at=statement_timestamp() where id=$1',[noteId]);
 await assert.rejects(db.query("select public.cc_set_widget_source_association($1,$2,'note',$3,2,1)",[otherAlias,noteId,layoutId]),/Current private note or project/);
});

test('foreign and shared sources cannot be associated even when their IDs and titles are known',async t=>{
 const db=await setup(t),foreignId='50a1b2c3-4d5e-4f60-8123-abcdefabcdef',sharedId='60a1b2c3-4d5e-4f60-8123-abcdefabcdef',foreignAlias='70a1b2c3-4d5e-4f60-8123-abcdefabcdef',sharedAlias='80a1b2c3-4d5e-4f60-8123-abcdefabcdef';
 await administrator(db);
 await db.query("insert into public.cc_records(id,owner_id,section,item_type,origin,payload) values($1,$2,'Personal Life','note','M2B_DEV_NOTES',$3),($4,$5,'Personal Life','dashboard_layout','M2B_DEV_WIDGETS',$6)",[foreignId,i.b,JSON.stringify({fictional:true,title:'Foreign note',body:'Private'}),layoutId,i.a,JSON.stringify({fictional:true,source:'M2B_DEV_WIDGETS',layoutVersion:1,layouts:{desktop:[{id:'foreign-note',type:'notes',sourceAssociationId:foreignAlias},{id:'shared-note',type:'notes',sourceAssociationId:sharedAlias}],tablet:[],phone:[]}})]);
 await db.query("insert into public.cc_records(id,owner_id,household_id,visibility,section,item_type,origin,payload) values($1,$2,$3,'household','Personal Life','note','M2B_DEV_NOTES',$4)",[sharedId,i.a,i.home,JSON.stringify({fictional:true,title:'Shared note',body:'Private'})]);
 await actor(db,i.a,i.sa);
 await assert.rejects(db.query("select public.cc_set_widget_source_association($1,$2,'note',$3,1,1)",[foreignAlias,foreignId,layoutId]),/Current private note or project/);
 await assert.rejects(db.query("select public.cc_set_widget_source_association($1,$2,'note',$3,1,1)",[sharedAlias,sharedId,layoutId]),/Current private note or project/);
 await administrator(db);
 assert.equal((await db.query('select count(*)::int n from cc_private.widget_source_associations')).rows[0].n,0);
});
