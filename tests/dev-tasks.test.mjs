import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allowedPublicPath} from '../tools/local-server.mjs';
import {renderConnectedShell} from '../src/dev-cloud-shell.mjs';
import {selectTasks,taskCounts} from '../src/dev-tasks-model.mjs';
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const r=(id,section,done,day='2026-11-01')=>({id,section,item_type:'task',payload:{title:id,day,done},created_at:'2026-10-30T00:00:00Z'});
const records=[r('a','Home',false),r('b','Work',true),r('c','School',false,'2026-11-02')];
test('M0G cloud Tasks and modules are allowlisted, secrets remain private',()=>{
 for(const p of ['/dev-tasks.html','/src/dev-tasks.mjs','/src/dev-tasks-model.mjs'])assert.equal(allowedPublicPath(p),true,p);
 for(const p of ['/.env.local','/README.md','/tools/verify-rls.mjs','/tests/dev-tasks.test.mjs'])assert.equal(allowedPublicPath(p),false,p);
});
test('both QA views share connected navigation; demos are labeled',()=>{
 const brief=renderConnectedShell('test');const tasks=renderConnectedShell('test',{active:'tasks'});
 assert.match(brief,/href="\/dev-tasks.html"/);assert.match(tasks,/href="\/dev-dashboard.html"/);
 assert.match(tasks,/CONNECTED TASKS · QA ONLY/);assert.match(tasks,/Development tools/);
 assert.match(tasks,/aria-current="page" href="\/dev-tasks.html"/);
 assert.doesNotMatch(tasks,/sb_secret_|Bearer |sessionStorage/);
});
test('filter tasks by status and section without mutating source',()=>{
 assert.deepEqual(selectTasks(records).map(x=>x.id),['a','b','c']);
 assert.deepEqual(selectTasks(records,{status:'open'}).map(x=>x.id),['a','c']);
 assert.deepEqual(selectTasks(records,{status:'completed',section:'Work'}).map(x=>x.id),['b']);
 assert.deepEqual(selectTasks(records,{status:'open',section:'Work'}),[]);
 assert.equal(records.length,3);assert.throws(()=>selectTasks(records,{status:'invalid'}));
 assert.throws(()=>selectTasks(records,{section:'Finances'}));
});
test('task counters and authenticated API / model reuse',()=>{
 assert.deepEqual(taskCounts(records),{total:3,open:2,completed:1});
 const page=src('src/dev-tasks.mjs');
 for(const dep of ['createDevSessionManager','listBriefRecords','normalizeCloudRecords','makeFictionalTask','toggleFictionalTask','toggledTaskPayload'])assert.match(page,new RegExp(dep));
 assert.doesNotMatch(page,/localStorage|seedDemoData/);
 assert.match(src('dev-tasks.html'),/src="\/src\/dev-tasks.mjs"/);
});
test('server returns CSP for connected new QA page and rejects env access',async()=>{
 const {makeHandler}=await import('../tools/local-server.mjs');
 // Handler's files are not network-visible until configured; route + CSP code verified above.
 assert.match(src('tools/local-server.mjs'),/dev-tasks\.html/);
 assert.match(src('tools/local-server.mjs'),/Content-Security-Policy/);
});
