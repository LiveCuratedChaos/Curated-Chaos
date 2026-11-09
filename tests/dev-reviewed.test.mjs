import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {QA_PALETTES,allowedPreviewPalette} from '../src/dev-theme.mjs';
import {renderConnectedShell} from '../src/dev-cloud-shell.mjs';
import {allowedPublicPath} from '../tools/local-server.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Classic Minimal neutral is the development default and palette previews remain bounded',()=>{
 assert.equal(read('src/core.mjs').includes("theme:'neutral'"),true);
 assert.equal(QA_PALETTES.length,7); // six Classic Minimal + optional personal Dark Academia
 assert.deepEqual(QA_PALETTES.slice(0,6),['neutral','luxury','blush','coastal','earthy','executive']);
 assert.equal(allowedPreviewPalette('unknown'),'neutral');
 assert.equal(allowedPreviewPalette('academia'),'academia');
 for(const f of ['dev-auth.html','dev-brief.html','dev-dashboard.html','dev-tasks.html','dev-notes.html','dev-agenda.html','dev-email.html','dev-life.html']){
   assert.match(read(f),/data-theme="neutral"/);assert.match(read(f),/src\/dev-theme\.mjs/);
 }
 assert.equal(allowedPublicPath('/src/dev-theme.mjs'),true);
 assert.equal(allowedPublicPath('/.env.local'),false);
});
test('shell uses updated brand wording and a preview-only picker',()=>{
 const shell=renderConnectedShell('test',{active:'email'});
 assert.match(shell,/Organize the chaos\. Live beautifully\./);
 assert.match(shell,/cc-preview-palette/);
 assert.match(shell,/Dark Academia · personal/);
 assert.doesNotMatch(shell,/Heritage Gentleman/);
});
test('connected Daily Brief does not create a pending email-to-task from unsaved fixture',()=>{
 const code=read('src/dev-brief.mjs');
 assert.match(code,/lifeSuggestions\(life\)/);
 assert.match(code,/emailSuggestions\(emails\)/);
 assert.match(code,/nextEmails=normalizeFictionalEmails\(emailRows,viewer\)/);
 assert.match(code,/renderActivityHistory\(\)/);
 assert.match(read('src/dev-api.mjs'),/payload,created_at&visibility=eq\.private&owner_id=/);
});
test('Smart Independence preview preserves mandatory approval for email-derived tasks',()=>{
 const brief=read('src/dev-brief.mjs');
 const email=read('src/dev-email.mjs');
 assert.match(email,/Categorized automatically from a fixed sample template/);
 assert.match(brief,/explicit approval required/);
 assert.match(brief,/Approve & save private task/);
 assert.doesNotMatch(email,/accounts\.google\.com|gmail\.google\.com|api\.gmail\.com/);
});
