import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {assertDevTarget} from '../tools/dev-env.mjs';
import {validatePublicDevConfig} from '../src/dev-api.mjs';
test('database verification without explicit write flag only prints a plan, even outside a configured project',()=>{
 const output=execFileSync(process.execPath,[fileURLToPath(new URL('../tools/verify-rls.mjs',import.meta.url))],{cwd:tmpdir(),encoding:'utf8'});
 assert.match(output,/PLAN ONLY/);
 assert.match(output,/no local credentials read, no network requests, no database writes/);
 assert.doesNotMatch(output,/PASS \d|Verification STOPPED/);
});
test('both development target guards reject embedded credentials, query data, fragments and nonstandard ports',()=>{
 const ref='devproject123',key='sb_publishable_test';
 const config={CC_DEV_SUPABASE_URL:`https://${ref}.supabase.co/`,CC_DEV_PROJECT_REF:ref,CC_ORIGINAL_PROJECT_REF:'originalproject123',CC_DEV_PUBLISHABLE_KEY:key,CC_CONFIRM_NEW_DEV_PROJECT:'I_CHECKED_THIS_IS_NOT_MY_EXISTING_PROJECT',CC_TEST_A_EMAIL:'a@example.test',CC_TEST_A_PASSWORD:'fictional-a',CC_TEST_B_EMAIL:'b@example.test',CC_TEST_B_PASSWORD:'fictional-b'};
 for(const url of [`https://fixture:example@${ref}.supabase.co/`,`https://${ref}.supabase.co:8443/`,`https://${ref}.supabase.co/?fixture=example`,`https://${ref}.supabase.co/#example`]){
  assert.throws(()=>assertDevTarget({...config,CC_DEV_SUPABASE_URL:url}));
  assert.throws(()=>validatePublicDevConfig({supabaseUrl:url,projectRef:ref,publishableKey:key}));
 }
});
