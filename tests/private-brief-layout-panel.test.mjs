import test from 'node:test';
import assert from 'node:assert/strict';
import {createBriefLayoutPanel} from '../src/private-brief-layout-panel.mjs';
import {BRIEF_SECTIONS,defaultBriefLayout,validateBriefLayout} from '../src/private-brief-layout.mjs';
const turn=()=>new Promise(resolve=>setImmediate(resolve)),tag='b'.repeat(43),viewId='v'.repeat(43),reviewId='r'.repeat(43);
function fixture(t,{allowDates=false,layout=defaultBriefLayout()}={}){
 let now=Date.parse('2026-11-17T12:00:00Z'),allowed=true,reviewed=structuredClone(layout),saved=structuredClone(layout),panel;
 const calls={read:0,review:0,save:0,cancel:0,open:0},reviews=[],changes=[],savedCallbacks=[];
 const client={
  async briefLayoutRead(){calls.read++;return{layout:structuredClone(saved),baseTag:tag,viewId,expiresAt:now+100000,readOnly:false};},
  async briefLayoutReview(values){calls.review++;reviews.push(structuredClone(values));reviewed=structuredClone(values.layout);return{layout:structuredClone(reviewed),reviewId,expiresAt:now+100000};},
  async briefLayoutSave(id){calls.save++;assert.equal(id,reviewId);saved=structuredClone(reviewed);return{saved:true,layout:structuredClone(saved)};},
  async briefLayoutCancel(){calls.cancel++;return{cancelled:true};}
 };
 panel=createBriefLayoutPanel({client,clock:()=>now,allowDates,canUse:()=>allowed,onChange:focus=>changes.push(focus),onOpen:()=>calls.open++,onSaved:layout=>savedCallbacks.push({layout,blocked:panel.blocked()})});t.after(()=>panel.dispose());
 const click=async(selector,dataset={})=>{panel.click({target:{closest:s=>s===selector?{dataset}:null}});await turn();};
 const input=(id,display)=>panel.input({target:{name:'brief-layout-display-'+id,value:display}}),date=(key,value)=>panel.input({target:{name:'brief-layout-date-'+key,value}}),narrative=(key,value)=>panel.input({target:{name:'brief-layout-narrative-'+key,value}});
 const submit=async()=>{panel.submit({target:{id:'private-brief-layout-editor'},preventDefault(){}});await turn();};
 return{panel,client,calls,reviews,changes,savedCallbacks,click,input,date,narrative,submit,open:()=>click('#private-brief-layout-open'),move:(id,delta)=>click(delta===-1?'[data-brief-layout-up]':'[data-brief-layout-down]',{[delta===-1?'briefLayoutUp':'briefLayoutDown']:id}),now:()=>now,time:value=>now=value,allow:value=>allowed=value};
}
test('Brief layout reads only on explicit opening and exposes all supported section controls',async t=>{
 const f=fixture(t);assert.equal(f.calls.read,0);assert.equal(f.panel.blocked(),false);assert.match(f.panel.render(),/Customize Daily Brief/);await f.open();assert.equal(f.calls.read,1);assert.equal(f.calls.open,1);assert.equal(f.panel.blocked(),true);
 for(const {id,label}of BRIEF_SECTIONS){assert.ok(f.panel.render().includes('name="brief-layout-display-'+id+'"'));assert.ok(f.panel.render().includes(label));}
 assert.match(f.panel.render(),/presentation only/);assert.equal(f.calls.save,0);
});
test('reordering and display choices are reviewed before one exact layout save',async t=>{
 const f=fixture(t);await f.open();f.input('notes','hidden');await f.move('upcomingTasks',-1);await f.submit();assert.equal(f.calls.save,0);assert.equal(f.calls.review,1);assert.equal(f.reviews[0].baseTag,tag);assert.equal(f.reviews[0].layout.sections[0].id,'upcomingTasks');assert.equal(f.reviews[0].layout.sections.find(s=>s.id==='notes').display,'hidden');assert.match(f.panel.render(),/Review Daily Brief layout/);assert.match(f.panel.render(),/Notes<\/strong> · Hidden/);
 await f.click('#private-brief-layout-approve');await f.click('#private-brief-layout-approve');assert.equal(f.calls.save,1);assert.equal(f.savedCallbacks.length,1);assert.equal(f.savedCallbacks[0].blocked,false);assert.deepEqual(f.savedCallbacks[0].layout,f.reviews[0].layout);assert.equal(f.panel.blocked(),false);assert.match(f.panel.render(),/Daily Brief layout saved/);assert.doesNotMatch(f.panel.render(),/private-brief-layout-editor/);
});
test('back, default reset and cancellation preserve explicit review with no record write',async t=>{
 const f=fixture(t);await f.open();f.input('dueTasks','hidden');await f.move('projects',-1);await f.submit();await f.click('#private-brief-layout-back');assert.match(f.panel.render(),/value="hidden" selected/);await f.click('#private-brief-layout-defaults');await f.submit();assert.deepEqual(f.reviews.at(-1).layout,defaultBriefLayout());await f.click('#private-brief-layout-cancel');assert.equal(f.calls.save,0);assert.equal(f.calls.cancel,1);assert.equal(f.panel.blocked(),false);assert.equal(f.changes.at(-1),'#private-brief-layout-open');
});
test('unchanged response creates no approval and edits cannot exceed section or display bounds',async t=>{
 const f=fixture(t);await f.open();f.input('unknown','hidden');f.input('dueTasks','invalid');await f.move('dueTasks',-1);await f.move('routines',1);f.client.briefLayoutReview=async values=>{f.calls.review++;f.reviews.push(values);return{noChanges:true};};await f.submit();assert.deepEqual(f.reviews[0].layout,defaultBriefLayout());assert.match(f.panel.render(),/layout is unchanged/);assert.doesNotMatch(f.panel.render(),/Approve Brief layout/);await f.click('#private-brief-layout-approve');assert.equal(f.calls.save,0);
});
test('malformed read replies fail closed without echoing raw fields or untrusted section content',async t=>{
 const patches=[{baseTag:'bad'},{viewId:'bad'},{readOnly:true},{expiresAt:Infinity},{layout:{...defaultBriefLayout(),privateField:'PRIVATE_REJECTED_CONTENT'}},{owner_id:'PRIVATE_REJECTED_CONTENT'}];
 for(const patch of patches){const f=fixture(t),original=f.client.briefLayoutRead;f.client.briefLayoutRead=async()=>({...await original(),...patch});await f.open();assert.match(f.panel.render(),/could not be verified/);assert.doesNotMatch(f.panel.render(),/PRIVATE_REJECTED_CONTENT|private-brief-layout-editor/);assert.equal(f.calls.review,0);assert.equal(f.calls.save,0);}
});
test('read and review expiry are capped and expired choices never issue another request',async t=>{
 const f=fixture(t),original=f.client.briefLayoutRead;f.client.briefLayoutRead=async()=>({...await original(),expiresAt:f.now()+300001});await f.open();assert.match(f.panel.render(),/could not be verified/);
 const g=fixture(t);await g.open();g.time(g.now()+100001);g.input('notes','hidden');await g.submit();assert.equal(g.calls.review,0);assert.match(g.panel.render(),/layout view expired/);assert.match(g.panel.render(),/Retained Brief layout/);
 for(const expiry of [100001,300001]){const x=fixture(t);await x.open();x.client.briefLayoutReview=async values=>({layout:values.layout,reviewId,expiresAt:x.now()+expiry});await x.submit();assert.match(x.panel.render(),/review could not be verified/);await x.click('#private-brief-layout-approve');assert.equal(x.calls.save,0);}
 const h=fixture(t);await h.open();await h.submit();h.time(h.now()+100001);await h.click('#private-brief-layout-approve');assert.equal(h.calls.save,0);assert.match(h.panel.render(),/layout review expired/);
});
test('swapped or widened reviews retain only the known layout copy and cannot save',async t=>{
 for(const corrupt of [value=>({...value,reviewId:'bad'}),value=>({...value,layout:{...value.layout,sections:[...value.layout.sections].reverse()}}),value=>({...value,ownerId:'PRIVATE_REJECTED_CONTENT'}),()=>({noChanges:true,privateField:'PRIVATE_REJECTED_CONTENT'})]){
  const f=fixture(t),original=f.client.briefLayoutReview;await f.open();f.input('notes','hidden');f.client.briefLayoutReview=async v=>corrupt(await original(v));await f.submit();assert.match(f.panel.render(),/Retained Brief layout/);assert.doesNotMatch(f.panel.render(),/PRIVATE_REJECTED_CONTENT|Approve Brief layout/);await f.click('#private-brief-layout-approve');assert.equal(f.calls.save,0);
 }
});
test('uncertain and mismatched save replies keep a locked copy and never auto-retry',async t=>{
 for(const failure of ['throw','echo','extra']){
  const f=fixture(t);await f.open();f.input('notes','hidden');await f.submit();f.client.briefLayoutSave=async()=>{f.calls.save++;if(failure==='throw')throw Error('PRIVATE_REJECTED_CONTENT');return{saved:true,layout:defaultBriefLayout(),...(failure==='extra'?{secret:'PRIVATE_REJECTED_CONTENT'}:{})};};await f.click('#private-brief-layout-approve');await f.click('#private-brief-layout-approve');await f.submit();assert.equal(f.calls.save,1);assert.equal(f.calls.review,1);assert.equal(f.savedCallbacks.length,0);assert.match(f.panel.render(),/could not be confirmed/);assert.match(f.panel.render(),/Retained Brief layout/);assert.match(f.panel.render(),/&quot;display&quot;: &quot;hidden&quot;/);assert.doesNotMatch(f.panel.render(),/PRIVATE_REJECTED_CONTENT/);assert.equal(f.panel.blocked(),true);
 }
});
test('reset or offline during a pending save blocks every new action until settlement',async t=>{
 for(const mode of ['reset','offline'])for(const rejected of [false,true]){
  const f=fixture(t);await f.open();f.input('notes','hidden');await f.submit();let resolveSave,rejectSave;f.client.briefLayoutSave=()=>{f.calls.save++;return new Promise((resolve,reject)=>{resolveSave=resolve;rejectSave=reject;});};await f.click('#private-brief-layout-approve');f.panel[mode]();await f.open();f.input('notes','expanded');await f.move('projects',-1);await f.submit();await f.click('#private-brief-layout-fetch');await f.click('#private-brief-layout-cancel');await f.click('#private-brief-layout-approve');assert.deepEqual(f.calls,{read:1,review:1,save:1,cancel:0,open:1});assert.equal(f.panel.blocked(),true);
  if(mode==='offline')assert.match(f.panel.render(),/id="private-brief-layout-cancel" disabled/);const notifications=f.changes.length;if(rejected)rejectSave(Error('PRIVATE_REJECTED_CONTENT'));else resolveSave({saved:true,layout:f.reviews[0].layout});await turn();await turn();assert.ok(f.changes.length>notifications);assert.equal(f.changes.at(-1),undefined);assert.equal(f.savedCallbacks.length,0);assert.doesNotMatch(f.panel.render(),/Daily Brief layout saved|PRIVATE_REJECTED_CONTENT/);
  if(mode==='reset'){assert.equal(f.panel.blocked(),false);assert.doesNotMatch(f.panel.render(),/private-brief-layout-editor/);}else{assert.match(f.panel.render(),/Offline/);assert.match(f.panel.render(),/Retained Brief layout/);assert.doesNotMatch(f.panel.render(),/id="private-brief-layout-cancel" disabled/);}
 }
});
test('permission loss suppresses pending read, review, save and cancel results without focus or callbacks',async t=>{
 for(const operation of ['read','review','save','cancel']){
  const f=fixture(t),originalRead=f.client.briefLayoutRead;let release;
  if(operation==='read'){const original=f.client.briefLayoutRead;f.client.briefLayoutRead=()=>new Promise(resolve=>release=async()=>resolve(await original()));await f.open();}
  else{await f.open();if(operation==='review'){const original=f.client.briefLayoutReview;f.client.briefLayoutReview=v=>new Promise(resolve=>release=async()=>resolve(await original(v)));await f.submit();}
   if(operation==='save'){await f.submit();f.client.briefLayoutSave=()=>new Promise(resolve=>release=()=>resolve({saved:true,layout:f.reviews[0].layout}));await f.click('#private-brief-layout-approve');}
   if(operation==='cancel'){f.client.briefLayoutCancel=()=>new Promise(resolve=>release=()=>resolve({cancelled:true}));await f.click('#private-brief-layout-cancel');}}
  f.allow(false);await release();await turn();await turn();assert.equal(f.panel.render(),'');assert.equal(f.changes.at(-1),undefined);assert.equal(f.savedCallbacks.length,0);f.allow(true);assert.doesNotMatch(f.panel.render(),/Approve Brief layout|Daily Brief layout saved/);f.client.briefLayoutRead=originalRead;await f.click('#private-brief-layout-fetch');assert.match(f.panel.render(),/private-brief-layout-editor/);
 }
});
test('failed reads and failed cancellation leave safe recovery controls and never save',async t=>{
 const f=fixture(t);f.client.briefLayoutRead=async()=>{throw Error('PRIVATE_REJECTED_CONTENT');};await f.open();assert.match(f.panel.render(),/Fetch latest Brief layout/);assert.doesNotMatch(f.panel.render(),/PRIVATE_REJECTED_CONTENT/);f.client.briefLayoutCancel=async()=>({cancelled:false});await f.click('#private-brief-layout-cancel');assert.match(f.panel.render(),/could not be closed/);assert.equal(f.panel.blocked(),true);f.client.briefLayoutCancel=async()=>({cancelled:true});await f.click('#private-brief-layout-cancel');assert.equal(f.panel.blocked(),false);assert.equal(f.calls.save,0);
});
test('default permission and disposal prevent reads or private rendering',async t=>{
 let reads=0;const panel=createBriefLayoutPanel({client:{briefLayoutRead:async()=>reads++}});t.after(()=>panel.dispose());panel.click({target:{closest:s=>s==='#private-brief-layout-open'?{}:null}});await turn();assert.equal(reads,0);assert.equal(panel.render(),'');const f=fixture(t);await f.open();f.panel.dispose();await f.open();assert.equal(f.calls.read,1);assert.equal(f.panel.render(),'');
});
test('date preferences are explicitly scoped and require review and approval before saving',async t=>{
 const off=fixture(t);await off.open();assert.doesNotMatch(off.panel.render(),/name="brief-layout-date-/);
 const f=fixture(t,{allowDates:true});await f.open();for(const key of ['mode','range','weekStart'])assert.ok(f.panel.render().includes('id="private-brief-layout-date-'+key+'"'));
 f.date('mode','week');f.date('range','calendar');f.date('weekStart','1');assert.equal(f.calls.review,0);assert.equal(f.calls.save,0);await f.submit();assert.deepEqual(f.reviews[0].layout.dateView,{mode:'week',range:'calendar',weekStart:1});assert.equal(f.calls.save,0);assert.match(f.panel.render(),/<dt>Date view<\/dt><dd>Detailed week/);assert.match(f.panel.render(),/<dt>Date range<\/dt><dd>Calendar week/);assert.match(f.panel.render(),/<dt>Week starts on<\/dt><dd>Monday/);
 await f.click('#private-brief-layout-approve');assert.equal(f.calls.save,1);assert.deepEqual(f.savedCallbacks[0].layout.dateView,{mode:'week',range:'calendar',weekStart:1});assert.equal(f.savedCallbacks[0].blocked,false);
});
test('invalid date preference input cannot change a valid draft or request source access',async t=>{
 const f=fixture(t,{allowDates:true});await f.open();for(const [key,value]of [['mode','future'],['range','future'],['weekStart','7'],['weekStart','-1'],['weekStart','1.5'],['weekStart',1],['weekStart','01'],['weekStart',null],['ownerId','PRIVATE_REJECTED_CONTENT']])f.date(key,value);await f.submit();assert.deepEqual(f.reviews[0].layout.dateView,defaultBriefLayout().dateView);assert.equal(f.calls.read,1);assert.equal(f.calls.save,0);assert.doesNotMatch(f.panel.render(),/PRIVATE_REJECTED_CONTENT/);
});
test('legacy layouts receive canonical date defaults while date-disabled edits preserve existing preferences',async t=>{
 const legacy={schemaVersion:1,sections:defaultBriefLayout().sections.filter(section=>!['school','bills','routines'].includes(section.id))};const f=fixture(t,{allowDates:true,layout:legacy});await f.open();await f.submit();assert.equal(f.reviews[0].layout.schemaVersion,defaultBriefLayout().schemaVersion);assert.deepEqual(f.reviews[0].layout.dateView,defaultBriefLayout().dateView);
 const dateView={mode:'strip',range:'calendar',weekStart:4},layout={...defaultBriefLayout(),dateView},g=fixture(t,{layout});await g.open();g.date('mode','single');g.date('range','rolling');g.date('weekStart','0');g.input('notes','hidden');await g.move('projects',-1);await g.click('#private-brief-layout-defaults');await g.submit();assert.deepEqual(g.reviews[0].layout.dateView,dateView);assert.deepEqual(g.reviews[0].layout.sections,defaultBriefLayout().sections);assert.doesNotMatch(g.panel.render(),/<dt>Date view/);await g.click('#private-brief-layout-approve');assert.deepEqual(g.savedCallbacks[0].layout.dateView,dateView);
});
test('malformed and future date preferences fail closed without echoing untrusted content',async t=>{
 for(const patch of [{mode:'future'},{range:'PRIVATE_REJECTED_CONTENT'},{weekStart:7},{weekStart:-1},{weekStart:'0'},{weekStart:1.5},{sourcePermission:true}]){
  const layout={...defaultBriefLayout(),dateView:{...defaultBriefLayout().dateView,...patch}},f=fixture(t,{allowDates:true,layout});await f.open();assert.match(f.panel.render(),/could not be verified/);assert.doesNotMatch(f.panel.render(),/private-brief-layout-editor|PRIVATE_REJECTED_CONTENT/);assert.equal(f.calls.review,0);assert.equal(f.calls.save,0);
 }
 const f=fixture(t,{allowDates:true,layout:{...defaultBriefLayout(),schemaVersion:99}});await f.open();assert.match(f.panel.render(),/could not be verified/);
});
test('changed date preference review or acknowledgement cannot approve a different layout',async t=>{
 for(const stage of ['review','save']){
  const f=fixture(t,{allowDates:true});await f.open();f.date('mode','week');const wrong={...defaultBriefLayout(),dateView:{...defaultBriefLayout().dateView,mode:'strip'}};
  if(stage==='review')f.client.briefLayoutReview=async()=>({layout:wrong,reviewId,expiresAt:f.now()+100000});await f.submit();
  if(stage==='save')f.client.briefLayoutSave=async()=>{f.calls.save++;return{saved:true,layout:wrong};};await f.click('#private-brief-layout-approve');assert.equal(f.savedCallbacks.length,0);assert.match(f.panel.render(),/Retained Brief layout/);assert.match(f.panel.render(),/&quot;mode&quot;: &quot;week&quot;/);
 }
});
test('date edits cannot alter an unresolved save or a permission-denied draft',async t=>{
 const f=fixture(t,{allowDates:true});await f.open();f.date('mode','week');f.allow(false);f.date('mode','single');f.allow(true);await f.submit();assert.equal(f.reviews[0].layout.dateView.mode,'week');let release;f.client.briefLayoutSave=()=>{f.calls.save++;return new Promise(resolve=>release=resolve);};await f.click('#private-brief-layout-approve');f.panel.offline();f.date('mode','single');f.date('range','calendar');f.date('weekStart','3');await f.submit();assert.equal(f.calls.review,1);assert.equal(f.calls.save,1);assert.match(f.panel.render(),/&quot;mode&quot;: &quot;week&quot;/);release({saved:true,layout:f.reviews[0].layout});await turn();assert.equal(f.savedCallbacks.length,0);assert.match(f.panel.render(),/&quot;mode&quot;: &quot;week&quot;/);
});
test('Brief length, detail and tone controls are independent of date preferences and require approval',async t=>{
 const f=fixture(t);await f.open();for(const [key,label]of [['length','Brief length'],['detail','Brief detail'],['tone','Brief tone']]){assert.ok(f.panel.render().includes('name="brief-layout-narrative-'+key+'"'));assert.ok(f.panel.render().includes(label));}assert.doesNotMatch(f.panel.render(),/name="brief-layout-date-/);f.narrative('length','detailed');f.narrative('detail','titles');f.narrative('tone','gentle');assert.equal(f.calls.review,0);assert.equal(f.calls.save,0);await f.submit();assert.deepEqual(f.reviews[0].layout.narrative,{length:'detailed',detail:'titles',tone:'gentle'});assert.equal(f.calls.save,0);assert.match(f.panel.render(),/<dt>Brief length<\/dt><dd>Detailed/);assert.match(f.panel.render(),/<dt>Brief detail<\/dt><dd>Include record titles/);assert.match(f.panel.render(),/<dt>Brief tone<\/dt><dd>Gentle/);await f.click('#private-brief-layout-approve');assert.equal(f.calls.save,1);assert.deepEqual(f.savedCallbacks[0].layout.narrative,{length:'detailed',detail:'titles',tone:'gentle'});assert.equal(f.savedCallbacks[0].blocked,false);assert.deepEqual(Object.keys(f.reviews[0]).sort(),['baseTag','layout']);assert.deepEqual(Object.keys(f.reviews[0].layout).sort(),['dateView','narrative','schemaVersion','sections']);
});
test('reset restores narrative defaults while date-disabled settings retain their date preferences',async t=>{
 const dateView={mode:'week',range:'calendar',weekStart:5},f=fixture(t,{layout:{...defaultBriefLayout(),dateView,narrative:{length:'short',detail:'titles',tone:'professional'}}});await f.open();f.narrative('tone','gentle');await f.click('#private-brief-layout-defaults');await f.submit();assert.deepEqual(f.reviews[0].layout.narrative,defaultBriefLayout().narrative);assert.deepEqual(f.reviews[0].layout.dateView,dateView);assert.match(f.panel.render(),/<dt>Brief tone<\/dt><dd>Elegant &amp; Warm/);assert.equal(f.calls.save,0);await f.click('#private-brief-layout-approve');assert.deepEqual(f.savedCallbacks[0].layout.narrative,defaultBriefLayout().narrative);
});
test('legacy v1 and v2 layouts receive canonical narrative defaults without losing existing dates',async t=>{
 const sections=defaultBriefLayout().sections.filter(section=>!['school','bills','routines'].includes(section.id)),dateView={mode:'strip',range:'calendar',weekStart:2};for(const legacy of [{schemaVersion:1,sections},{schemaVersion:2,sections,dateView}]){const f=fixture(t,{layout:legacy});await f.open();await f.submit();assert.equal(f.reviews[0].layout.schemaVersion,defaultBriefLayout().schemaVersion);assert.deepEqual(f.reviews[0].layout.narrative,defaultBriefLayout().narrative);assert.deepEqual(f.reviews[0].layout.dateView,legacy.dateView??defaultBriefLayout().dateView);assert.equal(f.calls.save,0);}
});
test('unknown narrative input cannot change a valid draft or request records or theme access',async t=>{
 const f=fixture(t);await f.open();for(const [key,value]of [['length','longest'],['detail','fullBodies'],['tone','PRIVATE_REJECTED_CONTENT'],['tone',null],['tone',['gentle']],['sourcePermission','true'],['palette','forest']])f.narrative(key,value);await f.submit();assert.deepEqual(f.reviews[0].layout.narrative,defaultBriefLayout().narrative);assert.equal(f.calls.read,1);assert.equal(f.calls.save,0);assert.doesNotMatch(f.panel.render(),/PRIVATE_REJECTED_CONTENT|forest/);assert.equal(Object.hasOwn(f.reviews[0].layout,'palette'),false);assert.equal(Object.hasOwn(f.reviews[0].layout,'sourcePermission'),false);
});
test('malformed narrative settings fail closed without showing their values',async t=>{
 for(const patch of [{length:'longest'},{detail:'PRIVATE_REJECTED_CONTENT'},{tone:'unknown'},{tone:3},{sourcePermission:true}]){const f=fixture(t,{layout:{...defaultBriefLayout(),narrative:{...defaultBriefLayout().narrative,...patch}}});await f.open();assert.match(f.panel.render(),/could not be verified/);assert.doesNotMatch(f.panel.render(),/private-brief-layout-editor|PRIVATE_REJECTED_CONTENT/);assert.equal(f.calls.review,0);assert.equal(f.calls.save,0);}
});
test('changed narrative echoes cannot approve a different tone or detail',async t=>{
 for(const stage of ['review','save']){const f=fixture(t);await f.open();f.narrative('tone','gentle');f.narrative('detail','titles');const wrong={...defaultBriefLayout(),narrative:{length:'standard',detail:'overview',tone:'professional'}};if(stage==='review')f.client.briefLayoutReview=async()=>({layout:wrong,reviewId,expiresAt:f.now()+100000});await f.submit();if(stage==='save')f.client.briefLayoutSave=async()=>{f.calls.save++;return{saved:true,layout:wrong};};await f.click('#private-brief-layout-approve');assert.equal(f.savedCallbacks.length,0);assert.match(f.panel.render(),/Retained Brief layout/);assert.match(f.panel.render(),/&quot;tone&quot;: &quot;gentle&quot;/);assert.match(f.panel.render(),/&quot;detail&quot;: &quot;titles&quot;/);}
});
test('permission loss and pending offline saves preserve reviewed narrative choices without another write',async t=>{
 const f=fixture(t);await f.open();f.narrative('length','short');f.narrative('detail','titles');f.narrative('tone','professional');f.allow(false);f.narrative('tone','gentle');f.allow(true);await f.submit();assert.deepEqual(f.reviews[0].layout.narrative,{length:'short',detail:'titles',tone:'professional'});let release;f.client.briefLayoutSave=()=>{f.calls.save++;return new Promise(resolve=>release=resolve);};await f.click('#private-brief-layout-approve');f.panel.offline();f.narrative('length','detailed');f.narrative('detail','overview');f.narrative('tone','gentle');await f.submit();assert.equal(f.calls.review,1);assert.equal(f.calls.save,1);assert.match(f.panel.render(),/&quot;length&quot;: &quot;short&quot;/);assert.match(f.panel.render(),/&quot;detail&quot;: &quot;titles&quot;/);assert.match(f.panel.render(),/&quot;tone&quot;: &quot;professional&quot;/);release({saved:true,layout:f.reviews[0].layout});await turn();assert.equal(f.savedCallbacks.length,0);assert.match(f.panel.render(),/&quot;tone&quot;: &quot;professional&quot;/);
});
