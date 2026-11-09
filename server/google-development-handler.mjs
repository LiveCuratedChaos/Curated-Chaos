import {savedMacCalendarRecords} from './saved-mac-calendar-records.mjs';
import {planMacCalendarImport} from './mac-calendar-import-plan.mjs';
import {createMacCalendarBridge} from './mac-calendar-bridge.mjs';
import {savedSourceBrief,briefDayBounds,briefDateInZone} from './saved-source-brief.mjs';
import {savedFinanceRecords} from './saved-finance-records.mjs';
import {createProviderImportExecutor} from './provider-import-executor.mjs';
import {savedProviderRecords} from './saved-provider-records.mjs';
// Loopback-only development gateway. It authorizes connections but never imports data.
import {randomBytes,createHash} from 'node:crypto';
import {createGoogleImportReview} from './google-import-review.mjs';
import {createGoogleSourcePreview} from './google-source-preview.mjs';
import {createGoogleConnectionFlow} from './google-connection-flow.mjs';
import {readFile} from 'node:fs/promises';
const hash=value=>createHash('sha256').update(value).digest('hex');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Curated Chaos · Development connections</title><link rel="stylesheet" href="/src/styles.css"></head><body data-theme="neutral"><main class="content cc-connections-page"><p class="eyebrow">CURATED CHAOS · ON THIS MAC</p><h1>Google connections</h1><p>Connect your Google account, choose sources and dates, and review a read-only preview. Nothing is automatically added to your workspace.</p><p id="connection-status" role="status">Checking setup…</p><section id="connection-controls"></section><p><a class="btn" href="/dev-account.html">My Account</a> <a class="btn" href="/dev-integration.html">Integration checks</a></p></main><script type="module" src="/auth/google/ui.mjs"></script></body></html>`;
export function makeGoogleDevelopmentHandler({origin,devApi,oauthClient,clientId,stores,supabaseOrigin,refreshAccessToken,previewFetcher,providerRepository,financeRepository,macCalendarRepository,allowMacCalendarIdentityReview=false,allowMacCalendarSave=false,requireActiveSession=false,approvedImportSelections=[],maxReviewedImportItems=0,approvedMacCalendarScope=null,publishMacCalendarGrant=null,now=()=>Date.now()}){
 const allowed=new URL(origin);if(allowed.protocol!=='http:'||allowed.hostname!=='127.0.0.1'||allowed.pathname!=='/'||allowed.username||allowed.password||allowed.search||allowed.hash)throw Error('Google development gateway must use an exact loopback origin.');
 if(!Array.isArray(approvedImportSelections)||approvedImportSelections.some(id=>!/^[0-9a-f-]{36}$/i.test(id))||!Number.isInteger(maxReviewedImportItems)||maxReviewedImportItems<0||maxReviewedImportItems>250)throw Error('Invalid import approval scope.');
 approvedImportSelections=Object.freeze([...approvedImportSelections]);
 if(allowMacCalendarSave&&(!allowMacCalendarIdentityReview||!approvedMacCalendarScope||approvedMacCalendarScope.maxEvents>5||!macCalendarRepository))throw Error('Explicit bounded Mac review/save approval required.');
 if(typeof requireActiveSession!=='boolean'||requireActiveSession&&typeof devApi?.isSessionActive!=='function')throw Error('Active development session checker required.');
 async function verifiedUser(token){const user=await devApi.getUser(token);if(!user?.id||requireActiveSession&&!await devApi.isSessionActive(token))return null;return user;}
 const sessions=new Map();let loginTimes=[],macSaveInProgress=false,macSaveCompleted=false;
 const configured=Boolean(devApi&&oauthClient&&clientId&&stores);
 let connectOrigin='',legacySessionKey=null;if(configured){const u=new URL(supabaseOrigin);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||u.origin!==supabaseOrigin)throw Error('Invalid development authentication origin.');connectOrigin=u.origin;legacySessionKey='cc_m0e_dev_session_'+u.hostname.split('.')[0];}
 const current=req=>{const id=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('cc_google_dev='))?.slice(14);const s=id?sessions.get(id):null;if(s&&s.expiresAt<=now()){sessions.delete(id);forget({id,...s});return null;}return s?{id,...s}:null;};
 async function confirmSession(ownerId,binding){
  const entry=[...sessions.entries()].find(([id,s])=>s.ownerId===ownerId&&hash(id)===binding&&s.expiresAt>now());if(!entry)return false;
  try{const user=await verifiedUser(entry[1].accessToken);return user?.id===ownerId&&sessions.get(entry[0])===entry[1]&&entry[1].expiresAt>now();}catch{return false;}
 }
 const macBridge=configured&&approvedMacCalendarScope&&typeof publishMacCalendarGrant==='function'?createMacCalendarBridge({scope:approvedMacCalendarScope,confirmSession,captureIdentity:allowMacCalendarIdentityReview,now}):null;
 const forget=s=>{macReviewExecutor?.forgetSession(hash(s.id));importExecutor?.forgetSession(hash(s.id));importReview?.forgetSession(hash(s.id));macBridge?.forgetSession(s.ownerId,hash(s.id));};
 const preview=configured&&refreshAccessToken?createGoogleSourcePreview({connectionStore:stores.connectionStore,refreshAccessToken,confirmSession,fetcher:previewFetcher}):null;
 const canWriteSelection=args=>!args.fixtureRunId&&approvedImportSelections.includes(args.selectionId)&&Array.isArray(args.selectedKeys)&&args.selectedKeys.length>0&&args.selectedKeys.length<=maxReviewedImportItems;
 const importExecutor=configured&&providerRepository?createProviderImportExecutor({repository:providerRepository,now,authorizeWrite:async(_actor,args)=>canWriteSelection(args),resolveActor:async actor=>await confirmSession(actor.ownerId,actor.sessionBinding)?{ownerId:actor.ownerId,sessionBinding:actor.sessionBinding}:null,validateSourceSelection:async(_actor,session,args)=>{await stores.connectionStore.loadSelected(session.ownerId,args.connectionId,args.selectionId);}}):null;
 const macReviewExecutor=configured&&macBridge&&allowMacCalendarIdentityReview&&macCalendarRepository?createProviderImportExecutor({repository:macCalendarRepository,planImport:planMacCalendarImport,now,authorizeWrite:async(_actor,args)=>allowMacCalendarSave&&!macSaveCompleted&&!args.fixtureRunId&&args.selectedKeys.length<=approvedMacCalendarScope.maxEvents,resolveActor:async actor=>await confirmSession(actor.ownerId,actor.sessionBinding)?actor:null,validateSourceSelection:async(_actor,s,args)=>{const snapshot=await macBridge.importPreview({ownerId:s.ownerId,binding:s.sessionBinding});if(snapshot.selectionId!==args.selectionId)throw Error('Mac selection changed.');}}):null;
 const importReview=configured?createGoogleImportReview({sealer:stores.sealer,connectionStore:stores.connectionStore,confirmSession,importExecutor,canWriteSelection,now}):null;
 const flow=configured?createGoogleConnectionFlow({clientId,oauthClient,...stores,confirmSession,now}):null;
 function send(res,status,data,headers={}){res.writeHead(status,{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':`default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,'Content-Type':'application/json',...headers});res.end(typeof data==='string'?data:JSON.stringify(data));}
 function issueSession(res,previous,ownerId,accessToken,tokenExpiresAt=now()+30*60000){
  if(typeof accessToken!=='string'||!accessToken||/[\s\u007f]/.test(accessToken))throw Error('Invalid development authorization.');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId))throw Error('Verified development identity required.');
  if(previous){sessions.delete(previous.id);forget(previous);}
  for(const [key,value] of sessions)if(value.expiresAt<=now()){sessions.delete(key);forget({id:key,...value});}
  if(sessions.size>=100)throw Error('Development session limit reached.');
  const id=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url'),expiresAt=Math.min(tokenExpiresAt,now()+30*60000);
  sessions.set(id,{ownerId,accessToken,csrf,expiresAt});
  send(res,200,{signedIn:true,csrf},{'Set-Cookie':'cc_google_dev='+id+'; HttpOnly; SameSite=Lax; Path=/auth/google; Max-Age='+Math.max(1,Math.floor((expiresAt-now())/1000))});
 }
 async function body(req,limit=4096){let value='';for await(const chunk of req){value+=chunk;if(Buffer.byteLength(value)>limit)throw Error('Request too large.');}return JSON.parse(value||'{}');}
 return async(req,res)=>{
  const url=new URL(req.url,origin);if(!url.pathname.startsWith('/auth/google/'))return false;
  // Host/origin pinning prevents local DNS-rebinding and cross-site POST requests.
  if(req.headers.host!==allowed.host){send(res,403,{error:'Use the configured loopback address.'});return true;}
  try{
   if(req.method==='GET'&&url.pathname==='/auth/google/') {send(res,200,html,{'Content-Type':'text/html; charset=utf-8'});return true;}
   if(req.method==='GET'&&url.pathname==='/auth/google/ui.mjs'){send(res,200,await readFile(new URL('./google-development-ui.mjs',import.meta.url),'utf8'),{'Content-Type':'text/javascript; charset=utf-8'});return true;}
   if(req.method==='POST'&&url.pathname==='/auth/google/mac-calendar-transfer'){
    if(!macBridge||req.headers.origin!==undefined||req.headers.cookie||!String(req.headers['content-type']||'').startsWith('application/json')){send(res,403,{error:'Explicit native Mac transfer required.'});return true;}
    try{const data=await macBridge.accept(req.headers['x-cc-mac-transfer'],await body(req,262144));send(res,200,data);}catch(error){const reasons=new Map([['All-day events must use local day boundaries.','all-day-boundaries'],['Mac event dates are outside the approved window.','event-window'],['Invalid Mac event timestamp.','event-timestamp'],['Invalid Mac event metadata.','event-metadata'],['Mac preview exceeds or differs from the approved selection.','selection-scope'],['Verified current app session required.','session-ended'],['Transfer expired or used.','expired-or-used'],['Transfer expired.','expired']]);const reason=reasons.get(error.message)||'invalid-transfer';console.warn('Mac calendar handoff rejected: '+reason);send(res,400,{error:'Mac transfer rejected; nothing saved.',reason});}return true;
   }
   const s=current(req);
   if(req.method==='GET'&&url.pathname==='/auth/google/mac-calendar-saved'){
    if(!macCalendarRepository||!s||!await confirmSession(s.ownerId,hash(s.id))){send(res,401,{error:'Sign in to view saved Mac snapshots.'});return true;}
    const records=savedMacCalendarRecords(await macCalendarRepository.listSavedMacCalendar({accessToken:s.accessToken},s.ownerId),s.ownerId);if(!await confirmSession(s.ownerId,hash(s.id))){send(res,401,{error:'App session ended.'});return true;}send(res,200,{records,snapshot:true,providerRead:false,expiresAt:s.expiresAt});return true;
   }
   if(req.method==='GET'&&url.pathname==='/auth/google/mac-calendar-items'){
    if(!macReviewExecutor||!s){send(res,403,{error:'Mac identity review is not enabled.'});return true;}send(res,200,await macBridge.reviewItems({ownerId:s.ownerId,binding:hash(s.id)}));return true;
   }
   if(req.method==='GET'&&url.pathname==='/auth/google/mac-calendar-brief'){
    if(!macBridge||!s){send(res,403,{error:'Mac transfer is not enabled for this session.'});return true;}
    send(res,200,await macBridge.brief({ownerId:s.ownerId,binding:hash(s.id),day:url.searchParams.get('day'),timeZone:url.searchParams.get('timeZone')||'UTC'}));return true;
   }

   if(req.method==='GET'&&url.pathname==='/auth/google/status'){
    let active=s&&await confirmSession(s.ownerId,hash(s.id));
    const connections=active?await stores.connectionStore.listOwner(s.ownerId):[];
    if(active)active=await confirmSession(s.ownerId,hash(s.id));
    if(s&&!active){sessions.delete(s.id);forget(s);}
    send(res,200,{configured,legacySessionKey,saveReviewAvailable:Boolean(importExecutor),macCalendarTransferAvailable:Boolean(macBridge),macCalendarIdentityReviewAvailable:Boolean(macReviewExecutor),macCalendarSavedAvailable:Boolean(macCalendarRepository),signedIn:Boolean(active),expiresAt:active?s.expiresAt:null,csrf:active?s.csrf:null,connections:active?connections:[]});return true;
   }
   if(req.method==='GET'&&url.pathname==='/auth/google/finance-ui.mjs'){send(res,200,await readFile(new URL('./chase-preview-ui.mjs',import.meta.url),'utf8'),{'Content-Type':'text/javascript; charset=utf-8'});return true;}
   if(req.method==='GET'&&url.pathname==='/auth/google/finances/'){
    if(!s||!await confirmSession(s.ownerId,hash(s.id))){send(res,303,'',{'Location':'/auth/google/'});return true;}
    send(res,200,'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Saved financial snapshots · Curated Chaos</title><link rel="stylesheet" href="/src/styles.css"></head><body data-theme="neutral"><main class="content cc-connections-page"><p class="eyebrow">CURATED CHAOS · PRIVATE SAVED SOURCES</p><h1>Saved financial snapshots</h1><div id="financial-preview" data-source-url="/auth/google/finance-records"><p>Loading private saved snapshots…</p></div><p><a class="btn" href="/dev-finances.html">Finances workspace</a> <a class="btn" href="/auth/google/">Connections</a></p></main><script type="module" src="/auth/google/finance-ui.mjs"></script></body></html>',{'Content-Type':'text/html; charset=utf-8'});return true;
   }
   if(req.method==='GET'&&url.pathname==='/auth/google/finance-records'){
    if(!s||!financeRepository?.listSavedFinance||!await confirmSession(s.ownerId,hash(s.id))){send(res,401,{error:'Sign in to view saved financial snapshots.'});return true;}
    const data=savedFinanceRecords(await financeRepository.listSavedFinance({accessToken:s.accessToken},s.ownerId),s.ownerId);
    if(!await confirmSession(s.ownerId,hash(s.id))){send(res,401,{error:'App session ended.'});return true;}
    send(res,200,{...data,expiresAt:s.expiresAt});return true;
   }
   if(req.method==='GET'&&url.pathname==='/auth/google/saved-brief'){
    if(!s||!providerRepository?.listSaved||!financeRepository?.listSavedFinance||!await confirmSession(s.ownerId,hash(s.id))){send(res,401,{error:'Sign in to view the saved-source brief.'});return true;}
    const timeZone=url.searchParams.get('timeZone')||'UTC',day=url.searchParams.get('day')||briefDateInZone(now(),timeZone);briefDayBounds(day,timeZone);
    const [googleRows,financeRows,macRows]=await Promise.all([providerRepository.listSaved({accessToken:s.accessToken},s.ownerId),financeRepository.listSavedFinance({accessToken:s.accessToken},s.ownerId),macCalendarRepository?macCalendarRepository.listSavedMacCalendar({accessToken:s.accessToken},s.ownerId):[]]);
    const data=savedSourceBrief({records:[...savedProviderRecords(googleRows,s.ownerId),...savedMacCalendarRecords(macRows,s.ownerId)],finance:savedFinanceRecords(financeRows,s.ownerId),day,timeZone,now:now()});
    if(!await confirmSession(s.ownerId,hash(s.id))){send(res,401,{error:'App session ended.'});return true;}
    send(res,200,{...data,expiresAt:s.expiresAt});return true;
   }
   if(req.method==='GET'&&url.pathname==='/auth/google/records'){
    if(!s||!providerRepository||!await confirmSession(s.ownerId,hash(s.id))){send(res,401,{error:'Sign in to view saved source items.'});return true;}
    const [googleRows,macRows]=await Promise.all([providerRepository.listSaved({accessToken:s.accessToken},s.ownerId),macCalendarRepository?macCalendarRepository.listSavedMacCalendar({accessToken:s.accessToken},s.ownerId):[]]);
    const rows=[...savedProviderRecords(googleRows,s.ownerId),...savedMacCalendarRecords(macRows,s.ownerId)];
    if(!await confirmSession(s.ownerId,hash(s.id))){send(res,401,{error:'App session ended.'});return true;}
    send(res,200,{records:rows,snapshot:true,googleRead:false,providerRead:false});return true;
   }
   if(req.method==='POST'){
    if(!configured){send(res,503,{error:'Development Google client is not configured yet.'});return true;}
    if(req.headers.origin!==origin||!String(req.headers['content-type']||'').startsWith('application/json')){send(res,403,{error:'Same-origin request required.'});return true;}
    if(url.pathname==='/auth/google/login'){
     loginTimes=loginTimes.filter(time=>time>now()-60000);
     if(loginTimes.length>=5){send(res,429,{error:'Too many sign-in attempts. Wait a minute and retry.'});return true;}loginTimes.push(now());
     const values=await body(req);
     if(typeof values.email!=='string'||values.email.length>320||typeof values.password!=='string'||!values.password||values.password.length>1024)throw Error('Invalid development sign-in.');
     const signed=await devApi.signIn(values.email.trim(),values.password),user=await verifiedUser(signed.accessToken);
     if(!user?.id||!Number.isFinite(signed.expiresAt)||signed.expiresAt<=now())throw Error('Development sign-in could not be verified.');
     issueSession(res,s,user.id,signed.accessToken,signed.expiresAt);return true;
    }
    if(url.pathname==='/auth/google/session'){
     const token=String(req.headers.authorization||'').match(/^Bearer ([^\s]+)$/)?.[1];if(!token){send(res,401,{error:'Sign in to the development app first.'});return true;}
     const user=await verifiedUser(token);if(!user?.id){send(res,401,{error:'Development session could not be verified.'});return true;}
     issueSession(res,s,user.id,token);return true;
    }
    if(!s||req.headers['x-cc-csrf']!==s.csrf){send(res,403,{error:'Development session verification required.'});return true;}
    if(url.pathname==='/auth/google/mac-calendar-save'){
     if(!macReviewExecutor||!allowMacCalendarSave||macSaveCompleted||macSaveInProgress){send(res,403,{error:'Mac saving is disabled, completed or already in progress.'});return true;}
     const values=await body(req);if(macSaveCompleted||macSaveInProgress){send(res,403,{error:'Mac save is already claimed.'});return true;}macSaveInProgress=true;try{const result=await macReviewExecutor.execute({ownerId:s.ownerId,sessionBinding:hash(s.id),accessToken:s.accessToken},{reviewId:values.reviewId,approved:values.approved});macSaveCompleted=true;send(res,200,result);}finally{macSaveInProgress=false;}return true;
    }
    if(url.pathname==='/auth/google/mac-calendar-review'){
     if(!macReviewExecutor){send(res,403,{error:'Mac review is disabled.'});return true;}
     const values=await body(req,32768),preview=await macBridge.importPreview({ownerId:s.ownerId,binding:hash(s.id)});
     const review=await macReviewExecutor.prepare({ownerId:s.ownerId,sessionBinding:hash(s.id),accessToken:s.accessToken},{selectionId:preview.selectionId,preview,previewExpiresAt:preview.expiresAt,selectedKeys:values.selectedKeys});send(res,200,{...review,saveEnabled:allowMacCalendarSave&&!macSaveCompleted&&review.conflictCount===0&&review.insertCount>0,reviewOnly:!allowMacCalendarSave});return true;
    }
    if(url.pathname==='/auth/google/mac-calendar-prepare'){
     if(!macBridge){send(res,403,{error:'Mac transfer is disabled until approved.'});return true;}
     const grant=await macBridge.prepare({ownerId:s.ownerId,binding:hash(s.id),sessionExpiresAt:s.expiresAt});
     try{await publishMacCalendarGrant(grant);if(!await confirmSession(s.ownerId,hash(s.id)))throw Error('Session ended.');}
     catch(error){macBridge.revoke(grant.capability);throw error;}
     send(res,200,{prepared:true,expiresAt:grant.expiresAt,scope:grant.scope,persisted:false});return true;
    }
    if(url.pathname==='/auth/google/save-review'){
     const values=await body(req,32768);send(res,200,await importReview.prepareSave({ownerId:s.ownerId,binding:hash(s.id),previewId:values.previewId,selectedKeys:values.selectedKeys,actor:{ownerId:s.ownerId,sessionBinding:hash(s.id),accessToken:s.accessToken}}));return true;
    }
    if(url.pathname==='/auth/google/save'){
     if(!importExecutor){send(res,403,{error:'Source imports are disabled.'});return true;}
     const values=await body(req);send(res,200,await importExecutor.execute({ownerId:s.ownerId,sessionBinding:hash(s.id),accessToken:s.accessToken},{reviewId:values.reviewId,approved:values.approved}));return true;
    }
    if(url.pathname==='/auth/google/review'){
     const values=await body(req,32768);send(res,200,await importReview.review({ownerId:s.ownerId,binding:hash(s.id),previewId:values.previewId,selectedKeys:values.selectedKeys}));return true;
    }
    if(url.pathname==='/auth/google/preview'){
     if(!preview){send(res,503,{error:'Preview is unavailable.'});return true;}
     const values=await body(req);
     const data=await preview({ownerId:s.ownerId,binding:hash(s.id),connectionId:values.connectionId,selectionId:values.selectionId,confirmed:values.confirmed});
     const review=importReview.remember({ownerId:s.ownerId,binding:hash(s.id),connectionId:values.connectionId,preview:data});
     send(res,200,{...data,...review});return true;
    }
    if(url.pathname==='/auth/google/pause'){
     if(!await confirmSession(s.ownerId,hash(s.id))){sessions.delete(s.id);send(res,401,{error:'Sign in again before changing connections.'});return true;}
     const values=await body(req);send(res,200,await stores.connectionStore.setPaused(s.ownerId,values.connectionId,values.paused));return true;
    }
    if(url.pathname==='/auth/google/selection'){
     if(!await confirmSession(s.ownerId,hash(s.id))){sessions.delete(s.id);send(res,401,{error:'Sign in again before selecting sources.'});return true;}
     const values=await body(req);
     send(res,200,await stores.connectionStore.saveSelection(s.ownerId,values.connectionId,values.selection));return true;
    }
    if(url.pathname==='/auth/google/begin'){
     const values=await body(req);send(res,200,await flow.begin({ownerId:s.ownerId,sessionBinding:s.id,provider:values.provider}));return true;
    }
    if(url.pathname==='/auth/google/signout'){
     sessions.delete(s.id);forget(s);send(res,200,{signedIn:false},{'Set-Cookie':'cc_google_dev=; HttpOnly; SameSite=Lax; Path=/auth/google; Max-Age=0'});return true;
    }
   }
   if(req.method==='GET'&&url.pathname==='/auth/google/callback'){
    if(!configured||!s){send(res,401,{error:'Development app session ended. Sign in and reconnect.'});return true;}
    if(url.searchParams.has('error')){send(res,303,'',{'Location':'/auth/google/?result=cancelled'});return true;}
    await flow.complete({ownerId:s.ownerId,sessionBinding:s.id,state:url.searchParams.get('state'),code:url.searchParams.get('code')});
    send(res,303,'',{'Location':'/auth/google/?result=authorized'});return true;
   }
   send(res,404,{error:'Not found.'});return true;
  }catch{send(res,400,{error:'Development connection could not be completed. Sign in and retry; no credentials are shown.'});return true;}
 };
}
