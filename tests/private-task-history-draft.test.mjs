import test from 'node:test';import assert from 'node:assert/strict';import {taskHistoricalTextDraft} from '../src/private-task-history-draft.mjs';
const now=Date.parse('2026-11-20T12:00:00Z');
function historical(){return{readOnly:true,historical:true,expiresAt:now+100000,version:1,operation:'UPDATE',capturedAt:'2026-11-19T12:00:00.000001Z',wasDeleted:false,record:{readOnly:true,expiresAt:now+100000,title:'Earlier fictional task',description:'Earlier exact\n<literal>',day:'2026-11-19',section:'School',priority:'Urgent',completed:true,subtasks:Array.from({length:40},(_,n)=>({title:'Earlier step '+n,done:true})),subtaskCount:80,omittedSubtasks:40}};}
test('task historical text proposal never copies old completion date priority omitted checklist or source authority',()=>{assert.deepEqual(taskHistoricalTextDraft(historical(),{now}),{title:'Earlier fictional task',description:'Earlier exact\n<literal>'});for(const mutate of [v=>v.record.editToken='x'.repeat(43),v=>v.record.title='x'.repeat(141),v=>v.record.description='x'.repeat(10001),v=>v.record.omittedSubtasks=0,v=>v.expiresAt=now,v=>v.capturedAt='invalid',v=>v.version=0]){const invalid=historical();mutate(invalid);assert.throws(()=>taskHistoricalTextDraft(invalid,{now}));}});
test('isolated SQL task text correction uses original approval preserves current lifecycle and captures newer exact history',async t=>{
 const {readFile}=await import('node:fs/promises'),{createIsolatedDevelopmentDatabase,actor,identities:i}=await import('./fixtures/isolated-development-database.mjs'),{createPrivateTaskReader}=await import('../server/private-task-reader.mjs'),{createPrivateTaskEdits}=await import('../server/private-task-edits.mjs');const db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());await db.exec(await readFile(new URL('../supabase/drafts/private_record_versions.sql',import.meta.url),'utf8'));await actor(db,i.a,i.sa);const id='dddddddd-dddd-4ddd-8ddd-dddddddddddd',stamp='2026-11-01T12:00:00.000001Z',row={id,owner_id:i.a,household_id:null,visibility:'private',section:'School',item_type:'task',origin:'PRIVATE_COOKIE_TASK_CREATE',version:1,created_at:stamp,updated_at:stamp,deleted_at:null,payload:{fictional:true,title:'Earlier native task',description:'Earlier exact\n<literal>',day:'2026-11-19',done:true,priority:'Urgent',subtasks:[{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',title:'Earlier step',done:true}],extension:{keep:'Earlier'}}};await db.query('insert into public.cc_records select * from jsonb_populate_record(null::public.cc_records,$1)',[JSON.stringify(row)]);const currentFields={title:'Current native task',description:'Newer exact task description',day:'2026-11-23',done:false,priority:'Normal',subtasks:[{id:'ffffffff-ffff-4fff-8fff-ffffffffffff',title:'Current exact step',done:false,extension:'Retain nested unknown'}],recurrence:{frequency:'weekly',interval:1,anchor:'2026-11-23'},extension:{keep:'Current unknown'}};await db.query("update public.cc_records set section='Work',payload=payload||$1::jsonb where id=$2",[JSON.stringify(currentFields),id]);
 const read=async()=>(await db.query('select to_jsonb(r) r from public.cc_records r where id=$1',[id])).rows.map(v=>v.r),others=async()=>(await db.query('select to_jsonb(r) r from public.cc_records r where id<>$1 order by id',[id])).rows.map(v=>v.r),api={getPrivateTask:read,getPrivateTaskDetails:read,updatePrivateTask:async(_t,record,owner,payload,section)=>(await db.query("update public.cc_records set payload=$1,section=$2 where id=$3 and owner_id=$4 and version=$5 and visibility='private' and household_id is null and deleted_at is null and item_type='task' returning to_jsonb(cc_records) r",[JSON.stringify(payload),section,record.id,owner,record.version])).rows.map(v=>v.r),isPrivateRecordVersionsReady:async()=>(await db.query('select public.cc_private_record_versions_ready() ready')).rows[0].ready,listPrivateRecordVersions:async(_t,record,offset)=>(await db.query('select public.list_private_record_versions($1,$2) p',[record,offset])).rows[0].p,getPrivateRecordVersion:async(_t,record,version)=>(await db.query('select to_jsonb(v) v from public.get_private_record_version($1,$2) v',[record,version])).rows.map(v=>v.v)},reader=createPrivateTaskReader({api,allowRecordHistory:true,allowPriority:true}),edits=createPrivateTaskEdits({api,allowDescription:true,allowSubtasks:true,allowSubtaskTitles:true,allowPriority:true}),viewer={ownerId:i.a,accessToken:'fictional'};t.after(()=>{reader.dispose();edits.dispose();});const current=(await read())[0],beforeOthers=await others(),source=reader.begin('source',i.a,Date.now()+300000)(current).taskReadToken,page=await reader.listVersions('source',viewer,source),past=await reader.readVersion('source',viewer,page.versions[0].historyReadToken),selected=await reader.selectedRecord('source',viewer,source),editToken=edits.begin('editor',i.a,selected.expiresAt)(selected.record).editToken,view=await edits.read('editor',viewer,editToken),text=taskHistoricalTextDraft(past),review=await edits.prepare('editor',viewer,{editToken,...text,day:view.day,section:view.section,priority:view.priority,subtaskStates:view.subtasks.map(v=>v.done),subtaskTitles:view.subtasks.map(v=>v.title)});assert.deepEqual((await read())[0],current);const claim=edits.claim('editor',i.a,review.reviewId);assert.equal(await edits.authorize(claim,viewer),true);assert.deepEqual(await edits.save(claim,viewer),{saved:true});const saved=(await read())[0];assert.equal(saved.payload.title,row.payload.title);assert.equal(saved.payload.description,row.payload.description);for(const key of ['day','done','priority','subtasks','recurrence','extension'])assert.deepEqual(saved.payload[key],current.payload[key]);assert.equal(saved.section,'Work');assert.deepEqual(await others(),beforeOthers);const history=(await db.query('select snapshot,recovery from cc_private.record_versions where record_id=$1',[id])).rows;assert.equal(history.length,2);assert.ok(history.some(v=>v.snapshot.payload.description==='Newer exact task description'&&v.snapshot.payload.done===false));assert.ok(history.every(v=>v.recovery===null));
 const source2=reader.begin('priority-source',i.a,Date.now()+300000)(saved).taskReadToken,page2=await reader.listVersions('priority-source',viewer,source2),earliest=page2.versions.find(v=>v.version===1),past2=await reader.readVersion('priority-source',viewer,earliest.historyReadToken),selected2=await reader.selectedRecord('priority-source',viewer,source2),edit2=edits.begin('priority-editor',i.a,selected2.expiresAt)(selected2.record).editToken,view2=await edits.read('priority-editor',viewer,edit2),fields2=taskHistoricalTextDraft(past2,{includePriority:true}),review2=await edits.prepare('priority-editor',viewer,{editToken:edit2,...fields2,day:view2.day,section:view2.section,subtaskStates:view2.subtasks.map(v=>v.done),subtaskTitles:view2.subtasks.map(v=>v.title)});assert.deepEqual((await read())[0],saved);const claim2=edits.claim('priority-editor',i.a,review2.reviewId);assert.equal(await edits.authorize(claim2,viewer),true);assert.deepEqual(await edits.save(claim2,viewer),{saved:true});const prioritySaved=(await read())[0];assert.equal(prioritySaved.payload.priority,'Urgent');for(const key of ['day','done','subtasks','recurrence','extension'])assert.deepEqual(prioritySaved.payload[key],saved.payload[key]);assert.equal(prioritySaved.section,saved.section);assert.deepEqual(await others(),beforeOthers);const newer=(await db.query('select snapshot,recovery from cc_private.record_versions where record_id=$1',[id])).rows;assert.equal(newer.length,3);assert.ok(newer.some(v=>v.snapshot.version===saved.version&&v.snapshot.payload.priority==='Normal'));assert.ok(newer.every(v=>v.recovery===null));
 async function proposeEarlierDate(currentTask,context){
  const source=reader.begin(context,i.a,Date.now()+300000)(currentTask).taskReadToken;
  const page=await reader.listVersions(context,viewer,source);
  const earlier=await reader.readVersion(context,viewer,page.versions.find(entry=>entry.version===1).historyReadToken);
  const selected=await reader.selectedRecord(context,viewer,source);
  const {editToken}=edits.begin(context,i.a,selected.expiresAt)(selected.record);
  const editor=await edits.read(context,viewer,editToken);
  const date=taskHistoricalTextDraft(earlier,{dueDateOnly:true});
  return edits.prepare(context,viewer,{editToken,title:editor.title,description:editor.description,section:editor.section,priority:editor.priority,...date});
 }
 await assert.rejects(proposeEarlierDate(prioritySaved,'active-series-date'),/recurring chore must keep/);
 assert.deepEqual((await read())[0],prioritySaved);
 await db.query("update public.cc_records set payload=payload-'recurrence' where id=$1",[id]);
 const manual=(await read())[0];
 const dateReview=await proposeEarlierDate(manual,'ordinary-task-date');
 assert.equal(dateReview.day,row.payload.day);
 assert.deepEqual((await read())[0],manual);
 const dateClaim=edits.claim('ordinary-task-date',i.a,dateReview.reviewId);
 assert.equal(await edits.authorize(dateClaim,viewer),true);
 assert.deepEqual(await edits.save(dateClaim,viewer),{saved:true});
 const dateSaved=(await read())[0];
 assert.deepEqual(dateSaved.payload,{...manual.payload,day:row.payload.day});
 assert.equal(dateSaved.section,manual.section);
 assert.deepEqual(await others(),beforeOthers);
 const previous=(await db.query('select snapshot from cc_private.record_versions where record_id=$1',[id])).rows;
 assert.ok(previous.some(entry=>entry.snapshot.version===manual.version&&entry.snapshot.payload.day===manual.payload.day));

 const laterFields={title:'Keep my latest title',description:'Keep my latest description'};
 await db.query('update public.cc_records set payload=payload||$1::jsonb where id=$2',[JSON.stringify(laterFields),id]);
 for(const textField of ['description','title']){
  const current=(await read())[0],context='select-'+textField;
  const chosen=reader.begin(context,i.a,Date.now()+300000)(current).taskReadToken;
  const page=await reader.listVersions(context,viewer,chosen);
  const entry=page.versions.find(version=>version.version===row.version);
  const detail=await reader.readVersion(context,viewer,entry.historyReadToken);
  const patch=taskHistoricalTextDraft(detail,{textField});
  const selected=await reader.selectedRecord(context,viewer,chosen);
  const editToken=edits.begin(context,i.a,selected.expiresAt)(selected.record).editToken;
  const editor=await edits.read(context,viewer,editToken);
  const review=await edits.prepare(context,viewer,{editToken,title:editor.title,description:editor.description,
   day:editor.day,section:editor.section,priority:editor.priority,...patch});
  assert.deepEqual((await read())[0],current);
  const claim=edits.claim(context,i.a,review.reviewId);assert.equal(await edits.authorize(claim,viewer),true);
  assert.deepEqual(await edits.save(claim,viewer),{saved:true});
  const result=(await read())[0];assert.deepEqual(result.payload,{...current.payload,[textField]:row.payload[textField]});
  const capture=await db.query('select snapshot from cc_private.record_versions where record_id=$1 and source_version=$2',[id,current.version]);
  assert.equal(capture.rows.length,1);assert.deepEqual(capture.rows[0].snapshot.payload,current.payload);
 }
 assert.deepEqual(await others(),beforeOthers);

});

test('historical priority copying is explicit, validated and never restores old task lifecycle or omitted checklist',()=>{
 const value=historical();assert.deepEqual(taskHistoricalTextDraft(value,{now,includePriority:true}),{title:value.record.title,description:value.record.description,priority:'Urgent'});assert.equal(Object.hasOwn(taskHistoricalTextDraft(value,{now}),'priority'),false);for(const priority of [undefined,'Unknown','',null]){const v=historical();if(priority===undefined)delete v.record.priority;else v.record.priority=priority;assert.throws(()=>taskHistoricalTextDraft(v,{now,includePriority:true}));}assert.throws(()=>taskHistoricalTextDraft(value,{now,includePriority:'yes'}));
});

test('due-date correction proposes one field and guards an undated or invalid capture',()=>{
 const entry=historical();
 assert.deepEqual(taskHistoricalTextDraft(entry,{now,dueDateOnly:true}),{day:'2026-11-19'});
 entry.record.day='';
 assert.throws(()=>taskHistoricalTextDraft(entry,{now,dueDateOnly:true}),/requires a due date/);
 assert.deepEqual(taskHistoricalTextDraft(entry,{now,dueDateOnly:true,allowUndated:true}),{day:''});
 entry.record.day='2026-02-30';
 assert.throws(()=>taskHistoricalTextDraft(entry,{now,dueDateOnly:true,allowUndated:true}));
 assert.throws(()=>taskHistoricalTextDraft(historical(),{now,includePriority:true,dueDateOnly:true}));
});

test('earlier task title and description can be selected independently of each other and of date or priority',()=>{
 const entry=historical();
 assert.deepEqual(taskHistoricalTextDraft(entry,{now,textField:'title'}),{title:entry.record.title});
 entry.record.title='x'.repeat(180);entry.record.description='';
 assert.deepEqual(taskHistoricalTextDraft(entry,{now,textField:'description'}),{description:''});
 assert.throws(()=>taskHistoricalTextDraft(entry,{now,textField:'title'}));
 for(const options of [{textField:'status'},{textField:'title',dueDateOnly:true},{textField:'description',includePriority:true}]){
  assert.throws(()=>taskHistoricalTextDraft(historical(),{now,...options}));
 }
});
