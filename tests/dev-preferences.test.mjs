import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDevApi } from '../src/dev-api.mjs';
import { DEFAULT_BRIEF_PREFERENCES,normalizeBriefPreferences,makeBriefPreferencesRecord,readOwnerBriefPreferences,maySuggest } from '../src/dev-preferences-model.mjs';
import { allowedPublicPath } from '../tools/local-server.mjs';
import { renderConnectedShell } from '../src/dev-cloud-shell.mjs';
import {categoryColorFor,normalizeCategoryColors} from '../src/private-category-colors.mjs';
const a='bb8f4c56-a302-48d3-8c40-dc2838a97221';
const b='aa8f4c56-a302-48d3-8c40-dc2838a97222';
const id='cc8f4c56-a302-48d3-8c40-dc2838a97223';
const url='https://development123.supabase.co/';
const config={supabaseUrl:url,projectRef:'development123',publishableKey:'sb_publishable_fixture'};
const fixture=(owner=a, payload=makeBriefPreferencesRecord({},owner).payload)=>({id,owner_id:owner,household_id:null,visibility:'private',section:'Personal Life',item_type:'brief_preferences',payload,version:2,created_at:'2026-10-31T12:00:00Z',updated_at:'2026-10-31T13:00:00Z'});
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('M1F secure defaults preserve all fictional sources, hide financial amounts and require review',()=>{
 const d=normalizeBriefPreferences();
 assert.equal(d.palette,'neutral');assert.equal(d.density,'balanced');assert.equal(d.hideAmounts,true);assert.equal(d.automationMode,'ask');
 assert.deepEqual(d.sources,{calendar:true,email:true,school:true,finances:true,household:true});
 assert.deepEqual(d.suggestions,{email:true,school:true,household:true});
 assert.equal(d.quietHours.enabled,false);
 assert.equal(DEFAULT_BRIEF_PREFERENCES.hideAmounts,true);
});
test('malformed source/visual inputs do not escalate fictional permissions',()=>{
 const n=normalizeBriefPreferences({palette:'heritage',density:'oversize',hideAmounts:'false',sources:{school:'false'},suggestions:{email:'false'},quietHours:{enabled:'yes',start:'40:70',end:'25:24'}});
 assert.equal(n.palette,'neutral');assert.equal(n.density,'balanced');assert.equal(n.hideAmounts,true);assert.equal(normalizeBriefPreferences({automationMode:'execute'}).automationMode,'ask');
 assert.equal(n.sources.school,true);assert.equal(n.suggestions.email,true);
 assert.deepEqual(n.quietHours,{enabled:false,start:'22:00',end:'07:00'});
});
test('valid personal theme, source, density and quiet-hour settings are normalized',()=>{
 const n=normalizeBriefPreferences({palette:'academia',density:'compact',hideAmounts:false,sources:{email:false,calendar:false},suggestions:{email:false,school:false},quietHours:{enabled:true,start:'21:30',end:'08:05'}});
 assert.equal(n.palette,'academia');assert.equal(n.density,'compact');assert.equal(n.hideAmounts,false);
 assert.equal(n.sources.calendar,false);assert.equal(n.suggestions.email,false);assert.equal(n.quietHours.start,'21:30');
});
test('automation mode is private preference state and Disabled suppresses suggestions only',()=>{
 const automatic=normalizeBriefPreferences({automationMode:'automatic'}),disabled=normalizeBriefPreferences({automationMode:'disabled'}),suggestion={source:'email'};
 assert.equal(automatic.automationMode,'automatic');assert.equal(maySuggest(suggestion,automatic),true);assert.equal(maySuggest(suggestion,disabled),false);
 assert.equal(makeBriefPreferencesRecord({automationMode:'automatic'},a).payload.automationMode,'automatic');
});
test('category colors inherit by section and exact item overrides without changing source access',()=>{
 const prefs={categoryColors:{sections:{Work:'positive',Home:'warning',Finance:'accent',School:'invalid'},items:{[id]:'warning','not-a-record-id':'positive'}}};
 assert.equal(categoryColorFor({section:'Work',preferences:prefs}), 'positive');
 assert.equal(categoryColorFor({section:'Work',recordId:id,preferences:prefs}), 'warning');
 assert.equal(categoryColorFor({section:'School',preferences:prefs}), 'inherit');
 assert.equal(categoryColorFor({section:'Calendar',preferences:prefs}), 'inherit');
 const normalized=normalizeCategoryColors(prefs.categoryColors);assert.deepEqual(normalized.sections,{Work:'positive',Home:'warning'});assert.deepEqual(normalized.items,{[id]:'warning'});
 assert.deepEqual(normalizeBriefPreferences({categoryColors:normalized}).categoryColors,normalized);
 assert.deepEqual(normalizeBriefPreferences().categoryColors,{sections:{},items:{}});
});
test('preferences saved only as fictional owner-private record, not as authorization',()=>{
 const result=makeBriefPreferencesRecord({sources:{email:false}},a);
 assert.equal(result.owner_id,a);assert.equal(result.household_id,null);assert.equal(result.visibility,'private');
 assert.equal(result.item_type,'brief_preferences');assert.equal(result.section,'Personal Life');assert.equal(result.payload.source,'M1F_QA_SETTINGS');assert.equal(result.payload.fictional,true);
 assert.throws(()=>makeBriefPreferencesRecord({},'not-an-account'));
});
test('preference loader filters account B, invalid scope, malformed records and picks latest revision',()=>{
 const older={...fixture(),version:1,updated_at:'2026-10-31T12:00:00Z'};
 const newer={...fixture(),id:'dd8f4c56-a302-48d3-8c40-dc2838a97224',version:2,payload:{...fixture().payload,palette:'academia'},updated_at:'2026-10-31T15:00:00Z'};
 const invalids=[fixture(b),{...fixture(),household_id:b},{...fixture(),visibility:'household'},{...fixture(),payload:{}},{...fixture(),item_type:'note'},{...fixture(),version:'3'}];
 const loaded=readOwnerBriefPreferences([...invalids,older,newer],a);
 assert.equal(loaded.record.id,newer.id);assert.equal(loaded.duplicateCount,1);assert.equal(loaded.preferences.palette,'academia');
 assert.equal(readOwnerBriefPreferences([older,newer],b).record,null);
});
test('preference filters apply to source suggestions but never auto-approve',()=>{
 const p=normalizeBriefPreferences({sources:{email:false},suggestions:{school:false}});
 assert.equal(maySuggest({source:'email'},p),false);
 assert.equal(maySuggest({source:'school'},p),false);
 assert.equal(maySuggest({source:'household'},p),true);
 assert.equal(maySuggest({source:'finances'},p),false);
});
test('new settings route and JS are public but secrets and tests are blocked',()=>{
 for(const x of ['/dev-settings.html','/src/dev-settings.mjs','/src/dev-preferences-model.mjs'])assert.equal(allowedPublicPath(x),true);
 for(const x of ['/.env.local','/tests/dev-preferences.test.mjs','/tools/dev-env.mjs'])assert.equal(allowedPublicPath(x),false);
 assert.match(read('dev-settings.html'),/dev-settings\.mjs/);
 const nav=renderConnectedShell('<p>test</p>',{active:'settings'});assert.match(nav,/Daily Brief Settings/);assert.match(nav,/CONNECTED SETTINGS/);
});
test('API fetches private owner preferences with authenticated bearer token',async()=>{
 const calls=[];const fetcher=async(u,o)=>{calls.push({u,o});return {ok:true,status:200,text:async()=>JSON.stringify([])}};
 const api=createDevApi(config,fetcher);await api.listBriefPreferences('fake-token',a);
 assert.match(calls[0].u,/item_type=eq.brief_preferences/);assert.match(calls[0].u,/owner_id=eq/);assert.match(calls[0].u,/visibility=eq.private/);
 assert.equal(calls[0].o.headers.Authorization,'Bearer fake-token');
 assert.throws(()=>api.listBriefPreferences('fake-token','nonsense'));
});
test('preference API POST is owner data and PATCH has optimistic version guard',async()=>{
 const calls=[];const fetcher=async(u,o)=>{calls.push({u,o});return {ok:true,status:200,text:async()=>JSON.stringify([{id}])}};
 const api=createDevApi(config,fetcher);const p=makeBriefPreferencesRecord({palette:'luxury'},a);
 await api.addBriefPreferences('fake-token',p);
 await api.updateBriefPreferences('fake-token',fixture(),a,p.payload);
 assert.equal(calls[0].o.method,'POST');assert.equal(JSON.parse(calls[0].o.body).owner_id,a);
 assert.equal(calls[1].o.method,'PATCH');assert.match(calls[1].u,/version=eq.2/);assert.match(calls[1].u,/owner_id=eq/);
 assert.deepEqual(JSON.parse(calls[1].o.body),{payload:p.payload});
 assert.throws(()=>api.updateBriefPreferences('fake-token',{...fixture(),version:0},a,p.payload));
});
test('Daily Brief reloads preferences and enforces suggestion/source filtering',()=>{
 const src=read('src/dev-brief.mjs');assert.match(src,/api\.listBriefPreferences/);
 assert.match(src,/readOwnerBriefPreferences/);assert.match(src,/maySuggest\(s,preferences\)/);
 assert.match(src,/hideAmounts=preferences\.hideAmounts/);assert.match(src,/document\.body\.dataset\.theme=preferences\.palette/);
 assert.match(src,/selections\.calendar\?records\.events:\[\]/);
});
test('preferences remain fictional UI preferences; never automatically approve messages, finances or calendar',()=>{
 const settings=read('src/dev-settings.mjs');assert.match(settings,/makeBriefPreferencesRecord/);
 assert.match(settings,/settings were created elsewhere|Settings were created elsewhere/);
 assert.doesNotMatch(settings,/localStorage|service_role|sb_secret_/);
 assert.match(settings,/never changes|without explicit approval|No task, message|still requires explicit approval/);
});
test('Smart Independence exposes the selected mode while the Brief keeps approval gates',()=>{
 const settings=read('src/dev-settings.mjs'),brief=read('src/dev-brief.mjs');
 assert.match(settings,/Automatic · prepare suggestions only/);assert.match(settings,/Ask · review each suggestion/);assert.match(settings,/Disabled · hide suggestions/);
 assert.match(brief,/suggestions ranked by confidence; record changes still need approval/);assert.match(brief,/Every create\/edit\/send\/payment\/import remains behind its explicit approval/);
 assert.match(brief,/reviewAutomationSuggestion/);
});
