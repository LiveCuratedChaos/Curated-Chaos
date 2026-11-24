// Device-local time only. No accounts, providers, network requests or stored time records.
import {escapeHtml as e} from './core.mjs';
export const CLOCK_MODES=Object.freeze(['digital','analog']);
export function privateClockDisplay({now=Date.now(),locale}={}){
 if(!Number.isFinite(now))throw Error('Current device time required.');const date=new Date(now);if(!Number.isFinite(date.getTime()))throw Error('Current device time required.');
 const text=new Intl.DateTimeFormat(locale,{hour:'numeric',minute:'2-digit'}).format(date),hours=date.getHours(),minutes=date.getMinutes();
 return{text,instant:date.toISOString(),hourAngle:(hours%12)*30+minutes/2,minuteAngle:minutes*6};
}
export function renderPrivateClock(widget,{now=Date.now(),locale}={}){
 const mode=widget.clockMode??'digital';if(!CLOCK_MODES.includes(mode))return'<p role="status">This clock style is unavailable. Saved settings are kept.</p>';
 try{const value=privateClockDisplay({now,locale});return(mode==='analog'?'<svg class="private-clock-face" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle cx="60" cy="60" r="54"/><text x="60" y="23">12</text><text x="101" y="64">3</text><text x="60" y="105">6</text><text x="19" y="64">9</text><line class="private-clock-hour" x1="60" y1="60" x2="60" y2="33" transform="rotate('+value.hourAngle+' 60 60)"/><line class="private-clock-minute" x1="60" y1="60" x2="60" y2="20" transform="rotate('+value.minuteAngle+' 60 60)"/><circle class="private-clock-center" cx="60" cy="60" r="3"/></svg>':'')+'<p class="private-clock-time"><time datetime="'+value.instant+'">'+e(value.text)+'</time></p><p class="tiny muted">Device local time · '+(mode==='analog'?'Analog':'Digital')+'</p>';}catch{return'<p role="status">Device time could not be displayed. Check the device clock.</p>';}
}
// Patch only clock contents. Widget settings and focused editor controls are never replaced.
export function createPrivateClockTicker({root,widgets,canUse,clock=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 if(!root||typeof widgets!=='function'||typeof canUse!=='function'||typeof clock!=='function')throw Error('Explicit visible clock context required.');let timer=null,generation=0,disposed=false;
 function clear(){generation++;clearTimer(timer);timer=null;}
 const visible=()=>widgets().filter(w=>w.type==='clock'&&!w.hidden);
 function arm(n){if(disposed||n!==generation||!canUse()||!visible().length)return;const now=clock();if(!Number.isFinite(now))return;timer=setTimer(()=>{timer=null;if(disposed||n!==generation||!canUse())return;const current=new Map(visible().map(w=>[w.id,w]));for(const node of root.querySelectorAll?.('[data-private-curation-clock]')??[]){if(disposed||n!==generation||!canUse())return;const widget=current.get(node.getAttribute('data-private-curation-clock'));if(widget)node.innerHTML=renderPrivateClock(widget,{now:clock()});}arm(n);},60000-((now%60000+60000)%60000));timer?.unref?.();}
 return{refresh(){clear();if(!disposed)arm(generation);},clear,dispose(){clear();disposed=true;}};
}
