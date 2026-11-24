// Complete executor/repository workflow on fictional embedded PostgreSQL only.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createIsolatedDevelopmentDatabase,actor,administrator,identities as i} from './fixtures/isolated-development-database.mjs';
import {readFile} from 'node:fs/promises';
import {createPrivateSavedSearches} from '../server/private-saved-searches.mjs';
import {createPrivateWorkspaceRestoreRepository} from '../server/private-workspace-restore-repository.mjs';
import {createPrivateWorkspaceRestoreExecutor} from '../server/private-workspace-restore-executor.mjs';
import {sealPrivateWorkspace} from '../server/private-workspace-backup.mjs';
import {privateWorkspaceRestoreDigest as digest} from '../server/private-workspace-restore-contract.mjs';
const projectRef='fictionalrecovery',key=Buffer.alloc(32,4);
const record=(patch={})=>({id:randomUUID(),owner_id:i.a,household_id:null,visibility:'private',section:'Personal Life',item_type:'note',origin:'PRIVATE_COOKIE_NOTE_CREATE',version:8,created_at:'2026-11-01T12:00:00.123456Z',updated_at:'2026-11-02T12:00:00.234567Z',deleted_at:null,payload:{fictional:true,title:'Fictional recovered note',body:'Exact\n<literal>',source:'M0C_DEV_LOGIN_TEST'},...patch});
async function setup(t,{allowArchivedDeletedRestore=false}={}){const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());const repository=createPrivateWorkspaceRestoreRepository({projectRef,allowArchivedDeletedRestore,verifyTarget:async(connection,ref)=>connection===db&&ref===projectRef,withConnection:async(who,callback)=>{await actor(db,who.owner,who.session);return callback(db);}}),who={owner:i.a,session:i.sa};const executor=createPrivateWorkspaceRestoreExecutor({repository,projectRef,key,allowArchivedDeletedRestore,resolveActor:async a=>({ownerId:a.owner,sessionBinding:a.session,expiresAt:Date.now()+600000}),authorizeWrite:async()=>true});t.after(()=>executor.dispose());return{db,repository,executor,who};}
const seal=rows=>sealPrivateWorkspace({projectRef,ownerId:i.a,key,rows}).bytes;
test('atomic authenticated SQL restore preserves original microseconds, contents and revisions without touching existing records',async t=>{
 const s=await setup(t),rows=[record(),record({item_type:'task',origin:'PRIVATE_COOKIE_TASK_CREATE',section:'Home',payload:{fictional:true,title:'Fictional recovered undated task',day:null,done:false,source:'M0D_DEV_BRIEF_TEST',priority:'Normal',description:'Preserve task text',subtasks:[{id:randomUUID(),title:'Preserve step',done:true}]}}),record({item_type:'project',section:'Work',origin:'PRIVATE_COOKIE_PROJECT',payload:{fictional:true,schemaVersion:1,title:'Fictional recovered project',description:'Preserve project text',status:'On hold',separateRecurring:true}})];
 const before=await s.repository.readPrivateRows(s.who,i.a),review=await s.executor.prepare(s.who,{bytes:seal(rows)});assert.equal(review.insertCount,3);assert.equal(review.canRestore,true);
 const result=await s.executor.execute(s.who,{reviewId:review.reviewId,approved:true});assert.equal(result.restored,3);const after=await s.repository.readPrivateRows(s.who,i.a);assert.equal(digest(after),digest([...before,...rows]));
 await actor(s.db,i.b,i.sb);assert.equal((await s.db.query('select id from public.cc_records where id=any($1::uuid[])',[rows.map(r=>r.id)])).rows.length,0);
});
test('database rollback undoes insertion and trigger side effects before failed verification can commit',async t=>{
 const s=await setup(t),before=await s.repository.readPrivateRows(s.who,i.a),untouched=before[0];await administrator(s.db);
 await s.db.exec("create function public.fictional_restore_side_effect() returns trigger language plpgsql security invoker as $$begin if new.origin='PRIVATE_COOKIE_NOTE_CREATE' then update public.cc_records set payload=payload||'{\"fictionalSideEffect\":true}'::jsonb where id='"+untouched.id+"';end if;return new;end$$;create trigger fictional_restore_side_effect after insert on public.cc_records for each row execute function public.fictional_restore_side_effect();");
 const row=record(),review=await s.executor.prepare(s.who,{bytes:seal([row])});await assert.rejects(s.executor.execute(s.who,{reviewId:review.reviewId,approved:true}),/Inspect current copies/);assert.equal(digest(await s.repository.readPrivateRows(s.who,i.a)),digest(before));
});
test('current metadata changed after review refuses transaction before insertion and preserves the newer edit',async t=>{
 const s=await setup(t),before=await s.repository.readPrivateRows(s.who,i.a),row=record(),review=await s.executor.prepare(s.who,{bytes:seal([row])});await actor(s.db,i.a,i.sa);await s.db.query("update public.cc_records set payload=payload||'{\"newerEdit\":true}'::jsonb where id=$1",[before[0].id]);const edited=await s.repository.readPrivateRows(s.who,i.a);
 await assert.rejects(s.executor.execute(s.who,{reviewId:review.reviewId,approved:true}),/stopped before insertion/);assert.equal(digest(await s.repository.readPrivateRows(s.who,i.a)),digest(edited));
});
test('repository refuses administrator connections, foreign owners and expired sessions',async t=>{
 const s=await setup(t);await administrator(s.db);const admin=createPrivateWorkspaceRestoreRepository({projectRef,verifyTarget:async()=>true,withConnection:async(_,callback)=>callback(s.db)});await assert.rejects(admin.readPrivateRows({},i.a),/Authenticated archive owner/);
 await assert.rejects(s.repository.readPrivateRows(s.who,i.b),/Authenticated archive owner/);await assert.rejects(s.repository.readPrivateRows({...s.who,session:randomUUID()},i.a),/Authenticated archive owner/);
});
test('an absent or mismatched destination verifier refuses even an otherwise authorized connection',async t=>{
 const s=await setup(t);await actor(s.db,i.a,i.sa);
 for(const verifyTarget of [undefined,async()=>false,async()=>({matches:true})]){const repo=createPrivateWorkspaceRestoreRepository({projectRef,withConnection:async(_,callback)=>callback(s.db),...(verifyTarget?{verifyTarget}:{})});await assert.rejects(repo.readPrivateRows(s.who,i.a),/target could not be verified/);}
});
test('transaction handles expire after callback and database adapter uses a conflicting bounded table lock',async t=>{
 const s=await setup(t);let leaked,mode;
 await s.repository.withLockedWorkspace(s.who,i.a,async tx=>{leaked=tx;mode=(await s.db.query("select mode from pg_locks where relation='public.cc_records'::regclass and mode='ShareRowExclusiveLock' and granted")).rows;});
 assert.equal(mode.length,1);assert.throws(()=>leaked.readPrivateRows(),/ended/);await assert.rejects(leaked.insertMany([]),/ended/);
 assert.equal((await s.db.query("select count(*)::int n from pg_locks where relation='public.cc_records'::regclass and mode='ShareRowExclusiveLock' and granted")).rows[0].n,0);
});

