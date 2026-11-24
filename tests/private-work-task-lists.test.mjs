import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkTaskListPanel} from '../src/private-work-task-lists.mjs';

test('expired Work list selections disappear and cannot start a search before the timer fires',async t=>{
 let now=1000,expiresAt=2000,searches=0,expired=0;
 const choice='a'.repeat(43);
 const panel=createWorkTaskListPanel({client:{workListOptions:async()=>({offset:0,matchCount:1,expiresAt,lists:[{choice,name:'Saved Work list'}]})},
  clock:()=>now,escape:String,canUse:()=>true,onChange(){},onSearch(){searches++;},onExpire(){expired++;}});
 t.after(()=>panel.reset());
 const click=workListAction=>panel.click({target:{closest:()=>({dataset:{workListAction}})}});
 const turn=()=>new Promise(resolve=>setImmediate(resolve));
 click('refresh');await turn();
 assert.match(panel.render(),/Saved Work list/);
 panel.input({target:{dataset:{workListChoice:choice},checked:true}});
 now=expiresAt;
 assert.doesNotMatch(panel.render(),/Saved Work list|1 selected/);
 click('show');
 assert.equal(searches,0);
 assert.equal(expired,2);
 expiresAt=now+300001;
 click('refresh');await turn();
 assert.match(panel.render(),/could not be verified/);
 assert.doesNotMatch(panel.render(),/Saved Work list/);
});
