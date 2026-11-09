import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkDeploymentReadiness,templateKeys,validateTemplate} from '../tools/check-deployment-readiness.mjs';
const template=templateKeys.map(key=>key+'=<PLACEHOLDER>').join('\n');
const manifest=JSON.stringify({engines:{node:'>=22'},dependencies:{'google-auth-library':'11.3.3'},devDependencies:{'@electric-sql/pglite':'0.5.15'}});
const read=path=>path==='.env.example'?template:path==='package.json'?manifest:assert.fail('Unexpected file read');
test('offline inventory reads only sanitized template and manifest; successful preparation remains blocked',()=>{
 const paths=[];const report=checkDeploymentReadiness({read:path=>{paths.push(path);return read(path);}});
 assert.deepEqual(paths,['.env.example','package.json']);assert.equal(report.offlinePreparationPassed,true);assert.equal(report.productionReady,false);assert.equal(report.status,'blocked');assert.equal(report.boundaries.realServicesChecked,false);assert.equal(report.boundaries.publicPublishRoot,'repository-root-forbidden');assert.ok(report.blockers.length>=5);
});
test('template rejects literal values, unknown keys, duplicate and omitted keys without disclosing input',()=>{
 for(const content of [template.replace('<PLACEHOLDER>','private-value'),template+'\nOTHER=<VALUE>',template+'\n'+template.split('\n')[0],template.split('\n').slice(1).join('\n')])assert.equal(validateTemplate(content),false);
 const report=checkDeploymentReadiness({read:path=>path==='.env.example'?'PRIVATE_VALUE=hidden-sensitive-marker':manifest});assert.equal(report.offlinePreparationPassed,false);assert.ok(!JSON.stringify(report).includes('hidden-sensitive-marker'));
});
test('unreadable and malformed metadata fail closed without printing exceptions',()=>{
 for(const read of [()=>{throw Error('hidden-sensitive-marker');},()=>'{invalid']){const report=checkDeploymentReadiness({read});assert.equal(report.offlinePreparationPassed,false);assert.equal(report.productionReady,false);assert.ok(!JSON.stringify(report).includes('hidden-sensitive-marker'));}
});
test('stale runtime and missing dependencies fail preparation',()=>{
 const report=checkDeploymentReadiness({read:path=>path==='.env.example'?template:JSON.stringify({engines:{node:'>=18'}})});assert.equal(report.offlinePreparationPassed,false);
});
test('committed example contains placeholders only and remains development scoped',()=>{
 assert.equal(validateTemplate(readFileSync(new URL('../.env.example',import.meta.url),'utf8')),true);
});
test('CLI always blocks production and rejects target/deployment arguments',async()=>{
 const {spawnSync}=await import('node:child_process');
 const script=new URL('../tools/check-deployment-readiness.mjs',import.meta.url);
 const result=spawnSync(process.execPath,[script.pathname],{encoding:'utf8'});
 assert.equal(result.status,1);assert.equal(JSON.parse(result.stdout).productionReady,false);
 const rejected=spawnSync(process.execPath,[script.pathname,'--deploy'],{encoding:'utf8'});
 assert.equal(rejected.status,1);assert.equal(rejected.stdout,'');assert.match(rejected.stderr,/accepts no arguments/);
});
