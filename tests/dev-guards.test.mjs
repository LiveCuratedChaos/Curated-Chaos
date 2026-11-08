import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allowedPublicPath } from '../tools/local-server.mjs';
import { assertDevTarget } from '../tools/dev-env.mjs';

test('only browser preview routes are served',()=>{
  for (const path of ['/','/index.html','/src/app.mjs','/src/styles.css','/public/manifest.webmanifest']) assert.equal(allowedPublicPath(path),true,path);
  for (const path of ['/.env.local','/tools/verify-rls.mjs','/docs/APPROVED_BLUEPRINT.md','/supabase/migrations/001_dev_isolation.sql','/tests/core.test.mjs','/package.json','/public/.hidden','/src/../tools/dev-env.mjs']) assert.equal(allowedPublicPath(path),false,path);
});
test('dev project guard rejects original project, invalid and secret keys',()=>{
  const good={CC_DEV_SUPABASE_URL:'https://devproject123.supabase.co/',CC_DEV_PROJECT_REF:'devproject123',CC_ORIGINAL_PROJECT_REF:'originalproject123',CC_DEV_PUBLISHABLE_KEY:'sb_publishable_testexample',CC_CONFIRM_NEW_DEV_PROJECT:'I_CHECKED_THIS_IS_NOT_MY_EXISTING_PROJECT',CC_TEST_A_EMAIL:'a@example.test',CC_TEST_A_PASSWORD:'a-fake-password',CC_TEST_B_EMAIL:'b@example.test',CC_TEST_B_PASSWORD:'b-fake-password'};
  assert.equal(assertDevTarget(good).ref,'devproject123');
  assert.throws(()=>assertDevTarget({...good,CC_ORIGINAL_PROJECT_REF:'devproject123'}));
  assert.throws(()=>assertDevTarget({...good,CC_DEV_PUBLISHABLE_KEY:'sb_secret_example'}));
  assert.throws(()=>assertDevTarget({...good,CC_CONFIRM_NEW_DEV_PROJECT:''}));
  assert.throws(()=>assertDevTarget({...good,CC_DEV_PROJECT_REF:'different'}));
  assert.throws(()=>assertDevTarget({...good,CC_TEST_B_EMAIL:'a@example.test'}));
});
test('minimal database migration has mandatory RLS, explicit grants and no browser membership mutations',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/001_dev_isolation.sql',import.meta.url),'utf8');
  for (const table of ['cc_profiles','cc_households','cc_household_memberships','cc_records']) assert.match(sql,new RegExp(`alter table public\.${table} enable row level security;`));
  assert.match(sql,/revoke all on table public\.cc_profiles/);
  assert.match(sql,/grant select on table public\.cc_household_memberships to authenticated;/);
  assert.doesNotMatch(sql,/grant (?:insert|update|delete)[^;]*cc_household_memberships to authenticated;/);
  assert.match(sql,/security definer set search_path = ''/);
  assert.match(sql,/create policy cc_record_insert/);
});
