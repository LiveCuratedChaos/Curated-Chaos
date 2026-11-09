// Offline release gate only. This does not deploy, migrate, open credentials, or certify production readiness.
import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const offlineScope='Offline regression suite, local content privacy, and pending tracked/staged whitespace';

export function validateLocalReleaseArguments(argv){
  if(argv.length)throw Error('The local release gate accepts no service, deployment, or migration arguments.');
}

export function localTestFiles(root){
  return readdirSync(resolve(root,'tests'),{withFileTypes:true})
    .filter(entry=>entry.isFile()&&entry.name.endsWith('.test.mjs'))
    .map(entry=>'tests/'+entry.name).sort();
}

export function verifyLocalRelease({root=repositoryRoot,run=spawnSync,listTests=localTestFiles,log=console.log}={}){
  const checks=[];
  const report=passed=>({localGatePassed:passed,productionReady:false,scope:offlineScope,checks});
  let files;
  try{files=listTests(root);}catch{return {...report(false),error:'Offline test inventory could not be read.'};}
  if(!Array.isArray(files)||!files.length||files.some(file=>typeof file!=='string'||!/^tests\/[^/\\]+\.test\.mjs$/.test(file))){
    return {...report(false),error:'A nonempty bounded offline test inventory is required.'};
  }
  const commands=[
    {name:'offline-tests',command:process.execPath,args:['--test',...[...new Set(files)].sort()]},
    {name:'content-privacy',command:process.execPath,args:['tools/check-repository-privacy.mjs','--scan-content']},
    {name:'pending-whitespace',command:'git',args:['diff','--check','HEAD']}
  ];
  for(const {name,command,args}of commands){
    log('Checking '+name+'…');
    let result;
    try{result=run(command,args,{cwd:root,stdio:'inherit',shell:false});}
    catch{checks.push({name,passed:false});return {...report(false),error:'A local check could not be started.'};}
    const passed=result?.status===0&&!result.error&&!result.signal;
    checks.push({name,passed});
    // Fail closed and do not print captured exceptions/output, which may contain sensitive text.
    if(!passed)return {...report(false),error:'A local check failed or was interrupted.'};
  }
  return report(true);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    validateLocalReleaseArguments(process.argv.slice(2));
    const result=verifyLocalRelease();
    console.log(JSON.stringify(result));
    if(!result.localGatePassed)process.exitCode=1;
  }catch{
    console.error('Local release gate stopped. No deployment, migration, or real-service verification was requested.');
    process.exitCode=1;
  }
}
