import test from 'node:test';
import assert from 'node:assert/strict';
import {enabledFavoritePages,defaultFavorites,validateFavoritePages,favoritePageChanges} from '../src/private-favorites.mjs';
import {createFavoritesPanel} from '../src/private-favorites-panel.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';

const id='540fb908-c8c9-4e0a-a8c7-ade4caeb6793';
const layout={version:1,collections:[{id,name:'Weekend'}],pages:[{page:'work',collections:[id]},{page:'brief',collections:[]}]};
test('Favorites allow fixed local pages, unique collection names and valid memberships',()=>{
 assert.deepEqual(enabledFavoritePages({}),['brief']);
 assert.deepEqual(enabledFavoritePages({allowWidgetLayouts:true,allowWidgetPages:true}),['brief','curation','work','personal','home','school','finances']);
 assert.deepEqual(validateFavoritePages(layout),layout);
 for(const patch of [{url:'https://example.test'},{collections:[{id,name:'a\nb'}]},{collections:[{id,name:' Weekend '}]},{pages:[{page:'__proto__',collections:[]}]},{pages:[{page:'https://example.test',collections:[]}]},{pages:[{page:'work',collections:[id,id]}]},{collections:[]},{collections:[...layout.collections,{id:'ee2f6297-3600-421e-aea8-c34f0b2a4f77',name:'weekend'}]}])assert.throws(()=>validateFavoritePages({...layout,...patch}));
 assert.deepEqual(favoritePageChanges(defaultFavorites(),layout),['Create collection “Weekend”','Favorite Daily Brief','Favorite Work','Add Work to “Weekend”']);
});
test('owner reviews favorite page collections before saving and stale tabs cannot overwrite edits',async t=>{
 const f=privateWorkspaceFixture(t,{allowFavorites:true,allowWidgetLayouts:true,allowWidgetPages:true}),a=f.tab(),b=f.tab();
 await assert.rejects(a.client.favoritesRead());await a.login();await b.login();
 const first=await a.client.favoritesRead(),old=await b.client.favoritesRead();
 assert.deepEqual(first.layout,defaultFavorites());
 await assert.rejects(a.client.favoritesReview({baseTag:first.baseTag,layout:{...layout,pages:[{page:'notes',collections:[]}]}}));
 const r=await a.client.favoritesReview({baseTag:first.baseTag,layout});
 assert.deepEqual((await b.client.favoritesRead()).layout,defaultFavorites());
 assert.deepEqual((await a.client.favoritesSave(r.reviewId)).layout,layout);
 await assert.rejects(a.client.favoritesSave(r.reviewId));
 await assert.rejects(b.client.favoritesReview({baseTag:old.baseTag,layout}));
 const current=await b.client.favoritesRead(),renamed={...layout,collections:[{id,name:'Weekly planning'}]};
 const rename=await b.client.favoritesReview({baseTag:current.baseTag,layout:renamed});
 await b.client.favoritesSave(rename.reviewId);assert.deepEqual((await a.client.favoritesRead()).layout,renamed);
 const view=await a.client.favoritesRead(),ungrouped={...layout,collections:[],pages:layout.pages.map(p=>({...p,collections:[]}))};
 const removal=await a.client.favoritesReview({baseTag:view.baseTag,layout:ungrouped});
 await a.client.favoritesCancel();await assert.rejects(a.client.favoritesSave(removal.reviewId));
 const again=await a.client.favoritesRead(),confirmed=await a.client.favoritesReview({baseTag:again.baseTag,layout:ungrouped});
 await a.client.favoritesSave(confirmed.reviewId);assert.deepEqual((await b.client.favoritesRead()).layout,ungrouped);
 const off=privateWorkspaceFixture(t).tab();await off.login();await assert.rejects(off.client.favoritesRead());
});
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const click=(panel,action,extra={})=>panel.click({target:{closest:()=>({dataset:{favoriteAction:action,...extra}})}});
const text=(panel,field,value)=>panel.input({target:{dataset:{favoriteField:field},value}});
function panelWith(client,clock=Date.now){
 return createFavoritesPanel({client,clock,canUse:()=>true,onChange:()=>{},activePage:'work',pages:['brief','work'],idFactory:()=>id});
}
test('panel uses verified saved links, discards late owner replies and expires private collection names',async t=>{
 let finish,now=100,reads=0;
 const panel=panelWith({favoritesRead:()=>{reads++;return new Promise(r=>{finish=r;});}},()=>now);
 t.after(()=>panel.reset());
 const result={viewId:'x'.repeat(43),baseTag:'y'.repeat(43),readOnly:false,layout:{...layout,collections:[{id,name:'<My collection>'}]},expiresAt:1500};
 click(panel,'open');panel.reset();finish(result);await turn();assert.doesNotMatch(panel.render(),/collection|dev-work/);
 click(panel,'open');finish(result);await turn();assert.match(panel.render(),/href="\/dev-work.html"/);assert.match(panel.render(),/&lt;My collection&gt;/);assert.doesNotMatch(panel.render(),/<My collection>/);
 now=1501;click(panel,'manage');assert.doesNotMatch(panel.render(),/My collection/);assert.match(panel.render(),/Fetch latest/);assert.equal(reads,2);
});
test('unconfirmed Favorites save retains the draft and requires a fresh read before another review',async t=>{
 const now=Date.now(),view={viewId:'v'.repeat(43),baseTag:'t'.repeat(43),expiresAt:now+100000,readOnly:false,layout:defaultFavorites()};
 let writes=0,lastReview;
 const panel=panelWith({favoritesRead:async()=>view,favoritesReview:async({layout})=>(lastReview={layout,expiresAt:view.expiresAt,reviewId:'r'.repeat(43)}),favoritesSave:async()=>{writes++;throw Error();}},()=>now);
 t.after(()=>panel.reset());click(panel,'open');await turn();click(panel,'current');text(panel,'new','Weekly planning');click(panel,'add');
 panel.input({target:{dataset:{favoriteField:'member',page:'work',collection:id},checked:true}});
 click(panel,'review');await turn();assert.deepEqual(lastReview.layout.pages,[{page:'work',collections:[id]}]);assert.match(panel.render(),/Approve and save/);
 click(panel,'approve');click(panel,'approve');await turn();assert.equal(writes,1);assert.match(panel.render(),/could not be confirmed/);assert.match(panel.render(),/Weekly planning/);
 click(panel,'review');click(panel,'approve');assert.equal(writes,1);click(panel,'refresh');await turn();assert.doesNotMatch(panel.render(),/Weekly planning/);
});
test('canvas pages read is scoped and omits collection labels and tokens without cancelling an owner review',async t=>{
 const f=privateWorkspaceFixture(t,{allowFavorites:true,allowWidgetLayouts:true,allowWidgetPages:true}),tab=f.tab();
 await assert.rejects(tab.client.favoriteWidgetPages());await tab.login();
 assert.deepEqual((await tab.client.favoriteWidgetPages()).pages,[]);
 const view=await tab.client.favoritesRead(),r=await tab.client.favoritesReview({baseTag:view.baseTag,layout});
 assert.deepEqual((await tab.client.favoriteWidgetPages()).pages,[]);await tab.client.favoritesSave(r.reviewId);
 const pages=await tab.client.favoriteWidgetPages();assert.deepEqual(Object.keys(pages).sort(),['expiresAt','pages','readOnly']);assert.deepEqual(pages.pages,['work','brief']);assert.equal(pages.readOnly,true);
 const off=privateWorkspaceFixture(t).tab();await off.login();await assert.rejects(off.client.favoriteWidgetPages());
});
test('visible Favorites widgets share a sparse source with independent limits and retire titles on expiry, offline, or owner change',async t=>{
 const {createFavoriteWidgetSource}=await import('../src/private-favorites-panel.mjs');
 const {defaultWidgetLayouts}=await import('../src/private-widget-layout.mjs');
 const {renderPrivateCuration}=await import('../src/private-curation-canvas.mjs');
 let now=100,online=true,finish,reads=0;const pages=['work','brief','calendar'];
 const source=createFavoriteWidgetSource({client:{favoriteWidget:()=>{reads++;return new Promise(r=>{finish=r;});}},openers:{},pages,clock:()=>now,onChange:()=>{},isOnline:()=>online});
 t.after(()=>source.reset());const layouts=defaultWidgetLayouts();const wide={type:'favorites',id:'wide-favs',width:'full',hidden:false,filter:'all',limit:2};
 layouts.desktop=[wide,{...wide,id:'all-favs',title:'All shortcuts',limit:4}];
 const render=()=>renderPrivateCuration({layouts,expiresAt:5000,now,renderList:assert.fail,favoritesRenderer:source.render});
 const value={readOnly:true,filter:'all',incomplete:false,pages,items:[],itemCount:0,expiresAt:1000};
 source.show([]);assert.equal(reads,0);source.show(['all']);source.show(['all']);assert.equal(reads,1);assert.match(render(),/Loading Favorites/);
 finish(value);await turn();assert.match(render(),/Showing 2 of 3 favorites/);assert.equal((render().match(/href="\/dev-calendar.html"/g)||[]).length,1);
 now=1100;assert.match(render(),/expired/);assert.doesNotMatch(render(),/dev-work.html/);
 source.refresh('all');finish({...value,expiresAt:3000,pages:['other']});await turn();assert.match(render(),/unavailable/);
 source.refresh('all');const older=finish;source.changed();finish({...value,expiresAt:3000,pages:[]});await turn();older({...value,expiresAt:3000});await turn();assert.match(render(),/No favorites in this view/);
 source.refresh('all');source.reset();finish({...value,expiresAt:3000});await turn();assert.doesNotMatch(render(),/dev-work.html/);online=false;assert.match(render(),/Offline/);
});
test('favorite notes retain the original through renames, cancel stale approvals and remove collection memberships atomically',async t=>{
 const f=privateWorkspaceFixture(t,{allowFavorites:true,allowNoteRead:true,allowNoteEdit:true,allowRecentlyDeleted:true});
 const tab=f.tab(),other=f.tab();await tab.login();await other.login();const a=tab.client,b=other.client;
 const first=await a.favoritesRead(),collections={...defaultFavorites(),collections:[{id,name:'Weekend'}]};
 await a.favoritesSave((await a.favoritesReview({baseTag:first.baseTag,layout:collections})).reviewId);
 const seed=(await a.brief()).notes[0],v=await a.favoriteNoteRead(seed.noteToken);
 assert.equal(v.title,seed.title);assert.equal(v.favorite,false);assert.deepEqual(v.collections,collections.collections);
 await assert.rejects(b.favoriteNoteRead(seed.noteToken));await assert.rejects(a.favoriteNoteReview({baseTag:v.baseTag,favorite:true,members:['not a collection']}));
 const r=await a.favoriteNoteReview({baseTag:v.baseTag,favorite:true,members:[id]});
 assert.deepEqual((await b.favoriteNotesList(0)).notes,[]);await a.favoriteNoteSave(r.reviewId);await assert.rejects(a.favoriteNoteSave(r.reviewId));
 const favorites=await b.favoriteNotesList(0);assert.equal(favorites.count,1);assert.deepEqual(favorites.notes[0].collections,['Weekend']);
 assert.deepEqual(Object.keys(favorites.notes[0]).sort(),['collections','noteToken','title']);
 const key=favorites.notes[0].noteToken,original=await b.readNote(key);
 const selected=await a.favoriteNoteRead(seed.noteToken),obsolete=await a.favoriteNoteReview({baseTag:selected.baseTag,favorite:false,members:[]});
 const renamed=await b.reviewNote({noteToken:key,title:'Renamed original',body:original.body});await b.saveNote(renamed.reviewId);
 await assert.rejects(a.favoriteNoteSave(obsolete.reviewId));await assert.rejects(b.readNote(key));
 const after=await a.favoriteNotesList(0);assert.equal(after.notes[0].title,'Renamed original');assert.equal((await a.readNote(after.notes[0].noteToken)).body,original.body);
 const pages=await b.favoritesRead(),drop=await b.favoritesReview({baseTag:pages.baseTag,layout:defaultFavorites()});await b.favoritesSave(drop.reviewId);
 const ungrouped=(await a.favoriteNotesList(0)).notes[0];assert.deepEqual(ungrouped.collections,[]);
 const info=await a.favoriteNoteRead(ungrouped.noteToken);assert.equal(info.favorite,true);assert.deepEqual(info.members,[]);
 const updated=(await b.brief()).notes[0];const remove=await b.reviewRecord(updated.recordToken);await b.saveRecord(remove.reviewId);
 const hidden=await a.favoriteNotesList(0);assert.equal(hidden.count,0);assert.deepEqual(hidden.notes,[]);await assert.rejects(a.readNote(ungrouped.noteToken));
 const off=privateWorkspaceFixture(t,{allowFavorites:true}).tab();await off.login();await assert.rejects(off.client.favoriteNotesList(0));
});
test('adding a short-lived original to a longer note view cannot extend its effective deadline',async t=>{
 const {createPrivateNoteReader}=await import('../server/private-note-reader.mjs');let now=100;
 const row={id,owner_id:id,household_id:null,visibility:'private',section:'Personal Life',item_type:'note',version:1,deleted_at:null,payload:{fictional:true,title:'A',body:'B'}};
 const reader=createPrivateNoteReader({api:{getPrivateNote:async()=>[row]},now:()=>now});t.after(()=>reader.dispose());
 reader.begin('view',id,900,20)(row);const short=reader.add('view',id,200,row);
 assert.equal(reader.selection('view',id,short.noteToken).expiresAt,200);assert.equal((await reader.read('view',{ownerId:id},short.noteToken)).expiresAt,200);
 now=201;await assert.rejects(reader.read('view',{ownerId:id},short.noteToken));
});
test('favorite tasks follow the original through reviewed completion, stay separate from notes, and can be unfavorited',async t=>{
 const f=privateWorkspaceFixture(t,{allowFavorites:true,allowTaskRead:true,allowTaskCompletion:true,allowNoteRead:true}),tab=f.tab(),other=f.tab();
 await tab.login();await other.login();const a=tab.client,b=other.client,first=await a.favoritesRead();
 await a.favoritesSave((await a.favoritesReview({baseTag:first.baseTag,layout:{...defaultFavorites(),collections:[{id,name:'Weekend'}]}})).reviewId);
 const brief=await a.brief(),task=brief.dueTasks[0],note=brief.notes[0];assert.ok(task.taskReadToken);assert.ok(task.completionToken);
 await assert.rejects(a.favoriteTaskRead(note.noteToken));await assert.rejects(a.favoriteNoteRead(task.taskReadToken));await assert.rejects(b.favoriteTaskRead(task.taskReadToken));
 const v=await a.favoriteTaskRead(task.taskReadToken),r=await a.favoriteTaskReview({baseTag:v.baseTag,favorite:true,members:[id]});
 await a.favoriteTaskSave(r.reviewId);assert.deepEqual((await b.favoriteNotesList(0)).notes,[]);
 const list=await b.favoriteTasksList(0),item=list.tasks[0];assert.deepEqual(Object.keys(item).sort(),['collections','taskReadToken','title']);assert.deepEqual(item.collections,['Weekend']);assert.equal((await b.readTask(item.taskReadToken)).completed,false);
 await a.approveCompletion((await a.reviewCompletion(task.completionToken)).reviewId);await assert.rejects(b.readTask(item.taskReadToken));
 const updated=(await b.favoriteTasksList(0)).tasks[0];assert.equal((await b.readTask(updated.taskReadToken)).completed,true);
 const settings=await b.favoriteTaskRead(updated.taskReadToken);assert.equal(settings.favorite,true);assert.deepEqual(settings.members,[id]);
 const remove=await b.favoriteTaskReview({baseTag:settings.baseTag,favorite:false,members:[]});await b.favoriteTaskSave(remove.reviewId);assert.equal((await a.favoriteTasksList(0)).count,0);
 assert.equal((await b.readTask(updated.taskReadToken)).completed,true);
});
test('named collection filtering excludes other and inaccessible originals before counting and paging',async t=>{
 const {randomUUID}=await import('node:crypto'),{createPrivateFavoriteNotes}=await import('../server/private-favorite-records.mjs');
 const {createPrivateNoteReader}=await import('../server/private-note-reader.mjs'),{makeBriefPreferencesRecord}=await import('../src/dev-preferences-model.mjs');
 const owner=randomUUID(),other=randomUUID(),windowId=randomUUID(),second=randomUUID(),stamp=new Date().toISOString();
 const collections=[{id:windowId,name:'Week planning'},{id:second,name:'Archive'}];
 const rows=Array.from({length:54},(_,i)=>({id:randomUUID(),owner_id:i===53?other:owner,household_id:null,visibility:'private',section:'Personal Life',item_type:'note',version:1,deleted_at:null,payload:{fictional:true,title:'Note '+String(i).padStart(2,'0'),body:'Original '+i}}));
 const prefs={...makeBriefPreferencesRecord({},owner),id:randomUUID(),version:1,created_at:stamp,updated_at:stamp,deleted_at:null};
 Object.assign(prefs.payload,{favorites:{version:1,pages:[],collections},favoriteItems:{version:1,items:rows.map((row,i)=>({type:'note',id:row.id,collections:[i===52?second:windowId]}))}});
 const api={listBriefPreferences:async()=>[structuredClone(prefs)],updateBriefPreferences:assert.fail,addBriefPreferences:assert.fail,
  listPrivateBriefRecords:async()=>rows.map(r=>({...r,payload:{fictional:true,title:r.payload.title}})),getPrivateNote:async(_token,id)=>rows.filter(r=>r.id===id)};
 const reader=createPrivateNoteReader({api}),service=createPrivateFavoriteNotes({api,now:Date.now,selectedReader:()=>reader,inventoryReader:reader});t.after(()=>{service.dispose();reader.dispose();});
 const who={ownerId:owner},list=(offset,collection)=>service.list('favs',who,Date.now()+300000,offset,()=>true,collection);
 const initial=await list(0,windowId);assert.deepEqual(initial.collection,collections[0]);assert.equal(initial.count,52);assert.equal(initial.notes.length,50);
 const remaining=await list(50,windowId);assert.deepEqual(remaining.notes.map(v=>v.title),['Note 50','Note 51']);assert.equal((await reader.read('favs',who,remaining.notes[1].noteToken)).body,'Original 51');
 assert.equal((await list(0,second)).count,1);assert.equal((await list(0)).count,53);
 await assert.rejects(list(0,randomUUID()));collections[0].name='Week ahead';assert.equal((await list(0,windowId)).collection.name,'Week ahead');
});
test('favorite projects can be chosen in management and reopen their current original through the read-only project view',async t=>{
 const app=privateWorkspaceFixture(t,{allowFavorites:true,allowProjects:true,allowNoteRead:true}),one=app.tab(),two=app.tab();await one.login();await two.login();
 const a=one.client,b=two.client,filter={query:'',section:'Work',status:'all',offset:0};
 const original={title:'Study project',section:'Work',status:'Active',description:'Original description',separateRecurring:false};
 await a.projectsList(filter);await a.projectsSave((await a.projectsReview({action:'create',fields:original})).reviewId);
 const key=(await a.projectsList(filter)).projects[0].projectToken,selected=await a.favoriteProjectRead(key);
 assert.equal(selected.title,original.title);await assert.rejects(b.favoriteProjectRead(key));
 await a.favoriteProjectSave((await a.favoriteProjectReview({baseTag:selected.baseTag,favorite:true,members:[]})).reviewId);
 let p=(await b.favoriteProjectsList(0)).projects[0];
 assert.equal(p.projectStatus,'Active');assert.equal(p.section,'Work');assert.equal(p.title,original.title);
 assert.doesNotMatch(JSON.stringify(p),/description|owner_id|recordId|projectToken/);
 assert.equal((await b.readSearchProject(p.projectReadToken)).description,original.description);
 assert.equal((await b.favoriteProjectRead(p.projectReadToken)).favorite,true);
 const editor=(await a.projectsList(filter)).projects[0].projectToken;
 await a.projectsSave((await a.projectsReview({action:'edit',projectToken:editor,fields:{...original,title:'Renamed project',status:'Completed'}})).reviewId);
 await assert.rejects(b.readSearchProject(p.projectReadToken));p=(await b.favoriteProjectsList(0)).projects[0];assert.equal(p.title,'Renamed project');assert.equal(p.projectStatus,'Completed');
 const current=await b.favoriteProjectRead(p.projectReadToken);await b.favoriteProjectSave((await b.favoriteProjectReview({baseTag:current.baseTag,favorite:false,members:[]})).reviewId);
 assert.equal((await a.favoriteProjectsList(0)).count,0);assert.equal((await a.projectsList(filter)).projects[0].title,'Renamed project');
 const off=privateWorkspaceFixture(t,{allowFavorites:true}).tab();await off.login();await assert.rejects(off.client.favoriteProjectsList(0));
});
test('favorite calendar originals retain all-day and multi-day details without granting an edit token',async t=>{
 const app=privateWorkspaceFixture(t,{allowFavorites:true,allowCalendarWorkspace:true,allowCalendarDayRead:true,allowEventCreate:true,allowEventEdit:true,allowEventDetails:true,allowAllDayEvents:true,allowEventRanges:true,allowSearch:true,allowSearchDates:true});
 const one=app.tab(),two=app.tab();await one.login();await two.login();const a=one.client,b=two.client;
 const day='2026-11-23',fields={title:'Study weekend',day,time:'00:00',end_time:'',end_day:'2026-11-25',all_day:true,location:'Library',description:'Read the assignment',calendarCategory:'Study'};
 await a.createEvent((await a.reviewNewEvent(fields)).reviewId);
 const matches=await a.calendarDayList({day:'2026-11-24',query:'Study weekend',offset:0});
 const original=matches.events[0];assert.ok(original.eventReadToken);
 const v=await a.favoriteEventRead(original.eventReadToken),r=await a.favoriteEventReview({baseTag:v.baseTag,favorite:true,members:[]});await a.favoriteEventSave(r.reviewId);
 const entries=await b.favoriteEventsList(0),item=entries.events[0];assert.deepEqual(Object.keys(item).sort(),['allDay','collections','day','eventReadToken','time','title']);
 assert.equal(item.allDay,true);const view=await b.openFavoriteEvent(item.eventReadToken);
 assert.equal(view.readOnly,true);for(const [k,value] of Object.entries(fields))assert.equal(view[k],value);
 await assert.rejects(a.openFavoriteEvent(item.eventReadToken));await assert.rejects(b.readEventEdit(item.eventReadToken));
 await assert.rejects(b.reviewEventEdit({...fields,editToken:item.eventReadToken,title:'Attempt'}));
 const current=await b.favoriteEventRead(item.eventReadToken);assert.equal(current.favorite,true);
 const normal=await a.calendar({query:'Study weekend',type:'event',section:'Calendar',status:'all',dateFrom:day,dateTo:'2026-11-25',offset:0});
 const normalKey=normal.results[0].eventEditToken;
 const changes=await a.reviewEventEdit({...fields,editToken:normalKey,all_day:false,time:'09:30',end_day:'',end_time:'10:00',title:'Library appointment'});
 await a.saveEventEdit(changes.reviewId);await assert.rejects(b.openFavoriteEvent(item.eventReadToken));
 const latest=(await b.favoriteEventsList(0)).events[0];assert.equal(latest.allDay,false);assert.equal(latest.time,'09:30');assert.equal(latest.title,'Library appointment');
 const timed=await b.openFavoriteEvent(latest.eventReadToken);assert.equal(timed.end_time,'10:00');assert.equal(timed.location,'Library');
});

