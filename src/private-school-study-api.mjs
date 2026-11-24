// Private scheduling transport. Ordinary School readers retain their read-only API.
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function createPrivateSchoolStudyApi(request){
 if(typeof request!=='function')throw Error('Study schedule transport required.');
 return {
  appendPrivateStudySession:(token,course,version,schedule,session)=>request('/rest/v1/rpc/cc_append_private_study_session',
   {method:'POST',body:JSON.stringify({p_course:course,p_version:version,p_schedule:schedule,p_session:session})},token),
  async listPrivateStudySchedule(token,owner){
   if(!uuid(owner))throw Error('Verified School owner required.');
   const records=[];
   for(const kind of ['event','school_fixture']){
    const fields=kind==='event'?['fictional','day','time','end_time','end_day','all_day']:['fictional','kind','studySessions'];
    const columns=['id','owner_id','household_id','visibility','section','item_type','origin','version','deleted_at',...fields.map(f=>'study_'+f+':payload->'+f)].join(',');
    const route='/rest/v1/cc_records?select='+columns+'&owner_id=eq.'+owner+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.'+kind+
     (kind==='event'?'&section=eq.Calendar':'&section=eq.School&origin=eq.M2E_SCHOOL_QA&payload->>kind=eq.course')+'&order=id.asc&limit=100';
    let after='';
    for(;;){
     const page=await request(route+(after?'&id=gt.'+after:''),{},token);
     if(!Array.isArray(page)||page.length>100)throw Error('Invalid study schedule page.');
     for(const raw of page){
      if(!uuid(raw?.id)||raw.id<=after||raw.owner_id!==owner||raw.item_type!==kind)throw Error('Invalid study schedule source.');
      const row={...raw,payload:{}};
      for(const field of fields){if(raw['study_'+field]!=null)row.payload[field]=raw['study_'+field];delete row['study_'+field];}
      records.push(row);after=raw.id;
     }
     if(records.length>4000)throw Error('Study schedule exceeds the supported limit.');
     if(page.length<100)break;
    }
   }
   return records;
  }
 };
}
