// Read-only operator preflight. No conversion, source mutation, provider access or write authority.
import {createHash} from 'node:crypto';
import {stableStringify} from './stable-json.mjs';
import {planWorkspaceConvergence} from './workspace-convergence-plan.mjs';
import {checkWorkspaceConvergenceRelationships} from './workspace-convergence-relationships.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const covered=['project','task','project_task_link','project_project_link','common_task_link'];
function inventory(rows,owner){
 if(!Array.isArray(rows)||rows.length>2000||new Set(rows.map(r=>r?.id?.toLowerCase?.())).size!==rows.length||rows.some(r=>!uuid(r?.id)||r.owner_id!==owner||r.household_id!==null||r.visibility!=='private'||r.deleted_at!==null||!Number.isSafeInteger(r.version)||r.version<1||!covered.includes(r.item_type)||!r.payload||typeof r.payload!=='object'||Array.isArray(r.payload)))throw Error('Complete scoped convergence inventory required.');
 const text=stableStringify(rows.slice().sort((a,b)=>a.id.localeCompare(b.id)));if(Buffer.byteLength(text)>64*1024*1024)throw Error('Bounded convergence inventory required.');return createHash('sha256').update(text).digest('hex');
}
export async function readWorkspaceConvergencePreview({api,actor,expiresAt,now=Date.now,current=()=>true}={}){
 if(typeof api?.listWorkspaceConvergenceRecords!=='function'||!uuid(actor?.ownerId)||typeof actor.accessToken!=='string'||!actor.accessToken||typeof now!=='function'||typeof current!=='function'||!Number.isFinite(expiresAt)||expiresAt<=now()||!current())throw Error('Active scoped convergence preview required.');
 const first=await api.listWorkspaceConvergenceRecords(actor.accessToken,actor.ownerId);if(!current())throw Error('Convergence view ended.');const before=inventory(first,actor.ownerId),records=first.filter(r=>r.item_type!=='common_task_link'),canonicalCount=first.length-records.length,plan=planWorkspaceConvergence({records,ownerId:actor.ownerId,complete:true});let relationships=null,issue=null;
 if(canonicalCount)issue='CANONICAL_RELATIONSHIPS_PENDING';else if(plan.counts.unknownProvenance)issue='UNSUPPORTED_PROVENANCE';else try{relationships=checkWorkspaceConvergenceRelationships({records,ownerId:actor.ownerId,complete:true});}catch(error){issue=['PROJECT_HIERARCHY_SINGLE_PARENT','PROJECT_HIERARCHY_CYCLE'].includes(error?.code)?error.code:'UNVERIFIED_RELATIONSHIPS';}
 if(!current()||expiresAt<=now())throw Error('Convergence view ended.');const second=await api.listWorkspaceConvergenceRecords(actor.accessToken,actor.ownerId);if(!current()||before!==inventory(second,actor.ownerId)||expiresAt<=now())throw Error('Convergence source changed.');
 const checked=now();if(expiresAt<=checked||!current())throw Error('Convergence view ended.');
 return{readOnly:true,planOnly:true,recordWrites:0,automaticConversionAllowed:false,migrationReady:false,completeWithinCoveredTypes:true,coveredTypes:[...covered],counts:{...plan.counts,canonicalMemberships:canonicalCount},relationshipValidationPerformed:Boolean(relationships),relationshipIssue:issue,fullPayloadCompatibilityValidated:false,historyCompatibilityValidated:false,requiredContracts:[...plan.requiredContracts,...(canonicalCount?['canonical manual/academic source relationships and owned School dependencies']:[])],checkedAt:new Date(checked).toISOString(),expiresAt:Math.min(expiresAt,checked+300000)};
}
