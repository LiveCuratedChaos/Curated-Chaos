import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
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
test('verified session emits an owner-scoped appearance signal and sign out clears it',async()=>{
 const source=read('src/dev-session.mjs');
 const events=[],owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const c=vm.createContext({window:{dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}});
 vm.runInContext(source.replace(/^export /gm,''),c);
 c.fixtureApi={signIn:async()=>({accessToken:'fixture',refreshToken:'fixture-refresh',expiresAt:1_000_000}),getUser:async()=>({id:owner,email:'fixture@example.test'}),signOut:async()=>{}};
 vm.runInContext(`manager=createDevSessionManager(fixtureApi,'devproject123',null,()=>1)`,c);
 await vm.runInContext(`manager.signIn('fixture','fixture')`,c);
 assert.equal(events.at(-1).type,'cc-dev-session');
 assert.equal(events.at(-1).detail.ownerId,owner);
 assert.equal(typeof events.at(-1).detail.readPreferences,'function');
 await vm.runInContext('manager.signOut()',c);
 assert.equal(events.at(-1).detail,null);
 const theme=read('src/dev-theme.mjs');
 assert.match(theme,/readOwnerBriefPreferences/);
 assert.match(theme,/current!==sequence\|\|owner!==detail.ownerId/);
 assert.doesNotMatch(theme,/localStorage\.setItem|sessionStorage\.setItem/);
});
