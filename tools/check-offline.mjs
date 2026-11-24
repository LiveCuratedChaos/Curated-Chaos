// Local tests and repository checks only. No setup, credential loader or cloud verifier.
import {offlineSuiteId} from './offline-test-reporter.mjs';
import {spawn} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {availableParallelism} from 'node:os';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function runLocal({command,args},cwd){return new Promise(resolveResult=>{
 const child=spawn(command,args,{cwd,stdio:['ignore','pipe','pipe']});let stdout='';
 child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{stdout=(stdout+chunk).slice(-262144);});
 child.stderr.resume(); // Never echo possibly private output from a failing check.
 child.on('error',()=>resolveResult({code:null,stdout:''}));
 child.on('close',code=>resolveResult({code,stdout}));
});}
export function locateOfflineFailure(site,projectRoot=root){
 const match=/^([a-f0-9]{16}):([1-9][0-9]{0,7})$/.exec(site);
 if(!match)return null;
 const matches=readdirSync(resolve(projectRoot,'tests'),{withFileTypes:true}).filter(entry=>entry.isFile()&&offlineSuiteId(entry.name)===match[1]);
 return matches.length===1?'tests/'+matches[0].name+':'+match[2]:null;
}
export async function runOfflineChecks({projectRoot=root,runCommand=runLocal,platform=process.platform}={}){
 const tests=readdirSync(resolve(projectRoot,'tests'),{withFileTypes:true}).filter(entry=>entry.isFile()&&entry.name.endsWith('.test.mjs')).map(entry=>resolve(projectRoot,'tests',entry.name)).sort();
 if(!tests.length)throw Error('Local test files are missing.');
 const platformExclusions=platform==='darwin'?[]:['mac-calendar-native-transfer.test.mjs'];const runnableTests=tests.filter(path=>!platformExclusions.includes(path.split('/').at(-1)));
 const plan=[
  {name:'tests',command:process.execPath,args:['--test','--test-reporter='+resolve(root,'tools/offline-test-reporter.mjs'),'--test-concurrency='+Math.min(5,Math.max(1,availableParallelism()-1)),...runnableTests]},
  {name:'privacy',command:process.execPath,args:['tools/check-repository-privacy.mjs','--scan-content']},
  {name:'whitespace',command:'git',args:['diff','--check']},
  {name:'launcher',command:'/bin/zsh',args:['-n','tools/Open-Private-Workspace.command']}
 ];
 const results={};for(const check of plan){try{results[check.name]=await runCommand(check,projectRoot);}catch{results[check.name]={code:null,stdout:''};}}
 const number=name=>{const match=results.tests.stdout?.match(new RegExp('^# '+name+' (\\d+)\\s*$','m'));return match?Number(match[1]):null;};
 const counts={total:number('tests'),passed:number('pass'),failed:number('fail'),cancelled:number('cancelled'),skipped:number('skipped')};
 const denied=number('loopbackListenerDenied'),wrapped=number('assertionWithDeniedListener');
 const failureReasons=counts.failed>0&&Number.isInteger(denied)&&Number.isInteger(wrapped)&&denied+wrapped<=counts.failed
  ?{loopbackListenerDenied:denied,assertionWithDeniedListener:wrapped,unclassified:counts.failed-denied-wrapped}:null;
 const sites=failureReasons?.unclassified>0?[...new Set([...results.tests.stdout.matchAll(/^# unclassifiedSite ([a-f0-9]{16}:[1-9][0-9]{0,7})$/gm)].map(match=>match[1]))].slice(0,16).filter(site=>locateOfflineFailure(site,projectRoot)):[];
 let privacy=null;try{privacy=JSON.parse(results.privacy.stdout.trim().split(/\r?\n/).at(-1));}catch{}
 const checks={tests:results.tests.code===0&&counts.total>0&&counts.passed===counts.total&&counts.failed===0&&counts.cancelled===0&&counts.skipped===0,privacy:results.privacy.code===0&&privacy?.safe===true&&privacy?.unprotectedPaths===0&&privacy?.trackedPrivateFiles===0&&Number.isInteger(privacy?.checkedIgnoreRules)&&privacy.checkedIgnoreRules>0&&privacy?.contentScan===true&&privacy?.content?.findingSources===0&&privacy?.content?.blockedSources===0,whitespace:results.whitespace.code===0,launcher:results.launcher.code===0};
 return{platformExclusions,localChecksPassed:Object.values(checks).every(Boolean),automatedTests:counts,...(failureReasons?{failureReasons}:{}),...(sites.length?{unclassifiedSites:sites}:{}),checks,privacy:privacy?{unprotectedPaths:privacy.unprotectedPaths,trackedPrivateFiles:privacy.trackedPrivateFiles,checkedIgnoreRules:privacy.checkedIgnoreRules,binarySourcesSkipped:privacy.content?.binarySourcesSkipped}:null};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length===4&&process.argv[2]==='--locate'){
   const site=locateOfflineFailure(process.argv[3]);
   if(!site)throw Error('Unknown test location.');
   console.log(site);
  }else{
   if(process.argv.length!==2)throw Error('Unsupported arguments.');
   const report=await runOfflineChecks();console.log(JSON.stringify(report));if(!report.localChecksPassed)process.exitCode=1;
  }
 }
 catch{console.error('Local verification could not finish. No credentials or check output displayed.');process.exitCode=1;}
}
