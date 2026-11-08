import { randomUUID } from 'node:crypto';
import { loadLocalConfig, assertDevTarget } from './dev-env.mjs';

async function run() {
  const {url,ref,publishableKey,users}=assertDevTarget(loadLocalConfig());
  console.log(`Checking isolated DEVELOPMENT Supabase project: ${ref}`);
  console.log('Only fictional, uniquely labeled QA records will be created. No production integrations are used.');
  let checks=0;
  function pass(description,condition) { if (!condition) throw Error(`FAILED: ${description}`); checks++; console.log(`PASS ${checks}: ${description}`); }
  async function request(path,method='GET',body,token,extra={}) {
    const headers={'apikey':publishableKey,'Accept':'application/json',...extra};
    if (body!==undefined) headers['Content-Type']='application/json';
    if (token) headers.Authorization=`Bearer ${token}`;
    const response=await fetch(`${url}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    let json; try{json=await response.json();}catch{json=null;}
    return {ok:response.ok,status:response.status,data:json};
  }
  async function login(user) {
    const resp=await request('/auth/v1/token?grant_type=password','POST',user);
    if (!resp.ok || !resp.data?.access_token || !resp.data?.user?.id) throw Error('Test account sign-in failed. Check test credentials/email confirmation ONLY in the dev project.');
    return {uid:resp.data.user.id,token:resp.data.access_token};
  }
  const a=await login(users[0]), b=await login(users[1]);
  pass('Two distinct test accounts authenticated',a.uid!==b.uid);
  const headers={'Prefer':'return=representation'};
  const stamp=randomUUID();
  function valid(resp,op) { if(!resp.ok||!Array.isArray(resp.data)||resp.data.length!==1) throw Error(`${op} failed: HTTP ${resp.status}. Only use the NEW development project and the supplied migration.`); return resp.data[0]; }
  const aProfile=await request('/rest/v1/cc_profiles','POST',{user_id:a.uid,display_name:`QA A ${stamp.slice(0,8)}`},a.token,headers);
  // Existing profile from a prior verification run is fine.
  pass('Account A can create/read its own profile',aProfile.ok || aProfile.status===409);
  const bProfile=await request('/rest/v1/cc_profiles','POST',{user_id:b.uid,display_name:`QA B ${stamp.slice(0,8)}`},b.token,headers);
  pass('Account B can create/read its own profile',bProfile.ok || bProfile.status===409);
  const aPrivate=valid(await request('/rest/v1/cc_records','POST',{owner_id:a.uid,section:'Personal Life',item_type:'qa_test',visibility:'private',payload:{label:`QA-private-A-${stamp}`}},a.token,headers),'Account A private insert');
  pass('A can create a private record',aPrivate.owner_id===a.uid);
  const bPrivate=valid(await request('/rest/v1/cc_records','POST',{owner_id:b.uid,section:'Personal Life',item_type:'qa_test',visibility:'private',payload:{label:`QA-private-B-${stamp}`}},b.token,headers),'Account B private insert');
  pass('B can create a private record',bPrivate.owner_id===b.uid);
  const hiddenA=await request(`/rest/v1/cc_records?id=eq.${bPrivate.id}&select=id`, 'GET', undefined,a.token);
  pass('A cannot read B private record',hiddenA.ok&&Array.isArray(hiddenA.data)&&hiddenA.data.length===0);
  const hiddenB=await request(`/rest/v1/cc_records?id=eq.${aPrivate.id}&select=id`, 'GET', undefined,b.token);
  pass('B cannot read A private record',hiddenB.ok&&Array.isArray(hiddenB.data)&&hiddenB.data.length===0);
  const denySpoof=await request('/rest/v1/cc_records','POST',{owner_id:b.uid,section:'Work',item_type:'qa_test',visibility:'private',payload:{label:'spoof'}},a.token,headers);
  pass('A cannot create a private record owned by B',!denySpoof.ok);
  const denyUpdate=await request(`/rest/v1/cc_records?id=eq.${bPrivate.id}`,'PATCH',{payload:{label:'unwanted-write'}},a.token,headers);
  pass('A cannot update B private record',denyUpdate.ok&&Array.isArray(denyUpdate.data)&&denyUpdate.data.length===0);
  const scopeMove=await request(`/rest/v1/cc_records?id=eq.${aPrivate.id}`,'PATCH',{owner_id:b.uid},a.token,headers);
  pass('A cannot change record ownership',!scopeMove.ok);
  const denyDelete=await request(`/rest/v1/cc_records?id=eq.${aPrivate.id}`,'DELETE',undefined,a.token,headers);
  pass('Browser cannot hard-delete even its own record',!denyDelete.ok);
  const aHousehold=valid(await request('/rest/v1/cc_households','POST',{owner_id:a.uid,name:`QA Household A ${stamp.slice(0,8)}`},a.token,headers),'Household A insert');
  pass('A can create household with auto-registered owner',aHousehold.owner_id===a.uid);
  const bHousehold=valid(await request('/rest/v1/cc_households','POST',{owner_id:b.uid,name:`QA Household B ${stamp.slice(0,8)}`},b.token,headers),'Household B insert');
  pass('B can create a separate household',bHousehold.owner_id===b.uid);
  const ownerMember=await request(`/rest/v1/cc_household_memberships?household_id=eq.${aHousehold.id}&select=user_id,role,status`, 'GET',undefined,a.token);
  pass('Household owner membership created securely',ownerMember.ok&&ownerMember.data.length===1&&ownerMember.data[0].user_id===a.uid&&ownerMember.data[0].role==='owner');
  const deniedHouseholdView=await request(`/rest/v1/cc_households?id=eq.${aHousehold.id}&select=id`,'GET',undefined,b.token);
  pass('B cannot read A household',deniedHouseholdView.ok&&deniedHouseholdView.data.length===0);
  const deniedMembership=await request(`/rest/v1/cc_household_memberships?household_id=eq.${aHousehold.id}&select=user_id`,'GET',undefined,b.token);
  pass('B cannot view A membership list',deniedMembership.ok&&deniedMembership.data.length===0);
  const deniedInvite=await request('/rest/v1/cc_household_memberships','POST',{household_id:aHousehold.id,user_id:b.uid,role:'adult'},a.token,headers);
  pass('Browser cannot directly grant household membership',!deniedInvite.ok);
  const deniedOwner=await request('/rest/v1/cc_households','POST',{owner_id:b.uid,name:'QA spoof'},a.token,headers);
  pass('A cannot create a household owned by B',!deniedOwner.ok);
  const aShared=valid(await request('/rest/v1/cc_records','POST',{owner_id:a.uid,household_id:aHousehold.id,section:'Home',item_type:'qa_test',visibility:'household',payload:{label:`QA-shared-${stamp}`}},a.token,headers),'Shared record insert');
  pass('Owner can create household record',aShared.household_id===aHousehold.id);
  const noSharedRead=await request(`/rest/v1/cc_records?id=eq.${aShared.id}&select=id`,'GET',undefined,b.token);
  pass('B cannot read A shared record without membership',noSharedRead.ok&&noSharedRead.data.length===0);
  const noSharedWrite=await request('/rest/v1/cc_records','POST',{owner_id:b.uid,household_id:aHousehold.id,section:'Home',item_type:'qa_test',visibility:'household',payload:{label:'unauthorized'}},b.token,headers);
  pass('B cannot write A household record without permission',!noSharedWrite.ok);
  const anon=await request(`/rest/v1/cc_records?id=eq.${aPrivate.id}&select=id`);
  pass('Unauthenticated Data API caller cannot read private records',(!anon.ok)||(Array.isArray(anon.data)&&anon.data.length===0));
  const verifyB=await request(`/rest/v1/cc_records?id=eq.${bPrivate.id}&select=payload`, 'GET',undefined,b.token);
  pass('Failed attacker update did not modify B data',verifyB.ok&&verifyB.data.length===1&&verifyB.data[0].payload.label===`QA-private-B-${stamp}`);
  console.log(`\n${checks} development RLS isolation checks passed. Fixture records remain in DEVELOPMENT for audit.`);
  console.log('Not yet tested: invitation flow, cross-member sharing grants, data migration, production auth, live provider sync, backup/restore.');
}
run().catch(err=>{console.error(`\nVerification STOPPED: ${err.message}`);process.exitCode=1;});
