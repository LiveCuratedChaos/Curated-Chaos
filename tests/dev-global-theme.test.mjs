import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAppearance} from '../src/dev-theme.mjs';
const read=p=>readFileSync(p,'utf8');
test('M3A theme selection is validated and defaults safely',()=>{
 const body={dataset:{}};
 assert.deepEqual(applyAppearance(body,{palette:'earthy',density:'compact'}),{palette:'earthy',density:'compact'});
 assert.deepEqual(applyAppearance(body,{palette:'invalid',density:'unknown'}),{palette:'neutral',density:'balanced'});
 assert.deepEqual(body.dataset,{theme:'neutral',density:'balanced'});
});
test('every connected workspace includes the shared global theme loader',()=>{
 for(const route of ['dev-dashboard','dev-workspace','dev-calendar','dev-organize','dev-school','dev-work','dev-personal','dev-home','dev-finances','dev-search','dev-account','dev-integration']){
  assert.match(read(route+'.html'),/src="\/src\/dev-theme.mjs"/,route);
 }
});
test('verified session emits an owner-scoped appearance signal and sign out clears it',()=>{
 const source=read('src/dev-session.mjs');
 assert.match(source,/cc-dev-session/);
 assert.match(source,/notify\(user\)/);
 assert.match(source,/const clear=\(\)=>\{state=null;remove\(\);notify\(\)/);
 const theme=read('src/dev-theme.mjs');
 assert.match(theme,/readOwnerBriefPreferences/);
 assert.match(theme,/current!==sequence\|\|owner!==detail.ownerId/);
 assert.doesNotMatch(theme,/localStorage\.setItem|sessionStorage\.setItem/);
});
