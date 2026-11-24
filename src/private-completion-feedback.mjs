// Prepare audio during the approval gesture. Play only after the original task
// completion has succeeded and its owner has reread the signed-in workspace.
export function prepareCompletionFeedback(host,preferences){
 const enabled=preferences?.completionSound==='on'||preferences?.completionHaptics==='on';
 if(!enabled)return null;
 let audio=null,used=false,ready;
 const close=()=>{if(audio){try{Promise.resolve(audio.close()).catch(()=>{});}catch{}audio=null;}};
 if(preferences.completionSound==='on'){
  try{
   const Audio=host.AudioContext??host.webkitAudioContext;
   if(Audio){
    audio=new Audio();
    ready=Promise.resolve(audio.state==='suspended'?audio.resume():undefined).catch(()=>{close();});
   }
  }catch{close();}
 }
 const timer=setTimeout(()=>{used=true;close();},30000);timer.unref?.();
 return {
  cancel(){if(used)return;used=true;clearTimeout(timer);close();},
  finish(isCurrent){
   if(used)return;used=true;clearTimeout(timer);
   if(!isCurrent()){close();return;}
   if(preferences.completionHaptics==='on'){
    try{host.navigator?.vibrate?.(20);}catch{/* A successful task still has its on-screen receipt. */}
   }
   if(!audio)return;
   const timeout=setTimeout(close,2000);timeout.unref?.();
   void ready.then(()=>{
    if(!audio||audio.state!=='running'||!isCurrent()){clearTimeout(timeout);close();return;}
    try{
     const sound=audio.createOscillator(),level=audio.createGain(),at=audio.currentTime;
     sound.frequency.value=660;
     level.gain.setValueAtTime(0,at);level.gain.linearRampToValueAtTime(0.035,at+0.01);
     level.gain.linearRampToValueAtTime(0,at+0.09);
     sound.connect(level);level.connect(audio.destination);
     sound.onended=()=>{clearTimeout(timeout);close();};sound.start(at);sound.stop(at+0.1);
    }catch{clearTimeout(timeout);close();}
   });
  }
 };
}