test('widget choices reopen all four original types and recheck the signed-in owner, area and current membership',async t=>{
 const fixture=privateWorkspaceFixture(t,{allowFavorites:true,allowWidgetLayouts:true,allowWidgetPages:true,allowNoteRead:true,allowNoteEdit:true,
  allowTaskRead:true,allowProjects:true,allowEventCreate:true,allowEventEdit:true,allowEventDetails:true});
 const a=fixture.tab(),b=fixture.tab();
 await assert.rejects(a.client.favoriteWidget('all'));await a.login();await b.login();
 const client=a.client;
 const pageSettings=await client.favoritesRead();
 await client.favoritesSave((await client.favoritesReview({baseTag:pageSettings.baseTag,layout})).reviewId);
 const brief=await client.brief(),task=brief.dueTasks[0],note=brief.notes[0],event=brief.eventsToday[0];
 const filter={query:'',section:'Work',status:'all',offset:0};
 const fields={title:'Study project',section:'Work',status:'Active',description:'Project source',separateRecurring:false};
 await client.projectsList(filter);await client.projectsSave((await client.projectsReview({action:'create',fields})).reviewId);
 const project=(await client.projectsList(filter)).projects[0];
 for(const [name,key] of [['Note',note.noteToken],['Task',task.taskReadToken],['Project',project.projectToken],['Event',event.eventEditToken]]){
  const selected=await client['favorite'+name+'Read'](key);
  await client['favorite'+name+'Save']((await client['favorite'+name+'Review']({baseTag:selected.baseTag,favorite:true,members:[id]})).reviewId);
 }
 const inventory=await client.favoriteWidget('all');
 assert.deepEqual(inventory.pages,['work','brief']);assert.equal(inventory.itemCount,4);
 assert.deepEqual(inventory.items.map(item=>item.type).sort(),['event','note','project','task']);
 assert.ok(inventory.items.every(item=>Object.keys(item).sort().join(',')==='choice,title,type'));
 assert.doesNotMatch(JSON.stringify(inventory),/Weekend|description|recordId|Token|approved/);
 const work=await client.favoriteWidget('Work');
 assert.deepEqual(work.pages,['work']);assert.ok(work.items.some(item=>item.type==='project'));assert.ok(work.items.every(item=>['task','project'].includes(item.type)));
 const find=type=>inventory.items.find(item=>item.type===type).choice;
 const open=type=>client.favoriteWidgetSelect({filter:'all',choice:find(type)});
 await assert.rejects(b.client.favoriteWidgetSelect({filter:'all',choice:find('note')}));
 await assert.rejects(client.favoriteWidgetSelect({filter:'Work',choice:find('project')}));
 await assert.rejects(client.readNote(find('note')));
 const noteSelection=await open('note'),original=await client.readNote(noteSelection.row.noteToken);
 assert.equal(original.title,note.title);assert.equal((await client.readTask((await open('task')).row.taskReadToken)).title,task.title);
 assert.equal((await client.readSearchProject((await open('project')).row.projectReadToken)).description,fields.description);
 const eventSelection=await open('event');
 assert.equal((await client.openFavoriteEvent(eventSelection.row.eventReadToken)).title,event.title);
 await assert.rejects(client.readEventEdit(eventSelection.row.eventReadToken));
 const other=(await b.client.favoriteTasksList(0)).tasks[0],change=await b.client.favoriteTaskRead(other.taskReadToken);
 await b.client.favoriteTaskSave((await b.client.favoriteTaskReview({baseTag:change.baseTag,favorite:false,members:[]})).reviewId);
 await assert.rejects(open('task'));
 const otherNote=(await b.client.favoriteNotesList(0)).notes[0];
 await b.client.saveNote((await b.client.reviewNote({noteToken:otherNote.noteToken,title:'Renamed favorite',body:original.body})).reviewId);
 await assert.rejects(open('note'));
 const refreshed=await client.favoriteWidget('all');
 assert.equal(refreshed.itemCount,3);assert.ok(refreshed.items.some(item=>item.title==='Renamed favorite'));
 await assert.rejects(open('project'));
 const disabled=privateWorkspaceFixture(t,{allowFavorites:true,allowNoteRead:true}).tab();
 await disabled.login();await assert.rejects(disabled.client.favoriteWidget('all'));
});

