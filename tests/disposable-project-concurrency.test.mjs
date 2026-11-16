import test from 'node:test';
import assert from 'node:assert/strict';
import {disposableConcurrencyMode,verifyDisposableProjectConcurrency} from '../tools/verify-disposable-project-concurrency.mjs';
test('disposable concurrency defaults to a network-free plan and rejects partial CI authority',()=>{
 assert.equal(disposableConcurrencyMode([]),'plan');
 for(const [args,env] of [[['--allow-dev-writes'],{}],[['--disposable-ci-only'],{}],[['--disposable-ci-only'],{GITHUB_ACTIONS:'true'}],[['--disposable-ci-only'],{CC_DISPOSABLE_POSTGRES:'true'}],[['--disposable-ci-only','--host=elsewhere'],{GITHUB_ACTIONS:'true',CC_DISPOSABLE_POSTGRES:'true'}]])assert.throws(()=>disposableConcurrencyMode(args,env));
 assert.equal(disposableConcurrencyMode(['--disposable-ci-only'],{GITHUB_ACTIONS:'true',CC_DISPOSABLE_POSTGRES:'true'}),'run');
});
test('direct verification cannot bypass the explicit disposable-service environment',async()=>{
 if(process.env.GITHUB_ACTIONS==='true'&&process.env.CC_DISPOSABLE_POSTGRES==='true')throw Error('Ordinary tests must not receive the disposable service grant.');
 await assert.rejects(verifyDisposableProjectConcurrency(),/disposable GitHub CI/);
});
