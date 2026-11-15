import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from "node:fs";
import {CUSTOM_NAV_IDS,normalizeNavigation,navigationPages} from '../src/dev-navigation-model.mjs';
import {normalizeBriefPreferences} from '../src/dev-preferences-model.mjs';
test('navigation preferences sanitize unknown, repeated page identifiers',()=>{const p=normalizeNavigation({order:['work','work','evil'],hidden:['finances','evil']});assert.equal(p.order[0],'work');assert.equal(p.order.length,CUSTOM_NAV_IDS.length);assert.deepEqual(p.hidden,['finances']);});
test('hidden workspaces are removed from nav but remain available in page definitions',()=>{const pages=navigationPages({order:['work'],hidden:['finances']});assert.equal(pages[0].id,'work');assert.ok(!pages.some(p=>p.id==='finances'));assert.ok(CUSTOM_NAV_IDS.includes('finances'));});
test('account preferences preserve private navigation selection',()=>{const p=normalizeBriefPreferences({navigation:{order:['school','work'],hidden:['home']}});assert.equal(p.navigation.order[0],'school');assert.deepEqual(p.navigation.hidden,['home']);});

test('M3C: account form save binds navigation state in submit scope',()=>{
 const source=readFileSync('src/dev-account.mjs','utf8');
 const submit=source.slice(source.indexOf("root.addEventListener('submit'"));
 assert.match(submit,/const nav=normalizeNavigation\(\(preferencesDraft\|\|settings\)\.navigation\);\s*const v=new FormData\(ev\.target\)/);
});
