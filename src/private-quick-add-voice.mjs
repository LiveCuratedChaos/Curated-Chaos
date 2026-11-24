import {escapeHtml as e} from './core.mjs';

// The app requests device recognition only. It never receives a microphone stream or audio file.
export function createQuickAddVoice({Recognition,source,onChange,secure,timeoutMs=30000}){
 const supported=Boolean(secure&&typeof Recognition==='function'&&Recognition.prototype&&'processLocally' in Recognition.prototype);
 let generation=0,engine=null,timer=null,identity=null,state='idle',transcript='',error='';
 function release(){
  clearTimeout(timer);timer=null;
  if(!engine)return;
  const old=engine;engine=null;
  old.onresult=old.onend=old.onerror=null;
  try{old.abort();}catch{}
 }
 function reset(){generation++;release();identity=null;state='idle';transcript='';error='';}
 function current(n){return n===generation&&source()?.identity===identity;}
 function fail(n,message){
  if(n!==generation)return;
  const show=current(n);reset();
  if(show){identity=source()?.identity;error=message;}
  onChange();
 }
 function start(){
  const field=source();
  if(!field||!supported||state!=='idle')return;
  reset();identity=field.identity;state='listening';const n=generation;
  try{
   engine=new Recognition();engine.processLocally=true;
   if(engine.processLocally!==true)throw Error();
   engine.lang='en-US';engine.continuous=false;engine.interimResults=false;engine.maxAlternatives=1;
   engine.onresult=event=>{
    if(!current(n)){if(n===generation)reset();return;}
    const words=[];
    for(let i=0;i<event.results.length;i++){
     const result=event.results[i];
     if(result.isFinal&&typeof result[0]?.transcript==='string')words.push(result[0].transcript.trim());
    }
    if(!words.length)return;
    const text=words.join(' ').trim();
    if(!text||text.length>field.limit||/[\u0000-\u001f\u007f]/.test(text)){fail(n,'The transcript does not fit this field. Try a shorter phrase or type it.');return;}
    generation++;release();transcript=text;state='review';onChange();
   };
   engine.onerror=event=>fail(n,event.error==='not-allowed'?'Microphone access was declined. You can still type your entry.':'On-device recognition is unavailable. You can still type your entry.');
   engine.onend=()=>fail(n,'No final transcript was received. You can try again or type your entry.');
   engine.start();
   if(current(n)&&state==='listening'){timer=setTimeout(()=>fail(n,'Dictation ended after 30 seconds. You can try again.'),timeoutMs);timer.unref?.();}
  }catch{fail(n,'On-device recognition is unavailable. You can still type your entry.');return;}
  onChange();
 }
 function use(){
  const field=source();if(!field||identity!==field.identity||state!=='review'){reset();onChange();return;}
  const text=transcript.trim();
  const combined=[field.text().trimEnd(),text].filter(Boolean).join(' ');
  if(!text||combined.length>field.limit||/[\u0000-\u001f\u007f]/.test(text)){error='Edit the transcript so it fits this field.';onChange();return;}
  reset();field.apply(combined);onChange();
 }
 function render(){
  const field=source();
  if(identity!==null&&identity!==field?.identity)reset();
  if(!field)return'';
  if(!supported)return'';
  let body='';
  if(state==='listening')body='<p role="status">Listening on this device…</p><button type="button" class="btn" id="quick-voice-discard">Cancel dictation</button>';
  else if(state==='review')body='<label class="field-label">Review transcript<input name="quick-voice-transcript" maxlength="'+field.limit+'" value="'+e(transcript)+'"></label><button type="button" class="btn" id="quick-voice-use">Use this text</button><button type="button" class="btn" id="quick-voice-discard">Discard transcript</button>';
  else body='<button type="button" class="btn" id="quick-voice-start">Dictate '+e(field.label)+' on this device</button>';
  return '<div aria-label="On-device dictation">'+body+(error?'<p role="alert">'+e(error)+'</p>':'')+'</div>';
 }
 return{render,reset,click(event){
  for(const [id,action] of [['quick-voice-start',start],['quick-voice-use',use],['quick-voice-discard',()=>{reset();onChange();}]]){
   if(event.target.closest('#'+id)){action();return true;}
  }
  return false;
 },input(event){if(event.target.name!=='quick-voice-transcript')return false;if(state==='review'&&source()?.identity===identity)transcript=event.target.value;return true;}};
}
