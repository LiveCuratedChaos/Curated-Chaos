import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultOnboarding,validateOnboarding,onboardingSuggestions,onboardingWidgetLayouts} from '../src/private-onboarding.mjs';
import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';

const scope={allowOnboarding:true,allowWidgetLayouts:true,allowWidgetPages:true};
const finished=()=>({...defaultOnboarding(),status:'complete',mode:'quick',step:'review',domains:['work','school','finances'],priorities:['degree','workTasks'],widgets:['degree','workTasks','bills']});
test('initial setup retains ordered priorities, private finance defaults and independent screen layouts',()=>{
 const f=finished();
 assert.deepEqual(onboardingSuggestions(f),['degree','workTasks','bills']);
 const layouts=onboardingWidgetLayouts(f);assert.deepEqual(layouts.phone.map(w=>[w.type,w.filter]),[['degree_progress','all'],['tasks','Work'],['bills','all']]);assert.equal(layouts.desktop[0].width,'half');assert.equal(layouts.phone[0].width,'full');assert.equal(layouts.desktop.at(-1).showAmounts,undefined);
 assert.equal(onboardingWidgetLayouts({...f,status:'paused'}),null);
 for(const changes of [{domains:['work','work']},{priorities:['homeProjects']},{priorities:['workTasks','degree','budget','bills']},{step:'widgets'},{mode:''},{widgets:['bogus']},{task:'not allowed'}])assert.throws(()=>validateOnboarding({...f,...changes}));
});
test('signed-in paused setup resumes across tabs; completed priorities supply initial widgets until a reviewed custom layout is saved',async t=>{
 const f=privateWorkspaceFixture(t,scope),a=f.tab(),b=f.tab();await a.login();await b.login();
 const started=await a.client.onboardingRead(),older=await b.client.onboardingRead();assert.deepEqual(started.layout,defaultOnboarding());
 const pause={...finished(),status:'paused',mode:'guided',step:'priorities',priorities:[],widgets:[]};
 const r=await a.client.onboardingReview({baseTag:started.baseTag,layout:pause});assert.deepEqual((await a.client.onboardingSave(r.reviewId)).layout,pause);
 await assert.rejects(b.client.onboardingReview({baseTag:older.baseTag,layout:finished()}));
 const resumed=await b.client.onboardingRead();assert.deepEqual(resumed.layout,pause);
 const oldCanvas=await a.client.widgetLayoutRead('brief');assert.deepEqual(oldCanvas.layouts.phone,[]);
 const done=await b.client.onboardingReview({baseTag:resumed.baseTag,layout:finished()});await b.client.onboardingSave(done.reviewId);
 await assert.rejects(a.client.widgetLayoutReview({baseTag:oldCanvas.baseTag,layouts:onboardingWidgetLayouts(finished())}));
 const canvas=await a.client.widgetLayoutRead('brief');assert.equal(canvas.hasSavedLayout,false);assert.deepEqual(canvas.layouts,onboardingWidgetLayouts(finished()));
 const custom=structuredClone(canvas.layouts);custom.phone[0].hidden=true;
 const reviewed=await a.client.widgetLayoutReview({baseTag:canvas.baseTag,layouts:custom});await a.client.widgetLayoutSave(reviewed.reviewId);
 const view=await b.client.onboardingRead();const changed={...finished(),priorities:['budget'],widgets:['budget']};const update=await b.client.onboardingReview({baseTag:view.baseTag,layout:changed});await b.client.onboardingSave(update.reviewId);
 const actual=await a.client.widgetLayoutRead('brief');assert.equal(actual.hasSavedLayout,true);assert.deepEqual(actual.layouts,custom);
 const guest=f.tab();await assert.rejects(guest.client.onboardingRead());
});
test('setup scopes and account settings keep their separate review and save permissions',async t=>{
 const f=privateWorkspaceFixture(t,{allowBriefRead:true}),a=f.tab();await a.login();await assert.rejects(a.client.onboardingRead());await assert.rejects(a.client.onboardingSave('example'));
 const g=privateWorkspaceFixture(t,scope),b=g.tab();await b.login();const initial=await b.client.onboardingRead();
 const pause={...defaultOnboarding(),status:'paused'};const r=await b.client.onboardingReview({baseTag:initial.baseTag,layout:pause});
 await b.client.onboardingCancel();await assert.rejects(b.client.onboardingSave(r.reviewId));assert.deepEqual((await b.client.onboardingRead()).layout,defaultOnboarding());
});

test('only an approved finished setup can change the original palette, and other profile settings survive',async t=>{
 const f=privateWorkspaceFixture(t,{...scope,allowAppearance:true,allowAppearanceSave:true}),tab=f.tab();await tab.login();const a=tab.client;
 const before=(await a.preferences()).preferences,selected={...finished(),palette:'coastal'};
 const start=await a.onboardingRead(),pause=await a.onboardingReview({baseTag:start.baseTag,layout:{...selected,status:'paused'}});await a.onboardingSave(pause.reviewId);
 assert.deepEqual((await a.preferences()).preferences,before);
 const current=await a.onboardingRead(),r=await a.onboardingReview({baseTag:current.baseTag,layout:selected});
 assert.deepEqual((await a.preferences()).preferences,before);await a.onboardingSave(r.reviewId);
 const after=(await a.preferences()).preferences;assert.deepEqual(after,{...before,palette:'coastal'});
 const bad=await a.onboardingRead();await assert.rejects(a.onboardingReview({baseTag:bad.baseTag,layout:{...selected,palette:'academia'}}));
 const other=privateWorkspaceFixture(t,scope),b=other.tab();await b.login();const unchanged=await b.client.onboardingRead();
 await assert.rejects(b.client.onboardingReview({baseTag:unchanged.baseTag,layout:selected}));
});

test('the regular private launcher explicitly enables setup and original page layouts',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {validateCalendarOnOpenArguments}=await import('../tools/private-calendar-on-open-server.mjs');
 const source=await readFile(new URL('../tools/Open-Private-Workspace.command',import.meta.url),'utf8');
 const args=source.match(/--[A-Za-z][A-Za-z0-9-]*(?:=[^\s\\]+)?/g).filter(arg=>arg!=='--calendar-reader='&&!arg.startsWith('--calendar-reader=')&&!arg.startsWith('--version'));
 const start=args.indexOf('--enable-private-calendar-on-open');
 const result=validateCalendarOnOpenArguments([...args.slice(start),'--calendar-reader=/private/Fictional.app/Contents/MacOS/CalendarPreview']);
 assert.equal(result.options.allowOnboarding,true);assert.equal(result.options.allowWidgetLayouts,true);assert.equal(result.options.allowWidgetPages,true);assert.equal(result.options.allowAppearanceSave,true);
});