test('encrypted recovery restores a Work project with new or already-present exact note originals in one transaction',async t=>{
 const s=await setup(t),note=record(),work=record({item_type:'project',section:'Work',origin:'PRIVATE_COOKIE_PROJECT',
  payload:{fictional:true,schemaVersion:1,title:'Work with notes',description:'Keep',status:'Active',noteIds:[note.id]}});
 const archive=[work,note],r=await s.executor.prepare(s.who,{bytes:seal(archive)});
 assert.equal(r.canRestore,true);assert.equal((await s.executor.execute(s.who,{reviewId:r.reviewId,approved:true})).restored,2);
 let restored=await s.repository.readPrivateRows(s.who,i.a);
 assert.equal(digest(restored.filter(v=>v.id===work.id)),digest([work]));assert.equal(digest(restored.filter(v=>v.id===note.id)),digest([note]));
 const another={...work,id:randomUUID(),payload:{...work.payload,title:'Second project'}};
 const second=await s.executor.prepare(s.who,{bytes:seal([another,note])});assert.equal(second.insertCount,1);
 assert.equal((await s.executor.execute(s.who,{reviewId:second.reviewId,approved:true})).restored,1);
 restored=await s.repository.readPrivateRows(s.who,i.a);assert.equal(restored.filter(v=>v.id===note.id).length,1);
 assert.deepEqual(restored.find(v=>v.id===another.id).payload.noteIds,[note.id]);assert.throws(()=>seal([another]));
});

