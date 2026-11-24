import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {escapeHtml} from '../src/core.mjs';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../server/google-development-ui.mjs',import.meta.url),'utf8').replace("import {escapeHtml as e} from '/src/core.mjs';",'const e=escapeHtml;').replace("show().catch(()=>{status.textContent='Development setup is unavailable. Check the local server configuration.';});","const boot=show().catch(()=>{status.textContent='Development setup is unavailable. Check the local server configuration.';});");
function harness(fetch,{BroadcastChannel}={}){const events={},pageEvents={},status={textContent:''},controls={innerHTML:'',addEventListener:(name,fn)=>events[name]=fn};let time=1000;class FixtureDate extends Date{static now(){return time;}}
 const nodes={'saved-brief-day':{value:'2026-11-08'}},context=vm.createContext({BroadcastChannel,escapeHtml,document:{getElementById:id=>id==='connection-status'?status:id==='connection-controls'?controls:nodes[id]},window:{addEventListener:(name,fn)=>pageEvents[name]=fn},fetch,Date:FixtureDate,sessionStorage:{removeItem(){}},setTimeout:()=>1,clearTimeout(){}});vm.runInContext(source,context);return{context,events,pageEvents,status,controls,nodes,setTime:value=>time=value};}
const state={configured:true,signedIn:true,csrf:'fixture',expiresAt:2000,connections:[]};
const response=data=>({ok:true,json:async()=>data});
test('late Google status response cannot restore private connection labels after page exit',async()=>{
 for(const boundary of ['fetch','json']){
  let release;const gate=new Promise(resolve=>release=resolve),privateState={...state,connections:[{provider:'gmail',accountLabel:'PRIVATE FIXTURE'}]};
  const h=harness(async()=>boundary==='fetch'?gate:{ok:true,json:async()=>gate});await Promise.resolve();h.pageEvents.pagehide();release(boundary==='fetch'?response(privateState):privateState);await vm.runInContext('boot',h.context);assert.equal(h.controls.innerHTML,'');assert.equal(vm.runInContext('csrf',h.context),null);
 }
});
test('late saved Google records are discarded on page exit or expired session',async()=>{
 for(const end of ['closed','expired']){
  let release;const gate=new Promise(resolve=>release=resolve);let reads=0;
  const h=harness(async path=>{reads++;return path==='/auth/google/status'?response(state):{ok:true,json:async()=>gate};});await vm.runInContext('boot',h.context);
  const target={innerHTML:'',textContent:''},button={dataset:{saved:'true'},disabled:false,closest:()=>null,parentElement:{querySelector:()=>target}};
  const pending=h.events.click({target:{closest:()=>button}});await Promise.resolve();if(end==='closed')h.pageEvents.pagehide();else h.setTime(2001);
  release({records:[{title:'PRIVATE SUBJECT FIXTURE'}]});await pending;assert.equal(target.innerHTML,'');assert.equal(h.controls.innerHTML,'');assert.equal(reads,2);
 }
});
test('already-expired Google sign-in does not display private connection controls',async()=>{
 const h=harness(async()=>response({...state,expiresAt:999,connections:[{provider:'gmail',accountLabel:'PRIVATE FIXTURE'}]}));await vm.runInContext('boot',h.context);assert.equal(h.controls.innerHTML,'');assert.match(h.status.textContent,/Session ended/);
});
test('connection cards show the exact read-only grant boundary and unknown freshness without claiming a live check',async()=>{
 const connection={connectionId:'fixture-connection',provider:'gmail',accountLabel:'Fictional mailbox',permission:'Gmail read-only mailbox scope',status:'authorized',selectionRequired:true,sourceSelection:null};
 const h=harness(async()=>response({...state,connections:[connection]}));await vm.runInContext('boot',h.context);assert.match(h.controls.innerHTML,/Gmail read-only mailbox scope/);assert.match(h.controls.innerHTML,/last successful provider check is unknown/);assert.match(h.controls.innerHTML,/No automatic refresh runs/);assert.match(h.controls.innerHTML,/can cover the mailbox/);assert.match(h.controls.innerHTML,/Inbox dates and subject\/sender metadata/);assert.doesNotMatch(h.controls.innerHTML,/authorized/i);
});
test('saved source search combines provider and title/sender, orders dates, and preserves originals',async()=>{
 const h=harness(async()=>response(state));await vm.runInContext('boot',h.context);
 const fixture=[{id:'b',provider:'gmail',title:'Trip',sender:'Taylor',receivedAt:'2026-11-01T10:00:00Z'},{id:'a',provider:'google_calendar',title:'TRIP planning',startDate:'2026-11-03'},{id:'c',provider:'gmail',title:'Another subject',sender:'TAYLOR',receivedAt:'2026-11-02T10:00:00Z'}];
 h.context.fixture=fixture;
 assert.deepEqual(Array.from(vm.runInContext("filteredSavedItems(fixture,' trip ','all').map(r=>r.id)",h.context)),['a','b']);
 assert.deepEqual(Array.from(vm.runInContext("filteredSavedItems(fixture,'taylor','gmail').map(r=>r.id)",h.context)),['c','b']);
 assert.equal(vm.runInContext("filteredSavedItems(fixture,'missing','gmail').length",h.context),0);assert.deepEqual(fixture.map(r=>r.id),['b','a','c']);
 vm.runInContext('savedSourceItems=fixture',h.context);h.pageEvents.pagehide();assert.equal(vm.runInContext('savedSourceItems.length',h.context),0);
});
test('saved results escape source metadata and leave search controls intact while filtering',async()=>{
 let reads=0;const h=harness(async()=>{reads++;return response(state);});await vm.runInContext('boot',h.context);
 h.nodes['saved-source-results']={innerHTML:''};h.nodes['saved-source-search']={value:'<img'};h.nodes['saved-source-provider']={value:'gmail'};
 vm.runInContext(`savedSourceItems=[{id:'fixture',provider:'gmail',title:'<img src=x>',sender:'<script>fixture</script>',receivedAt:'2026-11-01T00:00:00Z'}];renderSavedRows()`,h.context);
 assert.match(h.nodes['saved-source-results'].innerHTML,/1 of 1/);assert.match(h.nodes['saved-source-results'].innerHTML,/&lt;img/);assert.doesNotMatch(h.nodes['saved-source-results'].innerHTML,/<img|<script/);assert.equal(h.nodes['saved-source-search'].value,'<img');
 h.nodes['saved-source-provider'].value='google_calendar';vm.runInContext('renderSavedRows()',h.context);assert.match(h.nodes['saved-source-results'].innerHTML,/No saved items match/);assert.equal(reads,1);
 h.setTime(2001);assert.throws(()=>vm.runInContext('renderSavedRows()',h.context));assert.equal(vm.runInContext('savedSourceItems.length',h.context),0);
});
test('saved-source Brief escapes metadata and shows snapshot boundaries without bank amounts',async()=>{
 const h=harness(async path=>response(path==='/auth/google/status'?state:{day:'2026-11-08',events:[{title:'<script>event</script>',allDay:true,startDate:'2026-11-08',endDateExclusive:'2026-11-09'}],recentMail:[{title:'<img src=x>',receivedAt:'2026-11-07T00:00:00Z'}],savedMailCount:1,financialAccounts:3,financialTransactions:29}));await vm.runInContext('boot',h.context);
 const target={innerHTML:'',textContent:''},button={dataset:{savedBrief:'true'},disabled:false,closest:()=>null,parentElement:{querySelector:()=>target}};await h.events.click({target:{closest:()=>button}});
 assert.match(target.innerHTML,/&lt;script/);assert.doesNotMatch(target.innerHTML,/<script|<img/);assert.match(target.innerHTML,/3 accounts · 29 transactions/);assert.match(target.innerHTML,/Sources were not refreshed/);assert.match(target.innerHTML,/do not mean your calendar is free/);assert.match(target.innerHTML,/Amounts are not included/);
});
test('saved Brief date navigation handles leap days and rejects invalid or out-of-range dates',async()=>{
 const h=harness(async()=>response(state));await vm.runInContext('boot',h.context);assert.equal(vm.runInContext("briefDay('2028-02-28',1)",h.context),'2028-02-29');assert.equal(vm.runInContext("briefDay('2028-03-01',-1)",h.context),'2028-02-29');assert.equal(vm.runInContext("briefDay('2026-12-31',1)",h.context),'2027-01-01');for(const value of ['2026-02-30','','1999-12-31'])assert.throws(()=>vm.runInContext(`briefDay(${JSON.stringify(value)})`,h.context));assert.throws(()=>vm.runInContext("briefDay('2100-12-31',1)",h.context));
});
test('saved Brief date buttons request only the selected day; invalid dates make no request',async()=>{
 const paths=[],h=harness(async path=>{paths.push(path);return response(path==='/auth/google/status'?state:{day:'2026-11-09',events:[],recentMail:[],savedMailCount:0,financialAccounts:0,financialTransactions:0});});await vm.runInContext('boot',h.context);const target={textContent:'',innerHTML:''},button={dataset:{briefDay:'1'},disabled:false,closest:()=>null,parentElement:{querySelector:()=>target}};
 await h.events.click({target:{closest:()=>button}});assert.equal(paths[1],'/auth/google/saved-brief?day=2026-11-09&timeZone=UTC');assert.equal(h.nodes['saved-brief-day'].value,'2026-11-09');
 h.nodes['saved-brief-day'].value='';await h.events.click({target:{closest:()=>button}});assert.equal(paths.length,2);assert.match(target.textContent,/Choose a valid Brief date/);
});
test('cross-tab sign-out clears Google metadata and cancels pending private responses without sharing data',async()=>{
 const channels=[];class Channel{constructor(name){this.name=name;channels.push(this);}postMessage(value){this.sent=value;}close(){this.closed=true;}}
 let release;const gate=new Promise(yes=>release=yes),h=harness(async path=>response(path==='/auth/google/status'?state:await gate),{BroadcastChannel:Channel});await vm.runInContext('boot',h.context);
 const target={innerHTML:'',textContent:''},button={dataset:{saved:'true'},disabled:false,closest:()=>null,parentElement:{querySelector:()=>target}};const pending=h.events.click({target:{closest:()=>button}});await Promise.resolve();vm.runInContext("savedSourceItems=[{title:'PRIVATE FIXTURE'}]",h.context);channels[0].onmessage({data:'signed-out'});release({records:[{title:'LATE PRIVATE FIXTURE'}]});await pending;assert.equal(h.controls.innerHTML,'');assert.equal(vm.runInContext('savedSourceItems.length',h.context),0);assert.equal(target.innerHTML,'');assert.equal(channels[0].name,'cc-private-development-session');h.pageEvents.pagehide();assert.equal(channels[0].closed,true);
});
test('Brief Today uses the selected local day near UTC midnight',async()=>{
 const h=harness(async()=>response(state));await vm.runInContext('boot',h.context);assert.equal(vm.runInContext("briefToday('America/New_York',new Date('2026-11-09T02:00:00Z'))",h.context),'2026-11-08');assert.equal(vm.runInContext("briefToday('UTC',new Date('2026-11-09T02:00:00Z'))",h.context),'2026-11-09');
});
test('Mac preview controls are opt-in and event metadata is escaped without exposing transfer capabilities',async()=>{
 const off=harness(async()=>response(state));await vm.runInContext('boot',off.context);assert.doesNotMatch(off.controls.innerHTML,/Prepare approved Mac transfer/);
 const h=harness(async path=>response(path==='/auth/google/status'?{...state,macCalendarTransferAvailable:true}:{day:'2026-11-08',timeZone:'America/New_York',expiresAt:1900,events:[{title:'<script>fixture</script>',calendarTitle:'<img src=x>',allDay:true,startDate:'2026-11-08',endDateExclusive:'2026-11-09'}]}));await vm.runInContext('boot',h.context);assert.match(h.controls.innerHTML,/Prepare approved Mac transfer/);
 const target={innerHTML:'',textContent:''},button={dataset:{macBrief:'true'},disabled:false,closest:()=>null,parentElement:{querySelector:()=>target}};await h.events.click({target:{closest:()=>button}});assert.match(target.innerHTML,/Temporary Mac snapshot/);assert.match(target.innerHTML,/&lt;script/);assert.doesNotMatch(target.innerHTML,/<script|<img|capability/);assert.match(target.innerHTML,/Not saved/);
});
test('late Mac snapshots cannot restore private events after sign-out or preview expiry',async()=>{
 for(const expired of [false,true]){let release;const gate=new Promise(resolve=>release=resolve),h=harness(async path=>response(path==='/auth/google/status'?{...state,macCalendarTransferAvailable:true}:await gate));await vm.runInContext('boot',h.context);const target={innerHTML:'',textContent:''},button={dataset:{macBrief:'true'},disabled:false,closest:()=>null,parentElement:{querySelector:()=>target}},pending=h.events.click({target:{closest:()=>button}});await Promise.resolve();if(!expired)h.pageEvents.pagehide();release({day:'2026-11-08',timeZone:'UTC',expiresAt:999,events:[{title:'PRIVATE FICTIONAL EVENT'}]});await pending;assert.equal(target.innerHTML,'');}
});
test('Brief save-time labels distinguish missing sources, mixed ages and unknown provider checks',async()=>{
 const h=harness(async()=>response(state));await vm.runInContext('boot',h.context);h.context.freshness={sources:[{provider:'gmail',count:3,oldestSavedAt:'2026-11-01T12:00:00Z',newestSavedAt:'2026-11-08T12:00:00Z',unknownSavedAtCount:1},{provider:'google_calendar',count:0},{provider:'plaid',count:1,unknownSavedAtCount:1}]};
 const html=vm.runInContext("savedFreshnessHtml(freshness,'America/New_York')",h.context);assert.match(html,/How old/);assert.match(html,/No saved snapshots/);assert.match(html,/1 save time unknown/);assert.match(html,/Last source check unknown/);assert.match(html,/through/);assert.match(html,/do not tell us/);assert.doesNotMatch(html,/freshly synced|up to date/i);
});
test('Mac review lists escaped metadata with nothing preselected, exposes no save control and rejects late data',async()=>{
 for(const late of [false,true]){let release;const gate=new Promise(resolve=>release=resolve),h=harness(async path=>response(path==='/auth/google/status'?{...state,macCalendarTransferAvailable:true,macCalendarIdentityReviewAvailable:true}:await gate));await vm.runInContext('boot',h.context);assert.match(h.controls.innerHTML,/Choose Mac events to review/);
 const target={innerHTML:'',textContent:''},button={dataset:{macItems:'true'},disabled:false,closest:()=>null,parentElement:{querySelector:()=>target}},pending=h.events.click({target:{closest:()=>button}});await Promise.resolve();if(late)h.pageEvents.pagehide();release({expiresAt:1900,scope:{timeZone:'UTC'},events:[{key:'f'.repeat(64),title:'<script>Fictional</script>',calendarTitle:'<img src=x>',allDay:true,startDate:'2026-11-08',endDateExclusive:'2026-11-09'}]});await pending;
 if(late)assert.equal(target.innerHTML,'');else{assert.match(target.innerHTML,/&lt;script/);assert.doesNotMatch(target.innerHTML,/<script|<img|checked|Save selected/);assert.match(target.innerHTML,/nothing will be saved/);}
 }
});
test('saved-source search includes Mac calendar labels and filters and escapes their names',async()=>{
 const h=harness(async()=>response(state));await vm.runInContext('boot',h.context);h.context.macFixtures=[{id:'mac',provider:'mac_calendar',title:'Fictional visit',calendarTitle:'<img src=x> Family Calendar',allDay:true,startDate:'2026-11-09',endDateExclusive:'2026-11-10',fictional:false},{id:'mail',provider:'gmail',title:'Family note',sender:'Taylor',receivedAt:'2026-11-08T12:00:00Z'}];
 assert.deepEqual(Array.from(vm.runInContext("filteredSavedItems(macFixtures,'family calendar','all').map(row=>row.id)",h.context)),['mac']);assert.deepEqual(Array.from(vm.runInContext("filteredSavedItems(macFixtures,'family','mac_calendar').map(row=>row.id)",h.context)),['mac']);
 h.nodes['saved-source-results']={innerHTML:''};h.nodes['saved-source-search']={value:'family'};h.nodes['saved-source-provider']={value:'mac_calendar'};vm.runInContext('savedSourceItems=macFixtures;renderSavedRows()',h.context);const html=h.nodes['saved-source-results'].innerHTML;assert.match(html,/Mac Calendar/);assert.match(html,/Family Calendar/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|Google Calendar/);assert.match(html,/no source has been refreshed/);
});
test('failed saved-source reload clears the previous in-memory inventory',async()=>{
 const h=harness(async path=>path==='/auth/google/status'?response(state):{ok:false,json:async()=>({error:'Fictional failed read'})});await vm.runInContext('boot',h.context);vm.runInContext("savedSourceItems=[{title:'PRIVATE OLD FIXTURE'}]",h.context);const target={innerHTML:'',textContent:''},button={dataset:{saved:'true'},disabled:false,closest:()=>null,parentElement:{querySelector:()=>target}};await h.events.click({target:{closest:()=>button}});assert.equal(vm.runInContext('savedSourceItems.length',h.context),0);assert.match(target.textContent,/unavailable/);
});

