// Domain-neutral public sparse history validation; no source IDs or record bodies.
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
const fail=()=>{throw Error('Saved versions could not be verified.');};
function expiry(v,now,max){if(v.readOnly!==true||!Number.isFinite(v.expiresAt)||v.expiresAt<=now||v.expiresAt>Math.min(max,now+300000))fail();}
function meta(v,now){const stamp=v.capturedAt;if(!Number.isInteger(v.version)||v.version<1||v.version>2147483647||!['UPDATE','DELETE'].includes(v.operation)||typeof stamp!=='string'||!/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(stamp)||!Number.isFinite(Date.parse(stamp))||new Date(Date.parse(stamp.slice(0,10)+'T00:00:00Z')).toISOString().slice(0,10)!==stamp.slice(0,10)||Date.parse(stamp)>now+300000)fail();}
export function verifyRecordVersionPage(v,{offset=0,now=Date.now(),maxExpiry=now+300000}={}){
 if(!v)fail();expiry(v,now,maxExpiry);
 if(v.available===false){if(!exact(v,['readOnly','available','expiresAt']))fail();return v;}
 if(!exact(v,['readOnly','available','expiresAt','offset','limit','matchCount','versions'])||v.available!==true||!Number.isInteger(offset)||offset<0||offset>999950||offset%50||v.offset!==offset||v.limit!==50||!Number.isInteger(v.matchCount)||v.matchCount<0||v.matchCount>1000000||offset>0&&offset>=v.matchCount||!Array.isArray(v.versions)||v.versions.length!==Math.min(50,v.matchCount-offset)||new Set(v.versions.map(r=>r?.historyReadToken)).size!==v.versions.length)fail();
 for(const r of v.versions){if(!exact(r,['historyReadToken','version','operation','capturedAt',...(Object.hasOwn(r,'recoveredAt')?['recoveredAt']:[])])||!token(r.historyReadToken))fail();meta(r,now);if(Object.hasOwn(r,'recoveredAt'))meta({...r,capturedAt:r.recoveredAt},now);}return v;
}

export {expiry as verifyRecordVersionExpiry,meta as verifyRecordVersionMetadata};
