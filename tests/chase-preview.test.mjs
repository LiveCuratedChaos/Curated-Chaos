import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,chmod,rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {createTokenSealer} from '../server/token-sealer.mjs';
import {createChasePreview,loadChasePreviewGrant} from '../server/chase-preview.mjs';
import {validateChasePreviewArguments} from '../tools/chase-preview-server.mjs';
const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fixture(){
 const state={valid:true,loads:0,reads:0,count:3,change:false};
 const read=createChasePreview({loadGrant:async()=>{state.loads++;return {ownerId,connectionId:state.change&&state.loads>1?ownerId:connectionId,accessToken:'access-production-fixture',accountIds:Array.from({length:state.count},(_,i)=>'fixture-'+i),grant:{ownerId}};},confirmSession:async()=>state.valid,adapter:{accounts:async()=>{state.reads++;return {accounts:[{name:'Fictional checking'}]};},transactions:async()=>{state.reads++;return {retrievedAt:'2026-11-08T12:00:00Z',transactions:[]};}}});
 return {state,read,args:{ownerId,binding:'fixture-session-binding',confirmed:true,expectedAccountCount:3,startDate:'2026-11-01',endDateExclusive:'2026-11-08'}};
}
test('financial preview requires explicit approval, exact account count and valid window',async()=>{
 const f=fixture();await assert.rejects(f.read({...f.args,confirmed:false}));assert.equal(f.state.loads,0);
 await assert.rejects(f.read({...f.args,endDateExclusive:'2027-01-01'}));assert.equal(f.state.reads,0);
 f.state.count=4;await assert.rejects(f.read(f.args),/selection changed/);assert.equal(f.state.reads,0);
});
test('financial preview omits credentials, never writes, and rejects changed source/session',async()=>{
 const f=fixture(),result=await f.read(f.args);assert.equal(result.databaseWritten,false);assert.equal(result.freshness,'provider-cached');assert.doesNotMatch(JSON.stringify(result),/access-production/);assert.equal(f.state.reads,2);
 const changed=fixture();changed.state.change=true;await assert.rejects(changed.read(changed.args),/changed/);
 const ended=fixture();ended.state.valid=false;await assert.rejects(ended.read(ended.args));assert.equal(ended.state.loads,0);
});
test('encrypted Chase grants remain owner-bound and reject unsafe credential files',async t=>{
 const root=await mkdtemp(join(tmpdir(),'cc-chase-grant-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'.local/plaid-connections'),{recursive:true,mode:0o700});await mkdir(join(root,'.local/provider-storage'),{recursive:true,mode:0o700});const key=Buffer.alloc(32,9),sealer=createTokenSealer(key);await writeFile(join(root,'.local/provider-storage/encryption-key'),key,{mode:0o600});
 const encrypted=sealer.seal({environment:'production',institutionId:'ins_56',itemId:'fixture-item',accessToken:'access-production-fixture',accountIds:['fixture-account'],products:['transactions']},'plaid:'+ownerId+':'+connectionId),path=join(root,'.local/plaid-connections',connectionId+'.connection');await writeFile(path,JSON.stringify({ownerId,connectionId,provider:'plaid',institution:'Chase',environment:'production',scope:'transactions',encrypted}),{mode:0o600});
 assert.equal((await loadChasePreviewGrant(root,ownerId)).accountIds.length,1);await assert.rejects(loadChasePreviewGrant(root,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'));await chmod(path,0o644);await assert.rejects(loadChasePreviewGrant(root,ownerId));
});
test('preview CLI rejects missing caps, impossible dates and excessive windows',()=>{
 assert.equal(validateChasePreviewArguments([]),null);const args=['--allow-financial-preview','--project=fngauurauwvbawlfzbbe','--accounts=3','--start=2026-11-01','--end=2026-11-08'];assert.equal(validateChasePreviewArguments(args).expectedAccountCount,3);
 for(const bad of [args.filter(a=>!a.startsWith('--accounts=')),args.map(a=>a.startsWith('--start=')?'--start=2026-02-30':a),args.map(a=>a.startsWith('--end=')?'--end=2027-01-01':a)])assert.throws(()=>validateChasePreviewArguments(bad));
});
test('financial preview CLI defaults to offline without local credentials',async t=>{
 const root=await mkdtemp(join(tmpdir(),'cc-chase-preview-offline-'));t.after(()=>rm(root,{recursive:true,force:true}));const output=execFileSync(process.execPath,[fileURLToPath(new URL('../tools/chase-preview-server.mjs',import.meta.url))],{cwd:root,encoding:'utf8'});assert.match(output,/PLAN ONLY/);assert.match(output,/no credentials read, no network requests, no database writes/);
});
test('preview UI hides amounts, escapes bank text and clears private content on close',async()=>{
 const listeners={},windowListeners={},root={innerHTML:'',textContent:'',addEventListener:(name,fn)=>listeners[name]=fn};
 const data={expiresAt:Date.now()+60000,startDate:'2026-11-01',endDateExclusive:'2026-11-08',retrievedAt:'2026-11-08T12:00:00Z',accounts:[{accountId:'fixture-account',name:'<script>bank</script>',type:'depository',subtype:'checking',currentMinor:12345,availableMinor:null}],transactions:[{accountId:'fixture-account',name:'<img src=x>',date:'2026-11-03',pending:true,direction:'outflow',amountMinor:1999}]};
 const context=vm.createContext({document:{getElementById:id=>id==='financial-preview'?root:null},window:{addEventListener:(name,fn)=>windowListeners[name]=fn},fetch:async()=>({ok:true,json:async()=>data}),Intl,Date,setTimeout:()=>1,clearTimeout(){}});
 const script=readFileSync(new URL('../server/chase-preview-ui.mjs',import.meta.url),'utf8').replace('(async()=>{try{const r=', 'const boot=(async()=>{try{const r=');vm.runInContext(script,context);await vm.runInContext('boot',context);
 assert.match(root.innerHTML,/Hidden/);assert.match(root.innerHTML,/Not provided/);assert.match(root.innerHTML,/Pending/);assert.doesNotMatch(root.innerHTML,/\$123\.45|\$19\.99|<img|<script>/);
 listeners.click({target:{closest:()=>true}});assert.match(root.innerHTML,/\$19\.99/);windowListeners.pagehide();assert.equal(vm.runInContext('data',context),null);assert.equal(root.textContent,'Private preview closed.');
});
test('saved financial filters combine account and status without refetching or revealing amounts',async()=>{
 const listeners={},filters={'bank-account-filter':{value:'a'},'bank-status-filter':{value:'pending'}},root={dataset:{sourceUrl:'/auth/google/finance-records'},innerHTML:'',addEventListener:(name,fn)=>listeners[name]=fn};let reads=0;
 const fixture={saved:true,expiresAt:Date.now()+60000,accounts:[{accountId:'a',name:'Fixture A',currentMinor:100,availableMinor:null},{accountId:'b',name:'Fixture B',currentMinor:200,availableMinor:null}],transactions:[{accountId:'a',name:'Pending A',pending:true,amountMinor:101},{accountId:'a',name:'Posted A',pending:false,amountMinor:202},{accountId:'b',name:'Pending B',pending:true,amountMinor:303}]};
 const context=vm.createContext({document:{getElementById:id=>id==='financial-preview'?root:filters[id]},window:{addEventListener(){}},fetch:async url=>{reads++;assert.equal(url,'/auth/google/finance-records');return{ok:true,json:async()=>fixture};},Intl,Date,setTimeout:()=>1,clearTimeout(){}});
 const script=readFileSync(new URL('../server/chase-preview-ui.mjs',import.meta.url),'utf8').replace('(async()=>{try{const r=', 'const boot=(async()=>{try{const r=');vm.runInContext(script,context);await vm.runInContext('boot',context);
 assert.match(root.innerHTML,/1 matching transactions/);assert.match(root.innerHTML,/Pending A/);assert.doesNotMatch(root.innerHTML,/Posted A|Pending B|\$1\.01/);
 filters['bank-status-filter'].value='posted';listeners.change({target:{id:'bank-status-filter'}});assert.match(root.innerHTML,/Posted A/);assert.doesNotMatch(root.innerHTML,/Pending A|Pending B/);
 filters['bank-account-filter'].value='b';listeners.change({target:{id:'bank-account-filter'}});assert.match(root.innerHTML,/No transactions match these filters/);assert.equal(reads,1);assert.match(root.innerHTML,/value="posted" selected/);
});
test('late financial responses cannot restore a closed page at either async boundary',async()=>{
 for(const boundary of ['fetch','json']){
  let release;const gate=new Promise(resolve=>release=resolve),events={},root={innerHTML:'',textContent:'',addEventListener(){}};
  const fixture={expiresAt:Date.now()+60000,accounts:[],transactions:[]};
  const response={ok:true,json:async()=>boundary==='json'?gate:fixture};
  const context=vm.createContext({document:{getElementById:()=>root},window:{addEventListener:(name,fn)=>events[name]=fn},fetch:async()=>boundary==='fetch'?gate:response,Intl,Date,setTimeout:()=>assert.fail('Closed page must not schedule expiry'),clearTimeout(){}});
  const script=readFileSync(new URL('../server/chase-preview-ui.mjs',import.meta.url),'utf8').replace('(async()=>{try{const r=', 'const boot=(async()=>{try{const r=');vm.runInContext(script,context);await Promise.resolve();events.pagehide();release(boundary==='fetch'?response:fixture);await vm.runInContext('boot',context);
  assert.equal(root.textContent,'Private preview closed.');assert.equal(root.innerHTML,'');assert.equal(vm.runInContext('data',context),null);
 }
});
test('expired or missing financial expiry never renders private records',async()=>{
 for(const expiresAt of [Date.now()-1000,undefined,NaN]){
  const root={innerHTML:'',textContent:'',addEventListener(){}},context=vm.createContext({document:{getElementById:()=>root},window:{addEventListener(){}},fetch:async()=>({ok:true,json:async()=>({expiresAt,accounts:[{name:'PRIVATE FIXTURE'}],transactions:[]})}),Intl,Date,setTimeout:()=>assert.fail('Expired data must not schedule rendering'),clearTimeout(){}});
  const script=readFileSync(new URL('../server/chase-preview-ui.mjs',import.meta.url),'utf8').replace('(async()=>{try{const r=', 'const boot=(async()=>{try{const r=');vm.runInContext(script,context);await vm.runInContext('boot',context);assert.equal(root.innerHTML,'');assert.match(root.textContent,/unavailable or expired/);
 }
});
test('interaction after expiry clears records even if the expiry timer was suspended',async()=>{
 let time=1000;const events={},root={innerHTML:'',textContent:'',addEventListener:(name,fn)=>events[name]=fn};Object.defineProperty(root,'textContent',{get(){return this.text||'';},set(value){this.text=value;this.innerHTML='';}});
 const context=vm.createContext({document:{getElementById:id=>id==='financial-preview'?root:null},window:{addEventListener(){}},fetch:async()=>({ok:true,json:async()=>({saved:true,expiresAt:2000,accounts:[{name:'Fixture',currentMinor:123,availableMinor:null}],transactions:[]})}),Intl,Date:{now:()=>time},setTimeout:()=>1,clearTimeout(){}});
 const script=readFileSync(new URL('../server/chase-preview-ui.mjs',import.meta.url),'utf8').replace('(async()=>{try{const r=', 'const boot=(async()=>{try{const r=');vm.runInContext(script,context);await vm.runInContext('boot',context);assert.match(root.innerHTML,/Fixture/);
 time=2001;events.click({target:{closest:()=>true}});assert.equal(root.innerHTML,'');assert.match(root.textContent,/Sign-in expired/);assert.equal(vm.runInContext('data',context),null);assert.equal(vm.runInContext('showAmounts',context),false);
});
test('saved financial view clears records and rejects late responses on cross-tab sign-out',async()=>{
 let channel,release;const gate=new Promise(yes=>release=yes),events={},root={dataset:{sourceUrl:'/auth/google/finance-records'},innerHTML:'',textContent:'',addEventListener(){}};
 class Channel{constructor(){channel=this;}close(){this.closed=true;}}
 const context=vm.createContext({BroadcastChannel:Channel,document:{getElementById:()=>root},window:{addEventListener:(name,fn)=>events[name]=fn},fetch:async()=>({ok:true,json:()=>gate}),Intl,Date,setTimeout:()=>1,clearTimeout(){}});
 const script=readFileSync(new URL('../server/chase-preview-ui.mjs',import.meta.url),'utf8').replace('(async()=>{try{const r=', 'const boot=(async()=>{try{const r=');vm.runInContext(script,context);await Promise.resolve();channel.onmessage({data:'signed-out'});release({expiresAt:Date.now()+60000,accounts:[{name:'PRIVATE FIXTURE'}],transactions:[]});await vm.runInContext('boot',context);assert.equal(root.innerHTML,'');assert.match(root.textContent,/Signed out in another tab/);assert.equal(vm.runInContext('data',context),null);events.pagehide();assert.equal(channel.closed,true);
});
