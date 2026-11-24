// The Brief inventory supplies titles and versions. Note text is available only on a selected read.
export function isPrivateNoteSummary(row,owner){
 return Boolean(row&&typeof row.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id)
  &&row.owner_id===owner&&row.household_id===null&&row.visibility==='private'&&row.deleted_at===null&&row.section==='Personal Life'
  &&row.item_type==='note'&&row.payload?.fictional===true&&typeof row.payload.title==='string'&&row.payload.title.trim()
  &&row.payload.title.length<=200&&Number.isInteger(row.version)&&row.version>0);
}
export function isPrivateNoteOriginal(row,owner,expectedId){
 return isPrivateNoteSummary(row,owner)&&row.id===expectedId&&typeof row.payload.body==='string'&&row.payload.body.length<=100000;
}
