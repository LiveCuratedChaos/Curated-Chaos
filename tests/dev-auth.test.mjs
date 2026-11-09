import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicDevConfig, makeFictionalNote, createDevApi } from '../src/dev-api.mjs';
import { sanitizedDevConfig, allowedPublicPath } from '../tools/local-server.mjs';
const raw={CC_DEV_SUPABASE_URL:'https://devproject123.supabase.co/',CC_DEV_PROJECT_REF:'devproject123',CC_ORIGINAL_PROJECT_REF:'originalproject123',CC_DEV_PUBLISHABLE_KEY:'sb_publishable_testexample',CC_CONFIRM_NEW_DEV_PROJECT:'I_CHECKED_THIS_IS_NOT_MY_EXISTING_PROJECT',CC_TEST_A_EMAIL:'a@example.test',CC_TEST_A_PASSWORD:'fake-password-a',CC_TEST_B_EMAIL:'b@example.test',CC_TEST_B_PASSWORD:'fake-password-b'};
const uuid='bb8f4c56-a302-48d3-8c40-dc2838a97221';
test('browser receives allowlisted project URL and publishable key only',()=>{
  const c=sanitizedDevConfig(raw);
  assert.deepEqual(Object.keys(c),['supabaseUrl','projectRef','publishableKey']);
  assert.ok(!JSON.stringify(c).includes('fake-password'));
  assert.equal(validatePublicDevConfig(c).ref,'devproject123');
  assert.throws(()=>validatePublicDevConfig({...c,publishableKey:'sb_secret_x'}));
  assert.throws(()=>validatePublicDevConfig({...c,supabaseUrl:'https://evil.example/'}));
});
test('dev login routes are explicit, credentials files unavailable',()=>{
  for(const path of ['/dev-auth.html','/dev-config.json','/src/dev-api.mjs','/src/dev-auth.mjs'])assert.equal(allowedPublicPath(path),true);
  for(const path of ['/.env.local','/tools/dev-env.mjs','/src/.env.local','/docs/APPROVED_BLUEPRINT.md','/src/unlisted.txt'])assert.equal(allowedPublicPath(path),false);
});
test('fictional cloud note is private, labeled, and non-shareable',()=>{
  const note=makeFictionalNote('QA note A','fictional',uuid);
  assert.deepEqual({owner_id:note.owner_id,household_id:note.household_id,visibility:note.visibility,section:note.section,item_type:note.item_type}, {owner_id:uuid,household_id:null,visibility:'private',section:'Personal Life',item_type:'note'});
  assert.equal(note.payload.fictional,true);
  assert.throws(()=>makeFictionalNote('', '', uuid));
  assert.throws(()=>makeFictionalNote('x', '', 'not-user-uuid'));
});
test('API authentication uses publishable key and sends access JWT for RLS',async()=>{
  const calls=[];
  const response=({ok=true,status=200,data={}}={})=>({ok,status,text:async()=>JSON.stringify(data)});
  const fetcher=async(url,opts)=>{
    calls.push({url,opts});
    if(url.includes('grant_type=password'))return response({data:{access_token:'test-access',refresh_token:'SHOULD-NOT-BE-PERSISTED',expires_in:3600}});
    if(url.includes('/auth/v1/user'))return response({data:{id:uuid,email:'test@example.test'}});
    if(url.includes('/rest/v1/cc_records'))return response({data:[]});
    return response();
  };
  const api=createDevApi(sanitizedDevConfig(raw),fetcher);
  const s=await api.signIn('test@example.test','test-only');
  assert.equal(s.accessToken,'test-access');assert.equal(s.refreshToken,'SHOULD-NOT-BE-PERSISTED');
  await api.getUser(s.accessToken);await api.listNotes(s.accessToken);
  assert.equal(calls[0].opts.headers.apikey,'sb_publishable_testexample');
  assert.equal(calls[1].opts.headers.Authorization,'Bearer test-access');
  assert.equal(calls[2].opts.headers.Authorization,'Bearer test-access');
  assert.ok(calls[2].url.includes('visibility=eq.private'));
});
test('atomic approval feature stays off unless the exact post-migration development switch is enabled',()=>{
 assert.equal(sanitizedDevConfig(raw).atomicFictionalApprovals,undefined);assert.equal(sanitizedDevConfig({...raw,CC_DEV_ATOMIC_FICTIONAL_APPROVALS:'true'}).atomicFictionalApprovals,undefined);assert.equal(sanitizedDevConfig({...raw,CC_DEV_ATOMIC_FICTIONAL_APPROVALS:'enabled-after-approved-migration'}).atomicFictionalApprovals,true);
});
