import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateProjectPanel} from '../src/private-project-panel.mjs';
import {verifyPrivateRecoveryList,verifyPrivateRecoveryReview} from '../src/private-record-recovery-view.mjs';
const now=Date.parse('2026-11-17T12:00:00Z'),key='p'.repeat(43),record='r'.repeat(43);
const turn=()=>new Promise(resolve=>setImmediate(resolve));
async function setup(t,{allowRecovery=true,patch={}}={}){
 let clock=now,allowed=true,release;const removed=[],requests=[];
 const client={projectsList:async values=>{requests.push(values);return{query:'',section:'all',status:'all',offset:0,limit:50,matchCount:1,viewId:'v'.repeat(43),expiresAt:now+300000,projects:[{projectToken:key,title:'Fictional private project',section:'Work',status:'Active',...(allowRecovery?{recordToken:record}:{}),...patch}]};}};
 const panel=createPrivateProjectPanel({client,clock:()=>clock,allowRecovery,canUse:()=>allowed,onReviewRemoval:token=>removed.push(token)});t.after(()=>panel.dispose());
 const click=(selector,dataset={})=>panel.click({target:{closest:q=>q===selector?{dataset}:null}});
 click('#private-projects-open');await turn();return{panel,removed,requests,client,click,setClock:value=>clock=value,setAllowed:value=>allowed=value};
}
test('project removal is separately reviewed from a displayed opaque handle and unavailable while expired or blocked',async t=>{
 const s=await setup(t);assert.match(s.panel.render(),/Review project removal/);assert.equal(s.removed.length,0);
 s.click('[data-project-remove]',{projectRemove:'x'.repeat(43)});assert.equal(s.removed.length,0);
 s.setAllowed(false);s.click('[data-project-remove]',{projectRemove:record});assert.equal(s.removed.length,0);
 s.setAllowed(true);s.setClock(now+300001);s.click('[data-project-remove]',{projectRemove:record});assert.equal(s.removed.length,0);
 s.setClock(now);s.click('[data-project-remove]',{projectRemove:record});assert.deepEqual(s.removed,[record]);
});
test('project removal never replaces an unsaved project draft or revives an offline selection',async t=>{
 const s=await setup(t);s.click('#private-project-new');s.panel.input({target:{name:'project-title',value:'Keep my draft'}});
 s.click('[data-project-remove]',{projectRemove:record});assert.equal(s.removed.length,0);assert.match(s.panel.render(),/Keep my draft/);
 s.panel.offline();s.click('[data-project-remove]',{projectRemove:record});assert.equal(s.removed.length,0);assert.match(s.panel.render(),/Keep my draft/);
});
test('project recovery is opt-in and malformed removal capabilities fail before showing actions',async t=>{
 const off=await setup(t,{allowRecovery:false});assert.doesNotMatch(off.panel.render(),/Review project removal/);off.click('[data-project-remove]',{projectRemove:record});assert.equal(off.removed.length,0);
 for(const patch of [{recordToken:'invalid'},{recordToken:undefined}]){const s=await setup(t,{patch});assert.match(s.panel.render(),/Projects could not be verified/);assert.doesNotMatch(s.panel.render(),/Review project removal/);}
});
test('Recently Deleted accepts only explicitly enabled project views and correct project title/section bounds',()=>{
 const review={retentionDays:90,expiresAt:now+300000,type:'project',section:'Work',title:'Fictional restored project',reviewId:record,restoring:true};
 const list={retentionDays:90,expiresAt:now+300000,offset:0,limit:50,matchCount:1,records:[{title:review.title,type:'project',section:'Work',deletedAt:new Date(now).toISOString(),recordToken:record}]};
 assert.throws(()=>verifyPrivateRecoveryReview(review,{now}));assert.throws(()=>verifyPrivateRecoveryList(list,{now}));
 assert.doesNotThrow(()=>verifyPrivateRecoveryReview(review,{now,allowProjects:true}));assert.doesNotThrow(()=>verifyPrivateRecoveryList(list,{now,allowProjects:true}));
 for(const patch of [{title:'x'.repeat(141)},{title:' not canonical '},{title:'bad\ncontrol'},{section:'Calendar'}])assert.throws(()=>verifyPrivateRecoveryReview({...review,...patch},{now,allowProjects:true}));
});
