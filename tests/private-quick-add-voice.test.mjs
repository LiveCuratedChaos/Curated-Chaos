import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuickAddVoice} from '../src/private-quick-add-voice.mjs';
function setup({secure=true,local=true}={}){
 const runs=[];let text='Existing',active=true,identity={};
 class Recognition{
  constructor(){this.abortCount=0;runs.push(this);}
  start(){this.started=this.processLocally;}
  abort(){this.abortCount++;}
 }
 if(local)Object.defineProperty(Recognition.prototype,'processLocally',{value:false,writable:true});
 const panel=createQuickAddVoice({Recognition,secure,source:()=>active?{identity,text:()=>text,limit:140,label:'title',apply:value=>{text=value;}}:null,onChange:()=>{}});
 const click=id=>panel.click({target:{closest:key=>key==='#quick-voice-'+id?{}:null}});
 return{panel,runs,click,get text(){return text;},switchDraft(){identity={};},signOut(){active=false;}};
}
test('dictation starts on explicit action, requires on-device mode, and inserts only confirmed editable text',()=>{
 const s=setup();assert.match(s.panel.render(),/Dictate title on this device/);assert.equal(s.runs.length,0);
 s.click('start');const engine=s.runs[0];assert.equal(engine.started,true);assert.equal(engine.interimResults,false);
 engine.onresult({results:[{isFinal:false,0:{transcript:'partial'}}]});assert.equal(s.text,'Existing');
 engine.onresult({results:[{isFinal:true,0:{transcript:'<milk>'}}]});assert.equal(engine.abortCount,1);assert.equal(engine.onresult,null);
 assert.match(s.panel.render(),/&lt;milk&gt;/);assert.equal(s.text,'Existing');
 s.panel.input({target:{name:'quick-voice-transcript',value:'two cartons'}});s.click('use');assert.equal(s.text,'Existing two cartons');assert.doesNotMatch(s.panel.render(),/two cartons/);
});
test('cancelling, changing editor, signing out and device recognition failure discard pending results',()=>{
 for(const reason of ['cancel','draft','logout','error']){
  const s=setup();s.click('start');const engine=s.runs[0],late=engine.onresult;
  if(reason==='cancel')s.click('discard');
  if(reason==='draft'){s.switchDraft();s.panel.render();}
  if(reason==='logout'){s.signOut();s.panel.render();}
  if(reason==='error')engine.onerror({error:'service-not-allowed'});
  late({results:[{isFinal:true,0:{transcript:'unexpected'}}]});assert.equal(s.text,'Existing');assert.equal(engine.abortCount,1);assert.doesNotMatch(s.panel.render(),/unexpected|Use this text/);assert.equal(s.runs.length,1);
 }
});
test('unsupported or insecure recognition cannot fall back to another service or request a microphone',()=>{
 for(const options of [{secure:false},{local:false}]){const s=setup(options);assert.equal(s.panel.render(),'');s.click('start');assert.equal(s.runs.length,0);}
});