test('restored first routine occurrence completes using its original monthly anchor',async t=>{
 const s=await setup(t),day='2028-01-31',expected='2028-02-29',schedule={anchorDay:day,frequency:'monthly',interval:1};
 const row=record({item_type:'task',section:'Home',origin:'PRIVATE_COOKIE_TASK_CREATE'});
 row.payload={fictional:true,title:'Fictional month-end grocery check',day,done:false,source:'M0D_DEV_BRIEF_TEST',homeGrocery:{quantity:'',favorite:false},recurrence:{...schedule,seriesId:row.id,ordinal:0}};
 const review=await s.executor.prepare(s.who,{bytes:seal([row])});assert.equal(review.canRestore,true);
 assert.equal((await s.executor.execute(s.who,{reviewId:review.reviewId,approved:true})).restored,1);
 const current=(await s.repository.readPrivateRows(s.who,i.a)).find(item=>item.id===row.id);assert.deepEqual(current.payload,row.payload);
 const today=(await s.db.query("select to_char(now() at time zone 'America/New_York','YYYY-MM-DD') as day")).rows[0].day;
 const {nextTaskOccurrence}=await import('../src/task-recurrence.mjs');
 const next=nextTaskOccurrence({schedule,currentDueDay:day,completedOn:today});if(today<=day)assert.equal(next.day,expected);
 const values=[row.id,current.version,JSON.stringify(schedule),next.day,today,randomUUID(),randomUUID()];
 const result=(await s.db.query('select public.cc_complete_recurring_chore($1,$2,$3::jsonb,$4::date,$5::date,$6,$7) as result',values)).rows[0].result;
 assert.equal(result.nextRecord.payload.recurrence.seriesId,row.id);assert.equal(result.nextRecord.payload.day,next.day);
 assert.deepEqual(result.nextRecord.payload.homeGrocery,row.payload.homeGrocery);
});

test('encrypted recovery restores exact named Work, document, course and program searches without saving results',async t=>{
 const s=await setup(t);
 const items=[
  {type:'task',section:'Work',query:'follow up',status:'open',dateFrom:'',dateTo:'',priority:'all',dateStatus:'all'},
  {type:'document-text',query:'Fictional course hours'},
  {type:'document-library',query:'',collection:'pdf'},
  ...['school-course','school-program'].map(type=>({type,section:'School',query:'leadership',status:'all',dateFrom:'',dateTo:'',priority:'all',dateStatus:'all'}))
 ].map((filters,index)=>record({item_type:'saved_search',origin:'PRIVATE_COOKIE_SAVED_SEARCH',payload:{source:'PRIVATE_SAVED_SEARCH_V1',schemaVersion:1,fictional:true,title:'Saved view '+index,filters}}));
 const r=await s.executor.prepare(s.who,{bytes:seal(items)});assert.equal(r.canRestore,true);assert.equal((await s.executor.execute(s.who,{reviewId:r.reviewId,approved:true})).restored,items.length);
 const actual=(await s.repository.readPrivateRows(s.who,i.a)).filter(row=>items.some(item=>item.id===row.id));assert.equal(digest(actual),digest(items));
 const again=await s.executor.prepare(s.who,{bytes:seal(items)});assert.equal(again.insertCount,0);
 for(const payload of [{...items[1].payload,results:['Private file text']},{...items[1].payload,filters:{...items[1].payload.filters,choice:'old choice'}}]){
  const invalid=await s.executor.prepare(s.who,{bytes:seal([record({item_type:'saved_search',origin:'PRIVATE_COOKIE_SAVED_SEARCH',payload})])});assert.equal(invalid.canRestore,false);
 }
});

