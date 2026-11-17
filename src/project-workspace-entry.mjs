import {createProjectWorkspaceClient} from './project-workspace-client.mjs';
import {mountProjectWorkspace} from './project-workspace-controller.mjs';
const root=document.querySelector('#project-workspace'),shell=document.querySelector('#workspace-session');
let workspace,client,sessionEnded=false,expiryTimer,checkTimer,bus;
function ended(){sessionEnded=true;clearTimeout(expiryTimer);clearInterval(checkTimer);bus?.close();workspace?.clear();client?.clear();shell.replaceChildren();root.replaceChildren();const text=document.createElement('p');text.textContent='Sign in through the private workspace, then reopen Projects and tasks.';root.append(text);}
function expireAt(deadline){clearTimeout(expiryTimer);if(!Number.isFinite(deadline))return;if(deadline<=Date.now()){ended();return;}expiryTimer=setTimeout(ended,Math.min(deadline-Date.now(),43200000));}
try{
  client=createProjectWorkspaceClient({onSessionEnded:ended});const session=await client.status();
  expireAt(session.expiresAt);
  if(sessionEnded)throw Error('Session ended.');
  if(typeof BroadcastChannel==='function'){bus=new BroadcastChannel('cc_projects_session');bus.onmessage=event=>{if(event.data==='signout')ended();};}
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const signOut=document.createElement('button');signOut.textContent='Sign out';signOut.addEventListener('click',()=>{signOut.disabled=true;bus?.postMessage('signout');void client.signOut().catch(ended);});shell.append(signOut);
  if(session.fixture===true){const notice=document.createElement('p');notice.textContent='Fictional preview — no accounts, providers or saved personal records. Demo changes reset when this preview stops.';shell.prepend(notice);}
  workspace=await mountProjectWorkspace({root,client,ownerId:session.user.id,allowRoutineAutosave:session.fixture===true,day:`${parts.year}-${parts.month}-${parts.day}`});
  if(sessionEnded)throw Error('Session ended.');
  let checking=false;async function check(){if(checking||sessionEnded||document.hidden)return;checking=true;try{const latest=await client.status();if(!sessionEnded)expireAt(latest.expiresAt);}catch{}finally{checking=false;}}
  window.addEventListener('focus',check);checkTimer=setInterval(check,30000);
}catch{ended();}
window.addEventListener('pagehide',()=>{clearTimeout(expiryTimer);clearInterval(checkTimer);bus?.close();workspace?.dispose();client?.clear();});