test('widget openings discard stale selections and mismatched originals and respect each visible area and item limit',async t=>{
 const {createFavoriteWidgetSource}=await import('../src/private-favorites-panel.mjs');
 const choice='w'.repeat(43),noteToken='n'.repeat(43),reads=[],opened=[];
 let finish,allowed=true,online=true;
 const client={
  favoriteWidget:async filter=>{reads.push(filter);return {readOnly:true,filter,incomplete:false,pages:[],items:[{type:'note',choice,title:'Plan <one>'}],itemCount:1,expiresAt:1000};},
  favoriteWidgetSelect:()=>new Promise(resolve=>{finish=resolve;})
 };
 const source=createFavoriteWidgetSource({client,pages:[],clock:()=>100,onChange:()=>{},isOnline:()=>online,canOpen:()=>allowed,openers:{note:(...args)=>opened.push(args)}});
 t.after(()=>source.reset());source.show(['all','Work','all']);await turn();assert.deepEqual(reads,['all','Work']);
 assert.match(source.render({filter:'all'}),/Plan &lt;one&gt;/);
 const result={readOnly:true,type:'note',row:{title:'Plan <one>',noteToken},expiresAt:1000};
 const first=source.open('all',choice);source.show(['Work']);finish(result);await first;assert.deepEqual(opened,[]);
 await source.open('all',choice);source.show(['Work','all']);await turn();
 const second=source.open('all',choice);allowed=false;finish(result);await second;assert.deepEqual(opened,[]);
 allowed=true;const third=source.open('all',choice);finish({...result,row:{...result.row,title:'Different original'}});await third;assert.deepEqual(opened,[]);
 assert.doesNotMatch(source.render({filter:'all'}),/Plan &lt;one&gt;/);
 await source.refresh('all');const fourth=source.open('all',choice);finish(result);await fourth;assert.deepEqual(opened,[[noteToken,result.row,1000]]);
 online=false;assert.doesNotMatch(source.render({filter:'all'}),/Plan &lt;one&gt;/);
});

