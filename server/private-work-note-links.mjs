import {linkedNotePayload,projectNoteIds} from '../src/private-project-note-fields.mjs';
import {randomBytes} from 'node:crypto';

function noteTitle(row,owner){
 if(!row||row.owner_id!==owner||row.visibility!=='private'||row.household_id!==null||row.deleted_at!==null||
   row.item_type!=='note'||row.section!=='Personal Life'||row.fictional!==true||!Number.isInteger(row.version)||row.version<1||
   !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.id)||
   typeof row.title!=='string'||!row.title.trim()||row.title.length>200)throw Error('Private note unavailable.');
 return {id:row.id,version:row.version,title:row.title};
}
export async function noteChoices(api,actor,project,{offset,query,linkedOnly}){
 if(!Number.isInteger(offset)||offset<0||offset>1950||offset%50||typeof query!=='string'||query.length>100||
    /[\u0000-\u001f\u007f]/.test(query)||typeof linkedOnly!=='boolean')throw Error('Select a supported note page.');
 const source=await api.listProjectNoteTitles(actor.accessToken,actor.ownerId);
 if(!Array.isArray(source)||source.length>2000||new Set(source.map(r=>r.id)).size!==source.length)throw Error('Note inventory changed.');
 const fold=s=>s.normalize('NFKC').toLowerCase(),term=fold(query.trim()),linked=new Set(projectNoteIds(project));
 const rows=source.map(r=>noteTitle(r,actor.ownerId)).filter(r=>(!linkedOnly||linked.has(r.id))&&fold(r.title).includes(term))
  .sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
 if(offset&&offset>=rows.length)throw Error('Note inventory changed.');
 const options=new Map(rows.slice(offset,offset+50).map(row=>[randomBytes(32).toString('base64url'),{...row,linked:linked.has(row.id)}]));
 return {options,reply:{query:query.trim(),offset,linkedOnly,total:rows.length,
  notes:[...options].map(([choice,note])=>({choice,title:note.title,linked:note.linked}))}};
}
export async function currentProjectNote(api,actor,project,item){
 if(!item||projectNoteIds(project).includes(item.id)!==item.linked)throw Error('Note link changed.');
 const rows=await api.listProjectNoteTitles(actor.accessToken,actor.ownerId,item.id);
 if(!Array.isArray(rows)||rows.length!==1)throw Error('Note changed.');
 const note=noteTitle(rows[0],actor.ownerId);
 if(note.id!==item.id||note.version!==item.version||note.title!==item.title)throw Error('Note changed.');
 return note;
}
export function proposedNoteLink(record,item,linked){
 return {...record,payload:linkedNotePayload(record,item.id,linked)};
}
