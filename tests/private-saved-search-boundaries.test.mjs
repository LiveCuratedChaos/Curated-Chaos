import test from 'node:test';
import assert from 'node:assert/strict';
import {createSavedSearchPanel} from '../src/private-saved-search-panel.mjs';
const filters={query:'Private fictional query',type:'task',section:'Work',status:'open',priority:'High',dateFrom:'',dateTo:'',dateStatus:'all'};
const savedToken='s'.repeat(43),reviewId='r'.repeat(43),turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(t){
 let allowed=true;const calls={list:0,review:0,save:0,cancel:0,load:0,open:0},changes=[],runs=[];
 const record={name:'Private fictional shortcut',filters:structuredClone(filters),savedSearchToken:savedToken};
 const client={
  async savedSearches(v){calls.list++;return{...v,viewId:'v'.repeat(43),limit:50,retentionDays:90,matchCount:1,records:[record],expiresAt:100000};},
  async reviewSavedSearch(v){calls.review++;return{action:v.action,name:v.name??record.name,filters:structuredClone(filters),reviewId,expiresAt:100000};},
  async saveSavedSearch(){calls.save++;return{saved:true,action:'create'};},
  async loadSavedSearch(){calls.load++;return{name:record.name,filters:structuredClone(filters)};},
  async cancelSavedSearch(){calls.cancel++;return{cancelled:true};}
 };
 const panel=createSavedSearchPanel({client,clock:()=>1,canUse:()=>allowed,onChange:f=>changes.push(f),onOpen:()=>calls.open++,onRun:f=>runs.push(f)});t.after(()=>panel.dispose());
 const click=async(selector,dataset={})=>{panel.click({target:{closest:s=>s===selector?{dataset}:null}});await turn();};
 const input=value=>panel.input({target:{name:'saved-search-name',value}}),submit=async()=>{panel.submit({target:{id:'private-saved-search-name-form'},preventDefault(){}});await turn();};
 const offer=()=>panel.setOffer({...filters,saveSearchToken:'o'.repeat(43),saveSearchExpiresAt:100000});
 const draft=async()=>{offer();await click('#private-saved-search-new');input('Retained fictional name');await submit();};
 return{panel,client,calls,changes,runs,click,input,submit,offer,draft,allow:v=>allowed=v};
}
test('reset and offline preserve a pending saved-search write guard until its response settles',async t=>{
 for(const mode of ['reset','offline'])for(const failed of [false,true]){
  const f=fixture(t);await f.draft();let resolveSave,rejectSave;f.client.saveSavedSearch=()=>{f.calls.save++;return new Promise((resolve,reject)=>{resolveSave=resolve;rejectSave=reject;});};await f.click('#private-saved-search-approve');f.panel[mode]();
  f.offer();f.input('Should not replace pending name');await f.submit();await f.click('#private-saved-searches-open');await f.click('#private-saved-search-new');await f.click('#private-saved-search-cancel');await f.click('#private-saved-search-approve');
  assert.equal(f.calls.save,1);assert.equal(f.calls.review,1);assert.equal(f.calls.list,0);assert.equal(f.calls.open,0);assert.equal(f.calls.cancel,0);assert.equal(f.panel.blocked(),true);assert.doesNotMatch(f.panel.render(),/Should not replace pending name|Save this applied search/);
  if(mode==='offline'){const cancel=f.panel.render().match(/<button\b[^>]*id="private-saved-search-cancel"[^>]*>/)?.[0];assert.ok(cancel);assert.match(cancel,/\bdisabled(?:\s|>)/);}
  const notifications=f.changes.length;if(failed)rejectSave(Error('Private stale failure'));else resolveSave({saved:true,action:'create'});await turn();await turn();assert.ok(f.changes.length>notifications);assert.equal(f.changes.at(-1),undefined);assert.doesNotMatch(f.panel.render(),/Search saved|Private stale failure/);
  if(mode==='reset'){assert.equal(f.panel.blocked(),false);assert.equal(f.panel.visible(),false);}else{assert.equal(f.panel.blocked(),true);assert.match(f.panel.render(),/Retained fictional name/);assert.match(f.panel.render(),/offline/);const cancel=f.panel.render().match(/<button\b[^>]*id="private-saved-search-cancel"[^>]*>/)?.[0];assert.ok(cancel);assert.doesNotMatch(cancel,/\bdisabled(?:\s|>)/);}
 }
});
test('permission loss while saved-search list, review, run or cancellation is pending suppresses late replies',async t=>{
 for(const operation of ['list','review','run','cancel']){
  const f=fixture(t);let release;
  if(operation==='list'){const original=f.client.savedSearches;f.client.savedSearches=v=>new Promise(resolve=>release=async()=>resolve(await original(v)));await f.click('#private-saved-searches-open');}
  if(operation==='review'){f.offer();await f.click('#private-saved-search-new');f.input('Retained fictional name');const original=f.client.reviewSavedSearch;f.client.reviewSavedSearch=v=>new Promise(resolve=>release=async()=>resolve(await original(v)));await f.submit();}
  if(operation==='run'){await f.click('#private-saved-searches-open');const original=f.client.loadSavedSearch;f.client.loadSavedSearch=()=>new Promise(resolve=>release=async()=>resolve(await original()));await f.click('[data-saved-run]',{savedRun:savedToken});}
  if(operation==='cancel'){f.offer();await f.click('#private-saved-search-new');f.input('Retained fictional name');f.client.cancelSavedSearch=()=>new Promise(resolve=>release=()=>resolve({cancelled:true}));await f.click('#private-saved-search-cancel');}
  f.allow(false);await release();await turn();await turn();assert.equal(f.panel.render(),'');assert.equal(f.changes.at(-1),undefined);assert.equal(f.runs.length,0);assert.equal(f.calls.save,0);
  f.allow(true);assert.doesNotMatch(f.panel.render(),/Approve saving this search/);if(operation==='list')assert.equal(f.panel.blocked(),false);
 }
});
test('permission loss during acknowledgement hides retained form and never announces unverified success',async t=>{
 const f=fixture(t);await f.draft();let release;f.client.saveSavedSearch=()=>{f.calls.save++;return new Promise(resolve=>release=resolve);};await f.click('#private-saved-search-approve');f.allow(false);release({saved:true,action:'create'});await turn();await turn();assert.equal(f.panel.render(),'');assert.equal(f.changes.at(-1),undefined);
 f.allow(true);assert.match(f.panel.render(),/Retained fictional name/);assert.doesNotMatch(f.panel.render(),/Search saved|Approve saving this search/);await f.click('#private-saved-search-approve');assert.equal(f.calls.save,1);await f.click('#private-saved-search-cancel');assert.equal(f.calls.cancel,1);assert.equal(f.panel.blocked(),false);
});
test('permission denied blocks offers, name input, cancellation and other new operations',async t=>{
 const f=fixture(t);f.offer();await f.click('#private-saved-search-new');f.input('Retained fictional name');f.allow(false);f.offer();f.input('Denied replacement');await f.submit();await f.click('#private-saved-search-cancel');await f.click('#private-saved-searches-open');assert.equal(f.panel.render(),'');assert.equal(f.calls.review,0);assert.equal(f.calls.list,0);assert.equal(f.calls.cancel,0);f.allow(true);assert.match(f.panel.render(),/Retained fictional name/);assert.doesNotMatch(f.panel.render(),/Denied replacement/);
});
test('a failed saved-search acknowledgement retains the locked reference and cannot be resubmitted',async t=>{
 const f=fixture(t);await f.draft();f.client.saveSavedSearch=async()=>{f.calls.save++;throw Error('Fictional uncertain save');};await f.click('#private-saved-search-approve');await f.click('#private-saved-search-approve');await f.submit();assert.equal(f.calls.save,1);assert.equal(f.calls.review,1);assert.match(f.panel.render(),/Retained fictional name/);assert.match(f.panel.render(),/Check saved searches before/);assert.equal(f.panel.blocked(),true);
});
