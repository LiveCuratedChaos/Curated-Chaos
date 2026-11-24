import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultWidgetLayouts,validatePrivateWidgetLayouts} from '../src/private-widget-layout.mjs';
import {editWidgetLayouts} from '../src/dev-widget-layout-model.mjs';
import {applyPageWidgetLayout,defaultPageWidgetLayouts,selectedPageWidgetLayout} from '../src/private-widget-pages.mjs';

const association='0f9f1b7a-5d5d-4f89-a910-21e1aaf8dd61',projectAssociation='10a1b2c3-4d5e-4f60-8123-abcdefabcdef';

test('only note and project widgets accept a stable opaque association key in saved layouts',()=>{
 const layouts=defaultWidgetLayouts();
 layouts.desktop.find(w=>w.type==='notes').sourceAssociationId=association;
 layouts.tablet.push({id:'selected-project',type:'projects',width:'half',hidden:false,filter:'all',sourceAssociationId:projectAssociation});
 assert.equal(validatePrivateWidgetLayouts(layouts).desktop.find(w=>w.type==='notes').sourceAssociationId,association);
 assert.throws(()=>validatePrivateWidgetLayouts({...layouts,desktop:layouts.desktop.map(w=>w.type==='tasks'?{...w,sourceAssociationId:association}:w)}));
 for(const key of ['sourceRecordId','recordId','noteToken','projectReadToken']){
  const invalid=structuredClone(layouts);invalid.desktop.find(w=>w.type==='notes')[key]=association;
  assert.throws(()=>validatePrivateWidgetLayouts(invalid),new RegExp('settings'));
 }
 const invalid=structuredClone(layouts);invalid.desktop.find(w=>w.type==='notes').sourceAssociationId='not-a-v4-uuid';
 assert.throws(()=>validatePrivateWidgetLayouts(invalid));
 const crossed=structuredClone(layouts);crossed.phone.push({id:'cross-type-alias',type:'projects',width:'full',hidden:false,filter:'all',sourceAssociationId:association});
 assert.throws(()=>validatePrivateWidgetLayouts(crossed),/cannot cross/);
});

test('duplicating a selected widget keeps the same source alias while retaining independent widget identity',()=>{
 const layouts=defaultWidgetLayouts(),notes=layouts.desktop.find(w=>w.type==='notes');notes.sourceAssociationId=association;
 const copied=editWidgetLayouts(layouts,'desktop','duplicate',notes.id,undefined,'notes-copy');
 assert.equal(copied.desktop.find(w=>w.id==='notes-copy').sourceAssociationId,association);
 assert.equal(copied.desktop.find(w=>w.id==='notes-copy').id,'notes-copy');
 copied.desktop.find(w=>w.id==='notes-copy').sourceAssociationId='10a1b2c3-4d5e-4f60-8123-abcdefabcdef';
 assert.equal(copied.desktop.find(w=>w.id===notes.id).sourceAssociationId,association);
});

test('page composition keeps association aliases and unknown root extensions intact',()=>{
 const payload={fictional:true,source:'M2B_DEV_WIDGETS',layoutVersion:1,layouts:defaultWidgetLayouts(),extension:{keep:true}};
 const personal=defaultPageWidgetLayouts('personal');personal.phone.find(w=>w.type==='notes').sourceAssociationId=association;
 const saved=applyPageWidgetLayout(payload,'personal',personal);
 assert.deepEqual(saved.extension,{keep:true});
 assert.equal(selectedPageWidgetLayout(saved,'personal').layouts.phone.find(w=>w.type==='notes').sourceAssociationId,association);
 const crossed=structuredClone(saved);crossed.pageLayouts.pages.home={layouts:defaultPageWidgetLayouts('home')};crossed.pageLayouts.pages.home.layouts.phone.find(w=>w.type==='notes').sourceAssociationId=association;crossed.pageLayouts.pages.home.layouts.phone.find(w=>w.type==='notes').type='projects';
 assert.throws(()=>selectedPageWidgetLayout(crossed,'home'),/cannot cross/);
});
