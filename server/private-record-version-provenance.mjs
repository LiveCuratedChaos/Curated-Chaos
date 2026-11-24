// Original history facts stay intact; every recovered copy has separate immutable provenance.
import {safeSavedAt} from './snapshot-freshness.mjs';
import {stableStringify} from './stable-json.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function verifyRecordVersionRecovery(value,depth=0){
 if(value===null)return value;
 if(depth>=20||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='previous,restoredAt,snapshotId,version'||value.version!==1||!uuid(value.snapshotId)||!safeSavedAt(value.restoredAt))throw Error('Bounded verified record recovery provenance required.');
 verifyRecordVersionRecovery(value.previous,depth+1);return value;
}
export function retainsRecordVersionRecovery(current,archived){
 verifyRecordVersionRecovery(current);verifyRecordVersionRecovery(archived);
 for(let value=current;;value=value.previous){if(stableStringify(value)===stableStringify(archived))return true;if(value===null)return false;}
}
