// Historical metadata only; current progress mode and relationships remain authoritative.
import {verifyRecordVersionMetadata} from './private-record-version-page.mjs';
import {verifyProjectHistoricalDetails} from './private-project-version-panel.mjs';
export function projectHistoricalDraft(historical,{now=Date.now()}={}){
 verifyRecordVersionMetadata(historical,now);if(Object.hasOwn(historical,'recoveredAt'))verifyRecordVersionMetadata({...historical,capturedAt:historical.recoveredAt},now);
 const entry=Object.fromEntries(['version','operation','capturedAt',...(Object.hasOwn(historical,'recoveredAt')?['recoveredAt']:[])].map(k=>[k,historical[k]]));verifyProjectHistoricalDetails(historical,{entry,now,maxExpiry:now+300000});
 return Object.fromEntries(['title','description','section','status',...(historical.record.career?['career']:[])].map(k=>[k,historical.record[k]]));
}
