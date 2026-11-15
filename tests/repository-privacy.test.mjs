import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkRepositoryPrivacy} from '../tools/check-repository-privacy.mjs';
const rules='node_modules/\n.env\n.env.*\n!.env.example\n.local/\n*.ccrecovery\n*.ccsnapshot\n*.ccworkspace\n*.cckeyrecovery\n';
async function repo(t,ignore=rules){const dir=await mkdtemp(join(tmpdir(),'cc-privacy-'));t.after(()=>rm(dir,{recursive:true,force:true}));execFileSync('git',['init','-q'],{cwd:dir});await writeFile(join(dir,'.gitignore'),ignore);return dir;}
test('repository privacy check verifies ignored secret locations without opening them',async t=>{const dir=await repo(t);await writeFile(join(dir,'.env.example'),'PUBLIC_FIXTURE=example');execFileSync('git',['add','.env.example'],{cwd:dir});const result=checkRepositoryPrivacy(dir);assert.equal(result.safe,true);assert.equal(result.contentScan,false);});
test('already tracked credentials fail even when current ignore rules protect the path',async t=>{const dir=await repo(t);await writeFile(join(dir,'.env.local'),'FAKE=fixture');execFileSync('git',['add','-f','.env.local'],{cwd:dir});const result=checkRepositoryPrivacy(dir);assert.equal(result.safe,false);assert.equal(result.unprotectedPaths,0);assert.equal(result.trackedPrivateFiles,1);assert.doesNotMatch(JSON.stringify(result),/FAKE|fixture|env.local/);});
test('missing ignore rules and nested tracked private directories fail',async t=>{const dir=await repo(t,'');await mkdir(join(dir,'nested','.local'),{recursive:true});await writeFile(join(dir,'nested','.local','fixture'),'fake');execFileSync('git',['add','.'],{cwd:dir});const result=checkRepositoryPrivacy(dir);assert.equal(result.safe,false);assert.ok(result.unprotectedPaths>0);assert.equal(result.trackedPrivateFiles,1);});

test('already tracked provider-backup archives fail even when encrypted and ignored',async t=>{const dir=await repo(t);await writeFile(join(dir,'copies.ccsnapshot'),'FICTIONAL ENCRYPTED ENVELOPE');execFileSync('git',['add','-f','copies.ccsnapshot'],{cwd:dir});const result=checkRepositoryPrivacy(dir);assert.equal(result.safe,false);assert.equal(result.trackedPrivateFiles,1);assert.equal(result.checkedIgnoreRules,11);assert.doesNotMatch(JSON.stringify(result),/copies|ENVELOPE/);});

test('tracked workspace archives are rejected without opening their contents',async t=>{const dir=await repo(t);await writeFile(join(dir,'copies.ccworkspace'),'FICTIONAL ENCRYPTED WORKSPACE');execFileSync('git',['add','-f','copies.ccworkspace'],{cwd:dir});const result=checkRepositoryPrivacy(dir);assert.equal(result.safe,false);assert.equal(result.trackedPrivateFiles,1);assert.equal(result.checkedIgnoreRules,11);});

test('tracked password-protected key archives are rejected without reading their contents',async t=>{const dir=await repo(t);await writeFile(join(dir,'key.cckeyrecovery'),'FICTIONAL ENCRYPTED KEY');execFileSync('git',['add','-f','key.cckeyrecovery'],{cwd:dir});const result=checkRepositoryPrivacy(dir);assert.equal(result.safe,false);assert.equal(result.trackedPrivateFiles,1);});
