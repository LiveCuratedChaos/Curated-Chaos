import test from 'node:test';import assert from 'node:assert/strict';import {createPrivateWidgetSourcePicker} from '../server/private-widget-source-picker.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now=Date.parse('2026-11-21T12:00:00Z');
const id=n=>'11111111-1111-4111-a111-'+String(n).padStart(12,'0');
const note=(n,title='Fictional note')=>({id:id(n),owner_id:owner,household_id:null,visibility:'private',section:'Personal Life',item_type:'note',origin:'M2B_DEV_NOTES',version:3,deleted_at:null,payload:{fictional:true,title,body:'Private note body',extension:'never expose'}});
const project=(n,title='Fictional project')=>({id:id(n),owner_id:owner,household_id:null,visibility:'private',section:'Work',item_type:'project',origin:'PRIVATE_COOKIE_PROJECT',version:4,created_at:'2026-11-01T12:00:00.123456Z',deleted_at:null,payload:{fictional:true,schemaVersion:1,title,status:'Active',description:'Private project description'}});
function setup(t){const state={clock:now,notes:[note(1)],projects:[project(2)],reads:0},api={listPrivateBriefRecords:async()=>structuredClone(state.notes),listPrivateProjects:async()=>structuredClone(state.projects),getPrivateNote:async(_token,key)=>{state.reads++;return structuredClone(state.notes.filter(r=>r.id===key));},getPrivateProject:async(_token,key)=>{state.reads++;return structuredClone(state.projects.filter(r=>r.id===key));}},picker=createPrivateWidgetSourcePicker({api,now:()=>state.clock}),actor={ownerId:owner,accessToken:'fictional'};t.after(()=>picker.dispose());return{state,api,picker,actor};}

test('source options expose only sparse titles and expiring opaque selectors; selected rows stay server-side',async t=>{
 const s=setup(t),options=await s.picker.list('widget-context',s.actor,now+600000);assert.equal(options.notes.length,1);assert.equal(options.projects.length,1);assert.equal(options.expiresAt,now+300000);
 for(const option of [...options.notes,...options.projects])assert.match(option.selectionToken,/^[A-Za-z0-9_-]{43}$/);
 assert.deepEqual(Object.keys(options.notes[0]).sort(),['section','selectionToken','title']);assert.deepEqual(Object.keys(options.projects[0]).sort(),['section','selectionToken','status','title']);
 assert.doesNotMatch(JSON.stringify(options),new RegExp(owner+'|'+id(1)+'|'+id(2)+'|Private note body|Private project description|extension|payload'));
 const selectedNote=await s.picker.selected('widget-context',s.actor,'note',options.notes[0].selectionToken);assert.equal(selectedNote.record.id,id(1));assert.equal(selectedNote.record.payload.body,'Private note body');
 const selectedProject=await s.picker.selected('widget-context',s.actor,'project',options.projects[0].selectionToken);assert.equal(selectedProject.record.id,id(2));assert.equal(selectedProject.expiresAt,options.expiresAt);
 assert.equal(s.state.reads,2);
});

test('wrong type, owner, context, expired or refreshed selectors cannot resolve',async t=>{
 for(const mode of ['type','owner','context','expiry','refresh']){const s=setup(t),options=await s.picker.list('widget-context',s.actor,now+600000),token=options.notes[0].selectionToken;if(mode==='expiry')s.state.clock=options.expiresAt+1;if(mode==='refresh')await s.picker.list('widget-context',s.actor,now+600000);await assert.rejects(s.picker.selected(mode==='context'?'other':'widget-context',mode==='owner'?{...s.actor,ownerId:other}:s.actor,mode==='type'?'project':'note',token));assert.equal(s.state.reads,0);}
});

test('changed/deleted sources and invalid list scopes fail closed',async t=>{
 const s=setup(t),options=await s.picker.list('widget-context',s.actor,now+600000),token=options.notes[0].selectionToken;s.state.notes[0].version++;
 await assert.rejects(s.picker.selected('widget-context',s.actor,'note',token),/changed/);
 const fresh=await s.picker.list('widget-context',s.actor,now+600000);s.state.notes=[];
 await assert.rejects(s.picker.selected('widget-context',s.actor,'note',fresh.notes[0].selectionToken),/unavailable/);
 await assert.rejects(s.picker.list('expired-context',s.actor,now));
});

test('expired, malformed, foreign or over-limit inventories clear the selector state',async t=>{
 for(const mode of ['notes','projects','foreign']){const s=setup(t),before=await s.picker.list('widget-context',s.actor,now+600000),old=before.notes[0].selectionToken;if(mode==='notes')s.api.listPrivateBriefRecords=async()=>Array.from({length:2001},(_,n)=>note(n+1));if(mode==='projects')s.api.listPrivateProjects=async()=>Array.from({length:251},(_,n)=>project(n+1));if(mode==='foreign')s.state.notes=[{...note(3),owner_id:other}];if(mode==='foreign')assert.deepEqual((await s.picker.list('widget-context',s.actor,now+600000)).notes,[]);else await assert.rejects(s.picker.list('widget-context',s.actor,now+600000));await assert.rejects(s.picker.selected('widget-context',s.actor,'note',old));}
 const expired=setup(t);await assert.rejects(expired.picker.list('widget-context',expired.actor,now));
});

test('native title-only note projections can be selected and only the matching full original can be linked or reopened',async t=>{
 const s=setup(t),original=s.state.notes[0],alias=id(19);
 s.api.listPrivateBriefRecords=async()=>[{...original,payload:{fictional:true,title:original.payload.title}}];
 s.api.resolveWidgetSourceAssociation=async()=>[{record_id:original.id,item_type:'note'}];
 const options=await s.picker.list('widget-context',s.actor,now+300000);assert.equal(options.notes.length,1);assert.equal(s.state.reads,0);
 const select=()=>s.picker.selected('widget-context',s.actor,'note',options.notes[0].selectionToken);
 assert.equal((await select()).record.id,original.id);assert.equal((await s.picker.resolve('widget-context',s.actor,alias)).record.id,original.id);
 for(const row of [{...original,id:id(55)},{...original,payload:{fictional:true,title:original.payload.title}},{...original,owner_id:other}]){
  s.api.getPrivateNote=async()=>[row];await assert.rejects(select());await assert.rejects(s.picker.resolve('widget-context',s.actor,alias));
 }
 s.api.resolveWidgetSourceAssociation=async()=>[{record_id:id(2),item_type:'project'}];s.api.getPrivateProject=async()=>[project(8)];await assert.rejects(s.picker.resolve('widget-context',s.actor,alias));
});
test('a late inventory reply cannot retire a newer picker for the same session',async t=>{
 const s=setup(t);let finish;
 s.api.listPrivateBriefRecords=()=>new Promise(resolve=>{finish=resolve;});
 const old=s.picker.list('picker',s.actor,now+300000);s.api.listPrivateBriefRecords=async()=>[note(1)];
 const fresh=await s.picker.list('picker',s.actor,now+300000);finish([]);await assert.rejects(old);
 assert.equal((await s.picker.selected('picker',s.actor,'note',fresh.notes[0].selectionToken)).record.id,id(1));
});