test('a restored completed Work routine replays its original approval and advances only its current occurrence',async t=>{
 const source=await setup(t),dest=await setup(t);
 const {nextTaskOccurrence}=await import('../src/task-recurrence.mjs');
 const day='2024-01-31',schedule={anchorDay:day,interval:1,frequency:'monthly'};
 const first=record({section:'Work',item_type:'task',origin:'PRIVATE_COOKIE_TASK_CREATE'});
 first.payload={fictional:true,source:'M0D_DEV_BRIEF_TEST',title:'Review the month',description:'Keep this original text',day,done:false,recurrence:{...schedule,seriesId:first.id,ordinal:0}};
 const seed=await source.executor.prepare(source.who,{bytes:seal([first])});await source.executor.execute(source.who,{approved:true,reviewId:seed.reviewId});
 const today=(await source.db.query("select to_char(now() at time zone 'America/New_York','YYYY-MM-DD') as day")).rows[0].day;
 const next=nextTaskOccurrence({schedule,currentDueDay:day,completedOn:today});
 const args=[first.id,first.version,JSON.stringify(schedule),next.day,today,randomUUID(),randomUUID()];
 const run=(s,values)=>s.db.query('select public.cc_complete_recurring_chore($1,$2,$3::jsonb,$4::date,$5::date,$6,$7) as result',values).then(r=>r.rows[0].result);
 await run(source,args);
 const series=(await source.repository.readPrivateRows(source.who,i.a)).filter(r=>r.payload.recurrence?.seriesId===first.id);
 assert.equal(series.length,2);const start=series.find(r=>r.id===first.id),end=series.find(r=>r.id!==first.id);
 for(const invalid of [[start],[end],[start,{...end,payload:{...end.payload,recurrence_predecessor:randomUUID()}}],[{...start,payload:{...start.payload,recurrence_completion:{...start.payload.recurrence_completion,baseVersion:start.version}}},end]]){
  const blocked=await dest.executor.prepare(dest.who,{bytes:seal(invalid)});assert.equal(blocked.canRestore,false);
 }
 const review=await dest.executor.prepare(dest.who,{bytes:seal(series)});assert.equal(review.canRestore,true);assert.equal((await dest.executor.execute(dest.who,{reviewId:review.reviewId,approved:true})).restored,2);
 const recovered=(await dest.repository.readPrivateRows(dest.who,i.a)).filter(r=>r.payload.recurrence?.seriesId===first.id);assert.equal(digest(recovered),digest(series));
 const replay=await run(dest,args);assert.equal(replay.alreadySaved,true);assert.equal(replay.nextRecord.id,end.id);
 const after=nextTaskOccurrence({schedule,currentDueDay:end.payload.day,completedOn:today});
 const resumed=await run(dest,[end.id,end.version,JSON.stringify(schedule),after.day,today,randomUUID(),randomUUID()]);
 assert.equal(resumed.alreadySaved,false);assert.equal(resumed.nextRecord.payload.recurrence.seriesId,first.id);assert.equal(resumed.nextRecord.payload.recurrence_predecessor,end.id);assert.equal(resumed.nextRecord.payload.day,after.day);
});

test('stopped and reopened routine history stays exact, and a changed destination member blocks a partial recovery',async t=>{
 const s=await setup(t),series=randomUUID(),successor=randomUUID(),operationId=randomUUID(),schedule={anchorDay:'2025-01-31',frequency:'monthly',interval:1};
 const first=record({id:series,section:'Personal Life',item_type:'task',origin:'PRIVATE_COOKIE_TASK_CREATE',version:4,payload:{
  fictional:true,source:'M0D_DEV_BRIEF_TEST',title:'Monthly review',day:schedule.anchorDay,done:false,status:'Not Started',recurrence:{...schedule,seriesId:series,ordinal:0},
  recurrence_completion:{operationId,successorId:successor,baseVersion:2,schedule,nextDay:'2025-03-31',reviewDay:'2025-03-01'}
 }});
 const stopped=record({id:successor,section:'Personal Life',item_type:'task',origin:'PRIVATE_RECURRING_CHORE',version:3,payload:{
  fictional:true,title:'Monthly review',day:'2025-03-31',done:true,status:'Completed',recurrence:{...schedule,seriesId:series,ordinal:2},recurrence_predecessor:series,recurrenceStopped:true
 }});
 const {restorableRoutineIds}=await import('../server/private-workspace-restore-contract.mjs');
 const check=existing=>restorableRoutineIds({inserts:[stopped],existing,archive:[first,stopped],ownerId:i.a,now:Date.now()});
 assert.ok(check([first]).has(stopped.id));assert.equal(check([{...first,version:5}]).size,0);assert.equal(check([first,{...stopped,id:randomUUID()}]).size,0);
 const bytes=seal([first,stopped]),r=await s.executor.prepare(s.who,{bytes});assert.equal(r.canRestore,true);assert.equal((await s.executor.execute(s.who,{approved:true,reviewId:r.reviewId})).restored,2);
 const restored=(await s.repository.readPrivateRows(s.who,i.a)).filter(row=>row.payload.recurrence?.seriesId===series);
 const {routineProgress}=await import('../server/private-routine-streak.mjs');
 const progress=routineProgress(restored,{owner:i.a,selected:stopped});assert.equal(progress.stopped,true);assert.equal(progress.streak,0);assert.equal(restored.find(row=>row.id===series).payload.done,false);
});

