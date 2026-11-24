import {verifyRecordVersionRecovery} from './private-record-version-provenance.mjs';
// Server-only selected-source history. Browser callers never supply record/version UUIDs.
import {randomBytes} from 'node:crypto';
import {stableStringify} from './stable-json.mjs';
import {safeSavedAt} from './snapshot-freshness.mjs';
import {privateWorkspaceRestoreDigest} from './private-workspace-restore-contract.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),opaque=()=>randomBytes(32).toString('base64url');
const fail=()=>{throw Error('Current owned record history could not be verified.');};
function record(row,owner){
 if(!uuid(row?.id)||row.owner_id!==owner||row.visibility!=='private'||row.household_id!==null||!['task','note','event','project','school_fixture','dashboard_layout'].includes(row.item_type)||!Number.isInteger(row.version)||row.version<1||!row.payload||typeof row.payload!=='object'||Array.isArray(row.payload)||Buffer.byteLength(JSON.stringify(row.payload))>1024*1024||![row.created_at,row.updated_at].every(safeSavedAt)||row.deleted_at!==null&&!safeSavedAt(row.deleted_at))fail();
 return privateWorkspaceRestoreDigest([row]);
}
function instant(value){if(!safeSavedAt(value))fail();return BigInt(Date.parse(value))*1000n+BigInt((value.match(/\.(\d{1,6})(?:Z|[+-])/)?.[1]??'').padEnd(6,'0').slice(3));}
function metadata(entry,type,now){if(!uuid(entry?.id)||!Number.isInteger(entry.source_version)||entry.source_version<1||entry.item_type!==type||!['UPDATE','DELETE'].includes(entry.operation)||!safeSavedAt(entry.captured_at)||Date.parse(entry.captured_at)>now+300000)fail();let recoveredAt;if(Object.hasOwn(entry,'recovery')){const provenance=verifyRecordVersionRecovery(entry.recovery);if(provenance)recoveredAt=provenance.restoredAt;}else if(Object.hasOwn(entry,'recovered')){if(entry.recovered!==true||!safeSavedAt(entry.recovered_at))fail();recoveredAt=entry.recovered_at;}if(recoveredAt&&Date.parse(recoveredAt)>now+300000)fail();return{version:entry.source_version,operation:entry.operation,capturedAt:entry.captured_at,...(recoveredAt?{recoveredAt}:{})};}
export function createPrivateRecordVersionReader({api,resolveSource,describeSnapshot,now=Date.now}){
 if(['isPrivateRecordVersionsReady','listPrivateRecordVersions','getPrivateRecordVersion'].some(k=>typeof api?.[k]!=='function')||typeof resolveSource!=='function'||typeof describeSnapshot!=='function'||typeof now!=='function')fail();
 const contexts=new Map();let disposed=false;
 function clear(id){const old=contexts.get(id);if(old)clearTimeout(old.timer);contexts.delete(id);}
 const live=s=>!disposed&&contexts.get(s.id)===s&&s.expiresAt>now();
 async function source(s,actor){if(!live(s)||actor?.ownerId!==s.owner)fail();const selected=await resolveSource(s.id,actor,s.sourceToken);if(!live(s)||!selected||!Number.isFinite(selected.expiresAt)||selected.expiresAt< s.expiresAt)fail();const fingerprint=record(selected.record,s.owner);if(s.fingerprint&&fingerprint!==s.fingerprint)fail();return{...selected,fingerprint};}
 async function ready(s,actor){const value=await api.isPrivateRecordVersionsReady(actor.accessToken);if(!live(s)||typeof value!=='boolean')fail();return value;}
 return{
  async list(id,actor,sourceToken,expiresAt,{offset=0}={}){
   if(disposed||typeof id!=='string'||!id||!uuid(actor?.ownerId)||!Number.isFinite(expiresAt)||expiresAt<=now()||!Number.isInteger(offset)||offset<0||offset>999950||offset%50)fail();
   clear(id);const s={id,owner:actor.ownerId,sourceToken,expiresAt:Math.min(expiresAt,now()+300000),actions:new Map()};contexts.set(id,s);s.timer=setTimeout(()=>{if(contexts.get(id)===s)clear(id);},Math.max(1,s.expiresAt-now()));s.timer.unref?.();
   try{
    const selected=await source(s,actor);s.fingerprint=selected.fingerprint;s.recordId=selected.record.id;s.type=selected.record.item_type;
    if(!await ready(s,actor)){await source(s,actor);return{readOnly:true,available:false,expiresAt:s.expiresAt};}
    const page=await api.listPrivateRecordVersions(actor.accessToken,s.recordId,offset);
    if(!live(s)||!page||Object.keys(page).sort().join(',')!=='limit,matchCount,offset,versions'||page.offset!==offset||page.limit!==50||!Number.isInteger(page.matchCount)||page.matchCount<0||page.matchCount>1000000||offset>0&&offset>=page.matchCount||!Array.isArray(page.versions)||page.versions.length!==Math.min(50,page.matchCount-offset)||new Set(page.versions.map(v=>v?.id)).size!==page.versions.length)fail();
    const versions=page.versions.map((entry,index)=>{if(Object.keys(entry).sort().join(',')!==(Object.hasOwn(entry,'recovered')?'captured_at,id,item_type,operation,recovered,recovered_at,source_version':'captured_at,id,item_type,operation,source_version'))fail();const fields=metadata(entry,s.type,now()),token=opaque();const previous=page.versions[index-1];if(previous&&(instant(previous.captured_at)<instant(entry.captured_at)||instant(previous.captured_at)===instant(entry.captured_at)&&previous.id<=entry.id))fail();s.actions.set(token,{id:entry.id,fields});return{historyReadToken:token,...fields};});
    if(!await ready(s,actor))fail();await source(s,actor);
    return{readOnly:true,available:true,expiresAt:s.expiresAt,offset,limit:50,matchCount:page.matchCount,versions};
   }catch(error){if(contexts.get(id)===s)clear(id);throw error;}
  },
  async read(id,actor,historyReadToken){
   const s=contexts.get(id),action=s?.actions.get(historyReadToken);if(!s||!live(s)||s.owner!==actor?.ownerId||!action)fail();s.actions.delete(historyReadToken);
   if(!await ready(s,actor))fail();const current=await source(s,actor);const rows=await api.getPrivateRecordVersion(actor.accessToken,s.recordId,action.id);
   if(!live(s)||!Array.isArray(rows)||rows.length!==1)fail();const entry=rows[0];if(Object.keys(entry).sort().join(',')!==(Object.hasOwn(entry,'recovery')?'captured_at,id,item_type,operation,owner_id,record_id,recovery,snapshot,source_version':'captured_at,id,item_type,operation,owner_id,record_id,snapshot,source_version')||entry.id!==action.id||entry.owner_id!==s.owner||entry.record_id!==s.recordId||stableStringify(metadata(entry,s.type,now()))!==stableStringify(action.fields))fail();
   record(entry.snapshot,s.owner);if(entry.snapshot.id!==s.recordId||entry.snapshot.item_type!==s.type||entry.snapshot.version!==entry.source_version)fail();
   const described=await describeSnapshot(structuredClone(entry.snapshot),{contextId:s.id,expiresAt:s.expiresAt,current:structuredClone(current.record)});if(!described||typeof described!=='object'||Array.isArray(described))fail();
   if(!await ready(s,actor))fail();await source(s,actor);return{readOnly:true,historical:true,expiresAt:s.expiresAt,...action.fields,wasDeleted:entry.snapshot.deleted_at!==null,record:described};
  },clear,
  dispose(){disposed=true;for(const id of contexts.keys())clear(id);}
 };
}
