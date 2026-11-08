// M1G: Freshness labels for a fictional, isolated development-cloud snapshot.
// These never assert that Google, Apple, email or financial providers are connected.
export const FRESH_AFTER_MS=3*60*1000;
const goodTime=t=>Number.isFinite(t)&&t>0;
export function cloudFreshness({lastSuccessAt=0,now=Date.now(),loading=false,offline=false,failed=false}={}){
  if(!goodTime(lastSuccessAt))return {state:offline?'offline':loading?'loading':failed?'failed':'unverified',readable:'No verified cloud snapshot',allowWrite:false};
  if(offline)return {state:'offline',readable:'Connection unavailable — showing last confirmed snapshot',allowWrite:false};
  if(failed)return {state:'failed',readable:'Refresh failed — showing last confirmed snapshot',allowWrite:false};
  if(loading)return {state:'checking',readable:'Checking cloud — showing previous snapshot',allowWrite:false};
  if(!goodTime(now)||now-lastSuccessAt>FRESH_AFTER_MS||now<lastSuccessAt)return {state:'stale',readable:'Cloud snapshot may be outdated — refresh to verify',allowWrite:false};
  return {state:'fresh',readable:'Development cloud checked recently',allowWrite:true};
}
export function safeSnapshotAge(lastSuccessAt,now=Date.now()){
  if(!goodTime(lastSuccessAt)||!goodTime(now))return 'Never checked';
  if(now<lastSuccessAt)return 'Timestamp needs verification';
  const seconds=Math.max(0,Math.floor((now-lastSuccessAt)/1000));
  return seconds<60?'Less than a minute ago':seconds<3600?`${Math.floor(seconds/60)} minute(s) ago`:`${Math.floor(seconds/3600)} hour(s) ago`;
}
export function verifiedSnapshotCounts({records={},emails=[],life=[],decisions=[]}={}){
  const safe=n=>Array.isArray(n)?n.length:0;
  return {tasks:safe(records.tasks),events:safe(records.events),notes:safe(records.notes),email:safe(emails),life:safe(life),decisions:safe(decisions)};
}
