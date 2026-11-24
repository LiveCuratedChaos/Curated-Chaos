import test from 'node:test';import assert from 'node:assert/strict';
import {createSavedSearchPanel,validSavedSearchFilters,savedSearchSummary} from '../src/private-saved-search-panel.mjs';
const filters={query:'plan',type:'task',section:'Work',status:'open',priority:'High',dateFrom:'2026-11-10',dateTo:'2026-11-12',dateStatus:'dated'},turn=()=>new Promise(r=>setImmediate(r));
function setup(t,historyOptions={}){const s={clock:Date.parse('2026-11-10T14:00:00Z'),row:null,reads:0,reviews:0,writes:0,runs:[],opens:0,changes:0,allowed:true},client={savedSearches:async({removed,offset})=>{s.reads++;return{viewId:'V'.repeat(43),removed,offset,limit:50,retentionDays:90,matchCount:s.row&&(s.row.removed===removed)?1:0,records:s.row&&(s.row.removed===removed)?[{name:s.row.name,filters:structuredClone(filters),savedSearchToken:'S'.repeat(43),...(removed?{deletedAt:new Date(s.clock).toISOString()}:{})}]:[],expiresAt:s.clock+100000};},loadSavedSearch:async()=>({name:s.row.name,filters:structuredClone(filters)}),reviewSavedSearch:async values=>{s.reviews++;s.review=values;return{reviewId:'R'.repeat(43),action:values.action,name:values.name||s.row.name,filters:structuredClone(filters),expiresAt:s.clock+100000};},saveSavedSearch:async()=>{s.writes++;const v=s.review;if(v.action==='create')s.row={name:v.name,removed:false};if(v.action==='rename')s.row.name=v.name;if(v.action==='remove')s.row.removed=true;if(v.action==='restore')s.row.removed=false;return{saved:true,action:v.action};},cancelSavedSearch:async()=>({cancelled:true})};
 const panel=createSavedSearchPanel({...historyOptions,client,clock:()=>s.clock,canUse:()=>s.allowed,onChange:()=>s.changes++,onOpen:()=>s.opens++,onRun:f=>s.runs.push(f)});t.after(()=>panel.dispose());
 const click=selector=>panel.click({target:{closest:key=>key===selector?{}:null}}),button=(action)=>panel.click({target:{closest:key=>key==='[data-saved-'+action+']'?{dataset:{['saved'+action[0].toUpperCase()+action.slice(1)]:'S'.repeat(43)}}:null}}),input=value=>panel.input({target:{name:'saved-search-name',value}}),submit=()=>panel.submit({target:{id:'private-saved-search-name-form'},preventDefault(){}}),offer=()=>panel.setOffer({...filters,saveSearchToken:'O'.repeat(43),saveSearchExpiresAt:s.clock+100000});
 async function create(){offer();click('#private-saved-search-new');input('My planning');submit();await turn();click('#private-saved-search-approve');await turn();}
 async function show(){click('#private-saved-searches-open');await turn();}
 return{s,client,panel,click,button,input,submit,offer,create,show};}