test('encrypted recovery preserves the private profile, presentation settings, and favorite note originals',async t=>{
 const src=await setup(t),dst=await setup(t);
 const {makeBriefPreferencesRecord,readOwnerBriefPreferences}=await import('../src/dev-preferences-model.mjs');
 const {defaultQuickAddLayout}=await import('../src/private-quick-add-layout.mjs');
 const {defaultBriefLayout}=await import('../src/private-brief-layout.mjs');
 const {createPrivateBriefLayout,createPrivateCalendarPresentation,createPrivateQuickAddLayout,createPrivateOnboarding,createPrivateFavorites}=await import('../server/private-brief-layout.mjs');
 const quick=defaultQuickAddLayout();quick.task={destination:'School',expanded:true};
 const brief=defaultBriefLayout();brief.sections.reverse();brief.dateView={mode:'week',range:'rolling',weekStart:1};
 const favorites={version:1,collections:[{id:i.a,name:'Planning'}],pages:[{page:'calendar',collections:[i.a]}]};
 const onboarding={version:1,status:'complete',mode:'quick',step:'review',domains:['finances'],priorities:['budget'],widgets:['budget'],palette:'coastal'};
 const originalTask=record({section:'Work',item_type:'task',origin:'manual-test',payload:{fictional:true,source:'M0D_DEV_BRIEF_TEST',title:'Planning',day:null,done:false}});
 const base=makeBriefPreferencesRecord({palette:'coastal',density:'spacious',hideAmounts:true,textSize:'large',motion:'minimal',completionSound:'off',completionHaptics:'on',categoryColors:{sections:{Work:'warning'},items:{[originalTask.id]:'accent'}}},i.a);
 const originalNote=record({});
 const favoriteItems={version:1,items:[{type:'note',id:originalNote.id,collections:[i.a]},{type:'task',id:originalTask.id,collections:[i.a]}]};
 const settings=record({...base,payload:{...base.payload,briefLayout:brief,calendarPresentation:{schemaVersion:1,monthDisplay:'dots'},quickAddLayout:quick,onboarding,favorites,favoriteItems}});
 const sourceReview=await src.executor.prepare(src.who,{bytes:seal([settings,originalTask,originalNote])});
 assert.equal(sourceReview.canRestore,true);
 await src.executor.execute(src.who,{approved:true,reviewId:sourceReview.reviewId});
 const original=(await src.repository.readPrivateRows(src.who,i.a)).filter(row=>row.id===settings.id);
 const sourceTask=(await src.repository.readPrivateRows(src.who,i.a)).find(row=>row.id===originalTask.id);
 const bytes=seal([...original,sourceTask,(await src.repository.readPrivateRows(src.who,i.a)).find(r=>r.id===originalNote.id)]),review=await dst.executor.prepare(dst.who,{bytes});
 assert.equal(review.canRestore,true);assert.equal((await dst.executor.execute(dst.who,{approved:true,reviewId:review.reviewId})).restored,3);
 const restored=async()=>(await dst.repository.readPrivateRows(dst.who,i.a)).filter(row=>row.item_type==='brief_preferences');
 assert.equal(digest(await restored()),digest(original));
 const preferences=readOwnerBriefPreferences(await restored(),i.a);assert.equal(preferences.preferences.palette,'coastal');assert.equal(preferences.preferences.hideAmounts,true);
 const {withRecordColors}=await import('../server/private-record-color.mjs');
 const recoveredTask=(await dst.repository.readPrivateRows(dst.who,i.a)).find(row=>row.id===originalTask.id);
 assert.equal(withRecordColors(null,preferences.preferences.categoryColors)(recoveredTask).displayColor,'accent');
 assert.deepEqual([preferences.preferences.textSize,preferences.preferences.motion,preferences.preferences.completionSound,preferences.preferences.completionHaptics],['large','minimal','off','on']);
 const api={listBriefPreferences:restored,addBriefPreferences:assert.fail,updateBriefPreferences:assert.fail};
 for(const [create,expected] of [[createPrivateBriefLayout,brief],[createPrivateCalendarPresentation,settings.payload.calendarPresentation],[createPrivateQuickAddLayout,quick],[createPrivateOnboarding,onboarding],[createPrivateFavorites,favorites]]){
  const service=create({api});t.after(()=>service.dispose());
  assert.deepEqual(await service.valueFor({ownerId:i.a}),expected);
 }
 const {createPrivateFavoriteNotes,createPrivateFavoriteTasks}=await import('../server/private-favorite-records.mjs');
 const {createPrivateNoteReader}=await import('../server/private-note-reader.mjs');
 const readRows=()=>dst.repository.readPrivateRows(dst.who,i.a);
 const noteApi={...api,listPrivateBriefRecords:async()=>(await readRows()).map(r=>({...r,payload:{title:r.payload.title,fictional:r.payload.fictional,done:r.payload.done,day:r.payload.day}})),
  getPrivateNote:async(_token,id,owner)=>(await readRows()).filter(r=>r.id===id&&r.owner_id===owner),
  getPrivateTaskDetails:async(_token,id,owner)=>(await readRows()).filter(r=>r.id===id&&r.owner_id===owner)};
 const reader=createPrivateNoteReader({api:noteApi}),service=createPrivateFavoriteNotes({api:noteApi,now:Date.now,selectedReader:()=>reader,inventoryReader:reader});
 t.after(()=>{service.dispose();reader.dispose();});const who={ownerId:i.a};
 const recovered=await service.list('restored',who,Date.now()+300000,0,()=>true);
 assert.deepEqual(recovered.notes.map(r=>[r.title,r.collections]),[[originalNote.payload.title,['Planning']]]);
 assert.equal((await reader.read('restored',who,recovered.notes[0].noteToken)).body,originalNote.payload.body);
 const {createPrivateTaskReader}=await import('../server/private-task-reader.mjs');
 const taskReader=createPrivateTaskReader({api:noteApi,allowUndated:true});
 const tasks=createPrivateFavoriteTasks({api:noteApi,now:Date.now,selectedReader:()=>taskReader,inventoryReader:taskReader,taskOptions:{allowUndated:true}});
 t.after(()=>{tasks.dispose();taskReader.dispose();});
 const taskList=await tasks.list('tasks',who,Date.now()+300000,0,()=>true);
 assert.deepEqual(taskList.tasks.map(r=>[r.title,r.collections]),[['Planning',['Planning']]]);
 assert.equal((await taskReader.read('tasks',who,taskList.tasks[0].taskReadToken)).completed,false);
 assert.equal((await dst.executor.prepare(dst.who,{bytes})).insertCount,0);
 for(const candidate of [[{...settings,id:randomUUID()}],[{...settings,payload:{...settings.payload,palette:'blush'}}]]){
  assert.equal((await dst.executor.prepare(dst.who,{bytes:seal(candidate)})).canRestore,false);
 }
 assert.equal(digest(await restored()),digest(original));
});

