import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allowedPublicPath} from '../tools/local-server.mjs';
import {defaultWidgetLayouts,normalizeWidgetLayouts,readOwnerWidgetLayout,makeWidgetLayoutRecord,editWidgetLayouts,moveWidgetBetween,renderWidgetBoard,MAX_WIDGETS,WIDGET_TYPES} from '../src/dev-widget-layout-model.mjs';
const ownerA='0a0a0a0a-aaaa-4aaa-8aaa-aaaaaaaaaaaa',ownerB='0b0b0b0b-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const record=(owner,layouts=defaultWidgetLayouts(),id='11111111-1111-4111-8111-111111111111')=>({id,owner_id:owner,household_id:null,visibility:'private',origin:'M2B_DEV_WIDGETS',item_type:'dashboard_layout',payload:{fictional:true,source:'M2B_DEV_WIDGETS',layouts},created_at:'2026-10-31T16:00:00Z',updated_at:'2026-10-31T16:01:00Z',version:1});
const info=(title,day='2026-10-31',section='Home',item_type='task')=>({section,item_type,payload:{title,day,fictional:true,amount:86.4}});
const snapshot={tasks:[info('<script>evil</script>'),info('School QA','2026-11-02','School')],notes:[info('A note','2026-11-02','Personal Life','note')],events:[info('Calendar QA','2026-11-01','Calendar','event')],emails:[{payload:{subject:'Fictional email'}}],life:[info('Utility test bill','2026-11-02','Finances','bill_fixture'),info('Study','2026-11-02','School','school_fixture'),info('Kitchen reset','2026-11-02','Home','household_fixture')]};
test('M2B: separate default layouts on desktop/tablet/phone with stable IDs',()=>{
 const layouts=defaultWidgetLayouts();assert.ok(layouts.desktop.length>=6);assert.ok(layouts.tablet.length>=6);assert.ok(layouts.phone.length>=5);
 const before=JSON.stringify(layouts.tablet);
 layouts.desktop=editWidgetLayouts(layouts,'desktop','hide',layouts.desktop[0].id).desktop;
 assert.equal(layouts.desktop[0].hidden,true);assert.equal(JSON.stringify(layouts.tablet),before);
});
test('M2B: normalize untrusted widget entries and reject unknown type or duplicate ID',()=>{
 const normalized=normalizeWidgetLayouts({desktop:[
 {id:'same-id',type:'tasks',filter:'Work',width:'full',hidden:false},
 {id:'same-id',type:'tasks',filter:'Home'},
 {id:'wrong-id',type:'unsafe<script>',hidden:false},
 {id:'visible-id',type:'bills',width:'not-valid',filter:'bad',hidden:'yes'}
 ],tablet:[],phone:[{id:'safe-id',type:'notes'}]});
 assert.equal(normalized.desktop.length,2);
 assert.deepEqual(normalized.desktop[0],{id:'same-id',type:'tasks',filter:'Work',width:'full',hidden:false});
 assert.deepEqual(normalized.desktop[1],{id:'visible-id',type:'bills',filter:'all',width:'half',hidden:false});
 assert.equal(normalized.tablet.length,0);assert.equal(normalized.phone.length,1);
});
test('M2B: per-owner layout read rejects other users, shared records, non-fictional or unknown source',()=>{
 const own=record(ownerA),other=record(ownerB,defaultWidgetLayouts(),'22222222-2222-4222-8222-222222222222');
 const shared={...record(ownerA),id:'33333333-3333-4333-8333-333333333333',household_id:'44444444-4444-4444-8444-444444444444'};
 const fake={...record(ownerA),id:'55555555-5555-4555-8555-555555555555',payload:{fictional:false,source:'M2B_DEV_WIDGETS'}};
 const got=readOwnerWidgetLayout([other,own,shared,fake],ownerA);
 assert.equal(got.record.id,own.id);assert.equal(got.duplicateCount,0);
 assert.equal(readOwnerWidgetLayout([own],ownerB).record,null);
 assert.equal(readOwnerWidgetLayout([own],ownerB).layouts.desktop.length,defaultWidgetLayouts().desktop.length);
});
test('M2B: record is private, contains only supported layouts and no credentials or source record values',()=>{
 const layout=defaultWidgetLayouts();const made=makeWidgetLayoutRecord(layout,ownerA);
 assert.equal(made.owner_id,ownerA);assert.equal(made.household_id,null);assert.equal(made.visibility,'private');assert.equal(made.item_type,'dashboard_layout');
 assert.equal(made.payload.source,'M2B_DEV_WIDGETS');assert.deepEqual(made.payload.layouts,layout);
 assert.doesNotMatch(JSON.stringify(made),/password|access_token|Utility test bill|86\.4/);
 assert.throws(()=>makeWidgetLayoutRecord(layout,'not-an-id'));
});
test('M2B: add, duplicate, hide, change size/filter, reorder, remove without changing other layouts',()=>{
 let layout=defaultWidgetLayouts();const tablet=JSON.stringify(layout.tablet);
 layout=editWidgetLayouts(layout,'desktop','add','', 'tasks','extra-tasks');
 layout=editWidgetLayouts(layout,'desktop','filter','extra-tasks','School');
 layout=editWidgetLayouts(layout,'desktop','size','extra-tasks','full');
 layout=editWidgetLayouts(layout,'desktop','duplicate','extra-tasks',undefined,'duplicated-tasks');
 assert.equal(layout.desktop.at(-1).type,'tasks');assert.equal(layout.desktop.at(-1).filter,'School');
 layout=editWidgetLayouts(layout,'desktop','hide','extra-tasks');assert.equal(layout.desktop.find(w=>w.id==='extra-tasks').hidden,true);
 layout=editWidgetLayouts(layout,'desktop','up','extra-tasks');
 layout=moveWidgetBetween(layout,'desktop','duplicated-tasks',layout.desktop[0].id);
 assert.equal(layout.desktop[0].id,'duplicated-tasks');
 layout=editWidgetLayouts(layout,'desktop','remove','extra-tasks');
 assert.equal(layout.desktop.some(w=>w.id==='extra-tasks'),false);
 assert.equal(JSON.stringify(layout.tablet),tablet);
});
test('M2B: caps malicious widget additions and hides removed widgets from default view',()=>{
 let layout=defaultWidgetLayouts();
 const remaining=MAX_WIDGETS-layout.desktop.length;for(let i=0;i<remaining;i++)layout=editWidgetLayouts(layout,'desktop','add','','notes',`new-${i}`);
 assert.equal(layout.desktop.length,MAX_WIDGETS);
 assert.throws(()=>editWidgetLayouts(layout,'desktop','add','','tasks','over-limit'));
 const hidden=editWidgetLayouts(layout,'desktop','hide',layout.desktop[0].id);
 const preview=renderWidgetBoard(hidden,'desktop',snapshot,{editing:false});
 const edit=renderWidgetBoard(hidden,'desktop',snapshot,{editing:true});
 assert.doesNotMatch(preview,/cc-widget-hidden/);assert.match(edit,/cc-widget-hidden/);
});
test('M2B: escaped user-source content; fictional bill amount hidden; no external links',()=>{
 const layout=defaultWidgetLayouts();const html=renderWidgetBoard(layout,'desktop',snapshot,{});
 assert.match(html,/&lt;script&gt;evil&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>evil<\/script>|\$86\.40|86\.4|href="https?:/);
 for(const type of WIDGET_TYPES)assert.match(renderWidgetBoard(editWidgetLayouts(layout,'desktop','add','',type.id,'extra-type'), 'desktop',snapshot,{editing:true}),new RegExp(type.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').split(' ')[0]));
});
test('M2B: widget studio renders control affordances and source-only approved QA links',()=>{
 const html=renderWidgetBoard(defaultWidgetLayouts(),'desktop',snapshot,{editing:true,dirty:true});
 for(const required of ['Done editing','Save layout','Discard draft','Add a widget','Duplicate','Hide','data-widget-filter','data-widget-size','data-layout-device="phone"','draggable="true"'])assert.ok(html.includes(required),required);
 assert.match(html,/aria-pressed="true"/);
 assert.match(html,/Desktop, tablet, and phone arrangements/);
});
test('M2B: previous 2A source preserved; widget cloud routes are allowlisted, secrets excluded',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 assert.equal(allowedPublicPath('/src/dev-widget-layout-model.mjs'),true);
 for(const path of ['/.env.local','/supabase/migrations/001_dev_isolation.sql','/tests/dev-widgets.test.mjs'])assert.equal(allowedPublicPath(path),false,path);
 const page=read('src/dev-workspace.mjs');
 for(const token of ['api.listWidgetLayouts','makeWidgetLayoutRecord','api.updateWidgetLayout','api.addWidgetLayout','renderWidgetBoard','requestGeneration','data-widget-action','data-widget-add'])assert.match(page,new RegExp(token.replaceAll('.','\\.')));
 assert.match(read('src/dev-api.mjs'),/version=eq\.\$\{record\.version\}/);
 assert.match(read('src/styles.css'),/cc-widget-grid/);
});
test('M2B: widget cloud API scopes reads to owner and updates to version match',async()=>{
 const {createDevApi}=await import('../src/dev-api.mjs');
 const calls=[];
 const fakeFetch=async(url,options)=>{calls.push({url,options});return {ok:true,text:async()=>JSON.stringify([])};};
 const api=createDevApi({supabaseUrl:'https://aaaaaaaaaaaa.supabase.co',projectRef:'aaaaaaaaaaaa',publishableKey:'sb_publishable_test'},fakeFetch);
 await api.listWidgetLayouts('test-token',ownerA);
 await api.updateWidgetLayout('test-token',{id:'11111111-1111-4111-8111-111111111111',version:3},ownerA,{fictional:true,source:'M2B_DEV_WIDGETS',layouts:defaultWidgetLayouts()});
 assert.match(calls[0].url,/owner_id=eq\.0a0a0a0a/);
 assert.match(calls[0].url,/item_type=eq\.dashboard_layout/);
 assert.match(calls[1].url,/version=eq\.3/);
 assert.match(calls[1].url,/item_type=eq\.dashboard_layout/);
 assert.equal(calls[1].options.method,'PATCH');
 assert.match(calls[1].options.headers.Authorization,/Bearer test-token/);
 for(const call of calls){const url=new URL(call.url);assert.equal(url.searchParams.get('deleted_at'),'is.null');assert.equal(url.searchParams.get('household_id'),'is.null');}
 assert.throws(()=>api.updateWidgetLayout('token',{id:'bad',version:1},ownerA,{}));
});
test('deleted layout copies are excluded and uncertain saves can visibly disable Save without disabling draft discard',()=>{
 const deleted={...record(ownerA),deleted_at:'2026-11-08T12:00:00Z'};assert.equal(readOwnerWidgetLayout([deleted],ownerA).record,null);
 const html=renderWidgetBoard(defaultWidgetLayouts(),'desktop',{}, {dirty:true,saveBlocked:true});assert.match(html,/id="widgets-save" disabled/);assert.match(html,/id="widgets-discard"/);
});
test('M2B: multiple stored layout revisions prefer latest without mixing account data',()=>{
 const old=record(ownerA),recent={...record(ownerA),id:'66666666-6666-4666-8666-666666666666',updated_at:'2026-10-31T16:05:00Z',version:4};
 recent.payload={fictional:true,source:'M2B_DEV_WIDGETS',layouts:editWidgetLayouts(defaultWidgetLayouts(),'phone','add','','email','added-email')};
 const got=readOwnerWidgetLayout([old,record(ownerB),recent],ownerA);
 assert.equal(got.record.id,recent.id);assert.equal(got.duplicateCount,1);
 assert.equal(got.layouts.phone.at(-1).type,'email');
});

test('M2B: bill amounts follow owner display privacy; hidden by default and only shown after explicit opt-in',()=>{
 const layout=defaultWidgetLayouts();const hidden=renderWidgetBoard(layout,'desktop',snapshot,{hideAmounts:true});
 const shown=renderWidgetBoard(layout,'desktop',snapshot,{hideAmounts:false});
 assert.doesNotMatch(hidden,/86\.40|\$86/);
 assert.match(shown,/\$86\.40/);
});

test('M3B: widget titles and item limits persist, render and cannot inject markup',()=>{
 let layouts=defaultWidgetLayouts();
 const id=layouts.desktop.find(x=>x.type==='tasks').id;
 layouts=editWidgetLayouts(layouts,'desktop','title',id,'  This Week <script>  ');
 layouts=editWidgetLayouts(layouts,'desktop','limit',id,'2');
 const saved=normalizeWidgetLayouts(layouts),widget=saved.desktop.find(x=>x.id===id);
 assert.equal(widget.title,'This Week <script>');assert.equal(widget.limit,2);
 const html=renderWidgetBoard(saved,'desktop',snapshot,{editing:true});
 assert.match(html,/This Week &lt;script&gt;/);assert.doesNotMatch(html,/<h2>This Week <script>/);
 assert.match(html,/data-widget-limit/);assert.match(html,/data-widget-title/);
 assert.equal(JSON.stringify(defaultWidgetLayouts().desktop).includes('This Week'),false);
 layouts=editWidgetLayouts(layouts,'desktop','title',id,'');
 assert.equal(normalizeWidgetLayouts(layouts).desktop.find(x=>x.id===id).title,undefined);
});

test('legacy widget API preserves unrelated original payload extensions when saving reviewed layouts',async()=>{const {createDevApi}=await import('../src/dev-api.mjs');let body;const api=createDevApi({supabaseUrl:'https://aaaaaaaaaaaa.supabase.co',projectRef:'aaaaaaaaaaaa',publishableKey:'sb_publishable_test'},async(_url,options)=>{body=JSON.parse(options.body);return{ok:true,text:async()=>JSON.stringify([])};});const layouts=defaultWidgetLayouts();await api.updateWidgetLayout('fictional',{id:'11111111-1111-4111-8111-111111111111',version:3,payload:{fictional:true,source:'M2B_DEV_WIDGETS',layoutVersion:1,layouts,extension:{keep:'Exact unknown'}}},ownerA,{fictional:true,source:'M2B_DEV_WIDGETS',layoutVersion:1,layouts:{...layouts,phone:[]}});assert.deepEqual(body.payload.extension,{keep:'Exact unknown'});assert.deepEqual(body.payload.layouts.phone,[]);});
