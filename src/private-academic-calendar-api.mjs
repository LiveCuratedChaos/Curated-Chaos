const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function createAcademicCalendarApi(request){
 return {async listPrivateAcademicSources(token,owner,programId){
  if(!uuid(owner)||programId!==null&&!uuid(programId))throw Error('Verified academic calendar scope required.');
  const base='/rest/v1/cc_records?select=id,version,owner_id,kind:payload->>kind,sessions:payload->studySessions'+
   '&owner_id=eq.'+owner+'&household_id=is.null&visibility=eq.private&deleted_at=is.null&section=eq.School&item_type=eq.school_fixture&origin=eq.M2E_SCHOOL_QA'+
   (programId?'&or=(id.eq.'+programId+',payload->>degreeId.eq.'+programId+')':'')+'&order=id.asc&limit=100';
  const rows=[];let last='';
  for(;;){
   const page=await request(base+(last?'&id=gt.'+last:''),{},token);
   if(!Array.isArray(page)||page.length>100)throw Error('Incomplete academic calendar.');
   for(const row of page){
    if(!uuid(row?.id)||row.id<=last||row.owner_id!==owner||!['degree','course'].includes(row.kind)||!Number.isInteger(row.version)||row.version<1)throw Error('Invalid academic source.');
    last=row.id;rows.push({id:row.id,version:row.version,kind:row.kind,sessions:row.sessions});
   }
   if(rows.length>2000)throw Error('Academic record limit exceeded.');
   if(page.length<100)return rows;
  }
 }};
}
