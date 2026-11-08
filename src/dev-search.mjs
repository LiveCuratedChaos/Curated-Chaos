import {createDevApi} from './dev-api.mjs';
import {createDevSessionManager} from './dev-session.mjs';
import {renderConnectedShell} from './dev-cloud-shell.mjs';
import {escapeHtml} from './core.mjs';
import {SEARCH_SECTIONS,safeSearchRows,searchRecords,searchRoute} from './dev-search-model.mjs';
const root=document.getElementById('cc-search');let api,auth,user=null,records=[],error='',query='',section='all',busy=false,revision=0;
const e=x=>escapeHtml(String(x??''));
function render(){
 const rows=user?searchRecords(records,user.id,query,section):[];
 let h=`<section class="cc-work-header"><p class="eyebrow">THE CHAOS · MILESTONE 2J</p><h1>Search</h1><p class="cc-work-deck">Find saved fictional records across your private workspace. Search never reaches external accounts or searches another person's records.</p></section>`;
 if(error)h+=`<p class="warning" role="alert">${e(error)}</p>`;
 if(!user)h+=`<section class="cc-work-card"><h2>Sign in to Search QA</h2><form id="search-login" class="cc-org-fields"><label class="field-label">Development test email<input type="email" name="email" required></label><label class="field-label">Test password<input type="password" name="password" required></label><button class="btn btn-primary" type="submit">Sign in</button></form></section>`;
 else{
 h+=`<section class="cc-work-card"><div class="cc-card-heading"><h2>Find something</h2><button class="btn btn-small" id="search-refresh" type="button">Refresh</button></div><p class="tiny muted">${e(user.email)} · ${records.length} eligible fictional records loaded. Read-only results.</p><label class="field-label">Search by name, code or description<input id="search-query" type="search" maxlength="140" autocomplete="off" placeholder="Try Test Grocery Budget" value="${e(query)}"></label><label class="field-label">Area<select id="search-section">${SEARCH_SECTIONS.map(x=>`<option value="${e(x)}" ${x===section?'selected':''}>${e(x==='all'?'Every area':x)}</option>`).join('')}</select></label></section>`;
 h+=`<section class="cc-work-card"><h2>${query.trim()?`${rows.length} matching records`:'Results'}</h2>`;
 if(!query.trim())h+='<p class="muted">Enter a word to search your saved development records.</p>';
 else if(!rows.length)h+='<p class="muted">No matching saved records found in the loaded development dataset.</p>';
 else for(const r of rows){const title=r.payload?.title||r.payload?.name||r.payload?.code||'Untitled';h+=`<div class="cc-work-row"><div><strong>${e(title)}</strong><p class="tiny muted">${e(r.section)} · ${e(r.item_type==='school_fixture'?'Course':r.item_type)}</p></div><a class="btn btn-small" href="${searchRoute(r.section)}">Open area</a></div>`;}
 h+='</section><section class="cc-work-card"><p class="tiny muted">This first search only indexes up to 250 organization records and 150 School fixtures returned by the development APIs. Future search will support pagination, more record types and finer permissions.</p><button class="btn btn-small" type="button" id="search-signout">Sign out</button></section>';
 }
 root.innerHTML=renderConnectedShell(`<div class="cc-workspace-page">${h}</div>`,{active:'search'});
}
async function load(){if(!user)return;const myId=user.id,rev=++revision;busy=true;try{const token=await auth.getAccessToken();const [org,school]=await Promise.all([api.listOrganization(token,myId),api.listSchoolCourses(token,myId)]);if(rev!==revision||user?.id!==myId)return;records=safeSearchRows([...(Array.isArray(org)?org:[]),...(Array.isArray(school)?school:[])],myId);error='';}catch(ex){if(rev===revision)error=String(ex.message||ex).slice(0,220);}finally{if(rev===revision){busy=false;render();}}}
root.addEventListener('submit',ev=>{if(ev.target.id!=='search-login')return;ev.preventDefault();if(busy)return;const v=Object.fromEntries(new FormData(ev.target).entries());busy=true;void(async()=>{try{const session=await auth.signIn(v.email.trim(),v.password);user=session.user;await load();}catch(ex){error=String(ex.message||ex).slice(0,220);user=null;}finally{busy=false;render();}})();});
root.addEventListener('input',ev=>{if(ev.target.id!=='search-query')return;query=ev.target.value;const start=ev.target.selectionStart;render();const next=root.querySelector('#search-query');next?.focus();if(start!=null)next?.setSelectionRange(start,start);});
root.addEventListener('change',ev=>{if(ev.target.id==='search-section'){section=ev.target.value;render();}});
root.addEventListener('click',ev=>{if(ev.target.id==='search-refresh'&&!busy)void load();if(ev.target.id==='search-signout'){++revision;const session=auth;user=null;records=[];query='';render();void session.signOut();}});
(async()=>{try{const res=await fetch('/dev-config.json',{cache:'no-store'});if(!res.ok)throw Error('Development configuration unavailable');const conf=await res.json();api=createDevApi(conf);auth=createDevSessionManager(api,conf.projectRef,sessionStorage);user=(await auth.restore())?.user||null;if(user)await load();else render();}catch(ex){error=String(ex.message||ex);render();}})();
