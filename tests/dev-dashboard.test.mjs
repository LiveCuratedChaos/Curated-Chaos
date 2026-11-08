import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allowedPublicPath, makeHandler } from '../tools/local-server.mjs';
import { LOCAL_PAGES, renderConnectedShell } from '../src/dev-cloud-shell.mjs';
const read = rel => readFileSync(new URL('../'+rel,import.meta.url),'utf8');
test('M0F connected dashboard route and required modules are public, secrets still excluded',()=>{
 for(const path of ['/dev-dashboard.html','/src/dev-cloud-shell.mjs','/src/dev-brief.mjs','/src/dev-session.mjs']) assert.equal(allowedPublicPath(path),true,path);
 for(const path of ['/.env.local','/package.json','/tools/dev-env.mjs','/tests/dev-dashboard.test.mjs'])assert.equal(allowedPublicPath(path),false,path);
});
test('M0F cloud dashboard reuses existing test session and RLS-backed flow',()=>{
 const html=read('dev-dashboard.html'),js=read('src/dev-brief.mjs');
 assert.match(html,/data-connected-shell="true"/);
 assert.match(js,/renderConnectedShell/);
 assert.match(js,/createDevSessionManager/);
 assert.match(js,/normalizeCloudRecords/);
 assert.match(js,/listBriefRecords/);
 assert.doesNotMatch(js,/localStorage|seedDemoData/);
});
test('M2A navigation replaces demo-only pages with honest, navigable workspace routes',()=>{
 const output=renderConnectedShell('<p>safe placeholder</p>');
 assert.match(output,/CONNECTED DAILY BRIEF · QA ONLY/);
 assert.match(output,/Development tools/);
 assert.match(output,/href="\/dev-workspace.html\?page=curation"/);
 assert.match(output,/href="\/dev-school.html"/);
 assert.match(output,/href="\/dev-account.html"/);
 for(const name of LOCAL_PAGES)assert.ok(output.includes(name),name);
 assert.doesNotMatch(output,/Other pages · local fictional demo|Bearer |sb_secret_|localStorage|sessionStorage/);
});
test('M0F other pages remain separate local fixtures, not cloud-enabled',()=>{
 const code=read('src/app.mjs');
 assert.match(code,/seedDemoData/);
 assert.doesNotMatch(code,/createDevApi|createDevSessionManager/);
 assert.match(code,/new URLSearchParams\(location.search\)/);
});
