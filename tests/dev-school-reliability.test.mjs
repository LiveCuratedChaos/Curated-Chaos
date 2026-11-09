import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as model from '../src/dev-school-model.mjs';
import {escapeHtml} from '../src/core.mjs';
import {createDevApi} from '../src/dev-api.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const course=()=>({id,version:2,...model.makeSchoolCourse(owner,{title:'Practice class',assessments:[{title:'Assignment',tasks:[]}],studySessions:[]})});
function screen(){
 const listeners={},root={innerHTML:'',addEventListener(name,fn){listeners[name]=fn;}};
 const source=readFileSync(new URL('../src/dev-school.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').split('(async()=>{try{const res=await fetch')[0];
 const c=vm.createContext({...model,e:escapeHtml,structuredClone,document:{getElementById:()=>root},renderConnectedShell:s=>s,FormData:class{constructor(form){this.values=form.values;}entries(){return Object.entries(this.values);}}});
 vm.runInContext(source,c);c.fixture=course();
 vm.runInContext(`user={id:'${owner}',email:'fictional@example.test'};courses=[fixture];auth={getAccessToken:async()=> 'fixture',signOut:async()=>{}};api={listSchoolCourses:async()=>courses};editor={type:'study',courseId:'${id}'};show();`,c);
 const form=values=>({id:'school-quick-form',dataset:{},values});
 const input=f=>listeners.input({target:{form:f}});
 const submit=f=>vm.runInContext('submitSchoolForm',c)(f);
 return {c,root,listeners,form,input,submit};
}
test('school drafts survive a refresh and failed or unconfirmed save',async()=>{
 for(const result of [`throw Error('offline')`,`return []`]){
  const s=screen(),f=s.form({title:'Study <draft>',day:'2026-11-08',time:'10:30'});
  s.input(f);await vm.runInContext('load()',s.c);
  assert.match(s.root.innerHTML,/Study &lt;draft&gt;/);
  vm.runInContext(`api.updateSchoolCourse=async()=>{${result}}`,s.c);await s.submit(f);
  assert.equal(vm.runInContext('quickDraft.values.time',s.c),'10:30');
  assert.equal(vm.runInContext('editor.type',s.c),'study');
  assert.equal(vm.runInContext('busy',s.c),false);
  assert.ok(vm.runInContext('error.length>0',s.c));
 }
});
test('school details retain their original revision and unsaved fields after refresh',async()=>{
 const s=screen();vm.runInContext(`editor=null;quickDraft=null;showDetail=fixture.id;show();`,s.c);
 const f={id:'school-detail-form',dataset:{id},values:{notes:'Unsaved notes',code:'TEST',term:'1',credits:'3',targetDate:'2026-11-09'}};
 s.input(f);
 vm.runInContext(`api.listSchoolCourses=async()=>[{...fixture,version:3,payload:{...fixture.payload,notes:'Other tab'}}];api.updateSchoolCourse=async(token,record)=>{sentVersion=record.version;return [];}`,s.c);
 await vm.runInContext('load()',s.c);await s.submit(f);
 assert.equal(vm.runInContext('courses[0].version',s.c),3);
 assert.equal(vm.runInContext('sentVersion',s.c),2);
 assert.equal(vm.runInContext('detailDraft.values.notes',s.c),'Unsaved notes');
 assert.match(vm.runInContext('error',s.c),/latest version/);
});
test('school rejects invalid study dates and time without sending an update or losing the draft',async()=>{
 const s=screen();vm.runInContext(`api.updateSchoolCourse=async()=>{throw Error('Must not send invalid data')}`,s.c);
 for(const v of [{title:'Study',day:'2026-02-30',time:''},{title:'Study',day:'',time:''},{title:'Study',day:'2026-11-08',time:'25:00'}]){
  await s.submit(s.form(v));
  assert.equal(vm.runInContext('quickDraft.values.day',s.c),v.day);
  assert.doesNotMatch(vm.runInContext('error',s.c),/Must not send/);
  assert.ok(vm.runInContext('error.length>0',s.c));
 }
 assert.throws(()=>model.degreePayload({title:'Degree',targetDate:'2026-02-29'}),/valid school date/);
 assert.equal(model.schoolPayload({title:'Class',targetDate:'2028-02-29'}).targetDate,'2028-02-29');
});
test('school capacity limits reject the whole addition instead of silently dropping it',async()=>{
 const s=screen();
 vm.runInContext(`fixture.payload.studySessions=Array.from({length:50},()=>({title:'Existing',day:'2026-11-08',time:''}));quickDraft=null;show();api.updateSchoolCourse=async()=>{throw Error('Must not PATCH')};`,s.c);
 await s.submit(s.form({title:'One too many',day:'2026-11-09',time:''}));
 assert.match(vm.runInContext('error',s.c),/50 study sessions/);
 assert.equal(vm.runInContext('quickDraft.values.title',s.c),'One too many');
 assert.equal(vm.runInContext('fixture.payload.studySessions.length',s.c),50);
 assert.throws(()=>model.schoolPayload({title:'Class',assessments:Array.from({length:26},()=>({title:'Assignment'}))}),/25 assignments/);
 assert.throws(()=>model.schoolPayload({title:'Class',assessments:[{title:'Assignment',tasks:Array.from({length:21},()=>({title:'Step'}))}]}),/20 steps/);
});
test('a checklist save retains unrelated school editor drafts; a submitted save clears only its form',async()=>{
 const s=screen(),f=s.form({title:'Draft study',day:'2026-11-08',time:''});s.input(f);
 vm.runInContext(`api.updateSchoolCourse=async()=>[{}]`,s.c);
 await vm.runInContext('updateCourse',s.c)(id,p=>{p.status='Completed';});
 assert.equal(vm.runInContext('quickDraft.values.title',s.c),'Draft study');
 assert.equal(vm.runInContext('editor.type',s.c),'study');
 // Reopen deliberately to use the latest revision for the submitted form.
 vm.runInContext('quickDraft=null;show()',s.c);s.input(f);await s.submit(f);
 assert.equal(vm.runInContext('quickDraft',s.c),null);
 assert.equal(vm.runInContext('editor',s.c),null);
});
test('sign-out clears all school drafts and deleted records stay out of the tracker',()=>{
 const s=screen();s.input(s.form({title:'Private draft',day:'2026-11-08',time:''}));
 s.listeners.click({target:{closest:()=>({dataset:{action:'signout'}})}});
 assert.equal(vm.runInContext('quickDraft',s.c),null);
 assert.equal(vm.runInContext('detailDraft',s.c),null);
 assert.doesNotMatch(s.root.innerHTML,/Private draft/);
 assert.equal(model.normalizeSchoolCourses([{...course(),deleted_at:'2026-11-08'}],owner).length,0);
 const degree={id,...model.makeSchoolDegree(owner,{title:'Degree'}),deleted_at:'2026-11-08'};
 assert.equal(model.normalizeSchoolDegrees([degree],owner).length,0);
});
test('school reads and versioned updates exclude deleted and household records at the API',async()=>{
 const calls=[],api=createDevApi({supabaseUrl:'https://aaaaaaaaaaaa.supabase.co',projectRef:'aaaaaaaaaaaa',publishableKey:'sb_publishable_test'},async url=>{calls.push(new URL(url));return {ok:true,text:async()=> '[]'};});
 await api.listSchoolCourses('fixture',owner);
 await api.updateSchoolCourse('fixture',course(),owner,course().payload);
 for(const url of calls){
  assert.equal(url.searchParams.get('deleted_at'),'is.null');
  assert.equal(url.searchParams.get('household_id'),'is.null');
  assert.equal(url.searchParams.get('section'),'eq.School');
  assert.equal(url.searchParams.get('owner_id'),'eq.'+owner);
 }
 assert.equal(calls[1].searchParams.get('version'),'eq.2');
});
test('school refresh cannot start an old-account read after a delayed token returns',async()=>{
 const s=screen();let release,reads=0;s.c.wait=new Promise(resolve=>release=resolve);s.c.read=async()=>{reads++;return[];};vm.runInContext('auth.getAccessToken=()=>wait;api.listSchoolCourses=read',s.c);const pending=vm.runInContext('load()',s.c);vm.runInContext('generation++;user=null',s.c);release('old-fixture');await pending;assert.equal(reads,0);
});