test('a capped Favorites widget retains page links during a source outage and expires pending originals',async t=>{
 const {createFavoritesWidget}=await import('../server/private-favorites-widget.mjs');
 const {createFavoriteWidgetSource}=await import('../src/private-favorites-panel.mjs');
 let now=100,fail=false,finish;
 const actor={ownerId:'owner'},context={id:'tab',expiresAt:2000};
 const rows=Array.from({length:15},(_,n)=>({id:String(n),version:1,payload:{title:'Task '+String(n).padStart(2,'0')},section:n<11?'Home':'Work'}));
 const favorites={widgetSnapshotFor:async()=>({pages:['brief','work'],items:rows.map(row=>({type:'task',id:row.id}))})};
 const task={inventory:async()=>{if(fail)throw Error();return rows;},visibleRows:values=>values,widgetOriginal:(_id,_actor,_expiry,_row,current)=>new Promise((resolve,reject)=>{finish=()=>current()?resolve({}):reject(Error('expired'));})};
 const widget=createFavoritesWidget({favorites,services:{task},now:()=>now});t.after(()=>widget.clear(context));
 const list=filter=>widget.list(context,actor,filter,()=>true);
 const all=await list('all'),work=await list('Work');assert.equal(all.itemCount,15);assert.equal(all.items.length,10);
 assert.equal(work.itemCount,4);assert.equal(work.items[0].title,'Task 11');assert.deepEqual(work.pages,['work']);
 const pending=widget.select(context,actor,{choice:work.items[0].choice,filter:'Work'},()=>true);
 await turn();now=2001;finish();await assert.rejects(pending);
 now=3000;context.expiresAt=5000;fail=true;
 const source=createFavoriteWidgetSource({client:{favoriteWidget:list},pages:['brief','work'],openers:{task:assert.fail},isOnline:()=>true,clock:()=>now,onChange:()=>{}});
 t.after(()=>source.reset());source.show(['all']);await turn();
 const html=source.render({filter:'all',limit:2});
 assert.match(html,/dev-dashboard.html/);assert.match(html,/Some favorite items could not be loaded/);assert.doesNotMatch(html,/No favorites in this view|data-favorite-widget-choice/);
 fail=false;await source.refresh('all');const recovered=source.render({filter:'all',limit:2});
 assert.match(recovered,/Showing 2 of 17 favorites/);assert.match(recovered,/Task 00/);assert.doesNotMatch(recovered,/Some favorite items could not be loaded/);
});
