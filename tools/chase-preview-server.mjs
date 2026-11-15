// Approved, bounded, memory-only financial preview. No imports, mutations or paid refresh.
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {readFile,writeFile,mkdtemp,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {assertDevTarget,loadLocalConfig} from './dev-env.mjs';
import {createDevApi} from '../src/dev-api.mjs';
import {loadPlaidProductionConfig} from '../server/plaid-sandbox-config.mjs';
import {createPlaidChaseRead} from '../server/plaid-chase-read.mjs';
import {loadChasePreviewGrant,createChasePreview} from '../server/chase-preview.mjs';
const origin='http://127.0.0.1:5305';
export function validateChasePreviewArguments(argv){
 const get=name=>argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
 if(!argv.includes('--allow-financial-preview'))return null;
 const project=get('project'),expectedAccountCount=Number(get('accounts')),startDate=get('start'),endDateExclusive=get('end');
 const validDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 if(!/^[a-z0-9]{10,32}$/.test(project||'')||!Number.isInteger(expectedAccountCount)||expectedAccountCount<1||expectedAccountCount>10||!validDay(startDate)||!validDay(endDateExclusive)||endDateExclusive<=startDate||Date.parse(endDateExclusive)-Date.parse(startDate)>31*86400000)throw Error('An exact approved app project, account count and bounded date window are required.');
 return {project,expectedAccountCount,startDate,endDateExclusive};
}
export async function startChasePreview(root,approved,{configLoader=loadLocalConfig,apiFactory=createDevApi,previewFactory=null,serverFactory=createServer}={}){
 const config=assertDevTarget(configLoader(join(root,'.env.local')));if(config.ref!==approved.project)throw Error('Unexpected development app project.');
 const api=apiFactory({supabaseUrl:config.url,projectRef:config.ref,publishableKey:config.publishableKey}),signed=await api.signIn(config.users[0].email,config.users[0].password);
 let preview=null,ticket=null,cookie=null,server=null,launchFile=null,clear,closing;
 const close=()=>closing||(closing=(async()=>{clearTimeout(clear);preview=null;ticket=null;cookie=null;try{if(server?.listening)await new Promise(done=>server.close(done));if(launchFile)await unlink(launchFile).catch(error=>{if(error.code!=='ENOENT')throw error;});}finally{await api.signOutLocal(signed.accessToken);}})());
 try{const user=await api.getUser(signed.accessToken);
 if(!user?.id)throw Error('Development app owner could not be verified.');
 const ownerId=user.id,binding=randomBytes(32).toString('base64url'),expiresAt=Math.min(Date.now()+5*60000,signed.expiresAt);
 const confirmSession=async owner=>Date.now()<expiresAt&&owner===ownerId&&(await api.getUser(signed.accessToken))?.id===ownerId;
 const readPreview=previewFactory?await previewFactory({confirmSession}):createChasePreview({adapter:createPlaidChaseRead({...await loadPlaidProductionConfig(root,{approved:true}),productionApproved:true}),confirmSession,loadGrant:owner=>loadChasePreviewGrant(root,owner)});
 preview=await readPreview({ownerId,binding,confirmed:true,...approved});ticket=randomBytes(32).toString('base64url');
 const temp=await mkdtemp(join(tmpdir(),'curated-chase-preview-'));launchFile=join(temp,'launch-url');await writeFile(launchFile,origin+'/start/'+ticket,{flag:'wx',mode:0o600});
 const page='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chase read-only preview · Curated Chaos</title><link rel="stylesheet" href="/src/styles.css"></head><body data-theme="neutral"><main class="content cc-connections-page"><p class="eyebrow">CURATED CHAOS · PRIVATE PREVIEW</p><h1>Chase read-only preview</h1><div id="financial-preview"><p>Loading private preview…</p></div></main><script type="module" src="/auth/finances/ui.mjs"></script></body></html>';
 function send(res,status,body,type='application/json',extra={}){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",...extra});res.end(typeof body==='string'?body:JSON.stringify(body));}
 server=serverFactory(async(req,res)=>{try{
  if(req.method!=='GET'||req.headers.host!=='127.0.0.1:5305'){send(res,403,{error:'Private local read-only preview required.'});return;}
  const path=new URL(req.url,origin).pathname;if(Date.now()>=expiresAt){preview=null;ticket=null;send(res,401,{error:'Preview expired.'});return;}
  if(ticket&&path==='/start/'+ticket){ticket=null;cookie=randomBytes(32).toString('base64url');await unlink(launchFile);send(res,303,'','text/plain',{'Location':'/auth/finances/','Set-Cookie':'cc_chase_preview='+cookie+'; HttpOnly; SameSite=Lax; Path=/auth/finances; Max-Age=300'});return;}
  if(path==='/src/styles.css'){send(res,200,await readFile(join(root,'src/styles.css'),'utf8'),'text/css');return;}
  if(!cookie||!(req.headers.cookie||'').split(';').some(c=>c.trim()==='cc_chase_preview='+cookie)||!await confirmSession(ownerId)){send(res,401,{error:'Verified private preview session required.'});return;}
  if(path==='/auth/finances/'){send(res,200,page,'text/html; charset=utf-8');return;}
  if(path==='/auth/finances/ui.mjs'){send(res,200,await readFile(join(root,'server/chase-preview-ui.mjs'),'utf8'),'text/javascript; charset=utf-8');return;}
  if(path==='/auth/finances/data'){send(res,200,{...preview,expiresAt});return;}
  send(res,404,{error:'Not found.'});
 }catch{send(res,400,{error:'Private financial preview unavailable. No account details are displayed.'});}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(5305,'127.0.0.1',resolve);});
 clear=setTimeout(()=>{void close().catch(()=>console.error('Temporary financial sign-in cleanup could not be confirmed.'));},Math.max(0,expiresAt-Date.now()));clear.unref();
 return {server,launchFile,accountCount:preview.accounts.length,transactionCount:preview.transactions.length,expiresAt,close};
 }catch(error){try{await close();}catch{throw Error('Temporary financial sign-in cleanup could not be confirmed.');}throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const approved=validateChasePreviewArguments(process.argv.slice(2));if(approved){const started=await startChasePreview(process.cwd(),approved);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void started.close().then(()=>{console.log('Financial preview closed; temporary sign-in closed.');},()=>{console.error('Financial preview cleanup needs review.');process.exitCode=1;});});console.log(JSON.stringify({ready:true,launchFile:started.launchFile,accountCount:started.accountCount,transactionCount:started.transactionCount,databaseWritten:false,expiresAt:started.expiresAt}));}else{console.log('PLAN ONLY — no credentials read, no network requests, no database writes.');console.log('After explicit approval, --allow-financial-preview --project=EXACT_DEV_PROJECT --accounts=APPROVED_COUNT --start=YYYY-MM-DD --end=YYYY-MM-DD reads cached balances and bounded transactions for exactly the approved existing Chase accounts. Preview stays in memory, amounts start hidden, and no financial record is imported.');}}
 catch{console.error('Financial preview STOPPED. No credentials, amounts or transaction details are printed. No financial records were imported.');process.exitCode=1;}
}
