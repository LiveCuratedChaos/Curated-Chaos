const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
export function createProjectNoteApi(request){
 return {
  async listProjectNoteTitles(token,owner,id=null){
   if(!uuid(owner)||id!==null&&!uuid(id))throw Error('Verified note scope required.');
   const path='/rest/v1/cc_records?select=id,owner_id,visibility,household_id,section,item_type,deleted_at,version,title:payload->>title,fictional:payload->fictional'+
    '&owner_id=eq.'+owner+'&visibility=eq.private&household_id=is.null&deleted_at=is.null&item_type=eq.note&section=eq.Personal%20Life&payload->>fictional=eq.true'+(id?'&id=eq.'+id:'');
   const all=[];let last='';
   do{
    const rows=await request(path+'&order=id.asc&limit='+(id?2:100)+(last?'&id=gt.'+last:''),{},token);
    if(!Array.isArray(rows)||rows.length>(id?1:100)||rows.some((r,i)=>!uuid(r.id)||r.id<=(i?rows[i-1].id:last)||id&&r.id!==id))throw Error('Invalid note page.');
    all.push(...rows);if(all.length>2000)throw Error('Note inventory exceeds the private search limit.');
    if(id||rows.length<100)return all;last=rows.at(-1).id;
   }while(last);
  },
  setWorkProjectNote(token,{projectId,projectVersion,noteId,noteVersion,linked}){
   if(!uuid(projectId)||!uuid(noteId)||![projectVersion,noteVersion].every(n=>Number.isInteger(n)&&n>0)||typeof linked!=='boolean')throw Error('Reviewed note link required.');
   return request('/rest/v1/rpc/cc_set_work_project_note',{method:'POST',body:JSON.stringify({p_project:projectId,p_project_version:projectVersion,p_note:noteId,p_note_version:noteVersion,p_linked:linked})},token);
  }
 };
}
