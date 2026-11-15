import {renderDevelopmentConnectionsLink} from '../src/dev-cloud-shell.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as model from '../src/dev-calendar-model.mjs';
import {escapeHtml,dayString,formatDate} from '../src/core.mjs';
import {validDay} from '../src/dev-brief-model.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const values={title:'Sample trip',day:'2026-11-08',time:'09:00',end_time:'10:00',calendar:'Personal',category:'Personal Life',reminder:'None',description:'Fictional notes'};
function screen(){
 const listeners={},root={innerHTML:'',addEventListener(name,fn){listeners[name]=fn;}};
 const source=readFileSync(new URL('../src/dev-calendar.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').split('(async()=>{try{const result=await fetch')[0];
 const c=vm.createContext({...model,e:escapeHtml,dayString,formatDate,validDay,structuredClone,renderDevelopmentConnectionsLink,location:{href:'http://127.0.0.1:5301/dev-calendar.html'},document:{getElementById:()=>root},renderConnectedShell:s=>s,FormData:class{constructor(form){this.values=form.values;}entries(){return Object.entries(this.values);}}});
 vm.runInContext(source,c);
 vm.runInContext(`user={id:'${owner}',email:'fictional@example.test'};auth={get:()=>true,getAccessToken:async()=> 'fixture',signOut:async()=>{}};api={listCalendarRecords:async()=>rows,listCalendarPreferences:async()=>[]};selected='2026-11-08';focus=selected;showAdd=true;show();`,c);
 const form=(v=values)=>({id:'cal-add-event',dataset:{},values:v});
 const input=f=>listeners.input({target:{form:f}});
 const click=(buttonId,dataset={})=>listeners.click({target:{closest:()=>({id:buttonId,dataset})}});
 return {c,root,listeners,form,input,click};
}
test('calendar invalid input and failed/unconfirmed saves retain complete drafts',async()=>{
 for(const operation of [`throw Error('offline')`,`return []`]){
  const s=screen();vm.runInContext(`api.addFictionalEvent=async()=>{${operation}};`,s.c);
  const v={...values,title:'Draft <trip>',description:'Keep & review'};
  s.input(s.form(v));
  await vm.runInContext('load()',s.c);
  assert.match(s.root.innerHTML,/Draft &lt;trip&gt;/);
  await vm.runInContext('writeEvent',s.c)(s.form(v));
  assert.equal(vm.runInContext('eventDraft.values.description',s.c),v.description);
  assert.equal(vm.runInContext('showAdd',s.c),true);
  assert.equal(vm.runInContext('busy',s.c),false);
  assert.match(vm.runInContext('error',s.c),/before retrying/);
 }
 const s=screen();await vm.runInContext('writeEvent',s.c)(s.form({...values,end_time:'08:00'}));
 assert.equal(vm.runInContext('eventDraft.values.end_time',s.c),'08:00');
 assert.match(vm.runInContext('error',s.c),/End time/);
});
test('blank event dates and times stay blank across rendering instead of acquiring defaults',()=>{
 const s=screen();s.input(s.form({...values,day:'',time:'',title:''}));vm.runInContext('show()',s.c);
 assert.match(s.root.innerHTML,/name="day" required value=""/);
 assert.match(s.root.innerHTML,/name="time" type="time" value=""/);
});
test('refresh never silently upgrades an open event draft to a newer record revision',async()=>{
 const s=screen();
 const original={id,version:2,...model.makeCalendarEvent(values,owner)};
 s.c.original=original;
 vm.runInContext(`rows=[original];showAdd=false;editing=original.id;eventDraft=null;show();`,s.c);
 s.input({...s.form({...values,title:'My unsaved edit'}),id:'cal-edit-event',dataset:{eventId:id}});
 vm.runInContext(`api.listCalendarRecords=async()=>[{...original,version:3,payload:{...original.payload,title:'Other tab edit'}}];api.updateCalendarEvent=async(token,record)=>{globalRecordVersion=record.version;return [];}`,s.c);
 await vm.runInContext('load()',s.c);
 assert.equal(vm.runInContext('rows[0].version',s.c),3);
 assert.equal(vm.runInContext('eventDraft.record.version',s.c),2);
 assert.equal(vm.runInContext('eventDraft.values.title',s.c),'My unsaved edit');
 await vm.runInContext('writeEvent',s.c)({...s.form({...values,title:'My unsaved edit'}),id:'cal-edit-event'},vm.runInContext('rows[0]',s.c));
 assert.equal(vm.runInContext('globalRecordVersion',s.c),2);
 assert.equal(vm.runInContext('eventDraft.values.title',s.c),'My unsaved edit');
 assert.match(vm.runInContext('error',s.c),/close and reopen/);
});
test('confirmed event save clears draft and a failed reload cannot claim fresh data',async()=>{
 const s=screen();vm.runInContext(`api.addFictionalEvent=async()=>[{}];api.listCalendarRecords=async()=>{throw Error('reload offline')}`,s.c);
 await vm.runInContext('writeEvent',s.c)(s.form());
 assert.equal(vm.runInContext('eventDraft',s.c),null);
 assert.equal(vm.runInContext('showAdd',s.c),false);
 assert.equal(vm.runInContext('notice',s.c),'');
 assert.match(vm.runInContext('error',s.c),/out of date/);
 assert.equal(vm.runInContext('busy||loading',s.c),false);
});
test('calendar preferences keep their draft and original revision through a refresh',async()=>{
 const s=screen();vm.runInContext(`prefsRecord={id:'${id}',version:2};prefs.view='week';dirty=true;api.listCalendarPreferences=async()=>[{id:'${id}',version:3,...makeCalendarPrefsRecord(user.id,{view:'day'})}];`,s.c);
 await vm.runInContext('load()',s.c);
 assert.equal(vm.runInContext('prefs.view',s.c),'week');
 assert.equal(vm.runInContext('prefsRecord.version',s.c),2);
 assert.equal(vm.runInContext('dirty',s.c),true);
});
test('calendar blocks event saves while loading and discards drafts on close/sign-out',async()=>{
 const s=screen();s.input(s.form());
 vm.runInContext(`loading=true;api.addFictionalEvent=async()=>{throw Error('must not save during load')}`,s.c);
 await vm.runInContext('writeEvent',s.c)(s.form());
 assert.equal(vm.runInContext('error',s.c),'');
 vm.runInContext('loading=false',s.c);s.click('cal-cancel-edit');
 assert.equal(vm.runInContext('eventDraft',s.c),null);
 s.click('cal-add-toggle');s.input(s.form());s.click('cal-signout');
 assert.equal(vm.runInContext('eventDraft',s.c),null);
 assert.equal(vm.runInContext('user',s.c),null);
});
