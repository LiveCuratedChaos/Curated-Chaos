// Pure owner-private project-title search; no configuration, storage or providers.
import test from 'node:test';import assert from 'node:assert/strict';
import {privateWorkspaceSearch,privateSearchFields} from '../server/private-workspace-search.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now=Date.parse('2026-11-17T12:00:00Z');
const id=n=>'11111111-1111-4111-a111-'+String(n).padStart(12,'0');
const project=(n,patch={})=>({id:id(n),owner_id:owner,household_id:null,visibility:'private',section:'Work',item_type:'project',origin:'PRIVATE_COOKIE_PROJECT',version:3,created_at:'2026-11-01T12:00:00.123456Z',deleted_at:null,payload:{fictional:true,schemaVersion:1,title:'Fictional project '+String(n).padStart(3,'0'),status:'Active'},...patch});
const note=n=>({id:id(n),owner_id:owner,household_id:null,visibility:'private',section:'Personal Life',item_type:'note',created_at:'2026-11-01T12:00:00Z',deleted_at:null,payload:{fictional:true,title:'Fictional note',body:'PRIVATE_NOTE_BODY'}});
const values={query:'fictional',type:'all',section:'all'};
const search=(projectRows,extra={})=>privateWorkspaceSearch({rows:[],projectRows,ownerId:owner,values,now,includeProjects:true,...extra});
test('project search and filter type remain explicitly disabled by default',()=>{
 assert.throws(()=>privateSearchFields({...values,type:'project'}));assert.equal(privateSearchFields({...values,type:'project'},{allowProjects:true}).type,'project');assert.throws(()=>privateSearchFields(values,{allowProjects:'yes'}));
 assert.throws(()=>privateWorkspaceSearch({rows:[],projectRows:[project(1)],ownerId:owner,values,now}));
 assert.throws(()=>privateWorkspaceSearch({rows:[],ownerId:owner,values,now,includeProjects:1}));
 assert.throws(()=>privateWorkspaceSearch({rows:[],ownerId:owner,values,now,projectAction:()=>({projectReadToken:'t'.repeat(43)})}));
 assert.equal(privateWorkspaceSearch({rows:[note(5)],ownerId:owner,values,now}).matchCount,1);
});
test('all-type search combines sparse projects and core records with no details or raw identities',()=>{
 const full=project(1,{payload:{...project(1).payload,description:'PRIVATE_PROJECT_DESCRIPTION',futureSecret:'PRIVATE_FUTURE_SECRET'}}),before=structuredClone(full),result=search([full],{rows:[note(2)]});
 assert.equal(result.matchCount,2);assert.equal(result.readOnly,true);assert.equal(result.providerRead,false);
 assert.deepEqual(result.results.find(r=>r.type==='project'),{type:'project',title:full.payload.title,section:'Work',projectStatus:'Active'});
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|owner_id|schemaVersion|11111111|payload|version|description/);assert.deepEqual(full,before);
 assert.equal(search([full],{values:{...values,query:'PRIVATE_PROJECT_DESCRIPTION'}}).matchCount,0);
});
test('project-only browsing accepts blank titles and combines Unicode matching with area filters',()=>{
 const rows=[project(1,{payload:{...project(1).payload,title:'Ｆｉｃｔｉｏｎａｌ Board'}}),project(2,{section:'Home'})];
 const result=search(rows,{values:{query:'fictional board',type:'project',section:'Work'}});assert.equal(result.matchCount,1);assert.equal(result.results[0].title,'Ｆｉｃｔｉｏｎａｌ Board');
 assert.equal(search(rows,{values:{query:' ',type:'project',section:'all'}}).matchCount,2);
 assert.equal(search(rows,{values:{query:'',type:'project',section:'School'}}).matchCount,0);
});
test('task-only status, priority, dated filters and event ordering cannot widen to projects',()=>{
 for(const patch of [{status:'open'},{status:'completed'},{priority:'High'},{dateFrom:'2026-11-17'},{dateTo:'2026-11-17'},{dateStatus:'dated'},{dateStatus:'undated'}])assert.throws(()=>search([project(1)],{includePriority:true,includeDates:true,allowUndated:true,values:{query:'',type:'project',section:'all',...patch}}));
 assert.throws(()=>search([project(1)],{eventOrderByTime:true,values:{query:'',type:'project',section:'all'}}));
 const result=search([project(1)],{includePriority:true,includeDates:true,allowUndated:true,values:{query:'',type:'project',section:'all',status:'all',priority:'all',dateFrom:'',dateTo:'',dateStatus:'all'}});assert.equal(result.matchCount,1);assert.equal(result.results[0].priority,undefined);
});
test('malformed, foreign, shared, deleted or unsupported project summaries fail closed',()=>{
 for(const patch of [{owner_id:foreign},{household_id:foreign},{visibility:'household'},{section:'Finances'},{item_type:'task'},{origin:'OTHER'},{version:0},{version:1.5},{deleted_at:'2026-11-17T12:00:00Z'},{created_at:'invalid'},{payload:{...project(1).payload,fictional:false}},{payload:{...project(1).payload,schemaVersion:2}},{payload:{...project(1).payload,title:' '}},{payload:{...project(1).payload,title:' not canonical '}},{payload:{...project(1).payload,title:'x'.repeat(141)}},{payload:{...project(1).payload,status:'Unknown'}},{payload:{...project(1).payload,separateRecurring:'yes'}}])assert.throws(()=>search([project(1,patch)]));
 for(const projectRows of [null,{},'projects',[null]])assert.throws(()=>search(projectRows));
});
test('combined inventory refuses duplicate IDs and an over-2000 bound before actions are issued',()=>{
 let issued=0;const action=()=>{issued++;return{projectReadToken:'t'.repeat(43)};};
 assert.throws(()=>search([project(1),project(1)],{projectAction:action}));assert.throws(()=>search([project(1)],{rows:[note(1)],projectAction:action}));
 const notes=Array.from({length:1999},(_,n)=>note(1000+n));assert.equal(search([project(1)],{rows:notes}).matchCount,2000);assert.throws(()=>search([project(1),project(2)],{rows:notes,projectAction:action}));assert.equal(issued,0);
});
test('project read capabilities are issued only to displayed matching projects and never expose detail fields',()=>{
 const rows=Array.from({length:120},(_,n)=>project(n+1)),seen=[];
 const result=search(rows,{rows:[note(999)],values:{query:'',type:'project',section:'Work',offset:50},projectAction:p=>{seen.push(p);assert.equal(p.payload.description,undefined);return{projectReadToken:'t'.repeat(43)};},recordAction:()=>{throw Error('Core recovery callbacks must never receive projects');},noteAction:()=>{throw Error('Note callback cannot receive a project');},taskAction:()=>{throw Error('Task callback cannot receive a project');},eventAction:()=>{throw Error('Event callback cannot receive a project');}});
 assert.equal(result.matchCount,120);assert.equal(result.results.length,50);assert.equal(seen.length,50);assert.equal(result.results[0].title,'Fictional project 051');assert.equal(result.results.at(-1).title,'Fictional project 100');assert.ok(result.results.every(r=>r.projectReadToken==='t'.repeat(43)));
 assert.equal(search(rows,{values:{query:'',type:'project',section:'Work',offset:100}}).results.length,20);
});
test('project callbacks cannot return write handles, details or malformed read capabilities',()=>{
 for(const offered of [null,{},[],{projectReadToken:'short'},{projectReadToken:'t'.repeat(43),payload:'PRIVATE_CALLBACK_BODY'},{editToken:'t'.repeat(43)},{projectReadToken:2}])assert.throws(()=>search([project(1)],{projectAction:()=>offered}));
 assert.throws(()=>search([project(1)],{projectAction:'not-a-function'}));
 let projects=0,notes=0,core=0;const result=search([project(1)],{rows:[note(2)],projectAction:()=>{projects++;return{projectReadToken:'p'.repeat(43)};},noteAction:()=>{notes++;return{noteToken:'n'.repeat(43)};},recordAction:()=>{core++;return{recordToken:'r'.repeat(43)};}});
 assert.equal(projects,1);assert.equal(notes,1);assert.equal(core,1);assert.equal(result.results.find(r=>r.type==='note').projectReadToken,undefined);assert.equal(result.results.find(r=>r.type==='project').recordToken,undefined);
});