test('an explicit Google preview updates this tab’s check and gives outcome-specific recovery',async()=>{
 const paths=[],checked='2026-11-24T15:00:00.000Z',connectionId='fixture-connection';
 let outcome=null;
 const h=harness(async path=>{
  paths.push(path);
  if(path==='/auth/google/status')return response(state);
  if(outcome)return {ok:false,json:async()=>({error:'PRIVATE UPSTREAM ERROR',outcome})};
  return response({readAt:checked,previewId:'fixture',result:{messages:[]}});
 });
 await vm.runInContext('boot',h.context);
 const target={innerHTML:'',textContent:''};
 const card={textContent:''};h.nodes['google-check-'+connectionId]=card;
 const button={dataset:{preview:connectionId,selection:'fixture'},disabled:false,closest:()=>null,parentElement:{querySelector:()=>target}};
 await h.events.click({target:{closest:()=>button}});
 assert.equal(card.textContent,'Last successful provider check in this tab: '+checked+'.');
 assert.match(target.innerHTML,/0 items/);
 outcome='reconnect-required';
 await h.events.click({target:{closest:()=>button}});
 assert.match(target.textContent,/authorization needs reconnection/);
 assert.doesNotMatch(target.textContent,/PRIVATE UPSTREAM ERROR/);
 assert.equal(paths.filter(path=>path==='/auth/google/preview').length,2);
 assert.match(card.textContent,/Last successful provider check/);
 h.pageEvents.pagehide();
 assert.equal(vm.runInContext('providerChecks.size',h.context),0);
});
