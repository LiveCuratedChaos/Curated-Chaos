import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {currentProjectWidgetSource} from '../src/private-project-widget-source.mjs';
import {createSearchProjectPanel} from '../src/private-search-project-panel.mjs';

const now=Date.parse('2026-11-21T12:00:00Z'),key='p'.repeat(43),alias='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const source={type:'project',projectReadToken:key,title:'Selected project',section:'Work',status:'Active',expiresAt:now+120000};
const layouts={desktop:[{id:'p1',type:'projects',hidden:false,sourceAssociationId:alias}],tablet:[],phone:[]};

test('only a visible current project widget yields its existing project reader row',async()=>{
 const row=currentProjectWidgetSource(key,{layouts,device:'desktop',sources:{[alias]:source},canvasActive:true,expiresAt:now+180000,now});
 assert.deepEqual(row,{type:'project',projectReadToken:key,title:'Selected project',section:'Work',projectStatus:'Active'});
 const sourceCode=await readFile(new URL('../src/dev-private-brief.mjs',import.meta.url),'utf8');
 assert.match(sourceCode,/currentProjectWidgetSource\(key,\{layouts:curationLayouts,device:curationScreen,sources:widgetSourceDetails,canvasActive,expiresAt:Math\.min\(curationExpiry,canvasSourceExpiry\),now:clock\(\)\}\)/);
});

test('hidden, replaced, malformed, expired, unknown and longer-lived associations cannot open',()=>{
 const run=(widgetLayouts=layouts,widgetSources={[alias]:source},options={})=>currentProjectWidgetSource(key,{layouts:widgetLayouts,device:'desktop',sources:widgetSources,canvasActive:true,expiresAt:now+180000,now,...options});
 assert.equal(run({desktop:[{...layouts.desktop[0],hidden:true}] }),null);
 assert.equal(run({desktop:[{...layouts.desktop[0],sourceAssociationId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}]}),null);
 assert.equal(run(layouts,{[alias]:{...source,projectReadToken:'x'}}),null);
 assert.equal(run(layouts,{[alias]:{...source,expiresAt:now}}),null);
 assert.equal(run(layouts,{[alias]:{...source,expiresAt:now+180001}}),null);
 assert.equal(run(layouts,{[alias]:{...source,status:'Private extension'}}),null);
 assert.equal(run(layouts,{[alias]:{...source,body:'must not escape'}}),null);
 assert.equal(run(layouts,{[alias]:source},{canvasActive:false}),null);
 assert.equal(run(layouts,{[alias]:source},{expiresAt:now}),null);
});

test('a linked widget reuses the existing selected-project reader and task summary',async t=>{
 const linked={...source,recordToken:'r'.repeat(43)};
 const selected=currentProjectWidgetSource(key,{layouts,device:'desktop',sources:{[alias]:linked},canvasActive:true,expiresAt:now+180000,now});
 assert.ok(selected);
 let taskReads=0;
 const panel=createSearchProjectPanel({client:{readSearchProject:async()=>({readOnly:true,title:selected.title,status:selected.projectStatus,section:selected.section,description:'Original project detail',expiresAt:now+120000}),readSearchProjectTasks:async()=>{taskReads++;return{readOnly:true,projectTitle:selected.title,manualStatus:selected.projectStatus,includeSubprojects:false,hierarchyAvailable:false,progress:{separateRecurring:true,completed:1,total:1,percentage:100,recurringCompleted:0,recurringTotal:0,linkedCompleted:1,linkedTotal:1},tasks:[{sourceKind:'task',title:'Original linked task',section:'Work',completed:true,recurring:false,direct:true,inheritedProjectCount:0}],offset:0,limit:50,matchCount:1,expiresAt:now+120000};}},clock:()=>now,canUse:()=>true,findResult:token=>token===key?selected:null,allowTaskSummary:true});
 t.after(()=>panel.dispose());
 const click=selector=>panel.click({target:{closest:value=>value===selector?{dataset:{privateSearchProject:key}}:null}});
 click('[data-private-search-project]');await new Promise(resolve=>setImmediate(resolve));
 assert.match(panel.render(),/Original project detail/);
 click('#private-search-project-tasks-fetch');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(taskReads,1);assert.match(panel.render(),/Original linked task/);
});