test('panel does not fetch history automatically; offers name/review before any write',async t=>{const x=setup(t);assert.equal(x.s.reads,0);x.offer();assert.match(x.panel.render(),/Dates stay fixed/);x.click('#private-saved-search-new');x.input('My planning');assert.equal(x.panel.blocked(),true);assert.equal(x.s.reviews,0);x.submit();await turn();assert.equal(x.s.reviews,1);assert.equal(x.s.writes,0);assert.match(x.panel.render(),/Approve saving this search/);x.click('#private-saved-search-approve');await turn();assert.equal(x.s.writes,1);assert.equal(x.panel.blocked(),false);assert.match(x.panel.render(),/Search saved/);});
test('run loads selected filters and triggers one fresh search without saving',async t=>{const x=setup(t);await x.create();await x.show();x.button('run');await turn();assert.deepEqual(x.s.runs,[filters]);assert.equal(x.s.writes,1);assert.equal(x.panel.visible(),false);});
test('rename/removal/restoration each require their own review and preserve filters',async t=>{const x=setup(t);await x.create();await x.show();x.button('rename');x.input('New shortcut');x.submit();await turn();assert.equal(x.s.writes,1);x.click('#private-saved-search-approve');await turn();assert.equal(x.s.row.name,'New shortcut');await x.show();x.button('remove');await turn();assert.match(x.panel.render(),/Matching tasks, notes and events stay unchanged/);x.click('#private-saved-search-approve');await turn();assert.equal(x.s.row.removed,true);await x.show();x.click('#private-saved-search-mode');await turn();assert.match(x.panel.render(),/Review restoration/);x.button('restore');await turn();assert.equal(x.s.writes,3);x.click('#private-saved-search-approve');await turn();assert.equal(x.s.writes,4);assert.equal(x.s.row.removed,false);});
test('filter validation rejects invalid dates/foreign fields and summaries are plain text',()=>{assert.equal(validSavedSearchFilters(filters),true);for(const f of [{...filters,offset:0},{...filters,dateFrom:'2026-02-30'},{...filters,dateStatus:'undated'},{...filters,type:'note'},{...filters,query:'bad\nvalue'}])assert.equal(validSavedSearchFilters(f),false);assert.match(savedSearchSummary(filters),/High priority/);});
test('names and queries are escaped; typed names never trigger a request by themselves',t=>{const x=setup(t);x.panel.setOffer({...filters,query:'<script>',saveSearchToken:'O'.repeat(43),saveSearchExpiresAt:x.s.clock+100000});x.click('#private-saved-search-new');x.input('\"/><script>');assert.match(x.panel.render(),/&lt;script&gt;/);assert.doesNotMatch(x.panel.render(),/<script>/);assert.equal(x.s.reviews,0);assert.equal(x.s.writes,0);});
test('uncertain saves retain a locked name/filter reference and never retry',async t=>{const x=setup(t);x.offer();x.click('#private-saved-search-new');x.input('Retain me');x.submit();await turn();x.client.saveSavedSearch=async()=>{x.s.writes++;throw Error('Uncertain save');};x.click('#private-saved-search-approve');await turn();x.click('#private-saved-search-approve');assert.equal(x.s.writes,1);assert.match(x.panel.render(),/Retain me/);assert.match(x.panel.render(),/Check saved searches before/);assert.equal(x.panel.blocked(),true);});
test('offline clears capabilities and locks drafts without silently dropping the name',async t=>{const x=setup(t);x.offer();x.click('#private-saved-search-new');x.input('Keep draft');x.panel.offline();x.submit();await turn();assert.equal(x.s.reviews,0);assert.match(x.panel.render(),/Keep draft/);assert.match(x.panel.render(),/offline/);assert.equal(x.panel.blocked(),true);});
test('reset prevents late private lists or saves from restoring cleared UI',async t=>{const x=setup(t);let release;x.client.savedSearches=()=>new Promise(r=>release=r);x.click('#private-saved-searches-open');x.panel.reset();release({bad:true});await turn();assert.equal(x.panel.visible(),false);assert.doesNotMatch(x.panel.render(),/could not be verified/);assert.equal(x.panel.blocked(),false);});
test('failed or forged selected filters never run a different query',async t=>{const x=setup(t);await x.create();await x.show();x.client.loadSavedSearch=async()=>({name:x.s.row.name,filters:{...filters,query:'different'}});x.button('run');await turn();assert.equal(x.s.runs.length,0);assert.match(x.panel.render(),/Saved search changed/);});
test('a conflicting workspace draft blocks opening or starting saved-search controls',t=>{const x=setup(t);x.offer();x.s.allowed=false;x.click('#private-saved-search-new');x.click('#private-saved-searches-open');assert.equal(x.s.reads,0);assert.equal(x.panel.blocked(),false);assert.doesNotMatch(x.panel.render(),/private-saved-search-name-form/);});
test('offline during a pending save keeps navigation guarded until the single response settles',async t=>{const x=setup(t);x.offer();x.click('#private-saved-search-new');x.input('Pending draft');x.submit();await turn();let release;x.client.saveSavedSearch=()=>new Promise(r=>release=r);x.click('#private-saved-search-approve');x.panel.offline();assert.equal(x.panel.blocked(),true);x.click('#private-saved-searches-open');assert.equal(x.s.reads,0);release({saved:true,action:'create'});await turn();assert.match(x.panel.render(),/Pending draft/);assert.match(x.panel.render(),/offline/);assert.equal(x.panel.blocked(),true);});
test('a delayed timer or long-lived response cannot keep a removed shortcut or its approval available',async t=>{
 for(const stage of ['list','review']){
  const x=setup(t),boundary=x.s.clock+10000;
  x.s.row={name:'Fictional removed shortcut',removed:true};
  const read=x.client.savedSearches;
  x.client.savedSearches=async values=>{
   const value=await read(values);
   if(value.records.length)value.records[0].deletedAt=new Date(boundary-90*86400000).toISOString();
   return value;
  };
  await x.show();x.click('#private-saved-search-mode');await turn();
  assert.match(x.panel.render(),/Fictional removed shortcut/);
  x.s.clock=boundary;
  if(stage==='review'){
   x.button('restore');await turn();
   // Let the timer fire while the authoritative clock is still at the eligible anniversary.
   await new Promise(resolve=>setTimeout(resolve,8));
   assert.match(x.panel.render(),/Approve shortcut restoration/);
  }
  x.s.clock++;
  if(stage==='review')x.click('#private-saved-search-approve');else x.button('restore');
  assert.doesNotMatch(x.panel.render(),/Fictional removed shortcut|Approve shortcut restoration/);
  assert.match(x.panel.render(),/expired/);
  assert.equal(x.s.reviews,stage==='review'?1:0);
  assert.equal(x.s.writes,0);
 }
});
test('a selected shortcut reveals an earlier name and filters only on explicit read',async t=>{
 const x=setup(t,{allowHistory:true}),token='H'.repeat(43),expiry=x.s.clock+100000;
 x.s.row={name:'Current name',removed:false};
 const entry={version:1,capturedAt:new Date(x.s.clock-1000).toISOString(),operation:'UPDATE',historyReadToken:token};
 let lists=0,reads=0;
 x.client.shortcutHistoryList=async values=>{lists++;assert.equal(values.savedSearchToken,'S'.repeat(43));return{readOnly:true,available:true,offset:0,limit:50,matchCount:1,versions:[entry],expiresAt:expiry};};
 x.client.shortcutHistoryRead=async()=>{reads++;return{readOnly:true,historical:true,version:1,operation:'UPDATE',capturedAt:entry.capturedAt,expiresAt:expiry,wasDeleted:false,record:{name:'Earlier <name>',filters:{...filters,query:'older planning'}}};};
 await x.show();assert.equal(lists,0);assert.match(x.panel.render(),/View versions/);
 x.button('versions');await turn();assert.equal(lists,1);assert.equal(reads,0);
 assert.match(x.panel.render(),/Versions of Current name/);assert.doesNotMatch(x.panel.render(),/older planning/);
 x.panel.click({target:{closest:key=>key==='[data-shortcut-history-read]'?{getAttribute:()=>token}:null}});await turn();
 assert.match(x.panel.render(),/Earlier &lt;name&gt;/);assert.match(x.panel.render(),/older planning/);
 assert.equal(reads,1);assert.equal(x.s.runs.length,0);assert.equal(x.s.writes,0);
 x.panel.offline();assert.doesNotMatch(x.panel.render(),/older planning/);
});
