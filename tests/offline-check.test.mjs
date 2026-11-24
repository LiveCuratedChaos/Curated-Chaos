import test from 'node:test';import assert from 'node:assert/strict';import {runOfflineChecks} from '../tools/check-offline.mjs';
const ok={tests:{code:0,stdout:'# tests 4\n# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n'},privacy:{code:0,stdout:JSON.stringify({safe:true,contentScan:true,unprotectedPaths:0,trackedPrivateFiles:0,checkedIgnoreRules:10,content:{findingSources:0,blockedSources:0,binarySourcesSkipped:10}})},whitespace:{code:0,stdout:''},stagedWhitespace:{code:0,stdout:''},launcher:{code:0,stdout:''}};
test('offline check uses only tests, local privacy, whitespace and launcher syntax without cloud/setup commands',async()=>{const calls=[],report=await runOfflineChecks({runCommand:async check=>{calls.push(check);return ok[check.name];}});assert.equal(report.localChecksPassed,true);assert.deepEqual(calls.map(check=>check.name),['tests','privacy','whitespace','stagedWhitespace','launcher']);assert.equal(report.automatedTests.total,4);assert.equal(report.privacy.binarySourcesSkipped,10);for(const call of calls)assert.doesNotMatch(JSON.stringify(call.args),/\.env|--allow-|verify-private|preflight|setup:reuse|push|deploy/);assert.match(calls[0].args[2],/^--test-concurrency=[1-5]$/);assert.ok(calls[0].args.slice(3).every(path=>path.endsWith('.test.mjs')));});
test('failed checks do not expose captured output and remaining local checks still run',async()=>{const calls=[],report=await runOfflineChecks({runCommand:async check=>{calls.push(check.name);return check.name==='tests'?{code:1,stdout:'PRIVATE_FAILURE_CONTENT'}:ok[check.name];}});assert.equal(report.localChecksPassed,false);assert.equal(report.checks.tests,false);assert.equal(calls.length,5);assert.doesNotMatch(JSON.stringify(report),/PRIVATE_FAILURE_CONTENT/);});
test('missing summaries, skipped tests and blocked content scans fail closed',async()=>{for(const mode of ['summary','skip','privacy']){const replies=structuredClone(ok);if(mode==='summary')replies.tests.stdout='unrecognized output';if(mode==='skip')replies.tests.stdout=replies.tests.stdout.replace('# skipped 0','# skipped 1');if(mode==='privacy')replies.privacy.stdout=JSON.stringify({safe:true,contentScan:true,content:{findingSources:0,blockedSources:1}});const report=await runOfflineChecks({runCommand:async check=>replies[check.name]});assert.equal(report.localChecksPassed,false);}});
test('an unavailable command is reported safely rather than preventing other local checks',async()=>{const report=await runOfflineChecks({runCommand:async check=>{if(check.name==='whitespace')throw Error('PRIVATE_PROCESS_ERROR');return ok[check.name];}});assert.equal(report.localChecksPassed,false);assert.equal(report.checks.whitespace,false);assert.equal(report.checks.tests,true);assert.doesNotMatch(JSON.stringify(report),/PRIVATE_PROCESS_ERROR/);});

test('Linux explicitly excludes only native macOS transfer tests; macOS includes them and unexpected skips still fail',async()=>{for(const platform of ['linux','darwin']){let selected;const report=await runOfflineChecks({platform,runCommand:async check=>{if(check.name==='tests')selected=check.args;return ok[check.name];}});assert.equal(selected.some(path=>path.endsWith('/mac-calendar-native-transfer.test.mjs')),platform==='darwin');assert.deepEqual(report.platformExclusions,platform==='darwin'?[]:['mac-calendar-native-transfer.test.mjs']);assert.equal(report.localChecksPassed,true);}});

test('the offline reporter separates denied local listeners from ordinary failures without exposing their details',async()=>{
 const {default:report}=await import('../tools/offline-test-reporter.mjs');
 const failure=(code,syscall,address)=>({type:'test:fail',data:{name:'PRIVATE_TEST_NAME',details:{error:{code:'ERR_TEST_FAILURE',cause:{code,syscall,address,message:'PRIVATE_VALUE'}}}}});
 const diagnose=(message,file)=>({type:'test:diagnostic',data:{nesting:0,message,file}});
 const events=[failure('EPERM','listen','127.0.0.1'),failure('EACCES','listen','::1'),failure('EPERM','open','127.0.0.1'),failure('EADDRINUSE','listen','127.0.0.1'),failure('EPERM','listen','0.0.0.0'),
  {type:'test:fail',data:{details:{error:{code:'ERR_TEST_FAILURE',cause:{code:'ERR_ASSERTION',actual:{message:'listen EPERM: operation not permitted 127.0.0.1'}}}}}},
  diagnose('PRIVATE_DIAGNOSTIC'),diagnose('fail 0','private-test.mjs'),...['tests 6','pass 0','fail 6','cancelled 0','skipped 0'].map(m=>diagnose(m))];
 let stdout='';for await(const line of report(events))stdout+=line;
 assert.doesNotMatch(stdout,/PRIVATE|private-test|127\.0\.0\.1|fail 0/);
 const result=await runOfflineChecks({runCommand:async gate=>gate.name==='tests'?{code:1,stdout}:ok[gate.name]});
 assert.deepEqual(result.failureReasons,{loopbackListenerDenied:2,assertionWithDeniedListener:1,unclassified:3});
 assert.equal(result.localChecksPassed,false);assert.equal(result.automatedTests.failed,6);
});
test('unexpected failures expose only bounded local lookup codes and never raw diagnostics',async()=>{
 const {default:report,offlineSuiteId}=await import('../tools/offline-test-reporter.mjs');
 const {locateOfflineFailure}=await import('../tools/check-offline.mjs');
 const path='/private/FICTIONAL_PRIVATE_DIRECTORY/tests/offline-check.test.mjs';
 const events=[{type:'test:fail',data:{name:'DO_NOT_PRINT',file:path,line:5,details:{error:Error('DO_NOT_PRINT')}}}];
 for(const text of ['tests 1','pass 0','fail 1','skipped 0','cancelled 0'])events.push({type:'test:diagnostic',data:{nesting:0,message:text}});
 let stdout='';for await(const line of report(events))stdout+=line;
 const code=offlineSuiteId(path)+':5';
 assert.doesNotMatch(stdout,/offline-check|PRIVATE|DO_NOT_PRINT/);
 const result=await runOfflineChecks({runCommand:async gate=>gate.name==='tests'?{code:1,stdout}:ok[gate.name]});
 assert.deepEqual(result.unclassifiedSites,[code]);
 assert.equal(result.localChecksPassed,false);
 assert.equal(locateOfflineFailure(code),'tests/offline-check.test.mjs:5');
 for(const invalid of ['../private','0000000000000000:4',code+'\ninvalid',code.split(':')[0]+':0'])assert.equal(locateOfflineFailure(invalid),null);
});

test('a whitespace error in the staged snapshot still fails when the working tree passes',async()=>{
 const report=await runOfflineChecks({runCommand:async check=>{
  if(check.name!=='stagedWhitespace')return ok[check.name];
  assert.deepEqual(check.args,['diff','--cached','--check']);
  return {code:2,stdout:'PRIVATE_STAGED_CHANGE'};
 }});
 assert.equal(report.checks.whitespace,false);
 assert.equal(report.localChecksPassed,false);
 assert.doesNotMatch(JSON.stringify(report),/PRIVATE_STAGED_CHANGE/);
});
