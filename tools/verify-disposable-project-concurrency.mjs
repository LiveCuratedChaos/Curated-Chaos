// Test-only PostgreSQL service. Never loads application configuration or credentials.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=new URL('../',import.meta.url),owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',session='11111111-1111-4111-8111-111111111111';
const id=n=>'77777777-7777-4777-8777-'+String(n).padStart(12,'0');
export function disposableConcurrencyMode(args,env={}){
 if(args.length===0)return 'plan';
 if(args.length!==1||args[0]!=='--disposable-ci-only'||env.GITHUB_ACTIONS!=='true'||env.CC_DISPOSABLE_POSTGRES!=='true')throw Error('Explicit disposable GitHub CI service required.');
 return 'run';
}
function connection(name){
 // Fixed service-network target and synthetic service password; PG environment overrides cannot redirect it.
 return spawn('stdbuf',['-oL','-eL','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','postgres','-p','5432','-U','postgres','-d','cc_disposable_qa'],{env:{PATH:process.env.PATH,HOME:'/tmp',PGPASSWORD:'fictional_ci_only',PGAPPNAME:name,PGCONNECT_TIMEOUT:'5',PGSSLMODE:'disable',PGPASSFILE:'/dev/null',PSQLRC:'/dev/null'},stdio:['pipe','pipe','pipe']});
}
function once(sql,name='cc-concurrency-observer'){
 return new Promise((resolveResult,reject)=>{const child=connection(name);let out='',err='';const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Disposable SQL deadline exceeded.'));},25000);
 child.stdout.on('data',v=>out=(out+v).slice(-131072));child.stderr.on('data',v=>err=(err+v).slice(-16384));child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('close',code=>{clearTimeout(timer);resolveResult({code,out:out.trim(),err});});child.stdin.end(sql);});
}
async function sql(text){const value=await once(text);assert.equal(value.code,0,value.err);return value.out;}
function interactive(){
 const child=connection('cc-concurrency-leader');let buffer='',err='',pending=null,sequence=0,ended=false;
 child.stdout.on('data',chunk=>{buffer+=chunk;const p=pending;if(p&&buffer.includes(p.marker+'\n')){const at=buffer.indexOf(p.marker+'\n'),value=buffer.slice(0,at).trim();buffer=buffer.slice(at+p.marker.length+1);pending=null;clearTimeout(p.timer);p.resolve(value);}});
 child.stderr.on('data',v=>err=(err+v).slice(-16384));
 const fail=()=>{ended=true;if(pending){clearTimeout(pending.timer);pending.reject(Error(err||'Disposable leader closed.'));pending=null;}};child.on('error',fail);child.on('close',fail);
 return{query(text){if(pending||ended)throw Error('Leader unavailable.');return new Promise((resolveQuery,reject)=>{const marker='CC_QA_DONE_'+(++sequence),timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Leader deadline exceeded.'));},20000);pending={marker,timer,resolve:resolveQuery,reject};child.stdin.write(text+'\n\\echo '+marker+'\n');});},close(){child.stdin.end('ROLLBACK;\n\\q\n');child.kill('SIGTERM');}};
}
const identity=`select set_config('request.jwt.claims','${JSON.stringify({sub:owner,session_id:session})}',true);set local role authenticated;`;
const transaction=`begin isolation level read committed;set local statement_timeout='20s';set local lock_timeout='15s';${identity}`;
const edge=(a,b)=>`select public.cc_set_project_hierarchy_link('${id(a)}',2,'${id(b)}',2,0,true);`;
const direct=(a,b)=>`insert into public.cc_records(owner_id,visibility,section,item_type,origin,payload) values('${owner}','private','Personal Life','project_project_link','PRIVATE_COOKIE_PROJECT_PROJECT_LINK','${JSON.stringify({fictional:true,schemaVersion:1,parentProjectId:id(a),childProjectId:id(b)})}');`;
async function waitUntil(query){const deadline=Date.now()+8000;do{if(await sql(query)==='t')return;await new Promise(r=>setTimeout(r,30));}while(Date.now()<deadline);throw Error('Actual overlapping advisory-lock wait was not observed.');}
async function seed(n){
 await sql(`begin;${identity}${[n,n+1,n+2,n+3].map(i=>`insert into public.cc_records(id,owner_id,visibility,section,item_type,origin,payload) values('${id(i)}','${owner}','private','Home','project','PRIVATE_COOKIE_PROJECT','${JSON.stringify({fictional:true,schemaVersion:1,title:'Fictional contention '+i,description:'Fictional only',status:'Active'})}');`).join('')}
 select public.cc_set_project_hierarchy_link('${id(n)}',1,'${id(n+1)}',1,0,true);select public.cc_set_project_hierarchy_link('${id(n+2)}',1,'${id(n+3)}',1,0,true);commit;`);
}
async function contend({n,directWrites=false,rollback=false,stale=false}){
 await seed(n);const leader=interactive();let contender;
 try{
  const leaderPid=Number(await leader.query('select pg_backend_pid();'));assert.ok(Number.isInteger(leaderPid)&&leaderPid>0);
  await leader.query(transaction+(directWrites?direct(n+1,n+2):edge(n+1,n+2)));
  contender=once(transaction+(stale?edge(n+1,n+3):directWrites?direct(n+3,n):edge(n+3,n))+'commit;','cc-concurrency-contender');
  // Prove a second real connection is waiting on this leader, rather than infer overlap from timing.
  await waitUntil(`select exists(select 1 from pg_stat_activity where application_name='cc-concurrency-contender' and wait_event_type='Lock' and wait_event='advisory' and ${leaderPid}=any(pg_blocking_pids(pid)));`);
  await leader.query(rollback?'rollback;':'commit;');const result=await contender;
  if(rollback)assert.equal(result.code,0,result.err);else{assert.notEqual(result.code,0);assert.match(result.err,stale?/changed; review again/:/would create a cycle/);}
  const links=await sql(`select count(*) from public.cc_records where item_type='project_project_link' and deleted_at is null and payload->>'parentProjectId' in ('${id(n)}','${id(n+1)}','${id(n+2)}','${id(n+3)}');`);assert.equal(links,'3');
  const expectedParent=rollback?n+3:n+1,expectedChild=rollback?n:n+2;
  assert.equal(await sql(`select count(*) from public.cc_records where item_type='project_project_link' and deleted_at is null and payload->>'parentProjectId'='${id(expectedParent)}' and payload->>'childProjectId'='${id(expectedChild)}';`),'1');
  return{overlapObserved:true,rejectedCycle:!rollback&&!stale,rejectedStale:stale,rollbackReleased:rollback,directWrites};
 }finally{leader.close();if(contender)await contender;}
}
export async function verifyDisposableProjectConcurrency(){
 disposableConcurrencyMode(['--disposable-ci-only'],process.env);
 // Refuse a pre-existing database even at the fixed service-network test address. No cleanup touches unknown records.
 const identityCheck=await sql("select current_database()||'|'||current_user||'|'||(select count(*) from information_schema.tables where table_schema in ('auth','public'));");
 assert.equal(identityCheck,'cc_disposable_qa|postgres|0');
 await sql(`create role anon;create role authenticated;create schema auth;grant usage on schema auth to anon,authenticated;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id));create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;`);
 const directory=new URL('supabase/migrations/',root);for(const name of (await readdir(directory)).filter(n=>/^\d+.*\.sql$/.test(n)).sort())await sql(await readFile(new URL(name,directory),'utf8'));
 await sql(await readFile(new URL('supabase/drafts/private_project_hierarchy.sql',root),'utf8'));
 await sql(`insert into auth.users values('${owner}');insert into auth.sessions values('${session}','${owner}');insert into public.cc_profiles(user_id,display_name) values('${owner}','Fictional concurrency account');`);
 const results=[];
 results.push(await contend({n:100}));
 results.push(await contend({n:200,directWrites:true}));
 results.push(await contend({n:300,rollback:true}));
 results.push(await contend({n:400,stale:true}));
 assert.equal(results.length,4);return{verified:true,disposableOnly:true,postgresMajor:Number((await sql('show server_version;')).split('.')[0]),observedOverlaps:4,results,hostedProjectsAccessed:0};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(disposableConcurrencyMode(process.argv.slice(2),process.env)==='plan')console.log(JSON.stringify({mode:'plan',connections:0,required:'--disposable-ci-only with isolated GitHub PostgreSQL service'}));else console.log(JSON.stringify(await verifyDisposableProjectConcurrency()));}
 catch(error){console.error('Disposable concurrency verification failed: '+error.message);process.exitCode=1;}
}