test('recovery preserves earlier profile shapes and blocks unsupported or competing settings before any write',async t=>{
 const s=await setup(t);
 const {defaultBriefLayout,validateBriefLayout}=await import('../src/private-brief-layout.mjs');
 const brief={schemaVersion:1,sections:defaultBriefLayout().sections.filter(v=>!['school','bills'].includes(v.id))};
 const row=record({item_type:'brief_preferences',origin:'M1F_QA_SETTINGS',payload:{fictional:true,source:'M1F_QA_SETTINGS',palette:'blush',sources:{email:false},briefLayout:brief}});
 const before=digest(await s.repository.readPrivateRows(s.who,i.a));
 for(const patch of [{palette:'unknown'},{sources:{email:'yes'}},{unexpectedCredential:'discard me'},{briefLayout:{...brief,extra:true}},{quickAddLayout:{}},{categoryColors:{sections:{Outside:'accent'},items:{}}},{onboarding:{status:'complete'}},{favorites:{version:1,pages:[{page:'foreign',collections:[]}],collections:[]}},{favoriteItems:{version:1,items:[{type:'note',id:i.a,collections:[i.a]}]}}]){
  const rejected=await s.executor.prepare(s.who,{bytes:seal([{...row,payload:{...row.payload,...patch}}])});
  assert.equal(rejected.canRestore,false);
 }
 const duplicate=await s.executor.prepare(s.who,{bytes:seal([row,{...row,id:randomUUID()}])});
 assert.equal(duplicate.canRestore,false);assert.equal(digest(await s.repository.readPrivateRows(s.who,i.a)),before);
 const review=await s.executor.prepare(s.who,{bytes:seal([row])});assert.equal(review.canRestore,true);
 await s.executor.execute(s.who,{approved:true,reviewId:review.reviewId});
 const saved=(await s.repository.readPrivateRows(s.who,i.a)).find(r=>r.id===row.id);
 assert.deepEqual(saved.payload,row.payload);assert.equal(validateBriefLayout(saved.payload.briefLayout).sections.length,10);
});

