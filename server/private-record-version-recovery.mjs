import {retainsRecordVersionRecovery} from './private-record-version-provenance.mjs';
// Compare retained immutable history only. No insertion, deletion or imported-fact authority.
import {createHash} from 'node:crypto';
import {stableStringify} from './stable-json.mjs';
import {validatePrivateRecordVersions} from './private-workspace-backup.mjs';
import {privateWorkspaceRestoreDigest} from './private-workspace-restore-contract.mjs';
function canonical(entry){const value=entry.captured_at,match=value.match(/\.(\d{1,6})(?:Z|[+-])/),instant=(BigInt(Date.parse(value))*1000n+BigInt((match?.[1]??'').padEnd(6,'0').slice(3))).toString();const{recovery,...core}=entry;return{...core,captured_at:instant,snapshot:privateWorkspaceRestoreDigest([entry.snapshot])};}
export function retainedRecordVersionPlan({archived,current,records,ownerId,key}){
 const checked=validatePrivateRecordVersions(current,records,ownerId,key);if(Buffer.byteLength(JSON.stringify(checked))>5*1024*1024)throw Error('Bounded retained history required.');
 const map=new Map(checked.map(v=>[v.id,v]));const missingEntries=[];let retained=0,missing=0,conflicting=0;
 for(const entry of archived){const prior=map.get(entry.id);if(prior===undefined){missing++;missingEntries.push(structuredClone(entry));}else if(stableStringify(canonical(prior))!==stableStringify(canonical(entry))||!retainsRecordVersionRecovery(prior.recovery??null,entry.recovery??null))conflicting++;else retained++;}
 const fingerprint=createHash('sha256').update(stableStringify(checked.map(v=>({...canonical(v),recovery:v.recovery??null})).sort((a,b)=>a.id.localeCompare(b.id)))).digest('hex');return{retained,missing,missingEntries,conflicting,blocked:missing+conflicting,fingerprint};
}
