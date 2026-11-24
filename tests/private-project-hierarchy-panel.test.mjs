import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateProjectHierarchyPanel} from '../src/private-project-hierarchy-panel.mjs';
import {projectProgress} from '../src/project-progress.mjs';
const selected='s'.repeat(43),choice='c'.repeat(43),viewId='v'.repeat(43),reviewId='r'.repeat(43),settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({volume=1}={}){
 let now=0,usable=true;const calls=[],changes=[];
 const projects=Array.from({length:volume},(_,i)=>({projectToken:i===0?choice:String(i).padStart(43,'0'),title:'Fictional child '+i,section:'Home',status:'Planned',linked:false}));
 const client={async projectHierarchyList(v){calls.push(['list',v]);return {...v,projectTitle:'Fictional root',projects:projects.slice(v.offset,v.offset+50),matchCount:projects.length,limit:50,viewId,expiresAt:100,descendantCount:0,progress:projectProgress([])};},async projectHierarchyReview(v){calls.push(['review',v]);return {reviewId,parentTitle:direction()==='children'?'Fictional root':'Fictional child 0',childTitle:direction()==='children'?'Fictional child 0':'Fictional root',linked:v.linked,expiresAt:100};},async projectHierarchySave(v){calls.push(['save',v]);return {saved:true,linked:true};},async projectHierarchyCancel(){calls.push(['cancel']);}};
 const direction=()=>calls.filter(c=>c[0]==='list').at(-1)[1].direction;
 const panel=createPrivateProjectHierarchyPanel({client,clock:()=>now,canUse:()=>usable,onChange:f=>changes.push(f)});
 const click=async selector=>{panel.click({target:{closest:s=>s===selector?{}:null}});await settle();};
 const choose=async()=>{panel.click({target:{closest:s=>s==='[data-project-hierarchy]'?{dataset:{projectHierarchy:choice}}:null}});await settle();};
 return{panel,client,calls,changes,click,choose,projects,setNow:v=>now=v,setUsable:v=>usable=v,query:v=>panel.input({target:{name:'project-hierarchy-query',value:v}}),open:()=>panel.open(selected,'Fictional root')};
}
test('hierarchy list is explicitly opened, escaped and labels deduplicated progress',async()=>{const f=fixture();assert.equal(f.panel.render(),'');assert.equal(f.calls.length,0);await f.open();assert.equal(f.panel.blocked(),true);assert.match(f.panel.render(),/each shared task counted once/);assert.match(f.panel.render(),/Browse larger projects/);assert.match(f.panel.render(),/Project statuses stay under your control/);});
test('adding a child needs separate review and single explicit approval',async()=>{const f=fixture();await f.open();await f.choose();assert.deepEqual(f.calls.map(c=>c[0]),['list','review']);assert.match(f.panel.render(),/Larger project: <strong>Fictional root/);assert.match(f.panel.render(),/Subproject: <strong>Fictional child 0/);await f.click('#private-project-hierarchy-save');await f.click('#private-project-hierarchy-save');assert.equal(f.calls.filter(c=>c[0]==='save').length,1);assert.match(f.panel.render(),/Project relationship saved/);});
test('larger-project browsing reverses review direction without copying records',async()=>{const f=fixture();await f.open();await f.click('#private-project-hierarchy-mode');assert.equal(f.calls.at(-1)[1].direction,'parents');assert.match(f.panel.render(),/Review adding larger project/);await f.choose();assert.match(f.panel.render(),/Larger project: <strong>Fictional child 0/);assert.match(f.panel.render(),/Subproject: <strong>Fictional root/);});
test('cancelling a relationship review never saves and reloads its choices',async()=>{const f=fixture();await f.open();await f.choose();await f.click('#private-project-hierarchy-cancel');assert.equal(f.calls.filter(c=>c[0]==='save').length,0);assert.equal(f.calls.filter(c=>c[0]==='cancel').length,1);assert.doesNotMatch(f.panel.render(),/Approve project relationship change/);});
test('uncertain hierarchy save locks mutation until explicit fetch with no retry',async()=>{const f=fixture();f.client.projectHierarchySave=async()=>{f.calls.push(['save']);throw Error('fictional disconnect');};await f.open();await f.choose();await f.click('#private-project-hierarchy-save');await f.click('#private-project-hierarchy-save');assert.equal(f.calls.filter(c=>c[0]==='save').length,1);assert.match(f.panel.render(),/may have saved/);await f.click('#private-project-hierarchy-refresh');await f.choose();assert.equal(f.calls.filter(c=>c[0]==='review').length,2);});
test('expired list gives an actionable error without starting a review',async()=>{const f=fixture();await f.open();f.setNow(101);await f.choose();assert.match(f.panel.render(),/Project structure expired/);assert.equal(f.calls.filter(c=>c[0]==='review').length,0);assert.equal(f.changes.at(-1),'#private-project-hierarchy-error');});
test('expired review never saves and retains explicit fetch recovery',async()=>{const f=fixture();await f.open();await f.choose();f.setNow(101);await f.click('#private-project-hierarchy-save');assert.match(f.panel.render(),/Review expired/);assert.equal(f.calls.filter(c=>c[0]==='save').length,0);assert.match(f.panel.render(),/Fetch project structure/);});
test('reset during pending read discards old-account result',async()=>{const f=fixture();let release;f.client.projectHierarchyList=()=>new Promise(resolve=>release=resolve);const pending=f.open();f.panel.reset();release({});await pending;assert.equal(f.panel.render(),'');assert.equal(f.panel.blocked(),false);});
test('reset during pending reviewed save cannot restore old private content',async()=>{const f=fixture();await f.open();await f.choose();let release;f.client.projectHierarchySave=()=>new Promise(resolve=>release=resolve);const action=f.click('#private-project-hierarchy-save');f.panel.reset();release({saved:true,linked:true});await action;assert.equal(f.panel.render(),'');assert.equal(f.calls.filter(c=>c[0]==='list').length,1);});
test('editing search before Next or Previous restarts the new hierarchy query',async()=>{const f=fixture({volume:120});await f.open();f.query('new');await f.click('#private-project-hierarchy-next');assert.equal(f.calls.at(-1)[1].offset,0);await f.click('#private-project-hierarchy-next');await f.click('#private-project-hierarchy-next');assert.equal(f.calls.at(-1)[1].offset,100);f.query('changed');await f.click('#private-project-hierarchy-prev');assert.equal(f.calls.at(-1)[1].offset,0);});
test('malformed progress, duplicate choices or same selected token fail closed',async()=>{for(const change of [v=>v.progress.total=1,v=>{v.projects=[v.projects[0],v.projects[0]];v.matchCount=2;},v=>v.projects[0].projectToken=selected]){const f=fixture(),original=f.client.projectHierarchyList;f.client.projectHierarchyList=async x=>{const v=await original(x);change(v);return v;};await f.open();assert.match(f.panel.render(),/role="alert"/);assert.doesNotMatch(f.panel.render(),/data-project-hierarchy=/);}});
test('offline clears private choices and review without retrying mutations',async()=>{const f=fixture();await f.open();await f.choose();f.panel.offline();assert.match(f.panel.render(),/Offline/);assert.doesNotMatch(f.panel.render(),/Fictional child 0/);await f.click('#private-project-hierarchy-save');assert.equal(f.calls.filter(c=>c[0]==='save').length,0);});
test('confirmed save with failed refresh reports stale view rather than verified progress',async()=>{const f=fixture();await f.open();await f.choose();f.client.projectHierarchyList=async()=>{throw Error('Fictional reload unavailable');};await f.click('#private-project-hierarchy-save');assert.match(f.panel.render(),/saved, but the updated structure could not be fetched/);assert.doesNotMatch(f.panel.render(),/distinct linked task/);});
test('loss of allowed session blocks approval and disposal removes the panel',async()=>{const f=fixture();await f.open();await f.choose();f.setUsable(false);await f.click('#private-project-hierarchy-save');assert.equal(f.calls.filter(c=>c[0]==='save').length,0);f.panel.dispose();assert.equal(f.panel.render(),'');});