test('recovered tasks with legacy checklist positions can complete and reopen through the original review service',async t=>{
 const {createPrivateTaskCompletion}=await import('../server/private-task-completion.mjs');
 const s=await setup(t),principal={ownerId:i.a},stepId=randomUUID();
 const subtasks=[{title:'Follow up',done:false},{title:'Follow up',done:true},{id:stepId,title:'File notes',done:false}];
 const row=record({item_type:'task',origin:'manual-test',section:'Work',payload:{fictional:true,source:'M0D_DEV_BRIEF_TEST',title:'Follow up on cases',day:null,done:false,status:'In Progress',subtasks}});
 for(const fields of [{status:'Completed'},{status:'Other'},{subtasks:[subtasks[2],{...subtasks[2],id:stepId.toUpperCase()}]},{subtasks:[{id:null,title:'File notes',done:false}]}]){
  const rejected=await s.executor.prepare(s.who,{bytes:seal([{...row,payload:{...row.payload,...fields}}])});assert.equal(rejected.canRestore,false);
 }
 const archivedDone={...row,id:randomUUID(),payload:{...row.payload,status:'Completed',done:true}};
 const bytes=seal([row,archivedDone]),r=await s.executor.prepare(s.who,{bytes});assert.equal(r.canRestore,true);assert.equal((await s.executor.execute(s.who,{approved:true,reviewId:r.reviewId})).restored,2);
 const read=async(_token,id)=>(await s.repository.readPrivateRows(s.who,i.a)).filter(item=>item.id===id);
 assert.equal(digest(await read(null,archivedDone.id)),digest([archivedDone]));
 async function write(token,current,owner,payload){
  await s.db.query('update public.cc_records set payload=$1::jsonb where id=$2 and owner_id=$3 and version=$4',[JSON.stringify(payload),current.id,owner,current.version]);
  return read(token,current.id);
 }
 const api={getPrivateTask:read,completePrivateTask:write,reopenPrivateTask:write};
 for(const reopening of [false,true]){
  const service=createPrivateTaskCompletion({api,allowUndated:true,reopening});t.after(()=>service.dispose());
  const [original]=await read(null,row.id),action=service.begin('restored-task',i.a,Date.now()+300000)(original);
  const review=await service.prepare('restored-task',principal,reopening?action.reopenToken:action.completionToken);
  assert.deepEqual(review.checklist,{total:3,open:2});
  const claimed=service.claim('restored-task',i.a,review.reviewId);assert.equal(await service.authorize(claimed,principal),true);
  const result=await service.complete(claimed,principal);assert.equal(result[reopening?'reopened':'completed'],true);
  const [saved]=await read(null,row.id);assert.equal(saved.payload.status,reopening?'Not Started':'Completed');assert.deepEqual(saved.payload.subtasks,subtasks);
 }
});

test('encrypted recovery reopens the same School program and course from their original favorite collection',async t=>{
 const dst=await setup(t);
 const {makeSchoolCourse,makeSchoolDegree}=await import('../src/dev-school-model.mjs');
 const {makeBriefPreferencesRecord}=await import('../src/dev-preferences-model.mjs');
 const {createPrivateSchoolReader}=await import('../server/private-school-read.mjs');
 const {createPrivateFavoriteSchool}=await import('../server/private-favorite-records.mjs');
 const program=record(makeSchoolDegree(i.a,{title:'Study plan'}));
 const course=record(makeSchoolCourse(i.a,{title:'Study plan',degreeId:program.id,notes:'Original course notes'}));
 const profile=record(makeBriefPreferencesRecord({},i.a)),collection=randomUUID();
 profile.payload.favorites={version:1,pages:[],collections:[{id:collection,name:'This term'}]};
 profile.payload.favoriteItems={version:1,items:[{type:'program',id:program.id,collections:[collection]},{type:'course',id:course.id,collections:[collection]}]};
 const bytes=seal([course,profile,program]),review=await dst.executor.prepare(dst.who,{bytes});
 assert.equal(review.canRestore,true);
 assert.equal((await dst.executor.execute(dst.who,{approved:true,reviewId:review.reviewId})).restored,3);
 assert.equal((await dst.executor.prepare(dst.who,{bytes})).insertCount,0);
 const rows=await dst.repository.readPrivateRows(dst.who,i.a);
 assert.deepEqual(rows.find(row=>row.id===profile.id).payload.favoriteItems,profile.payload.favoriteItems);
 const api={listBriefPreferences:async()=>rows.filter(row=>row.id===profile.id),addBriefPreferences:assert.fail,updateBriefPreferences:assert.fail,
  listPrivateSchoolSummaries:async()=>rows.filter(row=>row.item_type==='school_fixture'),
  getPrivateSchoolRecord:async(_token,id,owner)=>rows.filter(row=>row.id===id&&row.owner_id===owner)};
 const reader=createPrivateSchoolReader({api}),actor={ownerId:i.a};
 t.after(()=>reader.dispose());
 for(const [type,source] of [['program',program],['course',course]]){
  const service=createPrivateFavoriteSchool({api,now:Date.now,inventoryReader:reader},type);
  t.after(()=>service.dispose());
  const list=await service.list('recovered',actor,Date.now()+300000,0,()=>true,collection);
  assert.equal(list.count,1);
  const [item]=list[type+'s'];assert.deepEqual(item.collections,['This term']);
  const selected=await reader.selectedRecord('recovered',actor,item.schoolReadToken);
  assert.equal(selected.id,source.id);assert.deepEqual(selected.payload,source.payload);
 }
});

