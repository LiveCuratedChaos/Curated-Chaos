import test from 'node:test';import assert from 'node:assert/strict';import {privateWorkspaceAppearance,unavailablePrivateAppearance} from '../server/private-workspace-appearance.mjs';import {createDevApi} from '../src/dev-api.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',row=()=>({id,owner_id:owner,household_id:null,visibility:'private',deleted_at:null,section:'Personal Life',item_type:'brief_preferences',version:1,payload:{fictional:true,source:'M1F_QA_SETTINGS',palette:'coastal',density:'compact',navigation:{hidden:['home']},secret:'NEVER_RETURN'}});
test('appearance returns only verified display choices, never other preferences or raw identity',()=>{const result=privateWorkspaceAppearance([row()],owner);assert.deepEqual(result,{available:true,hasSavedAppearance:true,palette:'coastal',density:'compact',readOnly:true});assert.doesNotMatch(JSON.stringify(result),/navigation|NEVER_RETURN|bbbbbbbb|owner_id|payload/);});
test('missing preferences use defaults and unavailable reads are explicitly distinguished',()=>{assert.deepEqual(privateWorkspaceAppearance([],owner),{available:true,hasSavedAppearance:false,palette:'neutral',density:'balanced',readOnly:true});assert.equal(unavailablePrivateAppearance().available,false);assert.throws(()=>privateWorkspaceAppearance([],'invalid'));});
test('foreign, shared, deleted, duplicate and unsupported preference rows fail closed',()=>{for(const patch of [{owner_id:id},{household_id:id},{deleted_at:'2026-11-09T12:00:00Z'},{item_type:'note'},{version:0},{payload:{fictional:false}},{id:'invalid'}])assert.throws(()=>privateWorkspaceAppearance([{...row(),...patch}],owner));assert.throws(()=>privateWorkspaceAppearance([row(),row()],owner));});
test('unsupported palette/density values cannot inject appearance attributes',()=>{const record=row();record.payload.palette='javascript:invalid';record.payload.density='invalid';const result=privateWorkspaceAppearance([record],owner);assert.equal(result.palette,'neutral');assert.equal(result.density,'balanced');});
test('appearance API projects only display fields and scope markers behind exact private-owner guards',async()=>{let call;const project='devproject12345',api=createDevApi({supabaseUrl:'https://'+project+'.supabase.co',projectRef:project,publishableKey:'sb_publishable_fictional'},async(url,options)=>{call={url:new URL(url),options};return{ok:true,text:async()=>JSON.stringify([{...row(),payload:undefined,appearance_fictional:true,appearance_source:'M1F_QA_SETTINGS',appearance_palette:'coastal',appearance_density:'compact'}])};});const records=await api.listPrivateAppearance('fictional-token',owner);assert.equal(records[0].payload.palette,'coastal');assert.deepEqual(Object.keys(records[0].payload).sort(),['density','fictional','palette','source']);for(const[key,value]of Object.entries({owner_id:'eq.'+owner,visibility:'eq.private',household_id:'is.null',deleted_at:'is.null',item_type:'eq.brief_preferences',section:'eq.Personal Life',limit:'2'}))assert.equal(call.url.searchParams.get(key),value);assert.equal(call.options.method,undefined);const select=call.url.searchParams.get('select').split(',');assert.ok(!select.includes('payload'));assert.ok(!select.some(field=>/navigation|quiet|amount|body/i.test(field)));await assert.rejects(api.listPrivateAppearance('fixture','invalid'));});

test('reviewed text size and motion persist across signed-in pages and old clients preserve both choices',async t=>{
 const {privateWorkspaceFixture}=await import('./support/private-workspace-fixture.mjs');
 const f=privateWorkspaceFixture(t,{allowBriefRead:true,allowAppearance:true,allowAppearanceSave:true,allowAccessibleAppearance:true});
 const first=f.tab(),other=f.tab();await first.login();await other.login();
 const a=first.client,b=other.client,start=await a.preferences(),stale=await b.preferences();
 assert.deepEqual([start.preferences.textSize,start.preferences.motion],['system','system']);
 assert.equal(start.preferences.completionSound,'off');assert.equal(start.preferences.completionHaptics,'off');
 const next={...start.preferences,textSize:'largest',motion:'minimal',completionHaptics:'on'};
 const reviewed=await a.reviewPreferences({baseTag:start.baseTag,changes:next});
 assert.deepEqual(reviewed.changes.map(change=>change.field).sort(),['completionHaptics','motion','textSize']);
 assert.equal((await a.brief()).appearance.motion,'system');
 const fresh=await a.preferences(),confirm=await a.reviewPreferences({baseTag:fresh.baseTag,changes:next});
 const result=await a.savePreferences(confirm.reviewId);assert.deepEqual(result.preferences,next);
 assert.deepEqual([(await b.brief()).appearance.textSize,(await b.brief()).appearance.motion],['largest','minimal']);
 await assert.rejects(b.reviewPreferences({baseTag:stale.baseTag,changes:{...next,motion:'full'}}));
 const now=await a.preferences();await assert.rejects(a.reviewPreferences({baseTag:now.baseTag,changes:{...next,textSize:'bad'}}));
 const compatible=await a.reviewPreferences({baseTag:now.baseTag,changes:{palette:'blush',density:'compact'}});
 const legacy=await a.savePreferences(compatible.reviewId);assert.equal(legacy.preferences.textSize,'largest');assert.equal(legacy.preferences.motion,'minimal');assert.equal(legacy.preferences.completionHaptics,'on');assert.equal(legacy.preferences.completionSound,'off');
 const closed=privateWorkspaceFixture(t,{allowBriefRead:true,allowAppearance:true,allowAppearanceSave:true}),c=closed.tab();await c.login();
 const original=await c.client.preferences();await assert.rejects(c.client.reviewPreferences({baseTag:original.baseTag,changes:next}));
});

