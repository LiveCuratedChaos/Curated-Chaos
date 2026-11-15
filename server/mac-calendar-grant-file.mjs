// A private, short-lived handoff capability; contains no events or provider credentials.
import {open,lstat,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
export function createMacCalendarGrantPublisher(path,{now=()=>Date.now()}={}){
 let owned=null,timer=null;
 async function clear(){clearTimeout(timer);timer=null;const previous=owned;owned=null;if(!previous)return;let stat;try{stat=await lstat(path);}catch(error){if(error.code==='ENOENT')return;throw error;}if(stat.dev===previous.dev&&stat.ino===previous.ino)await unlink(path);}
 let pending=Promise.resolve();
 const publish=grant=>{const next=pending.then(async()=>{
  await clear();const parent=await lstat(dirname(path));if(!parent.isDirectory()||parent.isSymbolicLink()||parent.uid!==process.getuid()||(parent.mode&0o077))throw Error('Private handoff directory required.');
  if(!Number.isFinite(grant.expiresAt)||grant.expiresAt<=now()||grant.expiresAt>now()+300000||!/^[A-Za-z0-9_-]{43}$/.test(grant.capability))throw Error('Invalid handoff.');
  const file=await open(path,'wx',0o600);try{owned=await file.stat();await file.writeFile(JSON.stringify({endpoint:'http://127.0.0.1:5301/auth/google/mac-calendar-transfer',...grant}));await file.sync();}catch(error){await clear();throw error;}finally{await file.close();}
  timer=setTimeout(()=>{pending=pending.then(clear).catch(()=>{});},Math.max(0,grant.expiresAt-now()));timer.unref?.();
 });pending=next.catch(()=>{});return next;};
 publish.dispose=()=>{const next=pending.then(clear);pending=next.catch(()=>{});return next;};return publish;
}
