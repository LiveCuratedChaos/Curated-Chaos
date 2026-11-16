import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyLocalRelease,localTestFiles,validateLocalReleaseArguments} from '../tools/verify-local-release.mjs';

function fixture(results=[{status:0},{status:0},{status:0}]){
  const calls=[],logs=[];
  const options={root:'/fictional/repository',listTests:()=>['tests/z.test.mjs','tests/a.test.mjs'],log:value=>logs.push(value),run:(command,args,options)=>{calls.push({command,args,options});return results[calls.length-1];}};
  return {calls,logs,options};
}

test('a successful gate runs the entire supplied suite, content privacy, then pending whitespace without service commands',()=>{
  const f=fixture(),result=verifyLocalRelease(f.options);
  assert.equal(result.localGatePassed,true);
  assert.equal(result.productionReady,false);
  assert.deepEqual(f.calls.map(call=>call.args),[['--test','tests/a.test.mjs','tests/z.test.mjs'],['tools/check-repository-privacy.mjs','--scan-content'],['diff','--check','HEAD']]);
  assert.equal(f.calls[0].command,process.execPath);
  assert.equal(f.calls[1].command,process.execPath);
  assert.equal(f.calls[2].command,'git');
  for(const call of f.calls){assert.equal(call.options.cwd,'/fictional/repository');assert.equal(call.options.shell,false);}
  assert.doesNotMatch(JSON.stringify(f.calls),/\.env|--project=|--start-|--allow-.*test|connections-server|--create/);
});

test('failures in every check produce a failed local gate and stop before later commands',()=>{
  for(let stage=0;stage<3;stage++){
    const results=[{status:0},{status:0},{status:0}];results[stage]={status:1};
    const f=fixture(results),result=verifyLocalRelease(f.options);
    assert.equal(result.localGatePassed,false);
    assert.equal(result.productionReady,false);
    assert.equal(f.calls.length,stage+1);
    assert.equal(result.checks.at(-1).passed,false);
  }
});

test('missing executables, signals and thrown runner errors cannot be mistaken for success or leak output',()=>{
  for(const failure of [{status:null,error:Error('FICTIONAL_PRIVATE_DETAIL')},{status:0,signal:'SIGTERM'},{status:null,stdout:'FICTIONAL_PRIVATE_DETAIL',stderr:'FICTIONAL_PRIVATE_DETAIL'}]){
    const f=fixture([failure]),result=verifyLocalRelease(f.options);
    assert.equal(result.localGatePassed,false);
    assert.equal(f.calls.length,1);
    assert.doesNotMatch(JSON.stringify({result,logs:f.logs}),/FICTIONAL_PRIVATE_DETAIL/);
  }
  const f=fixture();f.options.run=()=>{throw Error('FICTIONAL_PRIVATE_DETAIL');};
  const result=verifyLocalRelease(f.options);
  assert.equal(result.localGatePassed,false);
  assert.doesNotMatch(JSON.stringify(result),/FICTIONAL_PRIVATE_DETAIL/);
});

test('empty, unsafe and unreadable test inventories fail before any commands can execute',()=>{
  for(const files of [[],null,['../outside.test.mjs'],['tests/nested/file.test.mjs'],['--allow-real-test'],['tests/file.mjs']]){
    const f=fixture();f.options.listTests=()=>files;
    assert.equal(verifyLocalRelease(f.options).localGatePassed,false);
    assert.equal(f.calls.length,0);
  }
  const f=fixture();f.options.listTests=()=>{throw Error('FICTIONAL_PRIVATE_DETAIL');};
  const result=verifyLocalRelease(f.options);
  assert.equal(result.localGatePassed,false);
  assert.equal(f.calls.length,0);
  assert.doesNotMatch(JSON.stringify(result),/FICTIONAL_PRIVATE_DETAIL/);
});

test('test discovery includes ordinary test files once and excludes fixtures, directories and symlinks',async t=>{
  const root=await mkdtemp(join(tmpdir(),'cc-local-gate-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'tests'));await mkdir(join(root,'tests','nested.test.mjs'));
  await writeFile(join(root,'tests','z.test.mjs'),'');await writeFile(join(root,'tests','a.test.mjs'),'');await writeFile(join(root,'tests','fixture.mjs'),'');
  await symlink(join(root,'tests','a.test.mjs'),join(root,'tests','linked.test.mjs'));
  assert.deepEqual(localTestFiles(root),['tests/a.test.mjs','tests/z.test.mjs']);
  const f=fixture();f.options.listTests=()=>['tests/a.test.mjs','tests/a.test.mjs'];verifyLocalRelease(f.options);
  assert.deepEqual(f.calls[0].args,['--test','tests/a.test.mjs']);
});

test('the CLI accepts no deployment, database, provider or recursive-test arguments',()=>{
  assert.doesNotThrow(()=>validateLocalReleaseArguments([]));
  for(const args of [['--deploy'],['--project=fictional'],['--allow-private-cookie-test'],['--skip-tests'],['--test']])assert.throws(()=>validateLocalReleaseArguments(args));
});