test('accessible appearance selects just the additional text and motion fields from the private record',async()=>{
 let select;
 const api=createDevApi({supabaseUrl:'https://devproject12345.supabase.co',projectRef:'devproject12345',publishableKey:'sb_publishable_fictional'},async url=>{
  select=new URL(url).searchParams.get('select').split(',');
  return{ok:true,text:async()=>JSON.stringify([{...row(),payload:undefined,appearance_fictional:true,appearance_source:'M1F_QA_SETTINGS',appearance_text_size:'large',appearance_motion:'subtle'}])};
 });
 const rows=await api.listPrivateAppearance('fictional-token',owner,{allowAccessibleAppearance:true});
 assert.ok(select.includes('appearance_text_size:payload->textSize')&&select.includes('appearance_motion:payload->motion'));assert.ok(!select.includes('payload'));
 const settings=privateWorkspaceAppearance(rows,owner,{allowAccessibleAppearance:true});assert.equal(settings.textSize,'large');assert.equal(settings.motion,'subtle');
});

test('saved section accents reload through the signed-in Brief and exclude item IDs and private settings',async t=>{
 const {privateWorkspaceFixture}=await import('./support/private-workspace-fixture.mjs');
 const f=privateWorkspaceFixture(t,{allowBriefRead:true,allowAppearance:true,allowAppearanceSave:true,allowAccessibleAppearance:true,allowCategoryColorPreferences:true});
 const tab=f.tab(),other=f.tab();await tab.login();await other.login();
 const initial=await tab.client.preferences();
 const categoryColors={sections:{Work:'warning',Calendar:'positive'},items:{}};
 const review=await tab.client.reviewPreferences({baseTag:initial.baseTag,changes:{...initial.preferences,categoryColors}});
 assert.deepEqual((await other.client.brief()).appearance.sectionColors,{});
 await tab.client.savePreferences(review.reviewId);
 const display=(await other.client.brief()).appearance;
 assert.deepEqual(display.sectionColors,categoryColors.sections);
 assert.doesNotMatch(JSON.stringify(display),/bbbbbbbb|categoryColors|hideAmounts/);
 assert.deepEqual((await tab.client.preferences()).preferences.categoryColors,categoryColors);
});

