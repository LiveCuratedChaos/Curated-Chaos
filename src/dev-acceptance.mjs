// M1H. Read-only cloud observations plus explicitly user-graded manual acceptance.
// Checklist grades contain only non-sensitive test statuses; persist across tabs and re-authentication
// under the same localhost origin. Auth credentials/session tokens remain separate in sessionStorage.
import { createDevApi } from './dev-api.mjs';
import { createDevSessionManager } from './dev-session.mjs';
import { renderConnectedShell } from './dev-cloud-shell.mjs';
import { escapeHtml as e } from './core.mjs';
import { auditSnapshot, ACCEPTANCE_CASES, acceptanceProgress } from './dev-acceptance-model.mjs';

const root=document.getElementById('connected-acceptance');
let api,auth,config,user=null,scan=null,loading=false,scanError='',lastChecked=0,grades={};
const statusOptions=[['unverified','Not tested'],['passed','Passed'],['failed','Failed'],['blocked','Blocked / needs follow-up']];
const storageKey=()=>config&&user?`cc-m1h-checklist-${config.projectRef}-${user.id}`:null;
function safeGrades(x){
  const clean={};
  if(x && typeof x==='object') for(const c of ACCEPTANCE_CASES){
    if(statusOptions.some(([v])=>v===x[c.id]))clean[c.id]=x[c.id];
  }
  return clean;
}
function restoreGrades(){
  grades={}; const key=storageKey(); if(!key)return;
  try{
    const saved=localStorage.getItem(key);
    if(saved!==null){grades=safeGrades(JSON.parse(saved));return;}
  }catch{}
  // Migrate any grades saved in this SAME tab by the original 1H build.
  try{
    const old=sessionStorage.getItem(key);
    if(old!==null){grades=safeGrades(JSON.parse(old));saveGrades();}
  }catch{}
}
function saveGrades(){
  const key=storageKey();if(!key)return false;
  try{
    localStorage.setItem(key,JSON.stringify(safeGrades(grades)));
    // Keep in-tab backward compatibility for the previous build.
    sessionStorage.setItem(key,JSON.stringify(safeGrades(grades)));
    return true;
  }catch{return false;}
}
function show(){
  const done=acceptanceProgress(grades);
  const login=`<section class="panel"><h2>Sign in for Acceptance Testing</h2><p class="muted">Use your existing fictional Development Test Account A. Sign in directly here, then return to this page after other QA sections. This page does not save your password.</p>
  <form id="acceptance-login" autocomplete="off"><label class="field-label">Test account email<input name="email" type="email" autocomplete="username" required /></label><label class="field-label">Test account password<input name="password" type="password" autocomplete="off" required /></label><button type="submit" class="btn btn-primary" ${loading?'disabled':''}>${loading?'Signing in…':'Sign in to acceptance tests'}</button></form>
  ${scanError?`<p role="alert" class="warning">${e(scanError)}</p>`:''}</section>`;
  const summary=`<section class="panel"><div class="panel-head"><h2>Read-only cloud check</h2><span class="pill">${scan?e(scan.status.toUpperCase()):'NOT RUN'}</span></div><p class="tiny muted">This queries only the isolated Supabase development project. Nothing is written, approved, or deleted.</p>
    ${scanError?`<p role="alert" class="warning">${e(scanError)}</p>`:''}
    ${scan?`<p><strong>${e(scan.description)}</strong></p><p class="tiny muted">Last complete read: ${e(new Date(lastChecked).toLocaleString())} · ${scan.returnedRecords} records returned (bounded API queries). Tasks ${scan.counts.tasks}, events ${scan.counts.events}, fictional emails ${scan.counts.email}, life records ${scan.counts.life}, decisions ${scan.counts.decisions}, preferences ${scan.counts.preferences}.</p>${scan.findings.map(f=>`<p class="${f.level==='fail'?'warning':'muted'}">${f.level==='warn'?'Note: ':'Attention: '}${e(f.message)}</p>`).join('')}`:'<p class="muted">No scan performed yet. A successful scan only confirms the returned private-record metadata and fetch, not a full security audit.</p>'}
    <div class="dialog-actions"><button class="btn btn-primary" type="button" id="acceptance-scan" ${loading?'disabled':''}>${loading?'Checking cloud…':'Run read-only check'}</button><a class="btn" href="/dev-dashboard.html">Open Daily Brief</a></div></section>`;
  const manual=`<section class="panel"><div class="panel-head"><h2>Owner acceptance checklist</h2><span class="pill">${done.passed} / ${done.total} passed</span></div><p class="muted">These are actual user-observed results, never automatically marked as passed. Previous milestone tests provide a starting point, but this final end-to-end check is your decision. Your results are saved in this browser's local checklist storage under this development project and account, including across tabs and sign-outs. Only pass/fail results are saved, not passwords or sensitive records.</p>
    <div class="acceptance-cases">${ACCEPTANCE_CASES.map((c,i)=>`<div class="acceptance-case"><div><strong>${i+1}. ${e(c.title)}</strong><p class="tiny muted">${e(c.detail)}</p><a href="${c.url}">Open related QA page</a></div><label class="field-label">Result <select data-case="${e(c.id)}" aria-label="Result for ${e(c.title)}">${statusOptions.map(([v,label])=>`<option value="${v}" ${grades[c.id]===v?'selected':''}>${e(label)}</option>`).join('')}</select></label></div>`).join('')}</div>
    <p role="status">${done.complete&&scan?.status==='verified'?'All seven desktop-browser acceptance checks were marked passed by you and the read-only scan succeeded. Production launch and mobile-device validation remain separate gates.':done.complete?'All seven manual checks were marked passed; run a successful read-only cloud check before treating this desktop acceptance as complete.':`${done.passed} passed · ${done.failed} failed · ${done.blocked} blocked · ${done.total-done.passed-done.failed-done.blocked} not tested.`}</p>
    <div class="dialog-actions"><button type="button" class="btn" id="acceptance-recover">Restore my previously confirmed Tests 1–5</button><button type="button" class="btn" id="acceptance-reset">Clear checklist results</button></div>
    <p class="tiny muted">Use Restore only if you already completed and confirmed all five tests in a previous 1H session. It records your earlier observations; it does not run new tests or automatically mark Tests 6–7. Any recorded Failed or Blocked result is left unchanged.</p></section>`;
  const body=`<section class="auth-card connected-card"><p class="eyebrow">CURATED CHAOS · MILESTONE 1H</p><h1>End-to-end acceptance</h1><p class="muted">Private development · fictional records · no live Gmail, iCloud, WGU or financial integrations</p><p class="tiny muted">We will not alter your existing 1G app or database. Automated regression tests do not substitute for your actual acceptance checks.</p>${user?`<p class="notice">Signed into development account: <strong>${e(user.email||user.id)}</strong>. Project: ${e(config?.projectRef||'unknown')} <button type="button" id="acceptance-signout" class="btn btn-small">Sign out / Switch test account</button></p>${summary}${manual}`:login}
    <section class="panel"><h2>Testing limits</h2><p class="tiny muted">This server listens only on your Mac's localhost. An iPhone or iPad cannot visit your Mac's localhost address. Mac browser testing here does not establish mobile-device usability or cross-device live synchronization; those need a separate authenticated private test deployment. This page does not check real connectors, produce immutable audit logs, verify every RLS rule, or implement offline write queues.</p><p class="tiny muted">Keep Test Accounts A and B fictional. Do not enter passwords or security credentials into this checklist. No real data or destructive reset is needed.</p></section></section>`;
  root.innerHTML=renderConnectedShell(body,{active:'acceptance'});
}
async function readSnapshot(){
  if(!auth?.get()||loading)return;
  loading=true;scanError='';show();
  try{
    const token=await auth.getAccessToken();
    const verified=await api.getUser(token);
    if(verified?.id!==user?.id)throw Error('Account changed. Sign in again and retry.');
    // Read-only authenticated calls. An incomplete fetch must NEVER produce VERIFIED.
    const [core,email,life,decisions,preferences]=await Promise.all([
      api.listBriefRecords(token),api.listFictionalEmails(token),api.listFictionalLife(token),
      api.listSuggestionDecisions(token,user.id),api.listBriefPreferences(token,user.id)
    ]);
    const next=auditSnapshot({core,email,life,decisions,preferences},user.id);
    if(!auth.get()||auth.get().user.id!==verified.id)throw Error('Account changed during verification.');
    scan=next;lastChecked=Date.now();
  }catch(err){scan=null;lastChecked=0;scanError=String(err?.message||'Cloud read failed. Previous data is unverified.').slice(0,220);}
  finally{loading=false;show();}
}
root.addEventListener('click',ev=>{
  if(ev.target.closest('#acceptance-scan')){void readSnapshot();return;}
  if(ev.target.closest('#acceptance-recover')){
    // Explicit owner action, never an automatic assertion that checks passed.
    for(const c of ACCEPTANCE_CASES.slice(0,5)){
      if(!['failed','blocked'].includes(grades[c.id]))grades[c.id]='passed';
    }
    if(!saveGrades())scanError='Browser storage is disabled; results may not persist.';
    show();return;
  }
  if(ev.target.closest('#acceptance-reset')){
    grades={};const key=storageKey();
    try{localStorage.removeItem(key);}catch{}
    try{sessionStorage.removeItem(key);}catch{}
    show();return;
  }
  if(ev.target.closest('#acceptance-signout')){
    void (async()=>{
      loading=true;show();
      try{await auth.signOut();}catch{}
      user=null;grades={};scan=null;lastChecked=0;scanError='';loading=false;show();
    })();return;
  }
});
root.addEventListener('submit',ev=>{
  if(ev.target?.id!=='acceptance-login')return;
  ev.preventDefault();if(loading)return;
  const form=ev.target;
  const values=new FormData(form);
  const email=String(values.get('email')||'').trim();
  const password=String(values.get('password')||'');
  if(!email||!password)return;
  loading=true;scanError='';show();
  void (async()=>{
    try{
      const session=await auth.signIn(email,password);
      user=session.user;scan=null;lastChecked=0;restoreGrades();
    }catch(err){
      scanError=String(err?.message||'Unable to sign in.').slice(0,220);
      user=null;grades={};
    }finally{loading=false;show();}
  })();
});
root.addEventListener('change',ev=>{
  const id=ev.target?.dataset?.case;if(!ACCEPTANCE_CASES.some(c=>c.id===id))return;
  const val=ev.target.value;if(!statusOptions.some(([s])=>s===val))return;
  grades[id]=val;if(!saveGrades())scanError='Browser storage is disabled; results may not persist.';show();
});
(async()=>{
  try{
    const res=await fetch('/dev-config.json',{cache:'no-store'});
    if(!res.ok)throw Error('Development setup not available. Check .env.local and run npm run check:setup.');
    config=await res.json();api=createDevApi(config);auth=createDevSessionManager(api,config.projectRef,sessionStorage);
    const session=await auth.restore();user=session?.user||null;
    if(user)restoreGrades();show();
  }catch(err){root.innerHTML=`<section class="auth-card"><p class="warning">${e(err.message)}</p><a href="/dev-auth.html">Development sign-in</a></section>`;}
})();
