// Local, single-owner consent preparation. No financial snapshot or database import endpoint.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,lstat,readdir,mkdtemp,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
import {loadLocalConfig,assertDevTarget} from './dev-env.mjs';
import {createDevApi} from '../src/dev-api.mjs';
import {loadPlaidProductionConfig} from '../server/plaid-sandbox-config.mjs';
import {createPlaidConnectionClient} from '../server/plaid-connection-client.mjs';
import {createChaseConnectionFlow} from '../server/plaid-chase-connection.mjs';
import {createLocalProviderStore} from '../server/local-provider-store.mjs';
const origin='http://127.0.0.1:5304',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function startChaseAuthorization(root,expectedProject){
 const development=assertDevTarget(loadLocalConfig(join(root,'.env.local')));if(development.ref!==expectedProject)throw Error('Unexpected development app project.');
 const api=createDevApi({supabaseUrl:development.url,projectRef:development.ref,publishableKey:development.publishableKey});
 const signed=await api.signIn(development.users[0].email,development.users[0].password),user=await api.getUser(signed.accessToken);
 if(!uuid.test(user?.id||''))throw Error('Development app owner could not be verified.');
 const sessionBinding=randomBytes(32).toString('base64url'),expiresAt=Math.min(Date.now()+30*60000,signed.expiresAt),ownerId=user.id;
 const confirmSession=async(owner)=>Date.now()<expiresAt&&owner===ownerId&&(await api.getUser(signed.accessToken))?.id===ownerId;
 const config=await loadPlaidProductionConfig(root,{approved:true}),client=createPlaidConnectionClient(config,{productionApproved:true});
 const {sealer}=await createLocalProviderStore(join(root,'.local/provider-storage'));
 const directory=join(root,'.local/plaid-connections');await mkdir(directory,{recursive:true,mode:0o700});const dirStat=await lstat(directory);if(!dirStat.isDirectory()||dirStat.isSymbolicLink()||(dirStat.mode&0o077))throw Error('Private bank authorization storage required.');
 const connectionStore={
  async listOwner(owner){const result=[];for(const name of await readdir(directory)){if(!/^[a-f0-9-]{36}\.connection$/i.test(name))continue;const path=join(directory,name),stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077))throw Error('Unsafe bank authorization storage.');const row=JSON.parse(await readFile(path,'utf8'));if(row.ownerId===owner)result.push({provider:row.provider,institution:row.institution,environment:row.environment,status:'authorized'});}return result;},
  async insert(row){if(row.ownerId!==ownerId||!uuid.test(row.connectionId)||row.provider!=='plaid'||row.environment!=='production'||row.institution!=='Chase'||row.scope!=='transactions')throw Error('Unexpected bank authorization.');const path=join(directory,row.connectionId+'.connection');await writeFile(path,JSON.stringify(row),{flag:'wx',mode:0o600});const saved=JSON.parse(await readFile(path,'utf8'));if(saved.encrypted!==row.encrypted)throw Error('Bank authorization storage could not be verified.');}
 };
 const attempts=new Map(),attemptStore={put:async(id,row)=>attempts.set(id,row),get:async id=>attempts.get(id),consume:async id=>{const row=attempts.get(id);attempts.delete(id);return row;}};
 const flow=createChaseConnectionFlow({environment:'production',productionApproved:true,client,sealer,connectionStore,attemptStore,confirmSession});
 const attempt=await flow.begin({ownerId,sessionBinding,confirmed:true});
 let ticket=randomBytes(32).toString('base64url'),browserCookie=null,result=null,busy=false;const csrf=randomBytes(32).toString('base64url');
 const temporary=await mkdtemp('/private/tmp/curated-chase-authorization-'),launchFile=join(temporary,'launch-url');await writeFile(launchFile,origin+'/start/'+ticket,{flag:'wx',mode:0o600});
 const page='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chase authorization · Curated Chaos</title><link rel="stylesheet" href="/src/styles.css"></head><body data-theme="neutral"><main class="content cc-connections-page"><p class="eyebrow">CURATED CHAOS · ON THIS MAC</p><h1>Connect Chase read-only</h1><section class="panel"><p>You will review consent through Plaid and sign in directly with Chase. Choose only the accounts you want to share.</p><p>This request is for account information, cached balances and transaction history, with up to 30 days requested. It cannot transfer money, pay bills or trade. Authorization does not import financial records into the app database.</p><p id="status" role="status">Checking authorization…</p><div id="actions"></div></section></main><script type="module" src="/auth/chase/ui.mjs"></script></body></html>';
 const script=`const status=document.getElementById('status'),actions=document.getElementById('actions');let csrf;async function check(){const r=await fetch('/auth/chase/status',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error();csrf=d.csrf;if(d.authorized){status.textContent='Chase authorization verified for '+d.accountCount+' selected accounts. No financial snapshot has been imported.';actions.innerHTML='';return;}status.textContent='Review the bank consent in the secure authorization window, then return here.';const link=document.createElement('a');link.className='btn btn-primary';link.href=d.authorizationUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open secure bank authorization';const button=document.createElement('button');button.className='btn';button.textContent='Check completed authorization';button.onclick=async()=>{button.disabled=true;try{const r=await fetch('/auth/chase/complete',{method:'POST',headers:{'Content-Type':'application/json','X-CC-CSRF':csrf},body:'{}'}),d=await r.json();if(!r.ok)throw Error();if(d.status==='pending'){status.textContent='Authorization is not complete yet. Finish the bank window, then check again.';}else await check();}catch{status.textContent='Authorization could not be verified. No financial snapshot was imported. Return to the setup chat for help.';}finally{button.disabled=false;}};actions.replaceChildren(link,document.createElement('p'),button);}check().catch(()=>{status.textContent='This private authorization session expired. Return to the setup chat.';});`;
 function send(res,status,body,type='application/json',extra={}){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",...extra});res.end(typeof body==='string'?body:JSON.stringify(body));}
 const server=createServer(async(req,res)=>{try{
  if(req.headers.host!=='127.0.0.1:5304'){send(res,403,{error:'Local authorization address required.'});return;}
  const path=new URL(req.url,origin).pathname;
  if(req.method==='GET'&&ticket&&path==='/start/'+ticket){ticket=null;browserCookie=randomBytes(32).toString('base64url');await unlink(launchFile);send(res,303,'','text/plain',{'Location':'/auth/chase/','Set-Cookie':'cc_chase_local='+browserCookie+'; HttpOnly; SameSite=Lax; Path=/auth/chase; Max-Age=1800'});return;}
  if(req.method==='GET'&&path==='/src/styles.css'){send(res,200,await readFile(join(root,'src/styles.css'),'utf8'),'text/css');return;}
  if(!browserCookie||!(req.headers.cookie||'').split(';').some(c=>c.trim()==='cc_chase_local='+browserCookie)||!await confirmSession(ownerId)){send(res,401,{error:'Private app session required.'});return;}
  if(req.method==='GET'&&path==='/auth/chase/'){send(res,200,page,'text/html; charset=utf-8');return;}
  if(req.method==='GET'&&path==='/auth/chase/ui.mjs'){send(res,200,script,'text/javascript; charset=utf-8');return;}
  if(req.method==='GET'&&path==='/auth/chase/status'){send(res,200,result?{authorized:true,accountCount:result.accountCount,csrf}:{authorized:false,authorizationUrl:attempt.authorizationUrl,expiresAt:attempt.expiresAt,csrf});return;}
  if(req.method==='POST'&&path==='/auth/chase/complete'){
   if(req.headers.origin!==origin||req.headers['x-cc-csrf']!==csrf||!String(req.headers['content-type']||'').startsWith('application/json')){send(res,403,{error:'Verified same-origin action required.'});return;}
   let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>1024)throw Error('Request too large.');}
   if(busy){send(res,409,{error:'Authorization check is already running.'});return;}busy=true;
   try{if(result){send(res,200,result);return;}const checked=await flow.complete({ownerId,sessionBinding,attemptId:attempt.attemptId});if(checked.status!=='pending')result=checked;send(res,200,checked);}finally{busy=false;}return;
  }
  send(res,404,{error:'Not found.'});
 }catch{send(res,400,{error:'Authorization could not be completed. Credentials and account details are not displayed.'});}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(5304,'127.0.0.1',resolve);});return {server,launchFile,attemptExpiresAt:attempt.expiresAt};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const project=process.argv.find(a=>a.startsWith('--project='))?.slice(10);
 if(process.argv.includes('--prepare-live-chase')&&project){try{const started=await startChaseAuthorization(process.cwd(),project);console.log(JSON.stringify({prepared:true,launchFile:started.launchFile,expiresAt:started.attemptExpiresAt,bankConnected:false,financialSnapshotImported:false}));}catch(error){console.error('Chase authorization preparation STOPPED. '+(['INVALID_API_KEYS','INVALID_FIELD','MISSING_FIELDS','INVALID_REDIRECT_URI','PRODUCT_NOT_ENABLED','INVALID_PRODUCT','INSTITUTION_NOT_SUPPORTED','UNAUTHORIZED_INSTITUTION'].includes(error.code)?'Provider setup code: '+error.code+'. ':'')+'No credentials or bank contents are printed.');process.exitCode=1;}}
 else{console.log('PLAN ONLY — no credentials read, no network requests, no database writes.');console.log('After explicit approval, --prepare-live-chase --project=EXPECTED_DEV_PROJECT privately loads live-access credentials and prepares a Transactions-only Chase consent session. Bank sign-in/account consent stays with the owner. No financial snapshot or app database import is performed.');}
}