test('one original task can override its section color, survive other settings changes and return to inheritance',async t=>{
 const {privateWorkspaceFixture}=await import('./support/private-workspace-fixture.mjs');
 const {verifyCurationWidgetSources}=await import('../src/private-curation-sources.mjs');
 const f=privateWorkspaceFixture(t,{allowBriefRead:true,allowAppearance:true,allowAppearanceSave:true,allowCategoryColorPreferences:true,allowTaskRead:true,allowTaskCreate:true,allowTaskCompletion:true,allowWidgetLayouts:true,allowSearch:true});
 const tab=f.tab(),other=f.tab();await tab.login();await other.login();const client=tab.client,title='Two equal Work titles';
 const initial=await client.preferences();
 await assert.rejects(client.reviewPreferences({baseTag:initial.baseTag,changes:{...initial.preferences,categoryColors:{sections:{},items:{[id]:'warning'}}}}));
 const chosen=await client.reviewPreferences({baseTag:initial.baseTag,changes:{...initial.preferences,categoryColors:{sections:{Work:'warning'},items:{}}}});
 await client.savePreferences(chosen.reviewId);
 const day=(await client.brief()).day;
 for(let i=0;i<2;i++){const r=await client.reviewNewTask({title,day,section:'Work'});await client.createTask(r.reviewId);}
 const browse=()=>client.search({query:title,type:'task',section:'Work',status:'all'});
 const rows=(await browse()).results;assert.equal(rows.length,2);
 const token=rows[0].taskReadToken,original=await client.readTask(token);
 const start=await client.itemColor(token);assert.equal(start.itemColor,'section');assert.equal(start.sectionColor,'warning');
 const pending=await client.reviewPreferences({baseTag:start.baseTag,itemColorToken:token,changes:{itemColor:'positive'}});
 assert.deepEqual(pending.changes,[{field:'itemColor',before:'section',after:'positive'}]);
 assert.equal((await client.itemColor(token)).itemColor,'section');
 const ack=await client.savePreferences(pending.reviewId);assert.equal(ack.itemColor,'positive');assert.deepEqual(ack.preferences.categoryColors.items,{});
 const reread=await client.readTask(token);assert.deepEqual(reread,original);
 const refresh=await browse();assert.deepEqual(refresh.results.map(r=>r.displayColor??'section').sort(),['positive','section']);
 const brief=await client.brief();verifyCurationWidgetSources(brief.widgetSources);
 assert.equal(brief.dueTasks.filter(r=>r.title===title&&r.displayColor==='positive').length,1);
 const prefs=await client.preferences(),edit=await client.reviewPreferences({baseTag:prefs.baseTag,changes:{...prefs.preferences,categoryColors:{sections:{Work:'accent'},items:{}}}});
 assert.doesNotMatch(JSON.stringify(edit),/[0-9a-f]{8}-[0-9a-f]{4}-/);await client.savePreferences(edit.reviewId);
 const current=(await browse()).results.find(r=>r.displayColor==='positive'),currentView=await client.itemColor(current.taskReadToken);
 assert.equal(currentView.sectionColor,'accent');
 const stale=await client.reviewPreferences({baseTag:currentView.baseTag,itemColorToken:current.taskReadToken,changes:{itemColor:'warning'}});
 await browse();await assert.rejects(client.savePreferences(stale.reviewId));
 const selected=(await browse()).results.find(r=>r.displayColor==='positive'),view=await client.itemColor(selected.taskReadToken);
 const themeDefault=await client.reviewPreferences({baseTag:view.baseTag,itemColorToken:selected.taskReadToken,changes:{itemColor:'inherit'}});
 assert.equal((await client.savePreferences(themeDefault.reviewId)).itemColor,'inherit');
 const afterDefault=(await browse()).results;
 assert.deepEqual(afterDefault.map(r=>r.displayColor??'section').sort(),['inherit','section']);
 const override=afterDefault.find(r=>r.displayColor==='inherit'),overrideView=await client.itemColor(override.taskReadToken);
 assert.equal(overrideView.sectionColor,'accent');
 const remove=await client.reviewPreferences({baseTag:overrideView.baseTag,itemColorToken:override.taskReadToken,changes:{itemColor:'section'}});
 assert.equal((await client.savePreferences(remove.reviewId)).itemColor,'section');
 assert.ok((await browse()).results.every(r=>r.displayColor===undefined));
 await assert.rejects(other.client.itemColor(override.taskReadToken));
});

