// M1H: Read-only, non-destructive integrity observations from a bounded owner-private test snapshot.
// A returned owner-filtered set is NOT proof of comprehensive server-side RLS or production compliance.
const arrays = x => Array.isArray(x) ? x : [];
export const ACCEPTANCE_CASES=Object.freeze([
  {id:'events',title:'Daily Brief and historical calendar',detail:'Check that the original October 30 test event remains available in the agenda by selecting that date; today should not incorrectly display yesterday as upcoming.',url:'/dev-agenda.html'},
  {id:'domains',title:'School, finance and household information',detail:'Verify fictional records appear in Life Sources and the Daily Brief according to Account A settings. Financial amounts should be hidden if you selected Hide amounts.',url:'/dev-life.html'},
  {id:'approvals',title:'Email approvals and decision history',detail:'Confirm previously approved appointment and assessment tasks remain in Tasks, are not pending, and their decisions are recorded. Do not approve a suggestion twice.',url:'/dev-dashboard.html'},
  {id:'sync',title:'Cross-tab refresh and duplicate prevention',detail:'With two tabs using Account A, refresh from the Daily Brief. Existing test tasks should appear once and stay saved after reload.',url:'/dev-dashboard.html'},
  {id:'failure',title:'Simulated outage and successful recovery',detail:'Only in Daily Brief: simulate outage, confirm OFFLINE/stale and blocked actions, restore, then Fetch latest to return to FRESH.',url:'/dev-dashboard.html'},
  {id:'preferences',title:'Saved preferences after sign-out and sign-in',detail:'Verify Classic Minimal, School visible, email suggestions enabled, financial amounts hidden. Changes should persist after refresh.',url:'/dev-settings.html'},
  {id:'isolation',title:'Account A versus Account B privacy',detail:'Sign into B and confirm A’s private records, decisions and preferences remain inaccessible; then return to A. This browser check does not replace formal database RLS tests.',url:'/dev-auth.html'}
]);
export function auditSnapshot(data,userId){
  if(typeof userId!=='string'||!userId) throw Error('Verified account is required.');
  const sources=[['core',arrays(data?.core)],['email',arrays(data?.email)],['life',arrays(data?.life)],['decisions',arrays(data?.decisions)],['preferences',arrays(data?.preferences)]];
  const counts={tasks:0,events:0,notes:0,email:0,life:0,decisions:0,preferences:0};
  const findings=[];const ids=new Set();let seen=0;
  for(const [source,rows] of sources){
    for(const r of rows){
      seen++;
      if(!r||r.owner_id!==userId||r.visibility!=='private'||r.household_id!==null){findings.push({level:'fail',message:`Unexpected owner/visibility/household metadata in returned ${source} record. Stop testing and investigate.`});continue;}
      if(!r.id||ids.has(r.id))findings.push({level:'warn',message:`Missing or repeated record identifier in returned ${source} response.`});
      ids.add(r.id);
      if(source==='core'&&r.item_type==='task')counts.tasks++;
      if(source==='core'&&r.item_type==='event')counts.events++;
      if(source==='core'&&r.item_type==='note')counts.notes++;
      if(source==='email'&&r.item_type==='email_fixture')counts.email++;
      if(source==='life'&&['school_fixture','bill_fixture','household_fixture'].includes(r.item_type))counts.life++;
      if(source==='decisions'&&r.item_type==='suggestion_decision')counts.decisions++;
      if(source==='preferences'&&r.item_type==='brief_preferences')counts.preferences++;
    }
  }
  if(!seen)findings.push({level:'warn',message:'No saved records returned for this test account. Add fictional data before acceptance testing.'});
  for(const [key,label] of [['tasks','tasks'],['events','calendar events'],['email','fictional emails'],['life','school/finance/household fixtures']]){
    if(!counts[key])findings.push({level:'warn',message:`No ${label} returned in this bounded read. Check the corresponding QA page.`});
  }
  if(counts.preferences===0)findings.push({level:'warn',message:'No saved Daily Brief preferences returned; defaults may apply.'});
  if(counts.preferences>1)findings.push({level:'warn',message:'Multiple preference records returned; verify which saved preference is active.'});
  if(counts.tasks>=200)findings.push({level:'warn',message:'Core record query is bounded to 200; older tasks or events might be outside this sample.'});
  const bad=findings.some(f=>f.level==='fail');
  return {counts,returnedRecords:seen,findings,status:bad?'fail':'verified',description:bad?'Integrity concern in records returned to this account': 'Authenticated bounded cloud read succeeded; content and account-isolation checks still require manual review'};
}
export function acceptanceProgress(values){
  const states=ACCEPTANCE_CASES.map(c=>values?.[c.id]||'unverified');
  return {total:states.length,passed:states.filter(s=>s==='passed').length,failed:states.filter(s=>s==='failed').length,blocked:states.filter(s=>s==='blocked').length,complete:states.every(s=>s==='passed')};
}
