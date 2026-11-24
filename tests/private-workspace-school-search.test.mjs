import test from 'node:test';import assert from 'node:assert/strict';
import {privateWorkspaceSearch,privateSearchFields} from '../server/private-workspace-search.mjs';
import {savedSearchFilters,createPrivateSavedSearches} from '../server/private-saved-searches.mjs';
import {makeSchoolCourse,makeSchoolDegree} from '../src/dev-school-model.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now=Date.parse('2026-11-18T12:00:00Z'),values={query:'',type:'school',section:'all',status:'all'};
function row(n){return{...makeSchoolCourse(owner,{title:'Course '+String(n).padStart(4,'0'),notes:'SECRET_BODY'}),id:'11111111-1111-4111-a111-'+String(n).padStart(12,'0'),version:1,created_at:'2026-11-18T12:00:00.000001Z',updated_at:'2026-11-18T12:00:00.000001Z',deleted_at:null};}
const run=(schoolRows,extra={})=>privateWorkspaceSearch({rows:[],schoolRows,ownerId:owner,values,now,includeSchool:true,...extra});
test('School search scope is explicit and rejects conflicting task, date and area filters',()=>{assert.throws(()=>privateSearchFields(values));for(const patch of [{section:'Work'},{status:'open'},{priority:'high'},{dateFrom:'2026-11-18'},{dateStatus:'undated'}])assert.throws(()=>privateSearchFields({...values,...patch},{allowSchool:true,allowPriority:true,allowDateRange:true,allowUndated:true}));assert.equal(privateSearchFields(values,{allowSchool:true}).type,'school');assert.throws(()=>run([row(1)],{includeSchool:false}));});
test('School title results stay sparse and issue only read authority for displayed original source rows',()=>{const rows=Array.from({length:53},(_,i)=>row(i+1)),seen=[];const result=run(rows,{schoolAction:r=>{seen.push(r);return{schoolReadToken:'s'.repeat(43)};},recordAction:()=>{throw Error('No recovery authority');}});assert.equal(result.matchCount,53);assert.equal(seen.length,50);assert.equal(seen[0],rows[0]);assert.equal(seen[0].payload.notes,'SECRET_BODY');assert.deepEqual(Object.keys(result.results[0]).sort(),['schoolKind','schoolReadToken','section','title','type']);assert.doesNotMatch(JSON.stringify(result),/SECRET_BODY|owner_id|degreeId|payload|11111111/);assert.equal(run(rows,{values:{...values,query:'SECRET_BODY'}}).matchCount,0);assert.equal(run(rows,{values:{...values,offset:50}}).results.length,3);assert.throws(()=>run(rows,{values:{...values,offset:100}}));assert.throws(()=>run(rows,{schoolAction:()=>({editToken:'s'.repeat(43)})}));});
test('School inventory is complete bounded canonical and globally unique',()=>{const rows=Array.from({length:2000},(_,i)=>row(i+1));assert.equal(run(rows,{values:{...values,offset:1950}}).results.length,50);assert.throws(()=>run([...rows,row(2001)]));assert.throws(()=>run([row(1),row(1)]));for(const patch of [{owner_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},{deleted_at:'2026-11-18T12:00:00Z'},{origin:'other'},{updated_at:'2026-02-30T12:00:00Z'}])assert.throws(()=>run([{...row(1),...patch}]));assert.throws(()=>run([row(1)],{rows:[{...row(1),item_type:'task'}]}));});
test('School saved filters are canonical but offers require currently enabled School scope',()=>{const filters=savedSearchFilters(values);assert.equal(filters.type,'school');assert.equal(filters.priority,'all');assert.equal(filters.dateFrom,'');const api=Object.fromEntries(['getPrivateSavedSearch','listPrivateSavedSearches','addPrivateSavedSearch','updatePrivateSavedSearch','setPrivateSavedSearchDeletedAt'].map(k=>[k,async()=>[]]));const off=createPrivateSavedSearches({api,now:()=>now}),on=createPrivateSavedSearches({api,now:()=>now,allowSchool:true});try{assert.throws(()=>off.offer('c',owner,filters,now+1000));assert.match(on.offer('c',owner,filters,now+1000).saveSearchToken,/^[A-Za-z0-9_-]{43}$/);}finally{off.dispose();on.dispose();}});
test('disabled School scope issues no selections for active or removed School shortcuts',async t=>{
 const record={id:'11111111-1111-4111-a111-000000000001',owner_id:owner,household_id:null,visibility:'private',section:'Personal Life',item_type:'saved_search',origin:'PRIVATE_COOKIE_SAVED_SEARCH',version:1,created_at:'2026-11-18T12:00:00Z',deleted_at:null,payload:{fictional:true,source:'PRIVATE_SAVED_SEARCH_V1',schemaVersion:1,title:'Courses',filters:savedSearchFilters(values)}};
 let fetches=0;
 const unexpected=()=>{throw Error('Unexpected mutation');};
 const api={
  listPrivateSavedSearches:async()=>[structuredClone(record)],
  getPrivateSavedSearch:async()=>{fetches++;return [structuredClone(record)];},
  addPrivateSavedSearch:unexpected,updatePrivateSavedSearch:unexpected,setPrivateSavedSearchDeletedAt:unexpected
 };
 const service=createPrivateSavedSearches({api,now:()=>now});t.after(()=>service.dispose());
 const actor={ownerId:owner,accessToken:'fictional'};
 for(const removed of [false,true]){
  record.deleted_at=removed?new Date(now).toISOString():null;
  const page=await service.list('c',actor,now+1000,{removed});
  assert.equal(page.matchCount,0);assert.deepEqual(page.records,[]);
  assert.doesNotMatch(JSON.stringify(page),/Courses|savedSearchToken/);
 }
 assert.equal(fetches,0);
});

test('course and program counts and readable handles are scoped before paging identical titles',()=>{
 const courses=Array.from({length:52},(_,i)=>row(i+1));
 const programs=Array.from({length:51},(_,i)=>({...row(100+i),...makeSchoolDegree(owner,{title:'Shared title',progressMetric:'terms'})}));
 for(const course of courses)course.payload.title='Shared title';
 const rows=[...programs,...courses];
 for(const [type,kind,count] of [['school-course','course',52],['school-program','degree',51]]){
  const issued=[];
  const page=run(rows,{values:{...values,type,query:'Shared title',offset:50},schoolAction:source=>{issued.push(source.id);return {schoolReadToken:'t'.repeat(43)};}});
  assert.equal(page.matchCount,count);assert.equal(page.results.length,count-50);
  assert.ok(page.results.every(result=>result.type==='school'&&result.schoolKind===kind));
  assert.equal(issued.length,count-50);
  const expected=type==='school-course'?courses:programs;
  assert.ok(issued.every(id=>expected.some(row=>row.id===id)));
  assert.equal(savedSearchFilters({...values,type}).type,type);
  assert.throws(()=>privateSearchFields({...values,type}));
  assert.throws(()=>privateSearchFields({...values,type,section:'Work'},{allowSchool:true}));
 }
});