test('original note and calendar colors survive reload across lists, month and the selected day',async t=>{
 const {privateWorkspaceFixture}=await import('./support/private-workspace-fixture.mjs');
 const {calendarWorkspaceFields,calendarMonthOverview,verifyCalendarWorkspaceList}=await import('../src/private-calendar-workspace.mjs');
 const {verifyNoteWorkspaceList}=await import('../src/private-note-workspace.mjs');
 const {verifyCalendarDay}=await import('../src/private-calendar-day.mjs');
 const fixture=privateWorkspaceFixture(t,{allowAppearance:true,allowAppearanceSave:true,allowCategoryColorPreferences:true,
  allowSearch:true,allowSearchDates:true,allowNoteRead:true,allowEventCreate:true,allowEventEdit:true,
  allowEventDetails:true,allowCalendarWorkspace:true,allowCalendarDayRead:true});
 const tab=fixture.tab(),other=fixture.tab();await tab.login();await other.login();
 const {client}=tab;
 async function change(token,kind,title,choice){
  const original=await client.itemColor(token);
  assert.equal(original.itemType,kind);assert.equal(original.title,title);
  const review=await client.reviewPreferences({baseTag:original.baseTag,itemColorToken:token,changes:{itemColor:choice}});
  assert.equal((await client.savePreferences(review.reviewId)).itemColor,choice);
 }
 const noteFields={query:'',type:'note',section:'Personal Life',status:'all',dateFrom:'',dateTo:''};
 const notes=await client.search(noteFields),note=notes.results[0];
 const sourceNote=await client.readNote(note.noteToken);
 await change(note.noteToken,'note',note.title,'warning');
 assert.deepEqual(await client.readNote(note.noteToken),sourceNote);
 const refreshedNotes=await client.search(noteFields);
 verifyNoteWorkspaceList(refreshedNotes,noteFields);
 assert.equal(refreshedNotes.results.find(row=>row.title===note.title).displayColor,'warning');
 const fields=calendarWorkspaceFields(),calendar=await client.calendar(fields),event=calendar.results[0];
 const sourceEvent=await client.readEventEdit(event.eventEditToken);
 await change(event.eventEditToken,'event',event.title,'positive');
 assert.deepEqual(await client.readEventEdit(event.eventEditToken),sourceEvent);
 const updated=await client.calendar(fields);verifyCalendarWorkspaceList(updated,fields);
 assert.equal(updated.results.find(row=>row.title===event.title).displayColor,'positive');
 const day=calendarMonthOverview(updated).days.find(value=>value.day===event.day);
 assert.equal(day.colors[day.titles.indexOf(event.title)],'positive');
 const scheduleFields={day:event.day,query:'',offset:0};
 const schedule=await client.calendarDayList(scheduleFields);verifyCalendarDay(schedule,scheduleFields);
 const selected=schedule.events.find(row=>row.title===event.title);
 assert.equal(selected.displayColor,'positive');
 await assert.rejects(other.client.itemColor(selected.eventReadToken));
 await change(selected.eventReadToken,'event',event.title,'section');
 assert.equal((await client.calendarDayRead({eventReadToken:selected.eventReadToken})).title,event.title);
 const fresh=await client.calendar(fields);
 assert.ok(!Object.hasOwn(fresh.results.find(row=>row.title===event.title),'displayColor'));
 await assert.rejects(client.itemColor(selected.eventReadToken));
 assert.deepEqual((await client.preferences()).preferences.categoryColors.items,{});
});

test('one project color follows its management, sparse search, overview and widget selections',async t=>{
 const {privateWorkspaceFixture}=await import('./support/private-workspace-fixture.mjs');
 const {renderPrivateProjectWidget}=await import('../src/private-project-widget.mjs');
 const fixture=privateWorkspaceFixture(t,{allowAppearance:true,allowAppearanceSave:true,allowCategoryColorPreferences:true,allowSearch:true,allowProjects:true,allowWidgetLayouts:true});
 const tab=fixture.tab(),other=fixture.tab();await tab.login();await other.login();const client=tab.client;
 const filters={query:'',section:'all',status:'all',offset:0};
 await client.projectsList(filters);
 const created=await client.projectsReview({action:'create',fields:{title:'Fictional portfolio',description:'Private planning notes',section:'Work',status:'Active',separateRecurring:true}});
 await client.projectsSave(created.reviewId);
 const list=await client.projectsList(filters);
 const target=list.projects.find(row=>row.status!=='Completed');
 const original=await client.projectsRead(target.projectToken);
 async function change(token,choice){
  const view=await client.itemColor(token);assert.equal(view.itemType,'project');assert.equal(view.title,target.title);
  const review=await client.reviewPreferences({baseTag:view.baseTag,itemColorToken:token,changes:{itemColor:choice}});
  return client.savePreferences(review.reviewId);
 }
 await change(target.projectToken,'warning');
 assert.deepEqual(await client.projectsRead(target.projectToken),original);
 const updated=await client.projectsList({query:target.title,section:target.section,status:'all',offset:0});
 assert.equal(updated.projects[0].displayColor,'warning');
 const overview=await client.projectOverview(),widget={type:'projects',filter:target.section,limit:10};
 const project=overview.widgetProjects.areas[target.section].rows.find(r=>r.title===target.title);
 assert.equal(project.displayColor,'warning');assert.equal((await client.itemColor(project.projectReadToken)).itemColor,'warning');
 assert.match(renderPrivateProjectWidget(widget,overview,{canRead:true}),/data-category-color="warning"/);
 const fields={query:target.title,type:'project',section:target.section,status:'all'};
 const search=await client.search(fields),sparse=search.results.find(r=>r.title===target.title);
 assert.equal(sparse.displayColor,'warning');assert.equal((await client.readSearchProject(sparse.projectReadToken)).description,original.description);
 await assert.rejects(other.client.itemColor(sparse.projectReadToken));
 const v=await client.itemColor(sparse.projectReadToken);
 const pending=await client.reviewPreferences({baseTag:v.baseTag,itemColorToken:sparse.projectReadToken,changes:{itemColor:'accent'}});
 await client.search(fields);await assert.rejects(client.savePreferences(pending.reviewId));
 await change(project.projectReadToken,'section');
 assert.ok(!(await client.search(fields)).results[0].displayColor);
 assert.deepEqual((await client.preferences()).preferences.categoryColors.items,{});
});
