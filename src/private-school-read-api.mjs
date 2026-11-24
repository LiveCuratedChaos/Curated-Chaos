// Sparse saved-school metadata and one explicit protected record read only.
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const payloadFields=['academicRecoveryVersion','academicIdentityVersion','schemaVersion','fictional','source','kind','title','degreeId','program','code','term','status','credits','officialOrder','studyOrder','targetDate','progressMetric','totalCredits','totalTerms'];
const identity='id,owner_id,household_id,visibility,section,item_type,origin,version,created_at,updated_at,deleted_at';
function path(owner,select){if(!uuid(owner))throw Error('Verified School owner required.');return'/rest/v1/cc_records?select='+select+'&owner_id=eq.'+owner+'&visibility=eq.private&household_id=is.null&section=eq.School&item_type=eq.school_fixture&origin=eq.M2E_SCHOOL_QA&deleted_at=is.null';}
export function createPrivateSchoolReadApi(request){
 if(typeof request!=='function')throw Error('Protected School read transport required.');
 return{
  async listPrivateSchoolSummaries(token,owner){
   const select=identity+','+payloadFields.map(key=>'school_'+key+':payload->'+key).join(','),all=[];let last='';
   for(;;){const rows=await request(path(owner,select)+'&order=id.asc&limit=100'+(last?'&id=gt.'+last:''),{},token);
    if(!Array.isArray(rows)||rows.length>100||rows.some((row,index)=>!uuid(row?.id)||row.id<=(index?rows[index-1].id:last)))throw Error('School metadata pagination could not be verified.');
    for(const row of rows){const metadata={...row},payload={};for(const key of payloadFields){const alias='school_'+key;if(Object.hasOwn(metadata,alias)&&!(['schemaVersion','academicIdentityVersion','academicRecoveryVersion'].includes(key)&&metadata[alias]===null))payload[key]=metadata[alias];delete metadata[alias];}all.push({...metadata,payload});}
    if(all.length>2000)throw Error('School metadata exceeds its supported bound.');if(rows.length<100)return all;last=rows.at(-1).id;
   }
  },
  async getPrivateSchoolRecord(token,id,owner){if(!uuid(id))throw Error('Exact School record required.');const rows=await request(path(owner,identity+',payload')+'&id=eq.'+id+'&limit=2',{},token);if(!Array.isArray(rows)||rows.length>1)throw Error('School record response could not be verified.');return rows;}
 };
}
