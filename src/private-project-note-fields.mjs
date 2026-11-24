const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
export function projectNoteIds(record){
 if(!Object.hasOwn(record.payload,'noteIds'))return [];
 const ids=record.payload.noteIds;
 if(record.section!=='Work'||!Array.isArray(ids)||!ids.length||ids.length>2000||ids.some((id,i)=>!uuid(id)||i>0&&id<=ids[i-1]))throw Error('Invalid project note links.');
 return ids;
}
export function linkedNotePayload(record,noteId,linked){
 const ids=projectNoteIds(record);
 if(!uuid(noteId)||typeof linked!=='boolean'||ids.includes(noteId)===linked)throw Error('Note selection changed.');
 const next=linked?[...ids,noteId].sort():ids.filter(id=>id!==noteId),payload={...record.payload};
 if(next.length)payload.noteIds=next;else delete payload.noteIds;
 return payload;
}
