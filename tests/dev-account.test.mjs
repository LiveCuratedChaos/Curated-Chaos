import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workspaceHref} from '../src/dev-navigation-model.mjs';
import {renderConnectedShell} from '../src/dev-cloud-shell.mjs';
import {allowedPublicPath} from '../tools/local-server.mjs';
test('M2K My Account route and shared shell',()=>{
 assert.equal(workspaceHref('account'),'/dev-account.html');
 assert.match(renderConnectedShell('ok',{active:'account'}),/href="\/dev-account.html"/);
 for(const route of ['/dev-account.html','/src/dev-account.mjs'])assert.equal(allowedPublicPath(route),true);
 assert.match(readFileSync('dev-account.html','utf8'),/dev-account.mjs/);
});
test('M2K account uses existing owner-private settings API, not local-only profiles',()=>{
 const s=readFileSync('src/dev-account.mjs','utf8');
 for(const part of ['listBriefPreferences','updateBriefPreferences','addBriefPreferences','readOwnerBriefPreferences','makeBriefPreferencesRecord'])assert.ok(s.includes(part),part);
 assert.match(s,/active:'account'/);
});
