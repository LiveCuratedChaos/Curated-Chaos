import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allowedPublicPath} from '../tools/local-server.mjs';
import {renderConnectedShell} from '../src/dev-cloud-shell.mjs';
import {makeFictionalNote} from '../src/dev-api.mjs';
import {normalizeCloudRecords} from '../src/dev-brief-model.mjs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
test('M0H notes and modules allowlisted and secret files are not',()=>{
 for(const p of ['/dev-notes.html','/src/dev-notes.mjs'])assert.equal(allowedPublicPath(p),true,p);
 for(const p of ['/.env.local','/tools/dev-env.mjs','/tests/dev-notes.test.mjs'])assert.equal(allowedPublicPath(p),false,p);
});
test('connected shell offers Notes, Daily Brief, Tasks navigation, with demo labels',()=>{
 const html=renderConnectedShell('<p>Notes</p>',{active:'notes'});
 assert.match(html,/CONNECTED NOTES · QA ONLY/);
 for(const p of ['/dev-dashboard.html','/dev-tasks.html','/dev-notes.html'])assert.ok(html.includes(p));
 assert.match(html,/Development tools/);
 assert.match(html,/aria-current="page" href="\/dev-notes.html"/);
});
test('fictional notes are private and validated before saving',()=>{
 const record=makeFictionalNote(' QA demo ',' test ',a);
 assert.equal(record.visibility,'private');assert.equal(record.household_id,null);
 assert.equal(record.owner_id,a);assert.equal(record.item_type,'note');assert.equal(record.payload.title,'QA demo');
 assert.equal(record.payload.fictional,true);
 assert.throws(()=>makeFictionalNote('', 'body',a));assert.throws(()=>makeFictionalNote('title','body', 'wrong'));
});
test('notes from other account and nonfictional records are excluded',()=>{
 const mk=(owner,title,fictional)=>({id:title,owner_id:owner,household_id:null,visibility:'private',item_type:'note',section:'Personal Life',payload:{title,body:'test',fictional},created_at:'2026-10-30T12:00:00Z'});
 assert.deepEqual(normalizeCloudRecords([mk(a,'mine',true),mk(b,'theirs',true),mk(a,'not-fictional',false)],a).notes.map(n=>n.payload.title),['mine']);
});
test('new notes UI reuses cloud auth and private reads, escapes input',()=>{
 const code=src('src/dev-notes.mjs');
 for(const s of ['createDevSessionManager','listBriefRecords','normalizeCloudRecords','makeFictionalNote','api.addNote','escapeHtml as e'])assert.ok(code.includes(s),s);
 assert.doesNotMatch(code,/localStorage|seedDemoData/);
 assert.match(src('dev-notes.html'),/src="\/src\/dev-notes.mjs"/);
 assert.match(src('src/dev-brief.mjs'),/href="\/dev-notes.html"/);
});
test('connected notes route has development CSP and no private server files',()=>{
 const code=src('tools/local-server.mjs');assert.match(code,/dev-notes\.html/);assert.match(code,/Content-Security-Policy/);
});
