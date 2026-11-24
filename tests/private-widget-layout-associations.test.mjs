import test from 'node:test';import assert from 'node:assert/strict';
import {createPrivateWidgetLayout} from '../server/private-widget-layout.mjs';
import {defaultWidgetLayouts} from '../src/private-widget-layout.mjs';
import {makeWidgetLayoutRecord} from '../src/dev-widget-layout-model.mjs';
import {createPrivateWidgetLayoutPanel} from '../src/private-widget-layout-panel.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',recordId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',alias='0f9f1b7a-5d5d-4f89-a910-21e1aaf8dd61',selectionToken='s'.repeat(43),now=Date.parse('2026-11-21T12:00:00Z');
const actor={ownerId:owner,accessToken:'fictional'},source={id:recordId,version:7};
 function setup(t){const layout={...makeWidgetLayoutRecord(defaultWidgetLayouts(),owner),id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',version:4,created_at:'2026-11-01T12:00:00.123456Z',updated_at:'2026-11-02T12:00:00.234567Z',deleted_at:null};let writes=0;const bindings=[];const api={listWidgetLayouts:async()=>[structuredClone(layout)],addWidgetLayout:async()=>{throw Error('unexpected insert');},updateWidgetLayout:async(_token,row,_owner,payload)=>{if(row.version!==layout.version)return[];writes++;Object.assign(layout,{payload:structuredClone(payload),version:row.version+1,updated_at:new Date(now).toISOString()});return[structuredClone(layout)];},setWidgetSourceAssociation:async(_token,value)=>{bindings.push(value);return{associationId:value.associationId,saved:true};},getPrivateNote:async()=>[],getPrivateProject:async()=>[],resolveWidgetSourceAssociation:async()=>[]},picker={begin(){},ready:async()=>true,list:async()=>({notes:[{selectionToken,title:'Private note',section:'Personal Life'}],projects:[],expiresAt:now+300000}),selected:async(_ctx,_actor,type,token)=>{assert.equal(type,'note');assert.equal(token,selectionToken);return{type,record:structuredClone({id:recordId,version:source.version}),expiresAt:now+300000};},resolve:async()=>null,clear(){}};const service=createPrivateWidgetLayout({api,now:()=>now,sourcePicker:picker});t.after(()=>service.dispose());return{layout,bindings,get writes(){return writes;},service,api,picker};}

test('source alias selection is reviewed with layout CAS and bound only after acknowledged settings save',async t=>{
 const s=setup(t),view=await s.service.read('context',actor,now+300000,{sourceChoices:true}),layouts=structuredClone(view.layouts),widget=layouts.desktop.find(w=>w.type==='notes');widget.sourceAssociationId=alias;
 assert.doesNotMatch(JSON.stringify(view),new RegExp(recordId));assert.equal(view.sourceOptions.notes[0].title,'Private note');
 const entry={associationId:alias,selectionToken,sourceType:'note'},review=await s.service.prepare('context',actor,{baseTag:view.baseTag,layouts,sourceSelections:[entry]});assert.equal(s.writes,0);assert.doesNotMatch(JSON.stringify(review),new RegExp(recordId));
 const claim=s.service.claim('context',owner,review.reviewId);assert.equal(await s.service.authorize(claim,actor),true);const saved=await s.service.save(claim,actor);assert.equal(saved.saved,true);assert.equal(s.writes,1);
 assert.deepEqual(s.bindings,[{associationId:alias,recordId, itemType:'note',layoutRecordId:s.layout.id,layoutVersion:5,sourceVersion:7}]);
 assert.equal(s.layout.payload.layouts.desktop.find(w=>w.type==='notes').sourceAssociationId,alias);assert.doesNotMatch(JSON.stringify(saved),new RegExp(recordId));
});

test('selected source changes after review fail authorization before the layout write',async t=>{
 const s=setup(t),view=await s.service.read('context',actor,now+300000),layouts=structuredClone(view.layouts);layouts.desktop.find(w=>w.type==='notes').sourceAssociationId=alias;
 const review=await s.service.prepare('context',actor,{baseTag:view.baseTag,layouts,sourceSelections:[{associationId:alias,selectionToken,sourceType:'note'}]}),claim=s.service.claim('context',owner,review.reviewId);
 s.picker.selected=async()=>({type:'note',record:{id:recordId,version:8},expiresAt:now+300000});assert.equal(await s.service.authorize(claim,actor),false);assert.equal(s.writes,0);assert.equal(s.bindings.length,0);
});

test('unverified aliases already present in a layout block the reviewed save',async t=>{
 const s=setup(t);s.layout.payload.layouts.desktop.find(w=>w.type==='notes').sourceAssociationId=alias;s.picker.resolve=async()=>null;
 const view=await s.service.read('context',actor,now+300000,{sourceChoices:true}),layouts=structuredClone(view.layouts);layouts.desktop[0].title='Renamed';
 await assert.rejects(s.service.prepare('context',actor,{baseTag:view.baseTag,layouts}),/verified/);assert.equal(s.writes,0);
});

test('selected widget source reads require the current page view and preserve source details server-side',async t=>{const s=setup(t),widget=s.layout.payload.layouts.desktop.find(w=>w.type==='notes');widget.sourceAssociationId=alias;s.picker.resolve=async()=>({associationId:alias,type:'note',title:'Private note',section:'Personal Life',record:{id:recordId,version:7,payload:{body:'server only'}}});const view=await s.service.read('context',actor,now+300000);const selected=await s.service.readSource('context',actor,view.viewId,alias);assert.equal(selected.source.record.id,recordId);assert.equal(selected.source.record.payload.body,'server only');assert.equal(selected.expiresAt,view.expiresAt);await assert.rejects(s.service.readSource('context',actor,view.viewId,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'));s.layout.payload.layouts.desktop.find(w=>w.type==='notes').title='Changed concurrently';await assert.rejects(s.service.readSource('context',actor,view.viewId,alias),/changed/);});

test('Notes and Projects source selector keeps only a short-lived token in the draft request and shows the title in approval',async t=>{
 let proposed=null,writes=0,sequence=0;const layouts=defaultWidgetLayouts(),view={readOnly:false,layouts,hasSavedLayout:true,baseTag:'b'.repeat(43),viewId:'v'.repeat(43),expiresAt:now+100000,sourceOptions:{notes:[{selectionToken,title:'Private note title',section:'Personal Life'}],projects:[],expiresAt:now+100000},sourceAssociations:{}};
 const client={widgetLayoutRead:async()=>view,widgetLayoutReview:async values=>{proposed=structuredClone(values);return{before:layouts,layouts:values.layouts,reviewId:'r'.repeat(43),expiresAt:now+90000};},widgetLayoutSave:async()=>{writes++;return{saved:true,layouts:proposed.layouts};},widgetLayoutCancel:async()=>({cancelled:true})};
 const panel=createPrivateWidgetLayoutPanel({client,clock:()=>now,allowSourceAssociations:true,associationIdFactory:()=>alias,idFactory:()=> 'unused-widget-'+(++sequence)});t.after(()=>panel.dispose());
 const settle=async()=>{for(let n=0;n<4;n++)await new Promise(resolve=>setImmediate(resolve));},click=selector=>panel.click({target:{closest:q=>q===selector?{}:null}});
 await panel.open();assert.match(panel.render(),/All notes/);panel.input({target:{dataset:{widgetSource:'true',widgetId:layouts.desktop.find(w=>w.type==='notes').id},value:selectionToken}});
 click('#private-widget-layout-review');await settle();assert.equal(proposed.sourceSelections[0].selectionToken,selectionToken);assert.equal(proposed.sourceSelections[0].associationId,alias);assert.equal(proposed.layouts.desktop.find(w=>w.type==='notes').sourceAssociationId,alias);assert.doesNotMatch(JSON.stringify(proposed),new RegExp(recordId));
 assert.match(panel.render(),/Private note title/);assert.match(panel.render(),/Linked sources/);click('#private-widget-layout-save');await settle();assert.equal(writes,1);
});