test('default permission gate and unsupported selected titles never start reads',async()=>{
 let reads=0;const panel=createPrivateProjectHierarchyPanel({client:{projectHierarchyList:async()=>{reads++;}}});await panel.open(selected,'Fictional root');assert.equal(reads,0);assert.equal(panel.render(),'');panel.dispose();
 const f=fixture();for(const title of ['', ' noncanonical ', 'x'.repeat(141), 'bad\ncontrol'])await f.panel.open(selected,title);assert.equal(f.calls.length,0);f.panel.dispose();
});
test('list expiry cannot exceed five minutes and malformed titles or foreign root identities never display choices',async()=>{
 for(const change of [v=>v.expiresAt=300001,v=>v.projectTitle='Foreign root',v=>v.projects[0].title=' bad ',v=>v.projects[0].title='bad\ncontrol',v=>v.projects[0].title='x'.repeat(141)]){
  const f=fixture(),original=f.client.projectHierarchyList;f.client.projectHierarchyList=async x=>{const value=await original(x);change(value);return value;};await f.open();assert.match(f.panel.render(),/could not be verified/);assert.doesNotMatch(f.panel.render(),/data-project-hierarchy=/);f.panel.dispose();
 }
});
test('review cannot extend list lifetime or swap source and target titles',async()=>{
 for(const patch of [{expiresAt:101},{expiresAt:300001},{parentTitle:'Foreign parent'},{childTitle:'Foreign child'},{linked:false},{reviewId:'bad'}]){
  const f=fixture(),original=f.client.projectHierarchyReview;f.client.projectHierarchyReview=async x=>({...await original(x),...patch});await f.open();await f.choose();assert.doesNotMatch(f.panel.render(),/Approve project relationship change/);await f.click('#private-project-hierarchy-save');assert.equal(f.calls.filter(c=>c[0]==='save').length,0);f.panel.dispose();
 }
});
test('multiple active master choices fail closed without modifying anything',async()=>{
 const f=fixture({volume:2});await f.open();f.projects.forEach(p=>p.linked=true);await f.click('#private-project-hierarchy-mode');assert.match(f.panel.render(),/could not be verified/);assert.doesNotMatch(f.panel.render(),/data-project-hierarchy=/);f.panel.dispose();
});
test('permission loss while a list or review is pending cannot expose its reply',async()=>{
 for(const operation of ['list','review']){
  const f=fixture();let release;if(operation==='list'){f.client.projectHierarchyList=()=>new Promise(r=>release=r);const pending=f.open();f.setUsable(false);release({});await pending;}else{await f.open();f.client.projectHierarchyReview=()=>new Promise(r=>release=r);const pending=f.choose();f.setUsable(false);release({reviewId,parentTitle:'Fictional root',childTitle:'Fictional child 0',linked:true,expiresAt:100});await pending;}
  assert.equal(f.panel.render(),'');assert.equal(f.calls.filter(c=>c[0]==='save').length,0);f.panel.dispose();
 }
});
test('offline or reset during a pending save blocks new mutation until that attempt settles',async()=>{
 for(const mode of ['offline','reset']){
  const f=fixture();await f.open();await f.choose();let release;f.client.projectHierarchySave=()=>{f.calls.push(['save']);return new Promise(r=>release=r);};const pending=f.click('#private-project-hierarchy-save');f.panel[mode]();await f.click('#private-project-hierarchy-refresh');await f.open();await f.click('#private-project-hierarchy-save');assert.equal(f.calls.filter(c=>c[0]==='save').length,1);assert.equal(f.calls.filter(c=>c[0]==='list').length,1);assert.equal(f.panel.blocked(),true);release({saved:true,linked:true});await pending;
  if(mode==='reset')assert.equal(f.panel.render(),'');else assert.match(f.panel.render(),/Offline/);assert.equal(f.calls.filter(c=>c[0]==='list').length,1);f.panel.dispose();
 }
});

