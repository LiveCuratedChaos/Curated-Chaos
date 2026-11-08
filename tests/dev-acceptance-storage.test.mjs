import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/dev-acceptance.mjs',import.meta.url),'utf8');
test('M1H Fixed: checklist statuses persist to browser localStorage scoped by account and project',()=>{
 assert.match(src,/cc-m1h-checklist-\$\{config\.projectRef\}-\$\{user\.id\}/);
 assert.match(src,/localStorage\.setItem\(key/);
 assert.match(src,/localStorage\.getItem\(key/);
});
test('M1H Fixed: supports previous tab sessionStorage migration and manual 1–5 restoration',()=>{
 assert.match(src,/sessionStorage\.getItem\(key\)/);
 assert.match(src,/acceptance-recover/);
 assert.match(src,/ACCEPTANCE_CASES\.slice\(0,5\)/);
 assert.match(src,/!\['failed','blocked'\]\.includes/);
});
test('M1H Fixed: acceptance has a functional direct sign-in and sign-out',()=>{
 assert.match(src,/id="acceptance-login"/);
 assert.match(src,/await auth\.signIn\(email,password\)/);
 assert.match(src,/await auth\.signOut\(\)/);
 assert.match(src,/user=null;grades=\{\}/);
});
test('M1H Fixed: no cloud write calls added to read-only acceptance page',()=>{
 for(const s of ['addFictionalTask','addSuggestionDecision','toggleFictionalTask','deleteRecord'])assert.doesNotMatch(src,new RegExp(s));
});