test('encrypted recovery keeps removed shortcuts out of active search until their own restore is approved',async t=>{
 const s=await setup(t,{allowArchivedDeletedRestore:true}),day=86400000;
 await administrator(s.db);
 await s.db.exec(await readFile(new URL('../supabase/drafts/private_record_restore_window.sql',import.meta.url),'utf8'));
 const filters={type:'school-course',section:'School',query:'leadership',status:'all',dateFrom:'',dateTo:'',priority:'all',dateStatus:'all'};
 const now=Date.now(),shortcuts=[3,91].map(age=>record({
  item_type:'saved_search',origin:'PRIVATE_COOKIE_SAVED_SEARCH',deleted_at:new Date(now-age*day).toISOString(),
  created_at:new Date(now-100*day).toISOString(),updated_at:new Date(now-age*day).toISOString(),
  payload:{source:'PRIVATE_SAVED_SEARCH_V1',schemaVersion:1,fictional:true,title:'Leadership courses',filters}
 }));
 const archive=seal(shortcuts),review=await s.executor.prepare(s.who,{bytes:archive});
 assert.equal(review.canRestore,true);
 assert.equal(review.deletedRecordRestoreCount,1);
 assert.equal((await s.executor.execute(s.who,{reviewId:review.reviewId,approved:true})).restoredDeleted,1);
 const imported=(await s.repository.readPrivateRows(s.who,i.a)).filter(r=>r.item_type==='saved_search');
 assert.equal(digest(imported),digest([shortcuts[0]]));
 const query=async(sql,args)=>(await s.db.query(sql,args)).rows.map(value=>value.row);
 const actor={ownerId:i.a,accessToken:'fictional'},fail=()=>{throw Error('Unexpected shortcut mutation');};
 const service=createPrivateSavedSearches({allowSchool:true,api:{
  listPrivateSavedSearches:(_token,owner,removed)=>query("select to_jsonb(r) row from public.cc_records r where owner_id=$1 and item_type='saved_search' and (deleted_at is not null)=$2",[owner,removed]),
  getPrivateSavedSearch:(_token,id,owner)=>query("select to_jsonb(r) row from public.cc_records r where owner_id=$1 and id=$2 and item_type='saved_search'",[owner,id]),
  setPrivateSavedSearchDeletedAt:(_token,selected,owner,date)=>query('update public.cc_records r set deleted_at=$1 where id=$2 and owner_id=$3 and version=$4 and deleted_at=$5 returning to_jsonb(r) row',[date,selected.id,owner,selected.version,selected.deleted_at]),
  addPrivateSavedSearch:fail,updatePrivateSavedSearch:fail
 }});
 t.after(()=>service.dispose());
 const list=removed=>service.list('fixture',actor,Date.now()+300000,{removed});
 assert.equal((await list(false)).matchCount,0);
 const removed=await list(true);
 assert.equal(removed.matchCount,1);
 assert.equal(removed.records[0].deletedAt,shortcuts[0].deleted_at);
 const proposal=await service.prepare('fixture',actor,{action:'restore',savedSearchToken:removed.records[0].savedSearchToken});
 const claim=service.claim('fixture',i.a,proposal.reviewId);
 assert.equal(await service.authorize(claim,actor),true);
 assert.equal(digest((await s.repository.readPrivateRows(s.who,i.a)).filter(r=>r.item_type==='saved_search')),digest([shortcuts[0]]));
 assert.deepEqual(await service.save(claim,actor),{saved:true,action:'restore'});
 const active=await list(false);
 assert.equal(active.matchCount,1);
 assert.deepEqual(await service.load('fixture',actor,active.records[0].savedSearchToken),{name:'Leadership courses',filters});
 const again=await s.executor.prepare(s.who,{bytes:archive});
 assert.equal(again.canRestore,false);
 assert.equal((await list(true)).matchCount,0);
});
