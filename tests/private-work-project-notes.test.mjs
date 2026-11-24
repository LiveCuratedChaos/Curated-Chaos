import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createPrivateProjectPanel} from '../src/private-project-panel.mjs';
import {createProjectNoteApi} from '../src/private-project-note-api.mjs';
import {identities as ids,actor,createIsolatedDevelopmentDatabase} from './fixtures/isolated-development-database.mjs';
import {validatePrivateWorkspaceRows} from '../server/private-workspace-backup.mjs';
const full={title:'Project original',section:'Work',status:'Planned',description:'Original private details',separateRecurring:true};
const list={section:'Work',status:'all',query:'Project original',offset:0};
async function setup(t){
 const app=privateWorkspaceFixture(t,{allowProjects:true,allowNoteRead:true,allowNoteCreate:true,allowNoteEdit:true}),one=app.tab(),two=app.tab();await one.login();await two.login();
 const a=one.client,b=two.client;await a.projectsList(list);const p=await a.projectsReview({action:'create',fields:full});await a.projectsSave(p.reviewId);
 const open=async c=>{const chosen=(await c.projectsList(list)).projects.find(p=>p.title===full.title);return c.projectsRead(chosen.projectToken);};
 const choices=(c,projectToken,linkedOnly=false)=>c.projectNotes({projectToken,linkedOnly,query:'',offset:0});
 return {a,b,open,choices};
}
test('private Work note links require approval, open the same original, survive ordinary edits, and unlink without editing the note',async t=>{
 const {a,b,open,choices}=await setup(t);let project=await open(a);
 let page=await choices(a,project.projectToken);assert.ok(page.notes.length);assert.doesNotMatch(JSON.stringify(page),/body|owner_id|noteId/);
 let entry=page.notes[0],args={projectToken:project.projectToken,choice:entry.choice};assert.equal(entry.linked,false);
 await assert.rejects(a.readProjectNote(args));await assert.rejects(b.reviewProjectNote({...args,linked:true}));
 let r=await a.reviewProjectNote({...args,linked:true});const before=await open(b);assert.equal((await choices(b,before.projectToken,true)).total,0);
 project=(await a.projectsSave(r.reviewId)).project;await assert.rejects(a.projectsSave(r.reviewId));assert.doesNotMatch(JSON.stringify(project),/noteIds/);
 page=await choices(a,project.projectToken,true);assert.equal(page.total,1);const content=await a.readProjectNote({projectToken:project.projectToken,choice:page.notes[0].choice});assert.equal(content.title,entry.title);assert.equal(typeof content.body,'string');
 r=await a.projectsReview({action:'edit',projectToken:project.projectToken,fields:{...full,status:'Active'}});await a.projectsSave(r.reviewId);
 project=await open(a);page=await choices(a,project.projectToken,true);assert.equal(page.total,1);
 r=await a.reviewProjectNote({projectToken:project.projectToken,choice:page.notes[0].choice,linked:false});project=(await a.projectsSave(r.reviewId)).project;
 assert.equal((await choices(a,project.projectToken,true)).total,0);assert.equal((await choices(a,project.projectToken)).notes.find(n=>n.title===entry.title).linked,false);
});
test('a competing change to the Work original prevents the stale link and the API excludes unselected note bodies',async t=>{
 const {a,b,open,choices}=await setup(t),project=await open(a),page=await choices(a,project.projectToken);
 const r=await a.reviewProjectNote({projectToken:project.projectToken,choice:page.notes[0].choice,linked:true});
 const other=await open(b),edit=await b.projectsReview({action:'edit',projectToken:other.projectToken,fields:{...full,description:'Changed by owner'}});await b.projectsSave(edit.reviewId);
 await assert.rejects(a.projectsSave(r.reviewId));assert.equal((await choices(b,(await open(b)).projectToken,true)).total,0);
 let query;const api=createProjectNoteApi(async url=>{query=new URL(url,'http://fixture.test').searchParams;return [];});await api.listProjectNoteTitles('test',ids.a);
 assert.doesNotMatch(query.get('select'),/body|\*/);assert.equal(query.get('owner_id'),'eq.'+ids.a);assert.equal(query.get('visibility'),'eq.private');
});
test('project editor browses linked notes, explicitly reviews link or unlink and reads original note text',async t=>{
 const {a}=await setup(t),panel=createPrivateProjectPanel({client:a,allowProjectNotes:true});t.after(()=>panel.dispose());
 const turn=()=>new Promise(r=>setImmediate(r));
 async function click(selector,dataset={}){panel.click({target:{closest:q=>q===selector?{dataset}:null}});await turn();}
 const note=workNote=>click('[data-work-note]',{workNote});await click('#private-projects-open');
 const choice=panel.render().match(/data-private-project="([^"]+)"[^>]*>[^<]*<\/button>/);
 assert.ok(choice);await click('[data-private-project]',{privateProject:choice[1]});assert.match(panel.render(),/Manage project notes/);
 await note('open');assert.match(panel.render(),/No linked notes/);await note('all');
 const first=panel.render().match(/data-work-note="(review-[^"]+)"/)[1];await note(first);assert.match(panel.render(),/Approve note link/);await note('save');
 assert.match(panel.render(),/Note linked/);await note(panel.render().match(/data-work-note="(read-[^"]+)"/)[1]);assert.match(panel.render(),/class="private-note-body"/);
 await note('back');await note(panel.render().match(/data-work-note="(review-[^"]+)"/)[1]);await note('save');assert.match(panel.render(),/Note unlinked/);
});
test('isolated SQL binds both versions and owner, detaches a removed source and preserves the original project and note fields',async t=>{
 const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());await actor(db,ids.a,ids.sa);
 const ins=async(owner,section,type,origin,payload)=>(await db.query('insert into public.cc_records(owner_id,section,item_type,origin,payload) values($1,$2,$3,$4,$5) returning *',[owner,section,type,origin,JSON.stringify(payload)])).rows[0];
 const project=await ins(ids.a,'Work','project','PRIVATE_COOKIE_PROJECT',{fictional:true,schemaVersion:1,title:'Target',description:'Keep',status:'Active'});
 const note=await ins(ids.a,'Personal Life','note','PRIVATE_COOKIE_NOTE_CREATE',{fictional:true,title:'Notes',body:'Keep original text',source:'M0C_DEV_LOGIN_TEST'});
 const link=(pv,nv,enabled)=>(db.query('select public.cc_set_work_project_note($1,$2,$3,$4,$5) as p',[project.id,pv,note.id,nv,enabled]));
 await actor(db,ids.b,ids.sb);await assert.rejects(link(1,1,true));await actor(db,ids.a,ids.sa);
 let changed=(await link(1,1,true)).rows[0].p;assert.deepEqual(changed.payload.noteIds,[note.id]);assert.equal(changed.version,2);await assert.rejects(link(1,1,true));
 const archivedNote=(await db.query('select to_jsonb(n) as row from public.cc_records n where id=$1',[note.id])).rows[0].row;
 const key=randomBytes(32);assert.equal(validatePrivateWorkspaceRows([archivedNote,changed],ids.a,key).length,2);
 assert.throws(()=>validatePrivateWorkspaceRows([changed],ids.a,key));assert.throws(()=>validatePrivateWorkspaceRows([{...note,owner_id:ids.b},changed],ids.a,key));
 await db.query("update public.cc_records set payload=jsonb_set(payload,'{body}',to_jsonb('Later'::text)) where id=$1",[note.id]);await assert.rejects(link(2,1,false));
 await db.query('update public.cc_records set deleted_at=now() where id=$1',[note.id]);
 const after=(await db.query('select * from public.cc_records where id=$1',[project.id])).rows[0];assert.equal(after.version,3);assert.equal(after.payload.noteIds,undefined);assert.equal(after.payload.description,'Keep');
 await db.query('update public.cc_records set deleted_at=null where id=$1',[note.id]);assert.equal((await db.query('select payload from public.cc_records where id=$1',[project.id])).rows[0].payload.noteIds,undefined);
});
