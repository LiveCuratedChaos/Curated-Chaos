import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCompletionFeedback} from '../src/private-completion-feedback.mjs';

function device(){
 const events=[];
 class Audio{
  state='suspended';currentTime=0;destination={};
  constructor(){events.push('open');}
  async resume(){this.state='running';}
  async close(){events.push('close');}
  createOscillator(){return{frequency:{},connect(){},start(){events.push('sound');},stop(){this.onended();}};}
  createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){}};}
 }
 return{events,host:{AudioContext:Audio,navigator:{vibrate(duration){events.push(duration);}}}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('completion sound and vibration are independent, off by default and emitted once after verification',async()=>{
 for(const [sound,haptics] of [[false,false],[true,false],[false,true],[true,true]]){
  const {host,events}=device(),receipt=prepareCompletionFeedback(host,{completionSound:sound?'on':'off',completionHaptics:haptics?'on':'off'});
  assert.deepEqual(events,sound?['open']:[]);receipt?.finish(()=>true);receipt?.finish(()=>true);await settle();
  assert.equal(events.filter(e=>e==='sound').length,Number(sound));
  assert.equal(events.filter(e=>e===20).length,Number(haptics));
  assert.equal(events.filter(e=>e==='close').length,Number(sound));
 }
});
test('a failed, hidden or retired task emits no response and unsupported hardware remains optional',async()=>{
 for(const action of ['cancel','hidden','changed']){
  const {host,events}=device(),r=prepareCompletionFeedback(host,{completionSound:'on',completionHaptics:'on'});
  if(action==='cancel')r.cancel();
  else if(action==='hidden')r.finish(()=>false);
  else{let current=true;r.finish(()=>current);current=false;}
  await settle();assert.equal(events.includes('sound'),false);assert.equal(events.includes(20),action==='changed');
  assert.equal(events.filter(e=>e==='close').length,1);
 }
 const blocked=prepareCompletionFeedback({AudioContext:class{constructor(){throw Error();}},navigator:{vibrate(){throw Error();}}},{completionSound:'on',completionHaptics:'on'});
 assert.doesNotThrow(()=>blocked.finish(()=>true));
});
