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

test('running a historical shortcut rechecks the current source and submits its fixed filters only once',async t=>{
 const previous={...filters,query:'exact earlier titles',dateFrom:'2026-11-01',dateTo:'2026-11-08'};
 for(const state of ['active','changed','expired','hidden','offline']){
  const x=setup(t,{allowHistory:true}),token='H'.repeat(43),expiresAt=x.s.clock+500;
  x.s.row={name:'Current name',removed:false};
  const entry={version:1,capturedAt:new Date(x.s.clock-1000).toISOString(),operation:'UPDATE',historyReadToken:token};
  x.client.shortcutHistoryList=async()=>({readOnly:true,available:true,offset:0,limit:50,matchCount:1,versions:[entry],expiresAt});
  x.client.shortcutHistoryRead=async()=>({readOnly:true,historical:true,version:1,operation:'UPDATE',capturedAt:entry.capturedAt,expiresAt,wasDeleted:false,record:{name:'Old name',filters:state==='hidden'?{type:'document-text',query:'unavailable'}:previous}});
  await x.show();x.button('versions');await turn();
  x.panel.click({target:{closest:key=>key==='[data-shortcut-history-read]'?{getAttribute:()=>token}:null}});await turn();
  if(state==='hidden'){
   assert.doesNotMatch(x.panel.render(),/Run search with earlier filters|unavailable.*Old name/);
   x.click('#private-shortcut-history-use-filters');assert.equal(x.s.runs.length,0);continue;
  }
  assert.match(x.panel.render(),/Run search with earlier filters/);assert.equal(x.s.runs.length,0);
  let finish,loads=0;
  x.client.loadSavedSearch=()=>{loads++;return new Promise(resolve=>{finish=resolve;});};
  x.click('#private-shortcut-history-use-filters');x.click('#private-shortcut-history-use-filters');
  assert.equal(loads,1);assert.equal(x.s.runs.length,0);
  if(state==='expired')x.s.clock=expiresAt;
  if(state==='offline')x.panel.offline();
  finish({name:state==='changed'?'Replaced name':'Current name',filters});await turn();
  assert.deepEqual(x.s.runs,state==='active'?[previous]:[]);
  assert.equal(x.s.row.name,'Current name');assert.equal(x.s.writes,0);
 }
});

test('an earlier shortcut name enters the current rename draft and every write remains reviewed',async t=>{
 for(const state of ['approve','edited','stale','same','offline']){
  const x=setup(t,{allowHistory:true}),token='V'.repeat(43),expiresAt=x.s.clock+60000;
  x.s.row={name:'Current shortcut',removed:false};
  const earlierName=state==='same'?x.s.row.name:'Earlier <shortcut>';
  const entry={version:1,operation:'UPDATE',capturedAt:new Date(x.s.clock-1000).toISOString(),historyReadToken:token};
  x.client.shortcutHistoryList=async()=>({readOnly:true,available:true,offset:0,limit:50,matchCount:1,versions:[entry],expiresAt});
  x.client.shortcutHistoryRead=async()=>({readOnly:true,historical:true,version:1,operation:'UPDATE',capturedAt:entry.capturedAt,expiresAt,wasDeleted:false,record:{name:earlierName,filters:{...filters,query:'different earlier filter'}}});
  await x.show();x.button('versions');await turn();
  x.panel.click({target:{closest:key=>key==='[data-shortcut-history-read]'?{getAttribute:()=>token}:null}});await turn();
  if(state==='same'){
   assert.doesNotMatch(x.panel.render(),/Use earlier name in rename draft/);
   x.click('#private-shortcut-history-use-name');assert.equal(x.panel.blocked(),false);continue;
  }
  if(state==='stale')x.client.loadSavedSearch=async()=>({name:'Another name',filters});
  x.click('#private-shortcut-history-use-name');await turn();
  if(state==='stale'){assert.doesNotMatch(x.panel.render(),/private-saved-search-name-form/);assert.equal(x.s.writes,0);continue;}
  assert.match(x.panel.render(),/value="Earlier &lt;shortcut&gt;"/);assert.equal(x.s.reviews,0);assert.equal(x.s.writes,0);
  if(state==='offline'){x.panel.offline();x.submit();await turn();assert.equal(x.s.reviews,0);continue;}
  if(state==='edited')x.input('Edited proposal');
  const expected=state==='edited'?'Edited proposal':earlierName;
  x.submit();await turn();assert.equal(x.s.review.name,expected);assert.deepEqual(x.s.review,{action:'rename',name:expected,savedSearchToken:'S'.repeat(43)});
  assert.match(x.panel.render(),/Approve renaming this search/);assert.equal(x.s.writes,0);
  x.click('#private-saved-search-approve');await turn();assert.equal(x.s.writes,1);assert.equal(x.s.row.name,expected);assert.deepEqual(x.s.runs,[]);
 }
});

test('a confirmed removal offers a single Undo that opens the ordinary restore review',async t=>{
 const x=setup(t),originalSave=x.client.saveSavedSearch;
 x.client.saveSavedSearch=async(id,options)=>{
  const result=await originalSave(id);
  if(result.action!=='remove')return result;
  assert.equal(options.offerUndo,true);
  return {...result,undo:{savedSearchToken:'U'.repeat(43),expiresAt:x.s.clock+10000}};
 };
 await x.create();await x.show();x.button('remove');await turn();
 x.click('#private-saved-search-approve');await turn();
 assert.match(x.panel.render(),/Undo shortcut removal/);
 x.click('#private-saved-search-undo');x.click('#private-saved-search-undo');await turn();
 assert.equal(x.s.review.savedSearchToken,'U'.repeat(43));
 assert.equal(x.s.row.removed,true);assert.equal(x.s.reviews,3);
 assert.match(x.panel.render(),/Approve shortcut restoration/);
 x.click('#private-saved-search-approve');await turn();
 assert.equal(x.s.row.removed,false);
 assert.doesNotMatch(x.panel.render(),/Undo shortcut removal/);
});

test('expired, invalid and unconfirmed shortcut removal offers never start a restore',async t=>{
 for(const when of ['expired','suspended-review','invalid','lost','offline','reset']){
  const x=setup(t),saved=x.client.saveSavedSearch,end=x.s.clock+10000;
  x.client.saveSavedSearch=async id=>{
   const result=await saved(id);if(result.action!=='remove')return result;
   if(when==='lost')throw Error('Lost response');
   return {...result,undo:{savedSearchToken:when==='invalid'?'invalid':'U'.repeat(43),expiresAt:end}};
  };
  await x.create();await x.show();x.button('remove');await turn();
  x.click('#private-saved-search-approve');await turn();
  if(when==='suspended-review'){
   x.click('#private-saved-search-undo');await turn();
   assert.match(x.panel.render(),/Approve shortcut restoration/);
   x.s.clock=end;x.click('#private-saved-search-approve');
  }else{
   if(when==='expired')x.s.clock=end;
   if(when==='offline')x.panel.offline();
   if(when==='reset')x.panel.reset();
   x.click('#private-saved-search-undo');
  }
  await turn();
  assert.equal(x.s.row.removed,true);
  assert.equal(x.s.writes,2);
  assert.equal(x.s.reviews,when==='suspended-review'?3:2);
  assert.doesNotMatch(x.panel.render(),/Undo shortcut removal|Approve shortcut restoration/);
 }
});
