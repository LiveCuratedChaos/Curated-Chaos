import test from 'node:test';
import assert from 'node:assert/strict';
import {createCalendarPresentationPanel} from '../src/private-calendar-presentation-panel.mjs';
import {defaultCalendarPresentation} from '../src/private-calendar-presentation.mjs';
const turn=()=>new Promise(resolve=>setImmediate(resolve)),baseTag='b'.repeat(43),viewId='v'.repeat(43),reviewId='r'.repeat(43);
function fixture(t){
 let now=Date.parse('2026-11-17T12:00:00Z'),allowed=true,reviewed=defaultCalendarPresentation(),saved=defaultCalendarPresentation(),panel;
 const calls={read:0,review:0,save:0,cancel:0,open:0},reviews=[],changes=[],savedCallbacks=[];
 const client={
  async calendarPresentationRead(){calls.read++;return{layout:structuredClone(saved),baseTag,viewId,expiresAt:now+100000,readOnly:false};},
  async calendarPresentationReview(values){calls.review++;reviews.push(structuredClone(values));reviewed=structuredClone(values.layout);return{layout:structuredClone(reviewed),reviewId,expiresAt:now+100000};},
  async calendarPresentationSave(id){calls.save++;assert.equal(id,reviewId);saved=structuredClone(reviewed);return{saved:true,layout:structuredClone(saved)};},
  async calendarPresentationCancel(){calls.cancel++;return{cancelled:true};}
 };
 panel=createCalendarPresentationPanel({client,clock:()=>now,canUse:()=>allowed,onChange:value=>changes.push(value),onOpen:()=>calls.open++,onSaved:layout=>savedCallbacks.push({layout,blocked:panel.blocked()})});t.after(()=>panel.dispose());
 const click=async selector=>{panel.click({target:{closest:s=>s===selector?{}:null}});await turn();};
 const input=value=>panel.input({target:{name:'calendar-presentation-monthDisplay',value}});
 const submit=async()=>{panel.submit({target:{id:'private-calendar-presentation-editor'},preventDefault(){}});await turn();};
 return{panel,client,calls,reviews,changes,savedCallbacks,click,input,submit,open:()=>click('#private-calendar-presentation-open'),now:()=>now,time:value=>now=value,allow:value=>allowed=value};
}
test('Calendar presentation reads only on explicit opening and preserves event details as default',async t=>{
 const f=fixture(t);assert.equal(f.calls.read,0);assert.equal(f.panel.blocked(),false);assert.match(f.panel.render(),/Customize Calendar display/);await f.open();assert.equal(f.calls.read,1);assert.equal(f.calls.open,1);assert.equal(f.panel.blocked(),true);assert.match(f.panel.render(),/Month event display/);assert.match(f.panel.render(),/value="details" selected/);assert.match(f.panel.render(),/Default: Event details/);assert.match(f.panel.render(),/No connected calendar is refreshed or changed/);assert.equal(f.calls.save,0);
});
test('minimal dots need a separate exact review and one approval before presentation changes',async t=>{
 const f=fixture(t);await f.open();f.input('dots');assert.equal(f.calls.review,0);assert.equal(f.calls.save,0);await f.submit();assert.deepEqual(f.reviews,[{baseTag,layout:{schemaVersion:1,monthDisplay:'dots'}}]);assert.equal(f.calls.save,0);assert.match(f.panel.render(),/Month event display: <strong>Minimal dots/);await f.click('#private-calendar-presentation-approve');await f.click('#private-calendar-presentation-approve');assert.equal(f.calls.save,1);assert.deepEqual(f.savedCallbacks,[{layout:{schemaVersion:1,monthDisplay:'dots'},blocked:false}]);assert.equal(f.panel.blocked(),false);assert.match(f.panel.render(),/Calendar display saved/);assert.doesNotMatch(f.panel.render(),/private-calendar-presentation-editor/);
});
test('back and cancellation preserve an unsaved choice without requesting an event or source write',async t=>{
 const f=fixture(t);await f.open();f.input('dots');await f.submit();await f.click('#private-calendar-presentation-back');assert.match(f.panel.render(),/value="dots" selected/);await f.click('#private-calendar-presentation-cancel');assert.equal(f.calls.cancel,1);assert.equal(f.calls.save,0);assert.equal(f.panel.blocked(),false);assert.equal(f.changes.at(-1),'#private-calendar-presentation-open');assert.deepEqual(Object.keys(f.reviews[0]).sort(),['baseTag','layout']);
});
test('unchanged response needs no approval and unsupported input cannot expand preferences',async t=>{
 const f=fixture(t);await f.open();for(const value of ['future',null,['dots'],'<script>'])f.input(value);f.client.calendarPresentationReview=async values=>{f.calls.review++;f.reviews.push(values);return{noChanges:true};};await f.submit();assert.deepEqual(f.reviews[0].layout,defaultCalendarPresentation());assert.match(f.panel.render(),/Calendar display is unchanged/);assert.doesNotMatch(f.panel.render(),/Approve Calendar display|<script>/);await f.click('#private-calendar-presentation-approve');assert.equal(f.calls.save,0);
});
test('malformed reads cannot expose forged fields or an unverified display editor',async t=>{
 for(const patch of [{baseTag:'bad'},{viewId:'bad'},{readOnly:true},{expiresAt:Infinity},{layout:{schemaVersion:99,monthDisplay:'dots'}},{layout:{schemaVersion:1,monthDisplay:'PRIVATE_REJECTED_CONTENT'}},{layout:{...defaultCalendarPresentation(),sourceAccess:true}},{ownerId:'PRIVATE_REJECTED_CONTENT'}]){
  const f=fixture(t),original=f.client.calendarPresentationRead;f.client.calendarPresentationRead=async()=>({...await original(),...patch});await f.open();assert.match(f.panel.render(),/could not be verified/);assert.doesNotMatch(f.panel.render(),/PRIVATE_REJECTED_CONTENT|private-calendar-presentation-editor/);assert.equal(f.calls.review,0);assert.equal(f.calls.save,0);
 }
});
test('views and reviews expire within five minutes and cannot extend the displayed review lifetime',async t=>{
 const f=fixture(t),original=f.client.calendarPresentationRead;f.client.calendarPresentationRead=async()=>({...await original(),expiresAt:f.now()+300001});await f.open();assert.match(f.panel.render(),/could not be verified/);
 const g=fixture(t);await g.open();g.time(g.now()+100001);g.input('dots');await g.submit();assert.equal(g.calls.review,0);assert.match(g.panel.render(),/display view expired/);assert.match(g.panel.render(),/Retained Calendar display/);
 for(const expiry of [100001,300001]){const x=fixture(t);await x.open();x.client.calendarPresentationReview=async values=>({layout:values.layout,reviewId,expiresAt:x.now()+expiry});await x.submit();await x.click('#private-calendar-presentation-approve');assert.equal(x.calls.save,0);assert.match(x.panel.render(),/review could not be verified/);}
 const h=fixture(t);await h.open();await h.submit();h.time(h.now()+100001);await h.click('#private-calendar-presentation-approve');assert.equal(h.calls.save,0);assert.match(h.panel.render(),/display review expired/);
});
test('different or widened review and save echoes cannot apply a changed presentation',async t=>{
 for(const stage of ['review','save'])for(const widened of [false,true]){
  const f=fixture(t);await f.open();f.input('dots');const wrong=widened?{schemaVersion:1,monthDisplay:'dots',privateField:'PRIVATE_REJECTED_CONTENT'}:defaultCalendarPresentation();if(stage==='review')f.client.calendarPresentationReview=async()=>({layout:wrong,reviewId,expiresAt:f.now()+100000});await f.submit();if(stage==='save')f.client.calendarPresentationSave=async()=>{f.calls.save++;return{saved:true,layout:wrong};};await f.click('#private-calendar-presentation-approve');assert.equal(f.savedCallbacks.length,0);assert.match(f.panel.render(),/Retained Calendar display/);assert.match(f.panel.render(),/&quot;monthDisplay&quot;: &quot;dots&quot;/);assert.doesNotMatch(f.panel.render(),/PRIVATE_REJECTED_CONTENT/);
 }
});
test('uncertain saves keep a copyable locked display choice and never resubmit',async t=>{
 const f=fixture(t);await f.open();f.input('dots');await f.submit();f.client.calendarPresentationSave=async()=>{f.calls.save++;throw Error('PRIVATE_REJECTED_CONTENT');};await f.click('#private-calendar-presentation-approve');await f.click('#private-calendar-presentation-approve');await f.submit();assert.equal(f.calls.save,1);assert.equal(f.calls.review,1);assert.match(f.panel.render(),/could not be confirmed/);assert.match(f.panel.render(),/Retained Calendar display/);assert.doesNotMatch(f.panel.render(),/PRIVATE_REJECTED_CONTENT/);assert.equal(f.panel.blocked(),true);
});
test('offline or reset during a save blocks every new action until a no-focus settlement',async t=>{
 for(const mode of ['offline','reset'])for(const failed of [false,true]){
  const f=fixture(t);await f.open();f.input('dots');await f.submit();let resolveSave,rejectSave;f.client.calendarPresentationSave=()=>{f.calls.save++;return new Promise((resolve,reject)=>{resolveSave=resolve;rejectSave=reject;});};await f.click('#private-calendar-presentation-approve');f.panel[mode]();await f.open();f.input('details');await f.submit();await f.click('#private-calendar-presentation-fetch');await f.click('#private-calendar-presentation-cancel');await f.click('#private-calendar-presentation-approve');assert.deepEqual(f.calls,{read:1,review:1,save:1,cancel:0,open:1});assert.equal(f.panel.blocked(),true);if(mode==='offline')assert.match(f.panel.render(),/id="private-calendar-presentation-cancel" disabled/);
  const notifications=f.changes.length;if(failed)rejectSave(Error('PRIVATE_REJECTED_CONTENT'));else resolveSave({saved:true,layout:f.reviews[0].layout});await turn();await turn();assert.ok(f.changes.length>notifications);assert.equal(f.changes.at(-1),undefined);assert.equal(f.savedCallbacks.length,0);assert.doesNotMatch(f.panel.render(),/Calendar display saved|PRIVATE_REJECTED_CONTENT/);if(mode==='reset'){assert.equal(f.panel.blocked(),false);assert.doesNotMatch(f.panel.render(),/private-calendar-presentation-editor/);}else{assert.match(f.panel.render(),/Offline/);assert.match(f.panel.render(),/&quot;monthDisplay&quot;: &quot;dots&quot;/);assert.doesNotMatch(f.panel.render(),/id="private-calendar-presentation-cancel" disabled/);}
 }
});
test('permission loss suppresses pending read, review, save and cancellation replies',async t=>{
 for(const operation of ['read','review','save','cancel']){
  const f=fixture(t),originalRead=f.client.calendarPresentationRead;let release;if(operation==='read'){f.client.calendarPresentationRead=()=>new Promise(resolve=>release=async()=>resolve(await originalRead()));await f.open();}else{await f.open();if(operation==='review'){const original=f.client.calendarPresentationReview;f.client.calendarPresentationReview=v=>new Promise(resolve=>release=async()=>resolve(await original(v)));await f.submit();}if(operation==='save'){await f.submit();f.client.calendarPresentationSave=()=>new Promise(resolve=>release=()=>resolve({saved:true,layout:f.reviews[0].layout}));await f.click('#private-calendar-presentation-approve');}if(operation==='cancel'){f.client.calendarPresentationCancel=()=>new Promise(resolve=>release=()=>resolve({cancelled:true}));await f.click('#private-calendar-presentation-cancel');}}
  f.allow(false);await release();await turn();await turn();assert.equal(f.panel.render(),'');assert.equal(f.changes.at(-1),undefined);assert.equal(f.savedCallbacks.length,0);f.allow(true);assert.doesNotMatch(f.panel.render(),/Approve Calendar display|Calendar display saved/);f.client.calendarPresentationRead=originalRead;await f.click('#private-calendar-presentation-fetch');assert.match(f.panel.render(),/private-calendar-presentation-editor/);
 }
});
test('failed reads and rejected cancellation retain actionable recovery without a save',async t=>{
 const f=fixture(t);f.client.calendarPresentationRead=async()=>{throw Error('PRIVATE_REJECTED_CONTENT');};await f.open();assert.match(f.panel.render(),/Fetch latest Calendar display/);assert.doesNotMatch(f.panel.render(),/PRIVATE_REJECTED_CONTENT/);f.client.calendarPresentationCancel=async()=>({cancelled:false});await f.click('#private-calendar-presentation-cancel');assert.match(f.panel.render(),/could not be closed/);assert.equal(f.panel.blocked(),true);f.client.calendarPresentationCancel=async()=>({cancelled:true});await f.click('#private-calendar-presentation-cancel');assert.equal(f.panel.blocked(),false);assert.equal(f.calls.save,0);
});
test('default permission and disposal prevent reads, callbacks and private rendering',async t=>{
 let reads=0;const panel=createCalendarPresentationPanel({client:{calendarPresentationRead:async()=>reads++}});t.after(()=>panel.dispose());panel.click({target:{closest:s=>s==='#private-calendar-presentation-open'?{}:null}});await turn();assert.equal(reads,0);assert.equal(panel.render(),'');const f=fixture(t);await f.open();f.panel.dispose();await f.open();assert.equal(f.calls.read,1);assert.equal(f.panel.render(),'');
});