test('stale hierarchy save completion notifies parent to unblock without restoring content or focus',async()=>{
 for(const mode of ['offline','reset'])for(const failed of [false,true]){
  const f=fixture();await f.open();await f.choose();let resolveSave,rejectSave;f.client.projectHierarchySave=()=>{f.calls.push(['save']);return new Promise((resolve,reject)=>{resolveSave=resolve;rejectSave=reject;});};await f.click('#private-project-hierarchy-save');f.panel[mode]();const before=f.changes.length;
  if(failed)rejectSave(Error('Fictional uncertain response'));else resolveSave({saved:true,linked:true});await settle();await settle();
  assert.ok(f.changes.length>before);assert.equal(f.changes.at(-1),undefined);assert.equal(f.calls.filter(c=>c[0]==='list').length,1);assert.equal(f.calls.filter(c=>c[0]==='save').length,1);
  if(mode==='reset'){assert.equal(f.panel.blocked(),false);assert.equal(f.panel.render(),'');}else{assert.match(f.panel.render(),/Offline/);assert.doesNotMatch(f.panel.render(),/Fictional child 0|Project relationship saved/);await f.click('#private-project-hierarchy-refresh');assert.equal(f.calls.filter(c=>c[0]==='list').length,2);}
  f.panel.dispose();
 }
});
test('permission loss during hierarchy acknowledgement releases busy but cannot revive success or auto-fetch',async()=>{
 const f=fixture();await f.open();await f.choose();let release;f.client.projectHierarchySave=()=>{f.calls.push(['save']);return new Promise(resolve=>release=resolve);};await f.click('#private-project-hierarchy-save');f.setUsable(false);release({saved:true,linked:true});await settle();await settle();assert.equal(f.panel.render(),'');assert.equal(f.changes.at(-1),undefined);assert.equal(f.calls.filter(c=>c[0]==='list').length,1);
 f.setUsable(true);assert.doesNotMatch(f.panel.render(),/Project relationship saved/);await f.click('#private-project-hierarchy-save');assert.equal(f.calls.filter(c=>c[0]==='save').length,1);await f.click('#private-project-hierarchy-refresh');assert.equal(f.calls.filter(c=>c[0]==='list').length,2);f.panel.dispose();
});

test('expired hierarchy review hides child names and progress and requires a fresh structure read',async t=>{
 const f=fixture();t.after(()=>f.panel.dispose());
 await f.open();await f.choose();
 assert.match(f.panel.render(),/Approve project relationship change/);
 assert.match(f.panel.render(),/Fictional child 0/);
 f.setNow(100);
 assert.doesNotMatch(f.panel.render(),/Fictional child 0|Progress including subprojects|Approve project relationship change/);
 assert.match(f.panel.render(),/Review expired/);
 await f.click('#private-project-hierarchy-save');
 assert.equal(f.calls.some(([action])=>action==='save'),false);
});
